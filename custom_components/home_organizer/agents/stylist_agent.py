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
# // [MODIFIED v10.0.0 | 2026-08-23] Purpose: Event-loop and session fixes
# // raised in the HACS review.
# //   1. The two `with open(result_path, "wb")` calls inside async render
# //      helpers were blocking disk writes on the event loop. Those helpers
# //      had no `hass` in scope, so rather than threading hass through only
# //      to wrap the write, they now RETURN the image bytes and the single
# //      write happens once in execute_tool via async_add_executor_job.
# //   2. All four render helpers used to create their own
# //      aiohttp.ClientSession. They now use Home Assistant's shared
# //      session via async_get_clientsession(hass), which is why `hass` is
# //      now their first argument.
# // [MODIFIED v9.3.1 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O. Replaced get_db_connection with get_db_path and removed async_add_executor_job wrappers to prevent Event Loop blocking.

import logging
import os
from functools import partial
import aiosqlite
import aiohttp

from homeassistant.helpers.aiohttp_client import async_get_clientsession

from ..database import get_db_path
from ..ai_core.router import safe_smart_router
from ..ai_core.json_utils import safe_parse_json, apply_voice_rules
from ..ai_core.localized_strings import get_strings_for_language
from ..const import (
    DOMAIN, CONF_VTO_PROVIDER, CONF_VTO_URL, CONF_VTO_KEY, 
    VTO_PROVIDER_FAL, VTO_PROVIDER_COMFYUI, 
    VTO_PROVIDER_HUGGINGFACE, VTO_PROVIDER_FASHN
)

_LOGGER = logging.getLogger(__name__)


# ==========================================
# PROMPT
# ==========================================
def get_stylist_prompt(target_lang, weather_context, wardrobe_context, history_text):
    return f"""
You are an expert Virtual Fashion Stylist operating within a Smart Home system. Your goal is to help the user choose the perfect outfit based on the current weather, the event they are attending, and the actual clothes available in their wardrobe.

CURRENT WEATHER OUTSIDE:
{weather_context}

AVAILABLE WARDROBE (Clean & In-Stock):
{wardrobe_context}

AVAILABLE TOOLS:
1. "suggest_outfit" - Args: {{"top": "string", "bottom": "string", "shoes": "string", "accessories": "string"}} - Use this to internally lock in the items you are recommending.
2. "render_and_share_vto" - Args: {{"top_garment": "string", "bottom_garment": "string", "whatsapp_message": "string"}} - Use this tool when you have decided on an outfit and want to generate a photorealistic Virtual Try-On image and send it to the user's WhatsApp. The 'whatsapp_message' should be a fun, styled message containing the locations of the clothes and a weather note.

CRITICAL RULES:
1. Translate your conversational responses and the 'whatsapp_message' into {target_lang}.
2. ONLY recommend items that are explicitly listed in the "AVAILABLE WARDROBE" section above. Do not invent clothes.
3. If the user asks "What should I wear?", analyze the weather, pick a matching top, bottom, and shoes, and immediately use the "render_and_share_vto" tool to send it to them.
4. STRICT JSON OUTPUT ONLY. Output EXACTLY ONE JSON object per turn. No conversational text outside the JSON block.

OUTPUT FORMATS:
To execute a tool: {{"intent": "tool", "tool_name": "<n>", "kwargs": {{"arg1": "val1"}}}}
To talk to the user: {{"intent": "reply", "message": "<text>"}}

CHAT HISTORY:
{history_text}

ASSISTANT JSON RESPONSE:
"""


# ==========================================
# CONTEXT FETCHING
# ==========================================
async def _async_get_weather_and_clothes(hass):
    weather_ctx = "Unknown weather."
    try:
        weather_state = hass.states.get("weather.home")
        if weather_state:
            temp = weather_state.attributes.get("temperature", "Unknown")
            cond = weather_state.state
            weather_ctx = f"Condition: {cond}, Temperature: {temp} degrees."

        db_path = get_db_path(hass)
        async with aiosqlite.connect(db_path, timeout=10.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT name, level_1, level_2, level_3, category, sub_category "
                "FROM items WHERE type='item' AND quantity > 0 "
                "AND category IN ('Clothing', 'Footwear', 'Bags', 'Accessories')"
            ) as cursor:
                rows = await cursor.fetchall()
                
        clothes_ctx = []
        for r in rows:
            loc = (
                f"{r['level_1'] or ''} > {r['level_2'] or ''} > {r['level_3'] or ''}"
                .strip(" >")
            )
            clothes_ctx.append(f"- {r['name']} ({r['sub_category']}) [Location: {loc}]")

        wardrobe_str = "\n".join(clothes_ctx) if clothes_ctx else "(No clean clothes found in inventory)"
        return weather_ctx, wardrobe_str
    except Exception:
        return "Error fetching weather", "Error fetching clothes"


# ==========================================
# VTO API IMPLEMENTATIONS
# ==========================================
async def _get_user_avatar(hass, user_id):
    filename = f"user_avatar_{user_id}.jpg" if user_id else "user_avatar.jpg"
    avatar_path = hass.config.path("www", "home_organizer_images", filename)
    
    generic_path = hass.config.path("www", "home_organizer_images", "user_avatar.jpg")

    # [MODIFIED v2026.8.26] Both existence checks are filesystem calls and were
    # running directly on the event loop. One executor hop covers both.
    def _pick_existing():
        if os.path.exists(avatar_path):
            return avatar_path
        if os.path.exists(generic_path):
            return generic_path
        return None

    return await hass.async_add_executor_job(_pick_existing)

async def _render_cloud_fal(hass, vto_url, vto_key, avatar_path, top_garment, bottom_garment):
    """[MODIFIED v10.0.0] Returns image bytes, or None.

    Previously wrote to disk with a synchronous open() inside this async
    function, blocking the event loop. The caller now owns the write and
    performs it in the executor.
    """
    headers = {
        "Authorization": f"Key {vto_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "human_image_url": avatar_path, 
        "garment_top_url": top_garment,
        "garment_bottom_url": bottom_garment
    }

    session = async_get_clientsession(hass)
    async with session.post(vto_url, json=payload, headers=headers,
                            timeout=aiohttp.ClientTimeout(total=90)) as response:
        if response.status == 200:
            data = await response.json()
            image_url = data.get("image", {}).get("url")
            if image_url:
                async with session.get(image_url) as img_resp:
                    if img_resp.status == 200:
                        return await img_resp.read()
        else:
            _LOGGER.error(f"Fal.ai Error: {await response.text()}")
    return None

async def _render_local_comfyui(hass, vto_url, avatar_path, top_garment, bottom_garment):
    """[MODIFIED v10.0.0] Uses Home Assistant's shared aiohttp session.

    NOTE: this provider queues a job and returns a prompt_id; it does not
    return the finished image, so there are no bytes to hand back. It returns
    an empty bytes object to signal "queued, nothing to write", preserving
    the previous behaviour rather than changing it in a security PR.
    """
    comfy_prompt = {
        "prompt": {
            "3": {"class_type": "LoadImage", "inputs": {"image": avatar_path}},
            "4": {"class_type": "LoadImage", "inputs": {"image": top_garment}},
            "5": {"class_type": "IDMVTON_Node", "inputs": {"human": ["3", 0], "garment": ["4", 0]}},
            "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "vto_result", "images": ["5", 0]}}
        }
    }
    
    session = async_get_clientsession(hass)
    async with session.post(f"{vto_url}/prompt", json=comfy_prompt,
                            timeout=aiohttp.ClientTimeout(total=180)) as response:
        if response.status == 200:
            data = await response.json()
            prompt_id = data.get("prompt_id")
            _LOGGER.debug("ComfyUI queued VTO job %s", prompt_id)
            return b""
        _LOGGER.error(f"ComfyUI Error: {await response.text()}")
    return None

async def _render_cloud_huggingface(hass, vto_url, vto_key, avatar_path, top_garment, bottom_garment):
    """[MODIFIED v10.0.0] Uses Home Assistant's shared aiohttp session.

    Like ComfyUI this endpoint returns an event_id rather than the image, so
    it hands back empty bytes meaning "queued, nothing to write".
    """
    headers = {"Content-Type": "application/json"}
    if vto_key:
        headers["Authorization"] = f"Bearer {vto_key}"
        
    payload = {
        "data": [
            {"path": avatar_path},
            {"path": top_garment},
            "Auto-mask", 
            True, 
            True,
            30,
            42
        ]
    }
    
    session = async_get_clientsession(hass)
    async with session.post(f"{vto_url.rstrip('/')}/call/tryon", json=payload,
                            headers=headers,
                            timeout=aiohttp.ClientTimeout(total=180)) as response:
        if response.status == 200:
            data = await response.json()
            event_id = data.get("event_id")
            _LOGGER.debug("Hugging Face queued VTO job %s", event_id)
            return b""
        _LOGGER.error(f"Hugging Face API Error: {await response.text()}")
    return None

async def _render_cloud_fashn(hass, vto_url, vto_key, avatar_path, top_garment, bottom_garment):
    """[MODIFIED v10.0.0] Returns image bytes, or None.

    Same fix as _render_cloud_fal: the synchronous open() that ran on the
    event loop is gone; the caller writes the bytes in the executor.
    """
    headers = {
        "Authorization": f"Bearer {vto_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model_image": avatar_path,
        "garment_image": top_garment,
        "category": "tops"
    }
    
    endpoint = vto_url if vto_url and "api" in vto_url else "https://api.fashn.ai/v1/run"
    
    session = async_get_clientsession(hass)
    async with session.post(endpoint, json=payload, headers=headers,
                            timeout=aiohttp.ClientTimeout(total=90)) as response:
        if response.status == 200 or response.status == 201:
            data = await response.json()
            img_url = data.get("image_url") or (data.get("images") and data["images"][0])
            if img_url:
                async with session.get(img_url) as img_resp:
                    if img_resp.status == 200:
                        return await img_resp.read()
        else:
            _LOGGER.error(f"Fashn.ai Error: {await response.text()}")
    return None


# ==========================================
# TOOLS (stylist-only)
# ==========================================
async def execute_tool(hass, tool_name, kwargs, user_id):
    _LOGGER.info(f"Stylist tool: {tool_name} args={kwargs} user={user_id}")

    if tool_name == "suggest_outfit":
        top = kwargs.get("top", "")
        bottom = kwargs.get("bottom", "")
        shoes = kwargs.get("shoes", "")
        return (
            f"Outfit suggestion locked internally: Top: {top}, Bottom: {bottom}, "
            f"Shoes: {shoes}. Now use render_and_share_vto to send it to the user."
        )

    elif tool_name == "render_and_share_vto":
        top_garment = kwargs.get("top_garment", "")
        bottom_garment = kwargs.get("bottom_garment", "")
        whatsapp_message = kwargs.get("whatsapp_message", "Here is your outfit!")

        try:
            entries = hass.config_entries.async_entries(DOMAIN)
            if not entries:
                return "Error: Home Organizer integration not configured."
            entry = entries[0]
            
            vto_provider = entry.options.get(CONF_VTO_PROVIDER, entry.data.get(CONF_VTO_PROVIDER, VTO_PROVIDER_FAL))
            vto_url = entry.options.get(CONF_VTO_URL, entry.data.get(CONF_VTO_URL, ""))
            vto_key = entry.options.get(CONF_VTO_KEY, entry.data.get(CONF_VTO_KEY, ""))

            www_dir = hass.config.path("www", "home_organizer_images")
            # [MODIFIED v10.0.0] exist_ok must be a keyword: the second
            # positional parameter of os.makedirs is `mode`, not `exist_ok`.
            await hass.async_add_executor_job(
                partial(os.makedirs, www_dir, exist_ok=True)
            )
            vto_result_path = os.path.join(www_dir, "vto_result.jpg")
            
            avatar_path = await _get_user_avatar(hass, user_id)
            if not avatar_path:
                return "Error: User avatar not found. Please upload a base image in the UI first."

            # [MODIFIED v10.0.0] The render helpers now return image bytes
            # (or b"" when the provider only queues a job) instead of writing
            # to disk themselves. `image_bytes is None` means failure.
            image_bytes = None
            if vto_provider == VTO_PROVIDER_COMFYUI and vto_url:
                image_bytes = await _render_local_comfyui(hass, vto_url, avatar_path, top_garment, bottom_garment)
            elif vto_provider == VTO_PROVIDER_FAL and vto_url and vto_key:
                image_bytes = await _render_cloud_fal(hass, vto_url, vto_key, avatar_path, top_garment, bottom_garment)
            elif vto_provider == VTO_PROVIDER_HUGGINGFACE and vto_url:
                image_bytes = await _render_cloud_huggingface(hass, vto_url, vto_key, avatar_path, top_garment, bottom_garment)
            elif vto_provider == VTO_PROVIDER_FASHN and vto_key:
                image_bytes = await _render_cloud_fashn(hass, vto_url, vto_key, avatar_path, top_garment, bottom_garment)
            else:
                return f"Error: Invalid VTO configuration for {vto_provider}."

            if image_bytes is None:
                return "Error: VTO Image Generation failed."

            # The single disk write for the whole VTO flow, off the loop.
            if image_bytes:
                def _write_result():
                    with open(vto_result_path, "wb") as f:
                        f.write(image_bytes)

                await hass.async_add_executor_job(_write_result)

            service_data = {
                "message": whatsapp_message,
                "data": {"image": "/local/home_organizer_images/vto_result.jpg"},
            }
            await hass.services.async_call(
                "notify", "whatsapp", service_data, blocking=False
            )
            return (
                f"Successfully rendered VTO image for '{top_garment}' & "
                f"'{bottom_garment}' and sent it to WhatsApp with message: "
                f"{whatsapp_message}"
            )
        except Exception as e:
            _LOGGER.error(f"Failed to render/share VTO: {e}")
            try:
                await hass.services.async_call(
                    "notify", "notify", {"message": whatsapp_message}, blocking=False
                )
                return f"Sent text to fallback notifier. Image generation/WhatsApp failed: {e}"
            except Exception:
                return f"Error executing VTO share: {e}"

    return f"Error: Unknown stylist tool '{tool_name}'."


# ==========================================
# RUN LOOP
# ==========================================
async def run(hass, entry, messages, target_lang, existing_locs_str,
              loc_hierarchy_map, history_text, last_user_msg, recipe_name,
              is_voice, device_id, user_id, lang_code="en"):

    strings = await get_strings_for_language(hass, entry, lang_code)
    weather_str, wardrobe_str = await _async_get_weather_and_clothes(hass)
    prompt = get_stylist_prompt(target_lang, weather_str, wardrobe_str, history_text)

    for _ in range(10):
        raw_res, err = await safe_smart_router(
            hass, entry, apply_voice_rules(prompt, is_voice, target_lang)
        )
        if err or not raw_res:
            return f"❌ {strings['ai_connection_error']} ({err})"

        parsed = safe_parse_json(raw_res)
        if not parsed:
            return strings["invalid_format"]

        intent = parsed.get("intent")

        if intent == "tool":
            tool_name = parsed.get("tool_name")
            kwargs = parsed.get("kwargs", {})
            tool_result = await execute_tool(hass, tool_name, kwargs, user_id)
            messages.append({"role": "system", "content": f"System Tool Output: {tool_result}"})

            history_text_new = ""
            for m in messages:
                history_text_new += f"{m['role'].upper()}: {m['content']}\n"

            weather_str, wardrobe_str = await _async_get_weather_and_clothes(hass)
            prompt = get_stylist_prompt(
                target_lang, weather_str, wardrobe_str, history_text_new
            )

        elif intent == "reply":
            reply_msg = parsed.get("message", "")
            messages.append({"role": "assistant", "content": reply_msg})
            return reply_msg

        else:
            return strings["fallback_unsure"]

    return strings["fallback_stuck"]