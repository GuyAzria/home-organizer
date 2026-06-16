# -*- coding: utf-8 -*-
# // [ADDED v10.0.1 | 2026-06-11] Purpose: Added high priority and ttl data fields to push notifications to bypass mobile OS battery-saving sleep modes (Doze Mode / Samsung deep sleep pooling) and prevent delayed reminders.
# // [ADDED v10.0.0 | 2026-06-11] Purpose: Multi-language broadcast support. The prompt instruction was updated to evaluate the broadcast intent ("notify_all") dynamically based on the active target UI language, catching "everyone" or "כולם". Added broadcast routing logic to trigger_reminder.
# // [v9.9.8 | 2026-05-12] Purpose: Added ambiguity resolution for AM/PM, reminder listing, and deletion capability. Uses hass.data memory registry to hold and cancel callbacks.
# // [v9.9.7 | 2026-04-19] Purpose: Personal reminders. A reminder now fires
# // ONLY on the device that set it -- if Yulia asks from her phone, only
# // her phone pings; Guy's phone stays quiet. We achieve this by resolving
# // the device_id captured at conversation time into its matching
# // mobile_app_<slug> notify service and calling JUST that service,
# // instead of the broadcast "notify.notify" that hit every phone.
# //
# // Lookup sequence:
# //   1. If device_id is set, walk the device registry to find the
# //      mobile_app config entry for it and derive its notify service
# //      slug (mobile_app_<slugified_device_name>).
# //   2. If we cannot resolve a mobile_app service for that device (e.g.
# //      the request came from a non-mobile source like a browser tab
# //      or an Assist pipeline without a registered mobile_app), we fall
# //      back to firing ONLY the "ho_reminder_triggered" event -- we do
# //      NOT broadcast to notify.notify anymore. The user can wire a
# //      listening automation if they want a fallback.
# //
# // Prompt, JSON parsing, time validation, fallback strings -- all
# // unchanged from v9.1.1.
# // [v9.1.1 | 2026-04-14] Purpose: Localized fallback strings.
# // [v9.0.0 | 2026-04-13] Purpose: Self-contained Reminder agent.

import logging
import re
import uuid
from datetime import datetime

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
# // [ADDED v9.9.8 | 2026-05-12] Purpose: Fetch the global registry of active reminders.
def get_active_reminders_registry(hass):
    if "ho_active_reminders" not in hass.data:
        hass.data["ho_active_reminders"] = {}
    return hass.data["ho_active_reminders"]

# // [ADDED v9.9.8 | 2026-05-12] Purpose: Register a new scheduled reminder so it can be listed or deleted later.
def register_active_reminder(hass, reminder_id, target_dt, remind_msg, unsub_func):
    registry = get_active_reminders_registry(hass)
    registry[reminder_id] = {
        "dt": target_dt,
        "msg": remind_msg,
        "unsub": unsub_func
    }

# // [ADDED v9.9.8 | 2026-05-12] Purpose: Unregister and cancel a scheduled reminder.
def cancel_active_reminder(hass, reminder_id):
    registry = get_active_reminders_registry(hass)
    if reminder_id in registry:
        # Call the unsub function returned by async_track_point_in_time
        registry[reminder_id]["unsub"]()
        del registry[reminder_id]
        return True
    return False

# ==========================================
# PROMPT
# ==========================================
# // [MODIFIED v10.0.0 | 2026-06-11] Purpose: Abstracted broadcast detection into a language-agnostic conceptual rule for the LLM.
# // [MODIFIED v9.9.8 | 2026-05-12] Purpose: Passed active_reminders_str to the prompt and added instructions for clarification, listing, and deleting.
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
    """Convert a human-readable device name to a mobile_app service slug.

    Mirrors the slugify logic the mobile_app integration uses when it
    registers its per-device notify service. Example:
      "Yulia's iPhone" -> "yulia_s_iphone"
    """
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
# // [MODIFIED v10.0.1 | 2026-06-11] Purpose: Integrated high priority and ttl data keys inside async_call parameters to force real-time delivery on Android/Samsung device sleep modes.
# // [MODIFIED v10.0.0 | 2026-06-11] Purpose: Extracted 'notify_all' from JSON and applied it in the notification routing.
# // [MODIFIED v9.9.8 | 2026-05-12] Purpose: Pass active reminders to the AI, and intercept new intents for clarification, listing, and deletion.
async def run(hass, entry, messages, target_lang, existing_locs_str,
              loc_hierarchy_map, history_text, last_user_msg, recipe_name,
              is_voice, device_id, user_id, lang_code="en"):

    strings = await get_strings_for_language(hass, entry, lang_code)
    current_time = dt_util.now()
    current_time_str = current_time.strftime("%A, %Y-%B-%d %H:%M:%S %Z")

    # Fetch and format active reminders for the AI context
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

    # Handle the new intents gracefully
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

        # Generate a unique short ID for this reminder
        reminder_id = str(uuid.uuid4())[:8]

        # Resolve ONCE at scheduling time so a later registry change does
        # not silently break the reminder. Captured by closure.
        notify_service = _resolve_notify_service_for_device(hass, device_id)

        @callback
        def trigger_reminder(now):
            _LOGGER.info(
                f"[HO-REMINDER] FIRE | msg={remind_msg!r} | "
                f"device_id={device_id} | user_id={user_id} | "
                f"notify_target={notify_service!r} | notify_all={notify_all}"
            )

            # 1. Fire the event regardless -- automations can listen.
            event_data = {"message": remind_msg}
            if device_id:
                event_data["device_id"] = device_id
            if user_id:
                event_data["user_id"] = user_id
            hass.bus.async_fire("ho_reminder_triggered", event_data)

            # 2. Push notification delivery with real-time FCM overrides
            if notify_all:
                _LOGGER.info(f"[HO-REMINDER] Broadcasting to ALL users for message: {remind_msg!r}")
                hass.async_create_task(
                    hass.services.async_call(
                        "notify",
                        "notify",
                        {
                            "message": remind_msg, 
                            "title": "\u23f0",
                            "data": {
                                "ttl": 0,
                                "priority": "high"
                            }
                        },
                    )
                )
            elif notify_service:
                hass.async_create_task(
                    hass.services.async_call(
                        "notify",
                        notify_service,
                        {
                            "message": remind_msg, 
                            "title": "\u23f0",
                            "data": {
                                "ttl": 0,
                                "priority": "high"
                            }
                        },
                    )
                )
            else:
                _LOGGER.warning(
                    f"[HO-REMINDER] No mobile_app service for "
                    f"device_id={device_id!r}; reminder fired via event "
                    f"only, no push sent."
                )
            
            # 3. Clean up registry once fired
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