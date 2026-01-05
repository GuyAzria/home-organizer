"""Config flow for Home Organizer integration."""
from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback, HomeAssistant
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
            # If the user submitted the form, create the entry
            return self.async_create_entry(title="Home Organizer", data=user_input)
        
        # Show the setup form
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
        self.config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            # Update the entry with the new options
            return self.async_create_entry(title="", data=user_input)
        
        # Get current values to pre-fill the form
        # Try to get from options first, then fall back to initial config data, then empty string
        curr_key = self.config_entry.options.get(
            CONF_API_KEY, 
            self.config_entry.data.get(CONF_API_KEY, "")
        )
        curr_debug = self.config_entry.options.get(CONF_DEBUG, False)

        # Show the options form
        return self.async_show_form(
            step_id="init", 
            data_schema=vol.Schema({
                vol.Optional(CONF_API_KEY, default=curr_key): str,
                vol.Optional(CONF_DEBUG, default=curr_debug): bool
            })
        )
