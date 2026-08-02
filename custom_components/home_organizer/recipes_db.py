# -*- coding: utf-8 -*-
# // [MODIFIED v9.10.0 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O.
# // [NEW v9.9.0 | 2026-04-18] Purpose: Dedicated SQLite store for cooking recipes.

import json
import logging
import os
import aiosqlite
import uuid

_LOGGER = logging.getLogger(__name__)

RECIPES_DB_FILE = "home_organizer_recipes.db"
TABLE_NAME = "recipes"


def _db_path(hass):
    return hass.config.path(RECIPES_DB_FILE)


async def async_init(hass):
    db_path = _db_path(hass)
    try:
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
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
            await db.execute(f"CREATE INDEX IF NOT EXISTS idx_recipes_name_lower ON {TABLE_NAME}(name_lower)")
            await db.execute(f"CREATE INDEX IF NOT EXISTS idx_recipes_lang ON {TABLE_NAME}(language)")
            await db.commit()
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] Table init failed: {e}", exc_info=True)


async def async_save(hass, name, ingredients, steps, timers,
                     language="en", tags=None, notes=None,
                     source_type="ai_generated", recipe_id=None):
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
            async with db.execute(f"SELECT id FROM {TABLE_NAME} WHERE name_lower = ? AND language = ? LIMIT 1", (name_lower, rec.get("language", "en"))) as cursor:
                row = await cursor.fetchone()

            if row:
                rid = row[0]
                await db.execute(f"""
                    UPDATE {TABLE_NAME} SET
                        name = ?, ingredients = ?, steps = ?, timers = ?, tags = ?, source_type = ?, notes = ?
                    WHERE id = ?
                    """, (
                        rec["name"],
                        json.dumps(rec.get("ingredients") or [], ensure_ascii=False),
                        json.dumps(rec.get("steps") or [], ensure_ascii=False),
                        json.dumps(rec.get("timers") or [], ensure_ascii=False),
                        json.dumps(rec.get("tags") or [], ensure_ascii=False),
                        rec.get("source_type", "ai_generated"),
                        rec.get("notes"),
                        rid
                    ))
                await db.commit()
                return rid, "updated"

            rid = rec.get("id") or uuid.uuid4().hex
            await db.execute(f"""
                INSERT INTO {TABLE_NAME}
                (id, name, name_lower, language, ingredients, steps, timers, tags, source_type, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    rid, rec["name"], name_lower, rec.get("language", "en"),
                    json.dumps(rec.get("ingredients") or [], ensure_ascii=False),
                    json.dumps(rec.get("steps") or [], ensure_ascii=False),
                    json.dumps(rec.get("timers") or [], ensure_ascii=False),
                    json.dumps(rec.get("tags") or [], ensure_ascii=False),
                    rec.get("source_type", "ai_generated"), rec.get("notes")
                ))
            await db.commit()
            return rid, "inserted"
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] upsert failed: {e}", exc_info=True)
        raise


def _row_to_dict(row):
    if not row: return None
    return {
        "id":           row[0],
        "name":         row[1],
        "name_lower":   row[2],
        "language":     row[3],
        "ingredients":  json.loads(row[4] or "[]"),
        "steps":        json.loads(row[5] or "[]"),
        "timers":       json.loads(row[6] or "[]"),
        "tags":         json.loads(row[7] or "[]"),
        "source_type":  row[8],
        "notes":        row[9],
        "created_at":   row[10],
        "last_used_at": row[11],
        "use_count":    row[12],
    }


async def async_find_by_name(hass, query, language="en", limit=3):
    if not query or not query.strip(): return []
    try:
        db_path = _db_path(hass)
        q = query.strip().lower()
        like_param = f"%{q}%"
        results = []
        
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
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
            async with db.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ? LIMIT 1", (recipe_id,)) as cursor:
                return _row_to_dict(await cursor.fetchone())
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] get_by_id failed: {e}", exc_info=True)
        return None


async def async_touch(hass, recipe_id):
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(f"UPDATE {TABLE_NAME} SET use_count = COALESCE(use_count, 0) + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?", (recipe_id,))
            await db.commit()
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] touch failed: {e}")


async def async_delete(hass, recipe_id):
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            cursor = await db.execute(f"DELETE FROM {TABLE_NAME} WHERE id = ?", (recipe_id,))
            await db.commit()
            return cursor.rowcount
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] delete failed: {e}")
        return 0


async def async_list_all(hass, language=None):
    try:
        db_path = _db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            if language:
                async with db.execute(f"SELECT * FROM {TABLE_NAME} WHERE language = ? ORDER BY last_used_at DESC, created_at DESC", (language,)) as cursor:
                    return [_row_to_dict(r) for r in await cursor.fetchall()]
            else:
                async with db.execute(f"SELECT * FROM {TABLE_NAME} ORDER BY last_used_at DESC, created_at DESC") as cursor:
                    return [_row_to_dict(r) for r in await cursor.fetchall()]
    except Exception as e:
        _LOGGER.error(f"[HO-RECIPES] list failed: {e}")
        return []