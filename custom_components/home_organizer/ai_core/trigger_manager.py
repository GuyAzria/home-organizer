# -*- coding: utf-8 -*-
# // [v9.1.0 | 2026-04-14] Purpose: Language-aware trigger manager. Holds a
# // master list of English trigger words for each agent domain, lazily
# // translates them to the user's language on first use, caches the result
# // on disk, and merges the result with any user-provided custom triggers
# // from config_flow. Multi-user safe: a household with Hebrew, French and
# // Russian users will end up with three separate translation sets coexisting
# // in the same cache file.

import json
import logging
import os
import asyncio
import time

from .router import safe_smart_router
from .json_utils import safe_parse_json
from ..const import (
    CONF_TRIGGER_INVENTORY, CONF_TRIGGER_SHOPPING, CONF_TRIGGER_COOKING,
    CONF_TRIGGER_SMART_HOME, CONF_TRIGGER_STYLIST,
)

_LOGGER = logging.getLogger(__name__)


# ==========================================
# MASTER TRIGGER LIST (English only, NO localized words anywhere)
# ==========================================
# Keep this list comprehensive but disjoint - the same word should not appear
# in two different domains, otherwise the dispatcher's first-match-wins logic
# becomes ambiguous.
MASTER_TRIGGERS_EN = {
    "INVENTORY": [
        "ho", "inventory", "stock", "pantry", "fridge",
        "store", "storage", "cabinet", "where is", "do we have",
        "find item", "locate", "quantity", "how many",
    ],
    "SHOPPING": [
        "cart", "list", "shopping", "buy", "purchase",
        "supermarket", "grocery", "groceries", "order",
        "need to buy", "out of stock", "restock", "shop",
    ],
    "COOKING": [
        "chef", "cook", "cooking", "recipe", "bake", "baking",
        "prepare", "dish", "meal", "ingredients", "sous chef",
        "kitchen", "food", "cuisine", "fry", "boil", "roast",
        "step by step",
    ],
    # [MODIFIED v10.0.0] Added lock/cover vocabulary. These are the most
    # sensitive words in the whole system, and until now "lock" appeared in
    # no list at all, so a lock request depended entirely on the LLM
    # classifier. They must land in SMART_HOME reliably, because that is the
    # branch that delegates to Home Assistant's own agent before any model
    # sees the request.
    "SMART_HOME": [
        "homie", "smart home", "home", "turn on", "turn off",
        "switch on", "switch off", "light", "lights", "lamp",
        "ac", "air conditioner", "air conditioning", "blinds",
        "curtain", "thermostat", "temperature", "fan",
        "lock", "unlock", "door", "front door", "gate",
        "shutter", "shutters", "garage", "roller shutter",
        "open the", "close the",
    ],
    "STYLIST": [
        "stylist", "clothes", "outfit", "wear", "what to wear",
        "fashion", "dress", "style", "wardrobe", "look",
    ],
    "REMINDER": [
        "remind", "reminder", "remind me", "set reminder",
        "alert me", "alarm", "wake me", "notify me",
    ],
}

ROUTING_DOMAINS = list(MASTER_TRIGGERS_EN)


# ==========================================
# [MODIFIED v10.0.4] DELEGATION VOCABULARY - SEPARATE TRANSLATION UNIT
# ==========================================
# These three groups were briefly part of MASTER_TRIGGERS_EN, which was a
# mistake: it grew the routing translation prompt by half, made that one call
# slower and more likely to return malformed JSON, and made EVERY request pay
# for vocabulary that only cover/lock requests ever need.
#
# They now live in their own dict with their own cache section and their own
# translation call, performed lazily and only when the delegation detector
# actually runs. A reminder or shopping request never pays for them.
#
# A sentence is treated as a delegated CONTROL request only when it contains
# an ACTION *and* a TARGET, and contains no CONTEXT word. That three-part rule
# separates "open the living room shutter" from "remind me to clean the
# shutter" and "add a door lock to the shopping list".
MASTER_DELEGATION_EN = {
    # Physical operations. Deliberately narrow: turn on/off is NOT here,
    # because those belong to lights and switches, not covers and locks.
    "DELEGATED_ACTIONS": [
        "open", "close", "shut", "lock", "unlock", "raise", "lower",
        "pull up", "pull down", "roll up", "roll down", "draw",
        "secure", "unsecure", "latch", "unlatch",
    ],

    # The things being operated.
    "DELEGATED_TARGETS": [
        "shutter", "shutters", "blind", "blinds", "curtain", "curtains",
        "roller shutter", "awning", "cover", "covers", "shade", "shades",
        "lock", "locks", "deadbolt", "door", "front door", "back door",
        "gate", "garage", "garage door",
    ],

    # Veto vocabulary. If any of these appears the sentence is about
    # remembering, buying, cooking, cleaning or scheduling something - not
    # about operating it - and must never be blocked.
    "DELEGATED_CONTEXT_VETO": [
        "remind", "reminder", "remember", "note", "task", "todo",
        "shopping", "shopping list", "buy", "purchase", "order", "cart",
        "add to list", "price", "cost", "how much",
        "clean", "cleaning", "wash", "wipe", "dust", "polish",
        "fix", "repair", "replace", "install", "broken", "service",
        "calendar", "schedule", "appointment", "meeting", "tomorrow",
        "inventory", "stock", "pantry", "fridge", "where is", "how many",
        "recipe", "cook", "cooking", "chef", "sous chef", "bake", "meal",
        "ingredients", "outfit", "wear", "wardrobe",
    ],
}

DELEGATION_GROUPS = tuple(MASTER_DELEGATION_EN)


# Map a domain name to its corresponding config_flow field key (if any)
DOMAIN_TO_CONF_KEY = {
    "INVENTORY":  CONF_TRIGGER_INVENTORY,
    "SHOPPING":   CONF_TRIGGER_SHOPPING,
    "COOKING":    CONF_TRIGGER_COOKING,
    "SMART_HOME": CONF_TRIGGER_SMART_HOME,
    "STYLIST":    CONF_TRIGGER_STYLIST,
    "REMINDER":   "trigger_reminder",
}


# ==========================================
# CACHE FILE LOCATION
# ==========================================
def _cache_path(hass):
    """Cache lives in /config (NOT inside the integration folder) so that
    integration upgrades cannot accidentally delete it.

    [MODIFIED v10.0.0] Version suffix added. MASTER_TRIGGERS_EN gained the
    lock/cover vocabulary, and an existing cache would be treated as complete
    and never retranslated, so upgrading users would silently keep the old
    word list. Bumping the filename forces exactly one retranslation per
    language with no manual file deletion.
    """
    return hass.config.path("home_organizer_triggers_cache_v6.json")


# In-memory mirror of the on-disk cache. Avoids re-reading the file on every
# request. Structure: {"languages": {"he": {...}, "fr": {...}}}
_MEMORY_CACHE = None
_MEMORY_CACHE_LOCK = asyncio.Lock()

# Track which languages are currently being translated to avoid duplicate
# parallel translation calls if many requests arrive at once.
_PENDING_TRANSLATIONS = set()

# [ADDED v10.0.4] Failure back-off.
#
# Previously, when a translation call failed or returned malformed JSON,
# NOTHING was cached - so the next request tried the whole translation again,
# and so did the one after that. Every single user message silently paid for
# an extra LLM round-trip before the actual agent even started, which roughly
# doubled response time. Failures are now remembered and retried at most once
# every TRANSLATION_RETRY_SECONDS.
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



# [ADDED v10.0.6] Cache migration.
#
# Earlier releases bumped this filename to force a re-translation whenever the
# master word list changed. That was a bad trade: it threw away a perfectly
# good cache that the user had already paid to build, and the next request had
# to rebuild it from scratch - on a local model that can take many seconds.
# We now ADOPT the newest previous cache we can find and top it up in the
# background instead.
LEGACY_CACHE_NAMES = [
    "home_organizer_triggers_cache_v6.json",
    "home_organizer_triggers_cache_v5.json",
    "home_organizer_triggers_cache_v4.json",
    "home_organizer_triggers_cache_v3.json",
    "home_organizer_triggers_cache_v2.json",
    "home_organizer_triggers_cache.json",
]


def _load_legacy_cache_sync(hass_config_path, current_name):
    for name in LEGACY_CACHE_NAMES:
        if name == current_name:
            continue
        path = hass_config_path(name)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and data.get("languages"):
                    _LOGGER.info(
                        "Adopting existing translation cache '%s'. No "
                        "re-translation needed.", name
                    )
                    return data
            except Exception as e:
                _LOGGER.debug("Could not read legacy cache %s: %s", name, e)
    return None


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
        _LOGGER.error(f"Failed to read trigger cache: {e}")
        return {"languages": {}}


def _save_cache_to_disk_sync(path, data):
    try:
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)
    except Exception as e:
        _LOGGER.error(f"Failed to write trigger cache: {e}")


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
        # If the current file is empty, adopt the newest previous cache
        # rather than making the user pay to rebuild it.
        if not _MEMORY_CACHE.get("languages"):
            legacy = await hass.async_add_executor_job(
                _load_legacy_cache_sync, hass.config.path,
                os.path.basename(path),
            )
            if legacy:
                _MEMORY_CACHE = legacy
        _LOGGER.info(
            f"Trigger cache loaded. Cached languages: "
            f"{list(_MEMORY_CACHE.get('languages', {}).keys())}"
        )


async def _persist_cache(hass):
    if _MEMORY_CACHE is None:
        return
    path = _cache_path(hass)
    snapshot = json.loads(json.dumps(_MEMORY_CACHE))  # deep copy
    await hass.async_add_executor_job(_save_cache_to_disk_sync, path, snapshot)


# ==========================================
# TRANSLATION
# ==========================================
LANG_NAME_MAP = {
    "en": "English",
    "he": "Hebrew",
    "fr": "French",
    "es": "Spanish",
    "it": "Italian",
    "de": "German",
    "ru": "Russian",
    "ar": "Arabic",
    "pt": "Portuguese",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
}


def _build_translation_prompt(lang_code):
    lang_name = LANG_NAME_MAP.get(lang_code, lang_code)
    master_json = json.dumps(MASTER_TRIGGERS_EN, ensure_ascii=False, indent=2)
    return f"""You are a multilingual translator helping a smart home voice assistant.

Below is a JSON object with English trigger keywords grouped by AGENT DOMAIN.
Each domain represents a different feature of the smart home system.

YOUR TASK:
Translate every English keyword into {lang_name}. For each English keyword you must
provide ALL common natural variations a real {lang_name} speaker would actually say:
- For verbs: include imperative form, present tense, infinitive
- For nouns: include singular and plural
- Include short colloquial forms and synonyms
- Do NOT include the original English word in the result
- Keep words short (1-3 words each), no full sentences
- Output between 2 and 6 variants per English keyword

CRITICAL OUTPUT RULES:
1. Return ONLY a valid JSON object, no markdown, no explanation.
2. Use the EXACT same domain keys as the input (INVENTORY, SHOPPING, COOKING, SMART_HOME, STYLIST, REMINDER).
3. Each domain value must be a flat array of {lang_name} strings (not nested objects).
4. All strings must be lowercase.

INPUT (English master list):
{master_json}

OUTPUT (translated to {lang_name}, JSON only):"""


async def _translate_master_list(hass, entry, lang_code):
    """Call the smart router to translate the master list. Returns dict or None."""
    _LOGGER.info(f"Translating trigger master list to '{lang_code}'...")

    prompt = _build_translation_prompt(lang_code)
    raw, err = await safe_smart_router(hass, entry, prompt)

    if err or not raw:
        _LOGGER.warning(f"Trigger translation failed for '{lang_code}': {err}")
        return None

    parsed = safe_parse_json(raw)
    if not isinstance(parsed, dict):
        _LOGGER.warning(
            f"Trigger translation for '{lang_code}' returned invalid JSON."
        )
        return None

    # Sanity check: ensure every domain is present and is a list of strings.
    cleaned = {}
    for domain in MASTER_TRIGGERS_EN.keys():
        value = parsed.get(domain, [])
        if not isinstance(value, list):
            _LOGGER.warning(
                f"Domain '{domain}' missing or invalid in translation, "
                f"falling back to English for this domain."
            )
            cleaned[domain] = list(MASTER_TRIGGERS_EN[domain])
            continue
        cleaned[domain] = [
            str(v).strip().lower()
            for v in value
            if isinstance(v, (str, int, float)) and str(v).strip()
        ]
        if not cleaned[domain]:
            cleaned[domain] = list(MASTER_TRIGGERS_EN[domain])

    return cleaned


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
    if _in_backoff("triggers:" + lang_code):
        return
    if lang_code in _PENDING_TRANSLATIONS:
        return  # already running in the background

    _PENDING_TRANSLATIONS.add(lang_code)

    async def _background_translate():
        try:
            translated = await _translate_master_list(hass, entry, lang_code)
            if translated:
                languages[lang_code] = translated
                await _persist_cache(hass)
                _LOGGER.info(
                    "Trigger vocabulary cached for '%s' (background).", lang_code
                )
            else:
                _mark_failed("triggers:" + lang_code)
                _LOGGER.warning(
                    "Could not translate Trigger vocabulary to '%s'. Using the English "
                    "fallback; will retry in %s minutes.",
                    lang_code, TRANSLATION_RETRY_SECONDS // 60,
                )
        except Exception as err:
            _mark_failed("triggers:" + lang_code)
            _LOGGER.warning(
                "Background translation of Trigger vocabulary for '%s' failed: %s",
                lang_code, err,
            )
        finally:
            _PENDING_TRANSLATIONS.discard(lang_code)

    try:
        hass.async_create_task(_background_translate())
    except Exception:  # pragma: no cover - no task API available
        _PENDING_TRANSLATIONS.discard(lang_code)


# ==========================================
# CONFIG_FLOW USER ADDITIONS
# ==========================================
def _get_user_custom_triggers(entry, domain):
    """Return the user's custom triggers from config_flow for one domain.

    These are merged ON TOP of the translated master list so the user never
    loses words they typed manually.
    """
    conf_key = DOMAIN_TO_CONF_KEY.get(domain)
    if not conf_key:
        return []

    raw = entry.options.get(conf_key) or entry.data.get(conf_key) or ""
    if not raw:
        return []

    return [x.strip().lower() for x in raw.split(",") if x.strip()]


# ==========================================
# PUBLIC API
# ==========================================
async def get_triggers_for_language(hass, entry, lang_code):
    """Return a fully-merged trigger dict for the given language.

    Merge order:
      1. User custom triggers from config_flow (highest priority)
      2. Translated master list for `lang_code`
      3. English master list (fallback if translation failed or unavailable)

    All entries are de-duplicated and sorted by length (longest first) so
    multi-word triggers like "smart home" win over single-word "home".
    """
    if not lang_code:
        lang_code = "en"
    lang_code = lang_code.lower().split("-")[0]  # normalize "he-IL" -> "he"

    await _ensure_memory_cache_loaded(hass)

    # English never needs translation.
    if lang_code != "en":
        await _ensure_language_cached(hass, entry, lang_code)

    languages = _MEMORY_CACHE.get("languages", {}) if _MEMORY_CACHE else {}
    translated_for_lang = languages.get(lang_code, {})

    merged = {}
    for domain, en_words in MASTER_TRIGGERS_EN.items():
        combined = []

        # 1. User custom (always wins, always included)
        combined.extend(_get_user_custom_triggers(entry, domain))

        # 2. Translated words for this language (if available)
        if translated_for_lang.get(domain):
            combined.extend(translated_for_lang[domain])

        # 3. English master list as final safety net
        combined.extend(en_words)

        # Deduplicate while preserving first occurrence
        seen = set()
        deduped = []
        for w in combined:
            if w not in seen:
                seen.add(w)
                deduped.append(w)

        # Sort by length descending so "smart home" matches before "home"
        merged[domain] = sorted(deduped, key=len, reverse=True)

    return merged


async def _translate_delegation(hass, entry, lang_code):
    """Translate only the delegation vocabulary. Small, isolated call."""
    lang_name = LANG_NAME_MAP.get(lang_code, lang_code)
    master = json.dumps(MASTER_DELEGATION_EN, ensure_ascii=False, indent=2)
    prompt = f"""You are a multilingual translator for a smart home assistant.

Translate every word below into natural spoken {lang_name}.

DELEGATED_ACTIONS are verbs for physically operating a shutter or a lock
(open, close, lock, unlock, raise, lower). Include imperative forms.
DELEGATED_TARGETS are the objects operated (shutter, blind, curtain, lock,
door, gate, garage).
DELEGATED_CONTEXT_VETO are words showing the sentence is about remembering,
buying, cooking, cleaning or scheduling something rather than operating it.

CRITICAL OUTPUT RULES:
1. Return ONLY a valid JSON object. No markdown, no explanation.
2. Use the EXACT same three keys as the input.
3. Each value is a flat array of lowercase {lang_name} strings.
4. Give 2 to 5 natural variants per English word.
5. Never output English if the target language is not English.

INPUT (English master):
{master}

OUTPUT (JSON only, in {lang_name}):"""

    raw, err = await safe_smart_router(hass, entry, prompt)
    if err or not raw:
        _LOGGER.warning(f"Delegation translation failed for '{lang_code}': {err}")
        return None

    parsed = safe_parse_json(raw)
    if not isinstance(parsed, dict):
        return None

    cleaned = {}
    for group, en_words in MASTER_DELEGATION_EN.items():
        value = parsed.get(group)
        if not isinstance(value, list) or not value:
            cleaned[group] = list(en_words)
            continue
        cleaned[group] = [
            str(v).strip().lower() for v in value
            if isinstance(v, (str, int, float)) and str(v).strip()
        ] or list(en_words)
    return cleaned


async def _ensure_delegation_cached(hass, entry, lang_code):
    """Same non-blocking policy as the routing vocabulary.

    [MODIFIED v10.0.6] Started in the background; the caller falls back to the
    English lists for this request. A refusal that guards a lock must never be
    the thing that makes the user wait.
    """
    await _ensure_memory_cache_loaded(hass)
    store = _MEMORY_CACHE.setdefault("delegation", {})

    if lang_code in store:
        return
    if _in_backoff(f"delegation:{lang_code}"):
        return

    key = f"__delegation__{lang_code}"
    if key in _PENDING_TRANSLATIONS:
        return

    _PENDING_TRANSLATIONS.add(key)

    async def _background_translate():
        try:
            translated = await _translate_delegation(hass, entry, lang_code)
            if translated:
                store[lang_code] = translated
                await _persist_cache(hass)
                _LOGGER.info(
                    "Delegation vocabulary cached for '%s' (background).",
                    lang_code,
                )
            else:
                _mark_failed(f"delegation:{lang_code}")
        except Exception as err:
            _mark_failed(f"delegation:{lang_code}")
            _LOGGER.warning(
                "Background delegation translation for '%s' failed: %s",
                lang_code, err,
            )
        finally:
            _PENDING_TRANSLATIONS.discard(key)

    try:
        hass.async_create_task(_background_translate())
    except Exception:  # pragma: no cover
        _PENDING_TRANSLATIONS.discard(key)


async def get_delegation_vocabulary(hass, entry, lang_code):
    """Return the localized action / target / veto vocabulary as a dict.

    [MODIFIED v10.0.4] Translated lazily and independently of the routing
    triggers, so only cover/lock-shaped requests ever pay for it. The English
    master lists are ALWAYS included, even when translation is unavailable:
    this vocabulary guards a safety-relevant refusal, so it must degrade to
    "fewer languages", never to "no words at all".
    """
    if not lang_code:
        lang_code = "en"
    lang_code = lang_code.lower().split("-")[0]

    translated = {}
    if lang_code != "en":
        try:
            await _ensure_delegation_cached(hass, entry, lang_code)
            store = _MEMORY_CACHE.get("delegation", {}) if _MEMORY_CACHE else {}
            translated = store.get(lang_code) or {}
        except Exception as err:  # pragma: no cover - defensive
            _LOGGER.warning(
                "Delegation vocabulary unavailable for '%s' (%s). "
                "Falling back to the English lists.", lang_code, err
            )

    out = {}
    for group, en_words in MASTER_DELEGATION_EN.items():
        combined = list(translated.get(group) or []) + list(en_words)
        seen, words = set(), []
        for w in combined:
            w = str(w).strip().lower()
            if w and w not in seen:
                seen.add(w)
                words.append(w)
        out[group] = sorted(words, key=len, reverse=True)
    return out