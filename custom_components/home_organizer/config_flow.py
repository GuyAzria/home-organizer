"""Config flow for Home Organizer integration."""
from __future__ import annotations

import logging
from typing import Any
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, CONF_API_KEY, CONF_DEBUG

_LOGGER = logging.getLogger(__name__)

class HomeOrganizerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Home Organizer."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> config_entries.OptionsFlow:
        """Create the options flow handler."""
        return HomeOrganizerOptionsFlowHandler(config_entry)

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Handle the initial step."""
        if user_input is not None:
            return self.async_create_entry(title="Home Organizer", data=user_input)
        
        return self.async_show_form(
            step_id="user", 
            data_schema=vol.Schema({
                vol.Optional(CONF_API_KEY): str
            })
        )

class HomeOrganizerOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for Home Organizer."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        # שינוי שם המשתנה ל-_config_entry כדי למנוע התנגשות עם property מוגן
        self._config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        
        # שימוש במשתנה הפרטי _config_entry
        curr_key = self._config_entry.options.get(
            CONF_API_KEY, 
            self._config_entry.data.get(CONF_API_KEY, "")
        )
        curr_debug = self._config_entry.options.get(CONF_DEBUG, False)

        return self.async_show_form(
            step_id="init", 
            data_schema=vol.Schema({
                vol.Optional(CONF_API_KEY, default=curr_key): str,
                vol.Optional(CONF_DEBUG, default=curr_debug): bool
            })
        )
