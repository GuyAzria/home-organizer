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
# // [v9.7.0 | 2026-04-18] Purpose: MULTI-INTENT calendar agent. Now handles
# // four user intents instead of only one:
# //   - schedule_event    -> add one OR more new events in a single turn
# //   - list_events       -> show events in a date range ("this week", etc.)
# //   - cancel_event      -> delete one or more events by uid
# //   - reschedule_event  -> move an event to a new start/end time
# // Before calling the LLM the agent pulls the next 60 days of events from
# // HA's calendar entity via the standard calendar.get_events service and
# // feeds them into the prompt with their uids, so the LLM can reference
# // them for list/cancel/reschedule intents. For deletion and rescheduling
# // we prefer the calendar.delete_event service when available, and fall
# // back to the EntityComponent entity-level async_delete_event method for
# // calendars like Local Calendar that support it.
# // [v9.4.0 | 2026-04-18] Purpose: Calendar agent (single-intent version).

import logging
from datetime import datetime, timedelta

import homeassistant.util.dt as dt_util

from ..ai_core.router import safe_smart_router
from ..ai_core.json_utils import safe_parse_json, apply_voice_rules
from ..ai_core.localized_strings import get_strings_for_language
from .. import reminders_store, reminders_scheduler

_LOGGER = logging.getLogger(__name__)


# ==========================================
# CALENDAR ENTITY HELPERS
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


async def _fetch_upcoming_events(hass, cal_entity, start_dt, end_dt):
    """Fetch every event on `cal_entity` between start_dt and end_dt.

    Uses the standard calendar.get_events service (HA >= 2023.6). Returns a
    list of dicts with keys like 'start', 'end', 'summary', 'description'
    and, when the underlying calendar supports it, 'uid'.
    """
    try:
        result = await hass.services.async_call(
            "calendar",
            "get_events",
            {
                "entity_id": cal_entity,
                "start_date_time": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "end_date_time": end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            },
            blocking=True,
            return_response=True,
        )
        if result and cal_entity in result:
            return result[cal_entity].get("events", []) or []
    except Exception as e:
        _LOGGER.error(f"calendar.get_events failed: {e}", exc_info=True)
    return []


async def _create_event(hass, cal_entity, title, description, start_dt, end_dt):
    """Create a new event on the given calendar entity."""
    try:
        await hass.services.async_call(
            "calendar",
            "create_event",
            {
                "entity_id": cal_entity,
                "summary": title,
                "description": description or "",
                "start_date_time": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "end_date_time": end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            },
            blocking=True,
        )
        return True
    except Exception as e:
        _LOGGER.error(f"calendar.create_event failed: {e}", exc_info=True)
        return False


async def _delete_event(hass, cal_entity, uid):
    """Delete an event. Returns True on success.

    Tries the calendar.delete_event service first (HA exposes it in newer
    versions for calendars that support deletion). Falls back to the entity
    component's async_delete_event method which is what local_calendar
    implements directly.
    """
    # Path 1: public service call
    try:
        if hass.services.has_service("calendar", "delete_event"):
            await hass.services.async_call(
                "calendar",
                "delete_event",
                {"entity_id": cal_entity, "uid": uid},
                blocking=True,
            )
            return True
    except Exception as e:
        _LOGGER.warning(
            f"calendar.delete_event service failed for uid={uid}: {e}"
        )

    # Path 2: entity-level call (Local Calendar always supports this)
    try:
        component = hass.data.get("calendar")
        if component is None:
            _LOGGER.warning("calendar EntityComponent not in hass.data.")
            return False
        entity = component.get_entity(cal_entity)
        if entity is None or not hasattr(entity, "async_delete_event"):
            _LOGGER.warning(
                f"Entity {cal_entity} does not support async_delete_event."
            )
            return False
        await entity.async_delete_event(uid)
        return True
    except Exception as e:
        _LOGGER.error(
            f"Entity-level delete failed for uid={uid}: {e}", exc_info=True
        )
        return False


# ==========================================
# FORMATTING
# ==========================================
def _format_events_for_prompt(events):
    if not events:
        return "(no upcoming events)"
    lines = []
    for ev in events:
        uid = ev.get("uid") or ev.get("recurrence_id") or ""
        start = ev.get("start") or ""
        end = ev.get("end") or ""
        summary = ev.get("summary") or ""
        lines.append(
            f"- uid={uid} | start={start} | end={end} | summary={summary}"
        )
    return "\n".join(lines)


# ==========================================
# PROMPT
# ==========================================
def get_calendar_prompt(target_lang, current_time_str, history_text,
                        events_text):
    return f"""You are a strict, precise Calendar Assistant for a Smart Home.

CURRENT DATE AND TIME:
{current_time_str}

UPCOMING EVENTS (next 60 days) -- uid | start | end | summary:
{events_text}

CRITICAL INSTRUCTIONS:
Read the CHAT HISTORY and classify the user's LATEST request into EXACTLY ONE of the four intents below. Return ONLY a single raw JSON object. NO markdown. NO backticks. NO conversational text outside the JSON.

===================================================================
INTENT 1 -- SCHEDULE one OR MORE new events
===================================================================
Use when the user wants to ADD a meeting/appointment/event to the calendar.
If the user lists several in one turn, include them all in "events".
All timestamps MUST be ISO 8601 YYYY-MM-DDTHH:MM:SS (local time, no tz suffix), computed from CURRENT DATE AND TIME. If end is not given, set end = start + 60 minutes. If the day is given without a time, default start to 09:00. Translate title into {target_lang}. "remind_before_minutes" is optional (0 if no pre-reminder).
{{
  "intent": "schedule_event",
  "events": [
    {{
      "title": "<short title in {target_lang}>",
      "description": "<optional detail, else empty string>",
      "start_timestamp": "YYYY-MM-DDTHH:MM:SS",
      "end_timestamp":   "YYYY-MM-DDTHH:MM:SS",
      "remind_before_minutes": 0
    }}
  ],
  "spoken_confirmation": "<Natural confirmation in {target_lang} covering every event scheduled>"
}}

===================================================================
INTENT 2 -- LIST events in a date range
===================================================================
Use when the user asks what's on their calendar, meetings this week, what's scheduled for Monday, events today/tomorrow, etc.
Filter the UPCOMING EVENTS above to the range the user implied and build a natural spoken response in {target_lang} that enumerates each matching event with a friendly time phrase.
If nothing matches (or the block says "(no upcoming events)"), clearly say so in {target_lang}.
{{
  "intent": "list_events",
  "spoken_response": "<Full natural response in {target_lang}>"
}}

===================================================================
INTENT 3 -- CANCEL one or more existing events
===================================================================
Use when the user asks to cancel, delete, or remove an event.
Match the user's description against UPCOMING EVENTS and return the EXACT uids to cancel.
{{
  "intent": "cancel_event",
  "event_uids": ["<uid from UPCOMING EVENTS>"],
  "spoken_confirmation": "<Natural confirmation in {target_lang} naming what was cancelled>"
}}

===================================================================
INTENT 4 -- RESCHEDULE (move) an existing event
===================================================================
Use when the user asks to move/postpone/shift an event to a different date or time.
Provide the exact uid of the event to move and the new absolute start/end timestamps.
{{
  "intent": "reschedule_event",
  "event_uid": "<uid from UPCOMING EVENTS>",
  "new_start_timestamp": "YYYY-MM-DDTHH:MM:SS",
  "new_end_timestamp":   "YYYY-MM-DDTHH:MM:SS",
  "spoken_confirmation": "<Natural confirmation in {target_lang}>"
}}

CHAT HISTORY:
{history_text}

JSON ONLY:"""


# ==========================================
# RUN LOOP
# ==========================================
async def run(hass, entry, messages, target_lang, existing_locs_str,
              loc_hierarchy_map, history_text, last_user_msg, recipe_name,
              is_voice, device_id, user_id, lang_code="en"):

    strings = await get_strings_for_language(hass, entry, lang_code)
    current_time = dt_util.now()
    current_time_str = current_time.strftime("%A, %Y-%B-%d %H:%M:%S %Z")

    cal_entity = _find_calendar_entity(hass)
    if not cal_entity:
        return (
            "❌ No calendar entity found in Home Assistant. "
            "Add a Local Calendar (Settings -> Devices & Services -> "
            "Add -> Local Calendar) and try again."
        )

    # Pull the next 60 days of events so the LLM can reason about them.
    end_dt = current_time + timedelta(days=60)
    events = await _fetch_upcoming_events(hass, cal_entity, current_time, end_dt)
    events_text = _format_events_for_prompt(events)

    prompt = get_calendar_prompt(
        target_lang, current_time_str, history_text, events_text
    )

    raw_res, err = await safe_smart_router(
        hass, entry, apply_voice_rules(prompt, is_voice, target_lang)
    )
    if err or not raw_res:
        return f"❌ Calendar error: {err or 'no response'}"

    parsed = safe_parse_json(raw_res)
    if not parsed:
        return "❌ Could not parse the calendar response."

    intent_name = parsed.get("intent")

    # ----- LIST -----
    if intent_name == "list_events":
        spoken = parsed.get("spoken_response")
        if spoken:
            return spoken
        if not events:
            return "No upcoming events."
        lines = ["Upcoming events:"]
        for ev in events:
            lines.append(f"- {ev.get('start', '')}: {ev.get('summary', '')}")
        return "\n".join(lines)

    # ----- CANCEL -----
    if intent_name == "cancel_event":
        return await _handle_cancel(hass, cal_entity, parsed, events)

    # ----- RESCHEDULE -----
    if intent_name == "reschedule_event":
        return await _handle_reschedule(
            hass, cal_entity, parsed, events, current_time
        )

    # ----- SCHEDULE (new multi-event format) -----
    if intent_name == "schedule_event":
        return await _handle_schedule_multi(
            hass, cal_entity, parsed, current_time, device_id, user_id
        )

    # ----- BACKWARD COMPAT: legacy flat schedule format -----
    if parsed.get("start_timestamp") and parsed.get("title"):
        legacy = {
            "intent": "schedule_event",
            "events": [{
                "title": parsed["title"],
                "description": parsed.get("description", ""),
                "start_timestamp": parsed["start_timestamp"],
                "end_timestamp": parsed.get("end_timestamp", ""),
                "remind_before_minutes": parsed.get("remind_before_minutes", 0),
            }],
            "spoken_confirmation": parsed.get("spoken_confirmation", ""),
        }
        return await _handle_schedule_multi(
            hass, cal_entity, legacy, current_time, device_id, user_id
        )

    return "❌ Could not understand the calendar request."


# ==========================================
# SCHEDULE HANDLER
# ==========================================
async def _handle_schedule_multi(hass, cal_entity, parsed, current_time,
                                 device_id, user_id):
    events = parsed.get("events") or []
    spoken_conf = (parsed.get("spoken_confirmation") or "").strip()

    if not events:
        return "❌ No event details to schedule."

    added = 0
    failed = 0

    for ev in events:
        title = (ev.get("title") or "Untitled event").strip()
        description = (ev.get("description") or "").strip()
        start_str = ev.get("start_timestamp")
        end_str = ev.get("end_timestamp")

        if not start_str:
            failed += 1
            continue

        try:
            start_dt = datetime.strptime(start_str, "%Y-%m-%dT%H:%M:%S") \
                               .replace(tzinfo=current_time.tzinfo)
            if end_str:
                end_dt = datetime.strptime(end_str, "%Y-%m-%dT%H:%M:%S") \
                                 .replace(tzinfo=current_time.tzinfo)
            else:
                end_dt = start_dt + timedelta(minutes=60)
            if end_dt <= start_dt:
                end_dt = start_dt + timedelta(minutes=60)
        except Exception as e:
            _LOGGER.error(f"Calendar time parse error: {e}")
            failed += 1
            continue

        ok = await _create_event(
            hass, cal_entity, title, description, start_dt, end_dt
        )
        if not ok:
            failed += 1
            continue
        added += 1

        # Optional pre-event reminder, persisted like any other reminder.
        try:
            remind_before = int(ev.get("remind_before_minutes") or 0)
        except (TypeError, ValueError):
            remind_before = 0

        if remind_before > 0:
            remind_dt = start_dt - timedelta(minutes=remind_before)
            if remind_dt > current_time:
                remind_iso = remind_dt.strftime("%Y-%m-%dT%H:%M:%S")
                reminder_msg = f"📅 {title} — in {remind_before} min"
                try:
                    rid = await reminders_store.async_insert(
                        hass,
                        target_timestamp=remind_iso,
                        message=reminder_msg,
                        device_id=device_id,
                        user_id=user_id,
                        entry_type="calendar_reminder",
                    )
                    reminders_scheduler.async_schedule(
                        hass, rid, remind_dt, reminder_msg, device_id, user_id
                    )
                except Exception as e:
                    _LOGGER.warning(f"Pre-reminder for event failed: {e}")

    if added == 0:
        return "❌ Failed to add event(s) to the calendar."

    if failed == 0:
        return spoken_conf or f"✅ {added} event(s) added."
    return (spoken_conf or f"✅ {added} event(s) added.") + f" (failed: {failed})"


# ==========================================
# CANCEL HANDLER
# ==========================================
async def _handle_cancel(hass, cal_entity, parsed, events):
    spoken_conf = (parsed.get("spoken_confirmation") or "").strip()
    raw_uids = parsed.get("event_uids") or []

    valid_uids = {ev.get("uid") for ev in events if ev.get("uid")}
    targets = [u for u in raw_uids if u in valid_uids]

    if not targets:
        return spoken_conf or "No matching events to cancel."

    deleted = 0
    for uid in targets:
        if await _delete_event(hass, cal_entity, uid):
            deleted += 1

    if deleted == 0:
        return (
            "❌ Could not delete the event(s). Your calendar integration "
            "may not support deletions."
        )

    return spoken_conf or f"✅ Cancelled {deleted} event(s)."


# ==========================================
# RESCHEDULE HANDLER
# ==========================================
async def _handle_reschedule(hass, cal_entity, parsed, events, current_time):
    uid = parsed.get("event_uid")
    new_start = parsed.get("new_start_timestamp")
    new_end = parsed.get("new_end_timestamp")
    spoken_conf = (parsed.get("spoken_confirmation") or "").strip()

    if not uid or not new_start:
        return "❌ Missing event id or new time for rescheduling."

    # Find the original event so we can preserve title and description.
    target_ev = None
    for ev in events:
        if ev.get("uid") == uid:
            target_ev = ev
            break

    if target_ev is None:
        return spoken_conf or "❌ Could not find the event to reschedule."

    try:
        new_start_dt = datetime.strptime(new_start, "%Y-%m-%dT%H:%M:%S") \
                               .replace(tzinfo=current_time.tzinfo)
        if new_end:
            new_end_dt = datetime.strptime(new_end, "%Y-%m-%dT%H:%M:%S") \
                                 .replace(tzinfo=current_time.tzinfo)
        else:
            new_end_dt = new_start_dt + timedelta(minutes=60)
        if new_end_dt <= new_start_dt:
            new_end_dt = new_start_dt + timedelta(minutes=60)
    except Exception as e:
        return f"❌ Could not parse the new time: {e}"

    title = target_ev.get("summary") or "Event"
    description = target_ev.get("description") or ""

    # Strategy: delete + recreate. This works consistently across every
    # calendar backend that supports create+delete. The native "update"
    # service is not reliably available on every integration.
    if not await _delete_event(hass, cal_entity, uid):
        return (
            "❌ Could not delete the original event. Rescheduling aborted."
        )

    if not await _create_event(
        hass, cal_entity, title, description, new_start_dt, new_end_dt
    ):
        return (
            "❌ Deleted the old event but failed to create the new one. "
            "Please add it manually."
        )

    return spoken_conf or f"✅ Rescheduled '{title}'."
