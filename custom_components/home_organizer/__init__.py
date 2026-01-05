# -*- coding: utf-8 -*-
# Home Organizer Ultimate - Ver 2.2.2 (Indentation Fix)

import logging
import sqlite3
import os
import shutil
import base64
import time
import json
from datetime import datetime, timedelta
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.components import panel_custom
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from .const import DOMAIN, CONF_API_KEY, CONF_DEBUG, CONF_USE_AI, DB_FILE, IMG_DIR, VERSION

_LOGGER = logging.getLogger(__name__)
MAX_LEVELS = 10

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if entry.options.get(CONF_DEBUG): _LOGGER.setLevel(logging.DEBUG)

    await async_setup_frontend(hass)

    # Corrected Indentation Block
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="home-organizer-panel",
        frontend_url_path="organizer",
        module_url=f"/local/home_organizer_libs/organizer-panel.js?v={int(time.time())}",
        sidebar_title="ארגונית",
        sidebar_icon="mdi:package-variant-closed",
        require_admin=False
    )

    await hass.async_add_executor_job(init_db, hass)

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "current_path": [],
        "search_query": "",
        "date_filter": "All",
        "shopping_mode": False,
        "clipboard": None,
        "ai_suggestion": ""
    }

    await register_services(hass, entry)
    await hass.async_add_executor_job(update_view, hass, entry)

    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry):
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.components.frontend.async_remove_panel("organizer")
    return True

async def async_setup_frontend(hass: HomeAssistant):
    src = os.path.join(os.path.dirname(__file__), "frontend", "organizer-panel.js")
    dest_dir = hass.config.path("www", "home_organizer_libs")
    dest = os.path.join(dest_dir, "organizer-panel.js")
    
    if not os.path.exists(dest_dir): 
        await hass.async_add_executor_job(os.makedirs, dest_dir)
        
    if os.path.exists(src): 
        await hass.async_add_executor_job(shutil.copyfile, src, dest)

def get_db_connection(hass):
    return sqlite3.connect(hass.config.path(DB_FILE))

def init_db(hass):
    if not os.path.exists(hass.config.path("www", IMG_DIR)): os.makedirs(hass.config.path("www", IMG_DIR))
    conn = get_db_connection(hass)
    c = conn.cursor()
    cols = ", ".join([f"level_{i} TEXT" for i in range(1, MAX_LEVELS + 1)])
    c.execute(f'''CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT DEFAULT 'item',
        {cols}, item_date TEXT, quantity INTEGER DEFAULT 1, image_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute("PRAGMA table_info(items)")
    existing = [col[1] for col in c.fetchall()]
    if 'image_path' not in existing: c.execute("ALTER TABLE items ADD COLUMN image_path TEXT")
    conn.commit(); conn.close()

def update_view(hass, entry=None):
    state = hass.data[DOMAIN]
    path_parts = state["current_path"]
    query = state["search_query"]
    date_filter = state["date_filter"]
    is_shopping = state["shopping_mode"]
    
    use_ai = True
    if entry:
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
    
    conn = get_db_connection(hass); c = conn.cursor()
    folders = []; items = []; shopping_list = []

    try:
        if is_shopping:
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC")
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict[f"level_{i}"]) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
                img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                shopping_list.append({
                    "name": r_dict['name'], 
                    "qty": 0, 
                    "date": r_dict['item_date'], 
                    "img": img, 
                    "location": " > ".join(fp),
                    "main_location": r_dict.get("level_2", "General"),
                    "sub_location": r_dict.get("level_3", "")
                })

        elif query or date_filter != "All":
            sql = "SELECT * FROM items WHERE 1=1"; params = []
            for i, p in enumerate(path_parts): sql += f" AND level_{i+1} = ?"; params.append(p)

            if query: sql += " AND name LIKE ?"; params.append(f"%{query}%")
            if date_filter == "Week": sql += " AND item_date >= ?"; params.append((datetime.now()-timedelta(days=7)).strftime("%Y-%m-%d"))
            elif date_filter == "Month": sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y-%m") + "%")
            elif date_filter == "Year": sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y") + "%")

            c.execute(sql, tuple(params))
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict[f"level_{i}"]) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
                if r_dict['type'] == 'item':
                    img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                    items.append({"name": r_dict['name'], "type": r_dict['type'], "qty": r_dict['quantity'], "date": r_dict['item_date'], "img": img, "location": " > ".join(fp)})

        else:
            depth = len(path_parts)
            sql_where = ""; params = []
            for i, p in enumerate(path_parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)

            if depth < 2:
                col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
                for r in c.fetchall(): folders.append({"name": r[0]})
                
                sql = f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where} ORDER BY name ASC"
                c.execute(sql, tuple(params))
                col_names = [description[0] for description in c.description]
                for r in c.fetchall():
                     r_dict = dict(zip(col_names, r))
                     img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                     items.append({"name": r_dict['name'], "type": 'item', "qty": r_dict['quantity'], "img": img})
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
                        "name": r_dict['name'], 
                        "type": 'item', 
                        "qty": r_dict['quantity'], 
                        "date": r_dict['item_date'], 
                        "img": img, 
                        "sub_location": subloc
                    })
                
                for s in sublocations: folders.append({"name": s})
                items = fetched_items

    finally: conn.close()

    display = "Shopping List" if is_shopping else ("Search Results" if (query or date_filter != "All") else (" > ".join(path_parts) if path_parts else "Main"))

    hass.states.async_set("sensor.organizer_view", "Active", {
        "path_display": display, "folders": folders, "items": items, "shopping_list": shopping_list,
        "clipboard": state["clipboard"], "ai_suggestion": state.get("ai_suggestion", ""), 
        "app_version": VERSION,
        "use_ai": use_ai,
        "depth": len(path_parts)
    })

async def register_services(hass, entry):
    
    api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
    
    async def update_wrapper(hass):
        await hass.async_add_executor_job(update_view, hass, entry)

    async def handle_set_context(call):
        d = call.data
        if "path" in d: hass.data[DOMAIN]["current_path"] = d["path"]
        if "search_query" in d: hass.data[DOMAIN]["search_query"] = d["search_query"]
        if "date_filter" in d: hass.data[DOMAIN]["date_filter"] = d["date_filter"]
        if "shopping_mode" in d: hass.data[DOMAIN]["shopping_mode"] = d["shopping_mode"]
        hass.data[DOMAIN]["ai_suggestion"] = ""
        await update_wrapper(hass)

    async def handle_navigate(call):
        direction = call.data.get("direction")
        name = call.data.get("name")
        current_path = hass.data[DOMAIN]["current_path"]
        
        if direction == "root":
            hass.data[DOMAIN]["current_path"] = []
        elif direction == "up":
            if current_path:
                current_path.pop()
        elif direction == "down":
            if name:
                current_path.append(name)
        
        hass.data[DOMAIN]["search_query"] = ""
        hass.data[DOMAIN]["shopping_mode"] = False
        await update_wrapper(hass)

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

        parts = hass.data[DOMAIN]["current_path"]
        depth = len(parts)
        cols = ["name", "type", "quantity", "item_date", "image_path"]
        
        if itype == 'folder':
            if depth >= MAX_LEVELS: return
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

        hass.data[DOMAIN]["ai_suggestion"] = ""
        await update_wrapper(hass)

    async def handle_update_item_details(call):
        orig, nn, nd = call.data.get("original_name"), call.data.get("new_name"), call.data.get("new_date")
        parts = hass.data[DOMAIN]["current_path"]
        depth = len(parts)
        
        def db_u():
            conn = get_db_connection(hass); c = conn.cursor()
            sql_where = ""; params = []
            for i, p in enumerate(parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)
            
            check_sql = f"SELECT count(*) FROM items WHERE level_{depth+1} = ? {sql_where}"
            c.execute(check_sql, (orig, *params))
            count = c.fetchone()[0]
            
            if count > 0:
                update_sql = f"UPDATE items SET level_{depth+1} = ? WHERE level_{depth+1} = ? {sql_where}"
                c.execute(update_sql, (nn, orig, *params))
                c.execute(f"UPDATE items SET name = ? WHERE name = ? AND type='folder_marker' {sql_where}", (f"[Folder] {nn}", f"[Folder] {orig}", *params))
            else:
                c.execute(f"UPDATE items SET name = ?, item_date = ? WHERE name = ? {sql_where} AND (level_{depth+1} IS NULL OR level_{depth+1} = '')", (nn, nd, orig, *params))
            
            conn.commit(); conn.close()
            
        await hass.async_add_executor_job(db_u); await update_wrapper(hass)

    async def handle_update_image(call):
        name = call.data.get("item_name"); img_b64 = call.data.get("image_data")
        if "," in img_b64: img_b64 = img_b64.split(",")[1]
        fname = f"{name}_{int(time.time())}.jpg"
        pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)
        def save():
            open(hass.config.path("www", IMG_DIR, fname), "wb").write(base64.b64decode(img_b64))
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET image_path = ? WHERE name = ? {sql_p}", (fname, name, *prm)); conn.commit(); conn.close()
        await hass.async_add_executor_job(save); await update_wrapper(hass)

    async def handle_update_qty(call):
        name = call.data.get("item_name"); change = int(call.data.get("change"))
        today = datetime.now().strftime("%Y-%m-%d")
        pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)

        def db_q():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET quantity = MAX(0, quantity + ?), item_date = ? WHERE name = ? {sql_p}", (change, today, name, *prm))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_q); await update_wrapper(hass)

    async def handle_update_stock(call):
        name = call.data.get("item_name"); qty = int(call.data.get("quantity"))
        today = datetime.now().strftime("%Y-%m-%d")
        def db_upd():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET quantity = ?, item_date = ? WHERE name = ?", (qty, today, name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_upd); await update_wrapper(hass)

    async def handle_delete(call):
        name = call.data.get("item_name"); pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)
        def db_del(): 
            conn = get_db_connection(hass); 
            conn.cursor().execute(f"DELETE FROM items WHERE name = ? {sql_p}", (name, *prm))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_del); await update_wrapper(hass)

    async def handle_paste(call):
        target_path = call.data.get("target_path")
        item_name = hass.data[DOMAIN]["clipboard"]
        if not item_name: return
        def db_mv():
            conn = get_db_connection(hass); c = conn.cursor()
            upd = [f"level_{i} = ?" for i in range(1, MAX_LEVELS+1)]
            vals = [target_path[i-1] if i <= len(target_path) else None for i in range(1, MAX_LEVELS+1)]
            c.execute(f"UPDATE items SET {','.join(upd)} WHERE name = ?", (*vals, item_name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_mv)
        hass.data[DOMAIN]["clipboard"] = None
        await update_wrapper(hass)

    async def handle_clipboard(call):
        action = call.data.get("action"); item = call.data.get("item_name")
        hass.data[DOMAIN]["clipboard"] = item if action == "cut" else None
        await update_wrapper(hass)

    async def handle_ai_action(call):
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if not use_ai: return

        mode = call.data.get("mode")
        img_b64 = call.data.get("image_data")
        if not img_b64 or not api_key: return

        if "," in img_b64: img_b64 = img_b64.split(",")[1]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        prompt_text = "Identify this household item. Return ONLY the name in English or Hebrew. 2-3 words max."
        if mode == 'search':
            prompt_text = "Identify this item. Return only 1 keyword for searching."

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt_text},
                    {"inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64
                    }}
                ]
            }]
        }

        try:
            session = async_get_clientsession(hass)
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    json_resp = await resp.json()
                    try:
                        text = json_resp["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if mode == 'identify':
                            hass.data[DOMAIN]["ai_suggestion"] = text
                        elif mode == 'search':
                            hass.data[DOMAIN]["search_query"] = text
                            hass.data[DOMAIN]["shopping_mode"] = False
                        await update_wrapper(hass)
                    except Exception as e:
                        _LOGGER.error(f"Failed to parse AI response: {e}")
                else:
                    _LOGGER.error(f"Gemini API Error {resp.status}")
        except Exception as e:
             _LOGGER.error(f"AI Connection Error: {e}")

    services = [
        ("navigate", handle_navigate),
        ("set_view_context", handle_set_context), ("add_item", handle_add), ("update_image", handle_update_image),
        ("update_stock", handle_update_stock), ("update_qty", handle_update_qty), ("delete_item", handle_delete),
        ("clipboard_action", handle_clipboard), ("paste_item", handle_paste), ("ai_action", handle_ai_action),
        ("update_item_details", handle_update_item_details)
    ]
    for n, h in services:
        hass.services.async_register(DOMAIN, n, h)

    await update_wrapper(hass)
    return True


    )

    await hass.async_add_executor_job(init_db, hass)

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "current_path": [],
        "search_query": "",
        "date_filter": "All",
        "shopping_mode": False,
        "clipboard": None,
        "ai_suggestion": ""
    }

    await register_services(hass, entry)
    await hass.async_add_executor_job(update_view, hass, entry)

    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry):
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.components.frontend.async_remove_panel("organizer")
    return True

async def async_setup_frontend(hass: HomeAssistant):
    src = os.path.join(os.path.dirname(__file__), "frontend", "organizer-panel.js")
    dest_dir = hass.config.path("www", "home_organizer_libs")
    dest = os.path.join(dest_dir, "organizer-panel.js")
    
    if not os.path.exists(dest_dir): 
        await hass.async_add_executor_job(os.makedirs, dest_dir)
        
    if os.path.exists(src): 
        await hass.async_add_executor_job(shutil.copyfile, src, dest)

def get_db_connection(hass):
    return sqlite3.connect(hass.config.path(DB_FILE))

def init_db(hass):
    if not os.path.exists(hass.config.path("www", IMG_DIR)): os.makedirs(hass.config.path("www", IMG_DIR))
    conn = get_db_connection(hass)
    c = conn.cursor()
    cols = ", ".join([f"level_{i} TEXT" for i in range(1, MAX_LEVELS + 1)])
    c.execute(f'''CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT DEFAULT 'item',
        {cols}, item_date TEXT, quantity INTEGER DEFAULT 1, image_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute("PRAGMA table_info(items)")
    existing = [col[1] for col in c.fetchall()]
    if 'image_path' not in existing: c.execute("ALTER TABLE items ADD COLUMN image_path TEXT")
    conn.commit(); conn.close()

def update_view(hass, entry=None):
    state = hass.data[DOMAIN]
    path_parts = state["current_path"]
    query = state["search_query"]
    date_filter = state["date_filter"]
    is_shopping = state["shopping_mode"]
    
    use_ai = True
    if entry:
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
    
    conn = get_db_connection(hass); c = conn.cursor()
    folders = []; items = []; shopping_list = []

    try:
        if is_shopping:
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC")
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict[f"level_{i}"]) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
                img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                shopping_list.append({
                    "name": r_dict['name'], 
                    "qty": 0, 
                    "date": r_dict['item_date'], 
                    "img": img, 
                    "location": " > ".join(fp),
                    "main_location": r_dict.get("level_2", "General"),
                    "sub_location": r_dict.get("level_3", "")
                })

        elif query or date_filter != "All":
            sql = "SELECT * FROM items WHERE 1=1"; params = []
            for i, p in enumerate(path_parts): sql += f" AND level_{i+1} = ?"; params.append(p)

            if query: sql += " AND name LIKE ?"; params.append(f"%{query}%")
            if date_filter == "Week": sql += " AND item_date >= ?"; params.append((datetime.now()-timedelta(days=7)).strftime("%Y-%m-%d"))
            elif date_filter == "Month": sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y-%m") + "%")
            elif date_filter == "Year": sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y") + "%")

            c.execute(sql, tuple(params))
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict[f"level_{i}"]) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
                if r_dict['type'] == 'item':
                    img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                    items.append({"name": r_dict['name'], "type": r_dict['type'], "qty": r_dict['quantity'], "date": r_dict['item_date'], "img": img, "location": " > ".join(fp)})

        else:
            depth = len(path_parts)
            sql_where = ""; params = []
            for i, p in enumerate(path_parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)

            if depth < 2:
                col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
                for r in c.fetchall(): folders.append({"name": r[0]})
                
                sql = f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where} ORDER BY name ASC"
                c.execute(sql, tuple(params))
                col_names = [description[0] for description in c.description]
                for r in c.fetchall():
                     r_dict = dict(zip(col_names, r))
                     img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                     items.append({"name": r_dict['name'], "type": 'item', "qty": r_dict['quantity'], "img": img})
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
                        "name": r_dict['name'], 
                        "type": 'item', 
                        "qty": r_dict['quantity'], 
                        "date": r_dict['item_date'], 
                        "img": img, 
                        "sub_location": subloc
                    })
                
                for s in sublocations: folders.append({"name": s})
                items = fetched_items

    finally: conn.close()

    display = "Shopping List" if is_shopping else ("Search Results" if (query or date_filter != "All") else (" > ".join(path_parts) if path_parts else "Main"))

    hass.states.async_set("sensor.organizer_view", "Active", {
        "path_display": display, "folders": folders, "items": items, "shopping_list": shopping_list,
        "clipboard": state["clipboard"], "ai_suggestion": state.get("ai_suggestion", ""), 
        "app_version": VERSION,
        "use_ai": use_ai,
        "depth": len(path_parts)
    })

async def register_services(hass, entry):
    
    api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
    
    async def update_wrapper(hass):
        await hass.async_add_executor_job(update_view, hass, entry)

    async def handle_set_context(call):
        d = call.data
        if "path" in d: hass.data[DOMAIN]["current_path"] = d["path"]
        if "search_query" in d: hass.data[DOMAIN]["search_query"] = d["search_query"]
        if "date_filter" in d: hass.data[DOMAIN]["date_filter"] = d["date_filter"]
        if "shopping_mode" in d: hass.data[DOMAIN]["shopping_mode"] = d["shopping_mode"]
        hass.data[DOMAIN]["ai_suggestion"] = ""
        await update_wrapper(hass)

    async def handle_navigate(call):
        direction = call.data.get("direction")
        name = call.data.get("name")
        current_path = hass.data[DOMAIN]["current_path"]
        
        if direction == "root":
            hass.data[DOMAIN]["current_path"] = []
        elif direction == "up":
            if current_path:
                current_path.pop()
        elif direction == "down":
            if name:
                current_path.append(name)
        
        hass.data[DOMAIN]["search_query"] = ""
        hass.data[DOMAIN]["shopping_mode"] = False
        await update_wrapper(hass)

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

        parts = hass.data[DOMAIN]["current_path"]
        depth = len(parts)
        cols = ["name", "type", "quantity", "item_date", "image_path"]
        
        if itype == 'folder':
            if depth >= MAX_LEVELS: return
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

        hass.data[DOMAIN]["ai_suggestion"] = ""
        await update_wrapper(hass)

    async def handle_update_item_details(call):
        orig, nn, nd = call.data.get("original_name"), call.data.get("new_name"), call.data.get("new_date")
        parts = hass.data[DOMAIN]["current_path"]
        depth = len(parts)
        
        def db_u():
            conn = get_db_connection(hass); c = conn.cursor()
            sql_where = ""; params = []
            for i, p in enumerate(parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)
            
            check_sql = f"SELECT count(*) FROM items WHERE level_{depth+1} = ? {sql_where}"
            c.execute(check_sql, (orig, *params))
            count = c.fetchone()[0]
            
            if count > 0:
                update_sql = f"UPDATE items SET level_{depth+1} = ? WHERE level_{depth+1} = ? {sql_where}"
                c.execute(update_sql, (nn, orig, *params))
                c.execute(f"UPDATE items SET name = ? WHERE name = ? AND type='folder_marker' {sql_where}", (f"[Folder] {nn}", f"[Folder] {orig}", *params))
            else:
                c.execute(f"UPDATE items SET name = ?, item_date = ? WHERE name = ? {sql_where} AND (level_{depth+1} IS NULL OR level_{depth+1} = '')", (nn, nd, orig, *params))
            
            conn.commit(); conn.close()
            
        await hass.async_add_executor_job(db_u); await update_wrapper(hass)

    async def handle_update_image(call):
        name = call.data.get("item_name"); img_b64 = call.data.get("image_data")
        if "," in img_b64: img_b64 = img_b64.split(",")[1]
        fname = f"{name}_{int(time.time())}.jpg"
        pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)
        def save():
            open(hass.config.path("www", IMG_DIR, fname), "wb").write(base64.b64decode(img_b64))
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET image_path = ? WHERE name = ? {sql_p}", (fname, name, *prm)); conn.commit(); conn.close()
        await hass.async_add_executor_job(save); await update_wrapper(hass)

    async def handle_update_qty(call):
        name = call.data.get("item_name"); change = int(call.data.get("change"))
        today = datetime.now().strftime("%Y-%m-%d")
        pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)

        def db_q():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET quantity = MAX(0, quantity + ?), item_date = ? WHERE name = ? {sql_p}", (change, today, name, *prm))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_q); await update_wrapper(hass)

    async def handle_update_stock(call):
        name = call.data.get("item_name"); qty = int(call.data.get("quantity"))
        today = datetime.now().strftime("%Y-%m-%d")
        def db_upd():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET quantity = ?, item_date = ? WHERE name = ?", (qty, today, name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_upd); await update_wrapper(hass)

    async def handle_delete(call):
        name = call.data.get("item_name"); pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)
        def db_del(): 
            conn = get_db_connection(hass); 
            conn.cursor().execute(f"DELETE FROM items WHERE name = ? {sql_p}", (name, *prm))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_del); await update_wrapper(hass)

    async def handle_paste(call):
        target_path = call.data.get("target_path")
        item_name = hass.data[DOMAIN]["clipboard"]
        if not item_name: return
        def db_mv():
            conn = get_db_connection(hass); c = conn.cursor()
            upd = [f"level_{i} = ?" for i in range(1, MAX_LEVELS+1)]
            vals = [target_path[i-1] if i <= len(target_path) else None for i in range(1, MAX_LEVELS+1)]
            c.execute(f"UPDATE items SET {','.join(upd)} WHERE name = ?", (*vals, item_name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_mv)
        hass.data[DOMAIN]["clipboard"] = None
        await update_wrapper(hass)

    async def handle_clipboard(call):
        action = call.data.get("action"); item = call.data.get("item_name")
        hass.data[DOMAIN]["clipboard"] = item if action == "cut" else None
        await update_wrapper(hass)

    async def handle_ai_action(call):
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if not use_ai: return

        mode = call.data.get("mode")
        img_b64 = call.data.get("image_data")
        if not img_b64 or not api_key: return

        if "," in img_b64: img_b64 = img_b64.split(",")[1]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        prompt_text = "Identify this household item. Return ONLY the name in English or Hebrew. 2-3 words max."
        if mode == 'search':
            prompt_text = "Identify this item. Return only 1 keyword for searching."

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt_text},
                    {"inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64
                    }}
                ]
            }]
        }

        try:
            session = async_get_clientsession(hass)
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    json_resp = await resp.json()
                    try:
                        text = json_resp["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if mode == 'identify':
                            hass.data[DOMAIN]["ai_suggestion"] = text
                        elif mode == 'search':
                            hass.data[DOMAIN]["search_query"] = text
                            hass.data[DOMAIN]["shopping_mode"] = False
                        await update_wrapper(hass)
                    except Exception as e:
                        _LOGGER.error(f"Failed to parse AI response: {e}")
                else:
                    _LOGGER.error(f"Gemini API Error {resp.status}")
        except Exception as e:
             _LOGGER.error(f"AI Connection Error: {e}")

    services = [
        ("navigate", handle_navigate),
        ("set_view_context", handle_set_context), ("add_item", handle_add), ("update_image", handle_update_image),
        ("update_stock", handle_update_stock), ("update_qty", handle_update_qty), ("delete_item", handle_delete),
        ("clipboard_action", handle_clipboard), ("paste_item", handle_paste), ("ai_action", handle_ai_action),
        ("update_item_details", handle_update_item_details)
    ]
    for n, h in services:
        hass.services.async_register(DOMAIN, n, h)

    await update_wrapper(hass)
    return True


        sidebar_title="ארגונית",
        sidebar_icon="mdi:package-variant-closed",
        require_admin=False
    )

    await hass.async_add_executor_job(init_db, hass)

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "current_path": [],
        "search_query": "",
        "date_filter": "All",
        "shopping_mode": False,
        "clipboard": None,
        "ai_suggestion": ""
    }

    await register_services(hass, entry)
    await hass.async_add_executor_job(update_view, hass, entry)

    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry):
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.components.frontend.async_remove_panel("organizer")
    return True

async def async_setup_frontend(hass: HomeAssistant):
    # Ensure source exists
    src = os.path.join(os.path.dirname(__file__), "frontend", "organizer-panel.js")
    dest_dir = hass.config.path("www", "home_organizer_libs")
    dest = os.path.join(dest_dir, "organizer-panel.js")
    
    if not os.path.exists(dest_dir): 
        await hass.async_add_executor_job(os.makedirs, dest_dir)
        
    if os.path.exists(src): 
        await hass.async_add_executor_job(shutil.copyfile, src, dest)

def get_db_connection(hass):
    return sqlite3.connect(hass.config.path(DB_FILE))

def init_db(hass):
    if not os.path.exists(hass.config.path("www", IMG_DIR)): os.makedirs(hass.config.path("www", IMG_DIR))
    conn = get_db_connection(hass)
    c = conn.cursor()
    cols = ", ".join([f"level_{i} TEXT" for i in range(1, MAX_LEVELS + 1)])
    c.execute(f'''CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT DEFAULT 'item',
        {cols}, item_date TEXT, quantity INTEGER DEFAULT 1, image_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute("PRAGMA table_info(items)")
    existing = [col[1] for col in c.fetchall()]
    if 'image_path' not in existing: c.execute("ALTER TABLE items ADD COLUMN image_path TEXT")
    conn.commit(); conn.close()

def update_view(hass, entry=None):
    state = hass.data[DOMAIN]
    path_parts = state["current_path"]
    query = state["search_query"]
    date_filter = state["date_filter"]
    is_shopping = state["shopping_mode"]
    
    use_ai = True
    if entry:
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
    
    conn = get_db_connection(hass); c = conn.cursor()
    folders = []; items = []; shopping_list = []

    try:
        if is_shopping:
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC")
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict[f"level_{i}"]) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
                img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                shopping_list.append({
                    "name": r_dict['name'], 
                    "qty": 0, 
                    "date": r_dict['item_date'], 
                    "img": img, 
                    "location": " > ".join(fp),
                    "main_location": r_dict.get("level_2", "General"),
                    "sub_location": r_dict.get("level_3", "")
                })

        elif query or date_filter != "All":
            sql = "SELECT * FROM items WHERE 1=1"; params = []
            for i, p in enumerate(path_parts): sql += f" AND level_{i+1} = ?"; params.append(p)

            if query: sql += " AND name LIKE ?"; params.append(f"%{query}%")
            if date_filter == "Week": sql += " AND item_date >= ?"; params.append((datetime.now()-timedelta(days=7)).strftime("%Y-%m-%d"))
            elif date_filter == "Month": sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y-%m") + "%")
            elif date_filter == "Year": sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y") + "%")

            c.execute(sql, tuple(params))
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict[f"level_{i}"]) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
                if r_dict['type'] == 'item':
                    img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                    items.append({"name": r_dict['name'], "type": r_dict['type'], "qty": r_dict['quantity'], "date": r_dict['item_date'], "img": img, "location": " > ".join(fp)})

        else:
            depth = len(path_parts)
            sql_where = ""; params = []
            for i, p in enumerate(path_parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)

            if depth < 2:
                col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
                for r in c.fetchall(): folders.append({"name": r[0]})
                
                sql = f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where} ORDER BY name ASC"
                c.execute(sql, tuple(params))
                col_names = [description[0] for description in c.description]
                for r in c.fetchall():
                     r_dict = dict(zip(col_names, r))
                     img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                     items.append({"name": r_dict['name'], "type": 'item', "qty": r_dict['quantity'], "img": img})
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
                        "name": r_dict['name'], 
                        "type": 'item', 
                        "qty": r_dict['quantity'], 
                        "date": r_dict['item_date'], 
                        "img": img, 
                        "sub_location": subloc
                    })
                
                for s in sublocations: folders.append({"name": s})
                items = fetched_items

    finally: conn.close()

    display = "Shopping List" if is_shopping else ("Search Results" if (query or date_filter != "All") else (" > ".join(path_parts) if path_parts else "Main"))

    hass.states.async_set("sensor.organizer_view", "Active", {
        "path_display": display, "folders": folders, "items": items, "shopping_list": shopping_list,
        "clipboard": state["clipboard"], "ai_suggestion": state.get("ai_suggestion", ""), 
        "app_version": VERSION,
        "use_ai": use_ai,
        "depth": len(path_parts)
    })

async def register_services(hass, entry):
    
    api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
    
    async def update_wrapper(hass):
        await hass.async_add_executor_job(update_view, hass, entry)

    async def handle_set_context(call):
        d = call.data
        if "path" in d: hass.data[DOMAIN]["current_path"] = d["path"]
        if "search_query" in d: hass.data[DOMAIN]["search_query"] = d["search_query"]
        if "date_filter" in d: hass.data[DOMAIN]["date_filter"] = d["date_filter"]
        if "shopping_mode" in d: hass.data[DOMAIN]["shopping_mode"] = d["shopping_mode"]
        hass.data[DOMAIN]["ai_suggestion"] = ""
        await update_wrapper(hass)

    async def handle_navigate(call):
        direction = call.data.get("direction")
        name = call.data.get("name")
        current_path = hass.data[DOMAIN]["current_path"]
        
        if direction == "root":
            hass.data[DOMAIN]["current_path"] = []
        elif direction == "up":
            if current_path:
                current_path.pop()
        elif direction == "down":
            if name:
                current_path.append(name)
        
        hass.data[DOMAIN]["search_query"] = ""
        hass.data[DOMAIN]["shopping_mode"] = False
        await update_wrapper(hass)

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

        parts = hass.data[DOMAIN]["current_path"]
        depth = len(parts)
        cols = ["name", "type", "quantity", "item_date", "image_path"]
        
        if itype == 'folder':
            if depth >= MAX_LEVELS: return
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

        hass.data[DOMAIN]["ai_suggestion"] = ""
        await update_wrapper(hass)

    async def handle_update_item_details(call):
        orig, nn, nd = call.data.get("original_name"), call.data.get("new_name"), call.data.get("new_date")
        parts = hass.data[DOMAIN]["current_path"]
        depth = len(parts)
        
        def db_u():
            conn = get_db_connection(hass); c = conn.cursor()
            sql_where = ""; params = []
            for i, p in enumerate(parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)
            
            check_sql = f"SELECT count(*) FROM items WHERE level_{depth+1} = ? {sql_where}"
            c.execute(check_sql, (orig, *params))
            count = c.fetchone()[0]
            
            if count > 0:
                update_sql = f"UPDATE items SET level_{depth+1} = ? WHERE level_{depth+1} = ? {sql_where}"
                c.execute(update_sql, (nn, orig, *params))
                c.execute(f"UPDATE items SET name = ? WHERE name = ? AND type='folder_marker' {sql_where}", (f"[Folder] {nn}", f"[Folder] {orig}", *params))
            else:
                c.execute(f"UPDATE items SET name = ?, item_date = ? WHERE name = ? {sql_where} AND (level_{depth+1} IS NULL OR level_{depth+1} = '')", (nn, nd, orig, *params))
            
            conn.commit(); conn.close()
            
        await hass.async_add_executor_job(db_u); await update_wrapper(hass)

    async def handle_update_image(call):
        name = call.data.get("item_name"); img_b64 = call.data.get("image_data")
        if "," in img_b64: img_b64 = img_b64.split(",")[1]
        fname = f"{name}_{int(time.time())}.jpg"
        pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)
        def save():
            open(hass.config.path("www", IMG_DIR, fname), "wb").write(base64.b64decode(img_b64))
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET image_path = ? WHERE name = ? {sql_p}", (fname, name, *prm)); conn.commit(); conn.close()
        await hass.async_add_executor_job(save); await update_wrapper(hass)

    async def handle_update_qty(call):
        name = call.data.get("item_name"); change = int(call.data.get("change"))
        today = datetime.now().strftime("%Y-%m-%d")
        pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)

        def db_q():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET quantity = MAX(0, quantity + ?), item_date = ? WHERE name = ? {sql_p}", (change, today, name, *prm))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_q); await update_wrapper(hass)

    async def handle_update_stock(call):
        name = call.data.get("item_name"); qty = int(call.data.get("quantity"))
        today = datetime.now().strftime("%Y-%m-%d")
        def db_upd():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET quantity = ?, item_date = ? WHERE name = ?", (qty, today, name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_upd); await update_wrapper(hass)

    async def handle_delete(call):
        name = call.data.get("item_name"); pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)
        def db_del(): 
            conn = get_db_connection(hass); 
            conn.cursor().execute(f"DELETE FROM items WHERE name = ? {sql_p}", (name, *prm))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_del); await update_wrapper(hass)

    async def handle_paste(call):
        target_path = call.data.get("target_path")
        item_name = hass.data[DOMAIN]["clipboard"]
        if not item_name: return
        def db_mv():
            conn = get_db_connection(hass); c = conn.cursor()
            upd = [f"level_{i} = ?" for i in range(1, MAX_LEVELS+1)]
            vals = [target_path[i-1] if i <= len(target_path) else None for i in range(1, MAX_LEVELS+1)]
            c.execute(f"UPDATE items SET {','.join(upd)} WHERE name = ?", (*vals, item_name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_mv)
        hass.data[DOMAIN]["clipboard"] = None
        await update_wrapper(hass)

    async def handle_clipboard(call):
        action = call.data.get("action"); item = call.data.get("item_name")
        hass.data[DOMAIN]["clipboard"] = item if action == "cut" else None
        await update_wrapper(hass)

    async def handle_ai_action(call):
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if not use_ai: return

        mode = call.data.get("mode")
        img_b64 = call.data.get("image_data")
        if not img_b64 or not api_key: return

        if "," in img_b64: img_b64 = img_b64.split(",")[1]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        prompt_text = "Identify this household item. Return ONLY the name in English or Hebrew. 2-3 words max."
        if mode == 'search':
            prompt_text = "Identify this item. Return only 1 keyword for searching."

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt_text},
                    {"inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64
                    }}
                ]
            }]
        }

        try:
            session = async_get_clientsession(hass)
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    json_resp = await resp.json()
                    try:
                        text = json_resp["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if mode == 'identify':
                            hass.data[DOMAIN]["ai_suggestion"] = text
                        elif mode == 'search':
                            hass.data[DOMAIN]["search_query"] = text
                            hass.data[DOMAIN]["shopping_mode"] = False
                        await update_wrapper(hass)
                    except Exception as e:
                        _LOGGER.error(f"Failed to parse AI response: {e}")
                else:
                    _LOGGER.error(f"Gemini API Error {resp.status}")
        except Exception as e:
             _LOGGER.error(f"AI Connection Error: {e}")

    services = [
        ("navigate", handle_navigate),
        ("set_view_context", handle_set_context), ("add_item", handle_add), ("update_image", handle_update_image),
        ("update_stock", handle_update_stock), ("update_qty", handle_update_qty), ("delete_item", handle_delete),
        ("clipboard_action", handle_clipboard), ("paste_item", handle_paste), ("ai_action", handle_ai_action),
        ("update_item_details", handle_update_item_details)
    ]
    for n, h in services:
        hass.services.async_register(DOMAIN, n, h)

    await update_wrapper(hass)
    return True


    )

    await hass.async_add_executor_job(init_db, hass)

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "current_path": [],
        "search_query": "",
        "date_filter": "All",
        "shopping_mode": False,
        "clipboard": None,
        "ai_suggestion": ""
    }

    await register_services(hass, entry)
    await hass.async_add_executor_job(update_view, hass, entry)

    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry):
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.components.frontend.async_remove_panel("organizer")
    return True

async def async_setup_frontend(hass: HomeAssistant):
    src = os.path.join(os.path.dirname(__file__), "frontend", "organizer-panel.js")
    dest_dir = hass.config.path("www", "home_organizer_libs")
    dest = os.path.join(dest_dir, "organizer-panel.js")
    if not os.path.exists(dest_dir): await hass.async_add_executor_job(os.makedirs, dest_dir)
    if os.path.exists(src): await hass.async_add_executor_job(shutil.copyfile, src, dest)

def get_db_connection(hass):
    return sqlite3.connect(hass.config.path(DB_FILE))

def init_db(hass):
    if not os.path.exists(hass.config.path("www", IMG_DIR)): os.makedirs(hass.config.path("www", IMG_DIR))
    conn = get_db_connection(hass)
    c = conn.cursor()
    cols = ", ".join([f"level_{i} TEXT" for i in range(1, MAX_LEVELS + 1)])
    c.execute(f'''CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT DEFAULT 'item',
        {cols}, item_date TEXT, quantity INTEGER DEFAULT 1, image_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute("PRAGMA table_info(items)")
    existing = [col[1] for col in c.fetchall()]
    if 'image_path' not in existing: c.execute("ALTER TABLE items ADD COLUMN image_path TEXT")
    conn.commit(); conn.close()

def update_view(hass, entry=None):
    state = hass.data[DOMAIN]
    path_parts = state["current_path"]
    query = state["search_query"]
    date_filter = state["date_filter"]
    is_shopping = state["shopping_mode"]
    
    use_ai = True
    if entry:
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
    
    conn = get_db_connection(hass); c = conn.cursor()
    folders = []; items = []; shopping_list = []

    try:
        if is_shopping:
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC")
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict[f"level_{i}"]) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
                img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                shopping_list.append({
                    "name": r_dict['name'], 
                    "qty": 0, 
                    "date": r_dict['item_date'], 
                    "img": img, 
                    "location": " > ".join(fp),
                    "main_location": r_dict.get("level_2", "General"),
                    "sub_location": r_dict.get("level_3", "")
                })

        elif query or date_filter != "All":
            sql = "SELECT * FROM items WHERE 1=1"; params = []
            for i, p in enumerate(path_parts): sql += f" AND level_{i+1} = ?"; params.append(p)

            if query: sql += " AND name LIKE ?"; params.append(f"%{query}%")
            if date_filter == "Week": sql += " AND item_date >= ?"; params.append((datetime.now()-timedelta(days=7)).strftime("%Y-%m-%d"))
            elif date_filter == "Month": sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y-%m") + "%")
            elif date_filter == "Year": sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y") + "%")

            c.execute(sql, tuple(params))
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict[f"level_{i}"]) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
                if r_dict['type'] == 'item':
                    img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                    items.append({"name": r_dict['name'], "type": r_dict['type'], "qty": r_dict['quantity'], "date": r_dict['item_date'], "img": img, "location": " > ".join(fp)})

        else:
            depth = len(path_parts)
            sql_where = ""; params = []
            for i, p in enumerate(path_parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)

            if depth < 2:
                col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
                for r in c.fetchall(): folders.append({"name": r[0]})
                
                sql = f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where} ORDER BY name ASC"
                c.execute(sql, tuple(params))
                col_names = [description[0] for description in c.description]
                for r in c.fetchall():
                     r_dict = dict(zip(col_names, r))
                     img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                     items.append({"name": r_dict['name'], "type": 'item', "qty": r_dict['quantity'], "img": img})
            else:
                # LIST MODE (Inside Main Location)
                # Fetch distinct Sublocations (Level 3) for headers
                # We need a list of sublocations to display empty ones too if we just created them
                sublocations = []
                col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
                for r in c.fetchall(): sublocations.append(r[0])

                sql = f"SELECT * FROM items WHERE type='item' {sql_where} ORDER BY level_{depth+1} ASC, name ASC"
                c.execute(sql, tuple(params))
                col_names = [description[0] for description in c.description]
                
                # We map items to sublocations
                # We also need to return the list of sublocations so the frontend can render empty sections
                
                fetched_items = []
                for r in c.fetchall():
                    r_dict = dict(zip(col_names, r))
                    img = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                    subloc = r_dict.get(f"level_{depth+1}", "")
                    fetched_items.append({
                        "name": r_dict['name'], 
                        "type": 'item', 
                        "qty": r_dict['quantity'], 
                        "date": r_dict['item_date'], 
                        "img": img, 
                        "sub_location": subloc
                    })
                
                # Add sublocations list to the response so we know they exist even if empty
                # We reuse 'folders' array for this purpose
                for s in sublocations: folders.append({"name": s})
                items = fetched_items

    finally: conn.close()

    display = "Shopping List" if is_shopping else ("Search Results" if (query or date_filter != "All") else (" > ".join(path_parts) if path_parts else "Main"))

    hass.states.async_set("sensor.organizer_view", "Active", {
        "path_display": display, "folders": folders, "items": items, "shopping_list": shopping_list,
        "clipboard": state["clipboard"], "ai_suggestion": state.get("ai_suggestion", ""), 
        "app_version": VERSION,
        "use_ai": use_ai,
        "depth": len(path_parts)
    })

async def register_services(hass, entry):
    
    api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
    
    async def update_wrapper(hass):
        await hass.async_add_executor_job(update_view, hass, entry)

    async def handle_set_context(call):
        d = call.data
        if "path" in d: hass.data[DOMAIN]["current_path"] = d["path"]
        if "search_query" in d: hass.data[DOMAIN]["search_query"] = d["search_query"]
        if "date_filter" in d: hass.data[DOMAIN]["date_filter"] = d["date_filter"]
        if "shopping_mode" in d: hass.data[DOMAIN]["shopping_mode"] = d["shopping_mode"]
        hass.data[DOMAIN]["ai_suggestion"] = ""
        await update_wrapper(hass)

    async def handle_navigate(call):
        direction = call.data.get("direction")
        name = call.data.get("name")
        current_path = hass.data[DOMAIN]["current_path"]
        
        if direction == "root":
            hass.data[DOMAIN]["current_path"] = []
        elif direction == "up":
            if current_path:
                current_path.pop()
        elif direction == "down":
            if name:
                current_path.append(name)
        
        hass.data[DOMAIN]["search_query"] = ""
        hass.data[DOMAIN]["shopping_mode"] = False
        await update_wrapper(hass)

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

        parts = hass.data[DOMAIN]["current_path"]
        depth = len(parts)
        cols = ["name", "type", "quantity", "item_date", "image_path"]
        
        # FIX: Allow adding folder (Sublocation) even at depth 2
        if itype == 'folder':
            if depth >= MAX_LEVELS: return
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
            # FIX: If we are adding an item, and the user provided a "Sublocation" via the UI (not implemented yet in UI but prepared here)
            # For now, default add to current path.
            # However, if we are in Main Location (Depth 2), items are usually added to "General" unless assigned.
            
            vals = [name, itype, 1, date, fname]
            qs = ["?", "?", "?", "?", "?"]
            for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")

            def db_ins():
                conn = get_db_connection(hass); c = conn.cursor()
                c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
                conn.commit(); conn.close()
            await hass.async_add_executor_job(db_ins)

        hass.data[DOMAIN]["ai_suggestion"] = ""
        await update_wrapper(hass)

    async def handle_update_item_details(call):
        orig, nn, nd = call.data.get("original_name"), call.data.get("new_name"), call.data.get("new_date")
        
        # Check if we are renaming a Sublocation (Header)
        # We detect this if 'original_name' matches a sublocation name in the current context
        # Ideally we'd have a separate service 'rename_folder', but let's overload this one intelligently.
        
        parts = hass.data[DOMAIN]["current_path"]
        depth = len(parts)
        
        def db_u():
            conn = get_db_connection(hass); c = conn.cursor()
            
            # Construct Where Clause for current path
            sql_where = ""; params = []
            for i, p in enumerate(parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)
            
            # 1. Try renaming a FOLDER/SUBLOCATION at this level
            # We check if there are items where level_{depth+1} == original_name
            check_sql = f"SELECT count(*) FROM items WHERE level_{depth+1} = ? {sql_where}"
            c.execute(check_sql, (orig, *params))
            count = c.fetchone()[0]
            
            if count > 0:
                # It is a folder/sublocation! Update the LEVEL column for all items.
                update_sql = f"UPDATE items SET level_{depth+1} = ? WHERE level_{depth+1} = ? {sql_where}"
                c.execute(update_sql, (nn, orig, *params))
                
                # Also update the marker item name if it exists
                c.execute(f"UPDATE items SET name = ? WHERE name = ? AND type='folder_marker' {sql_where}", (f"[Folder] {nn}", f"[Folder] {orig}", *params))
                
            else:
                # It is a regular item
                c.execute(f"UPDATE items SET name = ?, item_date = ? WHERE name = ? {sql_where} AND (level_{depth+1} IS NULL OR level_{depth+1} = '')", (nn, nd, orig, *params))
            
            conn.commit(); conn.close()
            
        await hass.async_add_executor_job(db_u); await update_wrapper(hass)

    async def handle_update_image(call):
        name = call.data.get("item_name"); img_b64 = call.data.get("image_data")
        if "," in img_b64: img_b64 = img_b64.split(",")[1]
        fname = f"{name}_{int(time.time())}.jpg"
        pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)
        def save():
            open(hass.config.path("www", IMG_DIR, fname), "wb").write(base64.b64decode(img_b64))
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET image_path = ? WHERE name = ? {sql_p}", (fname, name, *prm)); conn.commit(); conn.close()
        await hass.async_add_executor_job(save); await update_wrapper(hass)

    async def handle_update_qty(call):
        name = call.data.get("item_name"); change = int(call.data.get("change"))
        today = datetime.now().strftime("%Y-%m-%d")
        pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)

        def db_q():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET quantity = MAX(0, quantity + ?), item_date = ? WHERE name = ? {sql_p}", (change, today, name, *prm))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_q); await update_wrapper(hass)

    async def handle_update_stock(call):
        name = call.data.get("item_name"); qty = int(call.data.get("quantity"))
        today = datetime.now().strftime("%Y-%m-%d")
        def db_upd():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET quantity = ?, item_date = ? WHERE name = ?", (qty, today, name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_upd); await update_wrapper(hass)

    async def handle_delete(call):
        name = call.data.get("item_name"); pp = hass.data[DOMAIN]["current_path"]; sql_p = ""; prm = []
        for i, p in enumerate(pp): sql_p += f" AND level_{i+1} = ?"; prm.append(p)
        def db_del(): 
            conn = get_db_connection(hass); 
            conn.cursor().execute(f"DELETE FROM items WHERE name = ? {sql_p}", (name, *prm))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_del); await update_wrapper(hass)

    async def handle_paste(call):
        target_path = call.data.get("target_path")
        item_name = hass.data[DOMAIN]["clipboard"]
        if not item_name: return
        def db_mv():
            conn = get_db_connection(hass); c = conn.cursor()
            upd = [f"level_{i} = ?" for i in range(1, MAX_LEVELS+1)]
            vals = [target_path[i-1] if i <= len(target_path) else None for i in range(1, MAX_LEVELS+1)]
            c.execute(f"UPDATE items SET {','.join(upd)} WHERE name = ?", (*vals, item_name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_mv)
        hass.data[DOMAIN]["clipboard"] = None
        await update_wrapper(hass)

    async def handle_clipboard(call):
        action = call.data.get("action"); item = call.data.get("item_name")
        hass.data[DOMAIN]["clipboard"] = item if action == "cut" else None
        await update_wrapper(hass)

    async def handle_ai_action(call):
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if not use_ai: return

        mode = call.data.get("mode")
        img_b64 = call.data.get("image_data")
        if not img_b64 or not api_key: return

        if "," in img_b64: img_b64 = img_b64.split(",")[1]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        prompt_text = "Identify this household item. Return ONLY the name in English or Hebrew. 2-3 words max."
        if mode == 'search':
            prompt_text = "Identify this item. Return only 1 keyword for searching."

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt_text},
                    {"inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64
                    }}
                ]
            }]
        }

        try:
            session = async_get_clientsession(hass)
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    json_resp = await resp.json()
                    try:
                        text = json_resp["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if mode == 'identify':
                            hass.data[DOMAIN]["ai_suggestion"] = text
                        elif mode == 'search':
                            hass.data[DOMAIN]["search_query"] = text
                            hass.data[DOMAIN]["shopping_mode"] = False
                        await update_wrapper(hass)
                    except Exception as e:
                        _LOGGER.error(f"Failed to parse AI response: {e}")
                else:
                    _LOGGER.error(f"Gemini API Error {resp.status}")
        except Exception as e:
             _LOGGER.error(f"AI Connection Error: {e}")

    services = [
        ("navigate", handle_navigate),
        ("set_view_context", handle_set_context), ("add_item", handle_add), ("update_image", handle_update_image),
        ("update_stock", handle_update_stock), ("update_qty", handle_update_qty), ("delete_item", handle_delete),
        ("clipboard_action", handle_clipboard), ("paste_item", handle_paste), ("ai_action", handle_ai_action),
        ("update_item_details", handle_update_item_details)
    ]
    for n, h in services:
        hass.services.async_register(DOMAIN, n, h)

    await update_wrapper(hass)
    return True
