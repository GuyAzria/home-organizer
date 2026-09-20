# -*- coding: utf-8 -*-
# Home Organizer for Home Assistant
# Copyright (C) 2026 Guy Azria
#
# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
# more details. <https://www.gnu.org/licenses/>.
#
# [MODIFIED v2026.9.20 | 2026-09-20] Purpose: A receipt scan no longer stops
#   to ask where an odd product belongs. _clean_category_suggestion checks
#   the name the model proposes - a length, a character whitelist, and that
#   it does not already exist - and it is stored as a NOTE on the item
#   while the item itself is filed under the nearest existing category.
#   Nothing is created here; the review tab shows the proposal with a
#   button, and pressing it is the explicit user action RULE 22 requires.
#   One guitar on a fifty-line receipt used to replace the whole list with
#   a question.
# [MODIFIED v2026.9.20 | 2026-09-20] Purpose: home_organizer/draw_item_icon
#   draws ONE item an icon on request, from the Change Icon window. The
#   voice path already draws while it adds; a receipt and a barcode do
#   not, and deliberately still do not - a receipt is read in one call
#   carrying every line on the page, and a truncated answer loses the
#   receipt, not just its pictures. So the drawing is offered where it
#   costs one call and the user is looking at the result. The panel
#   sends an id and a sentence; the NAME is read from the database and
#   what comes back is rebuilt field by field by validate_icon_spec
#   before anything is stored (RULE 7, RULE 11, RULE 33a.2).

import logging
from homeassistant.components import frontend
import os
from functools import partial
import time
import json
import re
import asyncio
import shutil
import aiosqlite
import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig, HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers import entity_registry as er
import homeassistant.helpers.config_validation as cv

from .const import (
    DOMAIN, CONF_API_KEY, CONF_DEBUG, DB_FILE, IMG_DIR,
    CONF_STORAGE_METHOD, CONF_DELETE_ON_REMOVE, STORAGE_METHOD_WWW, STORAGE_METHOD_MEDIA,
    CONF_AI_PROVIDER, CONF_PROCESSING_MODE, MODE_LOCAL_ONLY, MODE_HYBRID, PROVIDER_OPENAI, PROVIDER_GEMINI
)
from .database import (
    async_init_db, get_db_path, async_get_or_create_catalog_ids, to_alpha_id, async_get_view_data, async_add_item_db_safe,
    # [ADDED v2026.9.4 | STAGE 2] Receipt persistence helpers.
    async_find_receipt, async_count_receipt_items, async_insert_receipt,
    # [ADDED v2026.9.5 | STAGE 2] Receipt file storage + price history.
    # [MODIFIED v2026.9.9] Every page of a multi-image receipt is archived,
    # so the per-page helpers replace the single-file one here.
    async_store_receipt_pages, async_link_receipt_pages,
    # [ADDED v2026.9.17] A photo of a finished dish, for the cookbook.
    async_store_recipe_photo,
    async_delete_recipe_photo,
    async_list_receipts, async_get_receipt_pages, async_get_receipt_items,
    async_get_categories, async_check_ingredients,
    # [ADDED v2026.9.20] Redrawing one item's icon from the item card.
    async_get_item_naming, async_set_item_icon,
)
from .services import register_services
from .ai_logic import (
    safe_smart_router,
    safe_universal_agent_loop,
)
from .reminders_scheduler import async_register_startup_restore
# [ADDED v2026.9.17] The module itself, for async_speak_to_user. Importing the
# module rather than adding a second `from ... import` keeps one obvious place
# to look when asking what this file uses from the scheduler.
from . import reminders_scheduler
from . import recipes_db
# [ADDED v2026.9.17] Recipe-edit confirmation: the pending-proposal store and
# the cooking state the chat is bound to.
from . import recipe_edits
from .ai_core import state_manager
# [ADDED v2026.9.20] Answering an offered timer goes through the same
# function the chat and voice paths use.
from .agents import cooking_agent
# [ADDED v2026.9.17] Reads a model's JSON reply, code fence and all.
from .ai_core.json_utils import safe_parse_json
# [ADDED v2026.9.17] One gate for every emblem that reaches the database.
from .emblem_sanitizer import sanitize_emblem_svg
from .prompt_core import get_intent_resolve_prompt, get_icon_draw_prompt
# [ADDED v2026.9.20] The same validator the inventory agent's drawings go
# through. A spec from the Change Icon button is no more trusted than one
# that arrives with an add_item call.
from .ai_core.draw_spec import validate_icon_spec
from .prompt_inventory import get_barcode_prompt, get_invoice_prompt

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

WS_GET_DATA = "home_organizer/get_data"
WS_GET_ALL_ITEMS = "home_organizer/get_all_items" 
WS_AI_CHAT = "home_organizer/ai_chat" 
# [ADDED v2026.9.12] Backing command for the receipts table.
WS_LIST_RECEIPTS = "home_organizer/list_receipts"
# [ADDED v2026.10.9] Cookbook UI.
WS_RECIPES = "home_organizer/recipes"
WS_LOOKUP_BARCODE = "home_organizer/lookup_barcode"
WS_SAVE_AVATAR = "home_organizer/save_avatar"
# [ADDED v2026.9.20] Draw one item an icon, on request from its card.
WS_DRAW_ICON = "home_organizer/draw_item_icon"

STATIC_PATH_URL = "/home_organizer_static"
ACTIVE_SESSIONS = {}


def _absorb_applied_edit(user_id, recipe_id, outcome):
    """Put an applied change into the assistant's own copy of the recipe.

    [ADDED v2026.9.20] Two edits in a row used to undo each other.

    Approving a change writes it to the DATABASE, and the panel re-reads the
    page, so the user sees it land. The agent's cooking state was left alone -
    and the binding is only rebuilt when the panel names a DIFFERENT recipe,
    which it does not, because the user is still on the same page. So the next
    proposal was built from the recipe as it stood BEFORE the first change:
    adding anchovies and then changing the oil gave back a recipe with more
    oil and no anchovies.

    This is the missing half of async_apply. It cannot live there - recipe_edits
    knows nothing about chat sessions - so it lives here, and both places that
    apply an edit call it, so the two cannot drift apart (RULE 33d).

    What it does NOT do is move a cook who is walking through the recipe: the
    step they are standing on is kept, clamped to the new length if the change
    made the recipe shorter.
    """
    if not user_id or not recipe_id or not outcome:
        return
    session_key = f"web_session_{user_id}"
    session = ACTIVE_SESSIONS.get(session_key)
    if not session:
        return
    state = state_manager.read_state(
        session, state_manager.COOKING_STATE_KEY) or {}
    # Only the recipe that was actually edited. A session pointing somewhere
    # else must not be quietly rewritten (RULE 31).
    if str(state.get("recipe_id") or "") != str(recipe_id):
        return

    new_steps = outcome.get("steps") or []
    new_ingredients = outcome.get("ingredients") or []
    # [ADDED v2026.9.20] A rewrite in another language moves the title and the
    # language too, and the assistant builds its next proposal from these.
    if outcome.get("name"):
        state["recipe_title"] = outcome["name"]
    if outcome.get("language"):
        state["language"] = outcome["language"]
    if new_ingredients:
        state["ingredients"] = new_ingredients
    if new_steps:
        state["reference_steps"] = new_steps
        if state.get("steps"):
            # A walkthrough is running. Follow the new text, but keep the
            # cook's place rather than sending them back to step 1.
            state["steps"] = new_steps
            state["current_idx"] = min(
                int(state.get("current_idx") or 0), len(new_steps) - 1)
    state_manager.write_state(
        session, state_manager.COOKING_STATE_KEY, state)
    _LOGGER.info(
        "[HO-EDIT] Assistant's copy of recipe %s updated: %d ingredients, "
        "%d steps", recipe_id, len(new_ingredients), len(new_steps),
    )

# [MODIFIED v2026.8.28] The local copies of FallbackMockEntry,
# safe_smart_router and safe_universal_agent_loop that used to live here have
# been removed and replaced with the canonical implementations from ai_core.
# Keeping a second copy meant fixes applied to ai_core/router.py did not reach
# this file: in particular the API-key scrubbing on the exception log line was
# applied to the canonical router while this duplicate still logged the raw
# exception string. The duplicate also took an extra leading `mode` argument
# that the canonical version derives from the config entry itself.
class HOCameraUploadView(HomeAssistantView):
    url = "/api/home_organizer/ext_camera_upload"
    name = "api:home_organizer:ext_camera_upload"
    requires_auth = True 

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request):
        try:
            data = await request.json()
            image_data = data.get("image_data") 
            barcode_data = data.get("barcode_data") 
            context = data.get("context", "chat")
            apply_ai_bg = data.get("apply_ai_bg", False)
            
            if image_data or barcode_data:
                self.hass.bus.async_fire("ho_ext_camera_event", {
                    "image_data": image_data,
                    "barcode_data": barcode_data,
                    "context": context,
                    "apply_ai_bg": apply_ai_bg
                })
                return self.json({"status": "success", "message": "Data received and broadcasted to UI."})
            
            return self.json({"status": "error", "message": "No data provided"}, status_code=400)
        except Exception as e:
            _LOGGER.error(f"External camera upload failed: {e}")
            return self.json({"status": "error", "message": str(e)}, status_code=500)

# [ADDED v2026.9.17] The browser URL for a stored recipe photo.
#
# The row holds a bare filename; the prefix depends on whether the user chose
# www or media storage, which only the integration's config knows. Built here
# rather than in the panel for the same reason every other screen does it
# here: the panel must not have to know where files live.
def _recipe_image_url(hass, filename):
    if not filename:
        return None
    prefix = hass.data.get(DOMAIN, {}).get("config", {}).get(
        "url_prefix", f"/local/{IMG_DIR}")
    return f"{prefix}/{filename}"


@websocket_api.async_response
async def websocket_get_data(hass, connection, msg):
    path = msg.get("path", [])
    query = msg.get("search_query", "")
    date_filter = msg.get("date_filter", "All")
    is_shopping = msg.get("shopping_mode", False)
    data = await async_get_view_data(hass, path, query, date_filter, is_shopping)
    connection.send_result(msg["id"], data)

@websocket_api.async_response
async def websocket_get_all_items(hass, connection, msg):
    try:
        db_path = get_db_path(hass)
        url_prefix = hass.data.get(DOMAIN, {}).get("config", {}).get("url_prefix", f"/local/{IMG_DIR}")
        results = []

        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute("SELECT * FROM items WHERE type='item'") as cursor:
                col_names = [description[0] for description in cursor.description]
                for r in await cursor.fetchall():
                    r_dict = dict(zip(col_names, r, strict=False))
                    img = None
                    raw_path = r_dict.get('image_path')
                    if raw_path:
                        if raw_path.startswith("ICON_LIB"): 
                            img = raw_path
                        else: 
                            img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

                    fp = [r_dict.get(f"level_{i}") for i in range(1, 11) if r_dict.get(f"level_{i}")]

                    results.append({
                        "id": r_dict['id'],
                        "name": r_dict['name'],
                        "qty": r_dict['quantity'],
                        "order_qty": r_dict.get('order_qty') or 1,
                        "date": r_dict.get('item_date', ''),
                        "img": img,
                        "location": " > ".join(fp),
                        "level_1": r_dict.get('level_1', ''),
                        "level_2": r_dict.get('level_2', ''),
                        "level_3": r_dict.get('level_3', ''),
                        "category": r_dict.get('category', ''),
                        "sub_category": r_dict.get('sub_category', ''),
                        "unit": r_dict.get('unit', ''),
                        "unit_value": r_dict.get('unit_value', ''),
                        "barcode": r_dict.get('barcode', '0'),
                        "owner": r_dict.get("owner", ""),
                        "season": r_dict.get("season", ""),
                        "dress_code": r_dict.get("dress_code", ""),
                        "clothing_status": r_dict.get("clothing_status", "Clean"),
                        "measurements": r_dict.get("measurements", "")
                    })
        connection.send_result(msg["id"], results)
    except Exception as e:
        _LOGGER.error(f"websocket_get_all_items error: {e}")

@websocket_api.async_response
async def websocket_lookup_barcode(hass, connection, msg):
    try:
        barcode = str(msg.get("barcode", ""))
        lang_code = msg.get("language", hass.config.language)
        db_path = get_db_path(hass)
        history_row = None
        
        try:
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute("SELECT * FROM barcode_history WHERE barcode=?", (barcode,)) as cursor:
                    history_row = await cursor.fetchone()
        except Exception:
            pass
        
        if history_row:
            h_dict = dict(history_row)
            raw_path = [h_dict.get("level_1", ""), h_dict.get("level_2", ""), h_dict.get("level_3", "")]
            final_path = [p for p in raw_path if p]
            
            connection.send_result(msg["id"], {
                "found": True,
                "item": {
                    "name": h_dict.get("name", ""),
                    "category": h_dict.get("category", ""),
                    "sub_category": h_dict.get("sub_category", ""),
                    "icon_key": h_dict.get("icon_key", ""),
                    "path": final_path
                }
            })
            return

        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries: return
        entry = entries[0]
        
        provider = entry.options.get(CONF_AI_PROVIDER, entry.data.get(CONF_AI_PROVIDER, PROVIDER_GEMINI))
        api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
        mode = entry.options.get(CONF_PROCESSING_MODE, entry.data.get(CONF_PROCESSING_MODE, MODE_HYBRID))
        
        suggestion = {"name": f"Scanned Product ({barcode})", "category": "", "sub_category": "", "icon_key": ""}
        
        if mode == MODE_LOCAL_ONLY or api_key or provider == PROVIDER_OPENAI:
            session = async_get_clientsession(hass)
            lang_map = {"en": "English", "he": "Hebrew", "it": "Italian", "es": "Spanish", "fr": "French", "ar": "Arabic"}
            target_lang = lang_map.get(lang_code, "English")
            
            external_hint = ""
            try:
                off_url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
                async with session.get(off_url) as off_resp:
                    if off_resp.status == 200:
                        off_data = await off_resp.json()
                        product = off_data.get("product", {})
                        if product:
                            external_hint = product.get(f"product_name_{lang_code}") or product.get("product_name") or product.get("generic_name", "")
            except Exception: pass

            if not external_hint:
                try:
                    upc_url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"
                    async with session.get(upc_url) as upc_resp:
                        if upc_resp.status == 200:
                            upc_data = await upc_resp.json()
                            if upc_data.get("items") and len(upc_data["items"]) > 0:
                                external_hint = upc_data["items"][0].get("title", "")
                except Exception: pass

            if not external_hint:
                try:
                    ddg_url = f"https://html.duckduckgo.com/html/?q={barcode}"
                    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
                    async with session.get(ddg_url, headers=headers) as ddg_resp:
                        if ddg_resp.status == 200:
                            html = await ddg_resp.text()
                            match = re.search(r'<a class="result__snippet[^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL)
                            if match:
                                external_hint = re.sub(r'<[^>]+>', '', match.group(1)).strip()
                except Exception: pass

            hint_prompt = ""
            if external_hint:
                hint_prompt = f"I found this exact product name from an external barcode database: '{external_hint}'. YOU MUST USE THIS EXACT PRODUCT as your base, but format/translate it cleanly into {target_lang}."
            else:
                hint_prompt = "I could not find this barcode in external databases. Make your absolute best guess what this retail product is based on the manufacturer prefix. If unknown, just return 'Unknown Product'."
            
            prompt = get_barcode_prompt(barcode, hint_prompt, target_lang)
            res_text, err = await safe_smart_router(hass, entry, prompt)
            
            if not err and res_text:
                clean_txt = re.sub(r'```json\s*|```\s*', '', res_text).strip()
                try:
                    parsed = json.loads(clean_txt)
                    if "name" in parsed:
                        suggestion = parsed
                except Exception as e:
                    _LOGGER.error(f"Barcode JSON parse error: {e}")
        
        connection.send_result(msg["id"], {
            "found": False,
            "suggestion": suggestion
        })
    except Exception as e:
        _LOGGER.error(f"Fatal error in websocket_lookup_barcode: {e}")
        connection.send_result(msg["id"], {
            "found": False,
            "suggestion": {"name": f"Scanned Product ({msg.get('barcode', 'unknown')})"}
        })

@websocket_api.async_response
async def websocket_ai_chat(hass, connection, msg):
    try:
        user_message = msg.get("message", "")
        image_data = msg.get("image_data") 
        mime_val = msg.get("mime_type", "image/jpeg") 

        # [ADDED v2026.9.8] image_data may be a list of pages of ONE receipt.
        # image_pages is what gets sent to the model: it sees every page in a
        # single request, which is what lets it read the header from page one,
        # collect lines from all pages, and treat the overlap between two
        # photographs as the same lines rather than as new ones.
        image_pages = (
            [x for x in image_data if x]
            if isinstance(image_data, list) else
            ([image_data] if image_data else [])
        )
        # Anything downstream that only asks "is there an image" is unchanged.
        image_data = image_pages[0] if image_pages else None
        
        lang_code = msg.get("language", hass.config.language)
        lang_map = {"en": "English", "he": "Hebrew", "it": "Italian", "es": "Spanish", "fr": "French", "ar": "Arabic"}
        target_lang = lang_map.get(lang_code, "English")
        
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries:
            connection.send_result(msg["id"], {"error": "Integration not loaded"})
            return
            
        entry = entries[0]
        
        provider = entry.options.get(CONF_AI_PROVIDER, entry.data.get(CONF_AI_PROVIDER, PROVIDER_GEMINI))
        api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
        mode = entry.options.get(CONF_PROCESSING_MODE, entry.data.get(CONF_PROCESSING_MODE, MODE_HYBRID))
        
        if mode != MODE_LOCAL_ONLY and not api_key and provider != PROVIDER_OPENAI:
            connection.send_result(msg["id"], {"error": "API Key missing."})
            return

        existing_locs_str = ""
        existing_cats_str = ""
        loc_hierarchy_map = {}
        
        async def async_fetch_context():
            nonlocal existing_locs_str, existing_cats_str
            try:
                db_path = get_db_path(hass)
                catalog_map = await async_get_or_create_catalog_ids(hass)
                
                def local_quick_regex(s):
                    if not s: return s
                    m = re.match(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', str(s))
                    if m: return f"[{m.group(1)}] {m.group(2)}"
                    return str(s)

                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    async with db.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE type != 'pending'") as cc:
                        loc_prompt_list = []
                        for r in await cc.fetchall():
                            l1_raw, l2_raw, l3_raw = r[0], r[1], r[2]
                            
                            l1_clean = local_quick_regex(l1_raw) if l1_raw else None
                            l2_clean = local_quick_regex(l2_raw) if l2_raw else None
                            l3_clean = local_quick_regex(l3_raw) if l3_raw else None
                            
                            if l1_raw:
                                raw_path = [l1_raw]
                                clean_path = [l1_clean]
                                root_id_num = catalog_map.get('root', {}).get(l1_clean)
                                if not root_id_num: continue
                                alpha_id = to_alpha_id(root_id_num)
                                cat_id = alpha_id

                                if l2_raw:
                                    raw_path.append(l2_raw)
                                    clean_path.append(l2_clean)
                                    l2_id_num = catalog_map.get(l1_clean, {}).get(l2_clean)
                                    if l2_id_num:
                                        cat_id = f"{alpha_id}{l2_id_num}"
                                    
                                    if l3_raw:
                                        raw_path.append(l3_raw)
                                        clean_path.append(l3_clean)
                                        l3_id_num = catalog_map.get(f"{l1_clean}_{l2_clean}", {}).get(l3_clean)
                                        if l3_id_num:
                                            cat_id = f"{alpha_id}{l2_id_num}.{l3_id_num}"
                                
                                if cat_id not in loc_hierarchy_map:
                                    loc_hierarchy_map[cat_id] = raw_path
                                    loc_prompt_list.append(f"ID '{cat_id}': {' > '.join(clean_path)}")
                        
                        existing_locs_str = "\n".join(loc_prompt_list)
                    
                    # [MODIFIED v2026.9.28] Read the real category list, with
                    # its sub-categories.
                    #
                    # This used to be SELECT DISTINCT category FROM items, which
                    # had two consequences. A category nobody had filed anything
                    # under yet was invisible, so a category the user had just
                    # created could not be chosen by the assistant. And
                    # sub-categories were never sent at all, which made the rule
                    # "only invent a sub-category when nothing close exists"
                    # impossible to follow - the model could not see what
                    # existed.
                    cat_map = await async_get_categories(hass)
                    existing_cats_str = "\n".join(
                        f"{cat}: {', '.join(subs.keys())}" if subs else f"{cat}:"
                        for cat, subs in cat_map.items()
                    )
            except Exception as ex:
                _LOGGER.error(f"Context fetch error: {ex}")
        
        await async_fetch_context()

        if image_data:
            if user_message.lower().startswith("stylist"):
                hass.bus.async_fire("home_organizer_chat_progress", {
                    "step": "Analyzing Garment...",
                    "debug_type": "image_scan",
                    "debug_label": "Stylist Vision",
                    "debug_content": "Identifying clothing item..."
                })
                
                vision_prompt = """Analyze this clothing item. Return ONLY a JSON object in this format:
                {
                    "intent": "add_clothing",
                    "name": "E.g., Blue Denim Jacket",
                    "category": "Clothing",
                    "sub_category": "E.g., Shirts, Pants, Outerwear"
                }"""
                
                res_text, err = await safe_smart_router(hass, entry, vision_prompt, image_data, mime_val)
                if err:
                    connection.send_result(msg["id"], {"error": f"AI Error: {err}"})
                    return
                
                clean_txt = re.sub(r'```json\s*|```\s*', '', res_text).strip()
                try:
                    parsed = json.loads(clean_txt)
                    if parsed.get("intent") == "add_clothing":
                        nm = parsed.get("name", "Unknown Garment")
                        cat = "Clothing"
                        scat = parsed.get("sub_category", "Accessories")
                        
                        await async_add_item_db_safe(
                            hass, nm, 1, ["General"], cat, scat, "pending", None, "0"
                        )
                        hass.bus.async_fire("home_organizer_db_update")
                        
                        connection.send_result(msg["id"], {
                            "response": f"👗 **Garment Identified:** {nm}\nI've added this item to your **Review** tab so you can assign it to a closet.",
                            "debug": {"raw_json": clean_txt, "intent": "add_clothing"}
                        })
                        return
                except Exception as e:
                    _LOGGER.debug("Garment data parse failed: %s", e)
                    connection.send_result(msg["id"], {"error": "Failed to parse garment data."})
                    return
            else:
                invoice_prompt = get_invoice_prompt(target_lang, existing_locs_str, existing_cats_str, user_message)

                hass.bus.async_fire("home_organizer_chat_progress", {
                    "step": "Scanning Document...",
                    "debug_type": "image_scan",
                    "debug_label": "Invoice Prompt",
                    "debug_content": invoice_prompt
                })

                # Every page goes in one call. safe_smart_router accepts a
                # list and passes it straight into the provider payload.
                res_text, err = await safe_smart_router(hass, entry, invoice_prompt, image_pages, mime_val)
                if err:
                    connection.send_result(msg["id"], {"error": f"AI Error: {err}"})
                    return
                if not res_text:
                    connection.send_result(msg["id"], {"error": "AI Response Empty"})
                    return
                    
                clean_txt = re.sub(r'```json\s*|```\s*', '', res_text).strip()
                
                added_count = 0
                parsed = {}
                try:
                    parsed = json.loads(clean_txt)
                    
                    if parsed.get("intent") == "clarify":
                        connection.send_result(msg["id"], {
                            "response": parsed.get("question", "I am not sure where to file these items. Please guide me."),
                            "debug": {"intent": "clarify", "raw_json": clean_txt}
                        })
                        return

                    if parsed.get("intent") == "add_invoice" and "items" in parsed:
                        db_path = get_db_path(hass)

                        # [ADDED v2026.9.4 | STAGE 2] Receipt-level handling.
                        #
                        # The model now returns a "receipt" object alongside the
                        # items. Older responses will not have it, so an empty
                        # dict keeps this backwards compatible.
                        receipt_data = parsed.get("receipt") or {}
                        receipt_id = None


                        # Duplicate detection runs BEFORE a single item row is
                        # written. Writing first and asking afterwards would
                        # leave a half-imported receipt behind if the user then
                        # declined.
                        existing = await async_find_receipt(
                            hass,
                            receipt_data.get("vendor"),
                            receipt_data.get("receipt_number"),
                        )
                        if existing:
                            # The counts are the whole point of this message: a
                            # re-scan usually happens because the first pass read
                            # only part of the document. Without both numbers the
                            # user is choosing blind.
                            old_count = await async_count_receipt_items(
                                hass, existing.get("id")
                            )
                            new_count = len(parsed.get("items") or [])
                            connection.send_result(msg["id"], {
                                "response": (
                                    f"This receipt is already saved.\n\n"
                                    f"{existing.get('vendor') or '-'} | "
                                    f"{existing.get('purchase_date') or '-'} | "
                                    f"{existing.get('total_amount') or '-'} "
                                    f"{existing.get('currency') or ''}\n"
                                    f"Saved copy: {old_count} item(s). "
                                    f"This scan found {new_count}."
                                ),
                                "duplicate_receipt": {
                                    "existing_id": existing.get("id"),
                                    "existing_items": old_count,
                                    "new_items": new_count,
                                },
                                "debug": {"intent": "duplicate_receipt"},
                            })
                            return

                        # [ADDED v2026.9.5 | STAGE 2] Persist the scanned
                        # document first, then record the row that points at it.
                        #
                        # This order is deliberate. A receipts row whose
                        # file_path names a file that was never written gives a
                        # broken screen every time the user opens it. A file with
                        # no row is just an orphan on disk. If the write fails,
                        # this returns None and the receipt is still recorded -
                        # losing the image is much better than losing the amount.
                        # [MODIFIED v2026.9.9] Every page is archived, not just
                        # the first, so a receipt photographed in four parts can
                        # be reopened later as the whole document.
                        #
                        # Files are written before the receipt row exists,
                        # because a row pointing at a file that was never written
                        # produces a broken screen every time it is opened, while
                        # a file with no row is a harmless orphan.
                        stored_pages = await async_store_receipt_pages(
                            hass, image_pages, mime_val
                        )
                        # receipts.file_path stays as page one. It is what the
                        # list views use for a thumbnail, and it keeps receipts
                        # saved before receipt_pages existed working unchanged.
                        stored_file = stored_pages[0] if stored_pages else None

                        # Stored even when the item list is empty: a receipt whose
                        # header was read is still a record that money was spent,
                        # and items can be attached to it by hand later.
                        receipt_id = await async_insert_receipt(hass, {
                            "receipt_number": receipt_data.get("receipt_number"),
                            "vendor": receipt_data.get("vendor"),
                            "purchase_date": receipt_data.get("purchase_date"),
                            "total_amount": receipt_data.get("total_amount"),
                            "currency": receipt_data.get("currency"),
                            "file_path": stored_file,
                            "item_count": len(parsed.get("items") or []),
                        })

                        # Linked after the receipt exists, since page rows need
                        # its id. If this fails the files are still on disk and
                        # page one still displays from receipts.file_path.
                        if receipt_id and stored_pages:
                            await async_link_receipt_pages(
                                hass, receipt_id, stored_pages, mime_val
                            )

                        # [ADDED v2026.9.20] Read once, for the suggestion
                        # check below - a name that already exists is not a
                        # proposal for a new one.
                        try:
                            known_cats = {
                                str(c).casefold()
                                for c in (await async_get_categories(hass))
                            }
                        except Exception:
                            known_cats = set()

                        for item in parsed["items"]:
                            bcode = str(item.get("barcode", "0")).strip()
                            
                            hist_data = None
                            if bcode and bcode != "0":
                                try:
                                    async with aiosqlite.connect(db_path, timeout=10.0) as db:
                                        db.row_factory = aiosqlite.Row
                                        async with db.execute("SELECT * FROM barcode_history WHERE barcode=?", (bcode,)) as cc:
                                            hist_row = await cc.fetchone()
                                            if hist_row:
                                                hist_data = dict(hist_row)
                                except Exception: pass

                            if hist_data:
                                # [FIXED v2026.9.18] The freshly scanned name wins.
                                #
                                # barcode_history remembers where a product lives
                                # and how it is filed, which is worth keeping. The
                                # NAME is different: it is whatever language the
                                # receipt was read in the first time it was seen.
                                # Taking it from history meant a product first
                                # scanned in English kept its English name forever,
                                # even after the user switched the panel to Hebrew
                                # and rescanned the same receipt.
                                #
                                # History is still the fallback for a scan that
                                # produced no readable name.
                                scanned_name = (item.get("name") or "").strip()
                                nm = scanned_name or hist_data.get("name", "Unknown")
                                cat = hist_data.get("category", item.get("category", ""))
                                scat = hist_data.get("sub_category", item.get("sub_category", ""))
                                icon = hist_data.get("icon_key", item.get("icon_key", None))
                                raw_path = [hist_data.get("level_1", ""), hist_data.get("level_2", ""), hist_data.get("level_3", "")]
                                raw_path = [p for p in raw_path if p]
                            else:
                                nm = item.get("name", "Unknown")
                                cat = item.get("category", "")
                                scat = item.get("sub_category", "")
                                icon = item.get("icon_key", None)
                                loc_id = item.get("location_id", "")
                                
                                raw_path = loc_hierarchy_map.get(loc_id)
                                if not raw_path:
                                    for _k, v in loc_hierarchy_map.items():
                                        v_str = " ".join(v).replace("ORDER_MARKER", "")
                                        if loc_id and loc_id.lower() in v_str.lower():
                                            raw_path = v
                                            break
                                if not raw_path: raw_path = ["General"]
                            
                            # [MODIFIED v2026.9.4 | STAGE 2] Unit price, purchased
                            # quantity and the receipt link now travel with the
                            # item. _coerce_amount in database.py turns an
                            # unreadable price into NULL rather than 0, so an
                            # unknown price is never recorded as free.
                            item_qty = int(item.get("qty", 1) or 1)
                            await async_add_item_db_safe(
                                hass, nm, item_qty, raw_path, cat, scat, "pending", icon, bcode,
                                purchase_price=item.get("price"),
                                quantity_purchased=item_qty,
                                receipt_id=receipt_id,
                                # [ADDED v2026.9.30] The scanner's estimate; the
                                # user can correct it on the item card.
                                expiry_date=item.get("expiry_date"),
                                warranty_end_date=item.get("warranty_end_date"),
                                # [ADDED v2026.9.20] A note, not a category.
                                # See _clean_category_suggestion.
                                suggested_category=_clean_category_suggestion(
                                    item.get("suggest_category"), known_cats),
                            )

                            added_count += 1

                            # Write the current name back, so the next scan of
                            # this barcode and any other screen reading history
                            # both show what the user last confirmed rather than
                            # the first language it was ever seen in.
                            if bcode and bcode != "0" and nm:
                                try:
                                    async with aiosqlite.connect(db_path, timeout=10.0) as db:
                                        await db.execute(
                                            "UPDATE barcode_history SET name = ? WHERE barcode = ?",
                                            (nm, bcode),
                                        )
                                        await db.commit()
                                except Exception as hist_err:
                                    _LOGGER.debug("Could not refresh barcode name: %s", hist_err)
                            
                            item["name"] = nm 
                            item["_resolved_path"] = raw_path
                        
                        hass.bus.async_fire("home_organizer_db_update")
                        
                        ai_message = parsed.get("message", f"✅ I have scanned the document and added {added_count} items to the Review tab.")
                        response_text = f"{ai_message}\n\n"
                        for i in parsed["items"]:
                            p_repaired = i.get("_resolved_path", ["General"])
                            display_path = []
                            for node in p_repaired:
                                cl_match = re.match(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', node)
                                if cl_match:
                                    display_path.append(f"[{cl_match.group(1)}] {cl_match.group(2)}")
                                else:
                                    display_path.append(node)
                            
                            path_str = " > ".join(display_path).replace("ORDER_MARKER", "").replace("[", "").replace("]", "")
                            response_text += f"- **{i.get('name')}** (x{i.get('qty')}) -> _{path_str}_\n"

                        connection.send_result(msg["id"], {
                            "response": response_text,
                            "debug": {"raw_json": clean_txt, "intent": "add_invoice"},

                            # [ADDED v2026.9.14] The panel scrolls to this scan once the

                            # review list refreshes. Without it the user is dropped at the

                            # top of a list that may already hold several scans.

                            "receipt_id": receipt_id
                        })
                        return

                except Exception as e:
                    connection.send_result(msg["id"], {"response": f"❌ Could not parse invoice data. Error: {str(e)}", "debug": {"raw": clean_txt}})
                    return

        if user_message.startswith("RESOLVE_BARCODE:"):
            barcode_parts = user_message.replace('RESOLVE_BARCODE:', '').split('-', 1)
            barcode_id = barcode_parts[0].strip()
            manual_name = barcode_parts[1].strip() if len(barcode_parts) > 1 else ""

            hint_text = f"The user scanned a barcode and verified the name is: '{manual_name}'. YOU MUST USE EXACTLY THIS NAME for the product name. Do not invent a different name. Categorize this item logically and assign it to a physical room."

            step1_prompt = get_intent_resolve_prompt(hint_text, existing_locs_str, target_lang)
            
            raw_analysis, err = await safe_smart_router(hass, entry, step1_prompt)
            if not err and raw_analysis:
                clean_txt = re.sub(r'```json\s*|```\s*', '', raw_analysis).strip()
                try:
                    analysis_json = json.loads(clean_txt)
                    if analysis_json.get("intent") == "add" and analysis_json.get("items"):
                        item = analysis_json["items"][0]
                        nm = item.get("name")
                        qt = item.get("qty", 1)
                        loc_id = item.get("location_id", "")
                        
                        pt = loc_hierarchy_map.get(loc_id)
                        if not pt:
                            for _k, v in loc_hierarchy_map.items():
                                v_str = " ".join(v).replace("ORDER_MARKER", "")
                                if loc_id and loc_id.lower() in v_str.lower():
                                    pt = v
                                    break
                        if not pt: pt = ["General"]
                        
                        cat = item.get("category", "")
                        sub_cat = item.get("sub_category", "")
                        icon_key = item.get("icon_key", None)
                        
                        await async_add_item_db_safe(hass, nm, qt, pt, cat, sub_cat, "pending", icon_key, barcode_id)
                        hass.bus.async_fire("home_organizer_db_update")
                        
                        resp_text = f"✅ Added {nm} to the Review tab."
                        connection.send_result(msg["id"], {"response": resp_text})
                        return
                except Exception: pass
            
            connection.send_result(msg["id"], {"error": "Failed to resolve barcode."})
            return

        # [MODIFIED v10.0.0] Identify the caller. connection.user is the
        # authenticated Home Assistant user behind this websocket command.
        # It is forwarded to the agent loop so the smart home agent can run a
        # real permission check before any service call, and it keys the
        # session so histories are never shared between users.
        ws_user = getattr(connection, "user", None)
        ws_user_id = getattr(ws_user, "id", None)
        session_key = f"web_session_{ws_user_id or 'anonymous'}"

        if session_key not in ACTIVE_SESSIONS:
            ACTIVE_SESSIONS[session_key] = []

        # [ADDED v2026.9.17] Bind the conversation to the open recipe.
        #
        # The cookbook used to bind by sending the sentence "Let's cook X" and
        # letting the model find the dish by name. Anything typed afterwards
        # was just text, so "make it 1000g of flour" could be read as a
        # request for a brand-new recipe rather than a change to the one on
        # screen.
        #
        # The panel now names the recipe outright, and it is loaded into the
        # cooking state HERE, deterministically, from the database. The model
        # is told which recipe it is talking about; it does not get to decide.
        ws_recipe_id = msg.get("recipe_id")

        # [ADDED v2026.9.19] Nothing open means nothing bound.
        #
        # The cookbook sends recipe_id on every message and sends it as null
        # when no recipe is open. That null used to fall through this whole
        # block, leaving the binding from the LAST recipe in place - so a
        # question typed on the contents page was still understood as being
        # about a recipe the user had closed. "Suggest something for dinner"
        # was read as a change to that recipe, which is why it never opened a
        # page of its own.
        #
        # The distinction is between a key that is PRESENT and null - the
        # cookbook stating that nothing is open - and a key that is absent,
        # which is every other caller saying nothing about recipes at all.
        # Only the first clears anything.
        #
        # A walkthrough in progress is left alone. Someone cooking from the
        # book may well go back to the contents page mid-recipe, and losing
        # their place there would be worse than the bug this fixes.
        if "recipe_id" in msg and not ws_recipe_id:
            current = state_manager.read_state(
                ACTIVE_SESSIONS[session_key], state_manager.COOKING_STATE_KEY
            ) or {}
            if current.get("recipe_id") and not current.get("steps"):
                state_manager.clear_state(
                    ACTIVE_SESSIONS[session_key],
                    state_manager.COOKING_STATE_KEY,
                )
                _LOGGER.info(
                    "[HO-COOKING] Nothing open in the cookbook - unbound from "
                    "recipe %s", current.get("recipe_id"),
                )

        if ws_recipe_id:
            try:
                bound = await recipes_db.async_get_by_id(hass, ws_recipe_id)
            except Exception as bind_err:
                bound = None
                _LOGGER.warning("Could not bind recipe %s: %s",
                                ws_recipe_id, bind_err)
            if bound:
                current = state_manager.read_state(
                    ACTIVE_SESSIONS[session_key], state_manager.COOKING_STATE_KEY
                ) or {}
                # Only rebuilt when the conversation is not already on this
                # recipe, so re-binding on every message cannot reset the
                # step the user has walked to, or undo a change they have
                # already approved for this cook.
                if str(current.get("recipe_id") or "") != str(ws_recipe_id):
                    # [ADDED v2026.9.20] A different recipe starts a different
                    # conversation.
                    #
                    # The binding was replaced but the TALK was not. The whole
                    # exchange about the previous recipe stayed in the session,
                    # so asking "translate this recipe" on the second one was
                    # answered from the first: its full text was still the most
                    # recent recipe in the conversation, and the model had no
                    # reason to think the request was about anything else. The
                    # translation then landed on the page the user was actually
                    # looking at, which is how one recipe ended up wearing
                    # another's words.
                    #
                    # Everything said about the old recipe goes. What survives
                    # is another agent's state - a shopping draft is not part
                    # of this conversation and must not be collateral (RULE 31:
                    # clear what you meant to clear, nothing else).
                    previous_id = current.get("recipe_id")
                    ACTIVE_SESSIONS[session_key] = [
                        m for m in ACTIVE_SESSIONS[session_key]
                        if m.get("role") == "system"
                        and isinstance(m.get("content"), str)
                        and m["content"].startswith(
                            state_manager.SHOPPING_DRAFT_KEY + ":")
                    ]
                    # A change frozen against the old recipe, and a timer
                    # offered for a step of it, are both answers to questions
                    # that are no longer on screen.
                    if previous_id:
                        recipe_edits.clear(ws_user_id, previous_id)
                    _LOGGER.info(
                        "[HO-COOKING] Switched from recipe %s to %s - the "
                        "previous conversation was cleared.",
                        previous_id, ws_recipe_id,
                    )
                    # [FIXED v2026.9.17] Binding is CONTEXT, not a cooking
                    # session. "steps" must stay empty.
                    #
                    # This used to copy the recipe's steps in. The agent reads
                    # has_active_steps = bool(state["steps"]) as "a
                    # step-by-step walkthrough is running", and its FIX FIRST
                    # safety rule then treats EVERY message as an adjustment
                    # to that walkthrough. So merely opening a recipe made
                    # "Cook this with me" get coerced into fix_recipe - the
                    # full recipe was never printed - and every save or update
                    # was rerouted the same way.
                    #
                    # The steps are still handed over, under a name that says
                    # what they are for: the agent can quote them when it
                    # proposes a change, and nothing treats them as a session
                    # in progress. Pressing "Cook this with me" is what starts
                    # one, which is what that button is for.
                    state_manager.write_state(
                        ACTIVE_SESSIONS[session_key],
                        state_manager.COOKING_STATE_KEY,
                        {
                            "steps": [],
                            "current_idx": 0,
                            "timers": bound.get("timers") or [],
                            "ingredients": bound.get("ingredients") or [],
                            "reference_steps": bound.get("steps") or [],
                            "recipe_title": bound.get("name") or "Saved recipe",
                            "language": bound.get("language") or "en",
                            # Deliberately the SAME value the agent's own
                            # loader uses. _auto_save_completed_recipe treats
                            # anything else as a recipe that needs saving,
                            # which for a recipe that came out of the database
                            # would re-save it under its own name and stamp a
                            # new source_type on it (RULE 33a.8). This is a
                            # recipe loaded from the database; saying so keeps
                            # that path correct.
                            "source_type": "loaded_from_db",
                            "recipe_id": bound.get("id"),
                        },
                    )
                    _LOGGER.info(
                        "[HO-COOKING] Chat bound to recipe %s (%s)",
                        ws_recipe_id, bound.get("name"),
                    )

        ACTIVE_SESSIONS[session_key].append({"role": "user", "content": user_message})

        final_reply = await safe_universal_agent_loop(
            hass, entry, mode, ACTIVE_SESSIONS[session_key], target_lang,
            existing_locs_str, loc_hierarchy_map, user_id=ws_user_id
        )

        if len(ACTIVE_SESSIONS[session_key]) > 10:
            ACTIVE_SESSIONS[session_key] = ACTIVE_SESSIONS[session_key][-10:]

        # [ADDED v2026.9.17] Speak the reply on the caller's own phone when
        # the panel has asked for it, which it does only when its own engine
        # is unavailable. Targeted at the authenticated websocket user, so a
        # reply can never be read aloud in somebody else's house.
        if msg.get("speak") and ws_user_id and final_reply:
            try:
                reminders_scheduler.async_speak_to_user(
                    hass, ws_user_id, final_reply
                )
            except Exception as speak_err:
                # Never fail the reply because the audio could not be sent.
                _LOGGER.warning("Could not speak reply: %s", speak_err)

        # [ADDED v2026.9.17] Hand back any change the agent has PROPOSED.
        #
        # Read here rather than plumbed out through the agent loop: the agent
        # froze it in recipe_edits as a side effect, and this is the one place
        # that knows both the authenticated user and the recipe in hand.
        #
        # Nothing has been written to the recipe at this point. This is the
        # question, not the answer.
        result = {"response": final_reply}

        # [MOVED v2026.9.19] A recipe the assistant has just written.
        #
        # Asking from the contents page - "suggest something for dinner from
        # what is in the fridge" - should end with that recipe OPEN, not with
        # its text scrolling past in the chat. The panel is told which one so
        # it can turn to the page.
        #
        # [FIXED v2026.9.19] This used to sit inside the block below, which
        # runs only when the panel names an open recipe. On the contents page
        # there is no open recipe - that is the whole point - so the marker
        # was never read and the panel was never told. The recipe WAS being
        # written; it just appeared in the cookbook silently while the chat
        # showed the text, which is exactly what was reported.
        #
        # It belongs outside: a recipe that has only just been created cannot
        # have an id the panel could have sent.
        for m in ACTIVE_SESSIONS[session_key]:
            content = m.get("content")
            if (m.get("role") == "system" and isinstance(content, str)
                    and content.startswith("HO_RECIPE_SAVED:")):
                result["saved_recipe_id"] = content.split(":", 1)[1]
        if result.get("saved_recipe_id"):
            # Consumed, so one save cannot reopen the page on every later turn.
            ACTIVE_SESSIONS[session_key] = [
                m for m in ACTIVE_SESSIONS[session_key]
                if not (m.get("role") == "system"
                        and isinstance(m.get("content"), str)
                        and m["content"].startswith("HO_RECIPE_SAVED:"))
            ]

        if ws_recipe_id and ws_user_id:
            # [ADDED v2026.9.17] A typed approval - "yes", "save it" - reaches
            # the SAME execution boundary the buttons use. The agent leaves a
            # marker naming the scope it understood; the write happens here,
            # from the frozen proposal, never from anything in this turn's
            # model output.
            session = ACTIVE_SESSIONS[session_key]
            approved_scope = None
            for m in session:
                content = m.get("content")
                if (m.get("role") == "system" and isinstance(content, str)
                        and content.startswith("HO_EDIT_APPROVED:")):
                    approved_scope = content.split(":", 1)[1]
            if approved_scope:
                # Consumed immediately, so one approval can never apply twice.
                ACTIVE_SESSIONS[session_key] = [
                    m for m in session
                    if not (m.get("role") == "system"
                            and isinstance(m.get("content"), str)
                            and m["content"].startswith("HO_EDIT_APPROVED:"))
                ]
                outcome = await recipe_edits.async_apply(
                    hass, ws_user_id, ws_recipe_id, approved_scope
                )
                if not outcome.get("error"):
                    result["applied_edit"] = outcome
                    _absorb_applied_edit(ws_user_id, ws_recipe_id, outcome)

            # [ADDED v2026.9.17] An emblem the user asked to have redrawn.
            # Both values were validated against the allow-lists in the agent
            # before the marker was written; the panel does the drawing.
            # [MODIFIED v2026.9.17] An emblem the assistant DESIGNED, as a
            # drawing spec. Shapes and numbers only - it was rebuilt field by
            # field against a fixed list in the agent - so nothing that could
            # carry markup travels here. The panel draws it.
            emblem_spec = None
            for m in ACTIVE_SESSIONS[session_key]:
                content = m.get("content")
                if (m.get("role") == "system" and isinstance(content, str)
                        and content.startswith("HO_EMBLEM_SPEC:")):
                    emblem_spec = content[len("HO_EMBLEM_SPEC:"):]
            if emblem_spec:
                ACTIVE_SESSIONS[session_key] = [
                    m for m in ACTIVE_SESSIONS[session_key]
                    if not (m.get("role") == "system"
                            and isinstance(m.get("content"), str)
                            and m["content"].startswith("HO_EMBLEM_SPEC:"))
                ]
                try:
                    result["emblem_spec"] = json.loads(emblem_spec)
                except ValueError:
                    _LOGGER.warning("Emblem spec could not be read back.")

            # [ADDED v2026.9.20] A timer the assistant has offered.
            #
            # Only announced on the turn it was offered, for the same reason
            # a proposal is: an unanswered offer that came back after every
            # later message would read as the assistant nagging.
            #
            # The minutes and label are sent so the panel can SAY what it is
            # offering. They are not what gets scheduled - that is read back
            # from this same state when the answer arrives - so nothing the
            # panel returns can change the timer.
            offered_now = any(
                m.get("role") == "system"
                and isinstance(m.get("content"), str)
                and m["content"].startswith("HO_TIMER_ASKED:")
                for m in ACTIVE_SESSIONS[session_key]
            )
            if offered_now:
                ACTIVE_SESSIONS[session_key] = [
                    m for m in ACTIVE_SESSIONS[session_key]
                    if not (m.get("role") == "system"
                            and isinstance(m.get("content"), str)
                            and m["content"].startswith("HO_TIMER_ASKED:"))
                ]
                offer = state_manager.read_state(
                    ACTIVE_SESSIONS[session_key],
                    state_manager.TIMER_OFFER_KEY)
                if offer:
                    result["pending_timer"] = {
                        "minutes": offer.get("minutes"),
                        "label": offer.get("label") or "",
                    }

            # [FIXED v2026.9.17] Only a proposal made on THIS turn is sent.
            #
            # This used to hand over whatever was still pending, every time
            # the user said anything. An unanswered proposal then came back
            # on screen after each later message - the "previous save
            # message popping up again" that was reported. The proposal
            # itself still waits in recipe_edits for its answer; it just
            # stops re-announcing itself.
            proposed_now = any(
                m.get("role") == "system"
                and isinstance(m.get("content"), str)
                and m["content"].startswith("HO_EDIT_PROPOSED:")
                for m in ACTIVE_SESSIONS[session_key]
            )
            if proposed_now:
                ACTIVE_SESSIONS[session_key] = [
                    m for m in ACTIVE_SESSIONS[session_key]
                    if not (m.get("role") == "system"
                            and isinstance(m.get("content"), str)
                            and m["content"].startswith("HO_EDIT_PROPOSED:"))
                ]
                pending = recipe_edits.get(ws_user_id, ws_recipe_id)
                if pending:
                    result["pending_edit"] = pending

        connection.send_result(msg["id"], result)
        return

    except asyncio.TimeoutError:
        _LOGGER.error("AI Chat Timeout Processing", exc_info=True)
        connection.send_result(msg["id"], {"error": "Timeout Error: Request took too long."})
    except Exception as e:
        _LOGGER.error(f"AI Chat general error: {e}", exc_info=True)
        connection.send_result(msg["id"], {"error": f"General Error: {str(e)}"})

@websocket_api.async_response
async def websocket_save_avatar(hass, connection, msg):
    try:
        import base64
        import os
        user_id = connection.user.id
        img_b64 = msg.get("image_data")
        if img_b64 and "," in img_b64:
            img_b64 = img_b64.split(",")[1]
        
        www_dir = hass.config.path("www", "home_organizer_images")
        # [MODIFIED v10.0.0] exist_ok must be a keyword: the second positional
        # parameter of os.makedirs is `mode`, not `exist_ok`, so this raised
        # FileExistsError on every call after the first.
        await hass.async_add_executor_job(
            partial(os.makedirs, www_dir, exist_ok=True)
        )
        
        avatar_path = os.path.join(www_dir, f"user_avatar_{user_id}.jpg")
        
        def write_file():
            with open(avatar_path, "wb") as f:
                f.write(base64.b64decode(img_b64))
                
        await hass.async_add_executor_job(write_file)
        connection.send_result(msg["id"], {"status": "success"})
    except Exception as e:
        connection.send_result(msg["id"], {"error": str(e)})

# [ADDED v2026.9.20 | 2026-09-20] Draw an icon for ONE item, on request.
#
# WHY THIS IS A SEPARATE PATH - permanent architectural note.
#
# The assistant already draws an icon while it is adding an item by voice.
# Two other routes into the inventory do not: a receipt is read in a single
# call carrying every line on the page, and a barcode lookup answers about a
# product it has never seen. Both still choose from the shipped library,
# deliberately - a drawing per line would multiply the size of the one answer
# that a whole receipt depends on, and a truncated answer loses the receipt,
# not just its pictures.
#
# So the drawing is offered where it costs one call and the user is already
# looking at the result: the Change Icon window. That also makes it THEIR
# choice rather than something that happens to their data unasked.
#
# WHAT CROSSES THE BOUNDARY. The panel sends an item id and a sentence. The
# NAME of the thing being drawn is read from the database here, never taken
# from the message. What comes back from the model is a list of shapes, and
# validate_icon_spec rebuilds it field by field before a single character is
# stored (RULE 7, RULE 11, RULE 15). Nothing on the row is touched except
# icon_spec (RULE 33a.8).
# [ADDED v2026.9.20] A category name the scanner PROPOSED, or None.
#
# WHY A SUGGESTION AND NOT A CATEGORY - permanent architectural note.
#
# A receipt can carry something no shelf in the house fits: a guitar, a
# fishing rod, a socket set. The scan used to be allowed to stop and ask,
# which cost the user the whole receipt - the question was shown INSTEAD of
# the fifty items just read - and letting the model open the category
# instead would produce 'Food', 'Groceries' and 'Foodstuffs' inside a week,
# with nothing to merge them afterwards (RULE 22).
#
# So the item is filed under the nearest existing category and the proposal
# rides along as a note. The review tab shows it with a button. Pressing
# that button is the explicit user action RULE 22 requires, and until it is
# pressed nothing has been created.
#
# This is model output, so it is checked rather than trusted: a length, a
# character whitelist, and a name that does not already exist (RULE 11).
_CATEGORY_NAME = re.compile(r"\A[^\W\d_][\w \-&'/]{0,59}\Z", re.UNICODE)


def _clean_category_suggestion(raw, existing_names):
    """The name the scanner would open, or None if it is not usable."""
    name = str(raw or "").strip()
    if not name or not _CATEGORY_NAME.match(name):
        return None
    # A proposal to open a category that already exists is not a proposal -
    # it is the model restating where the item has already been filed.
    if name.casefold() in existing_names:
        return None
    return name

DRAW_ICON_MAX_DESCRIPTION = 200


@websocket_api.async_response
async def websocket_draw_item_icon(hass, connection, msg):
    item_id = msg.get("item_id")
    naming = await async_get_item_naming(hass, item_id)
    if not naming:
        connection.send_result(msg["id"], {"error": "unknown_item"})
        return

    # The user's own words about their own item. Trimmed to a sentence: this
    # is a hint for a drawing, and a long one is either a mistake or an
    # attempt to make the prompt into something else. Either way the ANSWER
    # is what is constrained - only numbers survive validation below.
    description = str(msg.get("description") or "").strip()
    description = description[:DRAW_ICON_MAX_DESCRIPTION]
    if not description:
        description = naming["name"]

    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_result(msg["id"], {"error": "no_ai"})
        return

    prompt = get_icon_draw_prompt(naming["name"], description)
    res_text, err = await safe_smart_router(hass, entries[0], prompt)
    if err or not res_text:
        # The message is logged, not returned. A provider error can carry a
        # URL or a key fragment, and this one is on its way to a browser
        # (RULE 14).
        _LOGGER.warning("[HO-ICON] Drawing an icon failed: %s", err)
        connection.send_result(msg["id"], {"error": "no_ai"})
        return

    parsed = safe_parse_json(res_text)
    spec = validate_icon_spec((parsed or {}).get("shapes"))
    if not spec:
        # Nothing drawable came back. The item keeps whatever it had rather
        # than losing its picture to a blank one (RULE 31, fail closed).
        _LOGGER.debug("[HO-ICON] No drawable shapes for item %s.", item_id)
        connection.send_result(msg["id"], {"error": "not_drawable"})
        return

    stored = {"shapes": spec}
    if not await async_set_item_icon(
        hass, item_id, json.dumps(stored, ensure_ascii=False)
    ):
        connection.send_result(msg["id"], {"error": "unknown_item"})
        return

    hass.bus.async_fire("home_organizer_db_update")
    _LOGGER.info("[HO-ICON] Drew a new icon for item %s (%d shapes).",
                 item_id, len(spec))
    connection.send_result(msg["id"], {"icon_spec": stored})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if entry.options.get(CONF_DEBUG): _LOGGER.setLevel(logging.DEBUG)

    frontend_folder = os.path.join(os.path.dirname(__file__), "frontend")
    
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            url_path=STATIC_PATH_URL,
            path=frontend_folder,
            cache_headers=False 
        )
    ])
    
    hass.http.register_view(HOCameraUploadView(hass))

    hass.data.setdefault(DOMAIN, {})
    
    storage_method = entry.data.get(CONF_STORAGE_METHOD, STORAGE_METHOD_WWW)
    db_path = hass.config.path(DB_FILE)
    img_folder_path = hass.config.path("www", IMG_DIR)
    img_url_prefix = f"/local/{IMG_DIR}"

    if storage_method == STORAGE_METHOD_MEDIA:
        media_root = "/media"
        # [MODIFIED v2026.8.26] os.path.exists touches the filesystem and was
        # running on the event loop inside this async function.
        if await hass.async_add_executor_job(os.path.exists, media_root):
             db_path = os.path.join(media_root, DB_FILE)
             img_folder_path = os.path.join(media_root, IMG_DIR)
             await hass.http.async_register_static_paths([
                StaticPathConfig(
                    url_path="/home_organizer_media",
                    path=img_folder_path,
                    cache_headers=False
                )
             ])
             img_url_prefix = "/home_organizer_media"
        else:
            _LOGGER.warning("Home Organizer: /media folder not found. Fallback to /config/www.")

    hass.data[DOMAIN]["config"] = {
        "db_path": db_path,
        "img_path": img_folder_path,
        "url_prefix": img_url_prefix,
        "method": storage_method
    }

    sidebar_translations = {
        "he": "ארגונית",
        "it": "HO-AI",
        "es": "HO-AI",
        "fr": "HO-AI",
        "ar": "المنظم",
        "en": "HO-AI"
    }

    sidebar_label = sidebar_translations.get(hass.config.language, "Home Organizer")

    try:
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="home-organizer-panel",
            frontend_url_path="organizer",
            module_url=f"{STATIC_PATH_URL}/organizer-panel.js?v={int(time.time())}",
            sidebar_title=sidebar_label, 
            sidebar_icon="mdi:package-variant-closed",
            require_admin=False
        )
    except Exception as e:
        _LOGGER.warning(f"Panel registration warning: {e}")

    await async_init_db(hass)

    async_register_startup_restore(hass)
    await recipes_db.async_init(hass)

    registry = er.async_get(hass)
    allowed_action_domains = ["light", "switch", "climate", "cover", "fan", "media_player", "script", "scene"]
    static_entities = []
    
    for state in hass.states.async_all():
        if state.domain in allowed_action_domains:
            friendly_name = state.attributes.get("friendly_name", state.entity_id)
            aliases_str = ""
            entity_entry = registry.async_get(state.entity_id)
            if entity_entry and getattr(entity_entry, 'aliases', None):
                aliases_str = f", Aliases: {', '.join([str(a) for a in entity_entry.aliases])}"
            static_entities.append(f"{state.entity_id} (Name: {friendly_name}{aliases_str})")
    
    hass.data[DOMAIN]["static_devices_str"] = "\n".join(static_entities) if static_entities else "No actionable devices found."

    async def handle_voice_command(call: ServiceCall):
        user_message = call.data.get("text", "")
        lang_code = call.data.get("language", hass.config.language)
        
        # [FIXED v2026.9.20] One session per PERSON, not one for the house.
        #
        # This keyed the conversation by conversation_id alone, and fell back
        # to the literal "default_session" when the caller gave none - which
        # most callers do. Two people cooking at once therefore shared one
        # conversation and one cooking state: the step one of them was
        # standing on, and the recipe itself, belonged to whoever spoke last.
        #
        # The authenticated caller is part of the key now, so the fallback is
        # per person rather than global.
        conv_id = call.data.get("conversation_id") or "default_session"
        voice_user_id = getattr(getattr(call, "context", None), "user_id", None)
        session_key = f"voice_{voice_user_id or 'anonymous'}_{conv_id}"
        # Declared in the schema below and never read, so a timer set by voice
        # had no phone to ring and nobody to ring it for.
        voice_device_id = call.data.get("device_id")
        
        if not user_message: return {"response": "Error: No text provided."}

        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries: return {"response": "Error: Integration not loaded."}
        entry = entries[0]
        
        mode = entry.options.get(CONF_PROCESSING_MODE, entry.data.get(CONF_PROCESSING_MODE, MODE_HYBRID))

        existing_locs_str = ""
        loc_hierarchy_map = {}
        
        async def async_fetch_context():
            nonlocal existing_locs_str
            try:
                db_path = get_db_path(hass)
                catalog_map = await async_get_or_create_catalog_ids(hass)
                
                def local_quick_regex(s):
                    if not s: return s
                    m = re.match(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', str(s))
                    if m: return f"[{m.group(1)}] {m.group(2)}"
                    return str(s)

                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    async with db.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE type != 'pending'") as cc:
                        loc_prompt_list = []
                        for r in await cc.fetchall():
                            l1_raw, l2_raw, l3_raw = r[0], r[1], r[2]
                            
                            l1_clean = local_quick_regex(l1_raw) if l1_raw else None
                            l2_clean = local_quick_regex(l2_raw) if l2_raw else None
                            l3_clean = local_quick_regex(l3_raw) if l3_raw else None
                            
                            if l1_raw:
                                raw_path = [l1_raw]
                                clean_path = [l1_clean]
                                root_id_num = catalog_map.get('root', {}).get(l1_clean)
                                if not root_id_num: continue
                                alpha_id = to_alpha_id(root_id_num)
                                cat_id = alpha_id

                                if l2_raw:
                                    raw_path.append(l2_raw)
                                    clean_path.append(l2_clean)
                                    l2_id_num = catalog_map.get(l1_clean, {}).get(l2_clean)
                                    if l2_id_num:
                                        cat_id = f"{alpha_id}{l2_id_num}"
                                    
                                    if l3_raw:
                                        raw_path.append(l3_raw)
                                        clean_path.append(l3_clean)
                                        l3_id_num = catalog_map.get(f"{l1_clean}_{l2_clean}", {}).get(l3_clean)
                                        if l3_id_num:
                                            cat_id = f"{alpha_id}{l2_id_num}.{l3_id_num}"
                                
                                if cat_id not in loc_hierarchy_map:
                                    loc_hierarchy_map[cat_id] = raw_path
                                    loc_prompt_list.append(f"ID '{cat_id}': {' > '.join(clean_path)}")

                        existing_locs_str = "\n".join(loc_prompt_list)
            except Exception: pass
        
        await async_fetch_context()

        lang_map = {"en": "English", "he": "Hebrew", "it": "Italian", "es": "Spanish", "fr": "French", "ar": "Arabic"}
        target_lang = lang_map.get(lang_code, "English")

        if session_key not in ACTIVE_SESSIONS:
            ACTIVE_SESSIONS[session_key] = []

        ACTIVE_SESSIONS[session_key].append(
            {"role": "user", "content": user_message})

        final_reply = await safe_universal_agent_loop(
            hass, entry, mode, ACTIVE_SESSIONS[session_key], target_lang,
            existing_locs_str, loc_hierarchy_map, is_voice=True,
            device_id=voice_device_id, user_id=voice_user_id,
        )
        ACTIVE_SESSIONS[session_key].append(
            {"role": "assistant", "content": final_reply})

        return {"response": final_reply}

    # [ADDED v2026.8.30] Explicit schema. Previously the payload arrived
    # unvalidated from any authenticated caller.
    VOICE_COMMAND_SCHEMA = vol.Schema(
        {
            vol.Required("text"): cv.string,
            vol.Optional("language"): cv.string,
            vol.Optional("conversation_id"): cv.string,
            vol.Optional("device_id"): cv.string,
        }
    )

    hass.services.async_register(
        DOMAIN, 
        "voice_command", 
        handle_voice_command,
        schema=VOICE_COMMAND_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL
    )

    try:
        websocket_api.async_register_command(
            hass,
            WS_GET_DATA, 
            websocket_get_data, 
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_GET_DATA,
                vol.Optional("path", default=[]): list,
                vol.Optional("search_query", default=""): str,
                vol.Optional("date_filter", default="All"): str,
                vol.Optional("shopping_mode", default=False): bool,
            })
        )
    except Exception: pass
    
    try:
        websocket_api.async_register_command(
            hass,
            WS_GET_ALL_ITEMS,
            websocket_get_all_items,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_GET_ALL_ITEMS
            })
        )
    except Exception: pass
    
    # [ADDED v2026.10.9] Cookbook: list, read, save, annotate and delete.
    #
    # One command with an "action" rather than five separate commands. These
    # all operate on the same small record and are only ever called by the
    # cookbook screen, so five registrations would be five things to keep in
    # step for no benefit.
    #
    # It hooks into recipes_db, which already stores the recipes the voice
    # assistant generates - a manually written recipe and a spoken one land in
    # exactly the same table and render in the same cookbook.
    @websocket_api.websocket_command({
        vol.Required("type"): WS_RECIPES,
        vol.Required("action"): vol.In(
            # [FIXED v2026.10.12] "update" and "check_stock" were added to
            # the handler but never to this list, so voluptuous rejected
            # them before the handler ran. The button appeared to do
            # nothing at all.
            # [ADDED v2026.9.16] "add_category" registers a chapter that has
            # no recipe in it yet. Declared here at the same time as the
            # handler and the caller, which is the whole point of this list.
            # [ADDED v2026.9.17] "confirm_edit" / "cancel_edit" answer a
            # change the assistant proposed. They carry no recipe content of
            # their own - see recipe_edits.
            ["list", "get", "save", "update", "save_notes", "delete",
             "check_stock", "add_category", "confirm_edit", "cancel_edit",
             # [ADDED v2026.9.20] "answer_timer" says yes or no to a timer
             # the assistant offered. It carries a boolean and nothing else.
             "answer_timer",
             # [ADDED v2026.9.17] Persist a recipe's emblem, and a photo
             # of the finished dish that is shown in its place.
             "set_emblem", "set_photo",
             # [ADDED v2026.9.17] Chapter housekeeping from the contents
             # page. Deleting a chapter never deletes its recipes.
             "rename_category", "delete_category",
             # [ADDED v2026.9.17] Show a recipe in the panel's language.
             "translate"]
        ),
        vol.Optional("recipe_id"): vol.Any(str, None),
        vol.Optional("language"): vol.Any(str, None),
        vol.Optional("name"): vol.Any(str, None),
        vol.Optional("prep_time"): vol.Any(str, None),
        vol.Optional("ingredients"): vol.Any(list, None),
        vol.Optional("steps"): vol.Any(list, None),
        vol.Optional("timers"): vol.Any(list, None),
        vol.Optional("tags"): vol.Any(list, None),
        vol.Optional("notes"): vol.Any(str, None),
        vol.Optional("handwritten_notes"): vol.Any(str, None),
        # [FIXED v2026.9.16] The same defect as the "update"/"check_stock" one
        # above, one level down: the save handler already read msg["category"]
        # and the shelf already sent it, but the key was never declared here.
        # A websocket schema rejects undeclared keys, so creating a recipe
        # inside a chapter failed before the handler ran. Declared now, and
        # "" is a meaningful value - it files a recipe back under Other.
        vol.Optional("category"): vol.Any(str, None),
        # [ADDED v2026.9.17] Which way a proposed change is being answered.
        # Validated against recipe_edits.ALLOWED_SCOPES in the handler; the
        # schema only says it is a string.
        vol.Optional("scope"): vol.Any(str, None),
        # [ADDED v2026.9.17] The emblem markup, and whether this write is the
        # first-open fill or a deliberate replacement.
        vol.Optional("emblem_svg"): vol.Any(str, None),
        # [ADDED v2026.9.17] A dish photo as a data URL, or null to
        # remove the one that is there.
        vol.Optional("photo"): vol.Any(str, None),
        # [ADDED v2026.9.17] Which language to translate a recipe into.
        vol.Optional("to_language"): vol.Any(str, None),
        # [ADDED v2026.9.19] Ingredients to treat as always in the house.
        vol.Optional("assume_available"): vol.Any([str], None),
        vol.Optional("stopwords"): vol.Any([str], None),
        vol.Optional("accept"): bool,
    })
    @websocket_api.async_response
    async def websocket_recipes(hass, connection, msg):
        action = msg.get("action")
        try:
            if action == "list":
                recipes = await recipes_db.async_list_all(hass, msg.get("language"))
                # The drawing can be a large base64 image. The list view only
                # needs to know whether one exists, so it is stripped here
                # rather than sending several megabytes to render a shelf.
                slim = []
                for rec in recipes:
                    entry = dict(rec)
                    entry["has_handwritten_notes"] = bool(entry.pop("handwritten_notes", None))
                    entry["image_url"] = _recipe_image_url(hass, entry.get("image_path"))
                    slim.append(entry)
                # [ADDED v2026.9.16] Chapters travel with the recipes rather
                # than on a second round trip, because the contents page
                # cannot be drawn correctly without both: a chapter holding
                # nothing appears only in this list.
                categories = await recipes_db.async_list_categories(hass)
                connection.send_result(
                    msg["id"], {"recipes": slim, "categories": categories}
                )
                return

            # [ADDED v2026.9.17] Store a recipe's emblem.
            #
            # The markup is accepted from the panel because the PANEL is what
            # draws it - recipe-emblem.js builds it from a fixed set of motifs
            # and palettes, and no recipe text goes into it. It is rejected
            # unless it looks like exactly that, so this can never become a
            # way to park arbitrary markup in the database and have it
            # rendered back later (RULE 15).
            if action == "set_emblem":
                # [MODIFIED v2026.9.17] The same sanitiser the drawn emblems
                # go through, rather than a second hand-rolled check here.
                # One gate, so the two paths cannot drift apart and the weaker
                # of them become the way in (RULE 33d).
                clean_svg = sanitize_emblem_svg(msg.get("emblem_svg"))
                if not clean_svg:
                    _LOGGER.warning("Rejected an emblem that could not be cleaned.")
                    connection.send_result(msg["id"], {"error": "Bad emblem."})
                    return
                wrote = await recipes_db.async_set_emblem(
                    hass, msg.get("recipe_id"), clean_svg)
                connection.send_result(msg["id"], {"stored": wrote})
                return

            # [ADDED v2026.9.17] A photo of the finished dish, which is
            # shown instead of the drawn emblem. The bytes are written to
            # disk and only the PATH is stored, so a large photo never sits
            # in the database or travels in a recipe listing.
            if action == "set_photo":
                photo = msg.get("photo")
                if not photo:
                    # [MODIFIED v2026.9.20] Removing it takes the FILE too.
                    #
                    # This used to clear the column and leave the picture on
                    # disk for ever. On an install where people photograph
                    # what they cook, that folder only ever grows, holding
                    # images nothing refers to any more.
                    #
                    # Order matters, and it is the same order the rest of this
                    # integration uses: the row is cleared FIRST and the file
                    # removed second. If the delete fails the result is an
                    # orphaned file, which is harmless. The other way round
                    # leaves a row pointing at a file that is gone, which
                    # shows a broken picture on the recipe every time.
                    rec_id = msg.get("recipe_id")
                    old = await recipes_db.async_get_by_id(hass, rec_id)
                    old_name = (old or {}).get("image_path")
                    await recipes_db.async_set_photo(hass, rec_id, None)
                    if old_name and not await recipes_db.async_photo_in_use(
                            hass, old_name, exclude_id=rec_id):
                        await async_delete_recipe_photo(hass, old_name)
                    hass.bus.async_fire("home_organizer_db_update")
                    connection.send_result(msg["id"], {"cleared": True})
                    return
                rec_id = msg.get("recipe_id")
                previous = await recipes_db.async_get_by_id(hass, rec_id)
                previous_name = (previous or {}).get("image_path")
                stored_path = await async_store_recipe_photo(hass, photo)
                if not stored_path:
                    connection.send_result(
                        msg["id"], {"error": "Could not store that photo."})
                    return
                await recipes_db.async_set_photo(hass, rec_id, stored_path)
                # [ADDED v2026.9.20] Setting a photo over an existing one is
                # a deletion of the old one, and leaks the same way. Only
                # after the new file is safely written and recorded, so a
                # failed write never costs the picture that was there.
                if (previous_name and previous_name != stored_path
                        and not await recipes_db.async_photo_in_use(
                            hass, previous_name, exclude_id=rec_id)):
                    await async_delete_recipe_photo(hass, previous_name)
                hass.bus.async_fire("home_organizer_db_update")
                connection.send_result(msg["id"], {"path": stored_path})
                return

            # [ADDED v2026.9.17] A recipe in the language the panel is set to,
            # translated once and then cached.
            #
            # THE ORIGINAL IS NEVER OVERWRITTEN. A translation is a separate
            # row that can be thrown away; what the user or the assistant
            # actually wrote stays exactly as it was (RULE 5).
            #
            # Four ways this declines, and every one of them answers with the
            # original rather than with nothing (RULE 31):
            #   - the recipe is already in that language
            #   - the user has edited it by hand, which locks it
            #   - the model is unavailable
            #   - the reply does not match the shape of this recipe
            if action == "translate":
                rec = await recipes_db.async_get_by_id(hass, msg.get("recipe_id"))
                if not rec:
                    connection.send_result(msg["id"], {"error": "Recipe not found."})
                    return
                target = (msg.get("to_language") or "").strip().lower()[:5]
                source = (rec.get("language") or "en").strip().lower()

                if not target or target == source:
                    connection.send_result(msg["id"], {"same_language": True})
                    return
                if rec.get("translate_lock"):
                    connection.send_result(msg["id"], {"locked": True})
                    return

                cached = await recipes_db.async_get_translation(
                    hass, rec["id"], target)
                if cached:
                    connection.send_result(msg["id"], {"translation": cached})
                    return

                lang_names = {
                    "en": "English", "he": "Hebrew", "it": "Italian",
                    "es": "Spanish", "fr": "French", "ar": "Arabic",
                    "ru": "Russian",
                }
                target_name = lang_names.get(target, target)
                payload = {
                    "name": rec.get("name"),
                    "prep_time": rec.get("prep_time"),
                    "ingredients": rec.get("ingredients") or [],
                    "steps": rec.get("steps") or [],
                }
                prompt = (
                    "Translate this recipe into " + target_name + ". "
                    "Return ONLY a JSON object with exactly these keys: "
                    "name, prep_time, ingredients, steps. "
                    "ingredients is a list of objects with name and qty. "
                    "steps is a list of strings - the SAME number of steps, "
                    "in the same order. "
                    "Translate the WORDS only. Never change a number, a "
                    "measurement, a temperature or a time: 200 g stays 200 g "
                    "and 180C stays 180C. Translate a unit word only where "
                    + target_name + " normally writes it differently. "
                    "No commentary and no code fence."
                    "\n\n" + json.dumps(payload, ensure_ascii=False)
                )

                res_text, err = await safe_smart_router(hass, entry, prompt)
                if err or not res_text:
                    _LOGGER.info("Recipe translation unavailable: %s", err)
                    connection.send_result(msg["id"], {"unavailable": True})
                    return

                parsed = safe_parse_json(res_text)
                # Checked before anything is stored. A reply that drops or
                # invents steps is not a translation of THIS recipe, and a
                # recipe with steps missing is worse than one in the wrong
                # language (RULE 11 - model output is not trusted).
                if (not isinstance(parsed, dict)
                        or not isinstance(parsed.get("steps"), list)
                        or len(parsed["steps"]) != len(payload["steps"])):
                    _LOGGER.warning(
                        "Recipe translation refused: the reply did not match "
                        "the recipe's shape."
                    )
                    connection.send_result(msg["id"], {"unavailable": True})
                    return

                clean = {
                    "name": str(parsed.get("name") or rec["name"]),
                    "prep_time": parsed.get("prep_time") or rec.get("prep_time"),
                    "ingredients": parsed.get("ingredients") or [],
                    "steps": [str(x) for x in parsed["steps"]],
                }
                await recipes_db.async_put_translation(
                    hass, rec["id"], target, clean)
                clean["translated"] = True
                connection.send_result(msg["id"], {"translation": clean})
                return

            if action == "rename_category":
                ok = await recipes_db.async_rename_category(
                    hass, msg.get("category"), msg.get("name"))
                hass.bus.async_fire("home_organizer_db_update")
                connection.send_result(msg["id"], {"renamed": ok})
                return

            # Removing a chapter moves its recipes to "Other". It never
            # deletes them - a shelf is a label, the recipes are the data.
            if action == "delete_category":
                moved = await recipes_db.async_delete_category(
                    hass, msg.get("category"))
                hass.bus.async_fire("home_organizer_db_update")
                connection.send_result(msg["id"], {"moved": moved})
                return

            if action == "add_category":
                ok = await recipes_db.async_add_category(hass, msg.get("category"))
                connection.send_result(msg["id"], {"added": ok})
                return

            # [ADDED v2026.9.17] Answer a change the assistant proposed.
            #
            # This is the execution boundary. Note what it does NOT do: it
            # takes no ingredients and no steps from the caller. The content
            # comes only from the proposal frozen when it was suggested, so
            # what gets written is exactly what the user was shown, and a
            # crafted message cannot smuggle different content past the
            # confirmation (RULE 7, RULE 11).
            if action in ("confirm_edit", "cancel_edit"):
                ws_user = getattr(connection, "user", None)
                edit_user_id = getattr(ws_user, "id", None)
                recipe_id = msg.get("recipe_id")
                if not edit_user_id or not recipe_id:
                    connection.send_result(
                        msg["id"], {"error": "Unknown user or recipe."})
                    return

                if action == "cancel_edit":
                    recipe_edits.clear(edit_user_id, recipe_id)
                    connection.send_result(msg["id"], {"cancelled": True})
                    return

                outcome = await recipe_edits.async_apply(
                    hass, edit_user_id, recipe_id, msg.get("scope")
                )
                if not outcome.get("error"):
                    _absorb_applied_edit(edit_user_id, recipe_id, outcome)
                connection.send_result(msg["id"], outcome)
                return

            if action == "get":
                rec = await recipes_db.async_get_by_id(hass, msg.get("recipe_id"))
                if rec:
                    rec = dict(rec)
                    rec["image_url"] = _recipe_image_url(hass, rec.get("image_path"))
                connection.send_result(msg["id"], {"recipe": rec})
                return

            if action == "save":
                name = (msg.get("name") or "").strip()
                if not name:
                    connection.send_result(
                        msg["id"], {"error": "A recipe needs a name."}
                    )
                    return
                rid, result = await recipes_db.async_save(
                    hass,
                    name,
                    msg.get("ingredients") or [],
                    msg.get("steps") or [],
                    msg.get("timers") or [],
                    language=msg.get("language") or "en",
                    tags=msg.get("tags") or [],
                    notes=msg.get("notes"),
                    # Written by hand in the panel, so this is the one place
                    # source_type is 'manual'.
                    source_type="manual",
                    recipe_id=msg.get("recipe_id"),
                    prep_time=msg.get("prep_time"),
                    category=msg.get("category"),
                )
                # [ADDED v2026.9.17] Written by hand, so automatic translation
                # stops here for good. What the user typed is the recipe now,
                # and no machine may rewrite it afterwards.
                await recipes_db.async_lock_translation(hass, rid)
                hass.bus.async_fire("home_organizer_db_update")
                connection.send_result(msg["id"], {"recipe_id": rid, "result": result})
                return

            if action == "update":
                # Editing an existing recipe: ingredients and steps replace
                # what was there, everything else is preserved.
                #
                # Separate from "save" because save always writes
                # source_type='manual' - a user adding a step to a recipe the
                # assistant generated should not have it relabelled as theirs,
                # and the drawing must survive the edit.
                rec = await recipes_db.async_get_by_id(hass, msg.get("recipe_id"))
                if not rec:
                    connection.send_result(msg["id"], {"error": "Recipe not found."})
                    return
                rid, result = await recipes_db.async_save(
                    hass,
                    (msg.get("name") or rec["name"]).strip(),
                    msg.get("ingredients") if msg.get("ingredients") is not None
                        else rec["ingredients"],
                    msg.get("steps") if msg.get("steps") is not None
                        else rec["steps"],
                    rec["timers"],
                    language=rec["language"],
                    tags=rec["tags"],
                    notes=msg.get("notes") if msg.get("notes") is not None
                        else rec["notes"],
                    source_type=rec["source_type"],
                    recipe_id=rec["id"],
                    prep_time=msg.get("prep_time"),
                    category=msg.get("category"),
                )
                # [ADDED v2026.9.17] An edit locks the recipe against
                # automatic translation, and drops the cached translations -
                # they describe text that no longer exists.
                #
                # Only a CONTENT edit does this. Moving a recipe to another
                # chapter also comes through here, so the lock is skipped
                # when neither the words nor the steps were touched.
                if (msg.get("ingredients") is not None
                        or msg.get("steps") is not None
                        or msg.get("name") is not None
                        or msg.get("notes") is not None
                        or msg.get("prep_time") is not None):
                    await recipes_db.async_lock_translation(hass, rec["id"])
                hass.bus.async_fire("home_organizer_db_update")
                connection.send_result(msg["id"], {"recipe_id": rid, "result": result})
                return

            if action == "check_stock":
                # Which ingredients are in the house, and where.
                rec = await recipes_db.async_get_by_id(hass, msg.get("recipe_id"))
                ingredients = (msg.get("ingredients")
                               if msg.get("ingredients") is not None
                               else (rec or {}).get("ingredients") or [])
                # [ADDED v2026.9.19] The staples the panel says to assume.
                # They arrive as words in the user's own language, read from
                # the translation file, because an English list here could
                # never recognise the ingredient names people actually write.
                report = await async_check_ingredients(
                    hass, ingredients, msg.get("assume_available"),
                    msg.get("stopwords"))
                connection.send_result(msg["id"], {"report": report})
                return

            if action == "save_notes":
                # The drawing layer only. Saved on its own so scribbling in the
                # kitchen never rewrites the recipe text.
                rec = await recipes_db.async_get_by_id(hass, msg.get("recipe_id"))
                if not rec:
                    connection.send_result(msg["id"], {"error": "Recipe not found."})
                    return
                await recipes_db.async_save(
                    hass, rec["name"], rec["ingredients"], rec["steps"],
                    rec["timers"], language=rec["language"], tags=rec["tags"],
                    notes=rec["notes"], source_type=rec["source_type"],
                    recipe_id=rec["id"],
                    handwritten_notes=msg.get("handwritten_notes"),
                )
                connection.send_result(msg["id"], {"saved": True})
                return

            if action == "answer_timer":
                # [ADDED v2026.9.20] The buttons under an offered timer.
                #
                # The panel sends a boolean. The minutes and the label are
                # read back from the session the offer was written into, so
                # the answer cannot change what it is answering (RULE 7) -
                # the same shape as confirm_edit.
                timer_user = getattr(getattr(connection, "user", None), "id", None)
                timer_session = ACTIVE_SESSIONS.get(
                    f"web_session_{timer_user or 'anonymous'}")
                if not timer_session:
                    connection.send_result(
                        msg["id"], {"error": "Nothing to answer."})
                    return
                if not msg.get("accept"):
                    state_manager.clear_state(
                        timer_session, state_manager.TIMER_OFFER_KEY)
                    connection.send_result(msg["id"], {"timer": "declined"})
                    return
                text = await cooking_agent.async_schedule_offered_timer(
                    hass, timer_session, timer_user)
                connection.send_result(
                    msg["id"], {"timer": "set", "message": text})
                return

            if action == "delete":
                # [MODIFIED v2026.9.20] The recipe's photo goes with it.
                # Deleting the recipe is the clearest case of all: nothing
                # will ever refer to that picture again.
                rec_id = msg.get("recipe_id")
                doomed = await recipes_db.async_get_by_id(hass, rec_id)
                doomed_photo = (doomed or {}).get("image_path")
                await recipes_db.async_delete(hass, rec_id)
                if doomed_photo and not await recipes_db.async_photo_in_use(
                        hass, doomed_photo, exclude_id=rec_id):
                    await async_delete_recipe_photo(hass, doomed_photo)
                hass.bus.async_fire("home_organizer_db_update")
                connection.send_result(msg["id"], {"deleted": True})
                return

        except Exception as err:
            _LOGGER.error("recipes '%s' failed: %s", action, err)
            connection.send_result(msg["id"], {"error": str(err)})

    try:
        websocket_api.async_register_command(hass, websocket_recipes)
    except Exception:
        pass

    # [ADDED v2026.9.12] Receipts table.
    #
    # A read-only query, so it is a websocket command rather than a service:
    # services are for actions that change state and show up in the HA service
    # list, which a table refresh has no business appearing in.
    @websocket_api.websocket_command({
        vol.Required("type"): WS_LIST_RECEIPTS,
        vol.Optional("vendor"): vol.Any(str, None),
        vol.Optional("date_from"): vol.Any(str, None),
        vol.Optional("date_to"): vol.Any(str, None),
        vol.Optional("receipt_id"): vol.Any(int, None),
    })
    @websocket_api.async_response
    async def websocket_list_receipts(hass, connection, msg):
        try:
            # A receipt_id asks for one document with its pages, which is what
            # the viewer needs; without it the filtered list is returned.
            if msg.get("receipt_id"):
                # [MODIFIED v2026.9.21] Pages and items come back together.
                #
                # Both are wanted at the same moment - the table opens under
                # the header and the viewer opens from the same row - so one
                # round trip is fewer moving parts than two.
                pages = await async_get_receipt_pages(hass, msg["receipt_id"])
                items = await async_get_receipt_items(hass, msg["receipt_id"])
                connection.send_result(msg["id"], {"pages": pages, "items": items})
                return
            data = await async_list_receipts(
                hass,
                vendor=msg.get("vendor"),
                date_from=msg.get("date_from"),
                date_to=msg.get("date_to"),
            )
            connection.send_result(msg["id"], data)
        except Exception as err:
            _LOGGER.error("list_receipts failed: %s", err)
            connection.send_result(msg["id"], {"receipts": [], "vendors": [], "totals": {}})

    try:
        websocket_api.async_register_command(hass, websocket_list_receipts)
    except Exception:
        pass

    try:
        websocket_api.async_register_command(
            hass,
            WS_AI_CHAT,
            websocket_ai_chat,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_AI_CHAT,
                vol.Optional("message", default=""): str,
                # [MODIFIED v2026.9.8] A list is accepted so a long receipt
                # photographed in several parts arrives as one request.
                # A bare string is still valid, so nothing that already
                # sends a single image needs to change.
                vol.Optional("image_data"): vol.Any(str, [str], None),
                vol.Optional("mime_type", default="image/jpeg"): str,
                vol.Optional("language", default="en"): str,
                # [ADDED v2026.9.17] "speak this reply on my phone".
                #
                # Set by the panel only when its own speech engine is
                # missing, which on Android is always - the WebView has no
                # window.speechSynthesis. The panel speaks locally when it
                # can, so this never doubles up.
                vol.Optional("speak", default=False): bool,
                # [ADDED v2026.9.17] Which saved recipe this chat is about.
                # Declared here at the same time as the handler and the
                # caller: an undeclared key is rejected before the handler
                # runs, which is how the same defect shipped once before.
                vol.Optional("recipe_id"): vol.Any(str, None),
            })
        )
    except Exception: pass
    
    try:
        websocket_api.async_register_command(
            hass,
            WS_LOOKUP_BARCODE,
            websocket_lookup_barcode,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_LOOKUP_BARCODE,
                vol.Required("barcode"): cv.string, 
                vol.Optional("language", default="en"): str 
            })
        )
    except Exception: pass 
    
    try:
        websocket_api.async_register_command(
            hass,
            WS_SAVE_AVATAR,
            websocket_save_avatar,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_SAVE_AVATAR,
                vol.Required("image_data"): str
            })
        )
    except Exception: pass

    # [ADDED v2026.9.20] Redraw one item's icon. Two keys and nothing else:
    # which item, and what the user says it is. Declared here, handled in
    # websocket_draw_item_icon and sent by organizer-icons.js - a websocket
    # schema rejects any key it was not told about, so all three sides are
    # written together (RULE 33a.2).
    try:
        websocket_api.async_register_command(
            hass,
            WS_DRAW_ICON,
            websocket_draw_item_icon,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_DRAW_ICON,
                vol.Required("item_id"): vol.Any(int, cv.string),
                vol.Optional("description"): vol.Any(str, None),
            })
        )
    except Exception: pass

    await register_services(hass, entry)
    entry.async_on_unload(entry.add_update_listener(update_listener))

    await hass.config_entries.async_forward_entry_setups(entry, ["conversation"])

    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry):
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    try:
        if entry.entry_id in hass.data.get(DOMAIN, {}):
            hass.data[DOMAIN].pop(entry.entry_id)
        # [MODIFIED v2026.8.26] hass.components.<x> is a deprecated accessor
        # that logs a warning on modern cores and is slated for removal.
        # Import the component module directly instead.
        frontend.async_remove_panel("organizer")
    except Exception: pass
    
    await hass.config_entries.async_unload_platforms(entry, ["conversation"])
    return True

async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    if entry.options.get(CONF_DELETE_ON_REMOVE, False):
        _LOGGER.info("Home Organizer: Deleting all data as requested.")
        try:
            storage_method = entry.data.get(CONF_STORAGE_METHOD, STORAGE_METHOD_WWW)
            db_path = hass.config.path(DB_FILE)
            img_path = hass.config.path("www", IMG_DIR)
            
            if storage_method == STORAGE_METHOD_MEDIA:
                # [MODIFIED v2026.8.26] Executor-wrapped, as above.
                if await hass.async_add_executor_job(os.path.exists, "/media"):
                    db_path = os.path.join("/media", DB_FILE)
                    img_path = os.path.join("/media", IMG_DIR)

            # [MODIFIED v10.0.0] os.remove / shutil.rmtree are blocking disk
            # operations and were running directly on the event loop inside
            # this async function. Both the existence checks and the deletes
            # are now performed in the executor.
            def _remove_data():
                if os.path.exists(db_path):
                    os.remove(db_path)
                if os.path.exists(img_path):
                    shutil.rmtree(img_path)

            await hass.async_add_executor_job(_remove_data)
        except Exception as e:
            _LOGGER.error(f"Error deleting Home Organizer data: {e}")