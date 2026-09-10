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
# [MODIFIED v8.57.0 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O. Replaced get_db_connection with get_db_path and removed async_add_executor_job wrappers.
# [MODIFIED v7.18.2 | 2026-04-20] Purpose: Added handle_update_order_qty service and order_qty extraction to handle_update_item_details so shopping list amounts save permanently to the database.

import logging
import os
import base64
import time
import homeassistant.util.dt as dt_util
import aiosqlite
import re
import voluptuous as vol
import homeassistant.helpers.config_validation as cv

from .const import DOMAIN, IMG_DIR
from .database import (
    get_db_path, async_normalize_zone_path, async_repair_path_against_db,
    # [ADDED v2026.9.6 | STAGE 2] Purchase history is now written when an
    # item is approved, not when the document is scanned.
    async_record_purchase, async_activate_receipt, async_get_receipt,
    # [ADDED v2026.9.11] Discard an entire unreviewed scan.
    async_delete_draft_scan, async_update_receipt_currency,
    async_delete_receipt_completely,
    # [ADDED v2026.9.19] Categories now live in the database.
    async_add_category, async_rename_category, async_update_item_extras,
)
from .ai_logic import async_smart_router

_LOGGER = logging.getLogger(__name__)

# [ADDED v2026.9.16] Double-confirmation code for destructive deletion.
#
# A second confirmation step, not a password. It is not secret, it is the
# same for every user, and it grants no access - Home Assistant has already
# authenticated whoever reached this point. It exists only so an accidental
# tap cannot erase a receipt and its price history, in the same spirit as
# typing a repository name before deleting it. The message shown to the user
# states this outright, so nobody mistakes it for protection the data does
# not actually have.
DELETE_CONFIRM_CODE = "1234"

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
            fname = _safe_filename_part(icon_key, fallback="icon")
        elif img_b64:
            try:
                if "," in img_b64: img_b64 = img_b64.split(",")[1]
                fname = f"img_{int(time.time())}.jpg"
                target = os.path.join(img_path_base, fname)

                def _write_image():
                    with open(target, "wb") as f:
                        f.write(base64.b64decode(img_b64))

                await hass.async_add_executor_job(_write_image)
            except Exception as img_err:
                _LOGGER.warning("Could not store item image: %s", img_err)

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
        today = dt_util.now().strftime("%Y-%m-%d")
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
        today = dt_util.now().strftime("%Y-%m-%d")
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

    def _safe_filename_part(value, fallback="item"):
        """Reduce a caller-supplied name to a single safe filename segment.

        [ADDED v2026.8.28] item_name reached os.path.join() verbatim, and
        os.path.join does not neutralise "..", so a name like
        "../../configuration" wrote attacker-controlled bytes outside the
        image directory. Any authenticated user can call a domain service,
        and the agents drive these same services, so this was reachable from
        the model too.

        basename() strips any directory component; the whitelist then keeps
        only characters that cannot form a path or escape a segment.
        """
        text = os.path.basename(str(value or ""))
        # \w keeps unicode letters, so Hebrew and other non-Latin item
        # names stay readable; everything that could form or escape a
        # path segment (/, \\, ., :, null) is replaced.
        text = re.sub(r"[^\w\-]+", "_", text, flags=re.UNICODE).strip("._-")
        return text[:80] or fallback

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
            # [MODIFIED v2026.8.28] icon_key is caller-supplied and is stored in
            # image_path, where it is later resolved as a filename.
            fname = _safe_filename_part(icon_key, fallback="icon")
        elif img_b64:
            if "," in img_b64: img_b64 = img_b64.split(",")[1]
            if not name and not item_id: name = "unknown_item" 
            # [MODIFIED v2026.8.28] Sanitised: see _safe_filename_part.
            fname = f"{_safe_filename_part(name)}_{int(time.time())}{ext}"
            target = os.path.join(img_path_base, fname)
            # [ADDED v2026.8.28] Independent second guard: never write outside
            # the image directory, even if the sanitiser is later weakened.
            if os.path.commonpath(
                [os.path.abspath(img_path_base), os.path.abspath(target)]
            ) != os.path.abspath(img_path_base):
                _LOGGER.error("Refusing image write outside %s", img_path_base)
                return

            def _write_image():
                with open(target, "wb") as f:
                    f.write(base64.b64decode(img_b64))

            await hass.async_add_executor_job(_write_image)
        
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

    async def handle_update_item_extras(call):
        """Save a manually entered price or expiry/warranty date."""
        try:
            fields = {}
            # Presence, not truthiness: 0 is a valid price and None is a
            # deliberate clear, so both must survive the check.
            for key in ("purchase_price", "expiry_date", "warranty_end_date"):
                if key in call.data:
                    fields[key] = call.data.get(key)
            if await async_update_item_extras(hass, call.data.get("item_id"), fields):
                broadcast_update()
        except Exception as e:
            _LOGGER.error(f"Service update item extras error: {e}")

    async def handle_add_category(call):
        """Add a category or sub-category. Never deletes or replaces.

        Callable both by the panel, when the user picks "Add" in a dropdown,
        and by the scanner when it proposes a sub-category that genuinely has
        no close match. `source` records which, so the two can be told apart
        later without guessing.
        """
        try:
            result = await async_add_category(
                hass,
                call.data.get("category"),
                call.data.get("sub_category"),
                call.data.get("unit"),
                call.data.get("source", "user"),
            )
            if result:
                broadcast_update()
        except Exception as e:
            _LOGGER.error(f"Service add category error: {e}")

    async def handle_rename_category(call):
        """Rename a category or sub-category, moving its items with it."""
        try:
            ok = await async_rename_category(
                hass,
                call.data.get("category"),
                call.data.get("sub_category"),
                call.data.get("new_category"),
                call.data.get("new_sub_category"),
            )
            if ok:
                broadcast_update()
        except Exception as e:
            _LOGGER.error(f"Service rename category error: {e}")

    async def handle_delete_receipt(call):
        """Delete a receipt outright, with its files and its price history.

        The four-digit code is a deliberate speed bump, not authentication. It
        exists so a mis-tap on a phone cannot wipe a receipt, in the same
        spirit as typing a repository name before deleting it. It is checked
        here as well as in the panel because a service is callable from
        anywhere on the bus, and a guard that only lives in the UI is not a
        guard at all.

        It is NOT a password: it is not secret, not per-user, and grants no
        privilege. Home Assistant has already authenticated whoever reached
        this point; this only asks "did you mean to".
        """
        if str(call.data.get("confirm_code", "")).strip() != DELETE_CONFIRM_CODE:
            _LOGGER.warning("delete_receipt refused: confirmation code did not match.")
            return
        try:
            result = await async_delete_receipt_completely(
                hass, call.data.get("receipt_id")
            )
            if result:
                broadcast_update()
        except Exception as e:
            _LOGGER.error(f"Service delete receipt error: {e}")

    async def handle_set_receipt_currency(call):
        """Correct the currency of one receipt.

        Stored on the receipt rather than the item because every line of a
        single receipt is in the same currency; keeping it per item would let
        the two drift apart. The value is validated in
        async_update_receipt_currency, which rejects anything that is not a
        three-letter ISO code.
        """
        try:
            ok = await async_update_receipt_currency(
                hass, call.data.get("receipt_id"), call.data.get("currency")
            )
            if ok:
                broadcast_update()
        except Exception as e:
            _LOGGER.error(f"Service set receipt currency error: {e}")

    async def handle_delete_scan(call):
        """Discard a whole scan while it is still unreviewed.

        The guard lives in async_delete_draft_scan rather than here. A service
        is a public entry point that anything on the bus can call, so the rule
        protecting recorded spending has to sit at the data layer where it
        cannot be bypassed.
        """
        receipt_id = call.data.get("receipt_id")
        try:
            result = await async_delete_draft_scan(hass, receipt_id)
            if result:
                broadcast_update()
            else:
                _LOGGER.warning(
                    "delete_scan refused for receipt %s: it is no longer a "
                    "draft, or some of its items were already approved.",
                    receipt_id,
                )
        except Exception as e:
            _LOGGER.error(f"Service delete scan error: {e}")

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
                # [MODIFIED v2026.9.6 | STAGE 2] The purchase fields are read
                # here so the history row can be written from the values as
                # they stand at approval time - after any correction the
                # user made in the review tab, not the raw model output.
                async with db.execute(
                    "SELECT barcode, image_path, category, sub_category, "
                    "purchase_price, quantity_purchased, receipt_id, unit "
                    "FROM items WHERE id=?", (item_id,)
                ) as cursor:
                    row = await cursor.fetchone()
                
                bcode = row[0] if row else "0"
                icon_k = row[1] if row else ""
                cat = row[2] if row else ""
                scat = row[3] if row else ""
                purchase_price = row[4] if row else None

                # [ADDED v2026.9.11] A price corrected in the review tab
                # wins over whatever the model read.
                #
                # This is the last chance to fix it: purchase_history is
                # written a few lines below and is never updated again, so
                # a misread 49.0 that slipped through here would stay in
                # the price trend permanently.
                #
                # 'not in call.data' rather than a falsy check, because 0
                # is a legitimate price and None means 'still unknown'.
                if "purchase_price" in call.data:
                    corrected = call.data.get("purchase_price")
                    purchase_price = corrected
                    await db.execute(
                        "UPDATE items SET purchase_price = ? WHERE id = ?",
                        (corrected, item_id),
                    )
                qty_purchased = row[5] if row else None
                receipt_id = row[6] if row else None
                item_unit = row[7] if row else None

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

            # [ADDED v2026.9.6 | STAGE 2] Record the purchase, now that a human
            # has confirmed this line is real.
            #
            # Deliberately outside the transaction above. purchase_history is
            # append-only and is never read back by the approval itself, so a
            # failure here must not roll back the approval the user just made.
            # The name and quantity come from the approval call, which is what
            # the user actually confirmed on screen.
            if receipt_id:
                receipt = await async_get_receipt(hass, receipt_id)
                if receipt:
                    await async_record_purchase(hass, {
                        "barcode": bcode,
                        "name": name,
                        "unit": item_unit,
                        "unit_price": purchase_price,
                        "quantity": qty_purchased if qty_purchased is not None else qty,
                        "currency": receipt.get("currency"),
                        "purchase_date": receipt.get("purchase_date"),
                        "vendor": receipt.get("vendor"),
                        "receipt_id": receipt_id,
                    })
                # The first approved line promotes the receipt out of 'draft',
                # which is what lets it count towards spending totals. Later
                # approvals are no-ops.
                await async_activate_receipt(hass, receipt_id)
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

    # [ADDED v2026.8.28] Schema for the service that accepts a file payload.
    # It was registered bare, so item_name arrived completely unvalidated.
    SCHEMAS = {
        # [ADDED v2026.9.11] receipt_id is the only field and must be an
        # integer: this service deletes rows, so an unvalidated value has
        # no business reaching the handler.
        "update_item_extras": vol.Schema(
            {
                vol.Required("item_id"): vol.Any(int, cv.string),
                vol.Optional("purchase_price"): vol.Any(float, int, None),
                vol.Optional("expiry_date"): vol.Any(cv.string, None),
                vol.Optional("warranty_end_date"): vol.Any(cv.string, None),
            }
        ),
        "add_category": vol.Schema(
            {
                vol.Required("category"): cv.string,
                vol.Optional("sub_category"): vol.Any(cv.string, None),
                vol.Optional("unit"): vol.Any(cv.string, None),
                vol.Optional("source"): cv.string,
            }
        ),
        "rename_category": vol.Schema(
            {
                vol.Required("category"): cv.string,
                vol.Optional("sub_category"): vol.Any(cv.string, None),
                vol.Optional("new_category"): vol.Any(cv.string, None),
                vol.Optional("new_sub_category"): vol.Any(cv.string, None),
            }
        ),
        "delete_receipt": vol.Schema(
            {
                vol.Required("receipt_id"): vol.Coerce(int),
                vol.Required("confirm_code"): cv.string,
            }
        ),
        "set_receipt_currency": vol.Schema(
            {
                vol.Required("receipt_id"): vol.Coerce(int),
                vol.Required("currency"): cv.string,
            }
        ),
        "delete_scan": vol.Schema(
            {
                vol.Required("receipt_id"): vol.Coerce(int),
            }
        ),
        "update_image": vol.Schema(
            {
                vol.Optional("item_id"): vol.Any(int, cv.string),
                vol.Optional("item_name"): cv.string,
                vol.Optional("image_data"): cv.string,
                vol.Optional("icon_key"): cv.string,
                vol.Optional("mime_type"): cv.string,
            }
        ),
    }

    for n, h in [
        ("add_item", handle_add), ("update_image", handle_update_image),
        ("update_stock", handle_update_stock), ("update_qty", handle_update_qty), 
        ("update_order_qty", handle_update_order_qty), ("delete_item", handle_delete),
        ("clipboard_action", handle_clipboard), ("paste_item", handle_paste), ("ai_action", handle_ai_action),
        ("update_item_details", handle_update_item_details), ("duplicate_item", handle_duplicate),
        ("confirm_pending", handle_confirm_pending), ("clear_barcode_history", handle_clear_barcode_history),
        ("delete_scan", handle_delete_scan),
        ("set_receipt_currency", handle_set_receipt_currency),
        ("delete_receipt", handle_delete_receipt),
        ("add_category", handle_add_category), ("rename_category", handle_rename_category),
        ("update_item_extras", handle_update_item_extras),
        ("clear_all_items", handle_clear_all_items), ("clear_all_data", handle_clear_all_data)
    ]:
        hass.services.async_register(DOMAIN, n, h, schema=SCHEMAS.get(n))