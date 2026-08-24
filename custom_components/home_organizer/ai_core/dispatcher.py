# -*- coding: utf-8 -*-
# // [MODIFIED v10.0.0 | 2026-08-23] Purpose: SECURITY HARDENING (HACS review).
# // The traffic cop now gives Home Assistant's own built-in conversation
# // agent the first attempt at every device-control request. Locks and covers
# // are therefore executed by HA core under the user's existing exposure
# // settings and permission model, and never by an LLM. Only when the
# // built-in agent replies NO_INTENT_MATCH does the request continue to the
# // HO-AI smart home agent, where a fixed allow-list applies.
# // Also fixes the trailing-message pop so it only happens when we actually
# // continue to our own agent.
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
from homeassistant.core import Context
from homeassistant.helpers import intent as intent_helper
from homeassistant.helpers import entity_registry as er

from ..const import (
    CONF_PROCESSING_MODE, MODE_HYBRID,
    CONF_TRIGGER_REMINDER, CONF_TRIGGER_CALENDAR,
    HA_BUILTIN_CONVERSATION_AGENT,
    SMARTHOME_DELEGATED_DOMAINS,
)
from .router import async_smart_router, safe_smart_router, FallbackMockEntry
from .json_utils import safe_parse_json
from .state_manager import has_state, COOKING_STATE_KEY
from .trigger_manager import get_triggers_for_language, get_delegation_vocabulary
from .localized_strings import get_strings_for_language
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
# [ADDED v10.0.0] DELEGATION TO HOME ASSISTANT'S BUILT-IN AGENT
# ==========================================
async def async_try_home_assistant_agent(hass, text, language, user_id=None,
                                         device_id=None, conversation_id=None):
    """Give Home Assistant's own conversation agent the first attempt.

    Why this exists
    ---------------
    Locks, covers and any other sensitive device are no longer executed by
    this integration. Instead the raw sentence is handed to HA core's
    built-in intent engine, which:
      * only touches entities the user has exposed to Assist,
      * applies Home Assistant's own permission model,
      * never involves a cloud model, so a prompt injection has nothing to
        act on, and
      * costs zero tokens for ordinary commands like "turn on the lights".

    Return value
    ------------
    A string when HA handled the request (that string is the final answer),
    or None when HA did not understand it and the caller should continue to
    the HO-AI agent.

    Important details
    -----------------
    * agent_id is pinned to the built-in agent. Passing None would resolve to
      the user's DEFAULT agent, which may well be HO-AI itself, producing
      infinite recursion.
    * Only NO_INTENT_MATCH means "not understood". Any other error (entity
      not exposed, no valid target, and so on) is a real answer from HA and
      is returned to the user as-is, otherwise the user would get a confusing
      "device not found" from our agent instead of HA's accurate explanation.
    """
    try:
        # Imported lazily: the conversation component may not be loaded in
        # every installation, and a hard import at module level would break
        # the whole dispatcher.
        from homeassistant.components import conversation
    except ImportError:  # pragma: no cover
        return None

    ha_context = Context(user_id=user_id) if user_id else Context()

    try:
        result = await conversation.async_converse(
            hass=hass,
            text=text,
            conversation_id=conversation_id,
            context=ha_context,
            language=language,
            agent_id=HA_BUILTIN_CONVERSATION_AGENT,
            device_id=device_id,
        )
    except Exception as err:
        # Older cores, a missing built-in agent entity, or an unexpected
        # signature change must never take the whole chat down. Fall through
        # to our own agent instead.
        _LOGGER.debug("HA built-in agent delegation unavailable: %s", err)
        return None

    try:
        response = result.response

        # [MODIFIED v10.0.7] ANY error from the built-in agent means "not
        # handled", and the request continues to our own agent.
        #
        # This previously fell through only on NO_INTENT_MATCH, and returned
        # HA's own error text for every other failure. That broke ordinary
        # commands: HA parses "turn on the hallway light" fine, but if the
        # entity is not exposed to Assist it answers "Sorry, I am not aware of
        # a device called light" - and that reply was handed straight back to
        # the user, even though our agent could have found the light by name
        # and switched it on, as it always used to.
        #
        # Covers and locks are NOT affected: they are stopped separately by
        # async_is_delegated_request, which returns a refusal explaining how to
        # set them up. That message is more useful than HA's generic error, so
        # nothing is lost by falling through here.
        if response.response_type == intent_helper.IntentResponseType.ERROR:
            _LOGGER.debug(
                "HA built-in agent did not handle the request (%s). "
                "Continuing to the Home Organizer agent.",
                getattr(response, "error_code", "unknown"),
            )
            return None

        speech = response.speech.get("plain", {}).get("speech", "")
        if speech:
            _LOGGER.info("Routing: handled natively by Home Assistant Assist.")
            return speech

        # Understood and executed, but with no spoken text configured.
        _LOGGER.info("Routing: handled natively by Home Assistant Assist.")
        return "🏠"
    except Exception as err:  # pragma: no cover - defensive
        _LOGGER.debug("Could not interpret HA agent response: %s", err)
        return None


# ==========================================
# [ADDED v10.0.1] DELEGATED-DOMAIN DETECTION
# ==========================================
def _phrase_in_text(phrase, text):
    """Match a vocabulary phrase inside a sentence, per-script.

    Latin-script phrases are matched on word boundaries, because substring
    matching produces false positives that matter here: "lock" occurs inside
    "block" and "clock", and a false positive on a lock is exactly what this
    detector must not produce.

    Non-Latin scripts are matched as substrings. Hebrew, Arabic and others
    attach prefixes directly to the word, so "תריס" must still match inside
    "התריס", where a word-boundary match would fail.
    """
    if not phrase:
        return False
    if all(ord(c) < 128 for c in phrase):
        return re.search(r"\b" + re.escape(phrase) + r"\b", text) is not None
    return phrase in text


def _collect_delegated_target_names(hass):
    """Friendly names and aliases of the user's own cover and lock entities.

    These count as TARGET evidence. They are inherently language-correct:
    an entity the user called "תריס סלון" matches a Hebrew sentence with no
    translation step at all.
    """
    names = []
    try:
        registry = er.async_get(hass)
        for state in hass.states.async_all():
            if state.domain not in SMARTHOME_DELEGATED_DOMAINS:
                continue
            friendly = state.attributes.get("friendly_name")
            if friendly:
                names.append(str(friendly))
            entry_obj = registry.async_get(state.entity_id)
            if entry_obj and getattr(entry_obj, "aliases", None):
                names.extend(str(a) for a in entry_obj.aliases if a)
    except Exception as err:  # pragma: no cover - never block on detection
        _LOGGER.debug("Delegated entity-name scan failed: %s", err)
    # Require a reasonably distinctive name, so a cover simply called
    # "Salon" cannot swallow "turn on the salon light".
    return [n.strip().lower() for n in names if len(n.strip()) >= 4]


async def async_is_delegated_request(hass, entry, text, lang_code):
    """Return True only for a CONTROL request aimed at a cover or a lock.

    Why this exists
    ---------------
    cover and lock are executed by Home Assistant, never by this integration.
    When HA's built-in agent cannot parse the sentence, the request used to
    continue to the LLM agent. The agent could not act - those domains are not
    on the allow-list and their entities are filtered out of the prompt - but
    nothing stopped the model from replying with a fabricated confirmation
    such as "opening the shutter". A false success on a lock is worse than a
    refusal, so such requests are stopped before the model sees them.

    Why it needs three signals rather than one keyword
    --------------------------------------------------
    Blocking on the noun alone was too blunt. These must all still work:
        "remind me to clean the shutter"  -> reminder agent
        "add a door lock to the shopping list" -> shopping agent
        "how much does a shutter motor cost" -> normal answer
    So a sentence is refused only when it contains an ACTION *and* a TARGET
    and no CONTEXT veto word. Everything else continues to its normal agent.
    """
    if not text:
        return False

    lowered = text.lower()

    try:
        vocab = await get_delegation_vocabulary(hass, entry, lang_code)
    except Exception as err:  # pragma: no cover
        _LOGGER.debug("Delegation vocabulary lookup failed: %s", err)
        return False

    # Gate 1: veto. Reminders, shopping, cleaning, repairs, scheduling and
    # price questions are never control requests, whatever nouns they use.
    for word in vocab.get("DELEGATED_CONTEXT_VETO", []):
        if _phrase_in_text(word, lowered):
            _LOGGER.debug(
                "Not a delegated control request: context word '%s'.", word
            )
            return False

    # Gate 2: an actual physical operation must be requested.
    action = next(
        (w for w in vocab.get("DELEGATED_ACTIONS", [])
         if _phrase_in_text(w, lowered)),
        None,
    )
    if action is None:
        return False

    # Gate 3: the target must be a cover or a lock - either by vocabulary,
    # or by matching one of the user's own entity names.
    target = next(
        (w for w in vocab.get("DELEGATED_TARGETS", [])
         if _phrase_in_text(w, lowered)),
        None,
    )
    if target is None:
        target = next(
            (n for n in _collect_delegated_target_names(hass) if n in lowered),
            None,
        )
    if target is None:
        return False

    _LOGGER.debug(
        "Delegated control request detected (action='%s', target='%s').",
        action, target,
    )
    return True


async def async_delegated_refusal(hass, entry, lang_code):
    """The honest answer for a cover/lock request HA could not handle."""
    strings = await get_strings_for_language(hass, entry, lang_code)
    return strings["smarthome_not_allowed"]


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
6. If asking to control ANY physical device in the house - lights, switches, fans, air conditioning, media players, and ALSO doors, locks, gates, shutters, blinds, curtains or garage doors - or executing home routines (e.g., "good night", "good morning"), OR asking for the time, date, weather, or news/headlines: {{"intent": "smart_home"}}
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
    # [MODIFIED v10.0.5] These two were fetched on EVERY request, but they are
    # only ever read by the continuation heuristic in step 3, which runs only
    # when no trigger matched and no cooking session is active. On a language
    # whose cache is not warm yet, fetching them here meant a translation
    # round-trip before every single message - including a reminder that had
    # already been routed by its trigger word in step 1. They are now fetched
    # lazily, at the point of use.

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
        continuation_words = await get_continuation_words(hass, entry, lang_code)
        recipe_indicators = await get_recipe_indicators(hass, entry, lang_code)
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
    matched_any_domain = False

    if explicit_domain in (
        "SMART_HOME", "STYLIST", "SHOPPING",
        "REMINDER", "CALENDAR", "COOKING", "GENERAL"
    ):
        domain_to_run = explicit_domain
        matched_any_domain = True
    elif i_type in (
        "smart_home", "stylist", "shopping",
        "reminder", "calendar", "search", "general"
    ):
        domain_to_run = "INVENTORY" if i_type == "search" else i_type.upper()
        matched_any_domain = True
    elif is_cooking:
        domain_to_run = "COOKING"
        matched_any_domain = True

    # [ADDED v10.0.0] Delegation point 1: device control.
    # Every smart home request gets handed to Home Assistant's built-in agent
    # before any model is involved. If HA understood it, we are done, and a
    # lock or cover was just executed by HA core rather than by an LLM.
    if domain_to_run == "SMART_HOME":
        ha_reply = await async_try_home_assistant_agent(
            hass, last_user_msg, lang_code, user_id=user_id, device_id=device_id
        )
        if ha_reply is not None:
            messages.append({"role": "assistant", "content": ha_reply})
            return ha_reply

        # [ADDED v10.0.1] HA declined. Before the model is involved at all,
        # stop cover/lock requests here. The agent cannot execute them, and
        # letting it reply freely produced fabricated confirmations such as
        # "opening the shutter" when nothing had happened.
        if await async_is_delegated_request(hass, entry, last_user_msg, lang_code):
            refusal = await async_delegated_refusal(hass, entry, lang_code)
            _LOGGER.info(
                "Routing: cover/lock request not handled by HA. "
                "Refusing rather than passing it to the model."
            )
            messages.append({"role": "assistant", "content": refusal})
            return refusal

    # [ADDED v10.0.0] Delegation point 2: safety net.
    # Nothing matched and we are about to default to INVENTORY. Local intent
    # matching costs milliseconds, so try HA once more here: this catches
    # device commands that the (translated) trigger words missed in a given
    # language, and keeps them out of the model entirely.
    if not matched_any_domain and not is_cooking:
        # [ADDED v10.0.3] Guard the safety net.
        #
        # Home Assistant ships built-in intents for shopping lists, to-do
        # lists and timers. If a sentence that really belongs to one of our
        # own agents reached HA here, HA would answer it successfully and our
        # agent would never run - the item would land in HA's shopping list
        # instead of the Home Organizer database, silently.
        #
        # The strict trigger pass only matches at the START of a sentence, so
        # a phrasing like "please add milk to the shopping list" falls through
        # to here. A second, loose pass catches it. Anything that belongs to
        # one of our agents is kept away from HA; only SMART_HOME (or no
        # match at all) is allowed through, which is the case this safety net
        # was built for.
        loose_domain, _loose_trigger = await determine_explicit_domain(
            hass, last_user_msg, entry, lang_code, strict=False
        )
        if loose_domain and loose_domain not in ("SMART_HOME", "UNKNOWN"):
            _LOGGER.debug(
                "Safety net skipped: '%s' belongs to the %s agent.",
                last_user_msg, loose_domain,
            )
            return await _dispatch(
                hass, entry, messages, target_lang, existing_locs_str,
                loc_hierarchy_map, history_text, domain_to_run,
                last_user_msg, recipe_name, is_voice, device_id, user_id,
                lang_code,
            )

        ha_reply = await async_try_home_assistant_agent(
            hass, last_user_msg, lang_code, user_id=user_id, device_id=device_id
        )
        if ha_reply is not None:
            messages.append({"role": "assistant", "content": ha_reply})
            return ha_reply

        # [ADDED v10.0.1] Same gate on the safety-net path.
        if await async_is_delegated_request(hass, entry, last_user_msg, lang_code):
            refusal = await async_delegated_refusal(hass, entry, lang_code)
            _LOGGER.info(
                "Routing: unmatched cover/lock request. Refusing rather than "
                "passing it to the model."
            )
            messages.append({"role": "assistant", "content": refusal})
            return refusal

    # [MODIFIED v10.0.0] The smarthome agent expects the trailing user message
    # to NOT be in `messages`. This pop used to run unconditionally, which
    # would corrupt the history whenever we returned early above. It now runs
    # only on the path that actually reaches our own smart home agent.
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