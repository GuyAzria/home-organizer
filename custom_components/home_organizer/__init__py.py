"""The Home Organizer integration."""
from __future__ import annotations

import logging

# הדפסה קריטית שתופיע בלוגים מיד עם טעינת המערכת
# חפש בלוגים את המחרוזת: "*** HOME ORGANIZER FILE LOADED ***"
import sys
_LOGGER = logging.getLogger(__name__)
_LOGGER.warning("*** HOME ORGANIZER FILE LOADED - SYSTEM IS READING THE FILE ***")

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN

PLATFORMS: list[Platform] = []

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Home Organizer component."""
    _LOGGER.warning("Home Organizer: async_setup has been called!")
    hass.data.setdefault(DOMAIN, {})
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Home Organizer from a config entry."""
    _LOGGER.info("Home Organizer: Setting up entry %s", entry.title)

    hass.data.setdefault(DOMAIN, {})

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        pass
    
    return unload_ok
