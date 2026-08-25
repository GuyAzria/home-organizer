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
# // [v9.9.7 | 2026-04-19] Purpose: Per-device targeting. Reminders now
# // push ONLY to the notify service belonging to the requesting device
# // (mobile_app_<slug>). Removed the fan-out-to-every-notify behavior
# // that sent each reminder to every phone in the house. Persistent
# // notification in the HA sidebar remains as a visible fallback.
# // [v9.4.0 | 2026-04-18] Persistent reminder scheduler that
# // survives HA restarts and power failures. On boot it reads every pending
# // row from reminders_store, fires any that are already overdue with a
# // "(Missed)" prefix, and re-registers every future one with HA's
# // async_track_point_in_time. Every fire updates the DB row to 'fired' so
# // the same reminder cannot fire twice.
# //
# // Exposes:
# //   - async_schedule(hass, reminder_id, target_dt, message, device_id, user_id)
# //   - async_cancel(hass, reminder_id)
# //   - async_restore_all(hass)
# //   - async_register_startup_restore(hass)
# //
# // Thread-safety: _ACTIVE_JOBS is touched only from the HA event loop,
# // which is single-threaded, so a plain dict is safe.

import logging
import re
from datetime import datetime

from homeassistant.core import callback
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.event import async_track_point_in_time
import homeassistant.util.dt as dt_util

from .reminders_store import (
    async_init_table,
    async_list_pending,
    async_mark_fired,
    async_mark_cancelled,
    async_purge_old,
)

_LOGGER = logging.getLogger(__name__)

# Map of reminder_id -> cancellation callable returned by
# async_track_point_in_time. Lets us cancel a scheduled job on demand
# (e.g. when the user says "cancel the cake reminder").
_ACTIVE_JOBS = {}


# ==========================================
# HELPERS
# ==========================================
def _parse_iso(ts, tz):
    """Parse the ISO timestamps we write to the DB into a tz-aware datetime."""
    if not ts:
        return None
    try:
        return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=tz)
    except Exception:
        try:
            dt = datetime.fromisoformat(ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            return dt
        except Exception:
            return None


def _slugify(name):
    """Mirror mobile_app's slugify logic for per-device notify service
    names. Example: "Yulia's iPhone" -> "yulia_s_iphone"."""
    if not name:
        return ""
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", " ", s)
    s = re.sub(r"[\s-]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def _resolve_notify_service_for_device(hass, device_id):
    """Return 'mobile_app_<slug>' for a device_id, or None.

    Walks the device registry and every config entry owning the device.
    If one of them is the mobile_app integration we derive and verify
    the per-device notify service name before returning.
    """
    if not device_id:
        return None
    try:
        device_reg = dr.async_get(hass)
        device = device_reg.async_get(device_id)
        if not device:
            return None
        entries = hass.config_entries
        for entry_id in device.config_entries:
            entry = entries.async_get_entry(entry_id)
            if not entry or entry.domain != "mobile_app":
                continue
            raw_name = (
                entry.data.get("device_name")
                or entry.data.get("name")
                or device.name
                or entry.title
                or ""
            )
            slug = _slugify(raw_name)
            if not slug:
                continue
            candidate = f"mobile_app_{slug}"
            if hass.services.has_service("notify", candidate):
                return candidate
    except Exception as e:
        _LOGGER.error(
            f"[HO-REMINDER] resolve_notify_service error: {e}",
            exc_info=True,
        )
    return None


@callback
def _fire_reminder(hass, reminder_id, message, device_id, user_id):
    """Push the event + the targeted mobile notification, then mark fired.

    We ONLY push to the notify service that belongs to the requesting
    device. If it cannot be resolved (the device has no mobile_app, or
    the request originated from the web UI) we fall back to a
    persistent_notification that is visible in the HA sidebar -- but we
    NEVER fan out to other phones.
    """
    _LOGGER.info(
        f"[HO-REMINDER] FIRE triggered | id={reminder_id} | msg={message!r} | "
        f"device_id={device_id} | user_id={user_id}"
    )

    event_data = {"message": message, "reminder_id": reminder_id}
    if device_id:
        event_data["device_id"] = device_id
    if user_id:
        event_data["user_id"] = user_id

    # 1. Fire the event so any user automation can react.
    hass.bus.async_fire("ho_reminder_triggered", event_data)
    _LOGGER.info(f"[HO-REMINDER] Event 'ho_reminder_triggered' fired on bus.")

    delivered_via = []

    # 2. Targeted mobile push -- ONLY the device that set the reminder.
    notify_service = _resolve_notify_service_for_device(hass, device_id)
    if notify_service:
        try:
            hass.async_create_task(
                hass.services.async_call(
                    "notify",
                    notify_service,
                    {"message": message, "title": "\u23f0 Reminder"},
                )
            )
            delivered_via.append(f"notify.{notify_service}")
            _LOGGER.info(
                f"[HO-REMINDER] Pushed to notify.{notify_service} "
                f"(device_id={device_id})"
            )
        except Exception as e:
            _LOGGER.error(
                f"[HO-REMINDER] push to notify.{notify_service} failed: {e}"
            )
    else:
        _LOGGER.warning(
            f"[HO-REMINDER] No mobile_app service for device_id="
            f"{device_id!r}; skipping mobile push."
        )

    # 3. Always create a persistent_notification as a visible safety net
    #    in the HA sidebar. Cheap, reliable, never raises.
    try:
        hass.async_create_task(
            hass.services.async_call(
                "persistent_notification",
                "create",
                {
                    "message": message,
                    "title": "\u23f0 Home Organizer Reminder",
                    "notification_id": f"ho_reminder_{reminder_id}",
                },
            )
        )
        delivered_via.append("persistent_notification")
    except Exception as e:
        _LOGGER.error(f"[HO-REMINDER] persistent_notification failed: {e}")

    _LOGGER.info(
        f"[HO-REMINDER] Dispatch complete | id={reminder_id} | "
        f"delivered_via={delivered_via}"
    )

    # 4. Mark done so restore-on-boot will not fire it again
    hass.async_create_task(async_mark_fired(hass, reminder_id))

    _ACTIVE_JOBS.pop(reminder_id, None)


# ==========================================
# PUBLIC API
# ==========================================
def async_schedule(hass, reminder_id, target_dt, message,
                   device_id=None, user_id=None):
    """Register a point-in-time HA callback for the given persisted reminder."""
    # Cancel any previous job with the same id to avoid duplicates after a reload
    prev = _ACTIVE_JOBS.pop(reminder_id, None)
    if prev:
        try:
            prev()
        except Exception:
            pass

    @callback
    def _trigger(now):
        _LOGGER.info(
            f"[HO-REMINDER] Point-in-time callback invoked | id={reminder_id} | "
            f"scheduled_for={target_dt.isoformat()} | actual_now={now.isoformat()}"
        )
        _fire_reminder(hass, reminder_id, message, device_id, user_id)

    unsub = async_track_point_in_time(hass, _trigger, target_dt)
    _ACTIVE_JOBS[reminder_id] = unsub
    _LOGGER.info(
        f"[HO-REMINDER] async_track_point_in_time registered | id={reminder_id} | "
        f"target={target_dt.isoformat()} | active_jobs_count={len(_ACTIVE_JOBS)}"
    )
    return unsub


def async_cancel(hass, reminder_id):
    """Cancel an active reminder and mark the DB row cancelled."""
    unsub = _ACTIVE_JOBS.pop(reminder_id, None)
    if unsub:
        try:
            unsub()
        except Exception:
            pass
    hass.async_create_task(async_mark_cancelled(hass, reminder_id))


async def async_restore_all(hass):
    """Read every pending reminder from disk and bring them back to life.

    Past-due reminders fire immediately with a "(Missed)" prefix so the user
    knows the reminder happened while the server was offline. Future
    reminders are re-registered via async_track_point_in_time exactly as
    they were originally.
    """
    await async_init_table(hass)
    await async_purge_old(hass, days=7)

    pending = await async_list_pending(hass)
    now = dt_util.now()
    tz = now.tzinfo

    restored = 0
    fired_late = 0

    for rec in pending:
        rid = rec["id"]
        target_dt = _parse_iso(rec["target_timestamp"], tz)

        if target_dt is None:
            _LOGGER.warning(
                f"Cannot parse target_timestamp for reminder {rid}, "
                f"value={rec['target_timestamp']!r}. Marking fired to avoid loop."
            )
            await async_mark_fired(hass, rid)
            continue

        if target_dt <= now:
            late_msg = f"⏰ (Missed) {rec['message']}"
            _fire_reminder(
                hass, rid, late_msg,
                rec.get("device_id"), rec.get("user_id"),
            )
            fired_late += 1
        else:
            async_schedule(
                hass, rid, target_dt, rec["message"],
                rec.get("device_id"), rec.get("user_id"),
            )
            restored += 1

    _LOGGER.info(
        f"HO-AI Reminder Scheduler: restored {restored} future reminders, "
        f"fired {fired_late} missed reminders."
    )


def async_register_startup_restore(hass):
    """Hook the restore routine into HA's startup sequence.

    We wait for EVENT_HOMEASSISTANT_STARTED so the notify integration and
    every other dependency is fully loaded before we start firing missed
    reminders. If the integration is reloaded while HA is already running
    we run the restore inline instead.
    """
    @callback
    def _on_started(_event):
        hass.async_create_task(async_restore_all(hass))

    if hass.is_running:
        hass.async_create_task(async_restore_all(hass))
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _on_started)