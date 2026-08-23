# -*- coding: utf-8 -*-
"""Constants for the Home Organizer integration."""

DOMAIN = "home_organizer"
# // [MODIFIED v10.0.0 | 2026-08-23] Purpose: SECURITY HARDENING (HACS review).
# // Introduced an explicit, code-side allow-list for every Home Assistant
# // service the LLM agent is permitted to call, plus CONF_ALLOW_SCRIPTS so
# // script/scene execution is opt-in and OFF by default (secure by default).
# // Sensitive domains (lock, cover, alarm_control_panel) are NOT in the
# // allow-list at all: locks and covers are delegated to Home Assistant's own
# // built-in conversation agent, and alarm panels are not voice-reachable.
# // [MODIFIED v9.5.0 | 2026-04-18] Purpose: Added CONF_TRIGGER_REMINDER and
# // CONF_TRIGGER_CALENDAR so that Reminder + Calendar domains are fully
# // user-configurable from the config flow, matching the pattern of the
# // existing inventory/shopping/cooking/smart_home/stylist triggers.
# // [MODIFIED v9.3.0 | 2026-04-16] Purpose: Added Hugging Face and Fashn.ai
# // to the Stylist VTO provider constants.
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