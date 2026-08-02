# -*- coding: utf-8 -*-
# // [MODIFIED v9.5.0 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O.
# // [NEW v9.4.0 | 2026-04-18] Purpose: Persistent storage layer for the
# // Reminder + Calendar agents.

import logging
import aiosqlite
import uuid

from .database import get_db_path

_LOGGER = logging.getLogger(__name__)

TABLE_NAME = "scheduled_reminders"


async def async_init_table(hass):
    """Must be called once during async_setup_entry, before the scheduler."""
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(f"""
                CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
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
            """)
            await db.execute(f"CREATE INDEX IF NOT EXISTS idx_rem_status ON {TABLE_NAME}(status)")
            await db.execute(f"CREATE INDEX IF NOT EXISTS idx_rem_target ON {TABLE_NAME}(target_timestamp)")
            await db.commit()
    except Exception as e:
        _LOGGER.error(f"Reminders table init failed: {e}", exc_info=True)


async def async_insert(hass, target_timestamp, message,
                       device_id=None, user_id=None,
                       entry_type="reminder",
                       calendar_event_id=None,
                       spoken_confirmation=None):
    """Persist a new pending reminder and return its generated id."""
    rec_id = uuid.uuid4().hex
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(
                f"""
                INSERT INTO {TABLE_NAME}
                (id, target_timestamp, message, device_id, user_id,
                 status, entry_type, calendar_event_id, spoken_confirmation)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
                """,
                (rec_id, target_timestamp, message, device_id, user_id, entry_type, calendar_event_id, spoken_confirmation),
            )
            await db.commit()
    except Exception as e:
        _LOGGER.error(f"Failed to insert reminder: {e}", exc_info=True)
        raise
    return rec_id


async def _update_status(hass, reminder_id, status):
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            if status == "fired":
                await db.execute(f"UPDATE {TABLE_NAME} SET status=?, fired_at=CURRENT_TIMESTAMP WHERE id=?", (status, reminder_id))
            else:
                await db.execute(f"UPDATE {TABLE_NAME} SET status=? WHERE id=?", (status, reminder_id))
            await db.commit()
    except Exception as e:
        _LOGGER.error(f"Failed to update reminder {reminder_id} -> {status}: {e}")


async def async_mark_fired(hass, reminder_id):
    await _update_status(hass, reminder_id, "fired")


async def async_mark_cancelled(hass, reminder_id):
    await _update_status(hass, reminder_id, "cancelled")


async def async_list_pending(hass):
    """Return every reminder with status='pending' sorted by target time."""
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            async with db.execute(f"SELECT id, target_timestamp, message, device_id, user_id, entry_type, spoken_confirmation FROM {TABLE_NAME} WHERE status='pending' ORDER BY target_timestamp ASC") as cursor:
                rows = await cursor.fetchall()
                return [
                    {
                        "id": r[0],
                        "target_timestamp": r[1],
                        "message": r[2],
                        "device_id": r[3],
                        "user_id": r[4],
                        "entry_type": r[5],
                        "spoken_confirmation": r[6],
                    }
                    for r in rows
                ]
    except Exception as e:
        _LOGGER.error(f"Failed to fetch pending reminders: {e}")
        return []


async def async_purge_old(hass, days=7):
    """Delete fired/cancelled reminders older than `days` days."""
    try:
        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            await db.execute(f"DELETE FROM {TABLE_NAME} WHERE status IN ('fired', 'cancelled') AND datetime(COALESCE(fired_at, created_at)) < datetime('now', ?)", (f"-{days} days",))
            await db.commit()
    except Exception as e:
        _LOGGER.error(f"Purge old reminders failed: {e}")