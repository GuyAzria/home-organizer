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
# // [NEW v9.5.0 | 2026-04-18] Purpose: Lazy-translated continuation words
# // and recipe indicator words. Mirrors the architecture of localized_strings
# // and trigger_manager: an English master list, on-demand translation per
# // language via the smart router, and a persistent on-disk cache. Lets the
# // dispatcher perform continuation heuristics in any UI language without
# // ANY hardcoded non-English text inside the dispatcher itself.

import json
import logging
import os
import asyncio
import time

from .router import safe_smart_router
from .json_utils import safe_parse_json

_LOGGER = logging.getLogger(__name__)


# ==========================================
# MASTER LISTS (English only)
# ==========================================
# Bare affirmative/advance words a user might say to step through a recipe
# ("next", "continue", "keep going", "go", "yes", "ready", ...).
MASTER_CONTINUATION_EN = [
    "next",
    "continue",
    "done",
    "ready",
    "go",
    "start",
    "keep going",
    "step by step",
    "let's go",
    "yes",
]

# Words the cooking agent uses in its responses. We scan previous assistant
# turns for these to decide whether a bare "next" from the user should route
# to cooking or stay at the default inventory agent.
MASTER_RECIPE_INDICATORS_EN = [
    "recipe",
    "step-by-step",
    "step by step",
    "ingredients",
]


# ==========================================
# CACHE FILE
# ==========================================
def _cache_path(hass):
    return hass.config.path("home_organizer_continuation_cache.json")


_MEMORY_CACHE = None
_MEMORY_CACHE_LOCK = asyncio.Lock()
_PENDING_TRANSLATIONS = set()

# [ADDED v10.0.5] Failure back-off.
#
# When a translation call failed or returned malformed JSON, nothing was
# cached - so the next request retried the whole translation, and so did the
# one after that. Every user message silently paid for an extra LLM
# round-trip before the agent even started. Failures are now remembered.
_FAILED_TRANSLATIONS = {}
TRANSLATION_RETRY_SECONDS = 900  # 15 minutes


def _in_backoff(key):
    until = _FAILED_TRANSLATIONS.get(key)
    if until is None:
        return False
    if time.monotonic() >= until:
        _FAILED_TRANSLATIONS.pop(key, None)
        return False
    return True


def _mark_failed(key):
    _FAILED_TRANSLATIONS[key] = time.monotonic() + TRANSLATION_RETRY_SECONDS



LANG_NAME_MAP = {
    "en": "English",  "he": "Hebrew",   "fr": "French",
    "es": "Spanish",  "it": "Italian",  "de": "German",
    "ru": "Russian",  "ar": "Arabic",   "pt": "Portuguese",
    "nl": "Dutch",    "pl": "Polish",   "tr": "Turkish",
    "ja": "Japanese", "ko": "Korean",   "zh": "Chinese",
}


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
        _LOGGER.error(f"Failed to read continuation cache: {e}")
        return {"languages": {}}


def _save_cache_to_disk_sync(path, data):
    try:
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)
    except Exception as e:
        _LOGGER.error(f"Failed to write continuation cache: {e}")


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
            f"Continuation cache loaded. Cached languages: "
            f"{list(_MEMORY_CACHE.get('languages', {}).keys())}"
        )


async def _persist_cache(hass):
    if _MEMORY_CACHE is None:
        return
    snapshot = json.loads(json.dumps(_MEMORY_CACHE))
    await hass.async_add_executor_job(
        _save_cache_to_disk_sync, _cache_path(hass), snapshot
    )


# ==========================================
# TRANSLATION
# ==========================================
def _build_translation_prompt(lang_code):
    lang_name = LANG_NAME_MAP.get(lang_code, lang_code)
    master = json.dumps({
        "continuation_words": MASTER_CONTINUATION_EN,
        "recipe_indicators": MASTER_RECIPE_INDICATORS_EN,
    }, ensure_ascii=False, indent=2)
    return f"""You are a multilingual translator for a smart home voice assistant.

Translate every word/phrase in BOTH lists into natural spoken {lang_name}.

continuation_words are short imperatives a user might say to advance through
a recipe ("next", "continue", "keep going", "yes", "ready"...).

recipe_indicators are nouns a recipe assistant uses in its responses (e.g.
"recipe", "step-by-step", "ingredients"). We scan previous assistant replies
for these to detect that a recipe context is active.

CRITICAL OUTPUT RULES:
1. Return ONLY a valid JSON object. No markdown, no explanation.
2. Same two keys: "continuation_words" and "recipe_indicators".
3. Each value is an array of lowercase strings in {lang_name}.
4. You MAY add up to 3 extra common natural variants per list that a native
   {lang_name} speaker would really say in this context.
5. Never translate into English if the target language is not English.

INPUT (English master):
{master}

OUTPUT (JSON only, in {lang_name}):"""


async def _translate(hass, entry, lang_code):
    _LOGGER.info(f"Translating continuation words to '{lang_code}'...")
    prompt = _build_translation_prompt(lang_code)
    raw, err = await safe_smart_router(hass, entry, prompt)

    if err or not raw:
        _LOGGER.warning(f"Continuation translation failed for '{lang_code}': {err}")
        return None

    parsed = safe_parse_json(raw)
    if not isinstance(parsed, dict):
        return None

    cont = parsed.get("continuation_words")
    rec = parsed.get("recipe_indicators")

    if not isinstance(cont, list) or not cont:
        cont = list(MASTER_CONTINUATION_EN)
    if not isinstance(rec, list) or not rec:
        rec = list(MASTER_RECIPE_INDICATORS_EN)

    return {
        "continuation_words": [
            str(x).strip().lower() for x in cont if str(x).strip()
        ],
        "recipe_indicators": [
            str(x).strip().lower() for x in rec if str(x).strip()
        ],
    }


async def _ensure_language_cached(hass, entry, lang_code):
    """Make sure a translation exists, WITHOUT blocking the user's reply.

    [MODIFIED v10.0.6] This used to await the translation inline. On a cold
    cache that put a full LLM round-trip in front of every answer - which on a
    local model is many seconds, and is exactly why a simple reminder went
    from ~3s to ~20s after upgrading.

    A translation is now started in the background and this returns
    immediately. The current request answers using the English master list,
    which is always available, and the translated list is picked up by the
    following requests. No user message ever waits for a translation again.
    """
    await _ensure_memory_cache_loaded(hass)
    languages = _MEMORY_CACHE.setdefault("languages", {})

    if lang_code in languages:
        return
    if _in_backoff("continuation:" + lang_code):
        return
    if lang_code in _PENDING_TRANSLATIONS:
        return  # already running in the background

    _PENDING_TRANSLATIONS.add(lang_code)

    async def _background_translate():
        try:
            translated = await _translate(hass, entry, lang_code)
            if translated:
                languages[lang_code] = translated
                await _persist_cache(hass)
                _LOGGER.info(
                    "Continuation words cached for '%s' (background).", lang_code
                )
            else:
                _mark_failed("continuation:" + lang_code)
                _LOGGER.warning(
                    "Could not translate Continuation words to '%s'. Using the English "
                    "fallback; will retry in %s minutes.",
                    lang_code, TRANSLATION_RETRY_SECONDS // 60,
                )
        except Exception as err:
            _mark_failed("continuation:" + lang_code)
            _LOGGER.warning(
                "Background translation of Continuation words for '%s' failed: %s",
                lang_code, err,
            )
        finally:
            _PENDING_TRANSLATIONS.discard(lang_code)

    try:
        # [MODIFIED v2026.8.26] entry-scoped so Home Assistant cancels it on
        # unload or reload. hass.async_create_task would outlive the entry.
        entry.async_create_background_task(
            hass, _background_translate(), "home_organizer_continuation"
        )
    except Exception:  # pragma: no cover - no task API available
        _PENDING_TRANSLATIONS.discard(lang_code)


# ==========================================
# PUBLIC API
# ==========================================
async def get_continuation_words(hass, entry, lang_code):
    """Continuation trigger words localized to `lang_code`."""
    if not lang_code:
        lang_code = "en"
    lang_code = lang_code.lower().split("-")[0]

    if lang_code == "en":
        return list(MASTER_CONTINUATION_EN)

    await _ensure_language_cached(hass, entry, lang_code)
    languages = _MEMORY_CACHE.get("languages", {}) if _MEMORY_CACHE else {}
    entry_data = languages.get(lang_code)
    if not entry_data:
        return list(MASTER_CONTINUATION_EN)
    return entry_data.get("continuation_words") or list(MASTER_CONTINUATION_EN)


async def get_recipe_indicators(hass, entry, lang_code):
    """Recipe-indicator words localized to `lang_code`."""
    if not lang_code:
        lang_code = "en"
    lang_code = lang_code.lower().split("-")[0]

    if lang_code == "en":
        return list(MASTER_RECIPE_INDICATORS_EN)

    await _ensure_language_cached(hass, entry, lang_code)
    languages = _MEMORY_CACHE.get("languages", {}) if _MEMORY_CACHE else {}
    entry_data = languages.get(lang_code)
    if not entry_data:
        return list(MASTER_RECIPE_INDICATORS_EN)
    return entry_data.get("recipe_indicators") or list(MASTER_RECIPE_INDICATORS_EN)
