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
# // [v2026.9.17 | 2026-09-17] Purpose: Added async_speak_to_user, which hands
# // text to the companion app's own text-to-speech, because Android's WebView
# // has no window.speechSynthesis and the panel could not speak there at all.
# // Reminders now also speak, in addition to the written notification.
# // Same release: a reminder set from the panel reached
# // nobody's phone. A websocket connection carries no device_id, so every
# // cooking timer started on the recipe screen failed to resolve a notify
# // service and fell through to the sidebar notification alone. When there is
# // no device, delivery now resolves the mobile_app services registered to
# // the authenticated user who set the reminder. Other people's phones are
# // still never touched.
# // [v9.9.7 | 2026-04-19] Purpose: Per-device targeting. Reminders now
# // push ONLY to the notify service belonging to the requesting device
# // (mobile_app_<slug>). Removed the fan-out-to-every-notify behavior
# // that sent each reminder to every phone in the house. Persistent
# // notification in the HA sidebar remains as a visible fallback.
# //
# // WHAT THIS MODULE IS - permanent documentation, not a history entry.
# // (RULE 28 caps the history at two entries but preserves notes like this.)
# //
# // A persistent reminder scheduler that
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


def _resolve_notify_services_for_user(hass, user_id):
    """Every mobile_app notify service belonging to THIS user.

    [ADDED v2026.9.17] A reminder set from the panel has no device_id.

    websocket_ai_chat is a websocket connection, not a phone, so it forwards
    the authenticated user's id and nothing else. _resolve_notify_service_for_
    device therefore returned None for every cooking timer started from the
    recipe screen, the targeted push was skipped, and the only thing the user
    got was the persistent_notification in the sidebar - the reminder fired
    correctly and silently, which is exactly how it was reported.

    mobile_app writes the registering user's id into its config entry, so the
    phones belonging to the person who asked can be found without guessing.

    This does NOT weaken the rule the device path exists to enforce. That rule
    is "never notify somebody else's phone", and every service returned here
    belongs to the authenticated user who set the reminder. It does widen
    delivery to ALL of that one user's devices, because which of their phones
    is in the kitchen is not knowable from a browser tab.
    """
    if not user_id:
        return []
    found = []
    try:
        for entry in hass.config_entries.async_entries("mobile_app"):
            if entry.data.get("user_id") != user_id:
                continue
            raw_name = (
                entry.data.get("device_name")
                or entry.data.get("name")
                or entry.title
                or ""
            )
            slug = _slugify(raw_name)
            if not slug:
                continue
            candidate = f"mobile_app_{slug}"
            if candidate in found:
                continue
            if hass.services.has_service("notify", candidate):
                found.append(candidate)
    except Exception as e:
        _LOGGER.error(
            f"[HO-REMINDER] resolve_notify_for_user error: {e}", exc_info=True
        )
    return found


def async_speak_to_user(hass, user_id, text):
    """Say `text` out loud on the phones belonging to `user_id`.

    [ADDED v2026.9.17] The panel cannot speak on Android.

    Home Assistant's Android app runs in a WebView, and Android's WebView does
    not implement window.speechSynthesis. The panel's speak() therefore
    returned silently on the one platform people cook with, while the speaker
    button still showed as on. Rather than a second speech engine in the
    browser, the text is handed to the companion app, which has the device's
    own text-to-speech.

    Delivery reuses _resolve_notify_services_for_user, so this speaks ONLY on
    the phones registered to the user who asked, and never on anyone else's.

    The message body is the literal string "TTS": that is the companion app's
    marker telling it to speak `data.tts_text` instead of posting a
    notification. music_stream makes it audible over a phone left on vibrate,
    which is the whole point in a kitchen.

    Android only. iOS has no equivalent notification, and there it simply
    arrives as a normal notification, which is why the caller must not rely on
    this having been heard. Nothing raises if a service is missing.
    """
    if not text:
        return []
    spoken_on = []
    for svc in _resolve_notify_services_for_user(hass, user_id):
        try:
            hass.async_create_task(
                hass.services.async_call(
                    "notify",
                    svc,
                    {
                        "message": "TTS",
                        "data": {
                            "tts_text": str(text),
                            "media_stream": "music_stream",
                        },
                    },
                )
            )
            spoken_on.append(svc)
        except Exception as e:
            _LOGGER.error(f"[HO-SPEAK] notify.{svc} failed: {e}")
    if spoken_on:
        _LOGGER.info(f"[HO-SPEAK] Spoke on {', '.join(spoken_on)}")
    else:
        _LOGGER.debug(f"[HO-SPEAK] No phone to speak on for user_id={user_id!r}")
    return spoken_on


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
    _LOGGER.info("[HO-REMINDER] Event 'ho_reminder_triggered' fired on bus.")

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
        # [ADDED v2026.9.17] No device: fall back to the phones owned by the
        # user who set the reminder. This is the path every cooking timer
        # started from the recipe screen takes, because a websocket
        # connection has no device_id to offer.
        user_services = _resolve_notify_services_for_user(hass, user_id)
        for svc in user_services:
            try:
                hass.async_create_task(
                    hass.services.async_call(
                        "notify",
                        svc,
                        {"message": message, "title": "⏰ Reminder"},
                    )
                )
                delivered_via.append(f"notify.{svc}")
                _LOGGER.info(
                    f"[HO-REMINDER] Pushed to notify.{svc} "
                    f"(resolved from user_id={user_id})"
                )
            except Exception as e:
                _LOGGER.error(
                    f"[HO-REMINDER] push to notify.{svc} failed: {e}"
                )
        if not user_services:
            _LOGGER.warning(
                f"[HO-REMINDER] No mobile_app service for device_id="
                f"{device_id!r} and none registered to user_id={user_id!r}; "
                f"skipping mobile push."
            )

    # [ADDED v2026.9.17] 2b. Say it out loud.
    #
    # A cooking timer that arrives silently while both hands are covered in
    # flour has not really arrived. The written notification above still goes
    # out - this is in addition to it, never instead of it, so nothing is lost
    # on a phone that cannot speak.
    spoken_on = async_speak_to_user(hass, user_id, message)
    if spoken_on:
        delivered_via.extend(f"tts:{s}" for s in spoken_on)

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