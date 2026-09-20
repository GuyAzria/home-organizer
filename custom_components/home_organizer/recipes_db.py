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
# // [MODIFIED v2026.9.20 | 2026-09-20] Purpose: Added async_photo_in_use,
# // asked before a dish photo is deleted from disk. Photo names are ten
# // random hex characters so two recipes sharing one is not something that
# // happens by accident, but a row copied by hand would do it, and deleting
# // the file would then blank a picture on a recipe nobody touched. Fails
# // CLOSED: any error answers "in use", so an unreadable database ends with
# // an orphaned file rather than a missing one (RULE 31). Same release:
# // async_save now writes the LANGUAGE column on update. It was set only
# // on insert, so a recipe rewritten in another language kept claiming the
# // one it was first written in - and that column is what every later
# // translation decision reads.
# // [MODIFIED v2026.9.19 | 2026-09-19] Purpose: async_save now honours an
# // explicit recipe_id. It previously used the id only when inserting and
# // otherwise looked the row up by name and language, so filling in an
# // empty page the user had already created wrote a SECOND recipe under
# // the same name - or collided on the primary key. An id that names an
# // existing row updates that row; the name lookup is the fallback for
# // callers that have no id, which is how the assistant saves a recipe
# // nobody opened a page for. The UPDATE now writes name_lower alongside
# // name: a row used to be findable only BY name_lower, so the column could
# // never drift, but an update reached by id can rename the recipe, and
# // async_find_by_name matches on that column alone. async_set_emblem lost
# // its only_if_missing guard: it settled a race between several renders
# // each deciding a recipe had no emblem, and nothing draws speculatively
# // any more, so every write that reaches it is a deliberate replacement.

import json
import logging
import aiosqlite
import uuid

_LOGGER = logging.getLogger(__name__)

RECIPES_DB_FILE = "home_organizer_recipes.db"
TABLE_NAME = "recipes"
# [ADDED v2026.9.16] Chapters that exist in their own right.
#
# A recipe's category is free text on the recipe row, which means a chapter
# with nothing in it had nowhere to be stored and could not be created ahead
# of the first recipe. This table holds the chapter names themselves, so a
# chapter can exist while empty and survive a restart.
#
# It does NOT replace recipes.category, and nothing reads a category THROUGH
# it: a recipe filed under a name that is not listed here still appears under
# that name. The two are merged for display, so an older install whose
# recipes carry categories this table has never seen keeps every one of them.
CATEGORIES_TABLE = "recipe_categories"
# [ADDED v2026.9.17] Cached translations. Never the authority - the recipe
# row is - so any row here can be discarded and rebuilt.
TRANSLATIONS_TABLE = "recipe_translations"


def _db_path(hass):
    return hass.config.path(RECIPES_DB_FILE)


async def async_init(hass):
    db_path = _db_path(hass)

    try:
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row

            # [FIXED v2026.9.17] First run means the TABLE has never existed,
            # not that the file is absent.
            #
            # The file test looked equivalent and was not. Deleting the
            # database while Home Assistant is running leaves the next query
            # to recreate it - empty, with no tables at all, because only
            # setup builds the schema. The file then exists, so the next
            # restart saw "not a first install", skipped the seed, and the
            # cookbook stayed empty permanently. That is the state this was
            # reported from.
            #
            # Asking about the table instead is exact, and it still refuses
            # every case the file test was protecting (RULE 5):
            #   - every recipe deleted  -> the table is there -> no reseed
            #   - reinstalled over data -> the table is there -> no reseed
            #   - a genuinely new home  -> no table           -> seed
            async with db.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name=?", (TABLE_NAME,)
            ) as cur:
                is_first_install = (await cur.fetchone()) is None

            await db.execute(f"""
                CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
                    id              TEXT PRIMARY KEY,
                    name            TEXT NOT NULL,
                    name_lower      TEXT NOT NULL,
                    language        TEXT NOT NULL DEFAULT 'en',
                    ingredients     TEXT NOT NULL DEFAULT '[]',
                    steps           TEXT NOT NULL DEFAULT '[]',
                    timers          TEXT NOT NULL DEFAULT '[]',
                    tags            TEXT NOT NULL DEFAULT '[]',
                    source_type     TEXT NOT NULL DEFAULT 'ai_generated',
                    notes           TEXT,
                    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_used_at    TIMESTAMP,
                    use_count       INTEGER DEFAULT 0
                )
            """)
            # [ADDED v2026.10.9] Additive migration for the cookbook UI.
            #
            # Same PRAGMA + ALTER pattern used for `items`, so an install that
            # already has AI-generated recipes keeps every one of them and just
            # gains the two new columns.
            #
            # prep_time is TEXT, not INTEGER: recipes say "about 40 minutes" or
            # "overnight" far more often than they give a clean number, and
            # forcing it into an integer would throw that away.
            #
            # handwritten_notes holds a base64 PNG of the drawing layer. It is
            # deliberately separate from `notes`, which is free text the AI or
            # the user typed - merging them would mean a scribble could destroy
            # written notes and the other way round.
            async with db.execute(f"PRAGMA table_info({TABLE_NAME})") as cursor:
                existing_cols = [c[1] for c in await cursor.fetchall()]
            for col, dtype in {
                "prep_time": "TEXT",
                "handwritten_notes": "TEXT",
                # [ADDED v2026.10.18] Which shelf of the cookbook this sits on.
                # Free text rather than a foreign key: the user can invent
                # categories, and a recipe that arrives with an unknown one
                # should keep it rather than be rejected.
                "category": "TEXT",
                # [ADDED v2026.9.17] The recipe's emblem, as finished SVG.
                #
                # Stored rather than recomputed for one reason: once the
                # emblem can be RE-DESCRIBED in the chat, the drawing stops
                # being a pure function of the recipe and becomes something
                # the user chose. A choice is user data, and losing it on a
                # bad day - or on a day the model is unavailable - is exactly
                # what RULE 5 exists to prevent.
                #
                # It is written once, when a recipe has none, and after that
                # only when the user explicitly asks for a different one.
                #
                # It always holds markup THIS integration generated from a
                # vetted motif and palette. Model output is never stored here
                # (RULE 11, RULE 15): the model may choose which motif, never
                # write the drawing.
                "emblem_svg": "TEXT",
                # [ADDED v2026.9.17] A photo of the finished dish,
                # stored as a path under the images folder. When it is
                # set it is shown INSTEAD of the drawn emblem: a real
                # picture of the user's own cooking beats any drawing.
                # The drawing is kept rather than deleted, so removing
                # the photo brings it back.
                "image_path": "TEXT",
                # [ADDED v2026.9.17] Stop translating this recipe.
                #
                # Set the moment the user edits any field by hand. From then
                # on what is stored is what they wrote, and no automatic
                # translation may replace it - an edit is a statement about
                # the text, and a machine rewriting it afterwards would throw
                # that statement away.
                "translate_lock": "INTEGER DEFAULT 0",
            }.items():
                if col not in existing_cols:
                    try:
                        await db.execute(
                            f"ALTER TABLE {TABLE_NAME} ADD COLUMN {col} {dtype}"
                        )
                    except Exception:
                        pass

            # [ADDED v2026.9.16] Chapters that hold no recipe yet.
            #
            # IF NOT EXISTS, and nothing is ever seeded into it, so this is
            # safe on a fresh install, on an upgrade where it is absent, on an
            # upgrade where it already exists, and on every restart after.
            # Existing recipes and their categories are untouched either way.
            #
            # name_lower is the key rather than name, so "Soups" and "soups"
            # cannot both be created, while the capitalisation the user typed
            # is what gets shown back to them.
            await db.execute(f"""
                CREATE TABLE IF NOT EXISTS {CATEGORIES_TABLE} (
                    name_lower  TEXT PRIMARY KEY,
                    name        TEXT NOT NULL,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # [ADDED v2026.9.17] Translations, cached per recipe per language.
            #
            # A separate table rather than more columns, because the number of
            # languages is not fixed and a recipe may exist in none, one or
            # several. The ORIGINAL row is never touched: a translation is a
            # view of it, so it can be thrown away and rebuilt without any
            # risk to what the user actually wrote.
            #
            # ON DELETE CASCADE is not used - this file has no foreign keys
            # anywhere - so async_delete clears these rows itself.
            await db.execute(f"""
                CREATE TABLE IF NOT EXISTS {TRANSLATIONS_TABLE} (
                    recipe_id   TEXT NOT NULL,
                    language    TEXT NOT NULL,
                    name        TEXT,
                    ingredients TEXT,
                    steps       TEXT,
                    prep_time   TEXT,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (recipe_id, language)
                )
            """)

            await db.execute(f"CREATE INDEX IF NOT EXISTS idx_recipes_name_lower ON {TABLE_NAME}(name_lower)")
            await db.execute(f"CREATE INDEX IF NOT EXISTS idx_recipes_lang ON {TABLE_NAME}(language)")

            # [ADDED v2026.9.17] A cookbook that is not empty on day one.
            #
            # Guarded twice: is_first_install says the file did not exist a
            # moment ago, and the count says nothing has been written since.
            # Any existing installation fails the first test.
            if is_first_install:
                try:
                    async with db.execute(
                        f"SELECT COUNT(*) FROM {TABLE_NAME}"
                    ) as cur:
                        already_have = (await cur.fetchone())[0]
                    if not already_have:
                        from .recipe_seed import (
                            DEFAULT_RECIPES, SEED_CATEGORIES,
                        )
                        for name, category, prep, ingredients, steps in DEFAULT_RECIPES:
                            await db.execute(
                                f"INSERT INTO {TABLE_NAME} "
                                f"(id, name, name_lower, language, ingredients, "
                                f"steps, timers, tags, source_type, prep_time, "
                                f"category) "
                                f"VALUES (?, ?, ?, 'en', ?, ?, '[]', '[]', "
                                f"'seed', ?, ?)",
                                (
                                    uuid.uuid4().hex,
                                    name,
                                    name.strip().lower(),
                                    json.dumps(
                                        [{"name": n, "qty": q}
                                         for n, q in ingredients],
                                        ensure_ascii=False,
                                    ),
                                    json.dumps(steps, ensure_ascii=False),
                                    prep,
                                    category,
                                ),
                            )
                        # The chapters themselves, so they are listed even
                        # after every recipe in one has been deleted.
                        for chapter in SEED_CATEGORIES:
                            await db.execute(
                                f"INSERT OR IGNORE INTO {CATEGORIES_TABLE} "
                                f"(name_lower, name) VALUES (?, ?)",
                                (chapter.lower(), chapter),
                            )
                        _LOGGER.info(
                            "First run: seeded %s recipes across %s chapters.",
                            len(DEFAULT_RECIPES), len(SEED_CATEGORIES),
                        )
                except Exception as seed_err:
                    # An empty cookbook is a cosmetic loss, never a reason to
                    # fail setup.
                    _LOGGER.error("Recipe seeding failed: %s", seed_err)

            await db.commit()
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] Table init failed: {e}", exc_info=True)


async def async_save(hass, name, ingredients, steps, timers,
                     language="en", tags=None, notes=None,
                     source_type="ai_generated", recipe_id=None,
                     prep_time=None, handwritten_notes=None, category=None):
    """Upsert a recipe by name+language.

    [MODIFIED v2026.10.9] prep_time and handwritten_notes were added at the end
    of the signature with None defaults, so the voice-assistant save path that
    already calls this keeps working untouched.

    Both are treated as "leave alone when not supplied" rather than "clear".
    That matters for handwritten_notes above all: the AI re-saving a recipe it
    generated must never wipe a drawing the user made on top of it, and the AI
    never passes that argument.
    """
    rec = {
        "id": recipe_id,
        "name": name.strip(),
        "language": language,
        "ingredients": ingredients or [],
        "steps": steps or [],
        "timers": timers or [],
        "tags": tags or [],
        "notes": notes,
        "source_type": source_type,
    }
    name_lower = rec["name"].strip().lower()
    db_path = _db_path(hass)
    
    try:
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            # [FIXED v2026.9.19] An explicit id wins over the name.
            #
            # This looked the row up by name and language only, and used
            # recipe_id nowhere except as the key for a fresh INSERT. Saving
            # INTO a recipe the user already has open therefore did the wrong
            # thing twice: a generated title that differed at all from the one
            # on the page created a SECOND recipe, and a title that matched
            # some other recipe overwrote THAT one instead. Worse, an INSERT
            # carrying an id that already existed failed on the primary key.
            #
            # When the caller names a row, that row is the one written. The
            # name lookup stays as the fallback, which is what the voice path
            # relies on to update a recipe it has no id for.
            row = None
            if recipe_id:
                async with db.execute(
                    f"SELECT id FROM {TABLE_NAME} WHERE id = ? LIMIT 1",
                    (recipe_id,),
                ) as cursor:
                    row = await cursor.fetchone()
            if row is None:
                async with db.execute(f"SELECT id FROM {TABLE_NAME} WHERE name_lower = ? AND language = ? LIMIT 1", (name_lower, rec.get("language", "en"))) as cursor:
                    row = await cursor.fetchone()

            if row:
                rid = row[0]
                # Only the columns we were actually given are written. An
                # omitted prep_time or handwritten_notes is preserved, so an
                # AI re-save cannot erase the user's drawing.
                # name_lower travels with name. Until this function could be
                # reached by id, a row was only ever FOUND by name_lower, so
                # the name written always matched it and the column could not
                # drift. An update found by id can rename the recipe, and a
                # stale name_lower is not cosmetic: async_find_by_name matches
                # on that column alone, so a renamed recipe would answer to
                # its old title by voice and to nothing under its new one -
                # and the next save without an id would file a duplicate.
                # [ADDED v2026.9.20] language travels with the text.
                #
                # This column was written on INSERT and never on UPDATE, so a
                # recipe rewritten in another language kept claiming the one
                # it was first written in - and that column is what every
                # later translation decision reads, so a Hebrew recipe marked
                # "en" would be offered for translation into Hebrew.
                #
                # Safe to write unconditionally: every one of the eight
                # callers passes language explicitly, so this can never
                # silently stamp the default over a real value.
                sets = [
                    "name = ?", "name_lower = ?", "language = ?",
                    "ingredients = ?", "steps = ?",
                    "timers = ?", "tags = ?", "source_type = ?", "notes = ?",
                ]
                vals = [
                    rec["name"],
                    name_lower,
                    rec.get("language", "en"),
                    json.dumps(rec.get("ingredients") or [], ensure_ascii=False),
                    json.dumps(rec.get("steps") or [], ensure_ascii=False),
                    json.dumps(rec.get("timers") or [], ensure_ascii=False),
                    json.dumps(rec.get("tags") or [], ensure_ascii=False),
                    rec.get("source_type", "ai_generated"),
                    rec.get("notes"),
                ]
                if prep_time is not None:
                    sets.append("prep_time = ?")
                    vals.append(prep_time)
                if handwritten_notes is not None:
                    sets.append("handwritten_notes = ?")
                    vals.append(handwritten_notes)
                if category is not None:
                    sets.append("category = ?")
                    vals.append(category)
                vals.append(rid)
                await db.execute(
                    f"UPDATE {TABLE_NAME} SET {', '.join(sets)} WHERE id = ?",
                    tuple(vals),
                )
                await db.commit()
                return rid, "updated"

            rid = rec.get("id") or uuid.uuid4().hex
            await db.execute(f"""
                INSERT INTO {TABLE_NAME}
                (id, name, name_lower, language, ingredients, steps, timers, tags,
                 source_type, notes, prep_time, handwritten_notes, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    rid, rec["name"], name_lower, rec.get("language", "en"),
                    json.dumps(rec.get("ingredients") or [], ensure_ascii=False),
                    json.dumps(rec.get("steps") or [], ensure_ascii=False),
                    json.dumps(rec.get("timers") or [], ensure_ascii=False),
                    json.dumps(rec.get("tags") or [], ensure_ascii=False),
                    rec.get("source_type", "ai_generated"), rec.get("notes"),
                    prep_time, handwritten_notes, category
                ))
            await db.commit()
            return rid, "inserted"
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] upsert failed: {e}", exc_info=True)
        raise


def _row_to_dict(row):
    """Turn a recipes row into a plain dict.

    [MODIFIED v2026.10.9] Reads columns by NAME instead of by position.

    Every query here is SELECT *, and the old version indexed row[0] through
    row[12]. That works right up until a column is added - the two new ones
    land at positions 13 and 14 and would have been silently invisible, and
    anyone inserting a column in the middle rather than at the end would have
    shifted every field by one and corrupted the output with no error at all.

    Requires aiosqlite.Row as the row factory, which the callers now set.
    """
    if not row:
        return None

    def get(key, default=None):
        try:
            value = row[key]
        except (IndexError, KeyError):
            return default
        return default if value is None else value

    def get_json(key):
        raw = get(key, "[]")
        try:
            return json.loads(raw or "[]")
        except (ValueError, TypeError):
            # A malformed blob should not take down the whole cookbook view.
            _LOGGER.warning("[HO-RECIPES] Bad JSON in column '%s'", key)
            return []

    return {
        "id":                get("id"),
        "name":              get("name"),
        "name_lower":        get("name_lower"),
        "language":          get("language", "en"),
        "ingredients":       get_json("ingredients"),
        "steps":             get_json("steps"),
        "timers":            get_json("timers"),
        "tags":              get_json("tags"),
        "source_type":       get("source_type", "ai_generated"),
        "notes":             get("notes"),
        "created_at":        get("created_at"),
        "last_used_at":      get("last_used_at"),
        "use_count":         get("use_count", 0),
        # [ADDED v2026.10.9] Cookbook UI fields.
        "prep_time":         get("prep_time"),
        "handwritten_notes": get("handwritten_notes"),
        "category":          get("category"),
        # [ADDED v2026.9.17] Read by NAME like everything else here, so the
        # column's position can never matter (RULE 33a.3).
        "emblem_svg":        get("emblem_svg"),
        "image_path":        get("image_path"),
        "translate_lock":    int(get("translate_lock", 0) or 0),
    }


async def async_find_by_name(hass, query, language="en", limit=3):
    if not query or not query.strip(): return []
    try:
        db_path = _db_path(hass)
        q = query.strip().lower()
        like_param = f"%{q}%"
        results = []
        
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(f"SELECT * FROM {TABLE_NAME} WHERE name_lower = ? AND language = ? LIMIT 1", (q, language)) as cursor:
                exact = await cursor.fetchone()
            if exact:
                results.append(_row_to_dict(exact))

            async with db.execute(f"SELECT * FROM {TABLE_NAME} WHERE name_lower LIKE ? AND language = ? AND name_lower != ? ORDER BY use_count DESC, last_used_at DESC LIMIT ?", (f"{q}%", language, q, limit)) as cursor:
                for row in await cursor.fetchall():
                    results.append(_row_to_dict(row))

            if len(results) < limit:
                remaining = limit - len(results)
                already_ids = {r["id"] for r in results}
                async with db.execute(f"SELECT * FROM {TABLE_NAME} WHERE name_lower LIKE ? AND language = ? ORDER BY use_count DESC, last_used_at DESC LIMIT ?", (like_param, language, remaining + len(already_ids))) as cursor:
                    for row in await cursor.fetchall():
                        d = _row_to_dict(row)
                        if d["id"] not in already_ids:
                            results.append(d)
                            if len(results) >= limit:
                                break
        return results[:limit]
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] find failed: {e}", exc_info=True)
        return []


async def async_get_by_id(hass, recipe_id):
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ? LIMIT 1", (recipe_id,)) as cursor:
                return _row_to_dict(await cursor.fetchone())
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] get_by_id failed: {e}", exc_info=True)
        return None


async def async_touch(hass, recipe_id):
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            await db.execute(f"UPDATE {TABLE_NAME} SET use_count = COALESCE(use_count, 0) + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?", (recipe_id,))
            await db.commit()
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] touch failed: {e}")


async def async_delete(hass, recipe_id):
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(f"DELETE FROM {TABLE_NAME} WHERE id = ?", (recipe_id,))
            # [ADDED v2026.9.17] The cached translations go with it. There are
            # no foreign keys in this file, so nothing else would ever clear
            # them and they would sit there describing a recipe that is gone.
            await db.execute(
                f"DELETE FROM {TRANSLATIONS_TABLE} WHERE recipe_id = ?",
                (recipe_id,),
            )
            await db.commit()
            return cursor.rowcount
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] delete failed: {e}")
        return 0


async def async_list_all(hass, language=None):
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            if language:
                async with db.execute(f"SELECT * FROM {TABLE_NAME} WHERE language = ? ORDER BY last_used_at DESC, created_at DESC", (language,)) as cursor:
                    return [_row_to_dict(r) for r in await cursor.fetchall()]
            else:
                async with db.execute(f"SELECT * FROM {TABLE_NAME} ORDER BY last_used_at DESC, created_at DESC") as cursor:
                    return [_row_to_dict(r) for r in await cursor.fetchall()]
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] list failed: {e}")
        return []

# ==========================================================================
# [ADDED v2026.9.16] Chapters that exist without a recipe in them.
# ==========================================================================

async def async_list_categories(hass):
    """Every chapter name the user has created, oldest first.

    Returns only what is in the table. The caller merges these with the
    categories actually carried by recipes, so a chapter created here and a
    chapter that only exists because a recipe names it both show up, and an
    install that predates this table loses nothing.
    """
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                f"SELECT name FROM {CATEGORIES_TABLE} ORDER BY created_at ASC, name ASC"
            ) as cursor:
                return [r["name"] for r in await cursor.fetchall()]
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] category list failed: {e}")
        return []


async def async_add_category(hass, name):
    """Register a chapter. Idempotent.

    INSERT OR IGNORE on the lower-cased key, so pressing the button twice, or
    naming a chapter that recipes already use, adds nothing and destroys
    nothing. Categories are never removed from here automatically: an empty
    chapter is a thing the user deliberately made, not litter to collect.
    """
    clean = str(name or "").strip()
    if not clean:
        return False
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                f"INSERT OR IGNORE INTO {CATEGORIES_TABLE} (name_lower, name) "
                f"VALUES (?, ?)",
                (clean.lower(), clean),
            )
            await db.commit()
        return True
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] category add failed: {e}")
        return False


async def async_set_emblem(hass, recipe_id, svg):
    """Store a recipe's emblem.

    [ADDED v2026.9.17] Writes ONE column and nothing else, so it cannot
    disturb ingredients, steps, notes or a drawing (RULE 33a.8).

    [MODIFIED v2026.9.19] The only_if_missing guard is gone with the reason
    for it. It settled a race between several renders each deciding a recipe
    had no emblem and each writing one; nothing draws speculatively any more,
    so every write that reaches here is a deliberate replacement.

    Returns True when a row was written.
    """
    if not recipe_id or not svg:
        return False
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cursor = await db.execute(
                f"UPDATE {TABLE_NAME} SET emblem_svg = ? WHERE id = ?",
                (svg, recipe_id),
            )
            await db.commit()
            return cursor.rowcount > 0
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] emblem write failed: {e}")
        return False


async def async_set_photo(hass, recipe_id, image_path):
    """Attach or remove a recipe's dish photo. Writes ONE column.

    [ADDED v2026.9.17] Passing None clears it, which is how the user takes a
    photo off again - the drawn emblem is untouched underneath and simply
    becomes visible once more.
    """
    if not recipe_id:
        return False
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cursor = await db.execute(
                f"UPDATE {TABLE_NAME} SET image_path = ? WHERE id = ?",
                (image_path, recipe_id),
            )
            await db.commit()
            return cursor.rowcount > 0
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] photo write failed: {e}")
        return False


async def async_photo_in_use(hass, image_path, exclude_id=None):
    """Does any OTHER recipe still point at this photo file?

    [ADDED v2026.9.20] Asked before the file is deleted from disk. Photo
    names are ten random hex characters, so two recipes sharing one is not
    something that happens by accident - but a row copied by hand, or a
    future duplicate-recipe feature, would do it, and deleting the file would
    then blank a picture on a recipe nobody touched.

    Fails CLOSED: any error answers "yes, in use", so an unreadable database
    ends with an orphaned file rather than a missing one (RULE 31).
    """
    if not image_path:
        return False
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(
                f"SELECT COUNT(*) FROM {TABLE_NAME} "
                f"WHERE image_path = ? AND id IS NOT ?",
                (image_path, exclude_id),
            ) as cursor:
                row = await cursor.fetchone()
                return bool(row and row[0])
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] photo use check failed: {e}")
        return True


async def async_rename_category(hass, old_value, new_name):
    """Rename a chapter, moving every recipe on it.

    [ADDED v2026.9.17] Two writes that must agree: the chapter's own row and
    the category column of every recipe filed under it. Done in one
    transaction so a chapter can never end up renamed with its recipes left
    pointing at a shelf that no longer exists.

    The new value is always free text. A built-in chapter renamed by the user
    stops being a built-in chapter - that is what renaming it means - and it
    is from then on shown exactly as they typed it, in every language.
    """
    old_value = str(old_value or "").strip()
    new_name = str(new_name or "").strip()
    if not new_name or old_value == new_name:
        return False
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                f"UPDATE {TABLE_NAME} SET category = ? WHERE category = ?",
                (new_name, old_value),
            )
            await db.execute(
                f"DELETE FROM {CATEGORIES_TABLE} WHERE name_lower = ?",
                (old_value.lower(),),
            )
            await db.execute(
                f"INSERT OR IGNORE INTO {CATEGORIES_TABLE} "
                f"(name_lower, name) VALUES (?, ?)",
                (new_name.lower(), new_name),
            )
            await db.commit()
        return True
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] category rename failed: {e}")
        return False


async def async_delete_category(hass, value):
    """Remove a chapter. The recipes on it are kept.

    [ADDED v2026.9.17] Deleting a shelf must never delete what was on it
    (RULE 5). Every recipe filed here has its category cleared, which moves
    it to "Other" - visible, findable, and one press away from being filed
    again. Losing a chapter name is recoverable; losing a recipe is not.

    Returns how many recipes were moved, so the caller can say so.
    """
    value = str(value or "").strip()
    if not value:
        return 0
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cursor = await db.execute(
                f"UPDATE {TABLE_NAME} SET category = '' WHERE category = ?",
                (value,),
            )
            moved = cursor.rowcount
            await db.execute(
                f"DELETE FROM {CATEGORIES_TABLE} WHERE name_lower = ?",
                (value.lower(),),
            )
            await db.commit()
        return moved
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] category delete failed: {e}")
        return 0


async def async_get_translation(hass, recipe_id, language):
    """A cached translation of one recipe, or None."""
    if not recipe_id or not language:
        return None
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                f"SELECT name, ingredients, steps, prep_time "
                f"FROM {TRANSLATIONS_TABLE} "
                f"WHERE recipe_id = ? AND language = ?",
                (recipe_id, language),
            ) as cursor:
                row = await cursor.fetchone()
        if not row:
            return None
        return {
            "name": row["name"],
            "ingredients": json.loads(row["ingredients"] or "[]"),
            "steps": json.loads(row["steps"] or "[]"),
            "prep_time": row["prep_time"],
            "translated": True,
        }
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] translation read failed: {e}")
        return None


async def async_put_translation(hass, recipe_id, language, payload):
    """Cache one translation. Replaces any earlier one for that language."""
    if not recipe_id or not language or not payload:
        return False
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                f"INSERT OR REPLACE INTO {TRANSLATIONS_TABLE} "
                f"(recipe_id, language, name, ingredients, steps, prep_time) "
                f"VALUES (?, ?, ?, ?, ?, ?)",
                (
                    recipe_id, language,
                    payload.get("name"),
                    json.dumps(payload.get("ingredients") or [], ensure_ascii=False),
                    json.dumps(payload.get("steps") or [], ensure_ascii=False),
                    payload.get("prep_time"),
                ),
            )
            await db.commit()
        return True
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] translation write failed: {e}")
        return False


async def async_lock_translation(hass, recipe_id):
    """Mark a recipe as hand-edited, which stops all automatic translation.

    [ADDED v2026.9.17] Called whenever the user changes a recipe themselves.
    Every cached translation is dropped at the same time: they describe text
    that no longer exists, and showing a stale translation of an edited
    recipe is worse than showing the recipe.
    """
    if not recipe_id:
        return False
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                f"UPDATE {TABLE_NAME} SET translate_lock = 1 WHERE id = ?",
                (recipe_id,),
            )
            await db.execute(
                f"DELETE FROM {TRANSLATIONS_TABLE} WHERE recipe_id = ?",
                (recipe_id,),
            )
            await db.commit()
        return True
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] translation lock failed: {e}")
        return False
