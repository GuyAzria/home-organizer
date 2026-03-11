# -*- coding: utf-8 -*-
# Home Organizer Ultimate - ver 7.9.21 (Update: Added CONFIG_SCHEMA to pass Hassfest validation for config_flow integrations)

import logging
import sqlite3
import os
import base64
import time
import json
import re
import asyncio
import shutil
import voluptuous as vol
from aiohttp import ClientTimeout
from datetime import datetime, timedelta
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig 
from homeassistant.helpers.aiohttp_client import async_get_clientsession
import homeassistant.helpers.config_validation as cv
from .const import DOMAIN, CONF_API_KEY, CONF_DEBUG, CONF_USE_AI, DB_FILE, IMG_DIR, VERSION, CONF_STORAGE_METHOD, CONF_DELETE_ON_REMOVE, STORAGE_METHOD_WWW, STORAGE_METHOD_MEDIA

_LOGGER = logging.getLogger(__name__)

# [ADDED v7.9.21 | 2026-03-11] Purpose: Added CONFIG_SCHEMA to satisfy Hassfest strict validation for UI-configured integrations.
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

WS_GET_DATA = "home_organizer/get_data"
WS_GET_ALL_ITEMS = "home_organizer/get_all_items" 
WS_AI_CHAT = "home_organizer/ai_chat" 

STATIC_PATH_URL = "/home_organizer_static"

GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

ICON_PROMPT_CONTEXT = """
Available Icon Paths (Format: ICON_LIB_ITEM|MainCategory|SubCategory|ExactItemName):
ICON_LIB_ITEM|Food|Dairy|Milk, Yellow cheese, White cheese, Cottage cheese, Butter, Yogurts, Sour cream, Sweet cream, Plant-based milk
ICON_LIB_ITEM|Food|Eggs|Eggs
ICON_LIB_ITEM|Food|Meat|Minced beef, Beef steaks, Sausages, Pastrami, Tofu
ICON_LIB_ITEM|Food|Poultry|Chicken breast, Schnitzels
ICON_LIB_ITEM|Food|Fish|Salmon, Tuna, Tilapia
ICON_LIB_ITEM|Food|Vegetables|Tomatoes, Cucumbers, Peppers, Dry onion, Garlic, Potatoes, Carrots, Zucchini, Eggplants, Lettuce, Mushrooms
ICON_LIB_ITEM|Food|Fruits|Apples, Bananas, Oranges, Lemons, Watermelon, Grapes, Peaches, Strawberries, Berries
ICON_LIB_ITEM|Food|Pantry|Flour, White sugar, Brown sugar, Canola oil, Olive oil
ICON_LIB_ITEM|Food|Carbs|Rice, Pasta, Quinoa, Oats, Tortillas
ICON_LIB_ITEM|Food|Legumes|Lentils, Chickpeas, Beans
ICON_LIB_ITEM|Food|Spices|Salt, Black pepper, Paprika, Cumin, Turmeric, Cinnamon
ICON_LIB_ITEM|Food|Baking Goods|Baking powder, Cocoa powder, Chocolate chips
ICON_LIB_ITEM|Food|Sauces|Ketchup, Mayonnaise, Mustard, Soy sauce, Hot sauce
ICON_LIB_ITEM|Food|Spreads|Chocolate spread, Peanut butter, Honey
ICON_LIB_ITEM|Food|Canned Goods|Tuna, Corn, Peas, Baked beans, Olives, Pickles, Crushed tomatoes
ICON_LIB_ITEM|Food|Bread|Sliced bread, Rolls, Pita bread, Bagels
ICON_LIB_ITEM|Food|Pastries|Croissants, Rice cakes
ICON_LIB_ITEM|Food|Beverages|Black coffee, Instant coffee, Tea, Mineral water, Juices, Carbonated drinks
ICON_LIB_ITEM|Food|Snacks|Bamba, Bisli, Chips, Pretzels, Popcorn, Nuts
ICON_LIB_ITEM|Food|Sweets|Chocolate, Cookies, Wafers
ICON_LIB_ITEM|Cleaning|General Cleaning|Floor cleaner, Bleach, Window cleaner, Toilet cleaner, Insect repellent
ICON_LIB_ITEM|Cleaning|Laundry|Laundry detergent, Fabric softener, Stain remover
ICON_LIB_ITEM|Cleaning|Dishwashing|Dish soap, Dishwasher tablets, Rinse aid
ICON_LIB_ITEM|Toiletries|Personal Hygiene|Shampoo, Body wash, Deodorant, Toothpaste, Toothbrushes, Razors, Feminine hygiene
ICON_LIB_ITEM|Toiletries|Paper Products|Toilet paper, Paper towels, Wet wipes, Tissues
ICON_LIB_ITEM|First Aid|First Aid Supplies|Pain relievers, Band-aids, Polydine, Thermometer
ICON_LIB_ITEM|Kitchenware|Pots|Saucepan, Medium pot, Large pot
ICON_LIB_ITEM|Kitchenware|Pans|Frying pan, Wok
ICON_LIB_ITEM|Kitchenware|Dinnerware|Dinner plates, Bowls, Glasses, Mugs
ICON_LIB_ITEM|Kitchenware|Cooking Accessories|Chef's knife, Cutting board, Spatula, Measuring cup
ICON_LIB_ITEM|Kitchenware|Storage|Plastic food container, Glass jar
ICON_LIB_ITEM|Kitchenware|Small Kitchen Appliances|Electric kettle, Pop-up toaster, Coffee maker
ICON_LIB_ITEM|Electronics|Computing|Laptop, Keyboard, Mouse, Printer
ICON_LIB_ITEM|Electronics|Major Appliances|Refrigerator, Freezer, Oven, Stove
ICON_LIB_ITEM|Clothing|Everyday Clothing|Short sleeve shirt, Pants, Jeans, Dresses, Sportswear, Suits
ICON_LIB_ITEM|Clothing|Footwear|Sneakers, Sandals, Boots
ICON_LIB_ITEM|Home Textiles|Bed Linens|Bed sheets, Duvets, Blankets
ICON_LIB_ITEM|Home Textiles|Bath Textiles|Bath towels, Hand towels
ICON_LIB_ITEM|Pet Supplies|Food|Dry pet food, Wet pet food
ICON_LIB_ITEM|Pet Supplies|Care|Leash, Collar, Litter box, Pet beds
ICON_LIB_ITEM|Baby Supplies|Feeding|Baby bottles, Baby purees
ICON_LIB_ITEM|Baby Supplies|Diapering|Disposable diapers, Cloth diapers
ICON_LIB_ITEM|Outdoor|Gardening Tools|Shovel, Pruning shears, Watering can, Garden hose
ICON_LIB_ITEM|Tools|Hand Tools|Hammer, Screwdriver, Pliers, Measuring tape, Utility knife
ICON_LIB_ITEM|Tools|Power Tools|Cordless drill, Electric sander
ICON_LIB_ITEM|Toys|Action Figures|Action figures, Dinosaurs
ICON_LIB_ITEM|Toys|Building Blocks|LEGO, Wooden blocks
ICON_LIB_ITEM|Toys|Vehicles|Toy cars, Remote control cars, Toy trains
ICON_LIB_ITEM|Toys|Arts|Play-Doh, Coloring books, Paint sets
"""

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

    await hass.async_add_executor_job(init_db, hass)

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
                vol.Optional("image_data"): vol.Any(str, None),
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

            if os.path.exists(db_path):
                os.remove(db_path)
            
            if os.path.exists(img_path):
                shutil.rmtree(img_path)
        except Exception as e:
            _LOGGER.error(f"Error deleting Home Organizer data: {e}")

# [MODIFIED v7.9.18] Added timeout to sqlite3.connect to gracefully handle locks rather than freezing.
def get_db_connection(hass):
    db_path = hass.data.get(DOMAIN, {}).get("config", {}).get("db_path", hass.config.path(DB_FILE))
    return sqlite3.connect(db_path, timeout=10.0)

def init_db(hass):
    img_path = hass.data.get(DOMAIN, {}).get("config", {}).get("img_path", hass.config.path("www", IMG_DIR))
    if not os.path.exists(img_path): os.makedirs(img_path)
    
    conn = None
    try:
        conn = get_db_connection(hass)
        c = conn.cursor()
        c.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
        c.execute("CREATE TABLE IF NOT EXISTS persistent_ids (scope TEXT, item_name TEXT, seq_id INTEGER, PRIMARY KEY (scope, item_name))")

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

        try:
            c.execute("CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_items_level1 ON items(level_1)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_items_level2 ON items(level_2)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_items_level3 ON items(level_3)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)")
        except Exception: pass

        c.execute("SELECT id, name, level_1, level_2, level_3, level_4, level_5, level_6, level_7, level_8, level_9, level_10 FROM items")
        all_items = c.fetchall()
        for row in all_items:
            r_id = row[0]
            name = row[1]
            levels = list(row[2:])
            changed = False
            
            new_name = name
            if name and name.startswith("[Folder] ") and "ORDER_MARKER" in name:
                val = name.replace("[Folder] ", "")
                m = re.match(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', val)
                if m:
                    new_name = f"[Folder] [{m.group(1)}] {m.group(2)}"
                    if new_name != name: changed = True
            
            new_levels = []
            for lvl in levels:
                if lvl and "ORDER_MARKER" in lvl:
                    m = re.match(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', lvl)
                    if m:
                        fixed_lvl = f"[{m.group(1)}] {m.group(2)}"
                        if fixed_lvl != lvl:
                            changed = True
                            new_levels.append(fixed_lvl)
                            continue
                new_levels.append(lvl)
                
            if changed:
                upd_cols = ["name = ?"]
                upd_vals = [new_name]
                for i, n_lvl in enumerate(new_levels):
                    upd_cols.append(f"level_{i+1} = ?")
                    upd_vals.append(n_lvl)
                upd_vals.append(r_id)
                c.execute(f"UPDATE items SET {', '.join(upd_cols)} WHERE id = ?", tuple(upd_vals))
                
        c.execute("SELECT DISTINCT level_1, level_2, level_3, level_4, level_5, level_6, level_7, level_8, level_9, level_10 FROM items")
        rows = c.fetchall()
        marker_map = {}
        for row in rows:
            for lvl in row:
                if lvl and "ORDER_MARKER" in lvl:
                    core = re.sub(r'\[?ORDER_MARKER_\d+\]?[_\s]*', '', str(lvl)).strip()
                    if core:
                        marker_map[core] = lvl

        if marker_map:
            c.execute("SELECT id, name, level_1, level_2, level_3, level_4, level_5, level_6, level_7, level_8, level_9, level_10 FROM items")
            all_items = c.fetchall()
            for row in all_items:
                r_id = row[0]
                name = row[1]
                levels = list(row[2:])
                changed = False
                
                new_levels = []
                for lvl in levels:
                    if lvl and lvl in marker_map and "ORDER_MARKER" not in lvl:
                        new_levels.append(marker_map[lvl])
                        changed = True
                    else:
                        new_levels.append(lvl)
                        
                new_name = name
                if name and name.startswith("[Folder] "):
                    folder_name = name.replace("[Folder] ", "").strip()
                    if folder_name in marker_map and "ORDER_MARKER" not in folder_name:
                        new_name = f"[Folder] {marker_map[folder_name]}"
                        changed = True
                        
                if changed:
                    upd_cols = ["name = ?"]
                    upd_vals = [new_name]
                    for i, n_lvl in enumerate(new_levels):
                        upd_cols.append(f"level_{i+1} = ?")
                        upd_vals.append(n_lvl)
                    upd_vals.append(r_id)
                    c.execute(f"UPDATE items SET {', '.join(upd_cols)} WHERE id = ?", tuple(upd_vals))
        
        conn.commit()
    except Exception as e:
        _LOGGER.error(f"DB Init Cleanup Error: {e}")
    finally:
        if conn: conn.close()

# [MODIFIED v7.9.18] Fully optimized logic with proper try/finally blocks to prevent SQLite deadlock and massive speed up via executemany.
def get_or_create_catalog_ids(hass):
    conn = None
    try:
        conn = get_db_connection(hass)
        c = conn.cursor()
        c.execute("CREATE TABLE IF NOT EXISTS persistent_ids (scope TEXT, item_name TEXT, seq_id INTEGER, PRIMARY KEY (scope, item_name))")
        
        c.execute("SELECT scope, item_name, seq_id FROM persistent_ids")
        existing = {}
        for r in c.fetchall():
            sc, nm, seq = r
            if sc not in existing: existing[sc] = {}
            existing[sc][nm] = seq
            
        new_inserts = []
        
        def allocate(scope, name):
            if not name: return
            if scope not in existing: existing[scope] = {}
            if name not in existing[scope]:
                max_id = max(existing[scope].values()) if existing[scope] else 0
                new_id = max_id + 1
                existing[scope][name] = new_id
                new_inserts.append((scope, name, new_id))

        c.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE level_1 IS NOT NULL AND level_1 != ''")
        rows = c.fetchall()
        for r in rows:
            l1, l2, l3 = r[0], r[1], r[2]
            if l1:
                allocate('root', l1)
                if l2:
                    allocate(l1, l2)
                    if l3:
                        allocate(f"{l1}_{l2}", l3)
                        
        if new_inserts:
            c.executemany("INSERT INTO persistent_ids (scope, item_name, seq_id) VALUES (?, ?, ?)", new_inserts)
            conn.commit()
        return existing
    except Exception as e:
        _LOGGER.error(f"Catalog ID Error: {e}")
        return {}
    finally:
        if conn: conn.close()

def normalize_zone_path(hass, path_list):
    if not path_list or len(path_list) < 2:
        return path_list
    conn = None
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
        if is_zone:
            return [f"[{z_name}] {r_name}"] + path_list[2:]
    except Exception as e:
        _LOGGER.error(f"Zone normalization error: {e}")
    finally:
        if conn: conn.close()
    return path_list

# [MODIFIED v7.9.18] Fixed missing conn.close() in exception case, which was the main cause of the DB lock/timeout.
def repair_path_against_db(hass, path_list):
    if not path_list: return path_list
    fixed = []
    conn = None
    try:
        conn = get_db_connection(hass)
        c = conn.cursor()
        
        def get_core(s):
            return re.sub(r'\[?ORDER_MARKER_\d+\]?[_\s]*', '', str(s)).strip()

        for i, p in enumerate(path_list):
            col = f"level_{i+1}"
            
            c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} = ? AND type != 'pending'", (p,))
            if c.fetchone():
                fixed.append(p)
                continue
                
            c.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' AND type != 'pending'")
            existing = [row[0] for row in c.fetchall()]
            
            core_p = get_core(p)
            matched = False
            for ex in existing:
                if get_core(ex) == core_p:
                    fixed.append(ex) 
                    matched = True
                    break
                    
            if not matched:
                m = re.match(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', str(p))
                if m:
                    fixed.append(f"[{m.group(1)}] {m.group(2)}")
                else:
                    fixed.append(str(p))
                    
        return fixed
    except Exception as e:
        _LOGGER.error(f"repair_path error: {e}")
        return [re.sub(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', r'[\1] \2', str(x)) for x in path_list]
    finally:
        if conn: conn.close()

def add_item_db_safe(hass, name, qty, path_list, category="", sub_category="", item_type="item", icon_key=None):
    path_list = normalize_zone_path(hass, path_list)
    path_list = repair_path_against_db(hass, path_list)
    
    conn = None
    try:
        conn = get_db_connection(hass)
        c = conn.cursor()
        today = datetime.now().strftime("%Y-%m-%d")
        cols = ["name", "type", "quantity", "item_date", "category", "sub_category"]
        vals = [name, item_type, qty, today, category, sub_category]
        qs = ["?", "?", "?", "?", "?", "?"]
        
        if icon_key:
            cols.append("image_path")
            vals.append(icon_key)
            qs.append("?")

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
        if conn: conn.close()

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
    conn = None
    try:
        conn = get_db_connection(hass)
        c = conn.cursor()
        url_prefix = hass.data.get(DOMAIN, {}).get("config", {}).get("url_prefix", f"/local/{IMG_DIR}")

        c.execute("SELECT * FROM items WHERE type='item'")
        col_names = [description[0] for description in c.description]
        results = []
        
        for r in c.fetchall():
            r_dict = dict(zip(col_names, r))
            img = None
            raw_path = r_dict.get('image_path')
            if raw_path:
                if raw_path.startswith("ICON_LIB"): 
                    img = raw_path
                else: 
                    img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

            fp = []
            for i in range(1, 11):
                if r_dict.get(f"level_{i}"): fp.append(r_dict.get(f"level_{i}"))

            results.append({
                "id": r_dict['id'],
                "name": r_dict['name'],
                "qty": r_dict['quantity'],
                "date": r_dict.get('item_date', ''),
                "img": img,
                "location": " > ".join(fp),
                "level_1": r_dict.get('level_1', ''),
                "level_2": r_dict.get('level_2', ''),
                "level_3": r_dict.get('level_3', ''),
                "category": r_dict.get('category', ''),
                "sub_category": r_dict.get('sub_category', ''),
                "unit": r_dict.get('unit', ''),
                "unit_value": r_dict.get('unit_value', '')
            })
        connection.send_result(msg["id"], results)
    except Exception as e:
        _LOGGER.error(f"websocket_get_all_items error: {e}")
    finally:
        if conn: conn.close()

# [MODIFIED v7.9.18] Reduced retries and delays to fail gracefully before HA core connection completely drops out.
async def async_gemini_api_call(session, url, payload, timeout_sec):
    max_retries = 2
    delays = [1, 2]
    for attempt in range(max_retries + 1):
        try:
            async with session.post(url, json=payload, timeout=ClientTimeout(total=timeout_sec)) as resp:
                if resp.status in (429, 503) and attempt < max_retries:
                    await asyncio.sleep(delays[attempt])
                    continue
                if resp.status != 200:
                    err = await resp.text()
                    if attempt < max_retries and resp.status >= 500: 
                        await asyncio.sleep(delays[attempt])
                        continue
                    if resp.status in (429, 503):
                        return None, "The AI service is currently very busy. Please try again in a few moments."
                    return None, err
                res = await resp.json()
                return res, None
        except asyncio.TimeoutError:
            if attempt < max_retries:
                await asyncio.sleep(delays[attempt])
                continue
            return None, "Timeout Error: The request took too long."
        except Exception as e:
            if attempt < max_retries:
                await asyncio.sleep(delays[attempt])
                continue
            return None, str(e)
    return None, "Max retries exceeded"

@websocket_api.async_response
async def websocket_ai_chat(hass, connection, msg):

    try:
        user_message = msg.get("message", "")
        image_data = msg.get("image_data") 
        mime_val = msg.get("mime_type", "image/jpeg") 
        
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

        existing_locs_str = ""
        existing_cats_str = ""
        
        def fetch_context():
            nonlocal existing_locs_str, existing_cats_str
            conn = None
            try:
                conn = get_db_connection(hass)
                cc = conn.cursor()
                cc.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE type != 'pending'")
                loc_hierarchy = set()
                
                def local_quick_regex(s):
                    if not s: return s
                    m = re.match(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', str(s))
                    if m: return f"[{m.group(1)}] {m.group(2)}"
                    return str(s)

                for r in cc.fetchall():
                    l1 = local_quick_regex(r[0]) if r[0] else None
                    l2 = local_quick_regex(r[1]) if r[1] else None
                    l3 = local_quick_regex(r[2]) if r[2] else None
                    if l1:
                        path_elements = [f'"{l1}"']
                        if l2: path_elements.append(f'"{l2}"')
                        if l3: path_elements.append(f'"{l3}"')
                        loc_hierarchy.add(f"[{', '.join(path_elements)}]")
                        
                existing_locs_str = ", ".join(sorted(list(loc_hierarchy)))
                
                cc.execute("SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != ''")
                cats = [r[0] for r in cc.fetchall()]
                existing_cats_str = ", ".join(sorted(cats))
            except Exception as ex:
                _LOGGER.error(f"Context fetch error: {ex}")
            finally:
                if conn: cc.close()
            
        await hass.async_add_executor_job(fetch_context)

        if image_data:
            if "," in image_data: image_data = image_data.split(",")[1]
            
            # [MODIFIED v7.9.19 | 2026-03-10] Purpose: Removed explicit Hebrew characters from prompt to prevent Gemini from biasing its language output.
            invoice_prompt = (
                f"Analyze this document/receipt. Context:\n"
                f"EXISTING PATHS (Use these EXACT arrays): {existing_locs_str}\n"
                f"EXISTING CATEGORIES: [{existing_cats_str}]\n\n"
                "RULES:\n"
                "1. LANGUAGE: DO NOT translate item names. The 'name' field MUST be in the exact language the user typed or the receipt shows. Generate the 'message' field in the detected language.\n"
                "2. MAPPING & SUBLOCATIONS: Map the user's natural language locations strictly to the exact strings in EXISTING PATHS. "
                "   CRITICAL: If the EXISTING PATH contains brackets like `[ORDER_MARKER_020]`, you MUST output the FULL string including the brackets. Example: User says 'Left Door', but EXISTING PATHS has '[ORDER_MARKER_020] Left Door' -> you MUST output '[ORDER_MARKER_020] Left Door'. Do NOT strip brackets or convert spaces to underscores.\n"
                "3. ICON SELECTION & CATEGORIES: Assign the closest standard icon_key from the following list. \n"
                "   CRITICAL: The 'category' and 'sub_category' JSON fields MUST exactly match the MainCategory and SubCategory from your chosen icon_key.\n"
                f"{ICON_PROMPT_CONTEXT}\n"
                "4. OUTPUT JSON ONLY:\n"
                "   - If items are clear: {{\"intent\": \"add_invoice\", \"message\": \"<Short success sentence in the detected language>\", \"items\": [{\"name\": \"...\", \"qty\": 1, \"path\": [\"[Floor 1] Kitchen\", \"Fridge\", \"[ORDER_MARKER_010] Right Door\"], \"category\": \"Food\", \"sub_category\": \"Dairy\", \"icon_key\": \"ICON_LIB_ITEM|Food|Dairy|Milk\"}]}}\n"
                "   - If ambiguous/unknown: {{\"intent\": \"clarify\", \"question\": \"<Question in the detected language>\"}}\n"
            )

            if user_message and user_message.strip() != "" and user_message != "Scanned Invoice":
                invoice_prompt += f"\n\nSPECIAL USER INSTRUCTION:\nThe user added this specific request: '{user_message}'. \nPlease strictly apply this instruction (e.g. if they specified a location, force that location for the items).\n"
            
            invoice_prompt += "\nDo NOT use markdown."

            hass.bus.async_fire("home_organizer_chat_progress", {
                "step": "Scanning Document...",
                "debug_type": "image_scan",
                "debug_label": "Invoice Prompt",
                "debug_content": invoice_prompt
            })

            payload = {
                "contents": [{
                    "parts": [
                        {"text": invoice_prompt},
                        {"inline_data": {"mime_type": mime_val, "data": image_data}}
                    ]
                }]
            }

            res, err = await async_gemini_api_call(session, gen_url, payload, 45)
            if err:
                connection.send_result(msg["id"], {"error": f"AI Error: {err}"})
                return
            
            if not res or "candidates" not in res or not res["candidates"]:
                connection.send_result(msg["id"], {"error": f"AI Response Format Error (Content may be blocked or invalid): {res}"})
                return
                
            raw_txt = res["candidates"][0]["content"]["parts"][0]["text"].strip()
            clean_txt = re.sub(r'```json\s*|```\s*', '', raw_txt).strip()
            
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
                    for item in parsed["items"]:
                        raw_path = item.get("path", ["General"])
                        await hass.async_add_executor_job(
                            add_item_db_safe, 
                            hass, 
                            item.get("name", "Unknown"), 
                            int(item.get("qty", 1)), 
                            raw_path, 
                            item.get("category", ""), 
                            item.get("sub_category", ""),
                            "pending", 
                            item.get("icon_key", None)
                        )
                        added_count += 1
                    
                    hass.bus.async_fire("home_organizer_db_update")
                    
                    ai_message = parsed.get("message", f"✅ I have scanned the document and added {added_count} items to the Review tab.")
                    response_text = f"{ai_message}\n\n"
                    for i in parsed["items"]:
                        def ui_clean(p_list):
                            return [re.sub(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', r'[\1] \2', str(x)) for x in p_list]
                        p_repaired = ui_clean(i.get("path", []))
                        path_str = " > ".join(p_repaired)
                        response_text += f"- **{i.get('name')}** (x{i.get('qty')}) -> _{path_str}_\n"

                    connection.send_result(msg["id"], {
                        "response": response_text,
                        "debug": {"raw_json": clean_txt, "intent": "add_invoice"}
                    })
                    return

            except Exception as e:
                connection.send_result(msg["id"], {"response": f"❌ Could not parse invoice data. Error: {str(e)}", "debug": {"raw": clean_txt}})
                return

        # [MODIFIED v7.9.19 | 2026-03-10] Purpose: Removed explicit language biases to ensure the AI strictly follows the user's input language.
        step1_prompt = (
            f"User says: '{user_message}'\n"
            "Determine if the user wants to ADD items or SEARCH/QUERY.\n"
            "1. IF ADDING:\n"
            f"   Context for icons: {ICON_PROMPT_CONTEXT}\n"
            f"   EXISTING PATHS: {existing_locs_str}\n"
            "   Return JSON: {\"intent\": \"add\", \"items\": [{\"name\": \"Item Name\", \"qty\": 1, \"path\": [\"[Zone] Room\", \"Furniture\", \"[ORDER_MARKER_010] Right Door\"], \"category\": \"MainCat\", \"sub_category\": \"SubCat\", \"icon_key\": \"ICON_LIB_ITEM|MainCat|SubCat|ExactItemName\"}]}\n"
            "   - LANGUAGE CRITICAL: DO NOT translate the item name. The 'name' field MUST be exactly as the user wrote it in their original language.\n"
            "   - PATH MAPPING CRITICAL: Map natural language to EXACT EXISTING PATHS. If an existing path contains `[ORDER_MARKER_...]`, you MUST include the full string WITH brackets. Example: User says 'Left Door' -> output MUST be `\"[ORDER_MARKER_020] Left Door\"` if it exists in the paths. DO NOT strip or alter the markers.\n"
            "   - Choose the closest icon_key. 'category' and 'sub_category' MUST exactly match the chosen icon_key.\n"
            "2. IF SEARCHING: Return JSON: {\"intent\": \"search\", \"locations\": [\"loc1\"], \"keywords\": [\"item1\"], \"category_filter\": \"\"}\n"
            "   - CRITICAL: Only extract physical item names as 'keywords'. For general advice/recipes (e.g., 'breakfast'), leave 'keywords' empty [].\n"
            "   - IF the request is general advice AND no location is specified, set 'category_filter' to the best matching main category (e.g., 'Food', 'Clothing', 'Tools', 'Cleaning Supplies').\n"
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

        res, err = await async_gemini_api_call(session, gen_url, payload_1, 20)
        if not err and res:
            if "candidates" not in res or not res["candidates"]:
                connection.send_result(msg["id"], {"error": f"AI Response Format Error (Content may be blocked): {res}"})
                return
                
            raw_analysis = res["candidates"][0]["content"]["parts"][0]["text"].strip()
            clean_txt = re.sub(r'```json\s*|```\s*', '', raw_analysis).strip()
            try:
                analysis_json = json.loads(clean_txt)
            except:
                analysis_json = {}
        else:
            connection.send_result(msg["id"], {"error": f"AI API Error: {err}"})
            return

        if analysis_json.get("intent") == "add":
            items_to_add = analysis_json.get("items", [])
            added_log = []
            
            for item in items_to_add:
                nm = item.get("name")
                qt = item.get("qty", 1)
                pt = item.get("path", ["General"])
                cat = item.get("category", "")
                sub_cat = item.get("sub_category", "")
                icon_key = item.get("icon_key", None)
                
                await hass.async_add_executor_job(add_item_db_safe, hass, nm, qt, pt, cat, sub_cat, "pending", icon_key)
                
                def ui_clean(p_list):
                    return [re.sub(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', r'[\1] \2', str(x)) for x in p_list]
                pt_clean = ui_clean(pt)
                added_log.append(f"{nm} (x{qt}) to {' > '.join(pt_clean)}")
            
            hass.bus.async_fire("home_organizer_db_update")
            
            resp_text = f"✅ Added {len(added_log)} items to the Review tab:\n" + "\n".join([f"- {l}" for l in added_log])
            
            connection.send_result(msg["id"], {
                "response": resp_text,
                "debug": {
                    "intent": "add",
                    "json": analysis_json
                }
            })
            return

        filter_locs = analysis_json.get("locations", [])
        filter_items = analysis_json.get("keywords", [])
        if not filter_items and "items" in analysis_json: filter_items = analysis_json["items"] 

        filter_cat = analysis_json.get("category_filter", "")

        final_sql = ""
        final_params = []
        
        def get_inventory():
            nonlocal final_sql, final_params
            conn = None
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

                if filter_cat and not filter_locs:
                    if filter_cat.lower() == "food":
                        conditions.append("(category LIKE '%Food%' OR category LIKE '%אוכל%' OR category LIKE '%food%')")
                    elif filter_cat.lower() == "clothing":
                        conditions.append("(category LIKE '%Clothing%' OR category LIKE '%בגדים%' OR category LIKE '%ביגוד%')")
                    else:
                        conditions.append("category LIKE ?")
                        params.append(f"%{filter_cat}%")
                
                if conditions:
                    sql += " AND " + " AND ".join(conditions)
                
                final_sql = sql
                final_params = params
                
                c.execute(sql, tuple(params))
                rows = [dict(row) for row in c.fetchall()]
                return rows
            except Exception as e:
                return [{"_error": str(e)}]
            finally:
                if conn: conn.close()

        rows = await hass.async_add_executor_job(get_inventory)
        
        if not rows and filter_items:
            filter_items = []
            rows = await hass.async_add_executor_job(get_inventory)
            final_sql += " -- (Fallback 1 applied: dropped strict keywords)"
            
        if not rows and filter_locs:
            filter_locs = []
            rows = await hass.async_add_executor_job(get_inventory)
            final_sql += " -- (Fallback 2 applied: dropped strict locations)"
            
        if not rows and filter_cat:
            filter_cat = ""
            rows = await hass.async_add_executor_job(get_inventory)
            final_sql += " -- (Fallback 3 applied: dropped strict category)"
            
        if not rows:
            def get_all_inventory_fallback():
                conn = None
                try:
                    conn = get_db_connection(hass)
                    conn.row_factory = sqlite3.Row 
                    c = conn.cursor()
                    c.execute("SELECT * FROM items WHERE type='item' AND quantity > 0")
                    f_rows = [dict(row) for row in c.fetchall()]
                    return f_rows
                except Exception as e:
                    return [{"_error": str(e)}]
                finally:
                    if conn: conn.close()

            rows = await hass.async_add_executor_job(get_all_inventory_fallback)
            final_sql += " -- (Fallback 4 applied: forced fetch of ALL available items)"

        context_lines = []
        for r in rows:
            if "_error" in r: continue
            name = r.get('name', 'Unknown')
            qty = r.get('quantity', 0)
            locs = [r.get(f'level_{i}') for i in range(1, 4) if r.get(f'level_{i}')]
            loc_str = " > ".join([str(l) for l in locs])
            context_lines.append(f"- {name}: {qty} ({loc_str})")
        
        inventory_context = "\n".join(context_lines) if context_lines else "(empty - no items found)"

        # [MODIFIED v7.9.20 | 2026-03-10] Purpose: Restructured the final prompt to place strict language and translation rules at the very end to combat context-language bleed from the database items.
        step3_prompt = (
            "You are a smart home inventory assistant.\n\n"
            "=== RAW INVENTORY DATA ===\n"
            f"{inventory_context}\n"
            "==========================\n\n"
            "=== USER REQUEST ===\n"
            f"{user_message}\n"
            "====================\n\n"
            "CRITICAL OUTPUT INSTRUCTIONS:\n"
            "1. Identify the language of the 'USER REQUEST'.\n"
            "2. Your ENTIRE response MUST be in THAT EXACT LANGUAGE.\n"
            "3. If the USER REQUEST is in English, you MUST translate ALL inventory items and locations from the raw data into English.\n"
            "4. NEVER mix languages. Base your recommendations ONLY on the raw inventory data provided."
        )

        payload_3 = {"contents": [{"parts": [{"text": step3_prompt}]}]}

        res, err = await async_gemini_api_call(session, gen_url, payload_3, 40)
        if not err and res:
            if "candidates" not in res or not res["candidates"]:
                connection.send_result(msg["id"], {"error": f"AI Response Format Error (Content may be blocked): {res}"})
                return
                
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
            connection.send_result(msg["id"], {"error": f"AI API Error: {err}"})

    except asyncio.TimeoutError:
        _LOGGER.error("AI Chat Timeout Processing Document", exc_info=True)
        connection.send_result(msg["id"], {"error": "Timeout Error: File is too large or AI processing took too long."})
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

    url_prefix = hass.data.get(DOMAIN, {}).get("config", {}).get("url_prefix", f"/local/{IMG_DIR}")

    conn = None
    try:
        conn = get_db_connection(hass); c = conn.cursor()
        folders = []; items = []; shopping_list = []; pending_list = []
        
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

        if is_shopping:
            c.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC")
            col_names = [description[0] for description in c.description]
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                fp = []; [fp.append(r_dict.get(f"level_{i}", "")) for i in range(1, 11) if r_dict.get(f"level_{i}")]
                
                img = None
                raw_path = r_dict.get('image_path')
                if raw_path:
                    if raw_path.startswith("ICON_LIB"): img = raw_path
                    else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

                shopping_list.append({
                    "id": r_dict['id'],
                    "name": r_dict['name'], 
                    "qty": 0, 
                    "date": r_dict['item_date'], 
                    "img": img, 
                    "location": " > ".join([p for p in fp if p]),
                    "main_location": r_dict.get("level_2", "General"),
                    "sub_location": r_dict.get("level_3", ""),
                    "category": r_dict.get("category", ""),
                    "sub_category": r_dict.get("sub_category", "")
                })

            c.execute("SELECT * FROM items WHERE type='pending' ORDER BY created_at DESC")
            for r in c.fetchall():
                r_dict = dict(zip(col_names, r))
                img = None
                raw_path = r_dict.get('image_path')
                if raw_path:
                    if raw_path.startswith("ICON_LIB"): img = raw_path
                    else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

                pending_list.append({
                    "id": r_dict['id'],
                    "name": r_dict['name'], 
                    "qty": r_dict['quantity'], 
                    "img": img, 
                    "level_1": r_dict.get("level_1", ""),
                    "level_2": r_dict.get("level_2", ""),
                    "level_3": r_dict.get("level_3", ""),
                    "category": r_dict.get("category", ""),
                    "sub_category": r_dict.get("sub_category", "")
                })

        elif query or date_filter != "All":
            sql = "SELECT * FROM items WHERE type='item'"; params = []
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
                img = None
                raw_path = r_dict.get('image_path')
                if raw_path:
                    if raw_path.startswith("ICON_LIB"): img = raw_path
                    else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

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
                    
                    img = None
                    if row and row[0]:
                        raw_path = row[0]
                        if raw_path.startswith("ICON_LIB"): img = raw_path
                        else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"
                        
                    folders.append({"name": f_name, "img": img})
                
                sql = f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where} ORDER BY name ASC"
                c.execute(sql, tuple(params))
                col_names = [description[0] for description in c.description]
                for r in c.fetchall():
                      r_dict = dict(zip(col_names, r))
                      img = None
                      raw_path = r_dict.get('image_path')
                      if raw_path:
                          if raw_path.startswith("ICON_LIB"): img = raw_path
                          else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

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
                    img = None
                    raw_path = r_dict.get('image_path')
                    if raw_path:
                        if raw_path.startswith("ICON_LIB"): img = raw_path
                        else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

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
    except Exception as e:
        _LOGGER.error(f"get_view_data error: {e}")
    finally:
        if conn: conn.close()

    catalog_map = get_or_create_catalog_ids(hass)

    return {
        "path_display": is_shopping and "Shopping List" or (query and "Search Results" or (" > ".join(path_parts) if path_parts else "Main")),
        "folders": folders,
        "items": items,
        "shopping_list": shopping_list,
        "pending_list": pending_list,
        "app_version": VERSION,
        "depth": len(path_parts),
        "hierarchy": hierarchy,
        "enable_ai": enable_ai,
        "catalog_map": catalog_map
    }

async def register_services(hass, entry):
    api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY, ""))
    
    def broadcast_update():
        hass.bus.async_fire("home_organizer_db_update")

    async def handle_add(call):
        name = call.data.get("item_name"); itype = call.data.get("item_type", "item")
        date = call.data.get("item_date"); img_b64 = call.data.get("image_data")
        fname = ""
        img_path_base = hass.data.get(DOMAIN, {}).get("config", {}).get("img_path", hass.config.path("www", IMG_DIR))
        
        if img_b64:
            try:
                if "," in img_b64: img_b64 = img_b64.split(",")[1]
                fname = f"img_{int(time.time())}.jpg"
                await hass.async_add_executor_job(lambda: open(os.path.join(img_path_base, fname), "wb").write(base64.b64decode(img_b64)))
            except: pass

        parts = call.data.get("current_path", [])
        parts = normalize_zone_path(hass, parts)
        parts = await hass.async_add_executor_job(repair_path_against_db, hass, parts)
        depth = len(parts)
        cols = ["name", "type", "quantity", "item_date", "image_path"]
        
        if itype == 'folder':
            if depth >= 10: return
            vals = [f"[Folder] {name}", "folder_marker", 0, date, fname]
            qs = ["?", "?", "?", "?", "?"]
            for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")
            cols.append(f"level_{depth+1}"); vals.append(name); qs.append("?")
            
            def db_ins():
                conn = None
                try:
                    conn = get_db_connection(hass); c = conn.cursor()
                    c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
                    conn.commit()
                finally:
                    if conn: conn.close()
            await hass.async_add_executor_job(db_ins)
        else:
            vals = [name, itype, 1, date, fname]
            qs = ["?", "?", "?", "?", "?"]
            for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")

            def db_ins():
                conn = None
                try:
                    conn = get_db_connection(hass); c = conn.cursor()
                    c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
                    conn.commit()
                finally:
                    if conn: conn.close()
            await hass.async_add_executor_job(db_ins)

        broadcast_update()
        
    async def handle_duplicate(call):
        item_id = call.data.get("item_id")
        if not item_id: return
        def db_dup():
            conn = None
            try:
                conn = get_db_connection(hass); c = conn.cursor()
                c.execute("PRAGMA table_info(items)")
                columns = [col[1] for col in c.fetchall() if col[1] not in ('id', 'created_at')]
                col_str = ", ".join(columns)
                c.execute(f"INSERT INTO items ({col_str}) SELECT {col_str} FROM items WHERE id = ?", (item_id,))
                conn.commit()
            finally:
                if conn: conn.close()
        await hass.async_add_executor_job(db_dup)
        broadcast_update()

    async def handle_update_qty(call):
        item_id = call.data.get("item_id")
        change = int(call.data.get("change"))
        today = datetime.now().strftime("%Y-%m-%d")
        def db_q():
            conn = None
            try:
                conn = get_db_connection(hass); c = conn.cursor()
                if item_id:
                    c.execute(f"UPDATE items SET quantity = MAX(0, quantity + ?), item_date = ? WHERE id = ?", (change, today, item_id))
                conn.commit()
            finally:
                if conn: conn.close()
        await hass.async_add_executor_job(db_q); broadcast_update()

    async def handle_update_stock(call):
        item_id = call.data.get("item_id")
        qty = int(call.data.get("quantity"))
        today = datetime.now().strftime("%Y-%m-%d")
        def db_upd():
            conn = None
            try:
                conn = get_db_connection(hass); c = conn.cursor()
                if item_id:
                    c.execute(f"UPDATE items SET quantity = ?, item_date = ? WHERE id = ?", (qty, today, item_id))
                conn.commit()
            finally:
                if conn: conn.close()
        await hass.async_add_executor_job(db_upd); broadcast_update()

    async def handle_delete(call):
        item_id = call.data.get("item_id")
        name = call.data.get("item_name")
        parts = call.data.get("current_path", [])
        parts = normalize_zone_path(hass, parts)
        is_folder = call.data.get("is_folder", False)

        def db_del(): 
            conn = None
            try:
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
                conn.commit()
            finally:
                if conn: conn.close()
        await hass.async_add_executor_job(db_del); broadcast_update()

    async def handle_paste(call):
        target_path = call.data.get("target_path")
        target_path = normalize_zone_path(hass, target_path)
        target_path = await hass.async_add_executor_job(repair_path_against_db, hass, target_path)
        clipboard = hass.data.get(DOMAIN, {}).get("clipboard") 
        if not clipboard: return
        
        item_id = clipboard.get("id") if isinstance(clipboard, dict) else None
        item_name = clipboard.get("name") if isinstance(clipboard, dict) else clipboard

        def db_mv():
            conn = None
            try:
                conn = get_db_connection(hass); c = conn.cursor()
                upd = [f"level_{i} = ?" for i in range(1, 11)]
                vals = [target_path[i-1] if i <= len(target_path) else None for i in range(1, 11)]
                
                if item_id:
                    c.execute(f"UPDATE items SET {','.join(upd)} WHERE id = ?", (*vals, item_id))
                else:
                    c.execute(f"UPDATE items SET {','.join(upd)} WHERE name = ?", (*vals, item_name))
                    
                conn.commit()
            finally:
                if conn: conn.close()
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
        new_path = call.data.get("new_path") 

        parts = call.data.get("current_path", [])
        parts = normalize_zone_path(hass, parts)
        is_folder = call.data.get("is_folder", False)

        repaired_path = None
        if new_path is not None:
            repaired_path = normalize_zone_path(hass, new_path)
            repaired_path = await hass.async_add_executor_job(repair_path_against_db, hass, repaired_path)

        def db_update_sync():
            conn = None
            try:
                conn = get_db_connection(hass)
                c = conn.cursor()
                
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

                    scope = 'root'
                    if depth == 1: scope = parts[0]
                    elif depth == 2: scope = f"{parts[0]}_{parts[1]}"
                    c.execute("UPDATE persistent_ids SET item_name = ? WHERE scope = ? AND item_name = ?", (nn, scope, orig))
                    
                    if depth == 0:
                        c.execute("UPDATE persistent_ids SET scope = ? WHERE scope = ?", (nn, orig))
                        c.execute("SELECT scope FROM persistent_ids WHERE scope LIKE ?", (f"{orig}_%",))
                        for row in c.fetchall():
                            old_sc = row[0]
                            new_sc = old_sc.replace(f"{orig}_", f"{nn}_", 1)
                            c.execute("UPDATE persistent_ids SET scope = ? WHERE scope = ?", (new_sc, old_sc))
                    elif depth == 1:
                        old_sub_scope = f"{parts[0]}_{orig}"
                        new_sub_scope = f"{parts[0]}_{nn}"
                        c.execute("UPDATE persistent_ids SET scope = ? WHERE scope = ?", (new_sub_scope, old_sub_scope))
                else:
                    sql = "UPDATE items SET "
                    updates = []
                    params = []
                    
                    if repaired_path is not None:
                        for i in range(1, 11):
                            val = repaired_path[i-1] if i <= len(repaired_path) else ""
                            updates.append(f"level_{i} = ?")
                            params.append(val)
                    
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

                conn.commit()
            finally:
                if conn: conn.close()
            
        await hass.async_add_executor_job(db_update_sync)
        broadcast_update()

    async def handle_update_image(call):
        item_id = call.data.get("item_id")
        name = call.data.get("item_name")
        img_b64 = call.data.get("image_data")
        icon_key = call.data.get("icon_key")

        mime_type = call.data.get("mime_type")
        if not mime_type: mime_type = "image/jpeg"
            
        ext = ".pdf" if "pdf" in mime_type else ".jpg"
        fname = ""
        img_path_base = hass.data.get(DOMAIN, {}).get("config", {}).get("img_path", hass.config.path("www", IMG_DIR))

        if icon_key:
            fname = icon_key
        elif img_b64:
            if "," in img_b64: img_b64 = img_b64.split(",")[1]
            if not name and not item_id: name = "unknown_item" 
            fname = f"{name}_{int(time.time())}{ext}"
            await hass.async_add_executor_job(lambda: open(os.path.join(img_path_base, fname), "wb").write(base64.b64decode(img_b64)))
        
        def save():
            conn = None
            try:
                conn = get_db_connection(hass); c = conn.cursor()
                if item_id:
                    c.execute(f"UPDATE items SET image_path = ? WHERE id = ?", (fname, item_id))
                else:
                    c.execute(f"UPDATE items SET image_path = ? WHERE name = ?", (fname, name))
                conn.commit()
            finally:
                if conn: conn.close()
        await hass.async_add_executor_job(save); broadcast_update()

    async def handle_confirm_pending(call):
        item_id = call.data.get("item_id")
        name = call.data.get("name")
        qty = int(call.data.get("quantity", 1))
        parts = call.data.get("path", [])
        parts = normalize_zone_path(hass, parts)
        parts = await hass.async_add_executor_job(repair_path_against_db, hass, parts)

        def db_confirm():
            conn = None
            try:
                conn = get_db_connection(hass)
                c = conn.cursor()
                upd = ["type='item'", "name=?", "quantity=?"]
                vals = [name, qty]

                for i in range(1, 11):
                    upd.append(f"level_{i}=?")
                    vals.append(parts[i-1] if i <= len(parts) else "")

                vals.append(item_id)
                c.execute(f"UPDATE items SET {','.join(upd)} WHERE id=?", tuple(vals))
                conn.commit()
            finally:
                if conn: conn.close()

        await hass.async_add_executor_job(db_confirm)
        broadcast_update()

    async def handle_ai_action(call):
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if not use_ai: return
        mode = call.data.get("mode")
        img_b64 = call.data.get("image_data")
        
        mime_val = call.data.get("mime_type", "image/jpeg")
        
        if not img_b64 or not api_key: return
        if "," in img_b64: img_b64 = img_b64.split(",")[1]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
        prompt_text = "Identify this household item. Return ONLY the name in English or Hebrew. 2-3 words max."
        if mode == 'search': prompt_text = "Identify this item. Return only 1 keyword for searching."

        payload = {"contents": [{"parts": [{"text": prompt_text}, {"inline_data": {"mime_type": mime_val, "data": img_b64}}]}]}

        try:
            session = async_get_clientsession(hass)
            res, err = await async_gemini_api_call(session, url, payload, 60)
            if not err and res and "candidates" in res and res["candidates"]:
                text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                hass.bus.async_fire("home_organizer_ai_result", {"result": text, "mode": mode})
            elif err:
                _LOGGER.error(f"AI Error: {err}")
        except Exception as e: _LOGGER.error(f"AI Exception: {e}")

    for n, h in [
        ("add_item", handle_add), ("update_image", handle_update_image),
        ("update_stock", handle_update_stock), ("update_qty", handle_update_qty), ("delete_item", handle_delete),
        ("clipboard_action", handle_clipboard), ("paste_item", handle_paste), ("ai_action", handle_ai_action),
        ("update_item_details", handle_update_item_details), ("duplicate_item", handle_duplicate),
        ("confirm_pending", handle_confirm_pending)
    ]:
        hass.services.async_register(DOMAIN, n, h)