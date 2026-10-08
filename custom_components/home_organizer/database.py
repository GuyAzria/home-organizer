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
# // [ADDED v2026.10.7 | 2026-10-07] Purpose: what the locations wizard needed
# // and nothing else provided.
# //
# // async_get/set_home_profile - the answer sheet, one JSON value in
# // app_settings. Reading REPAIRS rather than refusing: a profile written by an
# // older release must still open, so a missing key becomes a default and a
# // value of the wrong type is dropped. A form that will not open because one
# // field changed shape is worse than one field reset.
# //
# // async_set_shelf_life - the FIRST thing ever to write location_settings.
# // The table has carried "Renaming a location must update this table too,
# // which is wired up in a later stage" since it was created, and no row was
# // ever written. The wizard seeds the fridge and only the fridge, because
# // everywhere else the expiry comes from the assistant when the item is made.
# //
# // async_location_tree - the names and nothing else. async_get_view_data
# // builds the same map, but as part of a page render with items, boxes and
# // shopping in it; the wizard needs it before it has drawn anything.
# //
# // async_scan_location_issues - what is wrong with the locations that already
# // exist. Every finding was measured in a real installation: 15 copies of one
# // empty zone marker, six names with a trailing space, one shelf stored twice
# // because one copy had an order marker and the other did not, a doubled
# // ORDER_MARKER from a rename that re-applied the prefix, and "General"
# // showing as a sub-location heading. It only REPORTS; the user ticks what to
# // fix and no item row is ever touched (RULE 5).
# //
# // AND THE STARTER LOCATIONS ARE GONE. location_seed.py wrote one worked
# // example - Floor A / Kitchen / Fridge and five shelves - on an install
# // where the `items` table had never existed. The wizard replaces what that
# // was for, and the seed used a shape the panel cannot show: it put the
# // shelves in level_4, and the inventory view produces folders only for
# // depth 0 and 1, so those five were never visible in the panel at all.
# //
# // The module, the block that ran it, and the is_first_install probe that
# // existed only to gate it all went together - a helper left behind after
# // the thing it served is removed is exactly the plausible-looking code
# // that causes the next defect (RULE 33d). No user data can be affected:
# // it only ever wrote where the table had never existed (RULE 5). The
# // CATEGORY seed is untouched and still runs.
# // [ADDED v2026.10.6 | 2026-10-06] Purpose: is_gtin, for the scan boundary.
# //
# // normalize_barcode is deliberately lenient about length - it only
# // check-digits a GTIN shape, so a short code the user TYPED survives, which
# // st24 exists to protect. That leniency is wrong for a SCANNED code: an
# // Interleaved 2 of 5 short read is numeric and even-length, six digits say,
# // so a lenient length test has nothing to check and waves it through.
# //
# // A retail barcode IS a GTIN, so this one is strict. The panel has the same
# // rule in JavaScript as isValidGtin - they cannot share an implementation,
# // so st43 asserts the two agree instead of assuming it.

import json
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
    BARCODE_SOURCES, SETTING_BARCODE_SOURCES, SETTING_HOME_PROFILE,
    DEFAULT_BARCODE_SOURCE_ORDER,
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
                'discarded_at': "TEXT",

                # [ADDED v2026.9.20] The icon the assistant designed for THIS
                # item, as the SPEC it sent - not as a picture.
                #
                # Storing the spec rather than finished SVG is deliberate:
                #
                #   * The panel is the only thing that turns a spec into
                #     markup, so there is ONE builder rather than one here
                #     and one in JavaScript (RULE 33a.6). Items are usually
                #     added by voice, with no panel listening, so a design
                #     that needed the panel to draw before anything could be
                #     stored would never have reached the main path at all.
                #   * A spec is a few hundred bytes; the SVG it produces is
                #     two to three thousand.
                #   * It is checked twice over: ai_core.draw_spec rebuilds it
                #     field by field before it is stored, and spec-draw.js
                #     coerces every value again when it draws. Neither end
                #     trusts the other (RULE 7, RULE 11).
                #
                # A column of its own rather than a third meaning for
                # image_path, which already carries two - a library key or a
                # photo filename - and is tested with startswith("ICON_LIB")
                # wherever it is read.
                #
                # Purely additive: every existing row gets NULL and keeps the
                # icon it has. The panel prefers a photograph, then this, then
                # the library key (RULE 5, RULE 25).
                'icon_spec': "TEXT",
                #
                # [ADDED v2026.9.20] What the scanner WOULD call a new
                # top-level category for this item, when nothing on the
                # shelf fits it - a guitar, a fishing rod, a socket set.
                #
                # It is a SUGGESTION and nothing else. The item is filed
                # under the nearest existing category either way, so a
                # scan never stops to ask and never creates a category on
                # its own (RULE 22). The review tab shows the suggestion
                # with a button; the category is created when the user
                # presses it, which is the explicit action RULE 22 means.
                #
                # Purely additive; every existing row gets NULL and
                # shows nothing (RULE 5, RULE 25).
                'suggested_category': "TEXT",

                # [ADDED v2026.9.27] Boxes.
                #
                # A box is a row of its own, type='box', standing in a
                # location exactly as an item does. An item inside one carries
                # box_id AND keeps its own level columns in step with the box.
                #
                # Both, not just box_id, because every other feature in this
                # integration finds an item through its levels - search, the
                # expiry list, the dashboard breakdown, the shopping flow, the
                # receipt scanner resolving a location. If membership were the
                # only record of where a thing is, all of them would have to
                # learn about boxes. The levels stay the display truth; box_id
                # is the membership truth, and moving a box rewrites the levels
                # of its contents in one statement keyed on this integer.
                #
                # box_seq is the number on the physical label: box3 stays box3
                # in every language, because it is an identifier and not a word
                # (RULE 17, RULE 20). It is assigned MAX+1, never COUNT+1, so
                # deleting a box does not renumber the others.
                #
                # Purely additive: every existing row gets NULL and behaves
                # exactly as before (RULE 5, RULE 25).
                'box_id': "INTEGER",
                'box_seq': "INTEGER",
                # [ADDED v2026.9.30] What kind of box it is - cardboard,
                # a drawer, a crate. Free text, because it is the user's
                # own word for their own box; the panel offers the common
                # answers as chips and stores those in English so the
                # label survives a change of interface language.
                'box_type': "TEXT",
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
                # [ADDED v2026.9.27] Moving a box updates its contents by
                # this column, so it is the one that has to be indexed.
                await db.execute("CREATE INDEX IF NOT EXISTS idx_items_box ON items(box_id)")
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
                # [ADDED v2026.9.22] What the money was spent ON. Every
                # receipt carries one, not only the ones with no items -
                # a grocery run is 'Groceries'. Validated against
                # db_expense_categories before it is written; a value that
                # is not on that list is stored as NULL rather than
                # inventing a bucket the chart would then show.
                "expense_category": "TEXT",
                # [ADDED v2026.9.22] What the product lines added up to when
                # the receipt was scanned, against total_amount, which is
                # what was paid. They disagree when a line was read without
                # its discount, and that disagreement is the whole reason
                # this column exists: it is the record of the check, so a
                # receipt that did not balance can be found later instead
                # of quietly making every category total too high.
                "lines_total": "REAL",
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

            # [ADDED v2026.9.22] What money was spent on, as a closed list.
            #
            # Free text here would give 'Restaurant', 'Restaurants' and
            # 'Dining' inside a week, and the chart would show them as three
            # separate bars for one thing. That is the exact failure
            # db_items_categories was built to prevent, so this copies its
            # shape: seeded once, a source column, never re-seeded.
            await db.execute('''
                CREATE TABLE IF NOT EXISTS db_expense_categories (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    category   TEXT NOT NULL,
                    cat_order  INTEGER DEFAULT 999,
                    source     TEXT DEFAULT 'default',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(category)
                )
            ''')
            async with db.execute(
                "SELECT COUNT(*) FROM db_expense_categories"
            ) as cur:
                have_expense = (await cur.fetchone())[0]
            if not have_expense:
                try:
                    from .category_seed import DEFAULT_EXPENSE_CATEGORIES
                    await db.executemany(
                        "INSERT OR IGNORE INTO db_expense_categories "
                        "(category, cat_order, source) VALUES (?, ?, 'default')",
                        DEFAULT_EXPENSE_CATEGORIES,
                    )
                    _LOGGER.info(
                        "Seeded %s default expense categories.",
                        len(DEFAULT_EXPENSE_CATEGORIES),
                    )
                except Exception as seed_err:
                    _LOGGER.error("Expense seeding failed: %s", seed_err)

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

            # [ADDED v2026.9.22] A purchase remembers WHAT KIND of thing it
            # was, not only what it cost.
            #
            # A receipt is not one kind of spending. One trip to the
            # supermarket is tomatoes, eggs, a toy and a bottle of
            # sunscreen, and filing the whole receipt under 'Groceries' is
            # simply the wrong answer - it was tried and it was wrong. The
            # ITEM carries the category, so the purchase of that item is
            # where the category belongs, and a spending breakdown is a
            # sum over product lines rather than over receipts.
            #
            # Written at approval time from the item's own category, which
            # is the value the user saw and could correct in the review tab
            # - not the model's raw guess.
            async with db.execute("PRAGMA table_info(purchase_history)") as cursor:
                ph_cols = [col[1] for col in await cursor.fetchall()]
            if "category" not in ph_cols:
                try:
                    await db.execute(
                        "ALTER TABLE purchase_history ADD COLUMN category TEXT")
                except Exception:
                    pass
                # Backfill, once, for every purchase already recorded. A
                # year of history is exactly what the breakdown needs, and
                # without this every one of those rows would read 'Other'
                # for ever.
                #
                # Only rows that are still NULL, matched on the receipt AND
                # the name, so nothing already answered is overwritten and
                # no row gets a category from a different receipt (RULE 5).
                # It is inside the "column did not exist" branch, so it runs
                # on the upgrade and never again (RULE 6).
                try:
                    await db.execute(
                        "UPDATE purchase_history SET category = ("
                        "  SELECT i.category FROM items i "
                        "  WHERE i.receipt_id = purchase_history.receipt_id "
                        "    AND i.name = purchase_history.name "
                        "    AND TRIM(COALESCE(i.category, '')) != '' "
                        "  LIMIT 1) "
                        "WHERE category IS NULL AND receipt_id IS NOT NULL"
                    )
                    _LOGGER.info(
                        "[HO-DB] purchase_history.category added and "
                        "backfilled from the items it came from.")
                except Exception as backfill_err:
                    _LOGGER.warning(
                        "purchase_history category backfill skipped: %s",
                        backfill_err)

            # [ADDED v2026.9.3 | STAGE 1] Per-sub-location shelf life.
            #
            # Locations are not entities in this schema - they are the
            # level_1..level_10 TEXT columns on `items`. There is therefore
            # nothing to attach a setting to, so the location path itself is
            # the key, stored exactly as the levels are joined elsewhere.
            # Renaming a location must update this table too, which is wired
            # up in a later stage.
            await db.execute('''
                CREATE TABLE IF NOT EXISTS app_settings (
                    key        TEXT PRIMARY KEY,
                    value      TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # [ADDED v2026.10.5] One row per panel preference.
            #
            # location_settings is per location and persistent_ids is per
            # name; a setting that belongs to the whole installation had
            # nowhere to live. IF NOT EXISTS, so a fresh install and an
            # upgrade take the same path (RULE 6).
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
                                 expiry_date=None, warranty_end_date=None,
                                 suggested_category=None):
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
        # [ADDED v2026.10.5] Normalised HERE, so every caller stores the
        # same thing. Leaving it to each one is how the string "None"
        # reached this column from the receipt scan and stayed on items
        # that have no barcode at all.
        barcode = normalize_barcode(barcode) or "0"
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
            # [ADDED v2026.9.20] A name the model proposed, never a
            # category that exists. _coerce_text caps the length and
            # strips it; nothing acts on it until the user presses the
            # button in the review tab (RULE 11, RULE 22).
            ("suggested_category", _coerce_text(suggested_category, 60) or None),
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
            # [MODIFIED v2026.9.20] The new row's id is kept.
            #
            # An icon the assistant drew has to be attached to THIS item, and
            # the caller had no way to name the item it had just added.
            cursor = await db.execute(sql, tuple(vals))
            new_item_id = cursor.lastrowid
            # [MODIFIED v2026.10.4] One rule for what counts as a barcode.
            # The string "None" passed `barcode != "0"` and poisoned
            # barcode_history for every later scan - see normalize_barcode.
            # [MODIFIED v2026.10.5] Only a code that means the same thing
            # in another shop is worth remembering across receipts.
            if is_portable_barcode(barcode):
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
        # [MODIFIED v2026.9.20] The id, not True. Every caller either ignores
        # the result or tests it for truth, and an id is truthy - so this adds
        # information without changing any of them. Failure returns None,
        # which is falsy exactly as False was.
        return new_item_id
    except Exception as e:
        _LOGGER.error(f"DB Add Error: {e}")
        return None

# ==========================================================================
# [ADDED v2026.9.27] BOXES
#
# A box is a row, type='box', standing in a location exactly as an item does,
# carrying a free title ("M8 screws") and a number that never changes (box3).
#
# WHY MEMBERSHIP IS AN ID AND NOT A PATH.
# The obvious design - a box is a third folder level - cannot work here:
# async_get_view_data navigates two folder levels and reads DISTINCT level_1,
# level_2, level_3 only, so a box at level 3 would put its contents at level 4
# where nothing looks. The box is therefore a row in the item list, and what
# says an item is inside it is box_id.
#
# WHY THE LEVELS ARE KEPT IN STEP AS WELL.
# Everything else finds an item through its levels. Membership alone would mean
# teaching search, expiry, the dashboard and the scanner about boxes; keeping
# the levels means none of them change at all. So an item in a box carries
# both, and moving the box rewrites the levels of its contents in one statement
# keyed on the indexed integer.


def _level_values(path):
    """A path as the ten level columns, padded with None."""
    parts = [p for p in (path or []) if p]
    return [parts[i] if i < len(parts) else None for i in range(10)]


def box_label(box_seq):
    """The identifier on the physical label: box3.

    Deliberately not translated. It is an identifier, like a barcode, and
    RULE 20 says a translation must never alter one.
    """
    try:
        return f"box{int(box_seq)}"
    except (TypeError, ValueError):
        return ""


# [ADDED v2026.9.30] The name match, lifted out of box_matches_query.
#
# The assistant needs the same test when it looks for "face cream" among the
# lines of a receipt, and a second copy would drift from this one the first
# time either was tuned (RULE 33d).
def name_matches_query(haystack, query):
    """Whether `haystack` answers `query`, the way a person means it.

    A single LIKE over the whole query does not do what a person expects.
    Asking for "box for screws" against "M8 screws" matches nothing, and
    splitting into words is not enough either: Hebrew glues its prepositions
    on, so the query word carries a prefix the stored word does not have and
    containment fails in that direction only.

    So each word is tested BOTH ways round - a stored word inside a query
    word, or a query word inside the stored text. Language-neutral, no word
    list, and the same test that recognises "Rami Levy" as "Rami Levy Shivuk
    HaShikma".

    Words of one or two characters are ignored; anything that short is inside
    almost everything.

    An empty query matches EVERYTHING. A caller for which that would be
    catastrophic - anything that deletes - must reject an empty query itself
    rather than relying on this (RULE 31).
    """
    q = " ".join(str(query or "").split()).casefold()
    if not q:
        return True
    hay = " ".join(str(haystack or "").split()).casefold()
    hay_words = [w for w in hay.split() if len(w) >= 2]
    for token in q.split():
        if len(token) < 2:
            continue
        if token in hay:
            return True
        for w in hay_words:
            if len(w) >= 3 and w in token:
                return True
    return False


def box_matches_query(title, label, query):
    """Whether a box answers a typed query.

    The title and the label are one haystack, so box3 finds it by number and
    screws finds it by what is in it. The match is name_matches_query.
    """
    return name_matches_query(f"{title or ''} {label or ''}", query)


async def async_create_box(hass, title, path, new_item_names=None):
    """Create a box in `path`. Returns {id, box_seq, label} or None.

    box_seq is MAX+1 and never COUNT+1: deleting box3 must not turn box4 into
    box3, because the number is written on the box itself.

    new_item_names creates items straight INSIDE the box. It is done here, in
    the same transaction, because the box id does not exist until the insert
    above has run - a caller cannot put an item in a box it cannot name yet.
    """
    name = _coerce_text(title)
    if not name:
        return None
    try:
        db_path = get_db_path(hass)
        vals = _level_values(path)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(
                "SELECT COALESCE(MAX(box_seq), 0) + 1 FROM items"
            ) as cur:
                seq = (await cur.fetchone())[0]
            cols = ", ".join(f"level_{i}" for i in range(1, 11))
            marks = ", ".join("?" for _ in range(10))
            cur = await db.execute(
                f"INSERT INTO items (name, type, quantity, box_seq, {cols}) "
                f"VALUES (?, 'box', 1, ?, {marks})",
                (name, int(seq), *vals),
            )
            box_id = cur.lastrowid

            for raw in (new_item_names or []):
                item_name = _coerce_text(raw)
                if not item_name:
                    continue
                await db.execute(
                    f"INSERT INTO items (name, type, quantity, box_id, {cols}) "
                    f"VALUES (?, 'item', 1, ?, {marks})",
                    (item_name, box_id, *vals),
                )

            await db.commit()
            return {"id": box_id, "box_seq": int(seq),
                    "label": box_label(seq)}
    except Exception as err:
        _LOGGER.error("Box create failed: %s", err)
        return None


async def async_get_box(hass, box_id):
    """One box row as a dict, or None."""
    if not box_id:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM items WHERE id = ? AND type = 'box'",
                (box_id,),
            ) as cur:
                row = await cur.fetchone()
        return dict(row) if row else None
    except Exception as err:
        _LOGGER.error("Box lookup failed: %s", err)
        return None


async def async_set_item_box(hass, item_id, box_id):
    """Put an item in a box, move it between boxes, or take it out.

    One function for all three, because they are one operation: set box_id and
    bring the levels with it. box_id=None takes the item out and LEAVES it
    where the box is standing, which is what happens physically.
    """
    if not item_id:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            if box_id:
                async with db.execute(
                    "SELECT * FROM items WHERE id = ? AND type = 'box'",
                    (box_id,),
                ) as cur:
                    box = await cur.fetchone()
                if not box:
                    _LOGGER.error("Box %s does not exist", box_id)
                    return False
                box = dict(box)
                sets = ", ".join(f"level_{i} = ?" for i in range(1, 11))
                vals = [box.get(f"level_{i}") for i in range(1, 11)]
                await db.execute(
                    f"UPDATE items SET box_id = ?, {sets} WHERE id = ?",
                    (box_id, *vals, item_id),
                )
            else:
                # Out of the box, still on the shelf: the levels are already
                # the box's, which is where the box is standing.
                await db.execute(
                    "UPDATE items SET box_id = NULL WHERE id = ?", (item_id,))
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Set item box failed: %s", err)
        return False


async def async_move_box(hass, box_id, path):
    """Move a box and everything in it.

    Two statements in ONE transaction. Separately they would leave a box whose
    contents are on the old shelf - which is the exact thing this feature
    exists to prevent.
    """
    if not box_id:
        return False
    try:
        db_path = get_db_path(hass)
        vals = _level_values(path)
        sets = ", ".join(f"level_{i} = ?" for i in range(1, 11))
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                f"UPDATE items SET {sets} WHERE id = ?", (*vals, box_id))
            await db.execute(
                f"UPDATE items SET {sets} WHERE box_id = ?", (*vals, box_id))
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Box move failed: %s", err)
        return False


async def async_delete_box(hass, box_id):
    """Remove the box. Its contents stay exactly where they are.

    Emptying a cardboard box onto the shelf does not throw the contents away,
    and neither does this: box_id is cleared, the levels are untouched, and
    only the box row goes (RULE 5).
    """
    if not box_id:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                "UPDATE items SET box_id = NULL WHERE box_id = ?", (box_id,))
            await db.execute(
                "DELETE FROM items WHERE id = ? AND type = 'box'", (box_id,))
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Box delete failed: %s", err)
        return False


async def async_list_boxes(hass, path_parts=None, query=None):
    """Every box, narrowed by location and by typed text.

    The text filter runs here rather than in SQL because the match is tested
    both ways round - see box_matches_query - which SQL cannot express. A house
    has tens of boxes, so the list is read and filtered without cost.
    """
    out = []
    try:
        db_path = get_db_path(hass)
        sql = "SELECT * FROM items WHERE type = 'box'"
        params = []
        for i, p in enumerate(path_parts or []):
            if p:
                sql += f" AND level_{i + 1} = ?"
                params.append(p)
        sql += " ORDER BY box_seq ASC"
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(sql, tuple(params)) as cur:
                rows = [dict(r) for r in await cur.fetchall()]
            for row in rows:
                label = box_label(row.get("box_seq"))
                if not box_matches_query(row.get("name"), label, query):
                    continue
                async with db.execute(
                    "SELECT COUNT(*) FROM items WHERE box_id = ?", (row["id"],)
                ) as cur:
                    count = (await cur.fetchone())[0]
                row["box_label"] = label
                row["box_count"] = count
                out.append(row)
    except Exception as err:
        _LOGGER.error("Box list failed: %s", err)
    return out


# [ADDED v2026.9.30] What the assistant needs to work on a box by its NUMBER.
#
# A person says "box 4", never a row id. The number is what is written on the
# carton, so it is the only handle the assistant is given - and a number that
# names no box returns None, which is how every caller below refuses to guess
# (RULE 31). Nothing here creates a box: allocating a box number means asking
# someone to write it on a carton, and that is the user's decision.
async def async_get_box_by_seq(hass, seq):
    """The box whose printed number is `seq`, or None."""
    try:
        n = int(seq)
    except (TypeError, ValueError):
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM items WHERE type = 'box' AND box_seq = ?",
                (n,),
            ) as cur:
                row = await cur.fetchone()
        return dict(row) if row else None
    except Exception as err:
        _LOGGER.error("Box lookup by number failed: %s", err)
        return None


async def async_empty_box(hass, box_id):
    """Take everything out of a box. Returns how many rows moved, or None.

    The contents land in the GENERAL group of the location the box is standing
    in: box_id is cleared and so are level_3 and below. Physically you would
    be putting them on the shelf the box was on, which is what clearing the
    sub-location means on screen.

    Nothing is deleted. A row that was in the box is still a row afterwards,
    wherever the user then files it (RULE 5).
    """
    if not box_id:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            sets = ", ".join(f"level_{i} = NULL" for i in range(3, 11))
            cur = await db.execute(
                f"UPDATE items SET box_id = NULL, {sets} WHERE box_id = ?",
                (box_id,),
            )
            moved = cur.rowcount
            await db.commit()
        return moved
    except Exception as err:
        _LOGGER.error("Box empty failed: %s", err)
        return None


async def async_delete_box_items(hass, box_id):
    """Delete the ITEMS in a box. Returns (deleted, unboxed) or None.

    An unreviewed receipt line can be sorted into a box before anybody has
    agreed it is real, and it is NOT inventory - it is review work. So it is
    taken out of the box rather than deleted, and the count comes back
    separately so the caller can say so. "Delete the items" must not quietly
    throw away a receipt somebody was part-way through checking (RULE 5,
    RULE 23).

    The box row itself survives. Emptying a box is not the same as not having
    one, and the number on the carton stays valid.
    """
    if not box_id:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cur = await db.execute(
                "DELETE FROM items WHERE box_id = ? AND type = 'item'",
                (box_id,),
            )
            deleted = cur.rowcount
            cur = await db.execute(
                "UPDATE items SET box_id = NULL WHERE box_id = ?",
                (box_id,),
            )
            unboxed = cur.rowcount
            await db.commit()
        return (deleted, unboxed)
    except Exception as err:
        _LOGGER.error("Box item delete failed: %s", err)
        return None


async def async_find_pending_matching(hass, query):
    """Unreviewed receipt lines whose name answers `query`.

    This is what lets the assistant say "there is a face cream on a receipt -
    shall I put THAT one in the box" instead of creating a second row for
    something already waiting to be reviewed.

    An empty query returns nothing rather than everything. name_matches_query
    treats no text as "match all", which is right for a search box and wrong
    for anything acting on the result (RULE 31).
    """
    if not str(query or "").strip():
        return []
    out = []
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, name, receipt_id, box_id FROM items "
                "WHERE type = 'pending'"
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]
        for row in rows:
            if name_matches_query(row.get("name"), query):
                out.append(row)
    except Exception as err:
        _LOGGER.error("Pending lookup failed: %s", err)
    return out


async def async_find_pending_by_vendor(hass, vendor):
    """Every unreviewed line of every receipt from a shop.

    The vendor is matched with name_matches_query, which is what recognises
    "Super-Pharm" as "SUPER-PHARM LTD BRANCH 412".

    An empty vendor returns nothing. Acting on "all receipts" because a name
    was blank is exactly the accident RULE 31 exists to prevent.
    """
    if not str(vendor or "").strip():
        return []
    out = []
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT id, vendor FROM receipts") as cur:
                receipts = [dict(r) for r in await cur.fetchall()]
            wanted = [r["id"] for r in receipts
                      if name_matches_query(r.get("vendor"), vendor)]
            if not wanted:
                return []
            marks = ",".join("?" * len(wanted))
            async with db.execute(
                f"SELECT id, name, receipt_id, box_id FROM items "
                f"WHERE type = 'pending' AND receipt_id IN ({marks})",
                tuple(wanted),
            ) as cur:
                out = [dict(r) for r in await cur.fetchall()]
    except Exception as err:
        _LOGGER.error("Pending lookup by vendor failed: %s", err)
    return out


# [ADDED v2026.9.30] The location equivalents of the box operations.
#
# All three work on LOOSE items only - type='item' with no box_id. A box
# standing in the location is left alone and counted: "take everything off
# the top shelf" means move the box, not unpack it, and unpacking one row at
# a time would break the invariant that an item's box_id and its ten level
# columns agree. A box is moved and emptied by its own operations.
#
# None of them touch an unreviewed receipt line. A pending line is not IN a
# location - a model SUGGESTED that location for it - so deleting one would
# throw away review work nobody has finished (RULE 23).
def _level_where(parts):
    """A WHERE fragment and its parameters for an exact location path."""
    clean = [p for p in (parts or []) if p]
    where = " AND ".join(f"level_{i + 1} = ?" for i in range(len(clean)))
    return clean, where


async def async_location_counts(hass, path):
    """(loose items, boxes, unreviewed lines) sitting in a location.

    Counted so a confirmation question can name numbers. "Delete everything
    on the top shelf" is not something to agree to blind.
    """
    clean, where = _level_where(path)
    if not clean:
        return (0, 0, 0)
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(
                f"SELECT COUNT(*) FROM items WHERE type = 'item' "
                f"AND box_id IS NULL AND {where}", tuple(clean)) as cur:
                loose = (await cur.fetchone())[0]
            async with db.execute(
                f"SELECT COUNT(*) FROM items WHERE type = 'box' "
                f"AND {where}", tuple(clean)) as cur:
                boxes = (await cur.fetchone())[0]
            async with db.execute(
                f"SELECT COUNT(*) FROM items WHERE type = 'pending' "
                f"AND {where}", tuple(clean)) as cur:
                pending = (await cur.fetchone())[0]
        return (int(loose), int(boxes), int(pending))
    except Exception as err:
        _LOGGER.error("Location count failed: %s", err)
        return (0, 0, 0)


async def async_empty_location(hass, path):
    """Move the loose items in a location up to its PARENT. Count, or None.

    Taking everything off the top shelf puts it on the thing that contains
    the top shelf, which is the location one level up. Nothing is deleted.

    A room is refused: it has no parent, and clearing level_1 would leave the
    rows at the root where no screen lists them - findable only by search,
    which is indistinguishable from lost (RULE 31).
    """
    clean, where = _level_where(path)
    if len(clean) < 2:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            sets = ", ".join(f"level_{i} = NULL"
                             for i in range(len(clean), 11))
            cur = await db.execute(
                f"UPDATE items SET {sets} WHERE type = 'item' "
                f"AND box_id IS NULL AND {where}", tuple(clean))
            moved = cur.rowcount
            await db.commit()
        return moved
    except Exception as err:
        _LOGGER.error("Location empty failed: %s", err)
        return None


async def async_delete_location_items(hass, path):
    """Delete the loose items in a location. Count, or None.

    The location itself survives - its folder marker is not touched - and so
    does any box standing in it. Emptying a shelf is not the same as not
    having one.

    An empty path deletes NOTHING. Without that guard the WHERE clause would
    be empty and the statement would clear the whole table; a caller that
    could not work out a location must not be handed that (RULE 31).
    """
    clean, where = _level_where(path)
    if not clean:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cur = await db.execute(
                f"DELETE FROM items WHERE type = 'item' "
                f"AND box_id IS NULL AND {where}", tuple(clean))
            deleted = cur.rowcount
            await db.commit()
        return deleted
    except Exception as err:
        _LOGGER.error("Location item delete failed: %s", err)
        return None


# [ADDED v2026.9.4 | STAGE 2] RECEIPTS
# ==========================================================================
# Everything a model returns for a receipt passes through _coerce_* first.
# The rule throughout: a value that fails validation becomes None, never 0
# and never "". None is SQL NULL and means "not known"; 0 means "free". The
# expenses screen has to be able to tell those apart, and a model that
# misreads a blurred total as 0 must not silently create a free purchase.


# [ADDED v2026.10.4] The barcode to store, or "" when there is not one.
#
# The model is asked for "<string|null>" and sends null for a line with no
# printed barcode, which is correct. The scan then did
# str(item.get("barcode", "0")) - and .get returns the DEFAULT only when the
# KEY IS ABSENT, so a present null became the four-character string "None".
# Truthy, not "0", and therefore accepted by every guard in the project: it
# was stored on the item, written into barcode_history on approval, and found
# again by the next scan, which handed that one row's category and location to
# every barcode-less line of every receipt afterwards.
#
# Two of the five writers already tested `not in ("0", "None", "")` - the same
# bug, met and patched where it was found rather than at the source, twice.
# This is that test, once, so the sixth place cannot get it wrong again
# (RULE 33a.6, RULE 33d).
#
# A barcode is a number. Anything with no digit in it is a word, not a code,
# which catches "None", "null" and "undefined" without listing them; the
# explicit set is kept for the ones that do contain digits.
_NOT_A_BARCODE = {"0", "none", "null", "nil", "nan", "undefined",
                  "n/a", "na", "-", "--", "unknown"}



# [ADDED v2026.10.5] (A) The check digit, because this code was READ OFF A
# PHOTOGRAPH.
#
# A barcode here does not come from a laser scanner - a model reads it from an
# image of a receipt or a packet. One digit read wrong produces a code that
# looks entirely valid, and that is worse than no code: it writes a
# barcode_history row under someone else's product, or finds one.
#
# GTIN-8, 12, 13 and 14 all carry a mod-10 check digit. It catches every
# single-digit error and most transpositions. Rejecting a code that fails it
# costs nothing - the item simply has no barcode, which is the normal state
# for most lines on a receipt.
#
# Lengths that are not GTIN lengths pass unchecked: Code-128 and the rest have
# no check scheme to apply, and refusing what cannot be checked would throw
# away scans that work.
_GTIN_LENGTHS = (8, 12, 13, 14)


def _gtin_check_digit_ok(digits):
    """True when a GTIN's last digit is the right check digit for the rest."""
    if len(digits) not in _GTIN_LENGTHS or not digits.isdigit():
        return True            # nothing to check: not a GTIN shape
    body, check = digits[:-1], int(digits[-1])
    # Weights alternate 3 and 1, counting from the RIGHTMOST body digit, which
    # always carries 3. Same rule for every GTIN length.
    total = 0
    for i, ch in enumerate(reversed(body)):
        total += int(ch) * (3 if i % 2 == 0 else 1)
    return (10 - total % 10) % 10 == check


# [ADDED v2026.10.6] (C) Could a SCANNER have produced this?
#
# normalize_barcode is deliberately lenient about length: it only check-digits
# a GTIN shape, so a short code the user typed in himself survives. That is
# right for a typed code and wrong for a scanned one, because an Interleaved
# 2 of 5 short read off an EAN-13's bars is numeric and EVEN-LENGTH - six
# digits, say - and sails straight through a length test that has nothing to
# check.
#
# A retail barcode IS a GTIN. At the scan boundary nothing less will do, so
# this one is strict, and the panel's isValidGtin mirrors it exactly.
def is_gtin(value):
    """True only for a GTIN-8/12/13/14 whose check digit matches."""
    text = str("" if value is None else value).strip()
    if not text.isdigit() or len(text) not in _GTIN_LENGTHS:
        return False
    if not text.strip("0"):
        return False
    return _gtin_check_digit_ok(text)


# [ADDED v2026.10.5] (B) Does this code mean the same thing in another shop?
#
# barcode_history remembers where a product lives so the next receipt carrying
# the same code files itself. That rests on a GTIN being globally unique,
# which is true for packaged goods and NOT true for the ranges GS1 reserves
# for "restricted distribution" - every supermarket assigns those for itself:
#
#     EAN-13 : 02, and 20-29
#     UPC-A  : leading 2 (variable weight) or 4 (in-store)
#
# The deli counter, the bakery, anything sold by weight. 2300123456789 at one
# chain is a different product from the same code at another, so remembering
# it means the next shop's cheese inherits this shop's olives - its category,
# its sub-category and its room. Exactly the defect that was just fixed, but
# with a code that looks legitimate.
#
# The item KEEPS its barcode either way. This only decides whether the code is
# worth remembering ACROSS receipts, which is a different question from
# whether it is a barcode (normalize_barcode).
def is_portable_barcode(value):
    """True when this code identifies the same product in any shop."""
    code = normalize_barcode(value)
    if not code:
        return False
    # The restricted ranges are a property of GS1 numbering, so the test
    # only applies to something shaped like a GS1 number. The isdigit
    # check used to sit at the top and refused a Code-128 label outright,
    # which was the same mistake as refusing a short code: it is not a
    # GTIN, so GS1 says nothing about it either way.
    if code.isdigit():
        if len(code) == 13:
            head = code[:2]
            return not (head == "02" or "20" <= head <= "29")
        if len(code) == 12:
            return code[0] not in ("2", "4")
    # Any other length is not a GTIN at all, so GS1's restricted ranges say
    # nothing about it and this function has no reason to refuse it. The
    # codes that reach here are ones a user typed or a scanner read off a
    # non-retail label, and remembering those is exactly what the user
    # expects.
    #
    # An earlier version refused them, on the reasoning that an unknown
    # code cannot be trusted to travel. st24 caught it: a short code a user
    # had entered themselves silently stopped being remembered, with no
    # message anywhere. Refusing was the WRONG direction here - the danger
    # this function exists for is a code a SHOP assigned, and a code that
    # is not a GTIN is not one of those.
    return True
def normalize_barcode(value):
    """Return a usable barcode string, or "" when there is none."""
    text = str("" if value is None else value).strip()
    if not text or text.casefold() in _NOT_A_BARCODE:
        return ""
    if not any(ch.isdigit() for ch in text):
        return ""
    # "0", "00", "000" - a placeholder, never a product.
    if not text.strip("0 "):
        return ""
    # [ADDED v2026.10.5] A GTIN whose check digit does not match was
    # misread. Rejecting it leaves the item without a barcode, which is
    # harmless; accepting it files the item under another product.
    if not _gtin_check_digit_ok(text):
        _LOGGER.debug(
            "[HO-BARCODE] %r fails its check digit - treated as no barcode.",
            text)
        return ""
    return text


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


def _clean_level(value):
    """A level column as a place name, with the internal markers gone.

    [ADDED v2026.9.22] A level can hold '[ORDER_MARKER_010] Kitchen' or
    '[Floor 1] Kitchen'; the first is ours and the second is the user's own
    zone prefix. Neither belongs in a sentence that says where the milk is.

    Extracted because a second reader needed it - the dashboard's expiry
    list - and two copies of a regular expression is two things to keep in
    step (RULE 33d).
    """
    if not value:
        return ""
    cleaned = re.sub(
        r"\[?\s*(?:ORDER_MARKER|ZONE_MARKER)_\d+\s*\]?[_\s]*", "", str(value)
    ).strip()
    cleaned = re.sub(r"^\s*\[[^\]]*\]\s*", "", cleaned).strip()
    return cleaned


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


def _vendors_compatible(first, second):
    """True when two readings of one shop name are plainly the same shop.

    The model does not transcribe a shop name identically every time. The same
    receipt was stored once as "Rami Levy Shivuk HaShikma" and once, from the
    same PDF, as "Rami Levy" - and because vendor is half the duplicate key,
    neither the lookup nor the UNIQUE index that backs it up saw a duplicate.

    One name containing the other is the shape that happens: a suffix dropped,
    a branch left off. Three characters is the floor, because a shorter string
    is contained in almost anything.

    This is never used on its own - see the caller, which also demands the same
    receipt number and the same total before it will call two rows one receipt.
    """
    a = " ".join((first or "").split()).casefold()
    b = " ".join((second or "").split()).casefold()
    if not a or not b:
        return False
    if a == b:
        return True
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    return len(shorter) >= 3 and shorter in longer

async def async_find_receipt(hass, vendor, receipt_number, total_amount=None):
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
                # [ADDED v2026.9.27] Why a re-scan was not recognised as the
                # same receipt cannot be worked out afterwards, so the near
                # misses are recorded: every row carrying this number, whatever
                # its vendor or status. Only the no-match case is logged, so
                # this stays silent in normal use.
                #
                # It separates the three things that can go wrong. A row here
                # with the same vendor means the status filter excluded it. A
                # row with a different vendor means the two readings of the
                # shop name differ. Nothing here means the number itself was
                # read differently.
                #
                # [MODIFIED v2026.9.27] Debug level, not info. A shop name,
                # a receipt number and a total are not credentials, but they
                # are a record of what somebody bought, and a line that
                # writes them into the default log is a line that ends up
                # pasted into a bug report. What is worth keeping is whether
                # a match was found and why not, and that is worth turning
                # debug on for rather than recording from every scan.
                try:
                    async with db.execute(
                        "SELECT id, vendor, receipt_number, status "
                        "FROM receipts WHERE receipt_number = ? "
                        "COLLATE NOCASE LIMIT 5",
                        (receipt_number,),
                    ) as near_cur:
                        near = [dict(r) for r in await near_cur.fetchall()]
                    _LOGGER.debug(
                        "[HO-SCAN] No duplicate found for vendor=%r "
                        "number=%r. Rows carrying that number: %s",
                        vendor, receipt_number, near,
                    )
                except Exception:
                    pass

                # [ADDED v2026.9.27] Second chance: the shop name was read
                # differently.
                #
                # vendor is deliberately half the key, because a receipt number
                # alone is not unique - two shops can both issue "0001". But the
                # same document read twice can produce two different shop names,
                # and then the exact match fails AND the UNIQUE index does not
                # apply, so nothing at all stops a second copy being stored.
                #
                # So the number is matched with the TOTAL, and only then is the
                # vendor allowed to be a looser fit. Number, total and a name
                # that contains the other name is not something two different
                # shops produce; a number on its own is.
                total = _coerce_amount(total_amount)
                if total is not None:
                    try:
                        async with db.execute(
                            "SELECT * FROM receipts "
                            "WHERE receipt_number = ? COLLATE NOCASE "
                            "AND total_amount IS NOT NULL "
                            # Floats, so a tolerance rather than equality.
                            "AND ABS(total_amount - ?) < 0.01 "
                            "AND COALESCE(status, 'active') IN ('active', 'draft')",
                            (receipt_number, float(total)),
                        ) as alt_cur:
                            candidates = [dict(r) for r in await alt_cur.fetchall()]
                        for candidate in candidates:
                            if _vendors_compatible(vendor, candidate.get("vendor")):
                                _LOGGER.debug(
                                    "[HO-SCAN] Same receipt under a different "
                                    "shop name: stored as %r, scanned as %r "
                                    "(number=%r total=%s)",
                                    candidate.get("vendor"), vendor,
                                    receipt_number, total,
                                )
                                return candidate
                    except Exception as alt_err:
                        _LOGGER.error(
                            "Receipt second-chance lookup failed: %s", alt_err)

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


async def async_get_dashboard_data(hass, year=None, expiry_days=30,
                                   min_price=2.0):
    """Everything the home dashboard shows, in one connection.

    [ADDED v2026.9.22] One call, not eight. The dashboard is the first thing
    the panel renders, and eight round trips to the same file is eight chances
    to be half-drawn.

    WHAT IS SUMMED, AND WHY IT IS receipts AND NOT purchase_history.

    purchase_history holds a row per PRODUCT. A tank of fuel has no products,
    so it would be invisible there - and even on a shopping receipt the lines
    rarely add up to the total, because of tax, deposits and discounts. The
    receipt total is what actually left the account, so that is what a
    spending chart has to show.

    status='active' excludes two things on purpose: a scan whose lines nobody
    has confirmed yet, and a receipt superseded by a re-scan. Neither is
    money spent twice.

    Currencies are grouped, never converted. There is no exchange rate here
    and Home Assistant is often run with no internet at all (RULE 16), so a
    single number mixing two currencies would be a lie.

    [MODIFIED v2026.9.22] A YEAR, not a month. One month of receipts is a
    single number with nothing to compare it against - the first user to see
    it had ten receipts on file and a chart with one bar on it. The window
    is now a calendar year, the caller picks which, and the current month is
    marked so it can be drawn apart from the other eleven.
    """
    out = {
        "spend": [], "year_months": [], "years": [],
        "expiring": [], "counts": {}, "month": "", "year": 0,
        "price_watch": [], "uncounted": [], "undated": 0,
    }
    try:
        db_path = get_db_path(hass)
        today = dt_util.now().date()
        month = today.strftime("%Y-%m")
        out["month"] = month
        horizon = (today + timedelta(days=int(expiry_days))).strftime("%Y-%m-%d")

        # The year on show. Anything unreadable or out of range falls back to
        # the current one rather than failing: whatever arrives here, the
        # only thing it is ever allowed to become is a year (RULE 31).
        try:
            shown = int(year)
        except (TypeError, ValueError):
            shown = today.year
        if shown < 1970 or shown > today.year + 1:
            shown = today.year
        out["year"] = shown
        like_year = f"{shown:04d}-%"
        # The house currency, for the one figure here that has no currency
        # of its own: an item carries a price and nothing else, so the
        # money it is counted in is whatever Home Assistant is set to. It
        # is reported per-currency like every other row, so if the house is
        # set to one currency and the receipts are in another, the panel
        # keeps them apart instead of adding them together (RULE 16).
        house_currency = getattr(hass.config, "currency", None) or ""

        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row

            # 1. The selected year, by what the money went ON.
            #
            #    [MODIFIED v2026.9.22] BY PRODUCT LINE, not by receipt.
            #
            #    A receipt is not one kind of spending. One trip to the
            #    supermarket is tomatoes, eggs, a toy for a child and a
            #    bottle of sunscreen; filing the whole receipt under
            #    'Groceries' answers a question nobody asked. The item
            #    carries the category, so the breakdown sums product lines.
            #
            #    THREE SOURCES, and all three are needed for the list to add
            #    up to the total on the same card:
            #
            #      items    - purchase_history, by the item's own category.
            #      services - a receipt with NO product lines at all: fuel,
            #                 a hotel, a restaurant. Nothing about those is
            #                 in purchase_history and never will be, so the
            #                 receipt's own expense_category is the only
            #                 thing that can speak for them.
            #      the rest - what is left of the receipt totals after both.
            #                 Discounts read onto one line and not another,
            #                 deposits, tax, and lines nobody has approved.
            #                 Reported as its own row rather than spread
            #                 across the categories, because spreading it
            #                 would make every category slightly false.
            #
            #    kind travels with each row: the panel translates an item
            #    category through cat_ keys and a service bucket through
            #    exp_ keys, and they are different vocabularies.
            rows = []
            async with db.execute(
                "SELECT COALESCE(NULLIF(TRIM(ph.category), ''), '') AS cat, "
                "       COALESCE(ph.currency, '') AS cur, "
                "       SUM(COALESCE(ph.unit_price, 0) "
                "           * COALESCE(NULLIF(ph.quantity, 0), 1)) AS total, "
                "       COUNT(*) AS n "
                "FROM purchase_history ph "
                "JOIN receipts r ON r.id = ph.receipt_id "
                "WHERE r.status = 'active' AND ph.unit_price IS NOT NULL "
                "  AND r.purchase_date LIKE ? "
                "GROUP BY cat, cur",
                (like_year,),
            ) as cur:
                for r in await cur.fetchall():
                    row = dict(r)
                    row["kind"] = "item"
                    rows.append(row)

            async with db.execute(
                "SELECT COALESCE(r.expense_category, '') AS cat, "
                "       COALESCE(r.currency, '') AS cur, "
                "       SUM(r.total_amount) AS total, COUNT(*) AS n "
                "FROM receipts r "
                "WHERE r.status = 'active' AND r.total_amount IS NOT NULL "
                "  AND r.purchase_date LIKE ? "
                "  AND NOT EXISTS (SELECT 1 FROM purchase_history ph "
                "                  WHERE ph.receipt_id = r.id) "
                "GROUP BY cat, cur",
                (like_year,),
            ) as cur:
                for r in await cur.fetchall():
                    row = dict(r)
                    row["kind"] = "service"
                    rows.append(row)

            # The remainder, per currency. Computed against the same receipt
            # totals the chart above is drawn from, so the list and the
            # column agree by construction rather than by luck.
            async with db.execute(
                "SELECT COALESCE(r.currency, '') AS cur, "
                "       SUM(r.total_amount) AS total "
                "FROM receipts r "
                "WHERE r.status = 'active' AND r.total_amount IS NOT NULL "
                "  AND r.purchase_date LIKE ? "
                "  AND EXISTS (SELECT 1 FROM purchase_history ph "
                "              WHERE ph.receipt_id = r.id) "
                "GROUP BY cur",
                (like_year,),
            ) as cur:
                receipts_with_lines = {r["cur"]: (r["total"] or 0.0)
                                       for r in await cur.fetchall()}
            lines_by_cur = {}
            for row in rows:
                if row["kind"] != "item":
                    continue
                lines_by_cur[row["cur"]] = (lines_by_cur.get(row["cur"], 0.0)
                                            + (row["total"] or 0.0))
            for code, paid in receipts_with_lines.items():
                gap = round(paid - lines_by_cur.get(code, 0.0), 2)
                # A gap under a unit of currency is rounding, not a
                # discount, and a row saying "0" teaches the eye to skip
                # the whole list.
                if abs(gap) < 1:
                    continue
                rows.append({"cat": "", "cur": code, "total": gap,
                             "n": 0, "kind": "diff"})

            # [ADDED v2026.9.22] Things bought with no receipt behind them.
            #
            # An item added by hand, or by voice, or from a barcode, can
            # carry a price the user typed in. Nothing about it reaches
            # purchase_history - that table is written only when a receipt
            # line is approved - so until now that money appeared nowhere
            # on this screen at all.
            #
            # It is its OWN row and is never folded into a category, for
            # the reason that decides everything else on this card: the
            # chart above is receipt totals, this money has no receipt, and
            # adding it to a category would make that category disagree
            # with the column it sits under.
            #
            # CURRENT YEAR ONLY, and this is the honest limit of it. An
            # item has no purchase date to file it under: item_date is
            # rewritten to today every time the quantity changes, so it
            # says when the item was last touched, and created_at does not
            # survive ALTER TABLE on a database that already has rows. So
            # this is a figure about what is in the house NOW, and it is
            # not offered for a past year where it would be a guess.
            #
            # price * quantity, because purchase_price is the UNIT price
            # everywhere in this schema and quantity is what is on the
            # shelf. Discarded items are out: this is what the house holds.
            if shown == today.year:
                # typeof(), because SQLite sorts TEXT above every number:
                # a price stored as 'not a number' passes "> 0" happily,
                # contributes nothing to the sum and still lands in the
                # count - so the row would have read "(2)" beside the value
                # of one item. The column is REAL and the panel coerces,
                # but a declared type is not a constraint in SQLite.
                #
                # The quantity guard makes the count and the money agree:
                # a priced item at quantity zero is worth nothing on the
                # shelf, so counting it would inflate the number beside a
                # figure it did not contribute to.
                async with db.execute(
                    "SELECT SUM(purchase_price * COALESCE(quantity, 1)) AS total, "
                    "       COUNT(*) AS n "
                    "FROM items "
                    "WHERE type = 'item' AND receipt_id IS NULL "
                    "  AND typeof(purchase_price) IN ('integer', 'real') "
                    "  AND purchase_price > 0 "
                    "  AND (quantity IS NULL "
                    "       OR (typeof(quantity) IN ('integer', 'real') "
                    "           AND quantity > 0)) "
                    "  AND COALESCE(discarded, 0) = 0"
                ) as cur:
                    manual = await cur.fetchone()
                if manual and (manual["total"] or 0) > 0:
                    rows.append({
                        "cat": "", "cur": house_currency,
                        "total": round(manual["total"], 2),
                        "n": manual["n"] or 0, "kind": "manual",
                    })

            # Real categories by size, then the two rows that are not
            # categories, in a fixed order at the bottom. Sorting those two
            # by value would drop the remainder into the middle of the list
            # where it reads as one more kind of shopping.
            TAIL = {"diff": 1, "manual": 2}
            rows.sort(key=lambda r: (TAIL.get(r.get("kind"), 0),
                                     -(r.get("total") or 0.0)))
            out["spend"] = rows

            # 2. Every month of that year that has anything in it. A month
            #    with no receipts does not come back at all; the panel draws
            #    the twelve columns and leaves that one empty, which is the
            #    truth and costs no row here.
            async with db.execute(
                "SELECT substr(purchase_date, 1, 7) AS ym, "
                "       COALESCE(currency, '') AS cur, "
                "       SUM(total_amount) AS total, COUNT(*) AS n "
                "FROM receipts "
                "WHERE status = 'active' AND total_amount IS NOT NULL "
                "  AND purchase_date LIKE ? "
                "GROUP BY ym, cur ORDER BY ym ASC",
                (like_year,),
            ) as cur:
                out["year_months"] = [dict(r) for r in await cur.fetchall()]

            # 3. Which years the picker may offer: the ones that HAVE
            #    receipts, plus the current one and the one being shown. A
            #    list built from anything else can take the user to an empty
            #    screen that has no way back to a full one.
            years = {today.year, shown}
            async with db.execute(
                "SELECT DISTINCT substr(purchase_date, 1, 4) AS y "
                "FROM receipts "
                "WHERE status = 'active' AND total_amount IS NOT NULL "
                "  AND purchase_date IS NOT NULL "
                "  AND length(purchase_date) >= 4 "
                "ORDER BY y DESC"
            ) as cur:
                for r in await cur.fetchall():
                    try:
                        y = int(r["y"])
                    except (TypeError, ValueError):
                        continue
                    if 1970 <= y <= today.year + 1:
                        years.add(y)
            out["years"] = sorted(years, reverse=True)

            # 3b. [ADDED v2026.9.22] Money the chart does NOT show.
            #
            # A user adding up the receipts they can see in the archive and
            # comparing it with the chart total found 74.33 missing, and the
            # screen said nothing at all. Two ways money goes quiet:
            #
            #   draft   - scanned, no line confirmed yet, so it is in no
            #             total anywhere by design. It is still money spent.
            #   undated - active, but with no readable purchase date, so it
            #             belongs to no year and cannot appear under any
            #             setting of the picker.
            #
            # Reported rather than folded in. Counting a draft would defeat
            # the review step, and guessing a year for an undated receipt is
            # worse than saying it has none (RULE 31) - but a gap the user
            # can see and the app cannot explain is the actual defect.
            async with db.execute(
                "SELECT COALESCE(currency, '') AS cur, "
                "       SUM(total_amount) AS total, COUNT(*) AS n "
                "FROM receipts "
                "WHERE COALESCE(status, 'draft') = 'draft' "
                "  AND total_amount IS NOT NULL "
                "  AND purchase_date LIKE ? "
                "GROUP BY cur ORDER BY total DESC",
                (like_year,),
            ) as cur:
                out["uncounted"] = [dict(r) for r in await cur.fetchall()]
            async with db.execute(
                "SELECT COUNT(*) FROM receipts "
                "WHERE COALESCE(status, 'draft') != 'superseded' "
                "  AND total_amount IS NOT NULL "
                "  AND (purchase_date IS NULL "
                "       OR length(TRIM(COALESCE(purchase_date, ''))) < 7)"
            ) as cur:
                out["undated"] = (await cur.fetchone())[0]

            # 4. Running out. The only part of this screen that asks for
            #    something to be done today, so it carries the location -
            #    knowing the yoghurt expires is no use without the shelf.
            async with db.execute(
                "SELECT id, name, expiry_date, quantity, category, "
                "       level_1, level_2, level_3 "
                "FROM items "
                "WHERE type = 'item' AND expiry_date IS NOT NULL "
                "  AND TRIM(expiry_date) != '' AND expiry_date <= ? "
                "ORDER BY expiry_date ASC LIMIT 60",
                (horizon,),
            ) as cur:
                for r in await cur.fetchall():
                    row = dict(r)
                    parts = [_clean_level(row.get(f"level_{i}")) for i in range(1, 4)]
                    row["location"] = " / ".join(p for p in parts if p and p.strip())
                    for i in range(1, 4):
                        row.pop(f"level_{i}", None)
                    out["expiring"].append(row)

            # 5. The tiles.
            async with db.execute(
                "SELECT COALESCE(category, '') AS cat, COUNT(*) AS n "
                "FROM items WHERE type = 'item' GROUP BY cat"
            ) as cur:
                by_cat = {r["cat"]: r["n"] for r in await cur.fetchall()}
            out["counts"] = {
                "items": sum(by_cat.values()),
                "by_category": by_cat,
                "out_of_stock": 0,
                "shopping": 0,
                "receipts": 0,
            }
            async with db.execute(
                "SELECT COUNT(*) FROM items WHERE type='item' AND quantity <= 0"
            ) as cur:
                out["counts"]["out_of_stock"] = (await cur.fetchone())[0]
            async with db.execute(
                "SELECT COUNT(*) FROM items "
                "WHERE type='item' AND COALESCE(order_qty, 0) > 0"
            ) as cur:
                out["counts"]["shopping"] = (await cur.fetchone())[0]
            async with db.execute(
                "SELECT COUNT(*) FROM receipts "
                "WHERE COALESCE(status,'draft') != 'superseded'"
            ) as cur:
                out["counts"]["receipts"] = (await cur.fetchone())[0]
            # [ADDED v2026.9.22] Scanned but never confirmed.
            #
            # These are NOT in stock and are in no total on this screen -
            # which is correct, and also why nothing showed them. A house
            # whose receipts are all still sitting in the review tab looks
            # empty to every other part of the app, including the cook.
            async with db.execute(
                "SELECT COUNT(*) FROM items WHERE type = 'pending'"
            ) as cur:
                out["counts"]["pending"] = (await cur.fetchone())[0]
            # [ADDED v2026.9.22] What got more expensive, per PRODUCT.
            #
            # purchase_history holds one row per product with its unit
            # price, so this compares a jar of coffee with the same jar of
            # coffee. It can never compare two holidays: a service receipt
            # has no product lines at all, so nothing about it is in this
            # table - one trip at 6,000 and another at 9,000 are two
            # different purchases, not a price rise, and they are simply
            # not here to be confused.
            #
            # Four guards, each one a way of being wrong:
            #   same currency  - a percentage across two currencies is noise
            #   different days - two lines on one receipt are not a history
            #   a real floor   - a 0.20 item going to 0.30 is +50% and means
            #                    nothing; small change, large percentage
            #   at least 5%    - below that it is rounding, not a rise
            #
            # Its own try: window functions are ancient but this is the one
            # query here that uses them, and a dashboard should lose a
            # panel rather than fail whole.
            try:
                async with db.execute(
                    "WITH ranked AS ("
                    "  SELECT product_key, name, unit, currency, unit_price, "
                    "         purchase_date, vendor, "
                    "         ROW_NUMBER() OVER (PARTITION BY product_key "
                    "           ORDER BY purchase_date DESC, id DESC) rn "
                    "  FROM purchase_history "
                    "  WHERE unit_price IS NOT NULL AND unit_price > 0 "
                    "    AND TRIM(COALESCE(purchase_date, '')) != '') "
                    "SELECT a.name AS name, a.currency AS cur, "
                    "       a.unit_price AS now_price, b.unit_price AS was_price, "
                    "       a.purchase_date AS now_date, b.purchase_date AS was_date, "
                    "       a.vendor AS vendor, "
                    "       (a.unit_price - b.unit_price) * 100.0 / b.unit_price AS pct "
                    "FROM ranked a JOIN ranked b ON a.product_key = b.product_key "
                    "WHERE a.rn = 1 AND b.rn = 2 "
                    "  AND COALESCE(a.currency,'') = COALESCE(b.currency,'') "
                    "  AND a.purchase_date > b.purchase_date "
                    "  AND b.unit_price >= ? "
                    "  AND (a.unit_price - b.unit_price) * 100.0 / b.unit_price >= 5 "
                    "ORDER BY pct DESC LIMIT 3",
                    (float(min_price),),
                ) as cur:
                    out["price_watch"] = [dict(r) for r in await cur.fetchall()]
            except Exception as watch_err:
                _LOGGER.warning("Price watch unavailable: %s", watch_err)
    except Exception as err:
        _LOGGER.error("Dashboard data failed: %s", err)
    return out


async def async_get_expense_categories(hass):
    """The expense buckets, in their own order. A list of names."""
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(
                "SELECT category FROM db_expense_categories "
                "ORDER BY cat_order ASC, category COLLATE NOCASE ASC"
            ) as cur:
                return [r[0] for r in await cur.fetchall()]
    except Exception as err:
        _LOGGER.error("Loading expense categories failed: %s", err)
        return []


def resolve_expense_category(choice, allowed):
    """Map a proposed bucket onto one that exists, or None.

    [ADDED v2026.9.22] THE gate. The model proposes and this decides, the
    same shape as the cookbook's chapter resolver: a name that is not
    already a category is refused rather than created, because a bucket
    nobody chose is a bar on a chart nobody can explain (RULE 22).

    Matched case-insensitively and returned in the table's OWN spelling, so
    'fuel' does not become a second 'Fuel'.
    """
    wanted = str(choice or '').strip().lower()
    if not wanted:
        return None
    for name in allowed or []:
        if str(name).strip().lower() == wanted:
            return name
    return None


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
            _coerce_text(data.get("expense_category"), 60) or None,
            # [ADDED v2026.9.22] What the lines added up to at scan time,
            # against total_amount, which is what was paid. Appended at the
            # END of both the tuple and the column list, and the two are
            # read side by side rather than counted: a column inserted in
            # the middle of one of them shifts every field after it, which
            # is how _row_to_dict went wrong once already (RULE 33a.3).
            _coerce_amount(data.get("lines_total")),
        )

        # [ADDED v2026.9.22] A receipt with no lines is active at once.
        #
        # 'draft' means 'no human has confirmed a line yet', and it is
        # promoted by async_activate_receipt on the first approval. A tank
        # of fuel or a night in a hotel HAS no lines - there is nothing to
        # approve, so it would have sat in draft for ever and never been
        # counted in a single spending total. The header is the whole
        # record for those, and the user took the photograph on purpose.
        status = 'active' if int(data.get('item_count') or 0) == 0 else 'draft'
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cur = await db.execute(
                "INSERT INTO receipts "
                "(receipt_number, vendor, purchase_date, total_amount, "
                " currency, file_path, item_count, expense_category, "
                " lines_total, status) "
                # Status is decided above: 'draft' when there are lines to
                # confirm, 'active' when there are none. The money left the
                # account either way, but a scan whose lines nobody has
                # looked at must not reach a spending total. Promoted by
                # async_activate_receipt on the first approval.
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                values + (status,),
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


# Words that carry no identity and would cause false matches if compared.
#
# [MODIFIED v2026.9.19] English only. These words describe the ingredient
# rather than name it, so every language needs its own set - but a set of
# Hebrew or Italian words written here would be natural language inside the
# code, which RULE 17 does not allow, and only the language someone happened
# to add would ever be served. The rest arrive from the caller as data, read
# from the translation file, exactly as the pantry staples do. English stays
# because it is the language the code itself is written in, and because it is
# the fallback when no caller supplies anything.
_STOPWORDS = {
    "or", "and", "of", "the", "a", "an", "fresh", "large", "small", "medium",
    "extra", "virgin", "ground", "chopped", "sliced", "optional", "to", "taste",
}


def _significant_words(name, stopwords=None):
    """The identifying words of an item or ingredient name.

    Punctuation, percentages and pack sizes are dropped, so "Yellow Cheese
    28%" and "yellow cheese" compare equal. Descriptive words that appear on
    one side but not the other - "fresh", "extra virgin", "large" - are
    dropped too, because they describe a product rather than identify it.

    [MODIFIED v2026.9.19] stopwords adds the caller's own language to the
    English set. Without it an Italian shelf holding "pomodoro" never matched
    a recipe asking for "pomodoro fresco".
    """
    if not name:
        return set()
    text = str(name).lower()
    text = re.sub(r"[\d]+\s*%", " ", text)          # 28%
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    drop = _STOPWORDS
    if stopwords:
        drop = _STOPWORDS | {str(w or "").strip().lower() for w in stopwords if w}
    words = {w for w in text.split() if len(w) > 1 and w not in drop}
    # A name made only of stopwords and numbers still has to match something,
    # so fall back to whatever is left rather than returning nothing.
    return words or {w for w in text.split() if w}


def _is_pantry_staple(ing_name, staples):
    """Is this ingredient one of the things every kitchen already has?

    [ADDED v2026.9.19] Matched on whole words so "salt" is a staple while
    "salted butter" is not, and "oil" covers "olive oil" without swallowing
    "oily fish". The words themselves come from the caller - see
    async_check_ingredients for why they are not listed in this file.
    """
    if not staples:
        return False
    lowered = ing_name.lower()
    words = set(re.findall(r"\w+", lowered, flags=re.UNICODE))
    for staple in staples:
        token = str(staple or "").strip().lower()
        if not token:
            continue
        # A staple of several words ("olive oil") matches as a phrase; a
        # single word matches only as a whole word.
        if " " in token:
            if token in lowered:
                return True
        elif token in words:
            return True
    return False


async def async_check_ingredients(hass, ingredients, assume_available=None,
                                  stopwords=None):
    """Match a recipe's ingredients against the inventory.

    Returns one entry per ingredient with where it is and how much is there,
    so the cookbook can say "flour - kitchen, top shelf" instead of a bare
    tick. The shopping decision stays with the caller: this only reports.

    Matching is deliberately fuzzy in one direction only. A recipe says
    "yellow cheese" and the shelf holds "Yellow Cheese 28%", so an ingredient
    matches when either name contains the other. It does NOT match on single
    shared words - "oil" and "olive oil" are close enough to be useful, but
    "salt" must not match "salted butter", which is why whole-substring
    containment is used rather than token overlap.
    """
    if not ingredients:
        return []
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                # [MODIFIED v2026.10.1] id as well. The panel needs to be
                # able to deduct what was used, and this function already
                # worked out WHICH row each ingredient matched - making the
                # panel match the name again would be a second matcher that
                # could disagree with this one (RULE 33a.6).
                "SELECT id, name, quantity, unit, "
                "level_1, level_2, level_3, level_4, level_5 "
                "FROM items WHERE type = 'item'"
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]
    except Exception as err:
        _LOGGER.error("Ingredient check failed: %s", err)
        return []

    stock = []
    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        levels = [row.get(f"level_{i}") for i in range(1, 6)]
        parts = []
        for lvl in levels:
            if not lvl:
                continue
            # Strip the internal markers so a location reads as a place.
            cleaned = _clean_level(lvl)
            if cleaned:
                parts.append(cleaned)
        stock.append({
            "id": row.get("id"),
            "name": name,
            "lower": name.lower(),
            "quantity": row.get("quantity"),
            "unit": row.get("unit"),
            "location": " > ".join(parts),
        })

    results = []
    for ing in ingredients:
        # An ingredient is either a bare string or {name, qty}; both shapes
        # exist in saved recipes.
        if isinstance(ing, dict):
            ing_name = (ing.get("name") or ing.get("item") or "").strip()
            ing_qty = ing.get("qty") or ing.get("quantity") or ""
        else:
            ing_name = str(ing or "").strip()
            ing_qty = ""

        entry = {
            "ingredient": ing_name,
            "required": ing_qty,
            "in_stock": False,
            "item_id": None,
            "matched_name": None,
            "location": None,
            "quantity": None,
            "unit": None,
        }

        # [ADDED v2026.9.19] Water, salt, oil and pepper are assumed present.
        #
        # Nobody tracks the salt. Reporting it as missing sent the user
        # shopping for something already by the hob, and buried the one
        # ingredient that really was absent among four that were not.
        #
        # The words arrive from the CALLER rather than being listed here,
        # because an ingredient is written in the user's own language, and a
        # list of English words in this file would never match the Hebrew or
        # Italian word for salt. They belong in the translation file, which
        # is where the panel reads them from: they are data, not code, and
        # RULE 17 keeps the code itself English.
        if ing_name and _is_pantry_staple(ing_name, assume_available):
            entry["in_stock"] = True
            entry["assumed"] = True
            results.append(entry)
            continue
        # [MODIFIED v2026.10.13] Match on normalised words, not raw substrings.
        #
        # Plain containment failed on the two cases that matter most:
        #
        #   * "Extra virgin olive oil" against a shelf holding "Olive Oil,
        #     Extra Virgin" - the words are all there, in a different order,
        #     so neither string contains the other.
        #   * "Butter or Milk" against "Butter" - an ingredient naming an
        #     alternative matched nothing.
        #
        # Comparing the significant words of each name fixes both. It cannot
        # bridge languages - an English recipe against a Hebrew pantry still
        # needs the assistant, which is why Sous-Chef gets that right and this
        # does not - but it handles everything within one language.
        needle_words = _significant_words(ing_name, stopwords)
        if needle_words:
            best = None
            for item in stock:
                item_words = _significant_words(item["name"], stopwords)
                if not item_words:
                    continue
                shared = needle_words & item_words
                # Every word of the shorter name must appear in the longer
                # one. That keeps "olive oil" matching "extra virgin olive
                # oil" while stopping "salt" matching "salted butter", where
                # no whole word is shared.
                if shared and (shared == needle_words or shared == item_words):
                    has_qty = item["quantity"] is None or item["quantity"] > 0
                    # Prefer something actually in stock over an empty shelf
                    # entry with the same name.
                    if best is None or (has_qty and not best[1]):
                        best = (item, has_qty)
                    if has_qty:
                        break
            if best:
                item, has_qty = best
                # Something on the shelf but at zero is not "in stock";
                # saying it is would be worse than saying nothing.
                entry.update({
                    "in_stock": bool(has_qty),
                    "item_id": item["id"],
                    "matched_name": item["name"],
                    "location": item["location"] or None,
                    "quantity": item["quantity"],
                    "unit": item["unit"],
                })
        results.append(entry)
    return results


# [ADDED v2026.10.5] One panel preference, read and written by name.
async def async_get_setting(hass, key, default=None):
    """The stored value for a key, or the default."""
    try:
        async with aiosqlite.connect(get_db_path(hass), timeout=10.0) as db:
            async with db.execute(
                "SELECT value FROM app_settings WHERE key = ?", (key,)
            ) as cur:
                row = await cur.fetchone()
        return row[0] if row and row[0] is not None else default
    except Exception as err:
        _LOGGER.error("Reading setting %r failed: %s", key, err)
        return default


async def async_set_setting(hass, key, value):
    """Store one value. REPLACE, so a key holds exactly one row."""
    try:
        async with aiosqlite.connect(get_db_path(hass), timeout=10.0) as db:
            await db.execute(
                "REPLACE INTO app_settings (key, value, updated_at) "
                "VALUES (?, ?, CURRENT_TIMESTAMP)",
                (key, str(value)),
            )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Writing setting %r failed: %s", key, err)
        return False


# [ADDED v2026.10.5] Which product database the barcode scan asks, in order,
# and which of them are switched off.
#
# Stored as ONE json list in ranked order - [{"name": ..., "enabled": ...}] -
# because the order and the on/off state are one decision and a single row has
# nothing to keep in step (RULE 21).
#
# Reading REPAIRS. A name that is no longer a source is dropped, and a source
# missing from the stored list is appended, enabled. The source list is code
# and the stored order is data: data written by an older release must never
# leave a source unreachable.
async def async_get_barcode_sources(hass):
    """[{"name": str, "enabled": bool}] in the order they will be asked."""
    raw = await async_get_setting(hass, SETTING_BARCODE_SOURCES)
    stored = []
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                stored = parsed
        except Exception as err:
            _LOGGER.warning(
                "The stored barcode source order could not be read (%s); "
                "falling back to the default.", err)

    out, seen = [], set()
    for entry in stored:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "")
        if name not in BARCODE_SOURCES or name in seen:
            continue
        seen.add(name)
        out.append({"name": name, "enabled": bool(entry.get("enabled", True))})
    for name in DEFAULT_BARCODE_SOURCE_ORDER:
        if name not in seen:
            out.append({"name": name, "enabled": True})
    return out


async def async_set_barcode_sources(hass, rows):
    """Store the order. Refuses anything that is not every source, once.

    A write is the user pressing a button on a settings sheet. A partial
    order - a source missing, or one listed twice - would silently stop a
    source being asked at all, so it is refused outright (RULE 31).
    """
    clean, seen = [], set()
    for entry in rows or []:
        if not isinstance(entry, dict):
            return False
        name = str(entry.get("name") or "")
        if name not in BARCODE_SOURCES or name in seen:
            return False
        seen.add(name)
        clean.append({"name": name, "enabled": bool(entry.get("enabled"))})
    if len(clean) != len(BARCODE_SOURCES):
        return False
    return await async_set_setting(
        hass, SETTING_BARCODE_SOURCES, json.dumps(clean, ensure_ascii=False))


# [ADDED v2026.10.7] The locations wizard's answer sheet, and the two
# things it needs that nothing else provided.
#
# Stored as one JSON value in app_settings. Reading REPAIRS rather than
# refusing: a profile written by an older release must still open, so a
# missing key becomes a default and a value of the wrong type is dropped.
# The wizard is a form; a form that will not open because one field changed
# shape is worse than a form with one field reset.
async def async_get_home_profile(hass):
    """The stored wizard answers, or an empty profile."""
    raw = await async_get_setting(hass, SETTING_HOME_PROFILE)
    empty = {"version": 1, "home_type": "", "floors": [], "extras": {},
             "applied_at": "", "applied_paths": {}}
    if not raw:
        return empty
    try:
        parsed = json.loads(raw)
    except Exception as err:
        _LOGGER.warning(
            "The stored home profile could not be read (%s); the wizard "
            "opens blank rather than refusing to open.", err)
        return empty
    if not isinstance(parsed, dict):
        return empty
    out = dict(empty)
    for key, want in (("home_type", str), ("floors", list),
                      ("extras", dict), ("applied_at", str),
                      ("applied_paths", dict)):
        val = parsed.get(key)
        if isinstance(val, want):
            out[key] = val
    return out


async def async_set_home_profile(hass, profile):
    """Store the wizard answers. Refuses anything that is not a dict."""
    if not isinstance(profile, dict):
        return False
    return await async_set_setting(
        hass, SETTING_HOME_PROFILE,
        json.dumps(profile, ensure_ascii=False))


# [ADDED v2026.10.7] Per-location shelf life - the FIRST thing to write this
# table since it was created.
#
# database.py has carried "Renaming a location must update this table too,
# which is wired up in a later stage" since the table was added, and nothing
# ever wrote a row. The wizard seeds the fridge and only the fridge: the user
# asked for that explicitly, because everywhere else the expiry date comes
# from the AI when the item is created.
#
# The key is the path joined the way every other caller displays it.
async def async_set_shelf_life(hass, location_path, days):
    """Seed the shelf life for one location path. Refuses a bad value."""
    path = str(location_path or "").strip()
    try:
        value = int(days)
    except (TypeError, ValueError):
        return False
    # A day to a year. Anything else is a misread number, not a shelf life.
    if not path or value < 1 or value > 365:
        return False
    try:
        async with aiosqlite.connect(get_db_path(hass), timeout=10.0) as db:
            await db.execute(
                "REPLACE INTO location_settings (location_path, "
                "shelf_life_enabled, shelf_life_value, shelf_life_unit, "
                "updated_at) VALUES (?, 1, ?, 'days', CURRENT_TIMESTAMP)",
                (path, value),
            )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Seeding shelf life for %r failed: %s", path, err)
        return False


# [ADDED v2026.10.7] The location tree, for the wizard's diff.
#
# async_get_view_data builds this too, but as part of a page render with
# items, boxes and shopping in it. The wizard needs the names and nothing
# else, before it has drawn anything.
async def async_location_tree(hass):
    """{level_1: {level_2: [level_3, ...]}}, exactly as stored."""
    tree = {}
    try:
        async with aiosqlite.connect(get_db_path(hass), timeout=10.0) as db:
            async with db.execute(
                "SELECT DISTINCT level_1, level_2, level_3 FROM items "
                "WHERE level_1 IS NOT NULL AND level_1 != ''"
            ) as cur:
                for l1, l2, l3 in await cur.fetchall():
                    rooms = tree.setdefault(l1, {})
                    if l2:
                        spots = rooms.setdefault(l2, [])
                        if l3 and l3 not in spots:
                            spots.append(l3)
    except Exception as err:
        _LOGGER.error("Reading the location tree failed: %s", err)
    return tree


# [ADDED v2026.10.7] What is wrong with the locations that already exist.
#
# Every finding here was measured in a real installation, and the wizard
# offers them one by one with a count. NOTHING is applied without the user
# ticking it, and no finding ever deletes an item row - only the labels that
# point at them (RULE 5).
#
# Shown only when the wizard has been applied before: on a first run there is
# nothing to tidy, and a cleanup screen on an empty house is noise.
async def async_scan_location_issues(hass):
    """A list of {id, kind, count, examples} the user can choose to fix."""
    tree = await async_location_tree(hass)
    findings = []

    def clean(value):
        return _clean_level(value).strip()

    # 1. zone markers that no room sits under. 15 copies of
    #    'ZONE_MARKER_New Zone' were found in one house.
    zones = set()
    for l1 in tree:
        m = re.match(r"^ZONE_MARKER_\d+_(.*)$", str(l1 or ""))
        if m:
            zones.add(m.group(1).strip())
    empty_zones = []
    for l1 in tree:
        raw = str(l1 or "")
        if not raw.startswith("ZONE_MARKER"):
            continue
        name = re.sub(r"^ZONE_MARKER_(\d+_)?", "", raw).strip()
        has_rooms = any(
            str(other).startswith("[%s]" % name) for other in tree
        )
        if not has_rooms:
            empty_zones.append(raw)
    if empty_zones:
        findings.append({
            "id": "empty_zones", "kind": "empty_zones",
            "count": len(empty_zones), "examples": sorted(empty_zones)[:5],
            "targets": sorted(empty_zones),
        })

    # 2. a name with a space on the end. Two names that differ only by
    #    trailing space are two different locations on screen.
    spaced = []
    for l1, rooms in tree.items():
        for value in [l1] + list(rooms):  # the room name matters here
            if value and value != str(value).rstrip():
                spaced.append(value)
        for spots in rooms.values():
            spaced += [s for s in spots if s and s != str(s).rstrip()]
    if spaced:
        findings.append({
            "id": "trailing_space", "kind": "trailing_space",
            "count": len(set(spaced)), "examples": sorted(set(spaced))[:5],
            "targets": sorted(set(spaced)),
        })

    # 3. the same spot stored twice under one parent, once with an order
    #    marker and once without.
    dupes = []
    for l1, rooms in tree.items():
        for l2, spots in rooms.items():
            seen = {}
            for s in spots:
                seen.setdefault(clean(s), []).append(s)
            for base, variants in seen.items():
                if len(set(variants)) > 1:
                    dupes.append({"path": [l1, l2], "name": base,
                                  "variants": sorted(set(variants))})
    if dupes:
        findings.append({
            "id": "duplicate_spots", "kind": "duplicate_spots",
            "count": len(dupes),
            "examples": ["%s / %s" % (d["path"][1], d["name"])
                         for d in dupes[:5]],
            "targets": dupes,
        })

    # 4. a doubled order marker, from a rename that re-applied the prefix.
    doubled = []
    for rooms in tree.values():
        for spots in rooms.values():
            doubled += [s for s in spots
                        if len(re.findall(r"ORDER_MARKER_\d+", str(s))) > 1]
    if doubled:
        findings.append({
            "id": "doubled_marker", "kind": "doubled_marker",
            "count": len(set(doubled)), "examples": sorted(set(doubled))[:5],
            "targets": sorted(set(doubled)),
        })

    # 5. 'General' showing as a sub-location heading.
    generals = []
    for l1, rooms in tree.items():
        for l2, spots in rooms.items():
            if "General" in spots:
                generals.append({"path": [l1, l2], "name": "General"})
    if generals:
        findings.append({
            "id": "general_spots", "kind": "general_spots",
            "count": len(generals),
            "examples": ["%s / General" % g["path"][1] for g in generals[:5]],
            "targets": generals,
        })

    return findings


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


# [ADDED v2026.10.2] How many item rows each category and sub-category holds.
#
# The categories screen offers to delete a label and re-file everything under
# it. Offering that without saying how much "everything" is would be the blind
# destructive action RULE 33 exists to prevent.
#
# Counted the way the delete WORKS: no filter on type, because the UPDATE in
# async_delete_category has none either. A pending line waiting on the review
# screen carries a category and moves with the rest, so a number that left it
# out would understate what is about to happen.
#
# Two flat maps, not one nested map with a total key: a sub-category genuinely
# named "_total" would collide with the key holding the total.
async def async_category_item_counts(hass):
    """{"by_category": {cat: n}, "by_sub": {cat: {sub: n}}}."""
    out = {"by_category": {}, "by_sub": {}}
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT category, sub_category, COUNT(*) AS n FROM items "
                "WHERE category IS NOT NULL AND category != '' "
                "GROUP BY category, sub_category"
            ) as cur:
                rows = await cur.fetchall()
        for row in rows:
            cat = row["category"]
            sub = row["sub_category"] or ""
            n = row["n"] or 0
            out["by_category"][cat] = out["by_category"].get(cat, 0) + n
            if sub:
                out["by_sub"].setdefault(cat, {})[sub] = n
        return out
    except Exception as err:
        _LOGGER.error("Counting items per category failed: %s", err)
        return out


# [ADDED v2026.10.2] Delete a category or sub-category, re-filing its items.
#
# There was no delete before this. async_rename_category is the nearest thing
# and cannot do the job: UPDATE OR IGNORE means renaming onto a name that
# already exists moves the ITEMS but leaves the old row behind, so the junk
# entry stays in the list.
#
# The order inside the transaction is the design. Items are re-filed FIRST,
# then the category rows are removed, on one connection and one commit. An
# item row is NEVER deleted (RULE 5): a category is a label, and removing a
# label is not a reason to lose something the user owns.
#
# Returns a dict, not a bool, so a refusal can say why - a screen that can
# only report "nothing happened" leaves the user unable to tell a protection
# from a bug (RULE 2, RULE 10).
#
# reason is one of:
#   ok            - done. moved/removed say how much.
#   no_category   - nothing was named.
#   unknown       - no such category or sub-category. A second delete of the
#                   same thing lands here and changes nothing (RULE 6).
#   unknown_target- the destination does not exist. REFUSED rather than
#                   written onto the items: moving fifty items to a category
#                   that is not there is a worse version of this same problem
#                   (RULE 31).
#   same          - the destination is what is being deleted.
async def async_delete_category(hass, category, sub_category=None,
                                to_category=None, to_sub_category=None):
    """Remove a category or one sub-category; its items are re-filed."""
    category = _coerce_text(category, 60)
    sub_category = _coerce_text(sub_category, 60)
    to_category = _coerce_text(to_category, 60)
    to_sub_category = _coerce_text(to_sub_category, 60)
    if not category:
        return {"ok": False, "reason": "no_category", "moved": 0, "removed": 0}

    # Deleting something into itself would re-file the items onto a row that
    # is about to disappear.
    if (to_category and to_category.casefold() == category.casefold()
            and (sub_category or "").casefold()
            == (to_sub_category or "").casefold()):
        return {"ok": False, "reason": "same", "moved": 0, "removed": 0}

    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row

            # What exists, read by NAME rather than by position (RULE 33a.3).
            if sub_category:
                async with db.execute(
                    "SELECT COUNT(*) AS n FROM db_items_categories "
                    "WHERE category = ? COLLATE NOCASE "
                    "AND sub_category = ? COLLATE NOCASE",
                    (category, sub_category),
                ) as cur:
                    exists = (await cur.fetchone())["n"]
            else:
                async with db.execute(
                    "SELECT COUNT(*) AS n FROM db_items_categories "
                    "WHERE category = ? COLLATE NOCASE",
                    (category,),
                ) as cur:
                    exists = (await cur.fetchone())["n"]
            if not exists:
                return {"ok": False, "reason": "unknown",
                        "moved": 0, "removed": 0}

            # The destination has to be real BEFORE anything moves.
            if to_category:
                if to_sub_category:
                    async with db.execute(
                        "SELECT COUNT(*) AS n FROM db_items_categories "
                        "WHERE category = ? COLLATE NOCASE "
                        "AND sub_category = ? COLLATE NOCASE",
                        (to_category, to_sub_category),
                    ) as cur:
                        ok_target = (await cur.fetchone())["n"]
                else:
                    async with db.execute(
                        "SELECT COUNT(*) AS n FROM db_items_categories "
                        "WHERE category = ? COLLATE NOCASE",
                        (to_category,),
                    ) as cur:
                        ok_target = (await cur.fetchone())["n"]
                if not ok_target:
                    return {"ok": False, "reason": "unknown_target",
                            "moved": 0, "removed": 0}

            # The stored spelling of the destination, so the items carry the
            # same text as the category list rather than whatever case the
            # caller typed.
            dest_cat, dest_sub = "", ""
            if to_category:
                async with db.execute(
                    "SELECT category, sub_category FROM db_items_categories "
                    "WHERE category = ? COLLATE NOCASE "
                    + ("AND sub_category = ? COLLATE NOCASE "
                       if to_sub_category else "")
                    + "LIMIT 1",
                    ((to_category, to_sub_category) if to_sub_category
                     else (to_category,)),
                ) as cur:
                    trow = await cur.fetchone()
                dest_cat = trow["category"]
                dest_sub = trow["sub_category"] if to_sub_category else ""

            # 1. The items. Every row that pointed at what is going away now
            #    points at the destination, or at nothing - an uncategorised
            #    item is visible and fixable; one pointing at a name that no
            #    longer exists is not.
            if sub_category:
                where = ("category = ? COLLATE NOCASE "
                         "AND sub_category = ? COLLATE NOCASE")
                params = (category, sub_category)
            else:
                where = "category = ? COLLATE NOCASE"
                params = (category,)
            cur = await db.execute(
                "UPDATE items SET category = ?, sub_category = ? "
                "WHERE " + where,
                (dest_cat, dest_sub, *params),
            )
            moved = cur.rowcount or 0

            # 2. Only now the label itself.
            cur = await db.execute(
                "DELETE FROM db_items_categories WHERE " + where, params)
            removed = cur.rowcount or 0

            await db.commit()
        return {"ok": True, "reason": "ok", "moved": moved, "removed": removed}
    except Exception as err:
        _LOGGER.error("Deleting category failed: %s", err)
        return {"ok": False, "reason": "error", "moved": 0, "removed": 0}


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


# [ADDED v2026.10.2] Correct the date printed on the receipt.
#
# On the receipt, not on the item, for the same reason as the currency: every
# line of one receipt was bought on the same day, so storing it per item
# would let the two drift apart. An item's own item_date stays the day it was
# scanned, which is a different fact and is still useful.
#
# Validated here rather than in the service. _coerce_date enforces
# YYYY-MM-DD, which is not cosmetic: the expenses queries filter with
# LIKE '2026-08%', so any other shape silently breaks month filtering. A
# malformed value is REFUSED rather than stored as NULL - blanking the date
# of a real receipt because a typo arrived is not an acceptable outcome, and
# clearing it is not something the panel offers (RULE 31).
async def async_update_receipt_date(hass, receipt_id, purchase_date):
    """Set the purchase date of one receipt. Returns False if refused."""
    stamp = _coerce_date(purchase_date)
    if not stamp or not receipt_id:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                "UPDATE receipts SET purchase_date = ? WHERE id = ?",
                (stamp, receipt_id),
            )
            await db.commit()
        return True
    except Exception as err:
        _LOGGER.error("Receipt date update failed: %s", err)
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
    # [MODIFIED v2026.10.5] A shop-local code is not an identity.
    #
    # The docstring above says a barcode "is globally unique and stable",
    # which is true for a GTIN and false for the restricted ranges every
    # supermarket assigns itself. Grouping price history by one of those
    # merges two different products into a single series, so the expenses
    # screen shows one product moving between two unrelated prices.
    #
    # Those fall back to the name key, which is the better identity for a
    # deli item anyway. normalize_barcode also replaces the inline
    # none/None test here - the FOURTH place in this project that had its
    # own copy of it (RULE 33a.6).
    if is_portable_barcode(barcode):
        return f"bc:{normalize_barcode(barcode)}"
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
            # [ADDED v2026.9.22] What kind of thing this was. It comes from
            # the ITEM at approval time - the category the user saw and
            # could change - so a supermarket receipt contributes to food,
            # to toys and to cosmetics separately, which is what it was.
            _coerce_text(entry_data.get("category"), 60) or None,
        )
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                "INSERT INTO purchase_history "
                "(product_key, barcode, name, unit, unit_price, quantity, "
                " currency, purchase_date, vendor, receipt_id, category) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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


# [ADDED v2026.9.20] The icon fields of an item row, worked out once.
#
# Five blocks in this file build item rows - the shopping list, the review
# list, the location view, the search results and the sub-location view - and
# all five computed these by hand, identically. That is the shape RULE 33a.6
# describes, and it has already cost this project once: purchase and expiry
# fields were added to two of the three blocks that existed then, so an item
# opened from a shelf showed nothing.
#
# A drawn icon is a sixth thing to get right in five places, so the five
# copies became this.
#
#   img       the library key as-is, or a URL for a stored photograph
#   icon_spec the drawing the assistant designed for THIS item, as
#             the JSON spec it sent, or None. The panel draws it.
#
# The panel prefers a photograph, then the drawn icon, then the library key.
def _item_icon_fields(r_dict, url_prefix):
    raw_path = r_dict.get('image_path')
    img = None
    if raw_path:
        # A library key is passed through untouched; anything else is a
        # filename and only becomes a URL here, where the prefix is known.
        if str(raw_path).startswith("ICON_LIB"):
            img = raw_path
        else:
            img = f"{url_prefix}/{raw_path}?v={int(time.time())}"
    return img, (r_dict.get('icon_spec') or None)


async def async_get_view_data(hass, path_parts, query, date_filter, is_shopping,
                              boxes_only=False):
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

            # [ADDED v2026.9.27] Every box, and how full it is, in two queries.
            #
            # Read once here and used by EVERY row builder below. There are five
            # of them - shopping, pending, search and the two browse queries -
            # and a field added to some of them and not the rest is the defect
            # RULE 33a.6 is named after. One source, five consumers.
            box_info = {}
            try:
                async with db.execute(
                    "SELECT id, name, box_seq, box_type FROM items "
                    "WHERE type = 'box'"
                ) as cursor:
                    for r in await cursor.fetchall():
                        box_info[r[0]] = {"box_label": box_label(r[2]),
                                          "box_title": r[1] or "",
                                          # [ADDED v2026.9.30] Appended to
                                          # the SELECT, never inserted:
                                          # this row is read by position
                                          # (RULE 33a.3).
                                          "box_type": r[3] or "",
                                          "box_count": 0}
                async with db.execute(
                    "SELECT box_id, COUNT(*) FROM items "
                    "WHERE box_id IS NOT NULL GROUP BY box_id"
                ) as cursor:
                    for r in await cursor.fetchall():
                        if r[0] in box_info:
                            box_info[r[0]]["box_count"] = r[1]
            except Exception as box_err:
                _LOGGER.error("Box lookup for the view failed: %s", box_err)

            def _box_fields(row):
                """The box fields for one row, whether it IS a box or sits in one.

                A box row describes itself. An item row describes the box it is
                in, which is what lets the line under an item read
                "Garage > Shelf B - box3 M8 screws" and answer where a thing is
                without opening anything.
                """
                if (row.get("type") or "") == "box":
                    info = box_info.get(row.get("id")) or {}
                    return {
                        "box_id": None,
                        "box_label": info.get("box_label")
                                     or box_label(row.get("box_seq")),
                        "box_title": row.get("name") or "",
                        "box_type": row.get("box_type") or "",
                        "box_count": info.get("box_count", 0),
                    }
                info = box_info.get(row.get("box_id")) or {}
                return {
                    "box_id": row.get("box_id"),
                    "box_label": info.get("box_label", ""),
                    "box_title": info.get("box_title", ""),
                    "box_type": info.get("box_type", ""),
                    "box_count": 0,
                }

            if is_shopping:
                async with db.execute("SELECT * FROM items WHERE quantity = 0 AND type='item' ORDER BY level_2 ASC, level_3 ASC") as cursor:
                    for r_dict in await cursor.fetchall():
                        r_dict = dict(r_dict)
                        fp = [r_dict.get(f"level_{i}") for i in range(1, 11) if r_dict.get(f"level_{i}")]
                        
                        img, icon_spec = _item_icon_fields(r_dict, url_prefix)

                        shopping_list.append({
                            "id": r_dict['id'],
                            "name": r_dict['name'], 
                            "qty": r_dict['quantity'], 
                            "order_qty": r_dict.get('order_qty') or 1,
                            "date": r_dict['item_date'], 
                            "img": img,
                            "icon_spec": icon_spec,
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
                            # [ADDED v2026.9.27] One of five row builders.
                            **_box_fields(r_dict),
                        })

                async with db.execute("SELECT * FROM items WHERE type='pending' ORDER BY created_at DESC") as cursor:
                    for r_dict in await cursor.fetchall():
                        r_dict = dict(r_dict)
                        img, icon_spec = _item_icon_fields(r_dict, url_prefix)

                        pending_list.append({
                            "id": r_dict['id'],
                            # [ADDED v2026.10.2] The dates. The SELECT is
                            # `SELECT *`, so these were in r_dict all
                            # along - the builder listed every other
                            # column and not these three, which is why no
                            # date was visible before approval. Four other
                            # builders in this file return them
                            # (RULE 33a.6).
                            #
                            # Editing one before approval already works
                            # end to end: async_update_item_extras writes
                            # them by id with no filter on type, and
                            # handle_confirm_pending approves with an
                            # in-place UPDATE that never touches these
                            # columns, so the value survives.
                            #
                            # item_date is the day of the SCAN, stamped by
                            # async_add_item_db_safe. The date printed on
                            # the receipt is on the receipts row, not here.
                            "date": r_dict.get("item_date"),
                            "expiry_date": r_dict.get("expiry_date"),
                            "warranty_end_date": r_dict.get("warranty_end_date"),
                            "name": r_dict['name'], 
                            "qty": r_dict['quantity'], 
                            "order_qty": r_dict.get('order_qty', 1),
                            "img": img,
                            "icon_spec": icon_spec,
                            "level_1": r_dict.get("level_1", ""),
                            "level_2": r_dict.get("level_2", ""),
                            "level_3": r_dict.get("level_3", ""),
                            "category": r_dict.get("category", ""),
                            "sub_category": r_dict.get("sub_category", ""),
                            "barcode": r_dict.get("barcode", "0"),
                            # [ADDED v2026.9.20] What the scanner would have
                            # called a new category for this item. Read only
                            # here: a suggestion is a question about an item
                            # that has not been confirmed yet, and the review
                            # tab is the one screen that can answer it.
                            "suggested_category": r_dict.get("suggested_category") or "",
                            # [ADDED v2026.9.6 | STAGE 2] Purchase fields, so the
                            # review tab can show and correct the price before it
                            # is committed to the append-only history table.
                            "purchase_price": r_dict.get("purchase_price"),
                            "quantity_purchased": r_dict.get("quantity_purchased"),
                            "receipt_id": r_dict.get("receipt_id"),
                            # [ADDED v2026.9.27] One of five row builders.
                            **_box_fields(r_dict),
                        })

            # [ADDED v2026.9.27] Boxes only, from the toggle in the search bar.
            #
            # Placed before the ordinary search branch, because with the toggle
            # on an EMPTY field means "every box" - the opposite of what an empty
            # field means to a search for items, which is "nothing to look for".
            #
            # The text match is in Python rather than SQL: it tests each word
            # both ways round, which is what makes "box for screws" find a box
            # titled "M8 screws" in a language that glues its prepositions on.
            elif boxes_only:
                for row in await async_list_boxes(hass, path_parts, query):
                    img, icon_spec = _item_icon_fields(row, url_prefix)
                    fp = [row.get(f"level_{i}") for i in range(1, 11)
                          if row.get(f"level_{i}")]
                    items.append({
                        "id": row["id"],
                        "name": row.get("name") or "",
                        "type": "box",
                        "qty": 1,
                        "order_qty": 1,
                        "date": row.get("item_date"),
                        "img": img,
                        "icon_spec": icon_spec,
                        "location": " > ".join(fp),
                        "level_1": row.get("level_1", ""),
                        "level_2": row.get("level_2", ""),
                        "level_3": row.get("level_3", ""),
                        "box_id": None,
                        "box_label": row.get("box_label", ""),
                        "box_title": row.get("name") or "",
                        "box_count": row.get("box_count", 0),
                    })

            elif query or date_filter != "All":
                # [MODIFIED v2026.9.27] A search blind to boxes could not answer
                # "which box are the M8 screws in", which is what boxes are for.
                sql = "SELECT * FROM items WHERE type IN ('item','box')"; params = []
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
                        img, icon_spec = _item_icon_fields(r_dict, url_prefix)

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
                            "icon_spec": icon_spec,
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
                            "measurements": r_dict.get("measurements", ""),
                            # [ADDED v2026.9.27] One of five row builders.
                            **_box_fields(r_dict),
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
                        # [MODIFIED v2026.9.22] The marker also carries a DRAWN icon.
                        #
                        # A room or a shelf can be drawn by the assistant from a sentence,
                        # the same way an item can. The spec lives in the same column on
                        # the folder's marker row, so nothing new was needed to store it -
                        # only this SELECT, which was reading image_path alone and
                        # therefore hid every drawing that had been saved.
                        marker_sql = (f"SELECT image_path, icon_spec FROM items "
                                      f"WHERE type='folder_marker' AND name=? {sql_where} AND {col}=?")
                        marker_params = [f"[Folder] {f_name}"] + params + [f_name]

                        async with db.execute(marker_sql, tuple(marker_params)) as cursor:
                            row = await cursor.fetchone()

                        img = None
                        folder_spec = None
                        if row:
                            raw_path = row[0]
                            if raw_path:
                                if raw_path.startswith("ICON_LIB"):
                                    img = raw_path
                                else:
                                    img = f"{url_prefix}/{raw_path}?v={int(time.time())}"
                            folder_spec = row[1] or None

                        folders.append({"name": f_name, "img": img,
                                        "icon_spec": folder_spec})
                    
                    # [MODIFIED v2026.9.27] A box stands in the list beside the
                    # items. It is a row in a location, not a folder level - see the
                    # BOXES section for why that is the only shape that works with a
                    # two-level navigation. type ASC puts boxes above loose items.
                    sql = f"SELECT * FROM items WHERE type IN ('item','box') AND (level_{depth+1} IS NULL OR level_{depth+1} = '') {sql_where} ORDER BY type ASC, name ASC"
                    async with db.execute(sql, tuple(params)) as cursor:
                        for r_dict in await cursor.fetchall():
                            r_dict = dict(r_dict)
                            img, icon_spec = _item_icon_fields(r_dict, url_prefix)

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
                                "img": img,
                                "icon_spec": icon_spec,
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
                                "measurements": r_dict.get("measurements", ""),
                                # [ADDED v2026.9.27] One of five row builders.
                                **_box_fields(r_dict),
                            })
                else:
                    sublocations = []
                    col = f"level_{depth+1}"
                    async with db.execute(f"SELECT DISTINCT {col} FROM items WHERE {col} IS NOT NULL AND {col} != '' {sql_where} ORDER BY {col} ASC", tuple(params)) as cursor:
                        for r in await cursor.fetchall(): sublocations.append(r[0])

                    sql = f"SELECT * FROM items WHERE type IN ('item','box') {sql_where} ORDER BY type ASC, level_{depth+1} ASC, name ASC"
                    async with db.execute(sql, tuple(params)) as cursor:
                        fetched_items = []
                        for r_dict in await cursor.fetchall():
                            r_dict = dict(r_dict)
                            img, icon_spec = _item_icon_fields(r_dict, url_prefix)

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
                                "type": r_dict['type'], 
                                "qty": r_dict['quantity'], 
                                "order_qty": r_dict.get('order_qty', 1),
                                "date": r_dict['item_date'], 
                                "img": img,
                                "icon_spec": icon_spec,
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
                                "measurements": r_dict.get("measurements", ""),
                                # [ADDED v2026.9.27] One of five row builders.
                                **_box_fields(r_dict),
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
        # [ADDED v2026.10.2] Beside the categories, because the screen that
        # offers to delete one has to say how many items would be re-filed
        # before it is pressed (RULE 33).
        "category_counts": await async_category_item_counts(hass),
        "app_version": VERSION,
        "depth": len(path_parts),
        "hierarchy": hierarchy,
        "enable_ai": enable_ai,
        "catalog_map": catalog_map
    }

# A dish photo as async_store_recipe_photo names it: "rp_" plus ten hex
# characters plus one of three extensions. Nothing else is ever deleted by
# async_delete_recipe_photo, so a value that has been tampered with in the
# database cannot become a path to something else.
_RECIPE_PHOTO_NAME = re.compile(r"^rp_[0-9a-f]{10}\.(?:jpg|png|webp)$")


async def async_delete_recipe_photo(hass, stored_name):
    """Delete a dish photo from disk. Returns True when a file was removed.

    [ADDED v2026.9.20] Taking a photo off a recipe used to clear the database
    column and leave the file behind for ever. On an install where people
    photograph what they cook, that is a folder that only grows, holding
    pictures nothing refers to any more.

    THREE THINGS GUARD THIS, because it is a delete built from a stored
    string (RULE 31, fail closed):

      1. The name must match the pattern this integration writes. A value
         that does not is refused outright rather than cleaned up, so a row
         edited by hand cannot name /config/configuration.yaml.
      2. os.path.basename first, so no directory part survives at all -
         "../../secrets.yaml" becomes "secrets.yaml", which then fails (1).
      3. The joined path must still resolve inside the photo folder.

    The caller checks that no OTHER recipe still points at the file. That
    belongs with the recipes table, not here.

    Deletion happens in the executor: os.remove blocks (RULE 13), and
    _delete_files_sync is the one place this integration removes image files.
    """
    name = os.path.basename(str(stored_name or "").strip())
    if not name or not _RECIPE_PHOTO_NAME.match(name):
        _LOGGER.warning(
            "Refused to delete %r: not a name this integration writes.",
            stored_name,
        )
        return False

    cfg = hass.data.get(DOMAIN, {}).get("config", {})
    target_dir = cfg.get("img_path", hass.config.path("www", IMG_DIR))
    path = os.path.normpath(os.path.join(target_dir, name))
    if os.path.dirname(path) != os.path.normpath(target_dir):
        _LOGGER.warning("Refused to delete %r: outside the photo folder.", name)
        return False

    removed = await hass.async_add_executor_job(_delete_files_sync, [path])
    _LOGGER.info("Deleted dish photo %s (%s file removed).", name, removed)
    return removed > 0


async def async_get_item_naming(hass, item_id):
    """Name, category and sub-category for ONE item, or None.

    [ADDED v2026.9.20] The Change Icon window can ask for an icon to be
    redrawn. What it sends is an item id and a sentence the user typed; the
    NAME of the thing being drawn is read here, from the database, and is
    never taken from the panel. The description is a hint, not the subject.

    Three columns and no more. This is called to build a drawing prompt, so
    it has no business seeing a price, a barcode or a location.
    """
    if not item_id:
        return None
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(
                "SELECT name, category, sub_category FROM items WHERE id = ?",
                (item_id,),
            ) as cursor:
                row = await cursor.fetchone()
        if not row:
            return None
        return {
            "name": row[0] or "",
            "category": row[1] or "",
            "sub_category": row[2] or "",
        }
    except Exception as err:
        _LOGGER.error("Reading an item for its icon failed: %s", err)
        return None


async def async_folder_marker_id(hass, folder_name, path_parts):
    """The id of a folder's marker row, or None.

    [ADDED v2026.9.22] A room or a shelf has no id of its own - it is a
    NAME that appears in a level_N column, and its picture lives on a
    hidden 'folder_marker' row called '[Folder] <name>'. Everything that
    sets a folder icon reaches it by that name.

    The path is matched as well as the name. update_image has always
    matched on the name alone, which quietly writes to every shelf called
    'Top' in the house; this is the same lookup done properly, and it
    returns None rather than a guess when the marker is not there
    (RULE 31).
    """
    name = str(folder_name or '').strip()
    if not name:
        return None
    parts = [str(p) for p in (path_parts or []) if str(p).strip()]
    if len(parts) > 9:
        return None

    # [FIXED v2026.9.22] The path has to be the STORED one, not the one on
    # screen. A level column can hold '[ORDER_MARKER_010] Kitchen' while the
    # panel shows and sends 'Kitchen', so an exact match found nothing and
    # every location failed. Rooms worked only because they sit at depth 0
    # and had no path to mismatch. These are the same two helpers every
    # other write path runs first.
    if parts:
        parts = await async_normalize_zone_path(hass, parts)
        parts = await async_repair_path_against_db(hass, parts)
    try:
        db_path = get_db_path(hass)
        sql = ("SELECT id FROM items WHERE type='folder_marker' "
               "AND name = ?")
        args = [f"[Folder] {name}"]
        for i, part in enumerate(parts):
            sql += f" AND level_{i + 1} = ?"
            args.append(part)
        sql += " LIMIT 1"
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(sql, tuple(args)) as cursor:
                row = await cursor.fetchone()
            if row:
                return row[0]
            # Nothing at that exact path. Fall back to the name alone, which
            # is what update_image has always done - so this is no less
            # precise than the rest of the panel, and a folder whose path
            # cannot be reconstructed still gets its picture. Logged,
            # because a match found this way is a guess between namesakes.
            if parts:
                async with db.execute(
                    "SELECT id FROM items WHERE type='folder_marker' "
                    "AND name = ? LIMIT 1",
                    (f"[Folder] {name}",),
                ) as cursor:
                    row = await cursor.fetchone()
                if row:
                    _LOGGER.info(
                        "[HO-ICON] Folder %r matched by name; its path %s did not.", name, parts,
                    )
                    return row[0]
        return None
    except Exception as err:
        _LOGGER.error("Looking up a folder marker failed: %s", err)
        return None


async def async_set_item_icon(hass, item_id, icon_spec_json):
    """Store the icon spec the assistant designed for one item.

    [ADDED v2026.9.20] Writes ONE column. Passing None clears it, which is
    how an item goes back to the shipped library icon or the default.
    Nothing else on the row is touched: an icon is not a reason to rewrite a
    quantity or a location (RULE 33a.8).

    What is stored is the SPEC - shapes and numbers, already rebuilt field by
    field by ai_core.draw_spec - and never markup. The panel draws from it.
    """
    if not item_id:
        return False
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cursor = await db.execute(
                "UPDATE items SET icon_spec = ? WHERE id = ?",
                (icon_spec_json, item_id),
            )
            await db.commit()
            return cursor.rowcount > 0
    except Exception as err:
        _LOGGER.error("Storing an item icon failed: %s", err)
        return False


async def async_store_recipe_photo(hass, image_b64, mime_type="image/jpeg"):
    """Save a photo of a finished dish and return its stored path, or None.

    [ADDED v2026.9.17] The recipe emblem can be replaced with a real picture.

    Built on the same pieces as async_store_receipt_file, and for the same
    reasons: `www` is served at /local/ with NO authentication, so the name is
    ten random hex characters rather than the recipe's title. A predictable
    "shakshuka.jpg" can be guessed by anyone who can reach the instance, and
    the fact that a name carries no meaning is the point - the recipe row is
    where the meaning belongs.

    The file is written first and the row updated by the caller afterwards. A
    row pointing at a file that was never written breaks the screen every
    time; a file with no row is an orphan on disk, which is harmless.
    """
    if not image_b64:
        return None
    try:
        cfg = hass.data.get(DOMAIN, {}).get("config", {})
        target_dir = cfg.get("img_path", hass.config.path("www", IMG_DIR))

        payload = image_b64
        if isinstance(payload, str) and "base64," in payload:
            header, payload = payload.split("base64,", 1)
            if ":" in header and ";" in header:
                declared = header.split(":", 1)[1].split(";", 1)[0]
                if declared:
                    mime_type = declared
        raw = base64.b64decode(payload)

        # A dish photo is a photo. Anything else - a PDF, an SVG, an HTML file
        # renamed - is refused rather than stored and served back from a
        # folder that needs no authentication to read.
        kind = (mime_type or "").lower()
        if not any(k in kind for k in ("jpeg", "jpg", "png", "webp")):
            _LOGGER.warning("Refused a recipe photo of type %r.", mime_type)
            return None
        if len(raw) > 6_000_000:
            _LOGGER.warning("Refused a recipe photo of %d bytes.", len(raw))
            return None

        ext = ".png" if "png" in kind else (".webp" if "webp" in kind else ".jpg")
        filename = f"rp_{secrets.token_hex(5)}{ext}"
        stored = await hass.async_add_executor_job(
            _write_receipt_file_sync, target_dir, filename, raw
        )
        if not stored:
            return None
        # [FIXED v2026.9.17] Return the FILENAME, not the absolute path that
        # the writer hands back.
        #
        # Every other image in this integration is stored as a bare filename
        # and turned into a URL with url_prefix at the point it is displayed.
        # Storing the disk path here produced
        # "/local/home_organizer_images/C:\...\rp_ab12.jpg", which is a 404,
        # so the picture never loaded and the frame sat empty.
        return os.path.basename(stored)
    except Exception as err:
        _LOGGER.error("Could not store the recipe photo: %s", err)
        return None
