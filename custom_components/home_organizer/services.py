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
# [FIXED v2026.10.7 | 2026-10-07] Purpose: renaming a location left its
#   barcode memory behind.
#
#   handle_update_item_details has renamed a folder for a long time, and it
#   moved items.level_N, the folder_marker row that carries the folder's icon,
#   and persistent_ids. It did not move barcode_history, which is keyed by the
#   same level columns and is what remembers where a product lives so the next
#   scan or receipt files itself.
#
#   Measured on a real installation before the fix: renaming one room moved
#   381 items and stranded 142 barcode rows on a path that no longer existed,
#   so scanning any of those products filed it into a room that was not there.
#   After the fix all 142 move, and no row is created or deleted.
#
#   location_settings moves too, descendants included. Nothing writes that
#   table yet - the per-location shelf-life feature stopped at the CREATE
#   TABLE, and database.py says so in a comment that has been waiting for
#   this - but the locations wizard seeds it for the fridge, and a settings
#   row orphaned by a rename is worse than no row.
#
#   And a folder rename now needs two real names. orig and nn arrived straight
#   from call.data with nothing checked while the UPDATE wrote nn into the
#   level column unconditionally, so an empty new name blanked that column and
#   every item under the folder lost the only thing that said where it was.
#   Refused rather than guessed (RULE 31).
#
#   NOT a new function. Writing async_rename_location beside this would have
#   been two copies of one piece of logic, which is what RULE 33d forbids and
#   what this project has already been bitten by.
# [MODIFIED v2026.10.5 | 2026-10-05] Purpose: two questions about a barcode.
#
#   Every barcode_history writer here asks is_portable_barcode instead of
#   testing the code by hand. Two of them already carried their own
#   `not in ("0", "None", "")` test - the same bug met and patched where it
#   was found rather than at the source (RULE 33a.6).

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
    async_update_receipt_date,
    async_delete_receipt_completely,
    # [ADDED v2026.9.19] Categories now live in the database.
    async_add_category, async_rename_category, async_update_item_extras,
    is_portable_barcode,
    async_delete_category,
    # [ADDED v2026.9.27] Boxes.
    async_create_box, async_get_box, async_set_item_box, async_move_box,
    async_delete_box,
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
        # [FIXED v2026.10.1] The quantity was ignored and the insert below
        # hardcoded 1.
        #
        # The shopping list is built from items at quantity 0, so the
        # cookbook's "add the missing ingredients" - which has always sent
        # quantity: 0 - created them IN STOCK instead. Nothing reached the
        # list, and the next stock check then found every ingredient present
        # and reported the whole recipe as available.
        #
        # Absent still means 1, which is what every other caller sends, so
        # no existing behaviour changes. Clamped at zero: a negative stock
        # level has no meaning and would read as "needed" forever.
        raw_qty = call.data.get("quantity")
        try:
            add_qty = 1 if raw_qty is None else max(0, int(raw_qty))
        except (TypeError, ValueError):
            add_qty = 1
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

        # [ADDED v2026.9.30] An item can be created directly INSIDE a box.
        #
        # The box page needs the same manual add a shelf has. Inserting the
        # row and then calling set_item_box would need the new row's id, and
        # a service returns nothing - the caller would have to guess which
        # row it had just made. Creating it in place also means the box
        # invariant (box_id and the ten level columns agree) holds from the
        # first insert instead of being briefly false.
        #
        # The LEVELS come from the box, not from current_path: the box is
        # where the thing physically is. Resolved before the connection
        # below is opened, so this is not a read against its transaction.
        in_box = None
        raw_box = call.data.get("box_id")
        if raw_box and itype != 'folder':
            box_row = await async_get_box(hass, raw_box)
            if box_row:
                in_box = box_row["id"]
                parts = [box_row.get(f"level_{i}") for i in range(1, 11)]
                parts = [p for p in parts if p]
            else:
                # Fail open to the given path rather than refusing the add,
                # and say so - an item the user typed must not vanish.
                _LOGGER.warning(
                    "add_item names box %s, which does not exist - "
                    "the item is created loose", raw_box)

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
                    vals = [name, itype, add_qty, date, fname, category, sub_category, barcode, owner, season, dress_code, clothing_status, measurements]
                    qs = ["?"] * len(vals)
                    
                    for i, p in enumerate(parts): cols.append(f"level_{i+1}"); vals.append(p); qs.append("?")

                    # [ADDED v2026.9.30] Appended last, so the positional
                    # cols/vals/qs triple stays in step (RULE 33a.3).
                    if in_box:
                        cols.append("box_id"); vals.append(in_box); qs.append("?")

                    await db.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})", tuple(vals))
                    
                    # [MODIFIED v2026.10.4] See normalize_barcode: "None"
                    # passed this test and became a barcode_history row that
                    # every later scan inherited.
                    if is_portable_barcode(barcode):
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

        # [ADDED v2026.9.27] A box takes its contents with it.
        #
        # async_get_box returns None for anything that is not a box, so it is
        # both the test and the lookup. The move itself is one transaction over
        # there - the box row and everything carrying its box_id - because two
        # separate statements could leave a box on the new shelf with its
        # contents still on the old one, which is the exact thing boxes exist
        # to prevent.
        if item_id and await async_get_box(hass, item_id):
            await async_move_box(hass, item_id, target_path)
            hass.data[DOMAIN]["clipboard"] = None
            broadcast_update()
            return

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

    # [ADDED v2026.9.27] Boxes.
    #
    # A box is created where the user is standing, so the path is normalised
    # and repaired exactly as handle_add does it - a box filed under a
    # mistyped room would be a box nobody finds again.
    async def handle_add_box(call):
        title = call.data.get("title")
        parts = call.data.get("current_path", [])
        parts = await async_normalize_zone_path(hass, parts)
        parts = await async_repair_path_against_db(hass, parts)
        box = await async_create_box(hass, title, parts,
                                     call.data.get("new_items"))
        if box:
            broadcast_update()

    # One service for putting an item in a box, moving it to another box and
    # taking it out, because they are one operation. box_id of 0, "" or None
    # all mean out.
    async def handle_set_item_box(call):
        item_id = call.data.get("item_id")
        raw = call.data.get("box_id")
        try:
            box_id = int(raw) if raw not in (None, "", 0, "0") else None
        except (TypeError, ValueError):
            box_id = None
        if await async_set_item_box(hass, item_id, box_id):
            broadcast_update()

    # The two-tap move, for the picker on the box card. The clipboard route
    # below reaches the same database function.
    async def handle_move_box(call):
        box_id = call.data.get("box_id")
        parts = call.data.get("target_path", [])
        parts = await async_normalize_zone_path(hass, parts)
        parts = await async_repair_path_against_db(hass, parts)
        if await async_move_box(hass, box_id, parts):
            broadcast_update()

    # Deleting a box empties it onto the shelf. It never deletes an item
    # (RULE 5) - see async_delete_box.
    async def handle_delete_box(call):
        box_id = call.data.get("box_id")
        if await async_delete_box(hass, box_id):
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
        # [ADDED v2026.9.30] What kind of box it is. Set from the box
        # page's three-dot menu; this handler already writes any item
        # field by id, so a service of its own would only add a third
        # place for hassfest to disagree with (RULE 33c).
        box_type = call.data.get("box_type")
        new_path = call.data.get("new_path")
        order_qty = call.data.get("order_qty")
        # [ADDED v2026.9.20] Answer the scanner's category proposal.
        #
        # Explicit rather than implied. Setting a category could have been
        # taken to mean the proposal was answered, but update_item_details
        # is also how the icon picker writes a category, and choosing a
        # picture is not an answer to a question about shelves. A caller
        # that means "this is answered" says so (RULE 33a.8).
        clear_suggestion = bool(call.data.get("clear_suggestion"))
        
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
                    # [ADDED v2026.10.7] A folder rename needs two real names.
                    #
                    # orig and nn arrive straight from call.data with nothing checked, and
                    # the UPDATE below writes nn into the level column unconditionally - so
                    # an empty new name blanked the column and every item under that folder
                    # lost the only thing that said where it was. Refused instead of
                    # guessed (RULE 31).
                    orig = str(orig or "").strip()
                    nn = str(nn or "").strip()
                    if not orig or not nn:
                        _LOGGER.warning(
                            "[HO-LOC] Refused a folder rename with an empty name: "
                            "%r -> %r. Nothing was changed.", orig, nn,
                        )
                        return
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

                        # [ADDED v2026.10.7] The barcode memory moves with the folder.
                        #
                        # Measured on a real installation: renaming one room moved 381 items
                        # and left 142 barcode_history rows pointing at the old path, so the
                        # next scan of any of those products filed it into a room that was
                        # not there any more. barcode_history carries level_1..level_3 only.
                        if depth < 3:
                            bh_col = f"level_{depth+1}"
                            bh_where = f"{bh_col} = ?"
                            bh_args = [orig]
                            for i, p in enumerate(parts):
                                bh_where += f" AND level_{i+1} = ?"
                                bh_args.append(p)
                            await db.execute(
                                f"UPDATE barcode_history SET {bh_col} = ? WHERE {bh_where}",
                                [nn] + bh_args,
                            )
                        
                        # [ADDED v2026.10.7] And the per-location settings, which are keyed BY
                        # the path. Nothing writes that table yet - the shelf-life feature
                        # stopped at the CREATE TABLE - but the locations wizard seeds it for
                        # the fridge, and a settings row orphaned by a rename is worse than no
                        # row at all. Descendants move too: renaming a room has to carry the
                        # settings of every shelf inside it.
                        old_key = " > ".join(list(parts) + [orig])
                        new_key = " > ".join(list(parts) + [nn])
                        await db.execute(
                            "UPDATE OR IGNORE location_settings SET location_path = ? "
                            "WHERE location_path = ?", (new_key, old_key),
                        )
                        await db.execute(
                            "UPDATE OR IGNORE location_settings "
                            "SET location_path = ? || substr(location_path, ?) "
                            "WHERE location_path LIKE ?",
                            (new_key, len(old_key) + 1, old_key + " > %"),
                        )
                        
                        _LOGGER.info(
                            "[HO-LOC] Folder renamed at depth %d: %r -> %r (path=%r)",
                            depth, orig, nn, list(parts),
                        )

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
                    # [ADDED v2026.9.20] Same reason as handle_update_image: choosing a
                    # library icon has to clear a drawn one, or the drawing keeps
                    # winning and the choice does nothing. Only when an image_path was
                    # actually supplied - an omitted argument still means leave alone
                    # (RULE 33a.8).
                    # An empty string clears it and None leaves it alone,
                    # which is what lets the sheet remove a type without
                    # a second action (RULE 33a.8).
                    if box_type is not None: updates.append("box_type = ?"); params.append(box_type)
                    if image_path is not None: updates.append("image_path = ?"); params.append(image_path); updates.append("icon_spec = NULL")
                    if order_qty is not None: updates.append("order_qty = ?"); params.append(order_qty)
                    if clear_suggestion: updates.append("suggested_category = NULL")
                    
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
                            # [MODIFIED v2026.10.4] This site already knew
                            # about "None" and tested for it inline. The
                            # test lives in one place now, so the writers
                            # that did NOT know cannot stay wrong.
                            if is_portable_barcode(row[0] if row else None):
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
                    # [ADDED v2026.9.20] A picture REPLACES a drawing.
                    #
                    # getItemIcon prefers a drawn icon over image_path, so without this
                    # an item the assistant had once drawn could never be given a
                    # library icon or a photo again - the new choice would be stored
                    # and nothing on screen would change. Clearing icon_spec in the
                    # same statement makes the choice a real one.
                    await db.execute("UPDATE items SET image_path = ?, icon_spec = NULL WHERE id = ?", (fname, item_id))
                    
                    async with db.execute("SELECT barcode, name, category, sub_category, image_path, level_1, level_2, level_3 FROM items WHERE id=?", (item_id,)) as cursor:
                        row = await cursor.fetchone()
                    # [MODIFIED v2026.10.4] As above: one rule, not a copy.
                    if is_portable_barcode(row[0] if row else None):
                        await db.execute('''
                            REPLACE INTO barcode_history (barcode, name, category, sub_category, icon_key, level_1, level_2, level_3)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]))
                else:
                    await db.execute("UPDATE items SET image_path = ?, icon_spec = NULL WHERE name = ?", (fname, name))
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

    async def handle_delete_category(call):
        """Delete a category or sub-category and re-file its items.

        Item rows are never deleted. The data layer re-files them first and
        removes the label second, on one commit, and refuses outright if the
        destination does not exist (RULE 5, RULE 31).

        The outcome is returned to the caller AND logged. A delete that was
        refused has to be distinguishable from one that did nothing because
        there was nothing to do (RULE 10).
        """
        try:
            res = await async_delete_category(
                hass,
                call.data.get("category"),
                call.data.get("sub_category"),
                call.data.get("to_category"),
                call.data.get("to_sub_category"),
            )
            if res.get("ok"):
                _LOGGER.info(
                    "delete_category: removed %s rows, re-filed %s items "
                    "(category=%r sub=%r -> %r/%r)",
                    res.get("removed"), res.get("moved"),
                    call.data.get("category"), call.data.get("sub_category"),
                    call.data.get("to_category"),
                    call.data.get("to_sub_category"),
                )
                broadcast_update()
            else:
                _LOGGER.warning(
                    "delete_category refused (%s): category=%r sub=%r "
                    "-> %r/%r. Nothing was changed.",
                    res.get("reason"),
                    call.data.get("category"), call.data.get("sub_category"),
                    call.data.get("to_category"),
                    call.data.get("to_sub_category"),
                )
            return res
        except Exception as e:
            _LOGGER.error(f"Service delete category error: {e}")
            return {"ok": False, "reason": "error", "moved": 0, "removed": 0}

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

    async def handle_set_receipt_date(call):
        """Correct the date printed on one receipt.

        Stored on the receipt rather than the item for the same reason as
        the currency: every line of one receipt was bought on the same day.
        The item's own item_date stays the day it was scanned.

        The value is validated in async_update_receipt_date, which refuses
        anything that is not YYYY-MM-DD rather than storing NULL - the
        expenses queries filter dates with LIKE, so a wrong shape would
        silently drop the receipt out of its month.
        """
        try:
            ok = await async_update_receipt_date(
                hass, call.data.get("receipt_id"),
                call.data.get("purchase_date"),
            )
            if ok:
                broadcast_update()
            else:
                _LOGGER.warning(
                    "set_receipt_date refused receipt=%r date=%r; "
                    "nothing was written.",
                    call.data.get("receipt_id"),
                    call.data.get("purchase_date"),
                )
        except Exception as e:
            _LOGGER.error(f"Service set receipt date error: {e}")

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
                    "purchase_price, quantity_purchased, receipt_id, unit, "
                    # [ADDED v2026.9.30] box_id is APPENDED, never inserted.
                    # This row is read positionally below, and a column added
                    # in the middle shifts every field after it (RULE 33a.3).
                    "box_id "
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
                box_id_val = row[8] if row else None

                # [ADDED v2026.9.30] An item in a box takes its levels FROM
                # the box, not from the path in the review tab.
                #
                # This UPDATE rewrote all ten level columns from that path
                # and never looked at box_id, so approving an item that had
                # been put in a box left it linked to the box while its
                # levels pointed somewhere else - and the box invariant is
                # exactly what lets every other feature find a boxed item by
                # location without knowing that boxes exist.
                #
                # A box is a physical container: what is inside it is where
                # it is. Moving the item out is a separate, deliberate action
                # (set_item_box), never a side effect of an approval.
                #
                # Read on the SAME connection - a second connect() here would
                # be a read against a transaction this one has written to.
                box_levels = None
                if box_id_val:
                    lvl_cols = ", ".join(f"level_{i}" for i in range(1, 11))
                    async with db.execute(
                        f"SELECT {lvl_cols} FROM items "
                        f"WHERE id = ? AND type = 'box'",
                        (box_id_val,),
                    ) as bcur:
                        brow = await bcur.fetchone()
                    if brow:
                        box_levels = list(brow)
                    else:
                        # Fail open to the approval path rather than dropping
                        # the item somewhere unfindable, and say so.
                        _LOGGER.warning(
                            "Pending item %s points at box %s, which no "
                            "longer exists - using the approved path",
                            item_id, box_id_val)

                eff_levels = (
                    box_levels if box_levels is not None
                    else [parts[i] if i < len(parts) else "" for i in range(10)]
                )

                upd = ["type='item'", "name=?", "quantity=?"]
                vals = [name, qty]

                for i in range(1, 11):
                    upd.append(f"level_{i}=?")
                    vals.append(eff_levels[i-1])

                vals.append(item_id)
                await db.execute(f"UPDATE items SET {','.join(upd)} WHERE id=?", tuple(vals))
                
                # [MODIFIED v2026.10.4] The same rule as every other writer.
                if is_portable_barcode(bcode):
                    # [MODIFIED v2026.9.30] The effective levels, so a box
                    # is remembered too. This row pre-fills the next scan of
                    # the same barcode; recording the approval path would
                    # offer a location the item is not in.
                    l1 = eff_levels[0] or ""
                    l2 = eff_levels[1] or ""
                    l3 = eff_levels[2] or ""
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
                        # [ADDED v2026.9.22] The item's own category, read
                        # above with the rest of the row. This is what the
                        # spending breakdown sums by: one supermarket
                        # receipt is food AND a toy AND sunscreen, and the
                        # receipt cannot say that - only its lines can.
                        # Taken at approval, so a category the user fixed
                        # in the review tab is the one recorded.
                        "category": cat,
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
        # [ADDED v2026.9.27] Boxes. item_id and box_id address rows, so they
        # are validated before the handler sees them.
        "add_box": vol.Schema(
            {
                vol.Required("title"): cv.string,
                vol.Optional("current_path"): vol.Any([cv.string], None),
                vol.Optional("new_items"): vol.Any([cv.string], None),
            }
        ),
        "set_item_box": vol.Schema(
            {
                vol.Required("item_id"): vol.Any(int, cv.string),
                # None, "" and 0 all mean "take it out of its box".
                vol.Optional("box_id"): vol.Any(int, cv.string, None),
            }
        ),
        "move_box": vol.Schema(
            {
                vol.Required("box_id"): vol.Any(int, cv.string),
                vol.Optional("target_path"): vol.Any([cv.string], None),
            }
        ),
        "delete_box": vol.Schema(
            {
                vol.Required("box_id"): vol.Any(int, cv.string),
            }
        ),
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
        "delete_category": vol.Schema(
            {
                vol.Required("category"): cv.string,
                vol.Optional("sub_category"): vol.Any(cv.string, None),
                vol.Optional("to_category"): vol.Any(cv.string, None),
                vol.Optional("to_sub_category"): vol.Any(cv.string, None),
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
        "set_receipt_date": vol.Schema(
            {
                vol.Required("receipt_id"): vol.Coerce(int),
                vol.Required("purchase_date"): cv.string,
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
        ("set_receipt_date", handle_set_receipt_date),
        ("delete_receipt", handle_delete_receipt),
        ("add_category", handle_add_category), ("rename_category", handle_rename_category),
        ("delete_category", handle_delete_category),
        ("update_item_extras", handle_update_item_extras),
        ("clear_all_items", handle_clear_all_items), ("clear_all_data", handle_clear_all_data),
        # [ADDED v2026.9.27] Boxes.
        ("add_box", handle_add_box), ("set_item_box", handle_set_item_box),
        ("move_box", handle_move_box), ("delete_box", handle_delete_box),
    ]:
        hass.services.async_register(DOMAIN, n, h, schema=SCHEMAS.get(n))