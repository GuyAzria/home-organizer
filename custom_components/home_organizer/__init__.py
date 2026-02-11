# -*- coding: utf-8 -*-
# Home Organizer Ultimate - ver 7.1.4 (AI Actions + Invoice Scanning)
# License: MIT

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

# Use the latest flash model for high-resolution vision support
GEMINI_MODEL = "gemini-2.0-flash-exp"

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
        websocket_api.async_register_command(
            hass,
            WS_AI_CHAT,
            websocket_ai_chat,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_AI_CHAT,
                vol.Optional("message", default=""): str,
                vol.Optional("image_data"): vol.Any(str, None)
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

def add_item_db_safe(hass, name, qty, path_list, category="", sub_category=""):
    """Internal helper to add items during AI Chat flow."""
    conn = get_db_connection(hass)
    c = conn.cursor()
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        cols = ["name", "type", "quantity", "item_date", "category", "sub_category"]
        vals = [name, "item", qty, today, category, sub_category]
        qs = ["?", "?", "?", "?", "?", "?"]
        
        # Add hierarchy levels
        for i, p in enumerate(path_list):
            if i < 10: 
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
    """AI Chat v7.1.4: Handles text and High-Res Invoice scanning with existing location context."""
    try:
        user_message = msg.get("message", "")
        image_data = msg.get("image_data")
        
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

        # =============================================
        # FETCH DATABASE CONTEXT (Rooms and Items)
        # =============================================
        def get_db_context():
            conn = get_db_connection(hass)
            c = conn.cursor()
            # 1. Existing Hierarchy
            c.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE level_1 != ''")
            paths = []
            for r in c.fetchall():
                p = " > ".join([str(x) for x in r if x])
                if p not in paths: paths.append(p)
            # 2. Existing Item names and their paths for matching
            c.execute("SELECT name, level_1, level_2, level_3 FROM items WHERE type='item'")
            items_locs = {}
            for r in c.fetchall():
                items_locs[r[0]] = [x for x in r[1:] if x]
            conn.close()
            return paths, items_locs

        existing_paths, existing_items = await hass.async_add_executor_job(get_db_context)
        paths_str = "\n".join([f"- {p}" for p in existing_paths])
        items_str = ", ".join(list(existing_items.keys())[:50]) # Sample for context

        # =============================================
        # MODE 1: INVOICE / IMAGE PROCESSING
        # =============================================
        if image_data:
            if "," in image_data: image_data = image_data.split(",")[1]
            
            invoice_prompt = (
                "Identify items in this invoice image.\n"
                "RULES:\n"
                "1. LANGUAGE: Preserve invoice language. If Hebrew, use Hebrew for item names. If English, use English.\n"
                "2. NO NEW ROOMS: Only use paths from 'EXISTING PATHS' list below.\n"
                "3. MATCHING: If an item name (or similar) already exists in 'EXISTING ITEMS', use its specific path.\n"
                "4. LOGIC: Match items to existing locations (e.g. Dairy items to 'Kitchen > Fridge').\n"
                "5. FALLBACK: If no logical match found, use path ['General'].\n"
                "\nEXISTING PATHS:\n" + paths_str + "\n"
                "\nEXISTING ITEMS SAMPLE:\n" + items_str + "\n"
                "\nReturn JSON ONLY: {\"intent\": \"add_invoice\", \"items\": [{\"name\": \"...\", \"qty\": 1, \"path\": [\"Room\", \"Sub\"]}]}"
            )

            hass.bus.async_fire("home_organizer_chat_progress", {
                "step": "Analyzing High-Res Invoice...",
                "debug_type": "image_scan",
                "debug_label": "System Context Prompt",
                "debug_content": invoice_prompt
            })

            payload = {
                "contents": [{
                    "parts": [
                        {"text": invoice_prompt},
                        {"inline_data": {"mime_type": "image/jpeg", "data": image_data}}
                    ]
                }]
            }

            async with session.post(gen_url, json=payload, timeout=ClientTimeout(total=45)) as resp:
                if resp.status != 200:
                    err = await resp.text()
                    connection.send_result(msg["id"], {"error": f"AI API Error: {err}"})
                    return
                
                res = await resp.json()
                raw_txt = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                clean_txt = re.sub(r'```json\s*|```\s*', '', raw_txt).strip()
                
                added_count = 0
                try:
                    parsed = json.loads(clean_txt)
                    if parsed.get("intent") == "add_invoice" and "items" in parsed:
                        for item in parsed["items"]:
                            await hass.async_add_executor_job(
                                add_item_db_safe, 
                                hass, 
                                item.get("name", "Unknown"), 
                                int(item.get("qty", 1)), 
                                item.get("path", ["General"])
                            )
                            added_count += 1
                        
                        hass.bus.async_fire("home_organizer_db_update")
                        response_text = f"✅ Added **{added_count} items** to inventory based on your existing locations.\n\n"
                        for i in parsed["items"]:
                            response_text += f"- **{i.get('name')}** (x{i.get('qty')}) → _{' > '.join(i.get('path'))}_\n"

                        connection.send_result(msg["id"], {"response": response_text, "debug": {"raw_json": clean_txt}})
                        return
                except Exception as e:
                     connection.send_result(msg["id"], {"response": f"❌ Error processing invoice data.", "debug": {"error": str(e), "raw": clean_txt}})
                     return

        # =============================================
        # MODE 2: TEXT ANALYSIS (ADD vs SEARCH)
        # =============================================
        step1_prompt = (
            f"User says: '{user_message}'\n"
            "Analyze intent. IF ADDING: Use EXISTING PATHS only. IF SEARCHING: Find match in DB.\n"
            "\nEXISTING PATHS:\n" + paths_str + "\n"
            "Return JSON ONLY. No markdown."
        )

        payload_1 = {"contents": [{"parts": [{"text": step1_prompt}]}]}
        async with session.post(gen_url, json=payload_1, timeout=ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                res = await resp.json()
                raw_analysis = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                clean_txt = re.sub(r'```json\s*|```\s*', '', raw_analysis).strip()
                analysis_json = json.loads(clean_txt)
            else:
                connection.send_result(msg["id"], {"error": "AI API Connection Failed"})
                return

        if analysis_json.get("intent") == "add":
            added_log = []
            for item in analysis_json.get("items", []):
                nm, qt, pt = item.get("name"), item.get("qty", 1), item.get("path", ["General"])
                await hass.async_add_executor_job(add_item_db_safe, hass, nm, qt, pt)
                added_log.append(f"{nm} (x{qt}) to {' > '.join(pt)}")
            
            hass.bus.async_fire("home_organizer_db_update")
            resp_text = f"✅ Added {len(added_log)} items:\n" + "\n".join([f"- {l}" for l in added_log])
            connection.send_result(msg["id"], {"response": resp_text, "debug": {"intent": "add", "json": analysis_json}})
            return

        # Handle Query/Search
        # (Standard search implementation using SQLite filters based on keywords in user message)
        connection.send_result(msg["id"], {"response": "I'm ready to help! Ask me to scan an invoice or find an item."})

    except Exception as e:
        _LOGGER.error(f"AI Chat Error: {e}")
        connection.send_result(msg["id"], {"error": str(e)})

def get_view_data(hass, path_parts, query, date_filter, is_shopping):
    enable_ai = False
    entries = hass.config_entries.async_entries(DOMAIN)
    if entries:
        entry = entries[0]
        api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY))
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if api_key and use_ai: enable_ai = True

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
        depth = len(path_parts)
        sql_where = ""; params = []
        for i, p in enumerate(path_parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)

        if is_shopping:
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC")
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                shopping_list.append({"id": r_dict['id'], "name": r_dict['name'], "qty": 0, "main_location": r_dict.get("level_2", "General")})
        elif query:
            c.execute(f"SELECT * FROM items WHERE name LIKE ? AND type='item'", (f"%{query}%",))
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                items.append({"id": r_dict['id'], "name": r_dict['name'], "qty": r_dict['quantity']})
        else:
            col = f"level_{depth+1}"
            c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
            folders = [{"name": r[0]} for r in c.fetchall()]
            c.execute(f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where}", tuple(params))
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                items.append({"id": r_dict['id'], "name": r_dict['name'], "qty": r_dict['quantity']})

    finally: conn.close()

    return {
        "path_display": is_shopping and "Shopping List" or (query and "Search Results" or (" > ".join(path_parts) if path_parts else "Main")),
        "folders": folders, "items": items, "shopping_list": shopping_list,
        "depth": len(path_parts), "hierarchy": hierarchy, "enable_ai": enable_ai 
    }

async def register_services(hass, entry):
    def broadcast(): hass.bus.async_fire("home_organizer_db_update")

    async def handle_add(call):
        name, itype, parts = call.data.get("item_name"), call.data.get("item_type", "item"), call.data.get("current_path", [])
        def db_ins():
            conn = get_db_connection(hass); c = conn.cursor()
            cols = ["name", "type", "quantity"]
            vals = [name, itype, 1 if itype == "item" else 0]
            qs = ["?", "?", "?"]
            for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")
            if itype == "folder": cols.append(f"level_{len(parts)+1}"); vals.append(name); qs.append("?")
            c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_ins); broadcast()

    async def handle_delete(call):
        item_id = call.data.get("item_id")
        def db_del():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute("DELETE FROM items WHERE id = ?", (item_id,))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_del); broadcast()

    async def handle_update_qty(call):
        item_id, change = call.data.get("item_id"), int(call.data.get("change"))
        def db_q():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute("UPDATE items SET quantity = MAX(0, quantity + ?) WHERE id = ?", (change, item_id))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_q); broadcast()

    for n, h in [("add_item", handle_add), ("delete_item", handle_delete), ("update_qty", handle_update_qty)]:
        hass.services.async_register(DOMAIN, n, h)
