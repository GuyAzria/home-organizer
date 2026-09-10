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
# // [MODIFIED v2026.9.13 | STAGE 2] Purpose: Receipt pages now carry a
# // browser URL alongside the filesystem path. A stored path is not
# // something a browser can open; only files under config/www are served
# // by Home Assistant, at /local/.
# // [MODIFIED v2026.9.12 | STAGE 2] Purpose: Backing query for the receipts
# // table. async_list_receipts filters by vendor and date range in SQL and
# // returns the distinct vendor list for the filter control.
# // [MODIFIED v2026.9.19] Purpose: Categories move from the shipped
# // organizer-data.js into db_items_categories. A JavaScript file that
# // ships with the integration is replaced on every HACS update, so
# // anything the user or the AI added to it would be lost. The table is
# // seeded once with the exact former contents and order, and is the only
# // source of truth afterwards.
# // [MODIFIED v2026.9.11 | STAGE 2] Purpose: A scan can be discarded whole
# // while it is still a draft. Adds async_delete_draft_scan, which removes
# // the pending items, the archived page files and the receipt row - but
# // only while nothing has been approved, so no recorded spend is ever
# // destroyed.
# // [MODIFIED v2026.9.9 | STAGE 2] Purpose: All pages of a multi-image
# // receipt are now archived, not just the first. Adds the receipt_pages
# // table (one row per photograph, ordered) so the whole document can be
# // reopened later exactly as it was captured.
# // [MODIFIED v2026.9.8 | STAGE 2] Purpose: Multi-page receipts. Every
# // page of a long receipt is now sent to the model in ONE request,
# // so it reads the header from page 1, takes lines from all pages and
# // resolves the overlap between photographs itself. The earlier
# // heuristic that attached headerless scans to a recent draft has
# // been removed rather than left in place unused.
# // [MODIFIED v2026.9.6 | STAGE 2] Purpose: Receipts are inserted as
# // 'draft' and promoted to 'active' on the first approved item, and
# // purchase history is written at approval rather than at scan time.
# // Writing history at scan time meant a hallucinated line the user
# // then deleted still left a permanent row in a table that is never
# // updated or deleted.
# // [MODIFIED v2026.9.5 | STAGE 2] Purpose: Purchase history and receipt
# // file storage. Adds the `purchase_history` table (one immutable row
# // per receipt line, so price history survives an item being consumed),
# // a product_key that groups the same product across receipts with or
# // without a barcode, and async_store_receipt_file which writes the
# // scanned document to disk under an unguessable name.
# // [MODIFIED v2026.9.4 | STAGE 2] Purpose: Receipt persistence. Adds
# // async_add_item_db_safe purchase fields, receipt lookup/insert helpers
# // and a `status` column on receipts so a superseded scan is marked
# // rather than deleted - receipts are never removed.
# // [MODIFIED v2026.9.3 | STAGE 1] Purpose: Additive schema expansion for
# // expiry, warranty, purchase price, receipts and per-location shelf life.
# // Adds 7 columns to `items`, the `receipts` and `location_settings`
# // tables, and supporting indexes. Purely additive: existing rows get
# // NULL in the new columns and no existing data is read or rewritten.
# // A one-time backup of the database file is taken before the first
# // migration run.
# // [MODIFIED v8.57.0 | 2026-08-02] Purpose: Completely refactored all database operations to aiosqlite for non-blocking I/O in Home Assistant event loop. Added async_init_db, async_add_item_db_safe, and async_get_view_data.

import logging
import aiosqlite
import os
import shutil
import secrets
import base64
from functools import partial
import re
import time
from datetime import datetime, timedelta
import homeassistant.util.dt as dt_util

from .const import (
    DOMAIN, DB_FILE, IMG_DIR, CONF_API_KEY, CONF_USE_AI, 
    CONF_PROCESSING_MODE, MODE_LOCAL_ONLY, MODE_HYBRID, 
    CONF_AI_PROVIDER, PROVIDER_OPENAI, PROVIDER_GEMINI, VERSION
)

_LOGGER = logging.getLogger(__name__)

def get_db_path(hass):
    return hass.data.get(DOMAIN, {}).get("config", {}).get("db_path", hass.config.path(DB_FILE))

def _backup_db_sync(db_path, marker_path):
    """Copy the database once, before the first schema migration.

    Runs in the executor. Returns True if a backup was written.

    The marker file is what makes this run exactly once: it is written only
    after a successful copy, so an interrupted backup is retried on the next
    start rather than being skipped. shutil.copy2 preserves timestamps, which
    makes it obvious in a file listing which snapshot this is.
    """
    if os.path.exists(marker_path):
        return False
    if not os.path.exists(db_path):
        # Fresh install: there is no data to lose, so no backup is needed.
        # The marker is still written so we do not re-check on every start.
        with open(marker_path, "w", encoding="utf-8") as f:
            f.write("no pre-existing database\n")
        return False

    backup_path = f"{db_path}.pre_stage1.bak"
    shutil.copy2(db_path, backup_path)
    with open(marker_path, "w", encoding="utf-8") as f:
        f.write(backup_path + "\n")
    return True


async def async_init_db(hass):
    img_path = hass.data.get(DOMAIN, {}).get("config", {}).get("img_path", hass.config.path("www", IMG_DIR))
    # [MODIFIED v10.0.0] os.path.exists and os.makedirs are blocking disk
    # operations and were running directly on the event loop inside this
    # async function. Same class of issue as the ones raised in review.
    # NOTE: exist_ok MUST be passed by keyword. The second positional
    # parameter of os.makedirs is `mode`, not `exist_ok`.
    await hass.async_add_executor_job(
        partial(os.makedirs, img_path, exist_ok=True)
    )
    
    db_path = get_db_path(hass)

    # [ADDED v2026.9.3 | STAGE 1] One-time backup before the schema changes.
    #
    # ALTER TABLE ADD COLUMN in SQLite is a metadata-only operation and does
    # not rewrite rows, so this migration is about as safe as they get. The
    # backup exists for the cases outside our control: a power cut mid-write,
    # a full disk, or a filesystem fault. It costs one file copy, once, and
    # it is the only way back if something does go wrong on a user's machine.
    try:
        marker = f"{db_path}.stage1_backup_done"
        made = await hass.async_add_executor_job(
            _backup_db_sync, db_path, marker
        )
        if made:
            _LOGGER.info(
                "Created a one-time database backup before the schema upgrade."
            )
    except Exception as backup_err:
        # A failed backup must not stop the integration from loading. The
        # migration itself is additive, so proceeding is the safer choice.
        _LOGGER.warning("Could not create the pre-upgrade backup: %s", backup_err)

    try:
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
            await db.execute("CREATE TABLE IF NOT EXISTS persistent_ids (scope TEXT, item_name TEXT, seq_id INTEGER, PRIMARY KEY (scope, item_name))")

            await db.execute('''
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    name TEXT,
                    avatar_path TEXT,
                    body_measurements TEXT
                )
            ''')

            async with db.execute("PRAGMA table_info(items)") as cursor:
                existing_cols = [col[1] for col in await cursor.fetchall()]
            
            needed_cols = {
                'type': "TEXT DEFAULT 'item'",
                'quantity': "INTEGER DEFAULT 1",
                'order_qty': "INTEGER DEFAULT 1",
                'item_date': "TEXT",
                'image_path': "TEXT",
                'category': "TEXT",
                'sub_category': "TEXT",
                'unit': "TEXT",
                'unit_value': "TEXT",
                'barcode': "TEXT DEFAULT '0'",
                'created_at': "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                'owner': "TEXT",
                'season': "TEXT",
                'dress_code': "TEXT",
                'clothing_status': "TEXT DEFAULT 'Clean'",
                'measurements': "TEXT",

                # [ADDED v2026.9.3 | STAGE 1] Expiry / warranty / purchase.
                # All dates are TEXT in '%Y-%m-%d' to match the existing
                # `item_date` column, which the code already queries with
                # LIKE '2026-08%' for month filtering. A different format
                # would silently break those queries.
                'expiry_date': "TEXT",
                'warranty_end_date': "TEXT",
                # Unit price, not line total. Line total is price * quantity.
                'purchase_price': "REAL",
                # How many units this row was bought at that unit price, so the
                # original line total can be reconstructed from the receipt.
                'quantity_purchased': "INTEGER",
                # FK to receipts.id. No REFERENCES clause: SQLite cannot add a
                # foreign key with ALTER TABLE ADD COLUMN, and enabling
                # enforcement retroactively would fail on existing rows.
                # Integrity is enforced in code.
                'receipt_id': "INTEGER",
                # Set when the user marks an item as thrown away rather than
                # consumed. Feeds the waste metric on the expenses screen.
                'discarded': "INTEGER DEFAULT 0",
                'discarded_at': "TEXT"
            }
            
            for i in range(1, 11): 
                needed_cols[f"level_{i}"] = "TEXT"

            for col, dtype in needed_cols.items():
                if col not in existing_cols:
                    try:
                        await db.execute(f"ALTER TABLE items ADD COLUMN {col} {dtype}")
                    except Exception:
                        pass

            await db.execute('''
                CREATE TABLE IF NOT EXISTS barcode_history (
                    barcode TEXT PRIMARY KEY, 
                    name TEXT, 
                    category TEXT, 
                    sub_category TEXT, 
                    icon_key TEXT,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            async with db.execute("PRAGMA table_info(barcode_history)") as cursor:
                bh_cols = [col[1] for col in await cursor.fetchall()]
            for lvl in ["level_1", "level_2", "level_3"]:
                if lvl not in bh_cols:
                    try:
                        await db.execute(f"ALTER TABLE barcode_history ADD COLUMN {lvl} TEXT")
                    except Exception:
                        pass

            try:
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_level1 ON items(level_1)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_level2 ON items(level_2)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_level3 ON items(level_3)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode)")
                # [ADDED v2026.9.3 | STAGE 1] The expiry list and the expenses
                # screen both filter on these; without indexes those queries
                # become full table scans as the inventory grows.
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_expiry ON items(expiry_date)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_receipt ON items(receipt_id)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_discarded ON items(discarded)")
            except Exception:
                pass

            # [ADDED v2026.9.3 | STAGE 1] Receipts.
            #
            # `id` is the running identifier referenced by items.receipt_id.
            # `currency` is stored per receipt, not globally: a purchase from
            # Amazon is in USD while the local supermarket is in ILS, and
            # summing across currencies is meaningless.
            # `vendor` is part of the duplicate key because a receipt number
            # alone is not unique - two shops can both issue '0001'.
            await db.execute('''
                CREATE TABLE IF NOT EXISTS receipts (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    receipt_number  TEXT,
                    vendor          TEXT,
                    purchase_date   TEXT,
                    total_amount    REAL,
                    currency        TEXT,
                    file_path       TEXT,
                    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Duplicate detection is enforced by the database, not only by
            # application code. COLLATE NOCASE so 'Shufersal' and 'shufersal'
            # are the same vendor. The index is partial: rows where either
            # field is NULL are excluded, because a scan that failed to read a
            # receipt number must still be storable and must not collide with
            # every other unreadable receipt.
            try:
                await db.execute('''
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_unique
                    ON receipts(vendor COLLATE NOCASE, receipt_number COLLATE NOCASE)
                    WHERE vendor IS NOT NULL AND receipt_number IS NOT NULL
                ''')
                await db.execute("CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(purchase_date)")
            except Exception:
                pass

            # [ADDED v2026.9.4 | STAGE 2] Additive migration for `receipts`,
            # using the same PRAGMA + ALTER pattern as `items`, so an install
            # created by stage 1 gains the column without a rebuild.
            #
            # `status` exists because a receipt is never deleted. When a
            # re-scan supersedes an earlier partial scan, the old row is
            # marked 'superseded' and points at the new one. The spend history
            # stays intact and 'active' is the only status the expenses screen
            # will sum.
            async with db.execute("PRAGMA table_info(receipts)") as cursor:
                receipt_cols = [col[1] for col in await cursor.fetchall()]
            for col, dtype in {
                "status": "TEXT DEFAULT 'active'",
                "superseded_by": "INTEGER",
                "item_count": "INTEGER DEFAULT 0",
            }.items():
                if col not in receipt_cols:
                    try:
                        await db.execute(f"ALTER TABLE receipts ADD COLUMN {col} {dtype}")
                    except Exception:
                        pass

            # [ADDED v2026.9.19] Item categories.
            #
            # One row per (category, sub_category). cat_order and sub_order
            # preserve the ordering the old JS object had, because dictionary
            # insertion order was what the dropdowns displayed and an upgrade
            # should not reshuffle them.
            #
            # `source` records who created the row: 'default' for the seeded
            # list, 'user' for something typed in the panel, 'ai' for something
            # the scanner proposed. Nothing is ever deleted, so this is how a
            # future screen can tell them apart.
            #
            # UNIQUE on the pair, so a re-seed or a double submit cannot create
            # the same sub-category twice.
            await db.execute('''
                CREATE TABLE IF NOT EXISTS db_items_categories (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    category     TEXT NOT NULL,
                    sub_category TEXT NOT NULL,
                    unit         TEXT,
                    cat_order    INTEGER DEFAULT 999,
                    sub_order    INTEGER DEFAULT 999,
                    source       TEXT DEFAULT 'default',
                    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(category, sub_category)
                )
            ''')

            # Seeded only when empty. Re-seeding a populated table would undo
            # a rename the user made, which is exactly the failure this table
            # exists to prevent.
            async with db.execute("SELECT COUNT(*) FROM db_items_categories") as cur:
                have_categories = (await cur.fetchone())[0]
            if not have_categories:
                try:
                    from .category_seed import DEFAULT_CATEGORIES
                    await db.executemany(
                        "INSERT OR IGNORE INTO db_items_categories "
                        "(category, sub_category, unit, cat_order, sub_order, source) "
                        "VALUES (?, ?, ?, ?, ?, 'default')",
                        DEFAULT_CATEGORIES,
                    )
                    _LOGGER.info(
                        "Seeded %s default category rows.", len(DEFAULT_CATEGORIES)
                    )
                except Exception as seed_err:
                    _LOGGER.error("Category seeding failed: %s", seed_err)

                # [ADDED v2026.9.20] Adopt whatever the existing inventory
                # already uses.
                #
                # On an upgrade the items table may hold categories that were
                # never in the shipped list - written by an earlier version, by
                # the scanner, or by hand. Seeding only the defaults left those
                # items filed under a category that appeared in no dropdown, so
                # the value showed on the card but could not be chosen for
                # anything else and looked like data loss.
                #
                # Runs only inside the same "table was empty" branch, so it is a
                # one-time adoption at migration and never re-imports a category
                # the user has since renamed.
                #
                # INSERT OR IGNORE plus the UNIQUE constraint means a pair that
                # is already a default is skipped rather than duplicated.
                try:
                    async with db.execute(
                        "SELECT DISTINCT category, sub_category FROM items "
                        "WHERE category IS NOT NULL AND TRIM(category) != ''"
                    ) as cur:
                        existing_pairs = await cur.fetchall()
                    adopted = 0
                    for row in existing_pairs:
                        cat = (row[0] or "").strip()
                        sub = (row[1] or "").strip() or "General"
                        if not cat:
                            continue
                        # Appended after the defaults so the familiar ordering
                        # is untouched.
                        cursor = await db.execute(
                            "INSERT OR IGNORE INTO db_items_categories "
                            "(category, sub_category, unit, cat_order, sub_order, source) "
                            "VALUES (?, ?, 'Units', 900, 900, 'adopted')",
                            (cat, sub),
                        )
                        adopted += cursor.rowcount if cursor.rowcount and cursor.rowcount > 0 else 0
                    if adopted:
                        _LOGGER.info(
                            "Adopted %s category/sub-category pair(s) already in use "
                            "by the existing inventory.", adopted,
                        )
                except Exception as adopt_err:
                    _LOGGER.error("Adopting existing categories failed: %s", adopt_err)

            # [ADDED v2026.9.9 | STAGE 2] Pages of a scanned receipt.
            #
            # A long till receipt is photographed in several parts. Storing
            # only the first page would archive the header and throw away the
            # lines, so every page is kept.
            #
            # One row per page rather than a list of paths in the receipts row.
            # The same reasoning as items -> receipts: a list inside a column
            # cannot be indexed, cannot be joined, and breaks the moment one
            # element is removed. page_number preserves capture order, which is
            # the order a person needs to read them back in.
            await db.execute('''
                CREATE TABLE IF NOT EXISTS receipt_pages (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    receipt_id  INTEGER NOT NULL,
                    page_number INTEGER NOT NULL,
                    file_path   TEXT,
                    mime_type   TEXT,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            try:
                # Unique on (receipt, page) so a retried save cannot silently
                # create a second copy of page 2.
                await db.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_pages_unique "
                    "ON receipt_pages(receipt_id, page_number)"
                )
            except Exception:
                pass

            # [ADDED v2026.9.5 | STAGE 2] Purchase history.
            #
            # `items` is inventory: what you currently HAVE. The moment a
            # tomato is eaten and its row is deleted, the price you paid for
            # it is gone with it. Price history is a different fact - what you
            # BOUGHT, and when, and for how much - and it must outlive the
            # item. So one immutable row is written here per receipt line and
            # is never deleted or updated.
            #
            # `product_key` is what makes 'tomatoes at 1, then 6, then 4'
            # answerable. It is derived in _build_product_key(): the barcode
            # when there is one, otherwise a normalised form of the name, so
            # loose produce with no barcode still groups correctly.
            #
            # `unit` is stored because a price is only comparable within the
            # same unit. 1 per kilo and 6 per kilo is a real price change;
            # 1 per unit against 6 per kilo is not a comparison at all.
            await db.execute('''
                CREATE TABLE IF NOT EXISTS purchase_history (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_key   TEXT NOT NULL,
                    barcode       TEXT,
                    name          TEXT,
                    unit          TEXT,
                    unit_price    REAL,
                    quantity      REAL,
                    currency      TEXT,
                    purchase_date TEXT,
                    vendor        TEXT,
                    receipt_id    INTEGER,
                    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            try:
                # product_key + date is the exact shape of the history query
                # ("show me this product over time"), so it is one composite
                # index rather than two separate ones.
                await db.execute(
                    "CREATE INDEX IF NOT EXISTS idx_ph_product "
                    "ON purchase_history(product_key, purchase_date)"
                )
                await db.execute(
                    "CREATE INDEX IF NOT EXISTS idx_ph_receipt "
                    "ON purchase_history(receipt_id)"
                )
            except Exception:
                pass

            # [ADDED v2026.9.3 | STAGE 1] Per-sub-location shelf life.
            #
            # Locations are not entities in this schema - they are the
            # level_1..level_10 TEXT columns on `items`. There is therefore
            # nothing to attach a setting to, so the location path itself is
            # the key, stored exactly as the levels are joined elsewhere.
            # Renaming a location must update this table too, which is wired
            # up in a later stage.
            await db.execute('''
                CREATE TABLE IF NOT EXISTS location_settings (
                    location_path   TEXT PRIMARY KEY,
                    shelf_life_enabled INTEGER DEFAULT 0,
                    shelf_life_value   INTEGER,
                    shelf_life_unit    TEXT DEFAULT 'days',
                    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            await db.execute('''
                CREATE TABLE IF NOT EXISTS scheduled_reminders (
                    id                  TEXT PRIMARY KEY,
                    target_timestamp    TEXT NOT NULL,
                    message             TEXT NOT NULL,
                    device_id           TEXT,
                    user_id             TEXT,
                    status              TEXT NOT NULL DEFAULT 'pending',
                    entry_type          TEXT NOT NULL DEFAULT 'reminder',
                    calendar_event_id   TEXT,
                    spoken_confirmation TEXT,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fired_at            TIMESTAMP
                )
            ''')
            try:
                await db.execute("CREATE INDEX IF NOT EXISTS idx_rem_status ON scheduled_reminders(status)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_rem_target ON scheduled_reminders(target_timestamp)")
            except Exception:
                pass

            await db.commit()
    except Exception as e:
        _LOGGER.error(f"DB Init Error: {e}")

async def async_get_or_create_catalog_ids(hass):
    db_path = get_db_path(hass)
    try:
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute("CREATE TABLE IF NOT EXISTS persistent_ids (scope TEXT, item_name TEXT, seq_id INTEGER, PRIMARY KEY (scope, item_name))")
            
            async with db.execute("SELECT scope, item_name, seq_id FROM persistent_ids") as cursor:
                existing = {}
                for r in await cursor.fetchall():
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

            async with db.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE level_1 IS NOT NULL AND level_1 != ''") as cursor:
                for r in await cursor.fetchall():
                    l1, l2, l3 = r[0], r[1], r[2]
                    if l1:
                        allocate('root', l1)
                        if l2:
                            allocate(l1, l2)
                            if l3:
                                allocate(f"{l1}_{l2}", l3)
                            
            if new_inserts:
                await db.executemany("INSERT INTO persistent_ids (scope, item_name, seq_id) VALUES (?, ?, ?)", new_inserts)
                await db.commit()
            return existing
    except Exception as e:
        _LOGGER.error(f"Catalog ID Error: {e}")
        return {}

def to_alpha_id(num):
    s = ""
    while num > 0:
        rem = (num - 1) % 26
        s = chr(65 + rem) + s
        num = (num - 1) // 26
    return s or "A"

async def async_normalize_zone_path(hass, path_list):
    if not path_list or len(path_list) < 2:
        return path_list
    try:
        path_list = list(path_list)
        z_name = path_list[0]
        r_name = path_list[1]
        if str(z_name).startswith("[") and "] " in str(z_name):
            return path_list
        
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute("SELECT 1 FROM items WHERE (type='folder_marker' AND name LIKE ?) OR (level_1 LIKE ?)", (f"%_{z_name}", f"[{z_name}]%")) as cursor:
                is_zone = await cursor.fetchone()
                if is_zone:
                    return [f"[{z_name}] {r_name}"] + path_list[2:]
    except Exception as e:
        _LOGGER.error(f"Zone normalization error: {e}")
    return path_list

async def async_repair_path_against_db(hass, path_list):
    if not path_list: return path_list
    fixed = []
    try:
        db_path = get_db_path(hass)
        def get_core(s):
            return re.sub(r'\[?ORDER_MARKER_\d+\]?[_\s]*', '', str(s)).strip()

        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            for i, p in enumerate(path_list):
                col = f"level_{i+1}"
                
                async with db.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} = ? AND type != 'pending'", (p,)) as cursor:
                    if await cursor.fetchone():
                        fixed.append(p)
                        continue
                    
                async with db.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' AND type != 'pending'") as cursor:
                    existing = [row[0] for row in await cursor.fetchall()]
                
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

async def async_add_item_db_safe(hass, name, qty, path_list, category="", sub_category="", item_type="item", icon_key=None, barcode="0",
                                 purchase_price=None, quantity_purchased=None, receipt_id=None,
                                 expiry_date=None, warranty_end_date=None):
    """Insert one item row.

    [MODIFIED v2026.9.4 | STAGE 2] Three purchase fields were added at
    the end of the signature with None defaults. This function is called
    from several places that know nothing about receipts, and keeping the
    new parameters optional and last means every existing call site keeps
    working unchanged.

    A value of None is written as SQL NULL rather than 0 or "". NULL means
    "not known"; 0 would mean "free", and the expenses screen must be able
    to tell those apart.
    """
    path_list = await async_normalize_zone_path(hass, path_list)
    path_list = await async_repair_path_against_db(hass, path_list)
    
    try:
        db_path = get_db_path(hass)
        today = dt_util.now().strftime("%Y-%m-%d")
        cols = ["name", "type", "quantity", "item_date", "category", "sub_category", "barcode"]
        vals = [name, item_type, qty, today, category, sub_category, barcode]
        qs = ["?", "?", "?", "?", "?", "?", "?"]
        
        if icon_key:
            cols.append("image_path")
            vals.append(icon_key)
            qs.append("?")

        # [ADDED v2026.9.4 | STAGE 2] Only append a column when a value was
        # actually supplied, so an unknown price stays NULL instead of being
        # written as 0.
        for col_name, value in (
            ("purchase_price", purchase_price),
            ("quantity_purchased", quantity_purchased),
            ("receipt_id", receipt_id),
            # [ADDED v2026.9.30] Estimated by the scanner from the product
            # and the storage location it chose. Validated rather than
            # trusted: a value the model formatted wrongly becomes NULL
            # instead of a date the rest of the code cannot compare.
            ("expiry_date", _coerce_date(expiry_date)),
            ("warranty_end_date", _coerce_date(warranty_end_date)),
        ):
            if value is not None:
                cols.append(col_name)
                vals.append(value)
                qs.append("?")

        for i, p in enumerate(path_list):
            if i < 10:
                cols.append(f"level_{i+1}")
                vals.append(p)
                qs.append("?")
        
        sql = f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join(qs)})"
        
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(sql, tuple(vals))
            if barcode and barcode != "0":
                l1 = path_list[0] if len(path_list) > 0 else ""
                l2 = path_list[1] if len(path_list) > 1 else ""
                l3 = path_list[2] if len(path_list) > 2 else ""
                await db.execute('''
                    REPLACE INTO barcode_history (barcode, name, category, sub_category, icon_key, level_1, level_2, level_3)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (barcode, name, category, sub_category, icon_key or "", l1, l2, l3))
            await db.commit()
        # [ADDED v2026.9.28] Keep the category list in step with what was
        # just written. After the commit and outside it: this is bookkeeping,
        # and a failure here must not undo an item the user asked for.
        try:
            await async_register_subcategory_if_new(hass, category, sub_category)
        except Exception:
            pass
        return True
    except Exception as e:
        _LOGGER.error(f"DB Add Error: {e}")
        return False

# ==========================================================================
# [ADDED v2026.9.4 | STAGE 2] RECEIPTS
# ==========================================================================
# Everything a model returns for a receipt passes through _coerce_* first.
# The rule throughout: a value that fails validation becomes None, never 0
# and never "". None is SQL NULL and means "not known"; 0 means "free". The
# expenses screen has to be able to tell those apart, and a model that
# misreads a blurred total as 0 must not silently create a free purchase.


def _coerce_amount(value):
    """Return a non-negative float, or None."""
    if value is None:
        return None
    try:
        if isinstance(value, str):
            # Receipts print "12,90" in some locales and "\u20aa12.90" in others.
            # Strip everything that is not a digit, separator or sign, then
            # normalise a decimal comma to a point.
            cleaned = re.sub(r"[^\d,.\-]", "", value).strip()
            if not cleaned:
                return None
            if "," in cleaned and "." not in cleaned:
                cleaned = cleaned.replace(",", ".")
            else:
                cleaned = cleaned.replace(",", "")
            value = cleaned
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount < 0:
        # A negative line is a discount or refund row, not a product price.
        return None
    return round(amount, 2)


def _coerce_date(value):
    """Return a 'YYYY-MM-DD' string, or None.

    The format is not cosmetic: existing queries filter with
    LIKE '2026-08%', so anything else silently breaks month filtering.
    """
    if not value or not isinstance(value, str):
        return None
    value = value.strip()[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        y, m, d = (int(x) for x in value.split("-"))
        datetime(y, m, d)
    except (ValueError, TypeError):
        return None
    return value


def _coerce_currency(value, fallback=None):
    """Return a three-letter uppercase code, or the fallback.

    A symbol is rejected on purpose: '$' is USD, CAD and AUD, so storing the
    symbol would make cross-currency totals impossible to get right later.
    """
    if isinstance(value, str):
        code = value.strip().upper()
        if re.fullmatch(r"[A-Z]{3}", code):
            return code
    return fallback


def _coerce_text(value, limit=120):
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in ("null", "none", "n/a", "unknown"):
        return None
    return text[:limit]


async def async_find_receipt(hass, vendor, receipt_number):
    """Return the active receipt matching vendor + number, or None.

    Duplicate detection runs in code before anything is written so the user
    gets a useful message. The partial UNIQUE index added in stage 1 is the
    backstop if a future code path forgets to call this.

    When either field is missing there is nothing to match on, so this
    returns None and the receipt is stored. Storing an occasional duplicate
    is better than refusing to store a receipt we simply could not read.
    """
    vendor = _coerce_text(vendor)
    receipt_number = _coerce_text(receipt_number, 60)
    if not vendor or not receipt_number:
        return None
    # [MODIFIED v2026.9.15] An empty draft is not a duplicate.
    #
    # Rejecting every pending item one by one leaves the draft receipt behind
    # with nothing attached. Re-scanning the same document then hit "already
    # saved" for a receipt the user could not see anywhere, with no way out.
    # A draft with no items is an abandoned scan, so it is cleared here and the
    # new scan proceeds.
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM receipts "
                "WHERE vendor = ? COLLATE NOCASE "
                "AND receipt_number = ? COLLATE NOCASE "
                # Drafts still count: the same receipt scanned twice, with the
                # first still unreviewed, is the same receipt.
                "AND COALESCE(status, 'active') IN ('active', 'draft') "
                "LIMIT 1",
                (vendor, receipt_number),
            ) as cur:
                row = await cur.fetchone()
            if not row:
                return None
            found = dict(row)

            if (found.get("status") or "draft") == "draft":
                async with db.execute(
                    "SELECT COUNT(*) FROM items WHERE receipt_id = ?",
                    (found["id"],),
                ) as cur:
                    remaining = (await cur.fetchone())[0]
                if remaining == 0:
                    _LOGGER.debug(
                        "Clearing abandoned empty draft receipt %s so the "
                        "re-scan can proceed", found["id"],
                    )
                    await db.execute(
                        "DELETE FROM receipt_pages WHERE receipt_id = ?",
                        (found["id"],),
                    )
                    await db.execute(
                        "DELETE FROM receipts WHERE id = ?", (found["id"],)
                    )
                    await db.commit()
                    return None
            return found
    except Exception as err:
        _LOGGER.error("Receipt lookup failed: %s", err)
        return None


async def async_count_receipt_items(hass, receipt_id):
    """How many items are linked to a receipt. Drives the replace prompt."""
    if not receipt_id:
        return 0
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(
                "SELECT COUNT(*) FROM items WHERE receipt_id = ?", (receipt_id,)
            ) as cur:
                row = await cur.fetchone()
                return row[0] if row else 0
    except Exception:
        return 0


async def async_insert_receipt(hass, data):
    """Insert a receipt row and return its id, or None.

    Called even when no line items could be read. A receipt whose header was
    understood still records that money was spent, and the user can attach
    items to it by hand later.
    """
    try:
        db_path = get_db_path(hass)
        default_currency = getattr(hass.config, "currency", None)
        values = (
            _coerce_text(data.get("receipt_number"), 60),
            _coerce_text(data.get("vendor")),
            _coerce_date(data.get("purchase_date")),
            _coerce_amount(data.get("total_amount")),
            _coerce_currency(data.get("currency"), default_currency),
            _coerce_text(data.get("file_path"), 500),
            int(data.get("item_count") or 0),
        )
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cur = await db.execute(
                "INSERT INTO receipts "
                "(receipt_number, vendor, purchase_date, total_amount, "
                " currency, file_path, item_count, status) "
                # 'draft', not 'active'. The money left the account, so the
                # receipt is recorded either way - but until a human has
                # confirmed at least one line, nothing here should be
                # counted in spending reports. Promoted by
                # async_activate_receipt on the first approval.
                "VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')",
                values,
            )
            await db.commit()
            return cur.lastrowid
    except Exception as err:
        _LOGGER.error("Receipt insert failed: %s", err)
        return None


async def async_activate_receipt(hass, receipt_id):
    """Promote a draft receipt to active. Idempotent.

    Called when the first item from a scan is approved. The WHERE clause pins
    the status to 'draft', so this can never resurrect a superseded receipt
    and repeated approvals are harmless no-ops.
    """
    if not receipt_id:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                "UPDATE receipts SET status = 'active' "
                "WHERE id = ? AND COALESCE(status, 'draft') = 'draft'",
                (receipt_id,),
            )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Receipt activation failed: %s", err)
        return False


async def async_get_receipt(hass, receipt_id):
    """One receipt row as a dict, or None."""
    if not receipt_id:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM receipts WHERE id = ?", (receipt_id,)
            ) as cur:
                row = await cur.fetchone()
                return dict(row) if row else None
    except Exception as err:
        _LOGGER.error("Receipt fetch failed: %s", err)
        return None


async def async_store_receipt_pages(hass, image_pages, mime_type):
    """Write every photographed page to disk. Returns a list of paths.

    Files are written before any database row exists, deliberately. A row
    pointing at a file that was never written gives a broken screen every
    time it is opened; a file with no row is an orphan on disk, which is
    harmless. Pages that fail to write are skipped rather than aborting the
    whole scan - one unreadable page should not lose the other four.
    """
    stored = []
    for page in (image_pages or []):
        path = await async_store_receipt_file(hass, page, mime_type)
        if path:
            stored.append(path)
    return stored


async def async_link_receipt_pages(hass, receipt_id, paths, mime_type=None):
    """Record the stored pages against a receipt, in capture order."""
    if not receipt_id or not paths:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            for number, path in enumerate(paths, start=1):
                # INSERT OR REPLACE so re-linking after a retry updates the
                # existing page instead of failing on the unique index.
                await db.execute(
                    "INSERT OR REPLACE INTO receipt_pages "
                    "(receipt_id, page_number, file_path, mime_type) "
                    "VALUES (?, ?, ?, ?)",
                    (receipt_id, number, path, mime_type),
                )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Linking receipt pages failed: %s", err)
        return False


def _path_to_browser_url(hass, path):
    """Map a stored filesystem path to a URL the panel can open, or None.

    Home Assistant serves exactly one directory over HTTP: config/www, at
    /local/. A file anywhere else has no URL at all - not a different URL, no
    URL - so this returns None and the viewer says so rather than rendering a
    broken image.

    commonpath rather than startswith: '/config/www2/x.jpg' begins with
    '/config/www' as a string while being a completely different directory.
    """
    if not path:
        return None
    try:
        www_root = os.path.abspath(hass.config.path("www"))
        target = os.path.abspath(path)
        if os.path.commonpath([www_root, target]) != www_root:
            return None
        relative = os.path.relpath(target, www_root).replace(os.sep, "/")
        return f"/local/{relative}"
    except (ValueError, OSError):
        # ValueError: paths on different drives on Windows have no common path.
        return None


async def async_get_receipt_pages(hass, receipt_id):
    """Every archived page of a receipt, in the order it was photographed.

    This is what lets a multi-image receipt be reopened later as one
    document. Falls back to the single path on the receipts row so receipts
    saved before this table existed still display.
    """
    if not receipt_id:
        return []
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT page_number, file_path, mime_type FROM receipt_pages "
                "WHERE receipt_id = ? ORDER BY page_number ASC",
                (receipt_id,),
            ) as cur:
                pages = [dict(r) for r in await cur.fetchall()]
            if pages:
                for page in pages:
                    page["url"] = _path_to_browser_url(hass, page.get("file_path"))
                return pages

            async with db.execute(
                "SELECT file_path FROM receipts WHERE id = ?", (receipt_id,)
            ) as cur:
                row = await cur.fetchone()
            if row and row["file_path"]:
                return [{
                    "page_number": 1,
                    "file_path": row["file_path"],
                    "mime_type": None,
                    "url": _path_to_browser_url(hass, row["file_path"]),
                }]
            return []
    except Exception as err:
        _LOGGER.error("Receipt page lookup failed: %s", err)
        return []


def _delete_files_sync(paths):
    """Remove archived page files. Runs in the executor.

    Missing files are not an error: the user may have cleaned the folder by
    hand, and the goal is that the file is gone.
    """
    removed = 0
    for path in paths:
        try:
            if path and os.path.isfile(path):
                os.remove(path)
                removed += 1
        except OSError as err:
            _LOGGER.warning("Could not delete receipt page %s: %s", path, err)
    return removed


async def async_delete_draft_scan(hass, receipt_id):
    """Discard an entire unreviewed scan: items, page files and receipt row.

    This is the one place a receipt row is ever deleted, and the guard below
    is what makes that consistent with the rule that receipts are permanent.

    A receipt only becomes 'active' when its first item is approved. Until
    then it has never been counted as spending and no purchase_history row
    references it, so nothing that was ever recorded is being destroyed - the
    scan simply never happened. Once a single item is approved the status is
    no longer 'draft' and this refuses, so real history stays permanent.

    Two independent conditions are required, because status alone would be
    enough only if every code path updated it correctly:

      * status must be 'draft';
      * no non-pending item may reference the receipt.

    Returns a dict describing what was removed, or None if refused.
    """
    if not receipt_id:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row

            async with db.execute(
                "SELECT status FROM receipts WHERE id = ?", (receipt_id,)
            ) as cur:
                row = await cur.fetchone()
            if not row:
                return None
            if (row["status"] or "draft") != "draft":
                _LOGGER.debug(
                    "Refusing to delete receipt %s: status is %s, not draft",
                    receipt_id, row["status"],
                )
                return None

            async with db.execute(
                "SELECT COUNT(*) FROM items "
                "WHERE receipt_id = ? AND type != 'pending'",
                (receipt_id,),
            ) as cur:
                approved = (await cur.fetchone())[0]
            if approved:
                _LOGGER.debug(
                    "Refusing to delete receipt %s: %s item(s) already approved",
                    receipt_id, approved,
                )
                return None

            # Collect the files before the rows that point at them are gone.
            paths = []
            async with db.execute(
                "SELECT file_path FROM receipt_pages WHERE receipt_id = ?",
                (receipt_id,),
            ) as cur:
                paths = [r["file_path"] for r in await cur.fetchall() if r["file_path"]]
            async with db.execute(
                "SELECT file_path FROM receipts WHERE id = ?", (receipt_id,)
            ) as cur:
                r = await cur.fetchone()
                if r and r["file_path"] and r["file_path"] not in paths:
                    paths.append(r["file_path"])

            async with db.execute(
                "SELECT COUNT(*) FROM items WHERE receipt_id = ?", (receipt_id,)
            ) as cur:
                item_count = (await cur.fetchone())[0]

            # Rows first, files second. If the file deletion fails halfway the
            # result is orphaned files, which are harmless. The reverse order
            # would leave rows pointing at files that no longer exist, which
            # breaks every screen that opens them.
            await db.execute(
                "DELETE FROM items WHERE receipt_id = ? AND type = 'pending'",
                (receipt_id,),
            )
            await db.execute(
                "DELETE FROM receipt_pages WHERE receipt_id = ?", (receipt_id,)
            )
            await db.execute("DELETE FROM receipts WHERE id = ?", (receipt_id,))
            await db.commit()

        files_removed = await hass.async_add_executor_job(_delete_files_sync, paths)
        _LOGGER.info(
            "Discarded draft scan %s: %s item(s), %s file(s)",
            receipt_id, item_count, files_removed,
        )
        return {
            "receipt_id": receipt_id,
            "items_removed": item_count,
            "files_removed": files_removed,
        }
    except Exception as err:
        _LOGGER.error("Deleting draft scan failed: %s", err)
        return None


async def async_list_receipts(hass, vendor=None, date_from=None, date_to=None,
                             limit=200):
    """Receipts for the management table, newest first.

    Filtering happens in SQL, not in the browser. Pulling every receipt over
    the websocket and filtering in JavaScript works for fifty rows and stalls
    at a few thousand, and purchase_date is indexed precisely so this stays a
    range scan.

    Drafts are included and carry their status, because an unreviewed scan is
    exactly the thing a user comes to this screen to find and finish.

    Only whole SQL fragments are conditionally appended; every value the
    caller supplies travels as a bound parameter.
    """
    clauses = []
    params = []

    vendor = _coerce_text(vendor)
    if vendor:
        clauses.append("vendor LIKE ? COLLATE NOCASE")
        params.append(f"%{vendor}%")

    # Dates are validated rather than trusted: an unparseable value is dropped
    # instead of being pushed into the query, so a bad filter shows everything
    # rather than silently showing nothing.
    date_from = _coerce_date(date_from)
    if date_from:
        clauses.append("purchase_date >= ?")
        params.append(date_from)
    date_to = _coerce_date(date_to)
    if date_to:
        clauses.append("purchase_date <= ?")
        params.append(date_to)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row

            # The item count comes from a correlated subquery rather than the
            # stored item_count column: items can be rejected after the scan,
            # so the stored figure is what the model found, not what is
            # actually linked now.
            async with db.execute(
                f"SELECT r.*, "
                f"(SELECT COUNT(*) FROM items i WHERE i.receipt_id = r.id) "
                f"AS linked_items "
                f"FROM receipts r {where} "
                f"ORDER BY COALESCE(r.purchase_date, '') DESC, r.id DESC "
                f"LIMIT ?",
                (*params, int(limit)),
            ) as cur:
                receipts = [dict(row) for row in await cur.fetchall()]

            # Vendor list for the filter control. Unfiltered on purpose: the
            # dropdown must still offer every store after a filter narrows the
            # table, otherwise the user cannot switch to another one.
            async with db.execute(
                "SELECT DISTINCT vendor FROM receipts "
                "WHERE vendor IS NOT NULL AND vendor != '' "
                "ORDER BY vendor COLLATE NOCASE"
            ) as cur:
                vendors = [row[0] for row in await cur.fetchall()]

            # Totals are per currency, never summed across them: adding
            # shekels to dollars produces a number that means nothing.
            totals = {}
            for r in receipts:
                if r.get("total_amount") is None:
                    continue
                if (r.get("status") or "draft") != "active":
                    continue
                code = r.get("currency") or "?"
                totals[code] = round(totals.get(code, 0) + r["total_amount"], 2)

        return {"receipts": receipts, "vendors": vendors, "totals": totals}
    except Exception as err:
        _LOGGER.error("Listing receipts failed: %s", err)
        return {"receipts": [], "vendors": [], "totals": {}}


async def async_delete_receipt_completely(hass, receipt_id):
    """Delete a receipt, its page files, its page rows and its purchase history.

    This is the destructive counterpart to async_delete_draft_scan, which only
    ever touches unreviewed drafts. This one will remove a receipt that has
    been reviewed and counted as spending, so it is only reachable from an
    explicit user action behind a confirmation step.

    Items are NOT deleted. A tin of beans on a shelf does not stop existing
    because its receipt was thrown away; its receipt_id is cleared so no row
    is left pointing at a receipt that is gone.

    purchase_history rows for this receipt DO go. They exist to answer "what
    did this cost and when", and keeping them after the receipt they came from
    was deliberately erased would leave price history the user believes they
    deleted.
    """
    if not receipt_id:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id FROM receipts WHERE id = ?", (receipt_id,)
            ) as cur:
                if not await cur.fetchone():
                    return None

            paths = []
            async with db.execute(
                "SELECT file_path FROM receipt_pages WHERE receipt_id = ?",
                (receipt_id,),
            ) as cur:
                paths = [r["file_path"] for r in await cur.fetchall() if r["file_path"]]
            async with db.execute(
                "SELECT file_path FROM receipts WHERE id = ?", (receipt_id,)
            ) as cur:
                row = await cur.fetchone()
                if row and row["file_path"] and row["file_path"] not in paths:
                    paths.append(row["file_path"])

            async with db.execute(
                "SELECT COUNT(*) FROM items WHERE receipt_id = ?", (receipt_id,)
            ) as cur:
                orphaned = (await cur.fetchone())[0]

            # Rows first, files second: an orphaned file is harmless, a row
            # pointing at a missing file breaks every screen that opens it.
            await db.execute(
                "UPDATE items SET receipt_id = NULL WHERE receipt_id = ?",
                (receipt_id,),
            )
            await db.execute(
                "DELETE FROM purchase_history WHERE receipt_id = ?", (receipt_id,)
            )
            await db.execute(
                "DELETE FROM receipt_pages WHERE receipt_id = ?", (receipt_id,)
            )
            # Any receipt that was superseded by this one loses its pointer,
            # otherwise it references a row that no longer exists.
            await db.execute(
                "UPDATE receipts SET superseded_by = NULL WHERE superseded_by = ?",
                (receipt_id,),
            )
            await db.execute("DELETE FROM receipts WHERE id = ?", (receipt_id,))
            await db.commit()

        files_removed = await hass.async_add_executor_job(_delete_files_sync, paths)
        _LOGGER.info(
            "Deleted receipt %s: %s file(s); %s item(s) kept and unlinked",
            receipt_id, files_removed, orphaned,
        )
        return {
            "receipt_id": receipt_id,
            "files_removed": files_removed,
            "items_unlinked": orphaned,
        }
    except Exception as err:
        _LOGGER.error("Deleting receipt failed: %s", err)
        return None


async def async_register_subcategory_if_new(hass, category, sub_category):
    """Register a sub-category an agent used but the list does not yet have.

    Called from async_add_item_db_safe, which is the single function every
    write path goes through - the invoice scanner, the shopping agent, the
    inventory agent and manual adds. Wiring this per agent would mean four
    places to keep in step, and the one that got forgotten would silently drop
    categories.

    Only sub-categories are created, never top-level categories. That is the
    rule agreed for the model: a new sub-category under an existing category
    is a useful addition, while a new top-level category produces "Food",
    "Groceries" and "Foodstuffs" within a week and nothing merges them
    afterwards. An unknown top-level category is therefore ignored here - the
    item keeps the value, but the list is not polluted.

    Marked source='ai' so a future screen can show which entries the assistant
    proposed, separately from the seeded defaults and the user's own.
    """
    category = _coerce_text(category, 60)
    sub_category = _coerce_text(sub_category, 60)
    if not category or not sub_category:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(
                "SELECT COUNT(*) FROM db_items_categories "
                "WHERE category = ? COLLATE NOCASE",
                (category,),
            ) as cur:
                known_category = (await cur.fetchone())[0]
            if not known_category:
                # Not an existing category, so this is not ours to create.
                return False

            async with db.execute(
                "SELECT COUNT(*) FROM db_items_categories "
                "WHERE category = ? COLLATE NOCASE "
                "AND sub_category = ? COLLATE NOCASE",
                (category, sub_category),
            ) as cur:
                if (await cur.fetchone())[0]:
                    return False  # already known

            async with db.execute(
                "SELECT cat_order FROM db_items_categories "
                "WHERE category = ? COLLATE NOCASE LIMIT 1",
                (category,),
            ) as cur:
                cat_order = (await cur.fetchone())[0]
            async with db.execute(
                "SELECT COALESCE(MAX(sub_order), -1) + 1 FROM db_items_categories "
                "WHERE category = ? COLLATE NOCASE",
                (category,),
            ) as cur:
                sub_order = (await cur.fetchone())[0]

            await db.execute(
                "INSERT OR IGNORE INTO db_items_categories "
                "(category, sub_category, unit, cat_order, sub_order, source) "
                "VALUES (?, ?, 'Units', ?, ?, 'ai')",
                (category, sub_category, cat_order, sub_order),
            )
            await db.commit()
        _LOGGER.info(
            "Registered new sub-category '%s' under '%s' from an assistant action.",
            sub_category, category,
        )
        return True
    except Exception as err:
        _LOGGER.error("Registering sub-category failed: %s", err)
        return False


async def async_update_item_extras(hass, item_id, fields):
    """Update the price and/or the expiry or warranty date of one item.

    Only the keys actually supplied are written, so saving a date never blanks
    a price the user did not touch. A None value IS written - clearing a field
    is a legitimate edit and must be distinguishable from not sending it.

    Dates go through _coerce_date, so a malformed value is stored as NULL
    rather than as text nothing else can compare against.
    """
    if not item_id or not fields:
        return False
    ALLOWED = {"purchase_price", "expiry_date", "warranty_end_date"}
    sets, values = [], []
    for key, value in fields.items():
        if key not in ALLOWED:
            continue
        if key == "purchase_price":
            values.append(None if value is None else _coerce_amount(value))
        else:
            values.append(None if value is None else _coerce_date(value))
        sets.append(f"{key} = ?")
    if not sets:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                f"UPDATE items SET {', '.join(sets)} WHERE id = ?",
                (*values, item_id),
            )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Updating item extras failed: %s", err)
        return False


async def async_get_categories(hass):
    """Every category and sub-category, in display order.

    Returns {category: {sub_category: unit}} - the same shape the frontend
    used to import from organizer-data.js, so the panel code reads the same
    either way and the change is invisible to it.
    """
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT category, sub_category, unit FROM db_items_categories "
                "ORDER BY cat_order ASC, category COLLATE NOCASE ASC, "
                "sub_order ASC, sub_category COLLATE NOCASE ASC"
            ) as cur:
                rows = await cur.fetchall()
        out = {}
        for row in rows:
            out.setdefault(row["category"], {})[row["sub_category"]] = row["unit"] or "Units"
        return out
    except Exception as err:
        _LOGGER.error("Loading categories failed: %s", err)
        return {}


async def async_add_category(hass, category, sub_category, unit=None, source="user"):
    """Add a category or a sub-category. Never removes or renames anything.

    A new top-level category needs a sub-category too, because the panel's
    two-step picker has nothing to show otherwise. When none is given, a
    "General" bucket is created so the category is immediately usable.

    Ordering: a new sub-category is appended to the end of its category rather
    than sorted in, so an existing list never reshuffles under the user.
    """
    category = _coerce_text(category, 60)
    if not category:
        return None
    sub_category = _coerce_text(sub_category, 60) or "General"
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            # Reuse the category's existing position if it is already known,
            # otherwise put the new category after all current ones.
            async with db.execute(
                "SELECT cat_order FROM db_items_categories "
                "WHERE category = ? COLLATE NOCASE LIMIT 1",
                (category,),
            ) as cur:
                row = await cur.fetchone()
            if row:
                cat_order = row["cat_order"]
            else:
                async with db.execute(
                    "SELECT COALESCE(MAX(cat_order), -1) + 1 FROM db_items_categories"
                ) as cur:
                    cat_order = (await cur.fetchone())[0]

            async with db.execute(
                "SELECT COALESCE(MAX(sub_order), -1) + 1 FROM db_items_categories "
                "WHERE category = ? COLLATE NOCASE",
                (category,),
            ) as cur:
                sub_order = (await cur.fetchone())[0]

            await db.execute(
                "INSERT OR IGNORE INTO db_items_categories "
                "(category, sub_category, unit, cat_order, sub_order, source) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (category, sub_category, unit or "Units", cat_order, sub_order, source),
            )
            await db.commit()
        return {"category": category, "sub_category": sub_category}
    except Exception as err:
        _LOGGER.error("Adding category failed: %s", err)
        return None


async def async_rename_category(hass, old_category, old_sub, new_category, new_sub):
    """Rename a category or sub-category and move every item with it.

    Both updates run on one connection and one commit. A rename that changed
    the category list but not the items pointing at it would leave those items
    filed under a name that no longer exists anywhere.
    """
    old_category = _coerce_text(old_category, 60)
    new_category = _coerce_text(new_category, 60) or old_category
    old_sub = _coerce_text(old_sub, 60)
    new_sub = _coerce_text(new_sub, 60) or old_sub
    if not old_category:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            if old_sub:
                await db.execute(
                    "UPDATE OR IGNORE db_items_categories "
                    "SET category = ?, sub_category = ? "
                    "WHERE category = ? COLLATE NOCASE "
                    "AND sub_category = ? COLLATE NOCASE",
                    (new_category, new_sub, old_category, old_sub),
                )
                await db.execute(
                    "UPDATE items SET category = ?, sub_category = ? "
                    "WHERE category = ? COLLATE NOCASE "
                    "AND sub_category = ? COLLATE NOCASE",
                    (new_category, new_sub, old_category, old_sub),
                )
            else:
                await db.execute(
                    "UPDATE OR IGNORE db_items_categories SET category = ? "
                    "WHERE category = ? COLLATE NOCASE",
                    (new_category, old_category),
                )
                await db.execute(
                    "UPDATE items SET category = ? WHERE category = ? COLLATE NOCASE",
                    (new_category, old_category),
                )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Renaming category failed: %s", err)
        return False


async def async_get_receipt_items(hass, receipt_id):
    """The items belonging to one receipt, for the expandable table.

    Reads `items`, not purchase_history: this answers "what is on this
    receipt" and must include lines still awaiting review, which have no
    history row yet. History exists to answer a different question - how the
    price of one product moved over time.

    line_total is computed, never stored. purchase_price is deliberately the
    unit price, and keeping a second stored total would give two numbers that
    can disagree.
    """
    if not receipt_id:
        return []
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, name, barcode, quantity, quantity_purchased, "
                "purchase_price, type, category, sub_category "
                "FROM items WHERE receipt_id = ? "
                "ORDER BY name COLLATE NOCASE",
                (receipt_id,),
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]
        for row in rows:
            qty = row.get("quantity_purchased") or row.get("quantity") or 1
            price = row.get("purchase_price")
            row["line_total"] = (
                round(float(price) * float(qty), 2) if price is not None else None
            )
            # The panel shows pending lines differently: they are proposals,
            # not yet part of the inventory.
            row["pending"] = row.get("type") == "pending"
        return rows
    except Exception as err:
        _LOGGER.error("Loading receipt items failed: %s", err)
        return []


async def async_supersede_receipt(hass, old_id, new_id):
    """Mark an earlier scan as replaced by a newer one.

    Receipts are never deleted. A re-scan usually happens because the first
    pass read only part of the document, and the earlier row is still a record
    that the purchase occurred. Marking it keeps the audit trail while giving
    the expenses screen a single rule: sum only status = 'active'.

    The items are re-pointed first. If that succeeded but the status update
    failed, the worst case is two receipts where one has no items, which is
    visible and fixable. The reverse order could leave items pointing at a
    receipt nothing sums.
    """
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                "UPDATE items SET receipt_id = ? WHERE receipt_id = ?",
                (new_id, old_id),
            )
            await db.execute(
                "UPDATE receipts SET status = 'superseded', superseded_by = ? "
                "WHERE id = ?",
                (new_id, old_id),
            )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Receipt supersede failed: %s", err)
        return False


async def async_update_receipt_currency(hass, receipt_id, currency):
    """Correct the currency after the fact.

    Currency lives on the receipt, not on the item: every line of one receipt
    is in the same currency, so storing it per item would let the two drift
    apart. Editing it next to any item updates the receipt, and all its items
    follow.
    """
    code = _coerce_currency(currency)
    if not code or not receipt_id:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                "UPDATE receipts SET currency = ? WHERE id = ?", (code, receipt_id)
            )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Receipt currency update failed: %s", err)
        return False


# ==========================================================================
# [ADDED v2026.9.5 | STAGE 2] PRODUCT KEY + PURCHASE HISTORY
# ==========================================================================


def _build_product_key(barcode, name):
    r"""Return the key that groups one product across every receipt.

    Two shoppers' realities have to be handled:

      * Packaged goods carry a barcode. It is globally unique and stable, so
        it is used verbatim: "bc:7290004127337". A rename of the item does
        not break the grouping.

      * Loose produce - tomatoes, pears - has no barcode. Falling back to the
        raw name would split "Tomatoes", "tomatoes " and "TOMATOES" into three
        products, so the name is normalised first: lowercased, punctuation
        removed, runs of whitespace collapsed. "nm:tomatoes".

    The "bc:" / "nm:" prefix keeps the two namespaces apart, so a product
    whose name happens to look like a barcode cannot collide with a real one.

    re.UNICODE matters here: \w must keep Hebrew letters, otherwise every
    Hebrew product name normalises to an empty string and they all collapse
    into one key.
    """
    barcode = (str(barcode or "")).strip()
    if barcode and barcode not in ("0", "-1", "none", "None"):
        return f"bc:{barcode}"
    text = (str(name or "")).strip().lower()
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return f"nm:{text}" if text else "nm:unknown"


async def async_record_purchase(hass, entry_data):
    """Append one immutable purchase-history row.

    Deliberately append-only. Nothing in the codebase updates or deletes from
    this table: a purchase is a fact that happened, and rewriting it would
    destroy exactly the history this table exists to keep.

    A row is written even when the price is unknown, because the fact that
    the product was bought on that date from that vendor is still useful.
    """
    try:
        db_path = get_db_path(hass)
        key = _build_product_key(entry_data.get("barcode"), entry_data.get("name"))
        values = (
            key,
            _coerce_text(entry_data.get("barcode"), 60),
            _coerce_text(entry_data.get("name")),
            _coerce_text(entry_data.get("unit"), 30),
            _coerce_amount(entry_data.get("unit_price")),
            _coerce_amount(entry_data.get("quantity")),
            _coerce_currency(entry_data.get("currency")),
            _coerce_date(entry_data.get("purchase_date")),
            _coerce_text(entry_data.get("vendor")),
            entry_data.get("receipt_id"),
        )
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                "INSERT INTO purchase_history "
                "(product_key, barcode, name, unit, unit_price, quantity, "
                " currency, purchase_date, vendor, receipt_id) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                values,
            )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Purchase history insert failed: %s", err)
        return False


async def async_get_price_history(hass, barcode=None, name=None, limit=50):
    """Every recorded purchase of one product, newest first.

    This is what answers "tomatoes cost 1, then 6, then 4 - show me".
    It reads purchase_history, not items, so the history is complete even
    for products that were long since consumed and removed from inventory.

    Prices are returned grouped by unit rather than as one list, because
    mixing per-kilo and per-unit prices into a single trend is meaningless.
    """
    try:
        db_path = get_db_path(hass)
        key = _build_product_key(barcode, name)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT purchase_date, vendor, unit_price, quantity, unit, "
                "currency, receipt_id, name "
                "FROM purchase_history WHERE product_key = ? "
                "ORDER BY purchase_date DESC, id DESC LIMIT ?",
                (key, int(limit)),
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]

        # Summary per (currency, unit) so the UI never compares apples with
        # kilos, or shekels with dollars.
        groups = {}
        for r in rows:
            if r["unit_price"] is None:
                continue
            g = groups.setdefault((r["currency"], r["unit"]), [])
            g.append(r["unit_price"])
        summary = [
            {
                "currency": cur_code,
                "unit": unit,
                "min": min(prices),
                "max": max(prices),
                "latest": prices[0],
                "count": len(prices),
            }
            for (cur_code, unit), prices in groups.items()
        ]
        return {"product_key": key, "purchases": rows, "summary": summary}
    except Exception as err:
        _LOGGER.error("Price history lookup failed: %s", err)
        return {"product_key": None, "purchases": [], "summary": []}


def _write_receipt_file_sync(target_dir, filename, raw_bytes):
    """Write the scanned document. Runs in the executor.

    The containment check repeats what services.py does at its own write
    site. The filename here is generated, not user supplied, so it cannot
    currently escape - but this function may be called from elsewhere later,
    and a write guard that depends on the caller being careful is not a
    guard at all.
    """
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, filename)
    if os.path.commonpath(
        [os.path.abspath(target_dir), os.path.abspath(target)]
    ) != os.path.abspath(target_dir):
        raise ValueError("refusing to write outside the receipts directory")
    with open(target, "wb") as handle:
        handle.write(raw_bytes)
    return target


async def async_store_receipt_file(hass, image_b64, mime_type):
    """Save the scanned receipt and return the stored path, or None.

    Naming
    ------
    The filename is random, not descriptive: "r_7f3a9c2e1b.pdf".

    The reason is that Home Assistant serves the `www` folder at /local/
    with no authentication at all. If the user chooses to store receipts
    there, a predictable name such as "receipt_2026-08-31.pdf" can simply be
    guessed by anyone who can reach the instance, and a receipt is personal
    financial data. Ten random hex characters from `secrets` removes that.

    The name carries no meaning on purpose. The vendor, date and number live
    in the receipts row, which is the right place to query them from; putting
    them in the filename would leak them to anyone listing the directory.

    Storage
    -------
    Two things are written, in this order:

      1. the file on disk, here;
      2. the receipts row, by the caller, using the path this returns.

    That order matters. A row that points at a file which was never written
    produces a broken screen every time the user opens it. A file with no row
    is merely an orphan on disk, which is harmless and cleanable.
    """
    if not image_b64:
        return None
    try:
        cfg = hass.data.get(DOMAIN, {}).get("config", {})
        target_dir = cfg.get(
            "receipt_path", hass.config.path("www", "home_organizer_receipts")
        )
        # [FIXED v2026.9.15] The panel sends a data URL
        # ("data:image/jpeg;base64,...."), not bare base64. Decoding the whole
        # string wrote the prefix into the file as if it were image data, so
        # every stored receipt was a corrupt file that no viewer could open.
        # The router already strips this; the file writer did not.
        payload = image_b64
        if isinstance(payload, str) and "base64," in payload:
            header, payload = payload.split("base64,", 1)
            # Trust the declared type over the caller's argument: it describes
            # the bytes that actually follow.
            if ":" in header and ";" in header:
                declared = header.split(":", 1)[1].split(";", 1)[0]
                if declared:
                    mime_type = declared
        raw = base64.b64decode(payload)

        # Chosen after the data URL has been inspected, so a PDF sent
        # with a default image mime still gets a .pdf extension.
        ext = ".pdf" if "pdf" in (mime_type or "").lower() else ".jpg"
        filename = f"r_{secrets.token_hex(5)}{ext}"
        stored = await hass.async_add_executor_job(
            _write_receipt_file_sync, target_dir, filename, raw
        )
        return stored
    except Exception as err:
        # A receipt that cannot be filed is still worth recording, so this
        # returns None and lets the caller store the row without a file.
        _LOGGER.error("Could not store the receipt file: %s", err)
        return None


async def async_get_view_data(hass, path_parts, query, date_filter, is_shopping):
    enable_ai = False
    entries = hass.config_entries.async_entries(DOMAIN)
    if entries:
        entry = entries[0]
        api_key = entry.options.get(CONF_API_KEY, entry.data.get(CONF_API_KEY))
        use_ai = entry.options.get(CONF_USE_AI, entry.data.get(CONF_USE_AI, True))
        mode = entry.options.get(CONF_PROCESSING_MODE, entry.data.get(CONF_PROCESSING_MODE, MODE_HYBRID))
        provider = entry.options.get(CONF_AI_PROVIDER, entry.data.get(CONF_AI_PROVIDER, PROVIDER_GEMINI))
        
        if use_ai and (api_key or mode == MODE_LOCAL_ONLY or provider == PROVIDER_OPENAI):
            enable_ai = True

    url_prefix = hass.data.get(DOMAIN, {}).get("config", {}).get("url_prefix", f"/local/{IMG_DIR}")
    db_path = get_db_path(hass)

    folders = []; items = []; shopping_list = []; pending_list = []
    hierarchy = {}

    try:
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE level_1 IS NOT NULL AND level_1 != ''") as cursor:
                for r in await cursor.fetchall():
                    l1, l2, l3 = r[0], r[1], r[2]
                    if l1 not in hierarchy: hierarchy[l1] = {}
                    if l2:
                        if l2 not in hierarchy[l1]: hierarchy[l1][l2] = []
                        if l3 and l3 not in hierarchy[l1][l2]: hierarchy[l1][l2].append(l3)

            if is_shopping:
                async with db.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC") as cursor:
                    for r_dict in await cursor.fetchall():
                        r_dict = dict(r_dict)
                        fp = [r_dict.get(f"level_{i}") for i in range(1, 11) if r_dict.get(f"level_{i}")]
                        
                        img = None
                        raw_path = r_dict.get('image_path')
                        if raw_path:
                            if raw_path.startswith("ICON_LIB"): img = raw_path
                            else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

                        shopping_list.append({
                            "id": r_dict['id'],
                            "name": r_dict['name'], 
                            "qty": r_dict['quantity'], 
                            "order_qty": r_dict.get('order_qty') or 1,
                            "date": r_dict['item_date'], 
                            "img": img, 
                            "location": " > ".join([p for p in fp if p]),
                            "main_location": r_dict.get("level_2", "General"),
                            "sub_location": r_dict.get("level_3", ""),
                            "level_1": r_dict.get("level_1", ""),
                            "level_2": r_dict.get("level_2", ""),
                            "level_3": r_dict.get("level_3", ""),
                            "category": r_dict.get("category", ""),
                            "sub_category": r_dict.get("sub_category", ""),
                            "unit": r_dict.get("unit", ""),
                            "unit_value": r_dict.get("unit_value", ""),
                            "barcode": r_dict.get("barcode", "0"),
                            "owner": r_dict.get("owner", ""),
                            "season": r_dict.get("season", ""),
                            "dress_code": r_dict.get("dress_code", ""),
                            "clothing_status": r_dict.get("clothing_status", "Clean"),
                            "measurements": r_dict.get("measurements", ""),

                            # [ADDED v2026.9.14] Purchase context on ordinary items too,

                            # so an item card can show which receipt it came from and

                            # what was paid, not only the pending review card.

                            "purchase_price": r_dict.get("purchase_price"),

                            "quantity_purchased": r_dict.get("quantity_purchased"),

                            "receipt_id": r_dict.get("receipt_id"),
                        })

                async with db.execute("SELECT * FROM items WHERE type='pending' ORDER BY created_at DESC") as cursor:
                    for r_dict in await cursor.fetchall():
                        r_dict = dict(r_dict)
                        img = None
                        raw_path = r_dict.get('image_path')
                        if raw_path:
                            if raw_path.startswith("ICON_LIB"): img = raw_path
                            else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

                        pending_list.append({
                            "id": r_dict['id'],
                            "name": r_dict['name'], 
                            "qty": r_dict['quantity'], 
                            "order_qty": r_dict.get('order_qty', 1),
                            "img": img, 
                            "level_1": r_dict.get("level_1", ""),
                            "level_2": r_dict.get("level_2", ""),
                            "level_3": r_dict.get("level_3", ""),
                            "category": r_dict.get("category", ""),
                            "sub_category": r_dict.get("sub_category", ""),
                            "barcode": r_dict.get("barcode", "0"),
                            # [ADDED v2026.9.6 | STAGE 2] Purchase fields, so the
                            # review tab can show and correct the price before it
                            # is committed to the append-only history table.
                            "purchase_price": r_dict.get("purchase_price"),
                            "quantity_purchased": r_dict.get("quantity_purchased"),
                            "receipt_id": r_dict.get("receipt_id"),
                        })

            elif query or date_filter != "All":
                sql = "SELECT * FROM items WHERE type='item'"; params = []
                for i, p in enumerate(path_parts): sql += f" AND level_{i+1} = ?"; params.append(p)

                if query: sql += " AND name LIKE ?"; params.append(f"%{query}%")
                if date_filter == "Week": 
                    sql += " AND item_date >= ?"; params.append((dt_util.now()-timedelta(days=7)).strftime("%Y-%m-%d"))
                elif date_filter == "Month":
                    sql += " AND item_date LIKE ?"; params.append(dt_util.now().strftime("%Y-%m") + "%")
                
                async with db.execute(sql, tuple(params)) as cursor:
                    for r_dict in await cursor.fetchall():
                        r_dict = dict(r_dict)
                        fp = [r_dict.get(f"level_{i}") for i in range(1, 11) if r_dict.get(f"level_{i}")]
                        img = None
                        raw_path = r_dict.get('image_path')
                        if raw_path:
                            if raw_path.startswith("ICON_LIB"): img = raw_path
                            else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

                        items.append({
                            # [ADDED v2026.9.29] Purchase and expiry context on every item list.
                            # Three separate blocks build item rows - location view, search
                            # and shopping - and only two carried these fields, so an item
                            # opened from a shelf showed no receipt details at all.
                            "purchase_price": r_dict.get("purchase_price"),
                            "quantity_purchased": r_dict.get("quantity_purchased"),
                            "receipt_id": r_dict.get("receipt_id"),
                            "expiry_date": r_dict.get("expiry_date"),
                            "warranty_end_date": r_dict.get("warranty_end_date"),
                            "id": r_dict['id'],
                            "name": r_dict['name'], 
                            "type": r_dict['type'], 
                            "qty": r_dict['quantity'], 
                            "order_qty": r_dict.get('order_qty', 1),
                            "date": r_dict['item_date'], 
                            "img": img, 
                            "location": " > ".join([p for p in fp if p]),
                            "category": r_dict.get('category', ''),
                            "sub_category": r_dict.get('sub_category', ''),
                            "unit": r_dict.get('unit', ''),
                            "unit_value": r_dict.get('unit_value', ''),
                            "barcode": r_dict.get("barcode", "0"),
                            "owner": r_dict.get("owner", ""),
                            "season": r_dict.get("season", ""),
                            "dress_code": r_dict.get("dress_code", ""),
                            "clothing_status": r_dict.get("clothing_status", "Clean"),
                            "measurements": r_dict.get("measurements", "")
                        })

            else:
                depth = len(path_parts)
                sql_where = ""; params = []
                for i, p in enumerate(path_parts): sql_where += f" AND level_{i+1} = ?"; params.append(p)

                if depth < 2:
                    col = f"level_{depth+1}"
                    async with db.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params)) as cursor:
                        found_folders = [r[0] for r in await cursor.fetchall()]
                    
                    for f_name in found_folders:
                        marker_sql = f"SELECT image_path FROM items WHERE type='folder_marker' AND name=? {sql_where} AND {col}=?"
                        marker_params = [f"[Folder] {f_name}"] + params + [f_name]
                        
                        async with db.execute(marker_sql, tuple(marker_params)) as cursor:
                            row = await cursor.fetchone()
                        
                        img = None
                        if row and row[0]:
                            raw_path = row[0]
                            if raw_path.startswith("ICON_LIB"): img = raw_path
                            else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"
                            
                        folders.append({"name": f_name, "img": img})
                    
                    sql = f"SELECT * FROM items WHERE type='item' AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where} ORDER BY name ASC"
                    async with db.execute(sql, tuple(params)) as cursor:
                        for r_dict in await cursor.fetchall():
                            r_dict = dict(r_dict)
                            img = None
                            raw_path = r_dict.get('image_path')
                            if raw_path:
                                if raw_path.startswith("ICON_LIB"): img = raw_path
                                else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

                            items.append({
                                # [ADDED v2026.9.29] Purchase and expiry context on every item list.
                                # Three separate blocks build item rows - location view, search
                                # and shopping - and only two carried these fields, so an item
                                # opened from a shelf showed no receipt details at all.
                                "purchase_price": r_dict.get("purchase_price"),
                                "quantity_purchased": r_dict.get("quantity_purchased"),
                                "receipt_id": r_dict.get("receipt_id"),
                                "expiry_date": r_dict.get("expiry_date"),
                                "warranty_end_date": r_dict.get("warranty_end_date"),
                                "id": r_dict['id'],
                                "name": r_dict['name'], 
                                "type": 'item', 
                                "qty": r_dict['quantity'], 
                                "order_qty": r_dict.get('order_qty', 1),
                                "img": img, 
                                "date": r_dict.get('item_date', ''),
                                "category": r_dict.get('category', ''),
                                "sub_category": r_dict.get('sub_category', ''),
                                "unit": r_dict.get('unit', ''),
                                "unit_value": r_dict.get('unit_value', ''),
                                "barcode": r_dict.get("barcode", "0"),
                                "owner": r_dict.get("owner", ""),
                                "season": r_dict.get("season", ""),
                                "dress_code": r_dict.get("dress_code", ""),
                                "clothing_status": r_dict.get("clothing_status", "Clean"),
                                "measurements": r_dict.get("measurements", "")
                            })
                else:
                    sublocations = []
                    col = f"level_{depth+1}"
                    async with db.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params)) as cursor:
                        for r in await cursor.fetchall(): sublocations.append(r[0])

                    sql = f"SELECT * FROM items WHERE type='item' {sql_where} ORDER BY level_{depth+1} ASC, name ASC"
                    async with db.execute(sql, tuple(params)) as cursor:
                        fetched_items = []
                        for r_dict in await cursor.fetchall():
                            r_dict = dict(r_dict)
                            img = None
                            raw_path = r_dict.get('image_path')
                            if raw_path:
                                if raw_path.startswith("ICON_LIB"): img = raw_path
                                else: img = f"{url_prefix}/{raw_path}?v={int(time.time())}"

                            subloc = r_dict.get(f"level_{depth+1}", "")
                            
                            fetched_items.append({
                                # [ADDED v2026.9.29] Purchase and expiry context on every item list.
                                # Three separate blocks build item rows - location view, search
                                # and shopping - and only two carried these fields, so an item
                                # opened from a shelf showed no receipt details at all.
                                "purchase_price": r_dict.get("purchase_price"),
                                "quantity_purchased": r_dict.get("quantity_purchased"),
                                "receipt_id": r_dict.get("receipt_id"),
                                "expiry_date": r_dict.get("expiry_date"),
                                "warranty_end_date": r_dict.get("warranty_end_date"),
                                "id": r_dict['id'],
                                "name": r_dict['name'], 
                                "type": 'item', 
                                "qty": r_dict['quantity'], 
                                "order_qty": r_dict.get('order_qty', 1),
                                "date": r_dict['item_date'], 
                                "img": img, 
                                "sub_location": subloc,
                                "category": r_dict.get('category', ''),
                                "sub_category": r_dict.get('sub_category', ''),
                                "unit": r_dict.get('unit', ''),
                                "unit_value": r_dict.get('unit_value', ''),
                                "barcode": r_dict.get("barcode", "0"),
                                "owner": r_dict.get("owner", ""),
                                "season": r_dict.get("season", ""),
                                "dress_code": r_dict.get("dress_code", ""),
                                "clothing_status": r_dict.get("clothing_status", "Clean"),
                                "measurements": r_dict.get("measurements", "")
                            })
                    
                    for s in sublocations: folders.append({"name": s})
                    items = fetched_items
    except Exception as e:
        _LOGGER.error(f"get_view_data error: {e}")

    catalog_map = await async_get_or_create_catalog_ids(hass)

    # [ADDED v2026.9.6 | STAGE 2] Load the receipts referenced by the pending
    # items, in one query rather than one per item.
    #
    # Items with no receipt_id - manual adds, barcode scans, garment scans -
    # simply have no entry here. The frontend groups those under its own
    # "no receipt" heading rather than hiding them.
    pending_receipts = {}
    try:
        # [MODIFIED v2026.9.14] Both lists, not just pending: an item that was
        # approved weeks ago still shows its receipt on its card.
        receipt_ids = sorted(
            {p["receipt_id"] for p in pending_list if p.get("receipt_id")}
            | {i["receipt_id"] for i in items if i.get("receipt_id")}
        )
        if receipt_ids:
            placeholders = ",".join("?" * len(receipt_ids))
            async with aiosqlite.connect(get_db_path(hass), timeout=10.0) as rdb:
                rdb.row_factory = aiosqlite.Row
                async with rdb.execute(
                    f"SELECT id, receipt_number, vendor, purchase_date, "
                    f"total_amount, currency, file_path, status "
                    f"FROM receipts WHERE id IN ({placeholders})",
                    tuple(receipt_ids),
                ) as rcur:
                    for row in await rcur.fetchall():
                        rec = dict(row)
                        # str keys: this dict is serialised to JSON for the
                        # frontend, where object keys are strings anyway.
                        pending_receipts[str(rec["id"])] = rec
    except Exception as receipt_err:
        # The review tab must still render if this fails; it just falls back
        # to showing the items ungrouped.
        _LOGGER.error("Could not load pending receipt headers: %s", receipt_err)

    return {
        "path_display": is_shopping and "Shopping List" or (query and "Search Results" or (" > ".join(path_parts) if path_parts else "Main")),
        "folders": folders,
        "items": items,
        "shopping_list": shopping_list,
        "pending_list": pending_list,
        # [ADDED v2026.9.6 | STAGE 2] Receipt headers for the review tab.
        # The flat pending_list is kept unchanged so nothing that already reads
        # it breaks; this is an additional lookup keyed by receipt id.
        "pending_receipts": pending_receipts,
        # [ADDED v2026.9.19] Categories now travel with the view data
        # instead of being imported from a shipped JS file, so a category
        # the user or the scanner added is available everywhere at once.
        "categories": await async_get_categories(hass),
        "app_version": VERSION,
        "depth": len(path_parts),
        "hierarchy": hierarchy,
        "enable_ai": enable_ai,
        "catalog_map": catalog_map
    }