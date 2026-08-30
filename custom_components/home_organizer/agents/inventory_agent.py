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
# // [MODIFIED v9.1.12 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O. Replaced get_db_connection with get_db_path and removed async_add_executor_job wrappers to prevent Event Loop blocking.
# // [ADDED v9.1.11 | 2026-04-14] Purpose: Fixed sub-location logic where AI created new sub-locations instead of using existing ones. Rewrote Rule 3 to explicitly enforce 'USER LOCATION MATCHING', requiring the AI to match user input to an existing location_id first, and forbidding the use of the sub_location parameter unless explicit permission for a NEW location was granted.

import logging
import aiosqlite
from datetime import datetime

from ..database import get_db_path, async_add_item_db_safe
from ..ai_core.router import safe_smart_router
from ..ai_core.json_utils import safe_parse_json, apply_voice_rules
from ..ai_core.localized_strings import get_strings_for_language
from ..prompt_core import ICON_PROMPT_CONTEXT

_LOGGER = logging.getLogger(__name__)


# ==========================================
# PROMPTS
# ==========================================
def get_agent_prompt(target_lang, existing_locs_str, history_text):
    return f"""You are the Home Organizer AI Agent.

Your goal is to extract information from the user and format it perfectly into JSON commands.
You manage the physical inventory of a house.

EXISTING PHYSICAL LOCATIONS IN THE HOUSE:
(You MUST use these precise names and logical structure if the user wants to place something)
{existing_locs_str}

ICON LIBRARY AND CATEGORIES:
(Choose the most logical category, sub_category, and icon_key from this list)
{ICON_PROMPT_CONTEXT}

CRITICAL RULES:
1. SMART SUB-LOCATION CLARIFICATION: If the user asks to add an item to a broad/general location (e.g., "Fridge") AND you see a perfectly matching sub-location under it in the EXISTING LOCATIONS list, guess the most logical sub-location (e.g., "Vegetable Drawer" for carrots) and return JSON: {{"intent": "clarify", "question": "Should I place it in the <Suggested Sub-Location>? (Translate this naturally to {target_lang})"}}.
2. MISSING SUB-LOCATION PROPOSAL: If the user wants to add an item to an existing location (e.g., "TV Cabinet", "Fridge") but does NOT specify a sub-location, AND you cannot find a suitable existing sub-location for it, YOU MUST NOT use the "add_item_to_ho" tool yet! Instead, you MUST explicitly ask the user if they want to create a new sub-location. Return JSON: {{"intent": "clarify", "question": "I don't see a specific place for this in the <Location>. Would you like me to open a new sub-location, like '<Suggested Name>'? (Translate naturally to {target_lang})"}}.
3. USER LOCATION MATCHING & CONTINUATION: If the user answers a clarify question by naming a location (e.g., "in the fridge vegetable drawer"), you MUST thoroughly search the EXISTING LOCATIONS list for the best match. If the full path exists (e.g., "Fridge > Vegetable Drawer"), you MUST use its EXACT `location_id` and leave `sub_location` empty. NEVER use `sub_location` to pass an existing drawer/shelf! ONLY fill the `sub_location` argument if the user explicitly confirmed they want to create a completely NEW, non-existent sub-location. If they name a new location but haven't been asked yet, fall back to Rule 2 and ask for permission first.
4. SILENT CATEGORIZATION & ICONS: When using the "add_item_to_ho" tool, you MUST independently choose the best matching `category`, `sub_category`, and `icon_key` from the ICON LIBRARY. If no perfect match exists, pick the closest broader category (e.g., "Electronics" for a remote). Do not leave them empty. YOU MUST NEVER ASK THE USER to provide a category, sub_category, or icon. Make the decision yourself silently behind the scenes.
5. LANGUAGE RULE: Your entire spoken response (the "message" or "question" field) MUST be fully translated into {target_lang}.
6. SYSTEM TOOL RESPONSES: If the CHAT HISTORY ends with a 'System Tool Output' (meaning a tool just succeeded), you MUST use intent "reply" to politely confirm to the user that the action was completed.
7. JSON FORMATTING SAFETY: Do NOT use double quotes (") inside your JSON string values (e.g., inside the question or message text). Use single quotes (') for any inner quotes to ensure valid JSON parsing.

AVAILABLE TOOLS (Use "intent": "tool", then specify "tool_name"):

1. "check_sub_locations" - If the user asks to add something to a general area (like "Kitchen" or "Garage"), DO NOT ADD IT YET. First, use this tool to ask the database what sub-locations exist in that room.
   - kwargs: {{"main_location": "Kitchen"}}

2. "add_item_to_ho" - Adds an item to the home inventory.
   - You MUST supply the EXACT `location_id` from the existing locations list if it exists.
   - If the user wants to place the item in a NEW sub-location (e.g., a new shelf or drawer that doesn't exist yet), provide it in the `sub_location` argument.
   - kwargs: {{"item_name": "Milk", "qty": 2, "location_id": "A1.2", "sub_location": "", "category": "Food", "sub_category": "Dairy", "icon_key": "ICON_LIB_ITEM|Food|Dairy|Milk"}}

3. "create_sub_location" - Creates a NEW, empty sub-location (folder, drawer, shelf) inside an existing location, without adding an item to it.
   - kwargs: {{"location_id": "A1", "new_sub_location": "Vegetable Drawer"}}

4. "update_last_item" - If the user corrects you on the PREVIOUS turn (e.g. "Actually I meant 3 milks" or "Move it to the fridge").
   - kwargs: {{"old_name": "Milk", "new_name": "Milk", "new_sub_location": "Fridge"}}

5. "search_inventory" - If the user asks "Do we have X?" or "What's in the pantry?".
   - kwargs: {{"category": "Food"}}

6. "remove_item" - If the user says "I finished the milk" or "Delete the apples".
   - kwargs: {{"item_name": "Milk"}}

=== CHAT HISTORY ===
{history_text}
====================

Read the LAST message from the user.
Decide if you need to use a tool, or just reply.
If you need more information (like exact location or category), use "intent": "clarify".

OUTPUT FORMAT: YOU MUST RETURN ONLY VALID JSON.
Example 1 (Create empty sub-location):
{{"intent": "tool", "tool_name": "create_sub_location", "kwargs": {{"location_id": "A1", "new_sub_location": "Vegetable Drawer"}}}}

Example 2 (Missing Sub-Location Clarification - MUST DO THIS IF NO LOGICAL SUB-LOCATION EXISTS):
{{"intent": "clarify", "question": "I don't see a specific place for the remote in the TV Cabinet. Should I open a new sub-location called 'Top Drawer'?"}}

Example 3 (Continuing after Clarification - User explicitly confirmed a completely NEW location!):
{{"intent": "tool", "tool_name": "add_item_to_ho", "kwargs": {{"item_name": "Remote", "qty": 1, "location_id": "A1", "sub_location": "Top Drawer", "category": "Electronics", "sub_category": "Computing", "icon_key": "ICON_LIB_ITEM|Electronics|Computing|Laptop"}}}}

Example 4 (Continuing after Clarification - User named an EXISTING location, so use its exact location_id and leave sub_location empty!):
{{"intent": "tool", "tool_name": "add_item_to_ho", "kwargs": {{"item_name": "Cucumbers", "qty": 4, "location_id": "A1.2.3", "sub_location": "", "category": "Food", "sub_category": "Vegetables", "icon_key": "ICON_LIB_ITEM|Food|Vegetables|Cucumbers"}}}}

Example 5 (Reply after a tool succeeds):
{{"intent": "reply", "message": "I have successfully added the items. Anything else?"}}

JSON ONLY:"""


def get_search_prompt(inventory_context, user_message, target_lang):
    return f"""You are a smart home inventory assistant.

=== RAW INVENTORY DATA ===
{inventory_context}
==========================

=== USER REQUEST ===
{user_message}
====================

CRITICAL OUTPUT INSTRUCTIONS:
1. LANGUAGE RULE: Your ENTIRE response and item names MUST be strictly in {target_lang}.
2. NORMALIZATION: If the user request contains typos, fix them to correct spelling in your response.
3. NEVER mix languages. Base your recommendations ONLY on the raw inventory data provided."""


def get_barcode_prompt(barcode_str, external_hint, target_lang):
    return f"""You are the Home Organizer AI. The user has scanned a barcode: {barcode_str}.

{external_hint}

Your job is to cleanly format this product so it looks perfect in a Home Assistant dashboard.
Format the "name" to be clean, capitalized, and easy to read (Translate the name to {target_lang}!).
Assign it a logical "category" (e.g., Food, Cleaning, Electronics).
Assign it a logical "sub_category" (e.g., Dairy, Spices, Cables).
Suggest a relevant Material Design icon key (e.g., "mdi:food-apple", "mdi:bottle-wine").

You MUST return ONLY a JSON object in this format:
{{
  "name": "Cleaned Product Name in {target_lang}",
  "category": "Main Category",
  "sub_category": "Sub Category",
  "icon_key": "mdi:icon-name"
}}

JSON ONLY:"""


def get_invoice_prompt(target_lang, existing_locs_str, existing_cats_str, user_message):
    prompt = (
        f"Analyze this document/receipt. Context:\n"
        f"EXISTING LOCATIONS:\n{existing_locs_str}\n\n"
        f"EXISTING CATEGORIES: [{existing_cats_str}]\n\n"
        "RULES:\n"
        f"1. LANGUAGE RULE: The 'name' value inside the JSON items and the 'message' MUST be written strictly in {target_lang}. NEVER translate item names to English unless {target_lang} is English. Do NOT use the document's original language if it differs from {target_lang}.\n"
        "2. MAPPING & SUBLOCATIONS: Assign the item to a logical physical location by selecting the appropriate ID from the EXISTING LOCATIONS list above. Do NOT use category names like 'Food' or 'Dairy' as locations.\n"
        "3. ICON SELECTION & CATEGORIES: Assign the closest standard icon_key from the following list. \n"
        f"{ICON_PROMPT_CONTEXT}\n"
        "4. OUTPUT JSON ONLY:\n"
        "   - If items are clear: {{\"intent\": \"add_invoice\", \"message\": \"<Short success sentence>\", \"items\": [{\"name\": \"...\", \"qty\": 1, \"barcode\": \"12345\", \"location_id\": \"A1.1\", \"category\": \"Food\", \"sub_category\": \"Dairy\", \"icon_key\": \"ICON_LIB_ITEM|Food|Dairy|Milk\"}]}}\n"
        "   - If ambiguous/unknown: {{\"intent\": \"clarify\", \"question\": \"<Question>\"}}\n"
        "   - If a barcode or item number is visible next to the item on the receipt, include it in the 'barcode' field (as a string). Otherwise, use '0' for the barcode.\n"
    )

    if user_message and user_message.strip() != "" and user_message != "Scanned Invoice":
        prompt += (
            f"\n\nSPECIAL USER INSTRUCTION:\n"
            f"The user added this specific request: '{user_message}'. \n"
            f"Please strictly apply this instruction (e.g. if they specified a location, "
            f"force that location for the items).\n"
        )

    prompt += "\nDo NOT use markdown."
    return prompt


# ==========================================
# TOOLS (inventory-only)
# ==========================================
async def execute_tool(hass, tool_name, kwargs, loc_hierarchy_map):
    _LOGGER.info(f"Inventory tool: {tool_name} args={kwargs}")

    if tool_name == "check_sub_locations":
        loc_id = kwargs.get("location_id", "")
        base_path = loc_hierarchy_map.get(loc_id, [])

        if len(base_path) < 2:
            main_loc = kwargs.get("main_location", loc_id)

            async def db_get_subs_fallback():
                try:
                    db_path = get_db_path(hass)
                    async with aiosqlite.connect(db_path, timeout=10.0) as db:
                        async with db.execute(
                            "SELECT DISTINCT level_3 FROM items "
                            "WHERE level_2 LIKE ? AND level_3 IS NOT NULL AND level_3 != ''",
                            (f"%{main_loc}%",),
                        ) as cursor:
                            return [r[0] for r in await cursor.fetchall()]
                except Exception:
                    return []

            subs = await db_get_subs_fallback()
            target_name = main_loc
        else:
            l1, l2 = base_path[0], base_path[1]
            target_name = l2

            async def db_get_subs():
                try:
                    db_path = get_db_path(hass)
                    async with aiosqlite.connect(db_path, timeout=10.0) as db:
                        async with db.execute(
                            "SELECT DISTINCT level_3 FROM items "
                            "WHERE level_1=? AND level_2=? AND level_3 IS NOT NULL AND level_3 != ''",
                            (l1, l2),
                        ) as cursor:
                            return [r[0] for r in await cursor.fetchall()]
                except Exception:
                    return []

            subs = await db_get_subs()

        import re as _re
        cleaned_subs = []
        for s in subs:
            clean_s = _re.sub(r"\[?ORDER_MARKER_\d+\]?[_\s]*", "", str(s)).strip()
            clean_s = clean_s.replace("[Folder]", "").strip()
            if clean_s and clean_s not in cleaned_subs:
                cleaned_subs.append(clean_s)

        if not cleaned_subs:
            return f"No sub-locations found in '{target_name}'."

        subs_str = ", ".join(cleaned_subs)
        return f"Found sub-locations: {subs_str}."

    elif tool_name == "add_item_to_ho":
        nm = kwargs.get("item_name")
        qt = kwargs.get("qty", 1)
        loc_id = kwargs.get("location_id", "")
        sl = kwargs.get("sub_location", "")
        cat = kwargs.get("category", "General")
        scat = kwargs.get("sub_category", "")
        icon = kwargs.get("icon_key", None)

        base_path = loc_hierarchy_map.get(loc_id)
        if not base_path:
            fallback_loc = kwargs.get("main_location", loc_id)
            for _k, v in loc_hierarchy_map.items():
                v_str = " ".join(v).replace("ORDER_MARKER", "")
                if fallback_loc.lower() in v_str.lower() or fallback_loc in v:
                    base_path = v
                    break
            if not base_path:
                base_path = [fallback_loc] if fallback_loc else ["General"]

        if sl and len(base_path) > 2:
            base_path = base_path[:2]
        full_path = list(base_path)
        if sl:
            full_path.append(sl)

        await async_add_item_db_safe(
            hass, nm, qt, full_path, cat, scat, "item", icon, "0"
        )
        hass.bus.async_fire("home_organizer_db_update")
        loc_str = " > ".join(full_path)
        return f"Success! Added {qt} {nm} to {loc_str}."

    elif tool_name == "create_sub_location":
        loc_id = kwargs.get("location_id", "")
        new_sub = kwargs.get("new_sub_location", "")
        
        if not new_sub:
            return "Error: No new_sub_location provided."

        base_path = loc_hierarchy_map.get(loc_id)
        if not base_path:
            fallback_loc = kwargs.get("main_location", loc_id)
            for _k, v in loc_hierarchy_map.items():
                v_str = " ".join(v).replace("ORDER_MARKER", "")
                if fallback_loc.lower() in v_str.lower() or fallback_loc in v:
                    base_path = v
                    break
            if not base_path:
                base_path = [fallback_loc] if fallback_loc else ["General"]

        if len(base_path) > 2:
            base_path = base_path[:2]
            
        full_path = list(base_path)
        full_path.append(new_sub)

        folder_name = f"[Folder] {new_sub}"
        
        await async_add_item_db_safe(
            hass, folder_name, 0, full_path, "Folder", "", "folder_marker", None, "0"
        )
        hass.bus.async_fire("home_organizer_db_update")
        loc_str = " > ".join(base_path)
        return f"Success! Created new empty sub-location '{new_sub}' in {loc_str}."

    elif tool_name == "update_last_item":
        old_n = kwargs.get("old_name")
        new_n = kwargs.get("new_name", old_n)
        new_sl = kwargs.get("new_sub_location")

        async def db_update():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    if new_sl:
                        await db.execute(
                            "UPDATE items SET name=?, level_3=? WHERE name=? AND type='item'",
                            (new_n, new_sl, old_n),
                        )
                    else:
                        await db.execute(
                            "UPDATE items SET name=? WHERE name=? AND type='item'",
                            (new_n, old_n),
                        )
                    await db.commit()
                    return "Updated successfully."
            except Exception as e:
                return f"Error: {e}"

        res = await db_update()
        hass.bus.async_fire("home_organizer_db_update")
        return res

    elif tool_name == "remove_item":
        nm = kwargs.get("item_name", "")

        async def db_remove():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    async with db.execute(
                        "SELECT id, name, level_2, level_3 FROM items "
                        "WHERE name LIKE ? ORDER BY id DESC LIMIT 1",
                        (f"%{nm}%",),
                    ) as cursor:
                        row = await cursor.fetchone()
                        if row:
                            await db.execute("DELETE FROM items WHERE id = ?", (row[0],))
                            await db.commit()
                            loc_str = f"{row[2]} > {row[3]}" if row[3] else str(row[2])
                            return f"Deleted '{row[1]}' from {loc_str}."
                        return f"Item '{nm}' not found."
            except Exception as e:
                return f"Error: {e}"

        res = await db_remove()
        hass.bus.async_fire("home_organizer_db_update")
        return f"Result: {res}."

    elif tool_name == "search_inventory":
        cat_filter = kwargs.get("category", "")

        async def db_search():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    if cat_filter and cat_filter.lower() != "all":
                        async with db.execute(
                            "SELECT name, quantity, level_1, level_2, level_3 "
                            "FROM items WHERE type='item' AND quantity > 0 "
                            "AND (category LIKE ? OR name LIKE ?)",
                            (f"%{cat_filter}%", f"%{cat_filter}%"),
                        ) as cursor:
                            return await cursor.fetchall()
                    else:
                        async with db.execute(
                            "SELECT name, quantity, level_1, level_2, level_3 "
                            "FROM items WHERE type='item' AND quantity > 0"
                        ) as cursor:
                            return await cursor.fetchall()
            except Exception as e:
                _LOGGER.error(f"Search tool error: {e}")
                return []

        items = await db_search()
        if not items:
            return f"No items found in inventory for category '{cat_filter}'."
        res_lines = [
            f"- {r[0]} (x{r[1]}) at {' > '.join([l for l in r[2:] if l])}"
            for r in items
        ]
        inv_str = "\n".join(res_lines[:60])
        return f"Found {len(items)} items in stock:\n{inv_str}"

    elif tool_name == "update_item_qty":
        nm = kwargs.get("item_name", "")
        qty = int(kwargs.get("new_qty", 0))

        async def db_update_qty():
            try:
                db_path = get_db_path(hass)
                today = datetime.now().strftime("%Y-%m-%d")
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    cursor = await db.execute(
                        "UPDATE items SET quantity = ?, item_date = ? "
                        "WHERE name = ? AND type='item'",
                        (qty, today, nm),
                    )
                    if cursor.rowcount > 0:
                        await db.commit()
                        return f"Updated '{nm}' quantity to {qty}."

                    cursor = await db.execute(
                        "UPDATE items SET quantity = ?, item_date = ? "
                        "WHERE name LIKE ? AND type='item'",
                        (qty, today, f"%{nm}%"),
                    )
                    if cursor.rowcount > 0:
                        await db.commit()
                        return f"Updated '{nm}' quantity to {qty}."

                    return f"Item '{nm}' not found in database."
            except Exception as e:
                return f"Error updating qty: {e}"

        res = await db_update_qty()
        hass.bus.async_fire("home_organizer_db_update")
        return res

    return f"Error: Unknown inventory tool '{tool_name}'."


# ==========================================
# RUN LOOP
# ==========================================
async def run(hass, entry, messages, target_lang, existing_locs_str,
              loc_hierarchy_map, history_text, last_user_msg, recipe_name,
              is_voice, device_id, user_id, lang_code="en"):
    strings = await get_strings_for_language(hass, entry, lang_code)
    prompt = get_agent_prompt(target_lang, existing_locs_str, history_text)

    for _ in range(10):
        raw_res, err = await safe_smart_router(
            hass, entry, apply_voice_rules(prompt, is_voice, target_lang)
        )

        if err or not raw_res:
            _LOGGER.error(f"Inventory Agent loop error: {err}")
            return f"❌ {strings['ai_connection_error']} ({err})"

        parsed = safe_parse_json(raw_res)
        if not parsed:
            return strings["invalid_format"]

        intent = parsed.get("intent")

        if intent == "tool":
            tool_name = parsed.get("tool_name")
            kwargs = parsed.get("kwargs", {})
            tool_result = await execute_tool(hass, tool_name, kwargs, loc_hierarchy_map)
            messages.append({"role": "system", "content": f"System Tool Output: {tool_result}"})

            history_text_new = ""
            for m in messages:
                history_text_new += f"{m['role'].upper()}: {m['content']}\n"
            prompt = get_agent_prompt(target_lang, existing_locs_str, history_text_new)

        elif intent == "reply":
            reply_msg = parsed.get("message", "")
            messages.append({"role": "assistant", "content": reply_msg})
            return reply_msg

        elif intent == "clarify":
            reply_msg = parsed.get("question") or strings["clarify_no_location"]
            messages.append({"role": "assistant", "content": reply_msg})
            return reply_msg

        else:
            return strings["fallback_unsure"]

    return strings["fallback_stuck"]