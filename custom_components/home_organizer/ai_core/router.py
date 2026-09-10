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
# // [MODIFIED v10.0.0 | 2026-08-23] Purpose: SECURITY HARDENING (HACS review).
# // The Gemini API key no longer travels in the request URL; it is sent in
# // the x-goog-api-key header instead. In addition every error string that
# // leaves this module is scrubbed of the key. That second part matters
# // because the aiohttp exception path here did not only reach
# // home-assistant.log: the string is returned up the stack and rendered to
# // the user inside the chat panel via smarthome_engine_error, so the key
# // could appear on screen as well.
# // [v9.0.0 | 2026-04-13] Purpose: Provider-level AI router. Talks to Gemini,
# // OpenAI/Local, and Claude. Implements Local/Cloud/Hybrid selection logic
# // and the safe-wrapper that falls back to local AI when the cloud fails in
# // hybrid mode. Extracted from the old ai_logic.py with ZERO behavior changes.

import asyncio
import logging
import re
import aiohttp
from aiohttp import ClientTimeout

from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.config_entries import ConfigEntry

from ..const import (
    CONF_PROCESSING_MODE, MODE_LOCAL_ONLY, MODE_CLOUD_ONLY, MODE_HYBRID,
    PROVIDER_GEMINI, PROVIDER_OPENAI, PROVIDER_CLAUDE,
)

_LOGGER = logging.getLogger(__name__)


# ==========================================
# HYBRID FALLBACK MOCK ENTRY
# ==========================================
class FallbackMockEntry:
    """A throwaway ConfigEntry-like object used to force LOCAL_ONLY routing
    after a cloud failure in hybrid mode, without mutating the real entry."""

    def __init__(self, original):
        self.entry_id = getattr(original, "entry_id", "fallback_entry")
        self.data = dict(original.data)
        self.options = dict(original.options)
        self.options[CONF_PROCESSING_MODE] = MODE_LOCAL_ONLY
        self.data[CONF_PROCESSING_MODE] = MODE_LOCAL_ONLY


# ==========================================
# [ADDED v10.0.0] SECRET SCRUBBING
# ==========================================
def _scrub_secrets(text, *secrets):
    """Remove credentials from any string before it is logged or returned.

    aiohttp exceptions stringify with the full request URL, and several
    providers echo request details back in their error bodies. Every error
    string produced by this module passes through here so a key can never
    reach home-assistant.log or the chat panel.
    """
    if not text:
        return text
    cleaned = str(text)
    for secret in secrets:
        if secret and len(str(secret)) >= 8:
            cleaned = cleaned.replace(str(secret), "***REDACTED***")
    # Belt and braces: strip any remaining key=... query parameter.
    cleaned = re.sub(r"(?i)([?&](?:key|api_key|access_token)=)[^&\s\"']+",
                     r"\1***REDACTED***", cleaned)
    return cleaned


# ==========================================
# RAW PROVIDER CALL
# ==========================================
async def async_universal_ai_router(hass, provider, base_url, api_key, model,
                                    prompt, image_data=None,
                                    mime_type="image/jpeg"):
    """Single low-level call to whichever AI provider is selected."""
    session = async_get_clientsession(hass)
    try:
        # [MODIFIED v2026.9.8] image_data may now be a list.
        #
        # A long till receipt does not fit in one photograph, so the user is
        # asked for further pages and every page is sent in ONE request. The
        # model then sees all of them together, which is what lets it read the
        # header from page 1, take the lines from every page, and recognise
        # the deliberate overlap between consecutive photos as the same lines
        # rather than new ones.
        #
        # A bare string is still accepted so every existing caller - barcode
        # scans, garment photos - keeps working untouched.
        raw_images = []
        if isinstance(image_data, (list, tuple)):
            raw_images = [x for x in image_data if x]
        elif image_data:
            raw_images = [image_data]

        images = []
        for raw in raw_images:
            item_mime = mime_type
            payload_b64 = raw
            if isinstance(raw, str) and "base64," in raw:
                item_mime = raw.split(";")[0].split(":")[1]
                payload_b64 = raw.split("base64,")[1]
            images.append((item_mime, payload_b64))

        # Every provider branch below iterates `images`, so no single-image
        # variable is needed any more.

        if provider == PROVIDER_GEMINI:
            # [MODIFIED v10.0.0] The key used to be appended to the URL as
            # ?key=... Any aiohttp error stringifies with the full URL, which
            # leaked the key into the log AND into the chat reply. It now
            # travels in a header, so no exception or log line can contain it.
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent"
            )
            headers = {
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            }
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            # Pages are inserted in order before the prompt text, so page 1 -
            # the one carrying the header - is the first thing the model sees.
            for idx, (img_mime, img_b64) in enumerate(images):
                payload["contents"][0]["parts"].insert(
                    idx,
                    {"inline_data": {"mime_type": img_mime, "data": img_b64}},
                )
            async with session.post(url, headers=headers, json=payload,
                                    timeout=ClientTimeout(total=90)) as resp:
                if resp.status != 200:
                    body = _scrub_secrets(await resp.text(), api_key)
                    return None, f"Gemini API Error {resp.status}: {body}"
                res = await resp.json()
                text = (
                    res.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                return text, None

        elif provider == PROVIDER_OPENAI:
            endpoint = f"{base_url.rstrip('/')}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            }
            if images:
                content = [{"type": "text", "text": prompt}]
                for img_mime, img_b64 in images:
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{img_mime};base64,{img_b64}"
                        },
                    })
            else:
                content = prompt
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": content}],
            }
            async with session.post(endpoint, headers=headers, json=payload,
                                    timeout=ClientTimeout(total=90)) as resp:
                if resp.status != 200:
                    body = _scrub_secrets(await resp.text(), api_key)
                    return None, f"OpenAI/Local API Error {resp.status}: {body}"
                res = await resp.json()
                text = (
                    res.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                return text, None

        elif provider == PROVIDER_CLAUDE:
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            if images:
                content = [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img_mime,
                            "data": img_b64,
                        },
                    }
                    for img_mime, img_b64 in images
                ]
                content.append({"type": "text", "text": prompt})
            else:
                content = prompt
            payload = {
                "model": model,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": content}],
            }
            async with session.post(url, headers=headers, json=payload,
                                    timeout=ClientTimeout(total=90)) as resp:
                if resp.status != 200:
                    body = _scrub_secrets(await resp.text(), api_key)
                    return None, f"Claude API Error {resp.status}: {body}"
                res = await resp.json()
                text = res.get("content", [{}])[0].get("text", "")
                return text, None

        return None, f"Unsupported Provider: {provider}"

    except asyncio.TimeoutError:
        return None, "Request timed out. The local AI took too long to answer."
    except aiohttp.ClientError as ce:
        # [MODIFIED v10.0.0] aiohttp stringifies with the full request URL.
        # This string is returned up the stack and shown to the user in the
        # chat panel, so it must be scrubbed even though the key now lives in
        # a header rather than the URL.
        return None, _scrub_secrets(
            f"Connection Failed: {str(ce)}. Check your local API URL.", api_key
        )
    except Exception as e:
        return None, _scrub_secrets(f"Router Exception: {str(e)}", api_key)


# ==========================================
# SMART ROUTER (Local/Cloud/Hybrid decision)
# ==========================================
async def async_smart_router(hass, entry: ConfigEntry, prompt: str,
                             image_data=None, mime_type="image/jpeg"):
    """Decide LOCAL vs CLOUD based on processing mode and prompt content."""
    mode = (
        entry.options.get(CONF_PROCESSING_MODE)
        or entry.data.get(CONF_PROCESSING_MODE)
        or MODE_HYBRID
    )

    cloud_provider_raw = (
        entry.options.get("api_provider")
        or entry.data.get("api_provider")
        or "Gemini"
    )
    cloud_key = entry.options.get("api_key") or entry.data.get("api_key") or ""
    cloud_model = (
        entry.options.get("cloud_model")
        or entry.data.get("cloud_model")
        or "gemini-3.1-flash-lite-preview"
    )
    custom_cloud_url = (
        entry.options.get("custom_cloud_url")
        or entry.data.get("custom_cloud_url")
        or ""
    )

    local_url = (
        entry.options.get("local_api_url")
        or entry.data.get("local_api_url")
        or entry.options.get("ollama_url")
        or entry.data.get("ollama_url")
        or "http://192.168.1.100:1234/v1"
    )
    local_key = (
        entry.options.get("local_api_key")
        or entry.data.get("local_api_key")
        or ""
    )
    local_model = (
        entry.options.get("local_model")
        or entry.data.get("local_model")
        or "gpt-oss:120b"
    )

    cloud_provider = PROVIDER_GEMINI
    if "OpenAI" in cloud_provider_raw:
        cloud_provider = PROVIDER_OPENAI
    elif "Claude" in cloud_provider_raw:
        cloud_provider = PROVIDER_CLAUDE

    cloud_base_url = custom_cloud_url if custom_cloud_url else "https://api.openai.com/v1"

    if mode == MODE_LOCAL_ONLY:
        _LOGGER.info("Home Organizer: Routing -> LOCAL ONLY")
        return await async_universal_ai_router(
            hass, PROVIDER_OPENAI, local_url, local_key, local_model,
            prompt, image_data, mime_type,
        )

    elif mode == MODE_CLOUD_ONLY:
        _LOGGER.info("Home Organizer: Routing -> CLOUD ONLY")
        return await async_universal_ai_router(
            hass, cloud_provider, cloud_base_url, cloud_key, cloud_model,
            prompt, image_data, mime_type,
        )

    else:  # MODE_HYBRID
        is_cloud_task = False
        p_lower = prompt.lower()

        if image_data is not None:
            is_cloud_task = True
        elif "scanned barcode" in p_lower or "retail product database" in p_lower:
            is_cloud_task = True
        elif "virtual fashion stylist" in p_lower:
            is_cloud_task = True

        if is_cloud_task:
            _LOGGER.info(
                "Home Organizer Hybrid Mode: Routing heavy task "
                "(Image/Barcode/Stylist) to CLOUD API."
            )
            return await async_universal_ai_router(
                hass, cloud_provider, cloud_base_url, cloud_key, cloud_model,
                prompt, image_data, mime_type,
            )
        else:
            _LOGGER.info(
                "Home Organizer Hybrid Mode: Routing standard text to LOCAL API."
            )
            return await async_universal_ai_router(
                hass, PROVIDER_OPENAI, local_url, local_key, local_model,
                prompt, None, mime_type,
            )


# ==========================================
# SAFE WRAPPER WITH HYBRID FALLBACK
# ==========================================
async def safe_smart_router(hass, entry: ConfigEntry, prompt: str,
                            image_data=None, mime_type="image/jpeg"):
    """Wrap async_smart_router with auto-fallback to LOCAL on cloud failure."""
    mode = (
        entry.options.get(CONF_PROCESSING_MODE)
        or entry.data.get(CONF_PROCESSING_MODE)
        or MODE_HYBRID
    )
    # [ADDED v10.0.0] Read the configured keys so any exception raised below
    # can be scrubbed before it is logged or returned to the caller.
    cloud_key_for_scrub = (
        entry.options.get("api_key") or entry.data.get("api_key") or ""
    )
    local_key_for_scrub = (
        entry.options.get("local_api_key") or entry.data.get("local_api_key") or ""
    )
    try:
        res, err = await async_smart_router(hass, entry, prompt, image_data, mime_type)
        if (
            err
            and mode == MODE_HYBRID
            and any(kw in err.lower() for kw in ["connection", "timeout", "router", "failed"])
        ):
            _LOGGER.warning("Cloud router failed in Hybrid mode, forcing Local AI fallback.")
            return await async_smart_router(
                hass, FallbackMockEntry(entry), prompt, image_data, mime_type
            )
        return res, _scrub_secrets(err, cloud_key_for_scrub, local_key_for_scrub)
    except Exception as e:
        # [MODIFIED v10.0.0] frenck flagged this exact log line: an aiohttp
        # ClientResponseError stringifies with the request URL. Scrubbed here
        # as well, so neither the log nor the returned message can carry a key.
        err_str = _scrub_secrets(str(e), cloud_key_for_scrub)
        if mode == MODE_HYBRID and any(
            kw in err_str.lower() for kw in ["connection", "timeout", "router", "failed"]
        ):
            _LOGGER.warning(f"Cloud router exception: {err_str}. Forcing Local fallback.")
            try:
                return await async_smart_router(
                    hass, FallbackMockEntry(entry), prompt, image_data, mime_type
                )
            except Exception as fe:
                return None, _scrub_secrets(str(fe), local_key_for_scrub)
        return None, err_str