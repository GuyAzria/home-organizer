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
# // [MODIFIED v1.1.0 | 2026-05-04] Purpose: Purged hardcoded Hebrew error messages. Implemented the dynamic localization system using get_strings_for_language to ensure the agent remains strictly English-coded and translates errors based on the user's UI language.
# // [ADDED v1.0.0 | 2026-05-04] Purpose: A catch-all agent for general knowledge, jokes, stories, and open-ended conversational queries that do not belong to specific household management domains.

import logging
import re
from ..ai_core.router import safe_smart_router
from ..ai_core.json_utils import safe_parse_json
from ..ai_core.localized_strings import get_strings_for_language

_LOGGER = logging.getLogger(__name__)

async def run(hass, entry, messages, target_lang, existing_locs_str,
              loc_hierarchy_map, history_text, last_user_msg, recipe_name,
              is_voice, device_id, user_id, lang_code="en"):

    # Fetch dynamic translated strings based on the user's language code
    strings = await get_strings_for_language(hass, entry, lang_code)

    prompt = f"""You are a helpful, friendly, and creative AI assistant.
Your task is to answer the user's general request (e.g., telling a joke, a story, giving general advice, or answering trivia).
Answer in {target_lang}. Keep it natural, engaging, and conversational.

CONVERSATION HISTORY:
{history_text}

LATEST USER REQUEST: "{last_user_msg}"

CRITICAL INSTRUCTION:
Return ONLY a valid JSON object. Escape all quotes properly.
Format:
{{
  "reply_message": "<your response here>"
}}
"""
    raw_res, err = await safe_smart_router(hass, entry, prompt)
    
    if err or not raw_res:
        # Use dynamic string with an English fallback
        error_msg = strings.get("general_engine_error", "❌ Sorry, I could not generate a response right now.")
        return f"{error_msg} ({err})"

    parsed = safe_parse_json(raw_res)

    # THE FALLBACK MECHANISM (in case long stories break the JSON formatting)
    if parsed and "reply_message" in parsed:
        return parsed["reply_message"]
    else:
        _LOGGER.warning("General Agent JSON parsing failed, falling back to raw text.")
        clean_raw = re.sub(r'```json\s*|```\s*', '', raw_res).strip()
        clean_raw = re.sub(r'^\{\s*"reply_message"\s*:\s*"?|"?\s*\}$', '', clean_raw).strip()
        
        # Use dynamic string with an English fallback
        parse_error_msg = strings.get("general_parse_error", "❌ Error formulating the response.")
        return clean_raw if clean_raw else parse_error_msg