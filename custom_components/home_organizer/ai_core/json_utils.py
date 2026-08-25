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
# // [v9.0.0 | 2026-04-13] Purpose: Shared JSON utilities used by every agent.
# // Extracted from the old ai_logic.py where extract_first_json was duplicated
# // inside each run-function. Single source of truth so a fix here propagates
# // to every agent automatically.

import json
import re


def extract_first_json(s):
    """Return the first balanced top-level JSON object substring, or None."""
    if not s:
        return None
    s = s.strip()
    start = s.find("{")
    if start == -1:
        return None
    count = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            count += 1
        elif s[i] == "}":
            count -= 1
        if count == 0:
            return s[start:i + 1]
    return None


def safe_parse_json(raw_text):
    """Strip markdown fences then parse. Returns dict or None."""
    if not raw_text:
        return None
    cleaned = re.sub(r"```json\s*|```\s*", "", raw_text).strip()
    candidate = extract_first_json(cleaned) or cleaned
    try:
        return json.loads(candidate)
    except Exception:
        return None


def apply_voice_rules(prompt, is_voice, target_lang):
    """Append the voice-assistant override clause when the request is spoken."""
    if not is_voice:
        return prompt
    return prompt + (
        f"\n\n[VOICE ASSISTANT OVERRIDE]\n"
        f"CRITICAL: This request is from a Voice Assistant. Your response WILL "
        f"be spoken out loud. YOU MUST NOT output markdown tables, long lists, "
        f"symbols (*, #), or emojis. If you need to list items, use simple bullet "
        f"points (•) and translate locations to natural spoken phrases IN "
        f"{target_lang} (e.g., 'in the fridge'). Your ENTIRE response MUST be "
        f"strictly in {target_lang}. Keep your response conversational and natural."
    )
