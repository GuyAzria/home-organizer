# -*- coding: utf-8 -*-
# Home Organizer Ultimate - ver 7.4.0 (Additive File Upload Support)

import logging
import sqlite3
import os
import base64
import time
import json
import re
import asyncio
import voluptuous as vol
from aiohttp import ClientTimeout
from datetime import datetime, timedelta
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig 
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from .const import DOMAIN, CONF_API_KEY, CONF_DEBUG, CONF_USE_AI, DB_FILE, IMG_DIR, VERSION

_LOGGER = logging.getLogger(__name__)

WS_GET_DATA = "home_organizer/get_data"
WS_GET_ALL_ITEMS = "home_organizer/get_all_items" 
WS_AI_CHAT = "home_organizer/ai_chat" 

STATIC_PATH_URL = "/home_organizer_static"

GEMINI_MODEL = "gemini-3-flash-preview"

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

    try:
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="home-organizer-panel",
            frontend_url_path="organizer",
            module_url=f"{STATIC_PATH_URL}/organizer-panel.js?v={int(time.time())}",
            sidebar_title="Organizr",
            sidebar_icon="mdi:package-variant-closed",
            require_admin=False
        )
    except Exception as e:
        _LOGGER.warning(f"Panel registration warning: {e}")

    await hass.async_add_executor_job(init_db, hass)

    hass.data.setdefault(DOMAIN, {})
    
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
        websocket_api.async_register_command(
            hass,
            WS_GET_ALL_ITEMS,
            websocket_get_all_items,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_GET_ALL_ITEMS
            })
        )
        # CHANGED: Updated schema to accept optional image_data for Invoice Scanning
        websocket_api.async_register_command(
            hass,
            WS_AI_CHAT,
            websocket_ai_chat,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_AI_CHAT,
                vol.Optional("message", default=""): str,
                vol.Optional("image_data"): vol.Any(str, None),
                # --- ADDITIVE: Extended schema to accept generic MIME types explicitly for PDF ---
                vol.Optional("mime_type", default="image/jpeg"): str
            })
        )
    except Exception:
        pass 

    await register_services(hass, entry)
    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry):
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    try:
        hass.components.frontend.async_remove_panel("organizer")
    except Exception:
        pass
    return True

def get_db_connection(hass):
    return sqlite3.connect(hass.config.path(DB_FILE))

def init_db(hass):
    if not os.path.exists(hass.config.path("www", IMG_DIR)): os.makedirs(hass.config.path("www", IMG_DIR))
    conn = get_db_connection(hass)
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
    
    c.execute("PRAGMA table_info(items)")
    existing_cols = [col[1] for col in c.fetchall()]
    
    needed_cols = {
        'type': "TEXT DEFAULT 'item'",
        'quantity': "INTEGER DEFAULT 1",
        'item_date': "TEXT",
        'image_path': "TEXT",
        'category': "TEXT",
        'sub_category': "TEXT",
        'unit': "TEXT",
        'unit_value': "TEXT",
        'created_at': "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }
    
    for i in range(1, 11): 
        needed_cols[f"level_{i}"] = "TEXT"

    for col, dtype in needed_cols.items():
        if col not in existing_cols:
            try: c.execute(f"ALTER TABLE items ADD COLUMN {col} {dtype}")
            except: pass

    conn.commit(); conn.close()

# --- ADDED: Centralized Zone Normalizer to fix hierarchy duplication ---
def normalize_zone_path(hass, path_list):
    if not path_list or len(path_list) < 2:
        return path_list
    try:
        path_list = list(path_list)
        z_name = path_list[0]
        r_name = path_list[1]
        if str(z_name).startswith("[") and "] " in str(z_name):
            return path_list
        conn = get_db_connection(hass)
        c = conn.cursor()
        c.execute("SELECT 1 FROM items WHERE (type='folder_marker' AND name LIKE ?) OR (level_1 LIKE ?)", (f"%_{z_name}", f"[{z_name}]%"))
        is_zone = c.fetchone()
        conn.close()
        if is_zone:
            return [f"[{z_name}] {r_name}"] + path_list[2:]
    except Exception as e:
        _LOGGER.error(f"Zone normalization error: {e}")
    return path_list
# -----------------------------------------------------------------------

# --- HELPER: ADD ITEM TO DB ---
def add_item_db_safe(hass, name, qty, path_list, category="", sub_category=""):
    """Internal helper to add items during AI Chat flow."""
    # --- APPLIED ZONE FIX ---
    path_list = normalize_zone_path(hass, path_list)
    # ------------------------
    conn = get_db_connection(hass)
    c = conn.cursor()
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        cols = ["name", "type", "quantity", "item_date", "category", "sub_category"]
        vals = [name, "item", qty, today, category, sub_category]
        qs = ["?", "?", "?", "?", "?", "?"]
        
        # Add hierarchy levels
        for i, p in enumerate(path_list):
            if i < 10: # Limit to 10 levels
                cols.append(f"level_{i+1}")
                vals.append(p)
                qs.append("?")
        
        sql = f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})"
        c.execute(sql, tuple(vals))
        conn.commit()
        return True
    except Exception as e:
        _LOGGER.error(f"DB Add Error: {e}")
        return False
    finally:
        conn.close()

@callback
def websocket_get_data(hass, connection, msg):
    path = msg.get("path", [])
    query = msg.get("search_query", "")
    date_filter = msg.get("date_filter", "All")
    is_shopping = msg.get("shopping_mode", False)
    data = get_view_data(hass, path, query, date_filter, is_shopping)
    connection.send_result(msg["id"], data)

@callback
def websocket_get_all_items(hass, connection, msg):
    conn = get_db_connection(hass)
    c = conn.cursor()
    try:
        c.execute("SELECT name, category, sub_category, unit, unit_value, image_path FROM items WHERE type='item' GROUP BY name")
        col_names = [description[0] for description in c.description]
        results = []
        for r in c.fetchall():
            item = dict(zip(col_names, r))
            if item['image_path']:
                item['image_path'] = f"/local/{IMG_DIR}/{item['image_path']}?v={int(time.time())}"
            results.append(item)
        connection.send_result(msg["id"], results)
    finally:
        conn.close()


@websocket_api.async_response
async def websocket_ai_chat(hass, connection, msg):
    """Updated AI Chat: Handles Text Actions (Add/Search) AND Invoice Scanning."""

    try:
        user_message = msg.get("message", "")
        image_data = msg.get("image_data") # Capture optional image
        
        # --- ADDITIVE: Capture optional mime_type natively to handle PDFs correctly ---
        mime_val = msg.get("mime_type", "image/jpeg") 
        # ----------------------------------------------------------------------------
        
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries:
            connection.send_result(msg["id"], {"error": "Integration not loaded"})
            return
            
        entry = entries[0]
        api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY))
        
        if not api_key:
            connection.send_result(msg["id"], {"error": "API Key missing."})
            return

        session = async_get_clientsession(hass)
        gen_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"

        # --- NEW: CONTEXT FETCHING (Fix for AI guessing locations) ---
        existing_locs_str = ""
        existing_cats_str = ""
        
        def fetch_context():
            nonlocal existing_locs_str, existing_cats_str
            try:
                c_conn = get_db_connection(hass)
                cc = c_conn.cursor()
                # Get Locations (Hierarchy)
                cc.execute("SELECT DISTINCT level_1, level_2 FROM items WHERE type='item' OR type='folder'")
                locs = set()
                for r in cc.fetchall():
                    l1, l2 = r[0], r[1]
                    if l1:
                        locs.add(l1)
                        if l2: locs.add(f"{l1} > {l2}")
                        # --- ADDITIVE FIX FOR ZONE CONTEXT ---
                        if str(l1).startswith("[") and "] " in str(l1):
                            try:
                                _z_part, _r_part = str(l1).split("] ", 1)
                                locs.add(f"{_z_part.replace('[', '')} > {_r_part}")
                            except: pass
                        # -------------------------------------
                existing_locs_str = ", ".join(sorted(list(locs)))
                
                # Get Categories
                cc.execute("SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != ''")
                cats = [r[0] for r in cc.fetchall()]
                existing_cats_str = ", ".join(sorted(cats))
                c_conn.close()
            except: pass
            
        await hass.async_add_executor_job(fetch_context)

        # =============================================
        # MODE 1: INVOICE / IMAGE PROCESSING
        # =============================================
        if image_data:
            if "," in image_data: image_data = image_data.split(",")[1]
            
            # UPDATED: Prompt to enforce Language and Location Context
            invoice_prompt = (
                f"Analyze this receipt image. Context:\n"
                f"EXISTING LOCATIONS: [{existing_locs_str}]\n"
                f"EXISTING CATEGORIES: [{existing_cats_str}]\n\n"
                "RULES:\n"
                "1. LANGUAGE: Detect the language of the item names on the receipt (e.g. Hebrew or English). "
                "   EXTRACT ITEMS STRICTLY IN THE ORIGINAL LANGUAGE. Do NOT translate.\n"
                "2. MAPPING: Map items to the EXISTING LOCATIONS provided above. "
                "   Do NOT create new root locations. If an item doesn't fit, use 'General' or ask for clarification.\n"
                "3. OUTPUT JSON ONLY:\n"
                "   - If items are clear: {{\"intent\": \"add_invoice\", \"items\": [{\"name\": \"...\", \"qty\": 1, \"path\": [\"ExistingRoom\", \"ExistingSub\"], \"category\": \"...\"}]}}\n"
                "   - If ambiguous/unknown: {{\"intent\": \"clarify\", \"question\": \"...\"}}\n"
                "\nDo NOT use markdown."
            )

            hass.bus.async_fire("home_organizer_chat_progress", {
                "step": "Scanning Invoice...",
                "debug_type": "image_scan",
                "debug_label": "Invoice Prompt (v7.2)",
                "debug_content": invoice_prompt
            })

            payload = {
                "contents": [{
                    "parts": [
                        {"text": invoice_prompt},
                        # --- ADDITIVE: Dynamic mime parsing instead of fixed image/jpeg for PDF flow ---
                        {"inline_data": {"mime_type": mime_val, "data": image_data}}
                    ]
                }]
            }

            async with session.post(gen_url, json=payload, timeout=ClientTimeout(total=45)) as resp:
                if resp.status != 200:
                    err = await resp.text()
                    connection.send_result(msg["id"], {"error": f"AI Error: {err}"})
                    return
                
                res = await resp.json()
                raw_txt = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                clean_txt = re.sub(r'```json\s*|```\s*', '', raw_txt).strip()
                
                added_count = 0
                parsed = {}
                try:
                    parsed = json.loads(clean_txt)
                    
                    # CASE A: CLARIFICATION NEEDED
                    if parsed.get("intent") == "clarify":
                        connection.send_result(msg["id"], {
                            "response": parsed.get("question", "I am not sure where to file these items. Please guide me."),
                            "debug": {"intent": "clarify", "raw_json": clean_txt}
                        })
                        return

                    # CASE B: ADD ITEMS
                    if parsed.get("intent") == "add_invoice" and "items" in parsed:
                        for item in parsed["items"]:
                            # Execute DB add in executor
                            await hass.async_add_executor_job(
                                add_item_db_safe, 
                                hass, 
                                item.get("name", "Unknown"), 
                                int(item.get("qty", 1)), 
                                item.get("path", ["General"]), 
                                item.get("category", ""), 
                                item.get("sub_category", "")
                            )
                            added_count += 1
                        
                        # Notify frontend to refresh
                        hass.bus.async_fire("home_organizer_db_update")
                        
                        response_text = f"✅ I have scanned the invoice and added **{added_count} items** to your inventory.\n\n"
                        for i in parsed["items"]:
                            path_str = " > ".join(i.get("path", []))
                            response_text += f"- **{i.get('name')}** (x{i.get('qty')}) into _{path_str}_\n"

                        connection.send_result(msg["id"], {
                            "response": response_text,
                            "debug": {"raw_json": clean_txt, "intent": "add_invoice"}
                        })
                        return

                except Exception as e:
                     connection.send_result(msg["id"], {"response": f"❌ Could not parse invoice data. Error: {str(e)}", "debug": {"raw": clean_txt}})
                     return

        # =============================================
        # MODE 2: TEXT ANALYSIS (ADD vs SEARCH)
        # =============================================
        
        # Step 1: Analyze Intent
        step1_prompt = (
            f"User says: '{user_message}'\n"
            "Determine if the user wants to ADD items or SEARCH/QUERY.\n"
            "1. IF ADDING: Return JSON: {\"intent\": \"add\", \"items\": [{\"name\": \"Item\", \"qty\": 1, \"path\": [\"Room\", \"Furniture\"], \"category\": \"Cat\"}]}\n"
            "   - Infer the location hierarchy if implied (e.g. 'fridge' -> ['Kitchen', 'Fridge']).\n"
            "2. IF SEARCHING: Return JSON: {\"intent\": \"search\", \"locations\": [\"loc1\"], \"keywords\": [\"item1\"]}\n"
            "Return JSON ONLY. No markdown."
        )

        hass.bus.async_fire("home_organizer_chat_progress", {
            "step": "Analyzing Intent...",
            "debug_type": "prompt_sent",
            "debug_label": "Intent Analysis Prompt",
            "debug_content": step1_prompt
        })

        payload_1 = {"contents": [{"parts": [{"text": step1_prompt}]}]}
        
        analysis_json = {}
        raw_analysis = ""

        async with session.post(gen_url, json=payload_1, timeout=ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                res = await resp.json()
                raw_analysis = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                clean_txt = re.sub(r'```json\s*|```\s*', '', raw_analysis).strip()
                try:
                    analysis_json = json.loads(clean_txt)
                except:
                    pass
            else:
                connection.send_result(msg["id"], {"error": "AI API Error"})
                return

        # HANDLE ADD INTENT
        if analysis_json.get("intent") == "add":
            items_to_add = analysis_json.get("items", [])
            added_log = []
            
            for item in items_to_add:
                nm = item.get("name")
                qt = item.get("qty", 1)
                pt = item.get("path", ["General"])
                cat = item.get("category", "")
                
                await hass.async_add_executor_job(add_item_db_safe, hass, nm, qt, pt, cat, "")
                added_log.append(f"{nm} (x{qt}) to {' > '.join(pt)}")
            
            hass.bus.async_fire("home_organizer_db_update")
            
            resp_text = f"✅ Added {len(added_log)} items:\n" + "\n".join([f"- {l}" for l in added_log])
            
            connection.send_result(msg["id"], {
                "response": resp_text,
                "debug": {
                    "intent": "add",
                    "json": analysis_json
                }
            })
            return

        # HANDLE SEARCH INTENT (Existing Logic)
        filter_locs = analysis_json.get("locations", [])
        filter_items = analysis_json.get("keywords", [])
        if not filter_items and "items" in analysis_json: filter_items = analysis_json["items"] # Fallback

        # ... (Proceed with existing Search SQL Logic) ...
        final_sql = ""
        final_params = []
        
        def get_inventory():
            nonlocal final_sql, final_params
            try:
                conn = get_db_connection(hass)
                conn.row_factory = sqlite3.Row 
                c = conn.cursor()
                
                sql = "SELECT * FROM items WHERE type='item' AND quantity > 0"
                params = []
                conditions = []
                
                if filter_locs:
                    sub_cond = []
                    for loc in filter_locs:
                        wild = f"%{loc}%"
                        sub_cond.append("(level_1 LIKE ? OR level_2 LIKE ? OR level_3 LIKE ?)")
                        params.extend([wild, wild, wild])
                    if sub_cond:
                        conditions.append(f"({' OR '.join(sub_cond)})")

                if filter_items:
                    sub_cond = []
                    for itm in filter_items:
                        wild = f"%{itm}%"
                        sub_cond.append("(name LIKE ? OR category LIKE ?)")
                        params.extend([wild, wild])
                    if sub_cond:
                        conditions.append(f"({' OR '.join(sub_cond)})")
                
                if conditions:
                    sql += " AND " + " AND ".join(conditions)
                
                final_sql = sql
                final_params = params
                
                c.execute(sql, tuple(params))
                rows = [dict(row) for row in c.fetchall()]
                conn.close()
                return rows
            except Exception as e:
                return [{"_error": str(e)}]

        rows = await hass.async_add_executor_job(get_inventory)
        
        # Build inventory context
        context_lines = []
        for r in rows:
            if "_error" in r: continue
            name = r.get('name', 'Unknown')
            qty = r.get('quantity', 0)
            locs = [r.get(f'level_{i}') for i in range(1, 4) if r.get(f'level_{i}')]
            loc_str = " > ".join([str(l) for l in locs])
            context_lines.append(f"- {name}: {qty} ({loc_str})")
        
        inventory_context = "\n".join(context_lines) if context_lines else "(empty - no items found)"

        # Step 3: Final Answer
        step3_prompt = (
            "You are a helpful home assistant. "
            "Reply in the SAME LANGUAGE as the user (Hebrew/English). "
            "Use the provided inventory list to answer the user's request.\n"
            "If the list is empty, apologize.\n"
            "\n"
            "Inventory List:\n" + inventory_context + "\n\n"
            "User Request: " + user_message
        )

        payload_3 = {"contents": [{"parts": [{"text": step3_prompt}]}]}

        async with session.post(gen_url, json=payload_3, timeout=ClientTimeout(total=60)) as resp:
            if resp.status == 200:
                res = await resp.json()
                text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                
                connection.send_result(msg["id"], {
                    "response": text,
                    "debug": {
                        "intent": "search",
                        "sql_query": final_sql,
                        "items_found": len(rows),
                        "inventory_context": inventory_context
                    }
                })
            else:
                err = await resp.text()
                connection.send_result(msg["id"], {"error": f"AI API Error: {err}"})

    except Exception as e:
        _LOGGER.error(f"AI Chat general error: {e}", exc_info=True)
        connection.send_result(msg["id"], {"error": f"General Error: {str(e)}"})


def get_view_data(hass, path_parts, query, date_filter, is_shopping):
    enable_ai = False
    entries = hass.config_entries.async_entries(DOMAIN)
    if entries:
        entry = entries[0]
        api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY))
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if api_key and use_ai:
            enable_ai = True

    conn = get_db_connection(hass); c = conn.cursor()
    folders = []; items = []; shopping_list = []
    
    hierarchy = {}
    try:
        c.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE level_1 IS NOT NULL AND level_1 != ''")
        for r in c.fetchall():
            l1, l2, l3 = r[0], r[1], r[2]
            if l1 not in hierarchy: hierarchy[l1] = {}
            if l2:
                if l2 not in hierarchy[l1]: hierarchy[l1][l2] = []
                if l3 and l3 not in hierarchy[l1][l2]: hierarchy[l1][l2].append(l3)
    except: pass

    try:
        if is_shopping:
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC")
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict.get(f"level_{i}", "")) for i in range(1, 11) if r_dict.get(f"level_{i}")]
                img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                shopping_list.append({
                    "id": r_dict['id'],
                    "name": r_dict['name'], 
                    "qty": 0, 
                    "date": r_dict['item_date'], 
                    "img": img, 
                    "location": " > ".join([p for p in fp if p]),
                    "main_location": r_dict.get("level_2", "General"),
                    "sub_location": r_dict.get("level_3", "")
                })

        elif query or date_filter != "All":
            sql = "SELECT * FROM items WHERE 1=1"; params = []
            for i, p in enumerate(path_parts): sql += f" AND level_{i+1} = ?"; params.append(p)

            if query: sql += " AND name LIKE ?"; params.append(f"%{query}%")
            if date_filter == "Week": 
                sql += " AND item_date >= ?"; params.append((datetime.now()-timedelta(days=7)).strftime("%Y-%m-%d"))
            elif date_filter == "Month":
                sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y-%m") + "%")
            
            c.execute(sql, tuple(params))
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict.get(f"level_{i}", "")) for i in range(1, 11) if r_dict.get(f"level_{i}")]
                if r_dict['type'] == 'item':
                    img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                    items.append({
                        "id": r_dict['id'],
                        "name": r_dict['name'], 
                        "type": r_dict['type'], 
                        "qty": r_dict['quantity'], 
                        "date": r_dict['item_date'], 
                        "img": img, 
                        "location": " > ".join([p for p in fp if p]),
                        "category": r_dict.get('category', ''),
                        "sub_category": r_dict.get('sub_category', ''),
                        "unit": r_dict.get('unit', ''),
                        "unit_value": r_dict.get('unit_value', '')
                    })

        else:
            depth = len(path_parts)
            sql_where = ""; params = []
            for i, p in enumerate(path_parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)

            if depth < 2:
                col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
                found_folders = [r[0] for r in c.fetchall()]
                
                for f_name in found_folders:
                    marker_sql = f"SELECT image_path FROM items WHERE type='folder_marker' AND name=? {sql_where} AND {col}=?"
                    marker_params = [f"[Folder] {f_name}"] + params + [f_name]
                    
                    c.execute(marker_sql, tuple(marker_params))
                    row = c.fetchone()
                    img = f"/local/{IMG_DIR}/{row[0]}?v={int(time.time())}" if row and row[0] else None
                    folders.append({"name": f_name, "img": img})
                
                sql = f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where} ORDER BY name ASC"
                c.execute(sql, tuple(params))
                col_names = [description[0] for description in c.description]
                for r in c.fetchall():
                      r_dict = dict(zip(col_names, r))
                      img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                      items.append({
                          "id": r_dict['id'],
                          "name": r_dict['name'], 
                          "type": 'item', 
                          "qty": r_dict['quantity'], 
                          "img": img,
                          "date": r_dict.get('item_date', ''),
                          "category": r_dict.get('category', ''),
                          "sub_category": r_dict.get('sub_category', ''),
                          "unit": r_dict.get('unit', ''),
                          "unit_value": r_dict.get('unit_value', '')
                      })
            else:
                sublocations = []
                col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
                for r in c.fetchall(): sublocations.append(r[0])

                sql = f"SELECT * FROM items WHERE type='item' {sql_where} ORDER BY level_{depth+1} ASC, name ASC"
                c.execute(sql, tuple(params))
                col_names = [description[0] for description in c.description]
                
                fetched_items = []
                for r in c.fetchall():
                    r_dict = dict(zip(col_names, r))
                    img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                    subloc = r_dict.get(f"level_{depth+1}", "")
                    fetched_items.append({
                        "id": r_dict['id'],
                        "name": r_dict['name'], 
                        "type": 'item', 
                        "qty": r_dict['quantity'], 
                        "date": r_dict['item_date'], 
                        "img": img, 
                        "sub_location": subloc,
                        "category": r_dict.get('category', ''),
                        "sub_category": r_dict.get('sub_category', ''),
                        "unit": r_dict.get('unit', ''),
                        "unit_value": r_dict.get('unit_value', '')
                    })
                
                for s in sublocations: folders.append({"name": s})
                items = fetched_items

    finally: conn.close()

    return {
        "path_display": is_shopping and "Shopping List" or (query and "Search Results" or (" > ".join(path_parts) if path_parts else "Main")),
        "folders": folders,
        "items": items,
        "shopping_list": shopping_list,
        "app_version": VERSION,
        "depth": len(path_parts),
        "hierarchy": hierarchy,
        "enable_ai": enable_ai 
    }

async def register_services(hass, entry):
    api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
    
    def broadcast_update():
        hass.bus.async_fire("home_organizer_db_update")

    async def handle_add(call):
        name = call.data.get("item_name"); itype = call.data.get("item_type", "item")
        date = call.data.get("item_date"); img_b64 = call.data.get("image_data")
        fname = ""
        if img_b64:
            try:
                if "," in img_b64: img_b64 = img_b64.split(",")[1]
                fname = f"img_{int(time.time())}.jpg"
                await hass.async_add_executor_job(lambda: open(hass.config.path("www", IMG_DIR, fname), "wb").write(base64.b64decode(img_b64)))
            except: pass

        parts = call.data.get("current_path", [])
        # --- APPLIED ZONE FIX ---
        parts = normalize_zone_path(hass, parts)
        # ------------------------
        depth = len(parts)
        cols = ["name", "type", "quantity", "item_date", "image_path"]
        
        if itype == 'folder':
            if depth >= 10: return
            vals = [f"[Folder] {name}", "folder_marker", 0, date, fname]
            qs = ["?", "?", "?", "?", "?"]
            for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")
            cols.append(f"level_{depth+1}"); vals.append(name); qs.append("?")
            
            def db_ins():
                conn = get_db_connection(hass); c = conn.cursor()
                c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
                conn.commit(); conn.close()
            await hass.async_add_executor_job(db_ins)
        else:
            vals = [name, itype, 1, date, fname]
            qs = ["?", "?", "?", "?", "?"]
            for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")

            def db_ins():
                conn = get_db_connection(hass); c = conn.cursor()
                c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
                conn.commit(); conn.close()
            await hass.async_add_executor_job(db_ins)

        broadcast_update()
        
    async def handle_duplicate(call):
        item_id = call.data.get("item_id")
        if not item_id: return
        def db_dup():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute("PRAGMA table_info(items)")
            columns = [col[1] for col in c.fetchall() if col[1] not in ('id', 'created_at')]
            col_str = ", ".join(columns)
            c.execute(f"INSERT INTO items ({col_str}) SELECT {col_str} FROM items WHERE id = ?", (item_id,))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_dup)
        broadcast_update()

    async def handle_update_qty(call):
        item_id = call.data.get("item_id")
        change = int(call.data.get("change"))
        today = datetime.now().strftime("%Y-%m-%d")
        def db_q():
            conn = get_db_connection(hass); c = conn.cursor()
            if item_id:
                c.execute(f"UPDATE items SET quantity = MAX(0, quantity + ?), item_date = ? WHERE id = ?", (change, today, item_id))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_q); broadcast_update()

    async def handle_update_stock(call):
        item_id = call.data.get("item_id")
        qty = int(call.data.get("quantity"))
        today = datetime.now().strftime("%Y-%m-%d")
        def db_upd():
            conn = get_db_connection(hass); c = conn.cursor()
            if item_id:
                c.execute(f"UPDATE items SET quantity = ?, item_date = ? WHERE id = ?", (qty, today, item_id))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_upd); broadcast_update()

    async def handle_delete(call):
        item_id = call.data.get("item_id")
        name = call.data.get("item_name")
        parts = call.data.get("current_path", [])
        # --- APPLIED ZONE FIX ---
        parts = normalize_zone_path(hass, parts)
        # ------------------------
        is_folder = call.data.get("is_folder", False)

        def db_del(): 
            conn = get_db_connection(hass); c = conn.cursor()
            if is_folder:
                depth = len(parts)
                target_col = f"level_{depth+1}"
                conditions = [f"{target_col} = ?"]
                args = [name]
                for i, p in enumerate(parts):
                    conditions.append(f"level_{i+1} = ?")
                    args.append(p)
                c.execute(f"DELETE FROM items WHERE {' AND '.join(conditions)}", tuple(args))
            else:
                if item_id:
                    c.execute(f"DELETE FROM items WHERE id = ?", (item_id,))
                else:
                    c.execute(f"DELETE FROM items WHERE name = ?", (name,))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_del); broadcast_update()

    async def handle_paste(call):
        target_path = call.data.get("target_path")
        # --- APPLIED ZONE FIX ---
        target_path = normalize_zone_path(hass, target_path)
        # ------------------------
        clipboard = hass.data.get(DOMAIN, {}).get("clipboard") 
        if not clipboard: return
        
        item_id = clipboard.get("id") if isinstance(clipboard, dict) else None
        item_name = clipboard.get("name") if isinstance(clipboard, dict) else clipboard

        def db_mv():
            conn = get_db_connection(hass); c = conn.cursor()
            upd = [f"level_{i} = ?" for i in range(1, 11)]
            vals = [target_path[i-1] if i <= len(target_path) else None for i in range(1, 11)]
            
            if item_id:
                c.execute(f"UPDATE items SET {','.join(upd)} WHERE id = ?", (*vals, item_id))
            else:
                c.execute(f"UPDATE items SET {','.join(upd)} WHERE name = ?", (*vals, item_name))
                
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_mv)
        hass.data[DOMAIN]["clipboard"] = None
        broadcast_update()

    async def handle_clipboard(call):
        action = call.data.get("action")
        item_name = call.data.get("item_name")
        item_id = call.data.get("item_id")
        
        if action == "cut":
            hass.data[DOMAIN]["clipboard"] = {"id": item_id, "name": item_name}
        else:
            hass.data[DOMAIN]["clipboard"] = None

    async def handle_update_item_details(call):
        item_id = call.data.get("item_id")
        orig = call.data.get("original_name")
        nn = call.data.get("new_name")
        nd = call.data.get("new_date")
        cat = call.data.get("category")
        sub_cat = call.data.get("sub_category")
        unit = call.data.get("unit")
        unit_value = call.data.get("unit_value")
        
        image_path = call.data.get("image_path")

        parts = call.data.get("current_path", [])
        # --- APPLIED ZONE FIX ---
        parts = normalize_zone_path(hass, parts)
        # ------------------------
        is_folder = call.data.get("is_folder", False)

        def db_u():
            conn = get_db_connection(hass); c = conn.cursor()
            
            if is_folder:
                depth = len(parts)
                if depth < 10:
                    target_col = f"level_{depth+1}"
                    where_clause = f"{target_col} = ?"
                    where_args = [orig]
                    for i, p in enumerate(parts):
                        where_clause += f" AND level_{i+1} = ?"
                        where_args.append(p)
                    
                    c.execute(f"UPDATE items SET {target_col} = ? WHERE {where_clause}", [nn] + where_args)
                    
                    marker_where = f"{target_col} = ?"
                    marker_args = [nn] 
                    for i, p in enumerate(parts):
                        marker_where += f" AND level_{i+1} = ?"
                        marker_args.append(p)
                    
                    c.execute(f"UPDATE items SET name = ? WHERE type = 'folder_marker' AND name = ? AND {marker_where}", 
                              (f"[Folder] {nn}", f"[Folder] {orig}", *marker_args))
            else:
                sql = "UPDATE items SET "
                updates = []
                params = []
                
                if nn: updates.append("name = ?"); params.append(nn)
                if nd is not None: updates.append("item_date = ?"); params.append(nd)
                
                if cat is not None: updates.append("category = ?"); params.append(cat)
                if sub_cat is not None: updates.append("sub_category = ?"); params.append(sub_cat)
                if unit is not None: updates.append("unit = ?"); params.append(unit)
                if unit_value is not None: updates.append("unit_value = ?"); params.append(unit_value)
                if image_path is not None: updates.append("image_path = ?"); params.append(image_path)
                
                if updates:
                    sql += ", ".join(updates)
                    if item_id:
                        sql += " WHERE id = ?"
                        params.append(item_id)
                    else:
                        sql += " WHERE name = ?"
                        params.append(orig)
                        if parts:
                            for i, p in enumerate(parts): sql += f" AND level_{i+1} = ?"; params.append(p)

                    c.execute(sql, tuple(params))

            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_u); broadcast_update()

    async def handle_update_image(call):
        item_id = call.data.get("item_id")
        name = call.data.get("item_name")
        img_b64 = call.data.get("image_data")
        
        # --- ADDITIVE: Fetch mime to support correct PDF/Img extensions ---
        mime_type = call.data.get("mime_type", "image/jpeg")
        ext = ".pdf" if "pdf" in mime_type else ".jpg"
        # ------------------------------------------------------------------
        
        if "," in img_b64: img_b64 = img_b64.split(",")[1]
        fname = f"{name}_{int(time.time())}{ext}"
        
        def save():
            open(hass.config.path("www", IMG_DIR, fname), "wb").write(base64.b64decode(img_b64))
            conn = get_db_connection(hass); c = conn.cursor()
            if item_id:
                c.execute(f"UPDATE items SET image_path = ? WHERE id = ?", (fname, item_id))
            else:
                c.execute(f"UPDATE items SET image_path = ? WHERE name = ?", (fname, name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(save); broadcast_update()

    async def handle_ai_action(call):
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if not use_ai: return
        mode = call.data.get("mode")
        img_b64 = call.data.get("image_data")
        
        # --- ADDITIVE: Extract mime_type natively ---
        mime_val = call.data.get("mime_type", "image/jpeg")
        # ------------------------------------------
        
        if not img_b64 or not api_key: return
        if "," in img_b64: img_b64 = img_b64.split(",")[1]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
        prompt_text = "Identify this household item. Return ONLY the name in English or Hebrew. 2-3 words max."
        if mode == 'search': prompt_text = "Identify this item. Return only 1 keyword for searching."

        # --- APPLIED: Dynamic Mime Type for compatibility ---
        payload = {"contents": [{"parts": [{"text": prompt_text}, {"inline_data": {"mime_type": mime_val, "data": img_b64}}]}]}

        try:
            session = async_get_clientsession(hass)
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    json_resp = await resp.json()
                    text = json_resp["candidates"][0]["content"]["parts"][0]["text"].strip()
                    hass.bus.async_fire("home_organizer_ai_result", {"result": text, "mode": mode})
        except Exception as e: _LOGGER.error(f"AI Error: {e}")

    for n, h in [
        ("add_item", handle_add), ("update_image", handle_update_image),
        ("update_stock", handle_update_stock), ("update_qty", handle_update_qty), ("delete_item", handle_delete),
        ("clipboard_action", handle_clipboard), ("paste_item", handle_paste), ("ai_action", handle_ai_action),
        ("update_item_details", handle_update_item_details), ("duplicate_item", handle_duplicate)
    ]:
        hass.services.async_register(DOMAIN, n, h)
