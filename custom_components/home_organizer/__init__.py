# -*- coding: utf-8 -*-
# Home Organizer Ultimate
# [MODIFIED v10.0.0 | 2026-08-23] Purpose: SECURITY HARDENING (HACS review).
#   1. websocket_ai_chat now forwards the authenticated user's id to the
#      agent loop. Without it the smart home agent has no identity to run
#      a permission check against, which is the exact path frenck flagged.
#   2. The chat session is now keyed per user instead of a single shared
#      "web_session", so one user's conversation history can no longer be
#      read by, or injected into, another user's turn.
#   3. async_remove_entry no longer calls os.remove / shutil.rmtree on the
#      event loop.
# [MODIFIED v8.58.0 | 2026-08-02] Purpose: Removed local APK sync logic (migrated to GitHub Releases) and updated app references to HO_Mind_AI. Converted to full async/await using aiosqlite.

import logging
import os
from functools import partial
import time
import json
import re
import asyncio
import shutil
import aiosqlite
import voluptuous as vol

from aiohttp import web, ClientTimeout
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback, SupportsResponse
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig, HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers import entity_registry as er
import homeassistant.helpers.config_validation as cv

from .const import (
    DOMAIN, CONF_API_KEY, CONF_DEBUG, CONF_USE_AI, DB_FILE, IMG_DIR, VERSION, 
    CONF_STORAGE_METHOD, CONF_DELETE_ON_REMOVE, STORAGE_METHOD_WWW, STORAGE_METHOD_MEDIA,
    CONF_AI_PROVIDER, CONF_PROCESSING_MODE, MODE_LOCAL_ONLY, MODE_CLOUD_ONLY, MODE_HYBRID, PROVIDER_OPENAI, PROVIDER_GEMINI
)
from .database import (
    async_init_db, get_db_path, async_get_or_create_catalog_ids, to_alpha_id, async_get_view_data, async_add_item_db_safe
)
from .services import register_services
from .ai_logic import async_universal_agent_loop, async_smart_router
from .reminders_scheduler import async_register_startup_restore
from . import recipes_db
from .prompt_core import get_intent_resolve_prompt, ICON_PROMPT_CONTEXT
from .prompt_inventory import get_barcode_prompt, get_invoice_prompt

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

WS_GET_DATA = "home_organizer/get_data"
WS_GET_ALL_ITEMS = "home_organizer/get_all_items" 
WS_AI_CHAT = "home_organizer/ai_chat" 
WS_LOOKUP_BARCODE = "home_organizer/lookup_barcode"
WS_SAVE_AVATAR = "home_organizer/save_avatar"

STATIC_PATH_URL = "/home_organizer_static"
ACTIVE_SESSIONS = {}

class FallbackMockEntry:
    def __init__(self, original):
        self.entry_id = getattr(original, "entry_id", "fallback_entry")
        self.data = dict(original.data)
        self.options = dict(original.options)
        self.options[CONF_PROCESSING_MODE] = MODE_LOCAL_ONLY
        self.data[CONF_PROCESSING_MODE] = MODE_LOCAL_ONLY

async def safe_smart_router(hass, entry, mode, *args, **kwargs):
    try:
        res, err = await async_smart_router(hass, entry, *args, **kwargs)
        if err and mode == MODE_HYBRID and any(kw in err.lower() for kw in ["connection", "timeout", "router", "failed"]):
            _LOGGER.warning("Cloud router failed in Hybrid mode, forcing Local AI fallback.")
            return await async_smart_router(hass, FallbackMockEntry(entry), *args, **kwargs)
        return res, err
    except Exception as e:
        err_str = str(e)
        if mode == MODE_HYBRID and any(kw in err_str.lower() for kw in ["connection", "timeout", "router", "failed"]):
            _LOGGER.warning(f"Cloud router exception: {err_str}. Forcing Local fallback.")
            try:
                return await async_smart_router(hass, FallbackMockEntry(entry), *args, **kwargs)
            except Exception as fe: return None, str(fe)
        return None, err_str

async def safe_universal_agent_loop(hass, entry, mode, *args, **kwargs):
    try:
        reply = await async_universal_agent_loop(hass, entry, *args, **kwargs)
        if reply and mode == MODE_HYBRID and "error" in reply.lower() and any(kw in reply.lower() for kw in ["connection", "timeout", "router", "failed"]):
            return await async_universal_agent_loop(hass, FallbackMockEntry(entry), *args, **kwargs)
        return reply
    except Exception as e:
        if mode == MODE_HYBRID:
            try:
                return await async_universal_agent_loop(hass, FallbackMockEntry(entry), *args, **kwargs)
            except Exception as fe: return f"Error: {fe}"
        return f"Error: {e}"

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
                    r_dict = dict(zip(col_names, r))
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
            res_text, err = await safe_smart_router(hass, entry, mode, prompt)
            
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
            nonlocal existing_locs_str, existing_cats_str, loc_hierarchy_map
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
                    
                    async with db.execute("SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != ''") as cc:
                        cats = [r[0] for r in await cc.fetchall()]
                        existing_cats_str = ", ".join(sorted(cats))
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
                
                res_text, err = await safe_smart_router(hass, entry, mode, vision_prompt, image_data, mime_val)
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

                res_text, err = await safe_smart_router(hass, entry, mode, invoice_prompt, image_data, mime_val)
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
                                nm = hist_data.get("name", item.get("name", "Unknown"))
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
                                    for k, v in loc_hierarchy_map.items():
                                        v_str = " ".join(v).replace("ORDER_MARKER", "")
                                        if loc_id and loc_id.lower() in v_str.lower():
                                            raw_path = v
                                            break
                                if not raw_path: raw_path = ["General"]
                            
                            await async_add_item_db_safe(
                                hass, nm, int(item.get("qty", 1)), raw_path, cat, scat, "pending", icon, bcode
                            )
                            added_count += 1
                            
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
                            "debug": {"raw_json": clean_txt, "intent": "add_invoice"}
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
            
            raw_analysis, err = await safe_smart_router(hass, entry, mode, step1_prompt)
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
                            for k, v in loc_hierarchy_map.items():
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

        ACTIVE_SESSIONS[session_key].append({"role": "user", "content": user_message})

        final_reply = await safe_universal_agent_loop(
            hass, entry, mode, ACTIVE_SESSIONS[session_key], target_lang,
            existing_locs_str, loc_hierarchy_map, user_id=ws_user_id
        )

        if len(ACTIVE_SESSIONS[session_key]) > 10:
            ACTIVE_SESSIONS[session_key] = ACTIVE_SESSIONS[session_key][-10:]

        connection.send_result(msg["id"], {"response": final_reply})
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
        if os.path.exists(media_root):
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
        
        conv_id = call.data.get("conversation_id")
        if not conv_id: conv_id = "default_session"
        
        if not user_message: return {"response": "Error: No text provided."}

        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries: return {"response": "Error: Integration not loaded."}
        entry = entries[0]
        
        mode = entry.options.get(CONF_PROCESSING_MODE, entry.data.get(CONF_PROCESSING_MODE, MODE_HYBRID))

        existing_locs_str = ""
        loc_hierarchy_map = {}
        
        async def async_fetch_context():
            nonlocal existing_locs_str, loc_hierarchy_map
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

        if conv_id not in ACTIVE_SESSIONS:
            ACTIVE_SESSIONS[conv_id] = []
            
        ACTIVE_SESSIONS[conv_id].append({"role": "user", "content": user_message})
        
        final_reply = await safe_universal_agent_loop(
            hass, entry, mode, ACTIVE_SESSIONS[conv_id], target_lang, existing_locs_str, loc_hierarchy_map, is_voice=True
        )
        ACTIVE_SESSIONS[conv_id].append({"role": "assistant", "content": final_reply})

        return {"response": final_reply}

    hass.services.async_register(
        DOMAIN, 
        "voice_command", 
        handle_voice_command,
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
    
    try:
        websocket_api.async_register_command(
            hass,
            WS_AI_CHAT,
            websocket_ai_chat,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_AI_CHAT,
                vol.Optional("message", default=""): str,
                vol.Optional("image_data"): vol.Any(str, None),
                vol.Optional("mime_type", default="image/jpeg"): str,
                vol.Optional("language", default="en"): str 
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
        hass.components.frontend.async_remove_panel("organizer")
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
                if os.path.exists("/media"):
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