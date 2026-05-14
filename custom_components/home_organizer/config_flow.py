# -*- coding: utf-8 -*-
# Home Organizer Ultimate
# // [MODIFIED v9.5.0 | 2026-04-18] Purpose: Added CONF_TRIGGER_REMINDER and
# // CONF_TRIGGER_CALENDAR fields to BOTH the initial config flow and the
# // options flow triggers step. Cleaned up every hardcoded non-English
# // default in this file so ALL defaults are English-only; the trigger_manager
# // now handles per-UI-language translation, and users can still override
# // each trigger string from the Options UI in any language they want.
# // [MODIFIED v9.3.0 | 2026-04-16] Purpose: Added Hugging Face and Fashn.ai
# // into the Stylist VTO provider drop-down list.
# // [MODIFIED v8.22.1 | 2026-04-02] Purpose: Fixed AttributeError in
# // OptionsFlowHandler by renaming self.config_entry to self._config_entry.

import logging
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
import homeassistant.helpers.config_validation as cv

from .const import (
    DOMAIN, CONF_API_KEY, CONF_DEBUG, CONF_USE_AI,
    CONF_STORAGE_METHOD, CONF_DELETE_ON_REMOVE,
    STORAGE_METHOD_WWW, STORAGE_METHOD_MEDIA,
    CONF_AI_PROVIDER, CONF_PROCESSING_MODE,
    MODE_LOCAL_ONLY, MODE_CLOUD_ONLY, MODE_HYBRID,
    PROVIDER_OPENAI, PROVIDER_GEMINI, PROVIDER_CLAUDE,
    CONF_SYNC_GOOGLE_TASKS,
    CONF_TRIGGER_INVENTORY, CONF_TRIGGER_SHOPPING, CONF_TRIGGER_COOKING,
    CONF_TRIGGER_SMART_HOME, CONF_TRIGGER_STYLIST,
    CONF_TRIGGER_REMINDER, CONF_TRIGGER_CALENDAR,
    CONF_USE_STYLIST, CONF_VTO_PROVIDER, CONF_VTO_URL, CONF_VTO_KEY, CONF_VTO_MODEL,
    VTO_PROVIDER_FAL, VTO_PROVIDER_COMFYUI,
    VTO_PROVIDER_HUGGINGFACE, VTO_PROVIDER_FASHN,
)

_LOGGER = logging.getLogger(__name__)


# English-only default trigger strings. The trigger_manager translates these
# into the UI language on first use and the user can override each one via
# Settings -> Home Organizer -> Options in any language they want.
DEFAULT_TRIGGER_INVENTORY = "ho, inventory"
DEFAULT_TRIGGER_SHOPPING = "cart, list, shopping, buy"
DEFAULT_TRIGGER_COOKING = "chef, cook, recipe"
DEFAULT_TRIGGER_SMART_HOME = "homie, smart home, home"
DEFAULT_TRIGGER_STYLIST = "stylist, clothes, outfit, fashion"
DEFAULT_TRIGGER_REMINDER = "remind, reminder, timer, alert"
DEFAULT_TRIGGER_CALENDAR = "calendar, schedule, meeting, appointment"


class HomeOrganizerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self):
        self.data = {}

    async def async_step_user(self, user_input=None):
        """Step 1: Initial Setup (Mode, Provider, Stylist Toggle)"""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            self.data.update(user_input)
            return await self.async_step_api_keys()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(
                    CONF_PROCESSING_MODE, 
                    default=MODE_HYBRID,
                    description="Select AI Processing Mode. Hybrid uses Local AI for text and Cloud AI for image processing."
                ): vol.In([MODE_LOCAL_ONLY, MODE_CLOUD_ONLY, MODE_HYBRID]),
                vol.Required(
                    CONF_AI_PROVIDER, 
                    default=PROVIDER_GEMINI,
                    description="Select Cloud AI Provider (Only used if mode is Cloud/Hybrid). Gemini offers a generous free tier."
                ): vol.In([PROVIDER_GEMINI, PROVIDER_OPENAI, PROVIDER_CLAUDE]),
                vol.Optional(
                    CONF_USE_STYLIST, 
                    default=False,
                    description="Enable Virtual Try-On Stylist features (Requires additional setup)."
                ): bool,
                vol.Optional(
                    CONF_STORAGE_METHOD, 
                    default=STORAGE_METHOD_WWW,
                    description="Choose where to save uploaded images. 'www' is highly recommended for compatibility."
                ): vol.In([STORAGE_METHOD_WWW, STORAGE_METHOD_MEDIA]),
            })
        )

    async def async_step_api_keys(self, user_input=None):
        """Step 2: API Keys (Dynamically changes based on Step 1)"""
        if user_input is not None:
            self.data.update(user_input)
            if self.data.get(CONF_USE_STYLIST):
                return await self.async_step_stylist()
            return await self.async_step_triggers()

        schema = {}
        mode = self.data.get(CONF_PROCESSING_MODE)
        provider = self.data.get(CONF_AI_PROVIDER)

        if mode in [MODE_CLOUD_ONLY, MODE_HYBRID]:
            schema[vol.Optional(
                CONF_API_KEY, 
                default="",
                description="Cloud API Key. For Gemini: Get it free at aistudio.google.com. For OpenAI: platform.openai.com."
            )] = str
            schema[vol.Optional(
                "cloud_model", 
                default="",
                description="Exact Cloud Model Name. Gemini: 'gemini-1.5-flash-latest'. OpenAI: 'gpt-4o'."
            )] = str

            if provider == PROVIDER_CLAUDE:
                schema[vol.Optional(
                    "custom_cloud_url", 
                    default="",
                    description="Custom Cloud Endpoint URL (Optional, typically used for enterprise proxies)."
                )] = str

        if mode in [MODE_LOCAL_ONLY, MODE_HYBRID]:
            schema[vol.Optional(
                "local_api_url", 
                default="http://192.168.1.100:1234/v1",
                description="Local AI URL. Ollama: http://<IP>:11434/v1 | LM Studio: http://<IP>:1234/v1. MUST end in /v1"
            )] = str
            schema[vol.Optional(
                "local_api_key", 
                default="",
                description="Local API Key. Local servers don't require keys, but DO NOT leave this blank. Type 'ollama' or 'local'."
            )] = str
            schema[vol.Optional(
                "local_model", 
                default="gpt-oss:120b",
                description="Exact Local Model Name. Ollama: Run 'ollama list' and copy the name exactly (e.g., llama3:8b)."
            )] = str

        if not schema:
            if self.data.get(CONF_USE_STYLIST):
                return await self.async_step_stylist()
            return await self.async_step_triggers()

        return self.async_show_form(step_id="api_keys", data_schema=vol.Schema(schema))

    async def async_step_stylist(self, user_input=None):
        """Step 3: Stylist/VTO Config"""
        if user_input is not None:
            self.data.update(user_input)
            return await self.async_step_triggers()

        return self.async_show_form(
            step_id="stylist",
            data_schema=vol.Schema({
                vol.Required(
                    CONF_VTO_PROVIDER, 
                    default=VTO_PROVIDER_FAL,
                    description="Select the Virtual Try-On image generation provider."
                ): vol.In([
                    VTO_PROVIDER_FAL,
                    VTO_PROVIDER_COMFYUI,
                    VTO_PROVIDER_HUGGINGFACE,
                    VTO_PROVIDER_FASHN,
                ]),
                vol.Optional(
                    CONF_VTO_URL, 
                    default="",
                    description="VTO Endpoint URL (Required for ComfyUI local instances)."
                ): str,
                vol.Optional(
                    CONF_VTO_KEY, 
                    default="",
                    description="VTO API Key (Required for Fal.ai or Fashn.ai cloud providers)."
                ): str,
                vol.Optional(
                    CONF_VTO_MODEL, 
                    default="",
                    description="VTO Model identifier (if using a custom workflow)."
                ): str,
            })
        )

    async def async_step_triggers(self, user_input=None):
        """Step 4: Trigger Words & Final Options"""
        if user_input is not None:
            self.data.update(user_input)
            return self.async_create_entry(title="Home Organizer", data=self.data)

        return self.async_show_form(
            step_id="triggers",
            data_schema=vol.Schema({
                vol.Optional(
                    CONF_TRIGGER_INVENTORY,  
                    default=DEFAULT_TRIGGER_INVENTORY,
                    description="Comma-separated words to trigger Inventory management."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_SHOPPING,   
                    default=DEFAULT_TRIGGER_SHOPPING,
                    description="Comma-separated words to trigger the Shopping List."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_COOKING,    
                    default=DEFAULT_TRIGGER_COOKING,
                    description="Comma-separated words to trigger Recipe and Cooking mode."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_SMART_HOME, 
                    default=DEFAULT_TRIGGER_SMART_HOME,
                    description="Comma-separated words to trigger Smart Home control."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_STYLIST,    
                    default=DEFAULT_TRIGGER_STYLIST,
                    description="Comma-separated words to trigger the AI Stylist."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_REMINDER,   
                    default=DEFAULT_TRIGGER_REMINDER,
                    description="Comma-separated words to trigger Timers and Reminders."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_CALENDAR,   
                    default=DEFAULT_TRIGGER_CALENDAR,
                    description="Comma-separated words to trigger Calendar events."
                ): str,
                vol.Optional(
                    CONF_DEBUG,            
                    default=False,
                    description="Enable detailed debugging logs in Home Assistant console."
                ): bool,
                vol.Optional(
                    CONF_DELETE_ON_REMOVE, 
                    default=False,
                    description="CAUTION: If enabled, removing this integration will permanently wipe the database and images."
                ): bool,
            })
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return HomeOrganizerOptionsFlowHandler(config_entry)


class HomeOrganizerOptionsFlowHandler(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self._config_entry = config_entry
        self.data = dict(config_entry.options)
        if not self.data:
            self.data = dict(config_entry.data)

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self.data.update(user_input)
            return await self.async_step_api_keys()

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(
                    CONF_PROCESSING_MODE,
                    default=self.data.get(CONF_PROCESSING_MODE, MODE_HYBRID),
                    description="Select AI Mode. Hybrid uses Local AI for text and Cloud AI for heavy image processing."
                ): vol.In([MODE_LOCAL_ONLY, MODE_CLOUD_ONLY, MODE_HYBRID]),
                vol.Required(
                    CONF_AI_PROVIDER,
                    default=self.data.get(CONF_AI_PROVIDER, PROVIDER_GEMINI),
                    description="Select Cloud AI Provider (Only used if mode is Cloud/Hybrid)."
                ): vol.In([PROVIDER_GEMINI, PROVIDER_OPENAI, PROVIDER_CLAUDE]),
                vol.Optional(
                    CONF_USE_STYLIST,
                    default=self.data.get(CONF_USE_STYLIST, False),
                    description="Enable Virtual Try-On Stylist features."
                ): bool,
            })
        )

    async def async_step_api_keys(self, user_input=None):
        if user_input is not None:
            self.data.update(user_input)
            if self.data.get(CONF_USE_STYLIST):
                return await self.async_step_stylist()
            return await self.async_step_triggers()

        schema = {}
        mode = self.data.get(CONF_PROCESSING_MODE, MODE_HYBRID)
        provider = self.data.get(CONF_AI_PROVIDER, PROVIDER_GEMINI)

        if mode in [MODE_CLOUD_ONLY, MODE_HYBRID]:
            schema[vol.Optional(
                CONF_API_KEY,
                default=self.data.get(CONF_API_KEY, ""),
                description="Cloud API Key. For Gemini: Get it free at aistudio.google.com. For OpenAI: platform.openai.com."
            )] = str
            schema[vol.Optional(
                "cloud_model",
                default=self.data.get("cloud_model", ""),
                description="Exact Cloud Model Name. Gemini: 'gemini-1.5-flash-latest'. OpenAI: 'gpt-4o'."
            )] = str

            if provider == PROVIDER_CLAUDE:
                schema[vol.Optional(
                    "custom_cloud_url",
                    default=self.data.get("custom_cloud_url", ""),
                    description="Custom Cloud Endpoint URL (Optional, typically used for enterprise proxies)."
                )] = str

        if mode in [MODE_LOCAL_ONLY, MODE_HYBRID]:
            schema[vol.Optional(
                "local_api_url",
                default=self.data.get("local_api_url", "http://192.168.1.100:11434/v1"),
                description="Local AI URL. Ollama: http://<IP>:11434/v1 | LM Studio: http://<IP>:1234/v1. MUST end in /v1"
            )] = str
            schema[vol.Optional(
                "local_api_key",
                default=self.data.get("local_api_key", ""),
                description="Local API Key. Local servers don't require keys, but DO NOT leave this blank. Type 'ollama' or 'local'."
            )] = str
            schema[vol.Optional(
                "local_model",
                default=self.data.get("local_model", "gpt-oss:120b"),
                description="Exact Local Model Name. Ollama: Run 'ollama list' and copy the name exactly (e.g., llama3:8b)."
            )] = str

        if not schema:
            if self.data.get(CONF_USE_STYLIST):
                return await self.async_step_stylist()
            return await self.async_step_triggers()

        return self.async_show_form(step_id="api_keys", data_schema=vol.Schema(schema))

    async def async_step_stylist(self, user_input=None):
        if user_input is not None:
            self.data.update(user_input)
            return await self.async_step_triggers()

        return self.async_show_form(
            step_id="stylist",
            data_schema=vol.Schema({
                vol.Required(
                    CONF_VTO_PROVIDER,
                    default=self.data.get(CONF_VTO_PROVIDER, VTO_PROVIDER_FAL),
                    description="Select the Virtual Try-On image generation provider."
                ): vol.In([
                    VTO_PROVIDER_FAL,
                    VTO_PROVIDER_COMFYUI,
                    VTO_PROVIDER_HUGGINGFACE,
                    VTO_PROVIDER_FASHN,
                ]),
                vol.Optional(
                    CONF_VTO_URL,
                    default=self.data.get(CONF_VTO_URL, ""),
                    description="VTO Endpoint URL (Required for ComfyUI local instances)."
                ): str,
                vol.Optional(
                    CONF_VTO_KEY,
                    default=self.data.get(CONF_VTO_KEY, ""),
                    description="VTO API Key (Required for Fal.ai or Fashn.ai cloud providers)."
                ): str,
                vol.Optional(
                    CONF_VTO_MODEL,
                    default=self.data.get(CONF_VTO_MODEL, ""),
                    description="VTO Model identifier (if using a custom workflow)."
                ): str,
            })
        )

    async def async_step_triggers(self, user_input=None):
        if user_input is not None:
            self.data.update(user_input)
            return self.async_create_entry(title="", data=self.data)

        return self.async_show_form(
            step_id="triggers",
            data_schema=vol.Schema({
                vol.Optional(
                    CONF_TRIGGER_INVENTORY,
                    default=self.data.get(CONF_TRIGGER_INVENTORY, DEFAULT_TRIGGER_INVENTORY),
                    description="Comma-separated words to trigger Inventory management."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_SHOPPING,
                    default=self.data.get(CONF_TRIGGER_SHOPPING, DEFAULT_TRIGGER_SHOPPING),
                    description="Comma-separated words to trigger the Shopping List."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_COOKING,
                    default=self.data.get(CONF_TRIGGER_COOKING, DEFAULT_TRIGGER_COOKING),
                    description="Comma-separated words to trigger Recipe and Cooking mode."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_SMART_HOME,
                    default=self.data.get(CONF_TRIGGER_SMART_HOME, DEFAULT_TRIGGER_SMART_HOME),
                    description="Comma-separated words to trigger Smart Home control."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_STYLIST,
                    default=self.data.get(CONF_TRIGGER_STYLIST, DEFAULT_TRIGGER_STYLIST),
                    description="Comma-separated words to trigger the AI Stylist."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_REMINDER,
                    default=self.data.get(CONF_TRIGGER_REMINDER, DEFAULT_TRIGGER_REMINDER),
                    description="Comma-separated words to trigger Timers and Reminders."
                ): str,
                vol.Optional(
                    CONF_TRIGGER_CALENDAR,
                    default=self.data.get(CONF_TRIGGER_CALENDAR, DEFAULT_TRIGGER_CALENDAR),
                    description="Comma-separated words to trigger Calendar events."
                ): str,
                vol.Optional(
                    CONF_DEBUG,
                    default=self.data.get(CONF_DEBUG, False),
                    description="Enable detailed debugging logs in Home Assistant console."
                ): bool,
                vol.Optional(
                    CONF_DELETE_ON_REMOVE,
                    default=self.data.get(CONF_DELETE_ON_REMOVE, False),
                    description="CAUTION: If enabled, removing this integration will permanently wipe the database and images."
                ): bool,
            })
        )