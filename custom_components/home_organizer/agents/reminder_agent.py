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
# // [MODIFIED v10.0.4 | 2026-08-09] Purpose: Removed 'title' from TTS payload. The HA Android app drops TTS playback and defaults to standard visual notifications if extra UI parameters like title are present.
# // [MODIFIED v10.0.3 | 2026-08-09] Purpose: Fixed TTS payload structure so reminders are spoken aloud using alarm_stream_max instead of text popups.

import logging
import re
import uuid
from datetime import datetime, timedelta

from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.event import async_track_point_in_time
import homeassistant.util.dt as dt_util

from ..ai_core.router import safe_smart_router
from ..ai_core.json_utils import safe_parse_json, apply_voice_rules
from ..ai_core.localized_strings import get_strings_for_language

_LOGGER = logging.getLogger(__name__)

# ==========================================
# REGISTRY MANAGEMENT
# ==========================================
def get_active_reminders_registry(hass):
    if "ho_active_reminders" not in hass.data:
        hass.data["ho_active_reminders"] = {}
    return hass.data["ho_active_reminders"]

def register_active_reminder(hass, reminder_id, target_dt, remind_msg, unsub_func):
    registry = get_active_reminders_registry(hass)
    registry[reminder_id] = {
        "dt": target_dt,
        "msg": remind_msg,
        "unsub": unsub_func
    }

def cancel_active_reminder(hass, reminder_id):
    registry = get_active_reminders_registry(hass)
    if reminder_id in registry:
        registry[reminder_id]["unsub"]()
        del registry[reminder_id]
        return True
    return False

# ==========================================
# CALENDAR HELPER
# ==========================================
def _find_calendar_entity(hass):
    """Return the entity_id of the best available calendar, or None."""
    states = hass.states.async_all("calendar")
    if not states:
        return None
    for s in states:
        if "local" in s.entity_id.lower():
            return s.entity_id
    return states[0].entity_id

# ==========================================
# PROMPT
# ==========================================
def get_reminder_prompt(target_lang, current_time_str, history_text, active_reminders_str=""):
    return f"""You are a strict, precise Time Reminder Assistant for a Smart Home.

CURRENT DATE AND TIME:
{current_time_str}

ACTIVE REMINDERS:
{active_reminders_str}

CRITICAL INSTRUCTIONS:
1. Read the CHAT HISTORY and determine the user's intent.
2. AMBIGUITY CHECK: If the user says a time like "3" or "3:00" without specifying AM or PM, morning or afternoon, you MUST output the intent "clarify_time" and ask them to clarify in `spoken_confirmation`. Do not schedule it yet.
3. LIST REMINDERS: If the user asks to list or show reminders, output intent "list_reminders" and formulate a natural response listing the ACTIVE REMINDERS in {target_lang}.
4. DELETE REMINDER: If the user asks to delete a reminder, match it to the ACTIVE REMINDERS. Output intent "delete_reminder" and put the reminder's ID in "delete_target_id".
5. TARGET AUDIENCE (BROADCAST DETECTION): Carefully evaluate if the user wants this reminder to target everyone/all users in the house, or just themselves. If the input in {target_lang} explicitly implies broadcasting to the whole family/all members (e.g., equivalent to "everyone", "all", "כולם", "todos", "tous", "alle", etc.), you MUST set "notify_all" to true. Otherwise, set it to false.
6. SCHEDULE REMINDER: Calculate the exact future date and time. Format strictly in ISO 8601: YYYY-MM-DDTHH:MM:SS.
7. Extract the core message the user wants to be reminded about into {target_lang}.
8. Create a natural, spoken confirmation phrase in {target_lang}.
9. You MUST return ONLY a raw JSON object. NO markdown tables. NO backticks. NO conversational text outside the JSON.

OUTPUT FORMAT:
{{
  "intent": "schedule_reminder" | "clarify_time" | "list_reminders" | "delete_reminder",
  "target_timestamp": "YYYY-MM-DDTHH:MM:SS",
  "spoken_confirmation": "<Natural confirmation, list, or clarification question in {target_lang}>",
  "reminder_message": "<The actual notification text to show/speak later in {target_lang}>",
  "delete_target_id": "<ID of the reminder to delete, if applicable>",
  "notify_all": true | false
}}

CHAT HISTORY:
{history_text}

JSON ONLY:"""


# ==========================================
# NOTIFY SERVICE RESOLVER
# ==========================================
def _slugify(name):
    """Convert a human-readable device name to a mobile_app service slug."""
    if not name:
        return ""
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", " ", s)
    s = re.sub(r"[\s-]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s

def _resolve_notify_service_for_device(hass, device_id):
    """Return the notify service slug for a device_id, or None."""
    if not device_id:
        return None

    try:
        device_reg = dr.async_get(hass)
        device = device_reg.async_get(device_id)
        if not device:
            _LOGGER.warning(
                f"[HO-REMINDER] device_id={device_id} not in registry"
            )
            return None

        entries = hass.config_entries
        for entry_id in device.config_entries:
            entry = entries.async_get_entry(entry_id)
            if not entry:
                continue
            if entry.domain != "mobile_app":
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
                _LOGGER.info(
                    f"[HO-REMINDER] Resolved device_id={device_id} "
                    f"-> notify.{candidate}"
                )
                return candidate
            else:
                _LOGGER.debug(
                    f"[HO-REMINDER] notify.{candidate} not registered"
                )
    except Exception as e:
        _LOGGER.error(
            f"[HO-REMINDER] Failed to resolve notify service "
            f"for device_id={device_id}: {e}",
            exc_info=True,
        )

    return None


# ==========================================
# RUN LOOP
# ==========================================
async def run(hass, entry, messages, target_lang, existing_locs_str,
              loc_hierarchy_map, history_text, last_user_msg, recipe_name,
              is_voice, device_id, user_id, lang_code="en"):

    strings = await get_strings_for_language(hass, entry, lang_code)
    current_time = dt_util.now()
    current_time_str = current_time.strftime("%A, %Y-%B-%d %H:%M:%S %Z")

    active_registry = get_active_reminders_registry(hass)
    active_reminders_str = ""
    for rid, rdata in active_registry.items():
        dt_str = rdata["dt"].strftime("%Y-%m-%d %H:%M:%S")
        active_reminders_str += f"- ID: {rid} | Time: {dt_str} | Message: {rdata['msg']}\n"
    
    if not active_reminders_str:
        active_reminders_str = "No active reminders."

    prompt = get_reminder_prompt(target_lang, current_time_str, history_text, active_reminders_str)

    raw_res, err = await safe_smart_router(
        hass, entry, apply_voice_rules(prompt, is_voice, target_lang)
    )
    if err or not raw_res:
        return f"\u274c {strings['reminder_process_error']} ({err})"

    parsed = safe_parse_json(raw_res)
    if not parsed:
        return strings["reminder_failed"]

    intent = parsed.get("intent")
    spoken_conf = parsed.get("spoken_confirmation")

    if intent in ["clarify_time", "list_reminders"]:
        return spoken_conf

    if intent == "delete_reminder":
        target_id = parsed.get("delete_target_id")
        if target_id and cancel_active_reminder(hass, target_id):
            return spoken_conf
        else:
            return f"{spoken_conf} (\u2757 ID not found or already deleted)"

    if intent != "schedule_reminder":
        return f"\u274c {strings['reminder_unexpected_intent']}"

    target_time_str = parsed.get("target_timestamp")
    remind_msg = parsed.get("reminder_message")
    notify_all = parsed.get("notify_all", False)

    try:
        target_dt = datetime.strptime(target_time_str, "%Y-%m-%dT%H:%M:%S")
        target_dt = target_dt.replace(tzinfo=current_time.tzinfo)

        if target_dt <= current_time:
            return f"\u274c {strings['reminder_in_past']} ({target_time_str})"

        reminder_id = str(uuid.uuid4())[:8]
        notify_service = _resolve_notify_service_for_device(hass, device_id)

        cal_entity = _find_calendar_entity(hass)
        if cal_entity:
            end_dt = target_dt + timedelta(minutes=15)
            cal_title = f"⏰ {remind_msg}"
            hass.async_create_task(
                hass.services.async_call(
                    "calendar",
                    "create_event",
                    {
                        "entity_id": cal_entity,
                        "summary": cal_title,
                        "description": "HO-AI Automated Reminder",
                        "start_date_time": target_dt.strftime("%Y-%m-%d %H:%M:%S"),
                        "end_date_time": end_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    },
                    blocking=False
                )
            )

        @callback
        def trigger_reminder(now):
            _LOGGER.info(
                f"[HO-REMINDER] FIRE | msg={remind_msg!r} | "
                f"device_id={device_id} | user_id={user_id} | "
                f"notify_target={notify_service!r} | notify_all={notify_all}"
            )

            # Clean payload - exactly mirroring the legacy YAML automation structure for TTS
            tts_payload = {
                "message": "TTS", 
                "data": {
                    "tts_text": remind_msg,
                    "media_stream": "alarm_stream_max",
                    "ttl": 0,
                    "priority": "high"
                }
            }

            if notify_all:
                _LOGGER.info(f"[HO-REMINDER] Broadcasting to ALL users for message: {remind_msg!r}")
                hass.async_create_task(
                    hass.services.async_call("notify", "notify", tts_payload)
                )
            elif notify_service:
                hass.async_create_task(
                    hass.services.async_call("notify", notify_service, tts_payload)
                )
            else:
                _LOGGER.warning(
                    f"[HO-REMINDER] No mobile_app service for "
                    f"device_id={device_id!r}; reminder could not be sent."
                )
            
            cancel_active_reminder(hass, reminder_id)

        unsub = async_track_point_in_time(hass, trigger_reminder, target_dt)
        register_active_reminder(hass, reminder_id, target_dt, remind_msg, unsub)

        _LOGGER.info(
            f"[HO-REMINDER] scheduled for {target_dt.isoformat()} | ID={reminder_id} | "
            f"device_id={device_id} | notify={notify_service!r} | notify_all={notify_all}"
        )
        return spoken_conf

    except ValueError as ve:
        _LOGGER.error(f"Time parse error: {ve} for string {target_time_str}")
        return f"\u274c {strings['reminder_parse_error']}"
    except Exception as e:
        _LOGGER.error(f"Reminder error: {e}")
        return strings["reminder_failed"]