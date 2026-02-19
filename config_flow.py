"""Config flow for Home Organizer integration ver 7.0.0 ."""
from __future__ import annotations

import logging
from typing import Any
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

# [ADDED v7.7.1 | 2026-02-19] Purpose: Imported new constants for storage and deletion
from .const import DOMAIN, CONF_API_KEY, CONF_DEBUG, CONF_USE_AI, CONF_STORAGE_METHOD, CONF_DELETE_ON_REMOVE, STORAGE_METHOD_WWW, STORAGE_METHOD_MEDIA

_LOGGER = logging.getLogger(__name__)

class HomeOrganizerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Home Organizer."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> config_entries.OptionsFlow:
        return HomeOrganizerOptionsFlowHandler(config_entry)

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Handle the initial step."""
        if user_input is not None:
            return self.async_create_entry(title="Home Organizer", data=user_input)
        
        return self.async_show_form(
            step_id="user", 
            data_schema=vol.Schema({
                vol.Optional(CONF_API_KEY): str,
                vol.Optional(CONF_USE_AI, default=True): bool,
                # [ADDED v7.7.1 | 2026-02-19] Purpose: User selection for storage location (www or media)
                vol.Required(CONF_STORAGE_METHOD, default=STORAGE_METHOD_WWW): vol.In({
                    STORAGE_METHOD_WWW: "Default (/config/www/)",
                    STORAGE_METHOD_MEDIA: "Media Folder (/media/)"
                })
            })
        )

class HomeOrganizerOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for Home Organizer."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        
        curr_key = self._config_entry.options.get(
            CONF_API_KEY, 
            self._config_entry.data.get(CONF_API_KEY, "")
        )
        curr_debug = self._config_entry.options.get(CONF_DEBUG, False)
        curr_ai = self._config_entry.options.get(CONF_USE_AI, self._config_entry.data.get(CONF_USE_AI, True))
        
        # [ADDED v7.7.1 | 2026-02-19] Purpose: Retrieve current deletion preference
        curr_delete = self._config_entry.options.get(CONF_DELETE_ON_REMOVE, False)

        return self.async_show_form(
            step_id="init", 
            data_schema=vol.Schema({
                vol.Optional(CONF_API_KEY, default=curr_key): str,
                vol.Optional(CONF_USE_AI, default=curr_ai): bool,
                vol.Optional(CONF_DEBUG, default=curr_debug): bool,
                # [ADDED v7.7.1 | 2026-02-19] Purpose: Checkbox option to delete data when integration is removed
                vol.Optional(CONF_DELETE_ON_REMOVE, default=curr_delete): bool
            })
        )
