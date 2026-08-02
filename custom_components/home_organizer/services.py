# -*- coding: utf-8 -*-
# [MODIFIED v8.57.0 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O. Replaced get_db_connection with get_db_path and removed async_add_executor_job wrappers.
# [MODIFIED v7.18.2 | 2026-04-20] Purpose: Added handle_update_order_qty service and order_qty extraction to handle_update_item_details so shopping list amounts save permanently to the database.
# [MODIFIED v7.17.0 | 2026-04-16] Purpose: Added extraction and DB routing for Stylist item fields (owner, season, dress_code, clothing_status, measurements) during add_item and update_item_details.

import logging
import os
import base64
import time
from datetime import datetime
import aiosqlite

from .const import DOMAIN, IMG_DIR
from .database import get_db_path, async_add_item_db_safe, async_normalize_zone_path, async_repair_path_against_db
from .ai_logic import async_smart_router

_LOGGER = logging.getLogger(__name__)

async def register_services(hass, entry):
    def broadcast_update():
        hass.bus.async_fire("home_organizer_db_update")

    async def handle_add(call):
        name = call.data.get("item_name"); itype = call.data.get("item_type", "item")
        date = call.data.get("item_date"); img_b64 = call.data.get("image_data")
        category = call.data.get("category", "")
        sub_category = call.data.get("sub_category", "")
        icon_key = call.data.get("icon_key", None)
        barcode = call.data.get("barcode", "0")
        
        owner = call.data.get("owner", "")
        season = call.data.get("season", "")
        dress_code = call.data.get("dress_code", "")
        clothing_status = call.data.get("clothing_status", "Clean")
        measurements = call.data.get("measurements", "")
        
        fname = ""
        img_path_base = hass.data.get(DOMAIN, {}).get("config", {}).get("img_path", hass.config.path("www", IMG_DIR))
        
        if icon_key:
            fname = icon_key
        elif img_b64:
            try:
                if "," in img_b64: img_b64 = img_b64.split(",")[1]
                fname = f"img_{int(time.time())}.jpg"
                await hass.async_add_executor_job(lambda: open(os.path.join(img_path_base, fname), "wb").write(base64.b64decode(img_b64)))
            except: pass

        parts = call.data.get("current_path", [])
        parts = await async_normalize_zone_path(hass, parts)
        parts = await async_repair_path_against_db(hass, parts)
        depth = len(parts)
        
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                if itype == 'folder':
                    if depth >= 10: return
                    cols = ["name", "type", "quantity", "item_date", "image_path", "category", "sub_category", "barcode"]
                    vals = [f"[Folder] {name}", "folder_marker", 0, date, fname, category, sub_category, barcode]
                    qs = ["?"] * len(vals)
                    
                    for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")
                    cols.append(f"level_{depth+1}"); vals.append(name); qs.append("?")
                    
                    await db.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
                else:
                    cols = ["name", "type", "quantity", "item_date", "image_path", "category", "sub_category", "barcode", "owner", "season", "dress_code", "clothing_status", "measurements"]
                    vals = [name, itype, 1, date, fname, category, sub_category, barcode, owner, season, dress_code, clothing_status, measurements]
                    qs = ["?"] * len(vals)
                    
                    for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")

                    await db.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
                    
                    if barcode and barcode != "0":
                        l1 = parts[0] if len(parts) > 0 else ""
                        l2 = parts[1] if len(parts) > 1 else ""
                        l3 = parts[2] if len(parts) > 2 else ""
                        await db.execute('''
                            REPLACE INTO barcode_history (barcode, name, category, sub_category, icon_key, level_1, level_2, level_3)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (barcode, name, category, sub_category, fname, l1, l2, l3))
                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service add error: {e}")

        broadcast_update()
        
    async def handle_duplicate(call):
        item_id = call.data.get("item_id")
        if not item_id: return
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                async with db.execute("PRAGMA table_info(items)") as cursor:
                    columns = [col[1] for col in await cursor.fetchall() if col[1] not in ('id', 'created_at')]
                col_str = ", ".join(columns)
                await db.execute(f"INSERT INTO items ({col_str}) SELECT {col_str} FROM items WHERE id = ?", (item_id,))
                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service duplicate error: {e}")
        broadcast_update()

    async def handle_update_qty(call):
        item_id = call.data.get("item_id")
        change = int(call.data.get("change"))
        today = datetime.now().strftime("%Y-%m-%d")
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                if item_id:
                    await db.execute("UPDATE items SET quantity = MAX(0, quantity + ?), item_date = ? WHERE id = ?", (change, today, item_id))
                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service update qty error: {e}")
        broadcast_update()

    async def handle_update_order_qty(call):
        item_id = call.data.get("item_id")
        change = int(call.data.get("change"))
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                if item_id:
                    await db.execute("UPDATE items SET order_qty = MAX(1, COALESCE(order_qty, 1) + ?) WHERE id = ?", (change, item_id))
                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service update order qty error: {e}")
        broadcast_update()

    async def handle_update_stock(call):
        item_id = call.data.get("item_id")
        qty = int(call.data.get("quantity"))
        today = datetime.now().strftime("%Y-%m-%d")
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                if item_id:
                    await db.execute("UPDATE items SET quantity = ?, item_date = ? WHERE id = ?", (qty, today, item_id))
                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service update stock error: {e}")
        broadcast_update()

    async def handle_delete(call):
        item_id = call.data.get("item_id")
        name = call.data.get("item_name")
        parts = call.data.get("current_path", [])
        parts = await async_normalize_zone_path(hass, parts)
        is_folder = call.data.get("is_folder", False)

        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                if is_folder:
                    depth = len(parts)
                    target_col = f"level_{depth+1}"
                    conditions = [f"{target_col} = ?"]
                    args = [name]
                    for i, p in enumerate(parts):
                        conditions.append(f"level_{i+1} = ?")
                        args.append(p)
                    await db.execute(f"DELETE FROM items WHERE {' AND '.join(conditions)}", tuple(args))
                else:
                    if item_id:
                        await db.execute("DELETE FROM items WHERE id = ?", (item_id,))
                    else:
                        await db.execute("DELETE FROM items WHERE name = ?", (name,))
                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service delete error: {e}")
        broadcast_update()

    async def handle_paste(call):
        target_path = call.data.get("target_path")
        target_path = await async_normalize_zone_path(hass, target_path)
        target_path = await async_repair_path_against_db(hass, target_path)
        clipboard = hass.data.get(DOMAIN, {}).get("clipboard") 
        if not clipboard: return
        
        item_id = clipboard.get("id") if isinstance(clipboard, dict) else None
        item_name = clipboard.get("name") if isinstance(clipboard, dict) else clipboard

        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                upd = [f"level_{i} = ?" for i in range(1, 11)]
                vals = [target_path[i-1] if i <= len(target_path) else None for i in range(1, 11)]
                
                if item_id:
                    await db.execute(f"UPDATE items SET {','.join(upd)} WHERE id = ?", (*vals, item_id))
                else:
                    await db.execute(f"UPDATE items SET {','.join(upd)} WHERE name = ?", (*vals, item_name))
                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service paste error: {e}")
            
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
        order_qty = call.data.get("order_qty")
        
        owner = call.data.get("owner")
        season = call.data.get("season")
        dress_code = call.data.get("dress_code")
        clothing_status = call.data.get("clothing_status")
        measurements = call.data.get("measurements")

        parts = call.data.get("current_path", [])
        parts = await async_normalize_zone_path(hass, parts)
        is_folder = call.data.get("is_folder", False)

        repaired_path = None
        if new_path is not None:
            repaired_path = await async_normalize_zone_path(hass, new_path)
            repaired_path = await async_repair_path_against_db(hass, repaired_path)

        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                if is_folder:
                    depth = len(parts)
                    if depth < 10:
                        target_col = f"level_{depth+1}"
                        where_clause = f"{target_col} = ?"
                        where_args = [orig]
                        for i, p in enumerate(parts):
                            where_clause += f" AND level_{i+1} = ?"
                            where_args.append(p)
                        
                        await db.execute(f"UPDATE items SET {target_col} = ? WHERE {where_clause}", [nn] + where_args)
                        
                        marker_where = f"{target_col} = ?"
                        marker_args = [nn] 
                        for i, p in enumerate(parts):
                            marker_where += f" AND level_{i+1} = ?"
                            marker_args.append(p)
                        
                        await db.execute(f"UPDATE items SET name = ? WHERE type = 'folder_marker' AND name = ? AND {marker_where}", 
                                  (f"[Folder] {nn}", f"[Folder] {orig}", *marker_args))

                    scope = 'root'
                    if depth == 1: scope = parts[0]
                    elif depth == 2: scope = f"{parts[0]}_{parts[1]}"
                    await db.execute("UPDATE persistent_ids SET item_name = ? WHERE scope = ? AND item_name = ?", (nn, scope, orig))
                    
                    if depth == 0:
                        await db.execute("UPDATE persistent_ids SET scope = ? WHERE scope = ?", (nn, orig))
                        async with db.execute("SELECT scope FROM persistent_ids WHERE scope LIKE ?", (f"{orig}_%",)) as cursor:
                            for row in await cursor.fetchall():
                                old_sc = row[0]
                                new_sc = old_sc.replace(f"{orig}_", f"{nn}_", 1)
                                await db.execute("UPDATE persistent_ids SET scope = ? WHERE scope = ?", (new_sc, old_sc))
                    elif depth == 1:
                        old_sub_scope = f"{parts[0]}_{orig}"
                        new_sub_scope = f"{parts[0]}_{nn}"
                        await db.execute("UPDATE persistent_ids SET scope = ? WHERE scope = ?", (new_sub_scope, old_sub_scope))
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
                    if order_qty is not None: updates.append("order_qty = ?"); params.append(order_qty)
                    
                    if owner is not None: updates.append("owner = ?"); params.append(owner)
                    if season is not None: updates.append("season = ?"); params.append(season)
                    if dress_code is not None: updates.append("dress_code = ?"); params.append(dress_code)
                    if clothing_status is not None: updates.append("clothing_status = ?"); params.append(clothing_status)
                    if measurements is not None: updates.append("measurements = ?"); params.append(measurements)
                    
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

                        await db.execute(sql, tuple(params))
                        
                        if item_id:
                            async with db.execute("SELECT barcode, name, category, sub_category, image_path, level_1, level_2, level_3 FROM items WHERE id=?", (item_id,)) as cursor:
                                row = await cursor.fetchone()
                            if row and row[0] and str(row[0]) not in ("0", "None", ""):
                                await db.execute('''
                                    REPLACE INTO barcode_history (barcode, name, category, sub_category, icon_key, level_1, level_2, level_3)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                ''', (row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]))

                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service update details error: {e}")
            
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
        
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                if item_id:
                    await db.execute("UPDATE items SET image_path = ? WHERE id = ?", (fname, item_id))
                    
                    async with db.execute("SELECT barcode, name, category, sub_category, image_path, level_1, level_2, level_3 FROM items WHERE id=?", (item_id,)) as cursor:
                        row = await cursor.fetchone()
                    if row and row[0] and str(row[0]) not in ("0", "None", ""):
                        await db.execute('''
                            REPLACE INTO barcode_history (barcode, name, category, sub_category, icon_key, level_1, level_2, level_3)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]))
                else:
                    await db.execute("UPDATE items SET image_path = ? WHERE name = ?", (fname, name))
                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service update image error: {e}")
            
        broadcast_update()

    async def handle_confirm_pending(call):
        item_id = call.data.get("item_id")
        name = call.data.get("name")
        qty = int(call.data.get("quantity", 1))
        parts = call.data.get("path", [])
        parts = await async_normalize_zone_path(hass, parts)
        parts = await async_repair_path_against_db(hass, parts)

        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                async with db.execute("SELECT barcode, image_path, category, sub_category FROM items WHERE id=?", (item_id,)) as cursor:
                    row = await cursor.fetchone()
                
                bcode = row[0] if row else "0"
                icon_k = row[1] if row else ""
                cat = row[2] if row else ""
                scat = row[3] if row else ""

                upd = ["type='item'", "name=?", "quantity=?"]
                vals = [name, qty]

                for i in range(1, 11):
                    upd.append(f"level_{i}=?")
                    vals.append(parts[i-1] if i <= len(parts) else "")

                vals.append(item_id)
                await db.execute(f"UPDATE items SET {','.join(upd)} WHERE id=?", tuple(vals))
                
                if bcode and bcode != "0":
                    l1 = parts[0] if len(parts) > 0 else ""
                    l2 = parts[1] if len(parts) > 1 else ""
                    l3 = parts[2] if len(parts) > 2 else ""
                    await db.execute('''
                        REPLACE INTO barcode_history (barcode, name, category, sub_category, icon_key, level_1, level_2, level_3)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (bcode, name, cat, scat, icon_k, l1, l2, l3))

                await db.commit()
        except Exception as e:
            _LOGGER.error(f"Service confirm pending error: {e}")

        broadcast_update()

    async def handle_ai_action(call):
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries: return
        entry = entries[0]
        
        from .const import CONF_USE_AI
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        if not use_ai: return
        
        mode = call.data.get("mode")
        img_b64 = call.data.get("image_data")
        mime_val = call.data.get("mime_type", "image/jpeg")
        
        if not img_b64: return

        prompt_text = "Identify this household item. Return ONLY the name in English or Hebrew. 2-3 words max."
        if mode == 'search': prompt_text = "Identify this item. Return only 1 keyword for searching."

        try:
            raw_txt, err = await async_smart_router(hass, entry, prompt_text, img_b64, mime_val)
            if not err and raw_txt:
                hass.bus.async_fire("home_organizer_ai_result", {"result": raw_txt, "mode": mode})
            else:
                _LOGGER.error(f"AI Action Error: {raw_txt}")
        except Exception as e: _LOGGER.error(f"AI Action Exception: {e}")

    async def handle_clear_barcode_history(call):
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                await db.execute("DELETE FROM barcode_history")
                await db.commit()
            _LOGGER.info("Home Organizer: Barcode history cleared.")
        except Exception as e:
            _LOGGER.error(f"Error clearing barcode history: {e}")

    async def handle_clear_all_items(call):
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                await db.execute("DELETE FROM items WHERE type = 'item' OR type = 'pending'")
                await db.commit()
            _LOGGER.info("Home Organizer: All items cleared.")
        except Exception as e:
            _LOGGER.error(f"Error clearing items: {e}")
        broadcast_update()

    async def handle_clear_all_data(call):
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                await db.execute("DELETE FROM items")
                await db.execute("DELETE FROM persistent_ids")
                await db.commit()
            _LOGGER.info("Home Organizer: Entire inventory database cleared.")
        except Exception as e:
            _LOGGER.error(f"Error clearing database: {e}")
        broadcast_update()

    for n, h in [
        ("add_item", handle_add), ("update_image", handle_update_image),
        ("update_stock", handle_update_stock), ("update_qty", handle_update_qty), 
        ("update_order_qty", handle_update_order_qty), ("delete_item", handle_delete),
        ("clipboard_action", handle_clipboard), ("paste_item", handle_paste), ("ai_action", handle_ai_action),
        ("update_item_details", handle_update_item_details), ("duplicate_item", handle_duplicate),
        ("confirm_pending", handle_confirm_pending), ("clear_barcode_history", handle_clear_barcode_history),
        ("clear_all_items", handle_clear_all_items), ("clear_all_data", handle_clear_all_data)
    ]:
        hass.services.async_register(DOMAIN, n, h)