import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from .const import DOMAIN, CONF_API_KEY, CONF_DEBUG

class HomeOrganizerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1
    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return HomeOrganizerOptionsFlowHandler(config_entry)

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="Home Organizer", data=user_input)
        return self.async_show_form(step_id="user", data_schema=vol.Schema({vol.Optional(CONF_API_KEY): str}))

class HomeOrganizerOptionsFlowHandler(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        
        curr_key = self.config_entry.options.get(CONF_API_KEY, self.config_entry.data.get(CONF_API_KEY, ""))
        curr_debug = self.config_entry.options.get(CONF_DEBUG, False)
        return self.async_show_form(step_id="init", data_schema=vol.Schema({
            vol.Optional(CONF_API_KEY, default=curr_key): str,
            vol.Optional(CONF_DEBUG, default=curr_debug): bool
        }))