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
# // [v9.0.0 | 2026-04-13] Purpose: Centralized read/write of per-agent state
# // that lives inside the conversation `messages` list. Each agent owns a
# // unique key (e.g. HO_COOKING_STATE, HO_SHOPPING_STATE) and CAN ONLY touch
# // its own key. This guarantees that one agent cannot corrupt another
# // agent's running state, which is what allows seamless cross-agent jumps
# // (e.g. a Reminder request while a Cooking session is mid-recipe).

import json
import logging

_LOGGER = logging.getLogger(__name__)

# Reserved state keys. Add new ones here when introducing a new stateful agent.
COOKING_STATE_KEY = "HO_COOKING_STATE"
SHOPPING_DRAFT_KEY = "HO_SHOPPING_DRAFT"


def _is_state_message(msg, key):
    return (
        msg.get("role") == "system"
        and isinstance(msg.get("content"), str)
        and msg["content"].startswith(f"{key}:")
    )


def read_state(messages, key):
    """Return the most recent state dict for `key`, or None if absent."""
    if not messages:
        return None
    for m in reversed(messages):
        if _is_state_message(m, key):
            try:
                payload = m["content"].split(f"{key}:", 1)[1].strip()
                return json.loads(payload)
            except Exception as e:
                _LOGGER.error(f"State parse error for {key}: {e}")
                return None
    return None


def write_state(messages, key, data):
    """Replace any existing `key` state with the new payload (in place)."""
    clear_state(messages, key)
    messages.append({
        "role": "system",
        "content": f"{key}:{json.dumps(data, ensure_ascii=False)}",
    })


def clear_state(messages, key):
    """Remove every system message whose content starts with `key:`."""
    if not messages:
        return
    messages[:] = [m for m in messages if not _is_state_message(m, key)]


def has_state(messages, key):
    """Cheap presence check used by the dispatcher to decide routing."""
    if not messages:
        return False
    return any(_is_state_message(m, key) for m in messages)
