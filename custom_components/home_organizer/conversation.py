# -*- coding: utf-8 -*-
# // [MODIFIED v8.25.0 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O. Replaced get_db_connection with get_db_path and removed async_add_executor_job wrappers to prevent Event Loop blocking during voice interactions.
# // [MODIFIED v8.24.0 | 2026-04-12] Purpose: Captured user_input.device_id and user_input.context.user_id to pass down to the AI. This allows the Time Reminder Agent to target the specific mobile device that initiated the voice request.
# // [MODIFIED v8.23.0 | 2026-04-12] Purpose: Increased the aggressive TTS truncation limit to 2500 characters so the AI's questions are never cut off during voice playback. Updated the function call to use safe_universal_agent_loop with is_voice=True for perfect TTS routing.

import logging
import re
import uuid
import aiosqlite

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers import intent
from homeassistant.const import MATCH_ALL

from homeassistant.components import conversation

from .const import DOMAIN, CONF_PROCESSING_MODE, MODE_HYBRID
from .ai_logic import safe_universal_agent_loop
from .database import get_db_path, async_get_or_create_catalog_ids, to_alpha_id

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    """Set up the conversation agent."""
    _LOGGER.info("Home Organizer: Registering Conversation Entity...")
    try:
        agent = HomeOrganizerConversationAgent(hass, entry)
        async_add_entities([agent])
        _LOGGER.info("Home Organizer: Conversation Entity registered successfully.")
    except Exception as e:
        _LOGGER.error(f"Home Organizer: Failed to register Conversation Entity: {e}", exc_info=True)

class HomeOrganizerConversationAgent(conversation.ConversationEntity):
    """Home Organizer AI Conversation Agent."""

    _attr_has_entity_name = True

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry):
        """Initialize the agent."""
        self.hass = hass
        self.entry = entry
        self.history = {}
        self._attr_name = "HO-AI Agent"
        self._attr_unique_id = f"{entry.entry_id}_ho_conversation"

    @property
    def supported_languages(self) -> str:
        """Return MATCH_ALL so the agent appears in the dropdown for ANY language HA is set to."""
        return MATCH_ALL

    async def async_process(self, user_input) -> conversation.ConversationResult:
        """Process a sentence safely."""
        try:
            user_text = user_input.text
            lang_code = user_input.language or self.hass.config.language
            
            conv_id = getattr(user_input, "conversation_id", None)
            device_id = getattr(user_input, "device_id", None)
            user_id = user_input.context.user_id if user_input.context else None
            
            if not conv_id:
                conv_id = uuid.uuid4().hex

            if conv_id not in self.history:
                self.history[conv_id] = []

            self.history[conv_id].append({"role": "user", "content": user_text})

            existing_locs_str = ""
            loc_hierarchy_map = {}

            # [MODIFIED v8.25.0] Fetch context asynchronously
            async def async_fetch_context():
                nonlocal existing_locs_str, loc_hierarchy_map
                try:
                    db_path = get_db_path(self.hass)
                    catalog_map = await async_get_or_create_catalog_ids(self.hass)
                    
                    def local_quick_regex(s):
                        if not s: return s
                        m = re.match(r'^\[?(ORDER_MARKER_\d+)\]?[_\s]+(.*)', str(s))
                        if m: return f"[{m.group(1)}] {m.group(2)}"
                        return str(s)

                    async with aiosqlite.connect(db_path, timeout=10.0) as db:
                        async with db.execute("SELECT DISTINCT level_1, level_2, level_3 FROM items WHERE type != 'pending'") as cc:
                            loc_prompt_list = []
                            for r in await cc.fetchall():
                                l1 = local_quick_regex(r[0]) if r[0] else None
                                l2 = local_quick_regex(r[1]) if r[1] else None
                                l3 = local_quick_regex(r[2]) if r[2] else None
                                if l1:
                                    path_list = [l1]
                                    root_id_num = catalog_map.get('root', {}).get(l1)
                                    if not root_id_num: continue
                                    alpha_id = to_alpha_id(root_id_num)
                                    cat_id = alpha_id
                                    
                                    if l2:
                                        path_list.append(l2)
                                        l2_id_num = catalog_map.get(l1, {}).get(l2)
                                        if l2_id_num:
                                            cat_id = f"{alpha_id}{l2_id_num}"
                                        
                                        if l3:
                                            path_list.append(l3)
                                            l3_id_num = catalog_map.get(f"{l1}_{l2}", {}).get(l3)
                                            if l3_id_num:
                                                cat_id = f"{alpha_id}{l2_id_num}.{l3_id_num}"
                                    
                                    if cat_id not in loc_hierarchy_map:
                                        loc_hierarchy_map[cat_id] = path_list
                                        loc_prompt_list.append(f"ID '{cat_id}': {' > '.join(path_list)}")
                            
                            existing_locs_str = "\n".join(loc_prompt_list)
                except Exception as ex:
                    _LOGGER.error(f"Context fetch error in conversation agent: {ex}")

            await async_fetch_context()

            lang_map = {"en": "English", "he": "Hebrew", "it": "Italian", "es": "Spanish", "fr": "French", "ar": "Arabic"}
            target_lang = lang_map.get(lang_code, "English")

            mode = self.entry.options.get(CONF_PROCESSING_MODE) or self.entry.data.get(CONF_PROCESSING_MODE) or MODE_HYBRID

            final_reply = await safe_universal_agent_loop(
                self.hass, self.entry, mode, self.history[conv_id], target_lang, existing_locs_str, loc_hierarchy_map, is_voice=True, device_id=device_id, user_id=user_id
            )

            if len(self.history[conv_id]) > 10:
                self.history[conv_id] = self.history[conv_id][-10:]

            safe_reply = re.sub(r'(\*\*|\*|__|_|#)', '', final_reply).strip()
            
            if len(safe_reply) > 2500:
                truncated = safe_reply[:2500]
                cut_point = max(truncated.rfind('. '), truncated.rfind('\n'))
                if cut_point > 1000:
                    safe_reply = truncated[:cut_point+1]
                else:
                    safe_reply = truncated + "..."
                    
                safe_reply += " (Check the dashboard for the full report)."

            intent_response = intent.IntentResponse(language=lang_code)
            intent_response.async_set_speech(safe_reply)
            
            return conversation.ConversationResult(
                response=intent_response,
                conversation_id=conv_id
            )

        except Exception as fatal_error:
            _LOGGER.error(f"FATAL HO-AI Conversation Error: {fatal_error}", exc_info=True)
            
            error_msg = f"Home Organizer Backend Error: {str(fatal_error)}"
            intent_response = intent.IntentResponse(language=getattr(user_input, "language", "en"))
            intent_response.async_set_speech(error_msg)
            
            return conversation.ConversationResult(
                response=intent_response,
                conversation_id=getattr(user_input, "conversation_id", "error_conv")
            )