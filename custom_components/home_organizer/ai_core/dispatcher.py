# -*- coding: utf-8 -*-
# // [MODIFIED v9.8.1 | 2026-05-14] Purpose: Offloaded dynamic agent module imports to a background thread using hass.async_add_executor_job to resolve asyncio blocking I/O loop errors.
# // [MODIFIED v9.8.0 | 2026-05-12] Purpose: Refined the LLM classifier prompt to explicitly include examples for deleting specific time-based reminders and clearing daily reminders. Expanded the English fallback triggers to catch direct cancellation phrases faster.
# // [MODIFIED v9.7.0 | 2026-05-04] Purpose: Added a 'GENERAL' agent catch-all domain for jokes, stories, trivia, and open-ended conversation. Updated the LLM classifier to route unmatched general queries to this new agent.
# // [MODIFIED v9.6.0 | 2026-05-04] Purpose: Updated the LLM classifier prompt to route time, date, weather, news directly to the smart home agent.
# // [MODIFIED v9.5.0 | 2026-04-18] Purpose: PURGED every hardcoded non-English
# // token from this module. All language-dependent text (continuation words,
# // recipe indicators, LLM classifier examples, CALENDAR fallback triggers)
# // now either lives in an English-only master list that gets lazily
# // translated per UI language, or is pulled from user-configured trigger
# // strings on the config entry (CONF_TRIGGER_REMINDER / CONF_TRIGGER_CALENDAR
# // / existing CONF_TRIGGER_*). The dispatcher itself is now 100% English.
# // [MODIFIED v9.4.0 | 2026-04-18] Purpose: Added CALENDAR domain routing.
# // [v9.1.1 | 2026-04-14] Purpose: Pass lang_code through to every agent.
# // [v9.1.0 | 2026-04-14] Purpose: Replaced hard-coded localized triggers
# // with trigger_manager.
# // [v9.0.1 | 2026-04-14] Purpose: Fixed ModuleNotFoundError on Python 3.13+.
# // [v9.0.0 | 2026-04-13] Purpose: THE TRAFFIC COP.

import logging
import re
import importlib

from homeassistant.config_entries import ConfigEntry

from ..const import (
    CONF_PROCESSING_MODE, MODE_HYBRID,
    CONF_TRIGGER_REMINDER, CONF_TRIGGER_CALENDAR,
)
from .router import async_smart_router, safe_smart_router, FallbackMockEntry
from .json_utils import safe_parse_json
from .state_manager import has_state, COOKING_STATE_KEY
from .trigger_manager import get_triggers_for_language
from .continuation_manager import (
    get_continuation_words,
    get_recipe_indicators,
)

_LOGGER = logging.getLogger(__name__)


# Map of routing decision -> agent module name under home_organizer.agents
AGENT_MODULE_MAP = {
    "INVENTORY":  "inventory_agent",
    "SHOPPING":   "shopping_agent",
    "COOKING":    "cooking_agent",
    "SMART_HOME": "smarthome_agent",
    "STYLIST":    "stylist_agent",
    "REMINDER":   "reminder_agent",
    "CALENDAR":   "calendar_agent",
    "GENERAL":    "general_agent",
}


# English-only fallback triggers for the CALENDAR domain.
CALENDAR_FALLBACK_TRIGGERS_EN = [
    "calendar",
    "add to calendar",
    "schedule",
    "book a meeting",
    "put in my calendar",
    "appointment",
]

# // [MODIFIED v9.8.0 | 2026-05-12] Purpose: Added explicit deletion triggers.
# Same idea for REMINDER in case the trigger_manager cache lacks it.
REMINDER_FALLBACK_TRIGGERS_EN = [
    "remind",
    "reminder",
    "timer",
    "alert me",
    "alarm",
    "cancel reminder",
    "delete reminder",
    "clear reminders",
    "remove reminder",
]


# ==========================================
# TRIGGER DETECTION
# ==========================================
def _parse_user_triggers(entry, key):
    """Parse a comma-separated trigger string from the config entry."""
    raw = (
        (entry.options.get(key) if entry.options else None)
        or (entry.data.get(key) if entry.data else None)
        or ""
    )
    raw = str(raw).strip()
    if not raw:
        return []
    return [t.strip().lower() for t in raw.split(",") if t.strip()]


async def determine_explicit_domain(hass, message: str, entry: ConfigEntry,
                                    lang_code: str, strict: bool = True):
    """Detect a domain trigger word in the user message.

    strict=True  -> only matches at the START of the message (default).
    strict=False  -> matches anywhere in the message; used as a second pass
                     while a cooking session is active.
    """
    if not message:
        return "UNKNOWN", ""

    msg_lower = message.strip().lower()
    triggers = await get_triggers_for_language(hass, entry, lang_code)

    # Ensure CALENDAR is populated. Prefer trigger_manager output, fall back
    # to the English master, and always append any user-configured triggers
    # (which may be in ANY language the user chose).
    if not triggers.get("CALENDAR"):
        triggers["CALENDAR"] = list(CALENDAR_FALLBACK_TRIGGERS_EN)
    user_calendar = _parse_user_triggers(entry, CONF_TRIGGER_CALENDAR)
    if user_calendar:
        triggers["CALENDAR"] = triggers["CALENDAR"] + user_calendar

    # Same defensive posture for REMINDER.
    if not triggers.get("REMINDER"):
        triggers["REMINDER"] = list(REMINDER_FALLBACK_TRIGGERS_EN)
    user_reminder = _parse_user_triggers(entry, CONF_TRIGGER_REMINDER)
    if user_reminder:
        triggers["REMINDER"] = triggers["REMINDER"] + user_reminder

    domain_order = [
        "SMART_HOME", "COOKING", "SHOPPING", "STYLIST",
        "CALENDAR", "REMINDER", "INVENTORY",
    ]

    if strict:
        for domain in domain_order:
            for trigger in triggers.get(domain, []):
                t = str(trigger).lower()
                if (
                    msg_lower.startswith(t + " ")
                    or msg_lower.startswith(t + ",")
                    or msg_lower == t
                ):
                    return domain, trigger
        return "UNKNOWN", ""

    # Loose pass: skip COOKING (never re-enter cooking via contains) and
    # skip INVENTORY (too generic).
    loose_order = ["SMART_HOME", "CALENDAR", "REMINDER", "SHOPPING", "STYLIST"]
    for domain in loose_order:
        for trigger in triggers.get(domain, []):
            t = str(trigger).lower()
            if len(t) < 3:
                continue
            if re.search(rf"(^|\W){re.escape(t)}(\W|$)", msg_lower):
                return domain, trigger
    return "UNKNOWN", ""


# ==========================================
# CONTINUATION HEURISTIC (language-aware)
# ==========================================
def _looks_like_continuation(user_msg: str, continuation_words) -> bool:
    if not user_msg:
        return False
    # \w under re.UNICODE matches letters in any script, so this works for
    # Latin, Hebrew, Arabic, Cyrillic, CJK, etc. without per-language regex.
    cleaned = re.sub(r"[^\w\s]", "", user_msg, flags=re.UNICODE).strip().lower()
    if not cleaned:
        return False
    return any(cw == cleaned or cw in cleaned for cw in continuation_words)


def _last_assistant_mentions_recipe(messages, recipe_indicators) -> bool:
    for m in reversed(messages):
        if m.get("role") == "assistant":
            txt = (m.get("content") or "").lower()
            return any(ind in txt for ind in recipe_indicators)
    return False


# ==========================================
# LLM INTENT CLASSIFIER (last resort)
# ==========================================
# // [MODIFIED v9.8.0 | 2026-05-12] Purpose: Refined intent #8 to explicitly include examples for deleting specific time reminders and clearing the board.
async def _classify_with_llm(hass, entry, history_text, target_lang, is_cooking):
    cooking_hint = ""
    if is_cooking:
        cooking_hint = (
            "\nIMPORTANT: A cooking session is currently active. If the user is "
            "merely continuing the recipe or asking a recipe-related question, "
            'return {"intent": "cook", "recipe_name": "current"}. Only return a '
            "different intent if the user clearly wants a NON-cooking action."
        )

    intent_prompt = f"""Analyze the user's latest message within the context of the conversation history.

CHAT HISTORY:
{history_text}
{cooking_hint}

CRITICAL ROUTING RULE:
The default domain for any item management is "inventory".
ONLY classify as "shopping" if the user explicitly wants to buy, order, or purchase something, or asks to manage a shopping/cart list.
If the user simply says "Add [item]", route it to "inventory" even if it is a food item.

Determine the user's intent for their LATEST message, regardless of the language it is written in.
Return ONLY a JSON object in one of these exact formats:
1. If adding/removing/checking items in the physical home inventory (DEFAULT): {{"intent": "inventory"}}
2. If SPECIFICALLY asking to buy items or managing the shopping list: {{"intent": "shopping"}}
3. If searching for an item: {{"intent": "search"}}
4. If CONTINUING an active cooking session, asking for a recipe, SAVING a recipe to the database, LOADING a saved recipe, or navigating WITHIN a recipe in progress (e.g. "save this recipe", "keep this recipe", "save it to your DB", "load my saved cheesecake recipe", "jump to step 4", "go back to step 2", as well as the standard "give me a recipe for..."): {{"intent": "cook", "recipe_name": "Name of dish or 'current'"}}
5. If explicitly ending the recipe or clearing history (e.g., "End session", "Clear history"): {{"intent": "end_session", "message": "Confirm in {target_lang} that the session history is cleared"}}
6. If asking to control smart home devices, executing home routines (e.g., "good night", "good morning"), OR asking for the time, date, weather, or news/headlines: {{"intent": "smart_home"}}
7. If asking for fashion/stylist advice or what to wear: {{"intent": "stylist"}}
8. If asking ANYTHING about time-based reminders/alarms/timers — SETTING a new one, LISTING existing ones, or CANCELLING/DELETING them (e.g., "remind me in 10 minutes", "what are my active reminders", "cancel the 3 AM reminder", "delete the mail reminder", "clear all reminders today"): {{"intent": "reminder"}}
9. If asking ANYTHING about calendar events, meetings, or appointments — ADDING a new one, LISTING existing ones, CANCELLING/DELETING one, or RESCHEDULING (moving) one to a different date/time (e.g., "add meeting with X next Monday", "what meetings do I have this week", "cancel my appointment on Friday", "move the meeting to next Tuesday"): {{"intent": "calendar"}}
10. If the user is asking a general knowledge question, asking for a joke, a story, general advice, or simply making conversational small talk that does NOT fit any of the above categories: {{"intent": "general"}}

JSON ONLY:"""

    raw, err = await safe_smart_router(hass, entry, intent_prompt)
    if err or not raw:
        return None, err
    return safe_parse_json(raw), None


# ==========================================
# LAZY-IMPORT DISPATCH (per-agent isolation)
# ==========================================
async def _dispatch(domain_name, hass, entry, messages, target_lang,
                    existing_locs_str, loc_hierarchy_map, history_text,
                    last_user_msg, recipe_name, is_voice, device_id, user_id,
                    lang_code):
    module_name = AGENT_MODULE_MAP.get(domain_name)
    if not module_name:
        return f"❌ Unknown domain: {domain_name}"

    try:
        # // [MODIFIED v9.8.1 | 2026-05-14] Purpose: Offloaded importlib.import_module to an executor thread to prevent blocking the Home Assistant async event loop.
        module = await hass.async_add_executor_job(
            importlib.import_module,
            f"custom_components.home_organizer.agents.{module_name}"
        )
    except Exception as e:
        _LOGGER.error(
            f"Failed to import agent module {module_name}: {e}", exc_info=True
        )
        return f"❌ The {domain_name} agent is currently unavailable (import error)."

    if not hasattr(module, "run"):
        return f"❌ Agent {module_name} has no run() function."

    try:
        return await module.run(
            hass=hass,
            entry=entry,
            messages=messages,
            target_lang=target_lang,
            lang_code=lang_code,
            existing_locs_str=existing_locs_str,
            loc_hierarchy_map=loc_hierarchy_map,
            history_text=history_text,
            last_user_msg=last_user_msg,
            recipe_name=recipe_name,
            is_voice=is_voice,
            device_id=device_id,
            user_id=user_id,
        )
    except Exception as e:
        _LOGGER.error(f"Agent {module_name} runtime error: {e}", exc_info=True)
        return f"❌ The {domain_name} agent crashed: {e}"


# ==========================================
# MAIN ENTRY POINT (called by conversation.py)
# ==========================================
async def async_universal_agent_loop(hass, entry, messages, target_lang,
                                     existing_locs_str,
                                     loc_hierarchy_map=None, is_voice=False,
                                     device_id=None, user_id=None):
    if loc_hierarchy_map is None:
        loc_hierarchy_map = {}

    _LANG_NAME_TO_CODE = {
        "english": "en", "hebrew": "he", "french": "fr", "spanish": "es",
        "italian": "it", "german": "de", "russian": "ru", "arabic": "ar",
        "portuguese": "pt", "dutch": "nl", "polish": "pl", "turkish": "tr",
        "japanese": "ja", "korean": "ko", "chinese": "zh",
    }
    lang_code = _LANG_NAME_TO_CODE.get(
        (target_lang or "english").lower(), "en"
    )

    last_user_msg = ""
    history_text = ""
    is_cooking = has_state(messages, COOKING_STATE_KEY)

    for m in messages:
        if (
            m.get("role") == "system"
            and isinstance(m.get("content"), str)
            and m["content"].startswith(f"{COOKING_STATE_KEY}:")
        ):
            continue
        role = m["role"].upper()
        history_text += f"{role}: {m['content']}\n"
        if role == "USER":
            last_user_msg = m["content"]

    recipe_name = "the dish"
    i_type = "unknown"

    # Language-aware continuation words / recipe indicators (lazy-translated).
    continuation_words = await get_continuation_words(hass, entry, lang_code)
    recipe_indicators = await get_recipe_indicators(hass, entry, lang_code)

    # 1. Strict trigger detection (start of message).
    explicit_domain, matched_trigger = await determine_explicit_domain(
        hass, last_user_msg, entry, lang_code, strict=True
    )

    if explicit_domain == "COOKING":
        is_cooking = True
        recipe_name = (
            last_user_msg.lower().replace(matched_trigger, "", 1).strip()
            or "the requested dish"
        )
        _LOGGER.info(f"Explicit Routing (strict): COOKING. Recipe: {recipe_name}")
    elif explicit_domain != "UNKNOWN":
        i_type = explicit_domain.lower()
        _LOGGER.info(f"Explicit Routing (strict): {explicit_domain}")

    # 2. Loose trigger detection if a cooking session is active (user wants
    #    to do something other than cook mid-recipe).
    if explicit_domain == "UNKNOWN" and is_cooking:
        loose_domain, loose_trig = await determine_explicit_domain(
            hass, last_user_msg, entry, lang_code, strict=False
        )
        if loose_domain != "UNKNOWN":
            explicit_domain = loose_domain
            i_type = loose_domain.lower()
            _LOGGER.info(
                f"Explicit Routing (loose, mid-cooking): "
                f"{loose_domain} via '{loose_trig}'"
            )

    # 3. Continuation heuristic: bare "next"/"go"/etc. while the last
    #    assistant message mentions a recipe.
    if explicit_domain == "UNKNOWN" and not is_cooking:
        if (
            _looks_like_continuation(last_user_msg, continuation_words)
            and _last_assistant_mentions_recipe(messages, recipe_indicators)
        ):
            is_cooking = True
            _LOGGER.info("Contextual Routing: continuation detected -> COOKING.")

    # 4. LLM classifier as final fallback.
    if explicit_domain == "UNKNOWN" and i_type == "unknown" and not is_cooking:
        _LOGGER.info("No trigger word found. Falling back to LLM intent analysis.")
        parsed_intent, err = await _classify_with_llm(
            hass, entry, history_text, target_lang, is_cooking
        )
        if err:
            return f"❌ Connection Error (Router Phase): {err}"
        if parsed_intent:
            i_type = parsed_intent.get("intent", "unknown")
            if i_type == "end_session":
                messages.clear()
                return parsed_intent.get("message", "✅ Session cleared.")
            elif i_type == "cook":
                is_cooking = True
                recipe_name = parsed_intent.get("recipe_name", recipe_name)

    # 5. Final routing decision.
    domain_to_run = "INVENTORY"

    if explicit_domain in (
        "SMART_HOME", "STYLIST", "SHOPPING",
        "REMINDER", "CALENDAR", "COOKING", "GENERAL"
    ):
        domain_to_run = explicit_domain
    elif i_type in (
        "smart_home", "stylist", "shopping",
        "reminder", "calendar", "search", "general"
    ):
        domain_to_run = "INVENTORY" if i_type == "search" else i_type.upper()
    elif is_cooking:
        domain_to_run = "COOKING"

    # Smarthome agent expects the trailing user message to NOT be in messages.
    if domain_to_run == "SMART_HOME":
        if messages and messages[-1].get("role", "").lower() == "user":
            messages.pop()

    return await _dispatch(
        domain_to_run, hass, entry, messages, target_lang,
        existing_locs_str, loc_hierarchy_map, history_text,
        last_user_msg, recipe_name, is_voice, device_id, user_id, lang_code,
    )


# ==========================================
# SAFE WRAPPER WITH HYBRID FALLBACK
# ==========================================
async def safe_universal_agent_loop(hass, entry, mode, messages, target_lang,
                                    existing_locs_str, loc_hierarchy_map=None,
                                    is_voice=False, device_id=None, user_id=None):
    try:
        reply = await async_universal_agent_loop(
            hass, entry, messages, target_lang, existing_locs_str,
            loc_hierarchy_map, is_voice, device_id, user_id,
        )
        if (
            reply
            and mode == MODE_HYBRID
            and "error" in reply.lower()
            and any(
                kw in reply.lower()
                for kw in ["connection", "timeout", "router", "failed"]
            )
        ):
            return await async_universal_agent_loop(
                hass, FallbackMockEntry(entry), messages, target_lang,
                existing_locs_str, loc_hierarchy_map, is_voice, device_id, user_id,
            )
        return reply
    except Exception as e:
        if mode == MODE_HYBRID:
            try:
                return await async_universal_agent_loop(
                    hass, FallbackMockEntry(entry), messages, target_lang,
                    existing_locs_str, loc_hierarchy_map, is_voice, device_id, user_id,
                )
            except Exception as fe:
                return f"Error: {fe}"
        return f"Error: {e}"