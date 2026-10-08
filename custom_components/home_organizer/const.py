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

# // [ADDED v2026.10.7 | 2026-10-07] Purpose: SETTING_HOME_PROFILE, the
# // locations wizard's answer sheet.
# //
# // Not a record of what was created - the locations themselves are rows in
# // `items`. This is what the user TICKED, so reopening the wizard shows their
# // own answers rather than a blank form, and "the kitchen is actually on floor
# // 2" is a correction instead of starting again.
# // [MODIFIED v2026.10.6 | 2026-10-06] Purpose: which product databases a
# // barcode scan asks, in what order, and for how long.
# //
# // It was a config-entry option for about an hour, which could not work:
# // __init__.py registers entry.add_update_listener(update_listener) and that
# // calls async_reload, so writing an option from a panel sheet would reload
# // the whole integration every time a checkbox is ticked.
# //
# // It lives in app_settings now, as one JSON list in ranked order, and the
# // options-flow step was removed rather than left behind writing somewhere
# // else - two surfaces for one setting is the drift RULE 21 forbids.
# //
# // BARCODE_SOURCE_OFF went with it. "Disabled" was only ever the dropdown's
# // own choice, nothing else referenced it, and a user-visible English string
# // here would have needed a translation it never had (RULE 33d).
# //
# // BARCODE_SOURCE_TIMEOUT is 30, not 8. The original code passed no timeout
# // at all, so aiohttp allowed five minutes; capping it at 8 cut off answers
# // that were still coming, and a scan that could have been named exactly fell
# // back to guessing from the manufacturer prefix instead.
# //
# // BARCODE_LOOKUP_BUDGET bounds the lookup as a whole. The per-source timeout
# // bounds nothing on its own - four sources at 30 seconds is two minutes, and
# // every source added made it worse. The budget is checked before each source,
# // so the ceiling is budget + one timeout whatever is enabled.
# //
# // BARCODE_SOURCE_OPEN_LIBRARY and BARCODE_SOURCE_AI are the fourth and
# // fifth sources, both LAST on purpose - see the comment on
# // DEFAULT_BARCODE_SOURCE_ORDER. The AI one is the model the user already
# // configured, asked what the barcode is as its own question. It is last
# // because a real product database beats a recollection, because it is the
# // only source that costs money per scan, and because it is the only one
# // that can invent an answer.

"""Constants for the Home Organizer integration."""

DOMAIN = "home_organizer"
VERSION = "10.0.0"

# Configuration Keys
CONF_API_KEY = "api_key"
CONF_DEBUG = "debug_mode"
CONF_USE_AI = "use_ai"

# AI Config (LLM)
CONF_AI_PROVIDER = "ai_provider"
CONF_AI_BASE_URL = "ai_base_url"
CONF_AI_MODEL = "ai_model"

# Storage
CONF_STORAGE_METHOD = "storage_method"
CONF_DELETE_ON_REMOVE = "delete_on_remove"
STORAGE_METHOD_WWW = "www"
STORAGE_METHOD_MEDIA = "media"

# Providers
PROVIDER_GEMINI = "Google Gemini"
PROVIDER_OPENAI = "OpenAI / Local Ollama"
PROVIDER_CLAUDE = "Anthropic Claude"

# Processing Modes
CONF_PROCESSING_MODE = "processing_mode"
MODE_LOCAL_ONLY = "Local Only (100% Ollama)"
MODE_CLOUD_ONLY = "Cloud Only (Gemini/OpenAI API)"
MODE_HYBRID = "Hybrid (Local Voice + Cloud Images)"
# [ADDED v2026.10.5] Which product database the barcode scan asks, and in
# what order.
#
# These used to be a hardcoded `if not external_hint:` chain, so the order
# was whatever the code said and a source could not be turned off. The web
# search in particular is an HTML scrape of a results page rather than a
# product database, and an installation that should not be making that
# request can now set it to Disabled.
#
# The stored value is the English display string, which is how
# CONF_PROCESSING_MODE and CONF_AI_PROVIDER are already stored in this
# file (RULE 27).
BARCODE_SOURCE_OFF_FACTS = "Open Food Facts"
BARCODE_SOURCE_UPCITEMDB = "UPCitemdb"
BARCODE_SOURCE_WEB = "Web search (DuckDuckGo)"
# Books. Asked only for a 978/979 barcode, so it costs nothing on a tin of
# beans - see _barcode_src_open_library.
BARCODE_SOURCE_OPEN_LIBRARY = "Open Library (books)"
# The model the user already configured, asked what the barcode is. Last by
# default: a real database beats a recollection, this is the only source that
# costs money per scan, and the only one that can invent an answer.
BARCODE_SOURCE_AI = "AI (your configured model)"

# Every real source. The sheet on the barcode page draws one row per
# entry, so adding a name here adds a row - there is no second list
# to keep in step, and no Disabled entry since a row has a tick box.
BARCODE_SOURCES = [
    BARCODE_SOURCE_OFF_FACTS,
    BARCODE_SOURCE_UPCITEMDB,
    BARCODE_SOURCE_WEB,
    BARCODE_SOURCE_OPEN_LIBRARY,
    BARCODE_SOURCE_AI,
]

# [MODIFIED v2026.10.5] One setting row, not three config-entry options.
#
# These were options on the config entry for about an hour. That cannot
# work for a panel screen: __init__.py registers an update listener that
# calls async_reload, so writing an option would reload the whole
# integration every time a checkbox is ticked.
#
# The order and the on/off state live in app_settings under this key, as
# one JSON list. One row, one write, nothing to keep in step (RULE 21).
SETTING_BARCODE_SOURCES = "barcode_sources"

# [ADDED v2026.10.7] The locations wizard's answer sheet.
#
# Not a log of what was created - the created locations are in `items`. This
# is what the user TICKED, kept so that reopening the wizard shows their own
# answers instead of a blank form, and so that "the kitchen is actually on
# floor 2" is a correction rather than starting again.
#
# It also carries applied_paths: which path each answer turned into last
# time. Without that, a renamed room looks like a new room plus an orphan.
SETTING_HOME_PROFILE = "home_profile"

# Every source on, in the order the code used before any of this was
# configurable. An installation that never opens the sheet behaves exactly
# as it did.
# Open Library is LAST, not first, even though a book would resolve from it
# in one request. async_get_barcode_sources appends a source an older release
# never stored, so an existing installation would get it last whatever this
# list said - and a new install behaving differently from an upgraded one is
# worse than one extra hop. Moving it to 1 is what the sheet is for.
DEFAULT_BARCODE_SOURCE_ORDER = [
    BARCODE_SOURCE_OFF_FACTS,
    BARCODE_SOURCE_UPCITEMDB,
    BARCODE_SOURCE_WEB,
    BARCODE_SOURCE_OPEN_LIBRARY,
    BARCODE_SOURCE_AI,
]

# Seconds to wait for one source before moving to the next.
#
# This was 8, which is a comfortable wait but not a reliable one: the product
# databases answer a cold barcode in well over eight seconds often enough that
# the lookup was giving up on an answer that was on its way, and the scan fell
# back to guessing from the manufacturer prefix. 30 is long enough that a slow
# answer still arrives.
#
# The cost is the dead-network case: nothing above this caps the lookup, so
# three sources that never answer are 3 x 30 = 90 seconds before the user sees
# anything. That is the deliberate trade - a correct name after a wait beats a
# wrong one straight away - and it is why a source the user does not want is
# switched off in the sheet rather than left to time out. If a fourth source is
# ever added, revisit this number: st40 asserts sources x timeout <= 90.
BARCODE_SOURCE_TIMEOUT = 30

# Seconds for the WHOLE lookup, across every source.
#
# The per-source timeout alone does not bound anything: four sources at 30
# seconds is two minutes, and every source added makes it worse. This is
# checked BEFORE each source is asked, so the real ceiling is the budget plus
# one source's timeout - 90 seconds - no matter how many sources exist or how
# many the user has switched on. st40 asserts that arithmetic.
BARCODE_LOOKUP_BUDGET = 60

CONF_SYNC_GOOGLE_TASKS = "sync_google_tasks"

# Triggers
CONF_TRIGGER_INVENTORY = "trigger_inventory"
CONF_TRIGGER_SHOPPING = "trigger_shopping"
CONF_TRIGGER_COOKING = "trigger_cooking"
CONF_TRIGGER_SMART_HOME = "trigger_smart_home"
CONF_TRIGGER_STYLIST = "trigger_stylist"
# [ADDED v9.5.0] Reminder + Calendar domain triggers
CONF_TRIGGER_REMINDER = "trigger_reminder"
CONF_TRIGGER_CALENDAR = "trigger_calendar"

# Virtual Try-On (VTO) Constants
CONF_USE_STYLIST = "use_stylist"
CONF_VTO_PROVIDER = "vto_provider"
CONF_VTO_URL = "vto_url"
CONF_VTO_KEY = "vto_key"
CONF_VTO_MODEL = "vto_model"

VTO_PROVIDER_FAL = "Fal.ai (Cloud)"
VTO_PROVIDER_COMFYUI = "ComfyUI (Local)"
VTO_PROVIDER_HUGGINGFACE = "Hugging Face (Free Cloud)"
VTO_PROVIDER_FASHN = "Fashn.ai (Cloud)"

# Storage constants
DB_FILE = "home_organizer.db"
IMG_DIR = "home_organizer_images"


# ==========================================================================
# [ADDED v10.0.0] SMART HOME SECURITY MODEL
# --------------------------------------------------------------------------
# Everything below is the single source of truth for what the LLM agent is
# allowed to execute. It deliberately lives in const.py (and not inside the
# agent) so a reviewer can audit the complete set of permitted operations by
# reading one short block.
#
# The rules enforced at the call site in agents/smarthome_agent.py are:
#   1. The domain must be a key of SMARTHOME_ALLOWED_SERVICES.
#   2. The service must be a member of that domain's frozenset.
#   3. The entity_id must be one that was actually offered to the model for
#      THIS request (i.e. exposed to the conversation agent).
#   4. The requesting user must hold the "control" policy for that entity.
# The model never supplies a free-form domain/service pair that is executed
# without passing all four checks.
# ==========================================================================

# Toggle: allow the agent to start user-written scripts and scenes.
# OFF by default. A script can do anything the user wrote into it (including
# unlocking a door), so this is treated as an explicit, informed opt-in.
CONF_ALLOW_SCRIPTS = "allow_scripts"

# Base allow-list. Domains and services that are always safe for the agent.
# NOTE: "cover", "lock" and "alarm_control_panel" are intentionally absent.
SMARTHOME_ALLOWED_SERVICES = {
    "light": frozenset({"turn_on", "turn_off", "toggle"}),
    "switch": frozenset({"turn_on", "turn_off", "toggle"}),
    "fan": frozenset({"turn_on", "turn_off", "toggle"}),
    "climate": frozenset({"turn_on", "turn_off", "set_temperature", "set_hvac_mode"}),
    "media_player": frozenset({
        "turn_on", "turn_off", "media_play", "media_pause",
        "media_stop", "media_next_track", "media_previous_track",
        "volume_up", "volume_down", "volume_mute",
    }),
    "input_boolean": frozenset({"turn_on", "turn_off", "toggle"}),
}

# Opt-in extension, merged into the allow-list only when CONF_ALLOW_SCRIPTS
# is enabled. The service is fixed here and is never taken from the model:
# the model may only choose WHICH exposed script/scene to start.
SMARTHOME_SCRIPT_SERVICES = {
    "script": frozenset({"turn_on"}),
    "scene": frozenset({"turn_on"}),
}

# Services that are pinned in code regardless of what the model returns.
# Used for domains where exactly one operation makes sense.
SMARTHOME_FIXED_SERVICE = {
    "script": "turn_on",
    "scene": "turn_on",
}

# Read-only domains. Their live state is put into the prompt as context, but
# they can never be the target of a service call.
SMARTHOME_SENSOR_DOMAINS = frozenset({"sensor", "binary_sensor", "weather"})

# Sensitive domains that this integration deliberately does NOT execute.
# Requests touching these are handed to Home Assistant's own conversation
# agent, which applies the user's exposure settings and permission model.
SMARTHOME_DELEGATED_DOMAINS = frozenset({"cover", "lock"})

# Domains that are never reachable through conversation at all, by design.
# Arming/disarming an alarm panel is not a voice/chat operation here.
SMARTHOME_FORBIDDEN_DOMAINS = frozenset({"alarm_control_panel"})

# Entity id of Home Assistant's built-in (non-LLM) conversation agent. We
# always target it explicitly so that delegation can never loop back into
# this integration's own agent, even when HO-AI is the user's default.
HA_BUILTIN_CONVERSATION_AGENT = "conversation.home_assistant"