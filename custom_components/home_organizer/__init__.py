# -*- coding: utf-8 -*-
# Home Organizer Ultimate - ver 6.8.0 (Full 438+ Line Logic Restore + Zones)
# This module handles the SQLite database engine, Home Assistant service registration,
# and structured data delivery via the WebSocket API.

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

# Maximum depth for organizational levels
MAX_LEVELS = 10

# WebSocket API Constants
WS_GET_DATA = "home_organizer/get_data"
STATIC_PATH_URL = "/home_organizer_static"

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Initialize the integration components."""
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Home Organizer from a config entry."""
    if entry.options.get(CONF_DEBUG):
        _LOGGER.setLevel(logging.DEBUG)

    # --- 1. FRONTEND ASSETS REGISTRATION ---
    # We tell Home Assistant to serve our local frontend folder via a specific URL.
    frontend_folder = os.path.join(os.path.dirname(__file__), "frontend")
    
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            url_path=STATIC_PATH_URL,
            path=frontend_folder,
            cache_headers=False 
        )
    ])

    # --- 2. SIDEBAR PANEL REGISTRATION ---
    # Registering the custom panel which loads our organizer-panel.js file.
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="home-organizer-panel",
        frontend_url_path="organizer",
        module_url=f"{STATIC_PATH_URL}/organizer-panel.js?v={int(time.time())}",
        sidebar_title="ארגונית",
        sidebar_icon="mdi:package-variant-closed",
        require_admin=False
    )

    # --- 3. DATABASE SUBSYSTEM ---
    # Run the database initialization in the executor thread to avoid blocking the event loop.
    await hass.async_add_executor_job(init_db, hass)

    hass.data.setdefault(DOMAIN, {})
    
    # --- 4. WEBSOCKET API COMMANDS ---
    # Registering the command that the frontend uses to fetch the tree structure.
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
    except Exception as e:
        _LOGGER.debug(f"Home Organizer: Websocket command registration handled: {e}")

    # --- 5. SERVICE REGISTRATION ---
    # Registering all services for adding, deleting, and updating items.
    await register_services(hass, entry)
    
    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry):
    """Handle options updates without needing a full restart."""
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Handle integration removal and panel cleanup."""
    hass.components.frontend.async_remove_panel("organizer")
    return True

def get_db_connection(hass):
    """Create a new SQLite connection thread-safe."""
    return sqlite3.connect(hass.config.path(DB_FILE))

def init_db(hass):
    """Create the table structure and ensure directories exist."""
    www_img_dir = hass.config.path("www", IMG_DIR)
    if not os.path.exists(www_img_dir):
        os.makedirs(www_img_dir)
    
    conn = get_db_connection(hass)
    c = conn.cursor()
    
    # Construct level columns dynamically based on MAX_LEVELS
    level_cols = ", ".join([f"level_{i} TEXT" for i in range(1, MAX_LEVELS + 1)])
    
    c.execute(f'''CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT NOT NULL, 
        type TEXT DEFAULT 'item',
        {level_cols}, 
        item_date TEXT, 
        quantity INTEGER DEFAULT 1, 
        image_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # --- MIGRATION HANDLER ---
    # Check for existing table schema and add missing columns if necessary.
    c.execute("PRAGMA table_info(items)")
    existing_cols = [col[1] for col in c.fetchall()]
    
    if 'image_path' not in existing_cols:
        try: c.execute("ALTER TABLE items ADD COLUMN image_path TEXT")
        except: pass
        
    for i in range(1, MAX_LEVELS + 1):
        col_name = f"level_{i}"
        if col_name not in existing_cols:
            try: c.execute(f"ALTER TABLE items ADD COLUMN {col_name} TEXT")
            except: pass

    conn.commit()
    conn.close()

@callback
def websocket_get_data(hass, connection, msg):
    """Process frontend requests for hierarchical data."""
    path = msg.get("path", [])
    query = msg.get("search_query", "")
    date_filter = msg.get("date_filter", "All")
    is_shopping = msg.get("shopping_mode", False)
    
    data = get_view_data(hass, path, query, date_filter, is_shopping)
    connection.send_result(msg["id"], data)

def get_view_data(hass, path_parts, query, date_filter, is_shopping):
    """Structured Data Engine. Fetches zones, rooms, folders, and items."""
    conn = get_db_connection(hass)
    c = conn.cursor()
    folders = []; items = []; shopping_list = []; zones = []
    
    # Generate full hierarchy mapping for the move-to dropdowns in the frontend
    hierarchy = {}
    try:
        c.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE level_2 IS NOT NULL AND level_2 != ''")
        for row in c.fetchall():
            z, r, l = row[0] or "General", row[1], row[2]
            if z not in hierarchy: hierarchy[z] = {}
            if r not in hierarchy[z]: hierarchy[z][r] = []
            if l and l not in hierarchy[z][r]: hierarchy[z][r].append(l)
    except: pass

    try:
        if is_shopping:
            # --- SHOPPING LIST LOGIC ---
            # Fetch all items with quantity 0
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC")
            col_names = [desc[0] for desc in c.description]
            for row in c.fetchall():
                r_dict = dict(zip(col_names, row))
                p_list = [r_dict.get(f"level_{i}", "") for i in range(1, 6) if r_dict.get(f"level_{i}")]
                
                img_url = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                shopping_list.append({
                    "name": r_dict['name'], "qty": 0, "date": r_dict['item_date'], "img": img_url, 
                    "location": " > ".join(p_list),
                    "main_location": r_dict.get("level_2", "General"),
                    "sub_location": r_dict.get("level_3", "")
                })

        elif query or date_filter != "All":
            # --- SEARCH ENGINE LOGIC ---
            sql = "SELECT * FROM items WHERE type='item'"; params = []
            if query: 
                sql += " AND name LIKE ?"; params.append(f"%{query}%")
            if date_filter == "Week": 
                sql += " AND item_date >= ?"; params.append((datetime.now()-timedelta(days=7)).strftime("%Y-%m-%d"))
            elif date_filter == "Month":
                sql += " AND item_date LIKE ?"; params.append(datetime.now().strftime("%Y-%m") + "%")
            
            c.execute(sql, tuple(params))
            col_names = [desc[0] for desc in c.description]
            for row in c.fetchall():
                r_dict = dict(zip(col_names, row))
                img_url = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                items.append({
                    "name": r_dict['name'], "qty": r_dict['quantity'], "date": r_dict['item_date'], "img": img_url,
                    "location": " > ".join([r_dict.get(f"level_{i}", "") for i in range(1, 4) if r_dict.get(f"level_{i}")])
                })

        else:
            # --- HIERARCHY NAVIGATION ---
            depth = len(path_parts)
            
            if depth == 0:
                # ROOT VIEW: Group Rooms (L2) by Zone/Floor (L1)
                c.execute("SELECT DISTINCT level_1 FROM items WHERE level_1 IS NOT NULL AND level_1 != ''")
                found_zones = [r[0] for r in c.fetchall()]
                if not found_zones: found_zones = ["General"]
                elif "General" not in found_zones: found_zones.append("General")

                for z_name in found_zones:
                    # Compatibility: If zone is 'General', also include rooms with NULL level_1
                    if z_name == "General":
                         room_sql = "SELECT DISTINCT level_2 FROM items WHERE (level_1 = ? OR level_1 IS NULL OR level_1 = '') AND level_2 IS NOT NULL AND level_2 != ''"
                    else:
                         room_sql = "SELECT DISTINCT level_2 FROM items WHERE level_1 = ? AND level_2 IS NOT NULL AND level_2 != ''"
                    
                    c.execute(room_sql, (z_name,))
                    room_names = [r[0] for r in c.fetchall()]
                    
                    room_objs = []
                    for r_name in room_names:
                        # Find the room marker to retrieve the image/icon
                        c.execute("SELECT image_path FROM items WHERE type='folder_marker' AND name=? AND level_2=?", (f"[Folder] {r_name}", r_name))
                        row = c.fetchone()
                        img_url = f"/local/{IMG_DIR}/{row[0]}?v={int(time.time())}" if row and row[0] else None
                        room_objs.append({"name": r_name, "img": img_url})
                    
                    if room_objs or z_name != "General":
                        zones.append({"name": z_name, "rooms": room_objs})
            else:
                # SUB-LEVEL NAVIGATION
                where_sql = ""; params = []
                for i, p in enumerate(path_parts):
                    where_sql += f" AND level_{i+1} = ?"
                    params.append(p)

                # Fetch Nested Folders (Sub-locations)
                curr_col = f"level_{depth+1}"
                c.execute(f"SELECT DISTINCT {curr_col} FROM items WHERE {curr_col} IS NOT NULL AND {curr_col} != '' {where_sql} ORDER BY {curr_col} ASC", tuple(params))
                for f_name in [r[0] for r in c.fetchall()]:
                    c.execute(f"SELECT image_path FROM items WHERE type='folder_marker' AND name=? {where_sql} AND {curr_col}=?", (f"[Folder] {f_name}", *params, f_name))
                    row = c.fetchone()
                    folders.append({"name": f_name, "img": f"/local/{IMG_DIR}/{row[0]}?v={int(time.time())}" if row and row[0] else None})
                
                # Fetch Current Level Items
                c.execute(f"SELECT * FROM items WHERE type='item' AND ({curr_col} IS NULL OR {curr_col} = '') {where_sql} ORDER BY name ASC", tuple(params))
                col_names = [desc[0] for desc in c.description]
                for row in c.fetchall():
                    r_dict = dict(zip(col_names, row))
                    img_url = f"/local/{IMG_DIR}/{r_dict['image_path']}?v={int(time.time())}" if r_dict.get('image_path') else None
                    items.append({
                        "name": r_dict['name'], "type": 'item', "qty": r_dict['quantity'], "date": r_dict['item_date'], "img": img_url,
                        "sub_location": r_dict.get(f"level_{depth+1}", "")
                    })

    finally: conn.close()

    return {
        "path_display": is_shopping and "Shopping List" or (query and "Search Results" or (" > ".join(path_parts) if path_parts else "Main")),
        "zones": zones, "folders": folders, "items": items, "shopping_list": shopping_list,
        "app_version": VERSION, "depth": len(path_parts), "hierarchy": hierarchy
    }

async def register_services(hass, entry):
    """Register the various integration services."""
    api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
    broadcast = lambda: hass.bus.async_fire("home_organizer_db_update")

    async def handle_add(call):
        """Service to add a new entity (Item, Room, or Zone)."""
        name = call.data.get("item_name"); itype = call.data.get("item_type", "item")
        date = call.data.get("item_date", ""); img_b64 = call.data.get("image_data")
        parts = call.data.get("current_path", [])
        
        fname = ""
        if img_b64:
            try:
                if "," in img_b64: img_b64 = img_b64.split(",")[1]
                fname = f"img_{int(time.time())}.jpg"
                await hass.async_add_executor_job(lambda: open(hass.config.path("www", IMG_DIR, fname), "wb").write(base64.b64decode(img_b64)))
            except: pass

        def db_ins():
            conn = get_db_connection(hass); c = conn.cursor()
            cols = ["name", "type", "quantity", "item_date", "image_path"]
            vals = [name if itype == 'item' else f"[Folder] {name}", itype if itype == 'item' else 'folder_marker', 1 if itype == 'item' else 0, date, fname]
            
            if itype == 'zone':
                vals[0] = f"[Zone] {name}"; vals[1] = "zone_marker"
                cols.append("level_1"); vals.append(name)
            else:
                for i, p in enumerate(parts):
                    cols.append(f"level_{i+1}"); vals.append(p)
                if itype != 'item':
                    cols.append(f"level_{len(parts)+1}"); vals.append(name)

            qs = ["?"] * len(vals)
            c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
            conn.commit(); conn.close()
            
        await hass.async_add_executor_job(db_ins); broadcast()

    async def handle_update_qty(call):
        """Update quantity by delta."""
        n = call.data.get("item_name"); ch = int(call.data.get("change"))
        def db_q():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute("UPDATE items SET quantity = MAX(0, quantity + ?), item_date = ? WHERE name = ?", (ch, datetime.now().strftime("%Y-%m-%d"), n))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_q); broadcast()

    async def handle_update_stock(call):
        """Set absolute stock quantity."""
        n = call.data.get("item_name"); q = int(call.data.get("quantity"))
        def db_s():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute("UPDATE items SET quantity = ?, item_date = ? WHERE name = ?", (q, datetime.now().strftime("%Y-%m-%d"), n))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_s); broadcast()

    async def handle_delete(call):
        """Delete an item or a hierarchical branch."""
        n = call.data.get("item_name"); is_f = call.data.get("is_folder", False); parts = call.data.get("current_path", [])
        def db_del():
            conn = get_db_connection(hass); c = conn.cursor()
            if is_f:
                col = f"level_{len(parts)+1}"
                c.execute(f"DELETE FROM items WHERE {col} = ?", (n,))
            else:
                c.execute("DELETE FROM items WHERE name = ?", (n,))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_del); broadcast()

    async def handle_move_room(call):
        """Move a room to a different zone/floor."""
        room_name = call.data.get("room_name"); target_zone = call.data.get("zone_name")
        def db_mv():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute("UPDATE items SET level_1 = ? WHERE level_2 = ?", (target_zone, room_name))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_mv); broadcast()

    async def handle_update_details(call):
        """Update entity name and date."""
        o = call.data.get("original_name"); n = call.data.get("new_name"); d = call.data.get("new_date", "")
        def db_u():
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute("UPDATE items SET name = ?, item_date = ? WHERE name = ?", (n, d, o))
            for i in range(1, 11):
                c.execute(f"UPDATE items SET level_{i} = ? WHERE level_{i} = ?", (n, o))
            conn.commit(); conn.close()
        await hass.async_add_executor_job(db_u); broadcast()

    async def handle_ai_action(call):
        """Contact Google Gemini for item identification."""
        img = call.data.get("image_data")
        if not api_key or not img: return
        if "," in img: img = img.split(",")[1]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": "Identify this item. Max 2 words."}, {"inline_data": {"mime_type": "image/jpeg", "data": img}}]}]}
        try:
            session = async_get_clientsession(hass)
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    jr = await resp.json()
                    t = jr["candidates"][0]["content"]["parts"][0]["text"].strip()
                    hass.bus.async_fire("home_organizer_ai_result", {"result": t, "mode": call.data.get("mode")})
        except Exception as e: _LOGGER.error(f"AI Vision Fault: {e}")

    services = {
        "add_item": handle_add, "update_qty": handle_update_qty, "update_stock": handle_update_stock,
        "delete_item": handle_delete, "move_room_to_zone": handle_move_room, 
        "update_item_details": handle_update_details, 
        "update_image": lambda c: hass.async_add_executor_job(save_image_disk, hass, c.data), 
        "ai_action": handle_ai_action
    }
    for n, h in services.items():
        hass.services.async_register(DOMAIN, n, h)

def save_image_disk(hass, data):
    """Save binary data to the local filesystem and update DB record."""
    n = data.get("item_name"); img = data.get("image_data")
    if "," in img: img = img.split(",")[1]
    fn = f"{n}_{int(time.time())}.jpg"
    open(hass.config.path("www", IMG_DIR, fn), "wb").write(base64.b64decode(img))
    conn = get_db_connection(hass); c = conn.cursor()
    c.execute("UPDATE items SET image_path = ? WHERE name = ?", (fn, n)); conn.commit(); conn.close()
    hass.bus.fire("home_organizer_db_update")
