# -*- coding: utf-8 -*-
# Home Organizer Ultimate - ver 6.2.2 (Added Autocomplete & Image Ref Update)

import logging
import sqlite3
import os
import base64
import time
import json
import voluptuous as vol
from datetime import datetime, timedelta
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig 
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from .const import DOMAIN, CONF_API_KEY, CONF_DEBUG, CONF_USE_AI, DB_FILE, IMG_DIR, VERSION

_LOGGER = logging.getLogger(__name__)
MAX_LEVELS = 10

WS_GET_DATA = "home_organizer/get_data"
WS_GET_ALL_ITEMS = "home_organizer/get_all_items" # New Command

# Define the URL prefix for your frontend files
STATIC_PATH_URL = "/home_organizer_static"

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if entry.options.get(CONF_DEBUG): _LOGGER.setLevel(logging.DEBUG)

    # 1. REGISTER STATIC PATH
    frontend_folder = os.path.join(os.path.dirname(__file__), "frontend")
    
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            url_path=STATIC_PATH_URL,
            path=frontend_folder,
            cache_headers=False 
        )
    ])

    # 2. REGISTER PANEL
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="home-organizer-panel",
        frontend_url_path="organizer",
        module_url=f"{STATIC_PATH_URL}/organizer-panel.js?v={int(time.time())}",
        sidebar_title="ארגונית",
        sidebar_icon="mdi:package-variant-closed",
        require_admin=False
    )

    await hass.async_add_executor_job(init_db, hass)

    hass.data.setdefault(DOMAIN, {})
    
    # Register Websockets
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
        # NEW: Register command to get all items for autocomplete
        websocket_api.async_register_command(
            hass,
            WS_GET_ALL_ITEMS,
            websocket_get_all_items,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("type"): WS_GET_ALL_ITEMS
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
    hass.components.frontend.async_remove_panel("organizer")
    return True

def get_db_connection(hass):
    return sqlite3.connect(hass.config.path(DB_FILE))

def init_db(hass):
    if not os.path.exists(hass.config.path("www", IMG_DIR)): os.makedirs(hass.config.path("www", IMG_DIR))
    conn = get_db_connection(hass)
    c = conn.cursor()
    cols = ", ".join([f"level_{i} TEXT" for i in range(1, MAX_LEVELS + 1)])
    
    # Create table with new category columns and unit_value
    c.execute(f'''CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT DEFAULT 'item',
        {cols}, item_date TEXT, quantity INTEGER DEFAULT 1, image_path TEXT,
        category TEXT, sub_category TEXT, unit TEXT, unit_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    c.execute("PRAGMA table_info(items)")
    existing_cols = [col[1] for col in c.fetchall()]
    
    # Migration checks
    if 'image_path' not in existing_cols:
        try: c.execute("ALTER TABLE items ADD COLUMN image_path TEXT")
        except: pass

    for new_col in ['category', 'sub_category', 'unit', 'unit_value']:
        if new_col not in existing_cols:
            try: c.execute(f"ALTER TABLE items ADD COLUMN {new_col} TEXT")
            except: pass
        
    for i in range(1, MAX_LEVELS + 1):
        col_name = f"level_{i}"
        if col_name not in existing_cols:
            try: c.execute(f"ALTER TABLE items ADD COLUMN {col_name} TEXT")
            except: pass

    conn.commit(); conn.close()

@callback
def websocket_get_data(hass, connection, msg):
    path = msg.get("path", [])
    query = msg.get("search_query", "")
    date_filter = msg.get("date_filter", "All")
    is_shopping = msg.get("shopping_mode", False)
    data = get_view_data(hass, path, query, date_filter, is_shopping)
    connection.send_result(msg["id"], data)

# NEW: Handler for fetching all unique items for autocomplete
@callback
def websocket_get_all_items(hass, connection, msg):
    conn = get_db_connection(hass)
    c = conn.cursor()
    try:
        # Get unique names with their most common/recent properties
        c.execute("SELECT name, category, sub_category, unit, unit_value, image_path FROM items WHERE type='item' GROUP BY name")
        col_names = [description[0] for description in c.description]
        results = []
        for r in c.fetchall():
            item = dict(zip(col_names, r))
            # Format image path for frontend
            if item['image_path']:
                item['image_path'] = f"/local/{IMG_DIR}/{item['image_path']}?v={int(time.time())}"
            results.append(item)
        connection.send_result(msg["id"], results)
    finally:
        conn.close()

def get_view_data(hass, path_parts, query, date_filter, is_shopping):
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
                fp = []; [fp.append(r_dict.get(f"level_{i}", "")) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
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
                fp = []; [fp.append(r_dict.get(f"level_{i}", "")) for i in range(1, MAX_LEVELS+1) if r_dict.get(f"level_{i}")]
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
                # 1. Fetch Folders
                col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params))
                found_folders = [r[0] for r in c.fetchall()]
                
                # 2. Fetch images for these folders
                for f_name in found_folders:
                    marker_sql = f"SELECT image_path FROM items WHERE type='folder_marker' AND name=? {sql_where} AND {col}=?"
                    marker_params = [f"[Folder] {f_name}"] + params + [f_name]
                    
                    c.execute(marker_sql, tuple(marker_params))
                    row = c.fetchone()
                    img = f"/local/{IMG_DIR}/{row[0]}?v={int(time.time())}" if row and row[0] else None
                    folders.append({"name": f_name, "img": img})
                
                # 3. Fetch Items
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
                # List View Logic
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
        "hierarchy": hierarchy
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
        clipboard = hass.data.get(DOMAIN, {}).get("clipboard") 
        if not clipboard: return
        
        item_id = clipboard.get("id") if isinstance(clipboard, dict) else None
        item_name = clipboard.get("name") if isinstance(clipboard, dict) else clipboard

        def db_mv():
            conn = get_db_connection(hass); c = conn.cursor()
            upd = [f"level_{i} = ?" for i in range(1, MAX_LEVELS+1)]
            vals = [target_path[i-1] if i <= len(target_path) else None for i in range(1, MAX_LEVELS+1)]
            
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
        
        # NEW: Receive image_path to update reference
        image_path = call.data.get("image_path")

        parts = call.data.get("current_path", [])
        is_folder = call.data.get("is_folder", False)

        def db_u():
            conn = get_db_connection(hass); c = conn.cursor()
            
            if is_folder:
                depth = len(parts)
                if depth < MAX_LEVELS:
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
                if image_path is not None: updates.append("image_path = ?"); params.append(image_path) # Added
                
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
        if "," in img_b64: img_b64 = img_b64.split(",")[1]
        fname = f"{name}_{int(time.time())}.jpg"
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
        if not img_b64 or not api_key: return
        if "," in img_b64: img_b64 = img_b64.split(",")[1]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        prompt_text = "Identify this household item. Return ONLY the name in English or Hebrew. 2-3 words max."
        if mode == 'search': prompt_text = "Identify this item. Return only 1 keyword for searching."

        payload = {"contents": [{"parts": [{"text": prompt_text}, {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}}]}]}

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
