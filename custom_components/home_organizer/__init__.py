"""The Home Organizer integration."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# רשימת הפלטפורמות (חיישנים וכו') - כרגע ריקה
PLATFORMS: list[Platform] = []

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Home Organizer component."""
    # פונקציה זו היא חובה כדי ש-HA יזהה את הרכיב
    _LOGGER.info("Home Organizer: async_setup started")
    hass.data.setdefault(DOMAIN, {})
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Home Organizer from a config entry."""
    # פונקציה זו נקראת לאחר שהמשתמש סיים את ההתקנה ב-UI
    _LOGGER.info("Home Organizer: Setting up entry %s", entry.title)

    hass.data.setdefault(DOMAIN, {})

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        # ניקוי נתונים אם צריך
        pass
    
    return unload_ok
