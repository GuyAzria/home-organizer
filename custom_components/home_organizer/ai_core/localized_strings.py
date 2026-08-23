# -*- coding: utf-8 -*-
# // [v9.1.1 | 2026-04-14] Purpose: Lazy-translated user-facing fallback
# // strings. Mirrors the architecture of trigger_manager.py: an English
# // master dictionary, on-demand translation per language via the smart
# // router, and a persistent cache on disk. This eliminates the last
# // hardcoded English strings that were leaking into Hebrew/French/etc
# // conversations when the LLM omitted a field or when an error path fired.

import json
import logging
import os
import asyncio

from .router import safe_smart_router
from .json_utils import safe_parse_json

_LOGGER = logging.getLogger(__name__)


# ==========================================
# MASTER STRINGS (English only)
# ==========================================
# Every user-facing fallback message that any agent might emit lives here.
# Agents look these up by key, NEVER inline an English literal in their own
# return statements.
MASTER_STRINGS_EN = {
    # Generic fallbacks (used by multiple agents)
    "clarify_no_location":   "Please specify the exact location.",
    "fallback_unsure":       "I wasn't sure how to proceed.",
    "fallback_stuck":        "I thought about this for too long and got stuck. Can we try again?",
    "invalid_format":        "The system returned an invalid format response.",
    "ai_connection_error":   "Sorry, I encountered an error connecting to my AI server.",

    # Cooking
    "cooking_finished":      "You have finished the recipe! Enjoy your meal!",
    "cooking_engine_error":  "Sorry, the cooking engine had a connection error.",
    "cooking_step_error":    "Error generating steps.",

    # Smart Home
    "smarthome_engine_error": "Sorry, I couldn't reach the Smart Home engine.",
    "smarthome_unknown_device": "I couldn't identify the exact device or action.",
    "smarthome_parse_error": "Failed to parse the Smart Home command.",
    "smarthome_unsure":      "I wasn't sure how to proceed with that smart home request.",
    # [ADDED v10.0.0] Security-related smart home messages.
    # smarthome_not_allowed is deliberately explicit: without it a blocked
    # lock/cover request would return "device not found", which is misleading.
    "smarthome_not_allowed": (
        "I'm not allowed to run that action. Locks and covers are handled by "
        "Home Assistant's own voice assistant, so try phrasing it the way "
        "Assist expects, or add an alias to that entity. Alarm panels can't "
        "be controlled by chat at all."
    ),
    "smarthome_no_permission": "You don't have permission to control that device.",
    "smarthome_execution_failed": "The command was accepted but Home Assistant could not complete it.",
    "smarthome_scripts_disabled": (
        "Running scripts and scenes is turned off. You can enable it in the "
        "Home Organizer options if you want me to start them."
    ),

    # [ADDED v10.0.0] News keys. These were already being looked up with
    # .get() and a hardcoded English default, which meant non-English users
    # always saw English on the error paths.
    "news_fetch_error":      "Sorry, I could not fetch the news right now.",
    "news_engine_error":     "Error formulating the news.",
    "news_parse_error":      "Error formulating the news.",

    # Reminder
    "reminder_in_past":       "The requested time is in the past!",
    "reminder_parse_error":   "Error parsing the exact reminder time.",
    "reminder_failed":        "Failed to set the reminder.",
    "reminder_unexpected_intent": "Expected a reminder request but got something else.",
    "reminder_process_error": "Sorry, I couldn't process the reminder.",
}


# ==========================================
# CACHE FILE
# ==========================================
def _cache_path(hass):
    """Cache lives in /config so integration upgrades cannot delete it.

    [MODIFIED v10.0.0] The filename carries a version suffix. New keys were
    added to MASTER_STRINGS_EN, and an existing cache would otherwise be
    considered complete, leaving the new security messages permanently in
    English. Bumping the filename retranslates once, automatically, with no
    manual cleanup by the user.
    """
    return hass.config.path("home_organizer_strings_cache_v2.json")


_MEMORY_CACHE = None
_MEMORY_CACHE_LOCK = asyncio.Lock()
_PENDING_TRANSLATIONS = set()


def _load_cache_from_disk_sync(path):
    if not os.path.exists(path):
        return {"languages": {}}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "languages" not in data:
            data = {"languages": {}}
        return data
    except Exception as e:
        _LOGGER.error(f"Failed to read strings cache: {e}")
        return {"languages": {}}


def _save_cache_to_disk_sync(path, data):
    try:
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)
    except Exception as e:
        _LOGGER.error(f"Failed to write strings cache: {e}")


async def _ensure_memory_cache_loaded(hass):
    global _MEMORY_CACHE
    if _MEMORY_CACHE is not None:
        return
    async with _MEMORY_CACHE_LOCK:
        if _MEMORY_CACHE is not None:
            return
        path = _cache_path(hass)
        _MEMORY_CACHE = await hass.async_add_executor_job(
            _load_cache_from_disk_sync, path
        )
        _LOGGER.info(
            f"Strings cache loaded. Cached languages: "
            f"{list(_MEMORY_CACHE.get('languages', {}).keys())}"
        )


async def _persist_cache(hass):
    if _MEMORY_CACHE is None:
        return
    path = _cache_path(hass)
    snapshot = json.loads(json.dumps(_MEMORY_CACHE))
    await hass.async_add_executor_job(_save_cache_to_disk_sync, path, snapshot)


# ==========================================
# TRANSLATION
# ==========================================
LANG_NAME_MAP = {
    "en": "English",  "he": "Hebrew",   "fr": "French",
    "es": "Spanish",  "it": "Italian",  "de": "German",
    "ru": "Russian",  "ar": "Arabic",   "pt": "Portuguese",
    "nl": "Dutch",    "pl": "Polish",   "tr": "Turkish",
    "ja": "Japanese", "ko": "Korean",   "zh": "Chinese",
}


def _build_translation_prompt(lang_code):
    lang_name = LANG_NAME_MAP.get(lang_code, lang_code)
    master_json = json.dumps(MASTER_STRINGS_EN, ensure_ascii=False, indent=2)
    return f"""You are a multilingual translator helping a smart home voice assistant.

Below is a JSON object of short user-facing messages in English, keyed by an
internal identifier. Translate every value into natural, conversational
{lang_name}. Keep the keys EXACTLY as they are.

CRITICAL OUTPUT RULES:
1. Return ONLY a valid JSON object, no markdown, no explanation.
2. Use the EXACT same keys as the input.
3. Translate the values into {lang_name} as a real native speaker would say them.
4. Keep the messages short and natural for spoken voice replies.
5. Do NOT add or remove keys.

INPUT (English):
{master_json}

OUTPUT (translated to {lang_name}, JSON only):"""


async def _translate_master_strings(hass, entry, lang_code):
    _LOGGER.info(f"Translating fallback strings to '{lang_code}'...")
    prompt = _build_translation_prompt(lang_code)
    raw, err = await safe_smart_router(hass, entry, prompt)

    if err or not raw:
        _LOGGER.warning(f"String translation failed for '{lang_code}': {err}")
        return None

    parsed = safe_parse_json(raw)
    if not isinstance(parsed, dict):
        _LOGGER.warning(
            f"String translation for '{lang_code}' returned invalid JSON."
        )
        return None

    cleaned = {}
    for key, en_value in MASTER_STRINGS_EN.items():
        value = parsed.get(key)
        if isinstance(value, str) and value.strip():
            cleaned[key] = value.strip()
        else:
            cleaned[key] = en_value  # per-key English fallback
    return cleaned


async def _ensure_language_cached(hass, entry, lang_code):
    await _ensure_memory_cache_loaded(hass)
    languages = _MEMORY_CACHE.setdefault("languages", {})

    if lang_code in languages:
        return

    if lang_code in _PENDING_TRANSLATIONS:
        for _ in range(20):
            await asyncio.sleep(0.25)
            if lang_code in languages:
                return
        return

    _PENDING_TRANSLATIONS.add(lang_code)
    try:
        translated = await _translate_master_strings(hass, entry, lang_code)
        if translated:
            languages[lang_code] = translated
            await _persist_cache(hass)
            _LOGGER.info(f"Strings cache updated with language '{lang_code}'.")
        else:
            _LOGGER.warning(
                f"Could not translate strings to '{lang_code}'. "
                f"English fallback will be used for this session."
            )
    finally:
        _PENDING_TRANSLATIONS.discard(lang_code)


# ==========================================
# PUBLIC API
# ==========================================
async def get_strings_for_language(hass, entry, lang_code):
    """Return the full localized strings dict for the given language code.

    Always returns a dict, even if translation failed (uses English as a
    per-key fallback so agent code can do `strings[key]` without checks).
    """
    if not lang_code:
        lang_code = "en"
    lang_code = lang_code.lower().split("-")[0]

    if lang_code == "en":
        return dict(MASTER_STRINGS_EN)

    await _ensure_language_cached(hass, entry, lang_code)
    languages = _MEMORY_CACHE.get("languages", {}) if _MEMORY_CACHE else {}
    translated = languages.get(lang_code)
    if not translated:
        return dict(MASTER_STRINGS_EN)

    # Ensure every key is present (safety net for partial translations).
    merged = dict(MASTER_STRINGS_EN)
    merged.update(translated)
    return merged