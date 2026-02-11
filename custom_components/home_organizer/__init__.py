# -*- coding: utf-8 -*-
# Home Organizer Ultimate - ver 7.1.6 (AI Actions + Invoice Scanning)
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

# Using gemini-3-flash-preview for high resolution scanning
GEMINI_MODEL = "gemini-3-flash-preview"

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if entry.options.get(CONF_DEBUG): _LOGGER.setLevel(logging.DEBUG)
    frontend_folder = os.path.join(os.path.dirname(__file__), "frontend")
    await hass.http.async_register_static_paths([StaticPathConfig(url_path=STATIC_PATH_URL, path=frontend_folder, cache_headers=False)])
    try:
        await panel_custom.async_register_panel(
            hass, webcomponent_name="home-organizer-panel", frontend_url_path="organizer",
            module_url=f"{STATIC_PATH_URL}/organizer-panel.js?v={int(time.time())}",
            sidebar_title="Organizr", sidebar_icon="mdi:package-variant-closed", require_admin=False
        )
    except Exception as e: _LOGGER.warning(f"Panel registration warning: {e}")
    await hass.async_add_executor_job(init_db, hass)
    hass.data.setdefault(DOMAIN, {})
    try:
        websocket_api.async_register_command(hass, WS_GET_DATA, websocket_get_data, websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({vol.Required("type"): WS_GET_DATA, vol.Optional("path", default=[]): list, vol.Optional("search_query", default=""): str, vol.Optional("date_filter", default="All"): str, vol.Optional("shopping_mode", default=False): bool}))
        websocket_api.async_register_command(hass, WS_GET_ALL_ITEMS, websocket_get_all_items, websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({vol.Required("type"): WS_GET_ALL_ITEMS}))
        websocket_api.async_register_command(hass, WS_AI_CHAT, websocket_ai_chat, websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({vol.Required("type"): WS_AI_CHAT, vol.Optional("message", default=""): str, vol.Optional("image_data"): vol.Any(str, None)}))
    except Exception: pass 
    await register_services(hass, entry)
    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True

async def update_listener(hass, entry): await hass.config_entries.async_reload(entry.entry_id)
async def async_unload_entry(hass, entry):
    try: hass.components.frontend.async_remove_panel("organizer")
    except Exception: pass
    return True

def get_db_connection(hass): return sqlite3.connect(hass.config.path(DB_FILE))
def init_db(hass):
    if not os.path.exists(hass.config.path("www", IMG_DIR)): os.makedirs(hass.config.path("www", IMG_DIR))
    conn = get_db_connection(hass); c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
    c.execute("PRAGMA table_info(items)")
    existing_cols = [col[1] for col in c.fetchall()]
    needed_cols = {'type': "TEXT DEFAULT 'item'", 'quantity': "INTEGER DEFAULT 1", 'item_date': "TEXT", 'image_path': "TEXT", 'category': "TEXT", 'sub_category': "TEXT", 'unit': "TEXT", 'unit_value': "TEXT", 'created_at': "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"}
    for i in range(1, 11): needed_cols[f"level_{i}"] = "TEXT"
    for col, dtype in needed_cols.items():
        if col not in existing_cols:
            try: c.execute(f"ALTER TABLE items ADD COLUMN {col} {dtype}")
            except: pass
    conn.commit(); conn.close()

def add_item_db_safe(hass, name, qty, path_list, category="", sub_category=""):
    conn = get_db_connection(hass); c = conn.cursor()
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        cols = ["name", "type", "quantity", "item_date", "category", "sub_category"]
        vals = [name, "item", qty, today, category, sub_category]
        qs = ["?", "?", "?", "?", "?", "?"]
        for i, p in enumerate(path_list):
            if i < 10: cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")
        c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
        conn.commit(); return True
    except Exception as e: _LOGGER.error(f"DB Add Error: {e}"); return False
    finally: conn.close()

@callback
def websocket_get_data(hass, connection, msg):
    d = get_view_data(hass, msg.get("path", []), msg.get("search_query", ""), msg.get("date_filter", "All"), msg.get("shopping_mode", False))
    connection.send_result(msg["id"], d)

@callback
def websocket_get_all_items(hass, connection, msg):
    conn = get_db_connection(hass); c = conn.cursor()
    try:
        c.execute("SELECT name, category, sub_category, unit, unit_value, image_path FROM items WHERE type='item' GROUP BY name")
        col_names = [d[0] for d in c.description]; results = []
        for r in c.fetchall():
            item = dict(zip(col_names, r))
            if item['image_path']: item['image_path'] = f"/local/{IMG_DIR}/{item['image_path']}?v={int(time.time())}"
            results.append(item)
        connection.send_result(msg["id"], results)
    finally: conn.close()

@websocket_api.async_response
async def websocket_ai_chat(hass, connection, msg):
    """AI Chat v7.1.6: Optimized for High-Res Invoice Scanning with language detection and location matching."""
    try:
        user_message, image_data = msg.get("message", ""), msg.get("image_data")
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries: connection.send_result(msg["id"], {"error": "Integration not loaded"}); return
        entry = entries[0]; api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY))
        if not api_key: connection.send_result(msg["id"], {"error": "API Key missing."}); return
        session = async_get_clientsession(hass)
        gen_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"

        def get_db_context():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE level_1 != ''")
            paths = [" > ".join([str(x) for x in r if x]) for r in c.fetchall()]
            c.execute("SELECT name, level_1, level_2, level_3 FROM items WHERE type='item'")
            items_locs = {r[0]: [x for x in r[1:] if x] for r in c.fetchall()}
            conn.close(); return list(set(paths)), items_locs

        existing_paths, existing_items_map = await hass.async_add_executor_job(get_db_context)
        paths_context = "\n".join([f"- {p}" for p in existing_paths])
        items_context = ", ".join(list(existing_items_map.keys())[:50])

        if image_data:
            if "," in image_data: image_data = image_data.split(",")[1]
            invoice_prompt = (
                "Task: Extract items from this invoice.\n"
                "CRITICAL RULES:\n"
                "1. LANGUAGE: Match the language of the invoice. If Hebrew, use Hebrew names. If English, use English names.\n"
                "2. NO NEW ROOMS: DO NOT create new rooms. Use only existing paths from the list.\n"
                "3. MATCHING: Match items to existing locations logically.\n"
                "4. FALLBACK: Use path ['General'] if no match.\n"
                "\nEXISTING PATHS:\n" + paths_context + "\n"
                "\nEXISTING ITEMS:\n" + items_context + "\n"
                "\nResponse format JSON only: {\"intent\": \"add_invoice\", \"items\": [{\"name\": \"...\", \"qty\": 1, \"path\": [\"Room\", \"Sub\"]}]}"
            )
            hass.bus.async_fire("home_organizer_chat_progress", {"step": "Scanning Invoice..."})
            payload = {"contents": [{"parts": [{"text": invoice_prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": image_data}}]}]}
            async with session.post(gen_url, json=payload, timeout=ClientTimeout(total=45)) as resp:
                if resp.status != 200: connection.send_result(msg["id"], {"error": "AI API Error"}); return
                res = await resp.json(); raw_txt = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                clean_txt = re.sub(r'```json\s*|```\s*', '', raw_txt).strip()
                try:
                    parsed = json.loads(clean_txt)
                    if parsed.get("intent") == "add_invoice":
                        for item in parsed.get("items", []):
                            await hass.async_add_executor_job(add_item_db_safe, hass, item.get("name"), int(item.get("qty", 1)), item.get("path", ["General"]))
                        hass.bus.async_fire("home_organizer_db_update")
                        response_text = f"✅ Added **{len(parsed.get('items', []))} items** based on your existing setup.\n\n"
                        for i in parsed.get("items", []): response_text += f"- **{i.get('name')}** (x{i.get('qty')}) → _{' > '.join(i.get('path'))}_\n"
                        connection.send_result(msg["id"], {"response": response_text, "debug": {"raw_json": clean_txt}}); return
                except Exception as e: connection.send_result(msg["id"], {"error": str(e)}); return

        step1_prompt = f"User message: '{user_message}'\nAnalyze intent. Match to EXISTING PATHS only.\n\nEXISTING PATHS:\n{paths_context}\nJSON only."
        async with session.post(gen_url, json={"contents": [{"parts": [{"text": step1_prompt}]}]}, timeout=ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                res = await resp.json(); raw = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                analysis = json.loads(re.sub(r'```json\s*|```\s*', '', raw).strip())
                if analysis.get("intent") == "add":
                    for item in analysis.get("items", []): await hass.async_add_executor_job(add_item_db_safe, hass, item.get("name"), int(item.get("qty", 1)), item.get("path", ["General"]))
                    hass.bus.async_fire("home_organizer_db_update"); connection.send_result(msg["id"], {"response": "✅ Items added."}); return
        connection.send_result(msg["id"], {"response": "How can I help you today?"})
    except Exception as e: connection.send_result(msg["id"], {"error": str(e)})

def get_view_data(hass, path_parts, query, date_filter, is_shopping):
    enable_ai = False; entries = hass.config_entries.async_entries(DOMAIN)
    if entries:
        e = entries[0]; ak = e.options.get(CONF_API_KEY, e.data.get(CONF_API_KEY))
        if ak and e.options.get(CONF_USE_AI, e.data.get(CONF_USE_AI, True)): enable_ai = True
    conn = get_db_connection(hass); c = conn.cursor(); folders, items, shopping_list, hierarchy = [], [], [], {}
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
        depth = len(path_parts); sql_where = ""; params = []
        for i, p in enumerate(path_parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)
        if is_shopping:
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC")
            col_names = [d[0] for d in c.description]
            for r in c.fetchall(): r_dict = dict(zip(col_names, r)); shopping_list.append({"id": r_dict['id'], "name": r_dict['name'], "qty": 0, "main_location": r_dict.get("level_2", "General")})
        elif query:
            c.execute(f"SELECT * FROM items WHERE name LIKE ? AND type='item'", (f"%{query}%",))
            col_names = [d[0] for d in c.description]
            for r in c.fetchall(): r_dict = dict(zip(col_names, r)); items.append({"id": r_dict['id'], "name": r_dict['name'], "qty": r_dict['quantity']})
        else:
            col = f"level_{depth+1}"
            c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
            folders = [{"name": r[0]} for r in c.fetchall()]
            c.execute(f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where}", tuple(params))
            col_names = [d[0] for d in c.description]
            for r in c.fetchall(): r_dict = dict(zip(col_names, r)); items.append({"id": r_dict['id'], "name": r_dict['name'], "qty": r_dict['quantity']})
    finally: conn.close()
    return {"path_display": is_shopping and "Shopping List" or (query and "Search Results" or (" > ".join(path_parts) if path_parts else "Main")), "folders": folders, "items": items, "shopping_list": shopping_list, "depth": depth, "hierarchy": hierarchy, "enable_ai": enable_ai}

async def register_services(hass, entry):
    def broadcast(): hass.bus.async_fire("home_organizer_db_update")
    async def handle_add(call):
        n, t, p = call.data.get("item_name"), call.data.get("item_type", "item"), call.data.get("current_path", [])
        def db_ins():
            conn = get_db_connection(hass); c = conn.cursor(); cols = ["name", "type", "quantity"]; vals = [n, t, 1 if t == "item" else 0]; qs = ["?", "?", "?"]
            for i, px in enumerate(p): cols.append(f"level_{i+1}"); vals.append(px); qs.append("?")
            if t == "folder": cols.append(f"level_{len(p)+1}"); vals.append(n); qs.append("?")
            c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals)); conn.commit(); conn.close()
        await hass.async_add_executor_job(db_ins); broadcast()
    async def handle_delete(call):
        iid = call.data.get("item_id")
        await hass.async_add_executor_job(lambda: get_db_connection(hass).cursor().execute("DELETE FROM items WHERE id = ?", (iid,)).connection.commit()); broadcast()
    async def handle_update_qty(call):
        iid, ch = call.data.get("item_id"), int(call.data.get("change"))
        await hass.async_add_executor_job(lambda: get_db_connection(hass).cursor().execute("UPDATE items SET quantity = MAX(0, quantity + ?) WHERE id = ?", (ch, iid)).connection.commit()); broadcast()
    for n, h in [("add_item", handle_add), ("delete_item", handle_delete), ("update_qty", handle_update_qty)]: hass.services.async_register(DOMAIN, n, h)
