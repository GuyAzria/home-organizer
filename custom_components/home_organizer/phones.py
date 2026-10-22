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
# [ADDED v2026.10.21 | 2026-10-21] Purpose: the household's phones, for the
#   HO_Mind_AI settings screen.
#
#   A reminder reaches a phone through its Home Assistant DEVICE id, which a
#   user could only find by opening the device page in a desktop browser and
#   copying 32 characters out of the address bar - impossible on the phone
#   the app runs on. GET /api/home_organizer/phones lists the devices the
#   Home Assistant companion app registered, with their owner, so the app can
#   fill the id in with one tap - for its own user and for everyone else in
#   the house a reminder may be aimed at ("remind Yulia to collect the kid").
#   Same day: the owner comes from public state only - the device's
#   device_tracker in the entity registry, and the person entity that lists
#   it - instead of reading user_id out of the mobile_app config entry.

"""Read-only list of the household's companion-app devices.

WHAT IS LISTED. Every device registered by the official Home Assistant
companion app ("mobile_app"): phones, and tablets too - the app registers a
tablet exactly like a phone and gives no field that tells them apart, and a
tablet with the app receives a reminder just as well.

WHO SEES WHAT. Every authenticated Home Assistant user sees every device: a
reminder from one member of the house to another needs the other's phone,
and that is the point of the list. It returns names and ids only - nothing
that sends anything. Sending a notification still goes through the
authenticated conversation request and the reminder agent's own lookup, so
this list grants no new ability. A request with no authenticated user is
refused (fail closed).

PUBLIC INTERFACES ONLY. Which device belongs to whom is read from the
device registry (the device's own config entry DOMAIN), the entity registry
(the device's device_tracker entity) and the person entities' state
(device_trackers and user_id attributes) - never from another integration's
private config entry data. Whether a reminder can actually reach a device is
decided by the SAME function the reminder agent uses, so the list never
offers a device that a reminder would then fail to find.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from aiohttp import web
from homeassistant.components.http import KEY_HASS_USER, HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .agents.reminder_agent import _resolve_notify_service_for_device

MOBILE_APP = "mobile_app"


def build_phone_list(
    devices: Iterable[Any],
    is_companion: Callable[[Any], bool],
    owner_for: Callable[[str], tuple[str, str | None]],
    notify_for: Callable[[str], str | None],
    me_user_id: str,
) -> list[dict[str, Any]]:
    """The devices, as plain dicts. No Home Assistant objects in or out.

    devices       iterable of objects with id, name_by_user, name, model and
                  manufacturer
    is_companion  device -> True when the companion app registered it
    owner_for     device_id -> (owner display name, owner user id); ("", None)
                  when no person claims the device
    notify_for    device_id -> notify service slug, or None
    me_user_id    the id of the user asking

    Sorted: the asker's own devices first, then by owner, then by name.
    """
    phones = []
    for device in devices:
        if not is_companion(device):
            continue
        owner, owner_id = owner_for(device.id)
        notify = notify_for(device.id)
        phones.append({
            "device_id": device.id,
            # The name the user gave the device in Home Assistant, else the
            # name the companion app reported - usually the phone's own name.
            "name": device.name_by_user or device.name or "",
            "model": device.model or "",
            "manufacturer": device.manufacturer or "",
            "owner": owner or "",
            "is_me": owner_id is not None and owner_id == me_user_id,
            "can_notify": notify is not None,
        })
    phones.sort(key=lambda p: (not p["is_me"], p["owner"].lower(), p["name"].lower()))
    return phones


class HOPhonesView(HomeAssistantView):
    """GET /api/home_organizer/phones -> {"phones": [...]}."""

    url = "/api/home_organizer/phones"
    name = "api:home_organizer:phones"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request) -> web.Response:
        user = request.get(KEY_HASS_USER)
        if user is None:
            # requires_auth has already rejected anonymous requests; this is
            # the second lock, so the list never leaves without a user.
            return self.json({"status": "error", "message": "Not authorised"},
                             status_code=401)

        hass = self.hass
        dev_reg = dr.async_get(hass)
        ent_reg = er.async_get(hass)

        # device_tracker entity_id -> (person name, person's user id), from
        # the person entities' public state.
        tracker_owner: dict[str, tuple[str, str | None]] = {}
        for state in hass.states.async_all("person"):
            owner = (state.attributes.get("friendly_name") or state.name,
                     state.attributes.get("user_id"))
            for tracker in state.attributes.get("device_trackers") or []:
                tracker_owner.setdefault(tracker, owner)

        def is_companion(device: dr.DeviceEntry) -> bool:
            for entry_id in device.config_entries:
                entry = hass.config_entries.async_get_entry(entry_id)
                if entry is not None and entry.domain == MOBILE_APP:
                    return True
            return False

        def owner_for(device_id: str) -> tuple[str, str | None]:
            for ent in er.async_entries_for_device(ent_reg, device_id):
                if ent.domain == "device_tracker" and ent.entity_id in tracker_owner:
                    return tracker_owner[ent.entity_id]
            return ("", None)

        phones = build_phone_list(
            list(dev_reg.devices.values()),
            is_companion,
            owner_for,
            lambda device_id: _resolve_notify_service_for_device(hass, device_id),
            user.id,
        )
        return self.json({"status": "ok", "phones": phones})
