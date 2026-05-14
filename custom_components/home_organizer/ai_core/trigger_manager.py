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
    "SMART_HOME": [
        "homie", "smart home", "home", "turn on", "turn off",
        "switch on", "switch off", "light", "lights", "lamp",
        "ac", "air conditioner", "air conditioning", "blinds",
        "curtain", "thermostat", "temperature", "fan",
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
    integration upgrades cannot accidentally delete it."""
    return hass.config.path("home_organizer_triggers_cache.json")


# In-memory mirror of the on-disk cache. Avoids re-reading the file on every
# request. Structure: {"languages": {"he": {...}, "fr": {...}}}
_MEMORY_CACHE = None
_MEMORY_CACHE_LOCK = asyncio.Lock()

# Track which languages are currently being translated to avoid duplicate
# parallel translation calls if many requests arrive at once.
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
    """If lang_code is missing from the cache, translate it now and persist.

    Uses a per-language pending set to coalesce concurrent calls so we never
    fire the same translation twice in parallel.
    """
    await _ensure_memory_cache_loaded(hass)

    languages = _MEMORY_CACHE.setdefault("languages", {})
    if lang_code in languages:
        return  # already cached

    if lang_code in _PENDING_TRANSLATIONS:
        # Another coroutine is already translating this language. Wait briefly
        # and then proceed with whatever is available (English fallback if not yet ready).
        for _ in range(20):
            await asyncio.sleep(0.25)
            if lang_code in languages:
                return
        return

    _PENDING_TRANSLATIONS.add(lang_code)
    try:
        translated = await _translate_master_list(hass, entry, lang_code)
        if translated:
            languages[lang_code] = translated
            await _persist_cache(hass)
            _LOGGER.info(f"Trigger cache updated with language '{lang_code}'.")
        else:
            _LOGGER.warning(
                f"Could not translate triggers to '{lang_code}'. "
                f"Will use English fallback for this session."
            )
    finally:
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
