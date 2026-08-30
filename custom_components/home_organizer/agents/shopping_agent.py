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
# // [MODIFIED v9.3.3 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O. Replaced get_db_connection with get_db_path and removed async_add_executor_job wrappers to prevent Event Loop blocking.
# // [MODIFIED v9.3.2 | 2026-04-21] Purpose: Bug fix — translations.csv was not being found because the loader searched in www/ and static/, but the file actually lives at <integration_dir>/frontend/translations.csv (as registered in __init__.py StaticPathConfig). Added frontend/ as the first path candidate. Category and sub-category labels now translate to the target language as intended.

import logging
import os
import re
import csv
import aiosqlite

from ..database import get_db_path, async_add_item_db_safe
from ..ai_core.router import safe_smart_router
from ..ai_core.json_utils import safe_parse_json, apply_voice_rules
from ..ai_core.localized_strings import get_strings_for_language
from ..prompt_core import ICON_PROMPT_CONTEXT

_LOGGER = logging.getLogger(__name__)


# ==========================================
# TRANSLATION HELPERS
# ==========================================
_TRANSLATIONS_CACHE = None
_KNOWN_LANGS = {"he", "en", "ru", "it", "es", "fr", "ar"}


def _load_translations():
    global _TRANSLATIONS_CACHE
    if _TRANSLATIONS_CACHE is not None:
        return _TRANSLATIONS_CACHE

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidates = [
        os.path.join(base_dir, "frontend", "translations.csv"),
        os.path.join(base_dir, "www", "translations.csv"),
        os.path.join(base_dir, "static", "translations.csv"),
        os.path.join(base_dir, "translations.csv"),
    ]

    for path in candidates:
        if not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8", newline="") as f:
                reader = csv.reader(f)
                try:
                    headers = next(reader)
                except StopIteration:
                    continue
                headers = [h.lstrip("\ufeff").strip() for h in headers]
                if not headers or headers[0] != "Key":
                    continue
                result = {}
                for row in reader:
                    if not row or not row[0]:
                        continue
                    key = row[0].strip()
                    entry = {}
                    for i, lang in enumerate(headers[1:], start=1):
                        if i < len(row):
                            entry[lang] = row[i].strip()
                    result[key] = entry
                _TRANSLATIONS_CACHE = result
                _LOGGER.info(
                    f"Shopping agent loaded {len(result)} translation keys from {path}"
                )
                return result
        except Exception as e:
            _LOGGER.warning(f"Could not load translations from {path}: {e}")

    _TRANSLATIONS_CACHE = {}
    _LOGGER.warning(
        "translations.csv not found — category labels in share messages will stay "
        "in the raw DB language (usually English)."
    )
    return {}


def _slug(s):
    return re.sub(r"[^a-zA-Z0-9]+", "_", str(s or "")).strip("_")


def _translate(key, lang, default=None):
    trans = _load_translations()
    entry = trans.get(key) or {}
    return entry.get(lang) or entry.get("en") or (default if default is not None else key)


def _detect_lang(kwargs, hass, last_user_msg):
    t = str(kwargs.get("target_lang", "")).strip().lower()
    if t in _KNOWN_LANGS:
        return t
    if last_user_msg:
        if re.search(r"[\u0590-\u05FF]", last_user_msg):
            return "he"
        if re.search(r"[\u0600-\u06FF]", last_user_msg):
            return "ar"
        if re.search(r"[\u0400-\u04FF]", last_user_msg):
            return "ru"
    try:
        h = str(hass.config.language or "").lower().split("-")[0]
        if h in _KNOWN_LANGS:
            return h
    except Exception:
        pass
    return "en"


# ==========================================
# PROMPT
# ==========================================
def get_shopping_prompt(target_lang, existing_locs_str, history_text):
    return f"""You are a Smart Home Shopping List Manager. Your sole purpose is managing the user's shopping list, determining what needs to be ordered, and tracking items that are out of stock (quantity = 0).

DATABASE LOCATIONS:
{existing_locs_str}

ICON LIBRARY AND CATEGORIES:
{ICON_PROMPT_CONTEXT}

CRITICAL RULES:
1. SMART LOCATION GUESSING: If the user asks to add an item to the shopping list but does NOT specify a location (e.g., "Add 2 cucumbers"), you MUST scan the EXISTING LOCATIONS list and intelligently guess the most logical location and sub-location for it (e.g., "Fridge" -> "Vegetable Drawer" for cucumbers). Use the "manage_shopping_list" tool immediately with your best guess. Only ask for clarification if the item is completely ambiguous.
2. SMART SUB-LOCATION CLARIFICATION: If the user specifies a broad/general location (e.g., "Fridge") AND you see a perfectly matching sub-location under it in the EXISTING LOCATIONS list, guess the most logical sub-location (e.g., "Vegetable Drawer" for carrots) and return JSON: {{"intent": "clarify", "question": "Should I place it in the <Suggested Sub-Location>? (Translate this naturally to {target_lang})"}}.
3. CONTINUATION & CONTEXT RECOVERY: If you recently asked the user a clarification question and they provide an answer, YOU MUST NOT ask them what item they wanted to add! You MUST read the CHAT HISTORY, extract the original `item_name` and `requested_qty` from their previous messages.
4. USER LOCATION MATCHING: If the user provided a location name, thoroughly search the EXISTING LOCATIONS list. If it matches an existing path (e.g., Fridge > Vegetable Drawer), use its EXACT `location_id` and leave `sub_location` empty. NEVER use `sub_location` for an existing location! ONLY use the `sub_location` argument if the user explicitly confirmed they want to open a completely NEW sub-location.
5. SILENT CATEGORIZATION & ICONS: When using "manage_shopping_list", independently choose the best matching `category`, `sub_category`, and `icon_key`. Never ask the user for them. Make the decision yourself silently behind the scenes.
6. SPEED AND SHOPPING LIST LOGIC: ALWAYS use the "manage_shopping_list" tool ONCE, passing ALL items in the array. If it replies ASK_USER, explicitly ask to increase quantity.
7. NO INTERNAL STATES: Never tell the user that you added an item with "quantity 0". The shopping list relies on "quantity to buy". Always use the requested quantity in your spoken replies.
8. SYSTEM TOOL RESPONSES: If the CHAT HISTORY ends with a 'System Tool Output' (meaning a tool just succeeded), you MUST use intent "reply" to politely confirm to the user that the action was completed.
9. JSON FORMATTING SAFETY: Do NOT use double quotes (") inside your JSON string values. Use single quotes (').
10. TARGET LANGUAGE ENFORCEMENT: All spoken replies ('message' or 'question') AND all database string values ('item_name', 'new_sub_location', 'sub_location') inside your JSON tool calls MUST be written strictly in {target_lang}. NEVER translate the item name to English unless {target_lang} is English!
11. STRICT JSON OUTPUT ONLY. Output EXACTLY ONE JSON object per turn. No conversational text outside the JSON block.
12. SHARE URL PASSTHROUGH: When the 'share_shopping_list' tool returns output containing 'SHARE_URL=' or 'SHARE_URL_WHATSAPP=' / 'SHARE_URL_TELEGRAM=' / 'SHARE_URL_EMAIL=', you MUST copy each relevant URL verbatim into your reply 'message'. If the user picked one channel, include just that URL. If 'any' was used, include all three URLs each on its own line with a short emoji label. Do NOT shorten the URL, do NOT replace it with '[link]', and do NOT describe it as "the link above". The user taps the actual URL string.

AVAILABLE TOOLS:
1. "get_shopping_list" - Retrieves the current items that are marked to be purchased.
   - kwargs: {{}}
2. "manage_shopping_list" - Use this to ADD items to the shopping list. It handles checking if they exist and setting them to out-of-stock.
   - You MUST supply the EXACT `location_id` from the existing locations list if it exists.
   - kwargs: {{"items": [{{"item_name": "string", "requested_qty": "integer", "location_id": "string", "sub_location": "", "category": "string", "sub_category": "string", "icon_key": "string"}}]}}
3. "create_sub_location" - Creates a NEW, empty sub-location (folder, drawer, shelf) inside an existing location, without adding an item to it.
   - kwargs: {{"location_id": "A1", "new_sub_location": "Vegetable Drawer"}}
4. "update_shopping_order_qty" - Use this to INCREASE or UPDATE the order quantity for items that the system tells you are ALREADY on the shopping list.
   - kwargs: {{"item_name": "string", "new_qty": "integer"}}
5. "remove_from_shopping_list" - Removes/deletes a specific item from the shopping list entirely.
   - kwargs: {{"item_name": "string"}}
6. "clear_shopping_list" - Completely clears/deletes all items currently on the shopping list. Use ONLY if the user explicitly asks to clear, empty, or delete the whole list.
   - kwargs: {{}}
7. "complete_shopping_list" - Marks all items on the shopping list as purchased and restocks them into the main inventory. Use if the user says they bought everything.
   - kwargs: {{}}
8. "share_shopping_list" - Share the current shopping list via WhatsApp, Telegram, or Email. Returns tap-to-send URLs and creates a native HA notification with clickable buttons. Use this whenever the user asks to send, share, forward, or export the list.
   - kwargs: {{"target_lang": "{target_lang}", "channel": "any", "phone": "", "email": ""}}
   - SET 'channel' TO "whatsapp" if the user mentions WhatsApp/וואטסאפ/واتساب.
   - SET 'channel' TO "telegram" if the user mentions Telegram/טלגרם/تلغرام.
   - SET 'channel' TO "email" if the user mentions email/אימייל/بريد/почта.
   - SET 'channel' TO "any" (default) if the user says "share" / "send" / "שלח" / "תעביר" without naming a channel — this returns all three options.
   - 'phone' is optional; only pass it if the user provides a phone number for WhatsApp.
   - 'email' is optional; only pass it if the user provides a recipient email address.

=== CHAT HISTORY ===
{history_text}
====================

OUTPUT FORMAT: YOU MUST RETURN ONLY VALID JSON.
Example 1 (Smart Location Guessing - User didn't specify location, but AI guesses Fridge > Vegetable Drawer):
{{"intent": "tool", "tool_name": "manage_shopping_list", "kwargs": {{"items": [{{"item_name": "Cucumbers", "requested_qty": 2, "location_id": "A1.1", "sub_location": "", "category": "Food", "sub_category": "Vegetables", "icon_key": "ICON_LIB_ITEM|Food|Vegetables|Cucumbers"}}]}}}}

Example 2 (Missing Sub-Location Clarification):
{{"intent": "clarify", "question": "I don't see a specific place for the remote in the TV Cabinet. Should I open a new sub-location called 'Top Drawer' or save it generally?"}}

Example 3 (Context Recovery & User Location Matching - User answers clarify question with EXISTING location, AI leaves sub_location empty!):
{{"intent": "tool", "tool_name": "manage_shopping_list", "kwargs": {{"items": [{{"item_name": "Cucumbers", "requested_qty": 2, "location_id": "A1.2.3", "sub_location": "", "category": "Food", "sub_category": "Vegetables", "icon_key": "ICON_LIB_ITEM|Food|Vegetables|Cucumbers"}}]}}}}

Example 4 (Update quantity after user confirms):
{{"intent": "tool", "tool_name": "update_shopping_order_qty", "kwargs": {{"item_name": "Milk", "new_qty": 10}}}}

Example 5 (Reply after a tool succeeds):
{{"intent": "reply", "message": "I have successfully added 2 cucumbers to the shopping list."}}

Example 6 (Share to any channel - user said "שלח את רשימת הקניות" without naming channel):
{{"intent": "tool", "tool_name": "share_shopping_list", "kwargs": {{"target_lang": "{target_lang}", "channel": "any"}}}}

Example 7 (Share to Telegram specifically - user said "תשלח לטלגרם"):
{{"intent": "tool", "tool_name": "share_shopping_list", "kwargs": {{"target_lang": "{target_lang}", "channel": "telegram"}}}}

Example 8 (Reply after share_shopping_list with channel=any - all three URLs must appear):
{{"intent": "reply", "message": "✅ בחרי איך לשלוח:\\n\\n📲 WhatsApp: https://wa.me/?text=...\\n✈️ Telegram: https://t.me/share/url?url=&text=...\\n📧 Email: mailto:?subject=..."}}

Example 9 (Reply after share_shopping_list with specific channel - single URL):
{{"intent": "reply", "message": "✅ מוכן! לחצי לשליחה בטלגרם: https://t.me/share/url?url=&text=..."}}

JSON ONLY:"""


# ==========================================
# TOOLS (shopping-only)
# ==========================================
async def execute_tool(hass, tool_name, kwargs, loc_hierarchy_map, last_user_msg=""):
    _LOGGER.info(f"Shopping tool: {tool_name} args={kwargs}")

    if tool_name == "share_shopping_list":
        from urllib.parse import quote

        target_lang = _detect_lang(kwargs, hass, last_user_msg)
        channel = str(kwargs.get("channel", "any")).strip().lower() or "any"
        phone = str(kwargs.get("phone", "")).strip().lstrip("+").replace(" ", "").replace("-", "")
        email_to = str(kwargs.get("email", "")).strip()

        async def db_get_grouped():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    async with db.execute(
                        "SELECT name, order_qty, category, sub_category, unit, unit_value "
                        "FROM items WHERE type='item' AND quantity = 0 "
                        "ORDER BY category ASC, sub_category ASC, name ASC"
                    ) as cursor:
                        return await cursor.fetchall()
            except Exception as e:
                _LOGGER.error(f"share_shopping_list DB error: {e}")
                return []

        rows = await db_get_grouped()
        if not rows:
            return "The shopping list is currently empty. Nothing to share."

        CAT_EMOJI = {
            "Food & Groceries": "🍎", "Personal Care & Pharmacy": "💊", "Cleaning Supplies": "🧽",
            "Home Maintenance": "🔧", "Textiles & Bedding": "🛏️", "Clothing": "👕",
            "Footwear": "👟", "Bags & Accessories": "👜", "Electronics & Tech": "📱",
            "Baby & Kids": "👶", "Pet Supplies": "🐾", "Outdoor & Garden": "🌳",
            "Sports & Hobbies": "⚽", "Office & Stationery": "✏️",
            "Food": "🍎", "Cleaning": "🧽", "Tools": "🔧", "Electronics": "📱",
            "Kitchenware": "🍳", "Home Textiles": "🛏️", "Baby Supplies": "👶",
            "Toys": "🧸", "Outdoor": "🌳", "Fitness Gear": "⚽", "Toiletries": "🧴",
            "Pharmacy": "💊", "General Supplies": "📦", "Home Office Supplies": "✏️",
            "Entertainment": "🎮", "First Aid": "🩹",
        }
        SUB_EMOJI = {
            "Dairy & Eggs": "🥛", "Meat & Poultry": "🍗", "Fish & Seafood": "🐟",
            "Vegetables": "🥦", "Fruits": "🍓", "Pantry & Dry Goods": "🍚",
            "Carbs & Pasta": "🍝", "Legumes": "🫘", "Spices & Herbs": "🌿",
            "Baking Goods": "🧁", "Sauces & Condiments": "🍯", "Spreads": "🥜",
            "Canned Goods": "🥫", "Bread & Bakery": "🍞", "Beverages": "🥤",
            "Snacks & Sweets": "🍪",
        }
        def cat_emoji(c): return CAT_EMOJI.get(c, "📦")
        def sub_emoji(s):
            em = SUB_EMOJI.get(s)
            return f"{em} " if em else ""

        grouped = {}
        total = 0
        for name, oq, cat, scat, unit, uval in rows:
            cat_raw = (cat or "Other").strip() or "Other"
            scat_raw = (scat or "General").strip() or "General"
            # [MODIFIED v2026.8.26] _translate() lazily reads a 137 KB CSV from
            # disk on its first call. That read was happening on the event
            # loop. Warm the cache in the executor once, before using it.
            if _TRANSLATIONS_CACHE is None:
                await hass.async_add_executor_job(_load_translations)
            cat_display = _translate(f"cat_{_slug(cat_raw)}", target_lang, default=cat_raw)
            scat_display = _translate(f"sub_{_slug(scat_raw)}", target_lang, default=scat_raw)
            qty = oq if oq and oq > 0 else 1
            val_part = f" ({uval}{unit})" if (uval and unit) else (f" ({uval})" if uval else "")
            line = f"  • {name} ×{qty}{val_part}"
            
            bucket = grouped.setdefault((cat_raw, cat_display), {})
            bucket.setdefault((scat_raw, scat_display), []).append(line)
            total += 1

        header_map = {
            "he": "🛒 רשימת קניות", "en": "🛒 Shopping List", "ru": "🛒 Список покупок",
            "it": "🛒 Lista della spesa", "es": "🛒 Lista de compras", "fr": "🛒 Liste de courses",
            "ar": "🛒 قائمة التسوق",
        }
        footer_map = {
            "he": f"סה״כ {total} פריטים", "en": f"Total: {total} items", "ru": f"Всего: {total} товаров",
            "it": f"Totale: {total} articoli", "es": f"Total: {total} artículos", "fr": f"Total : {total} articles",
            "ar": f"المجموع: {total} عنصرًا",
        }
        header = header_map.get(target_lang, header_map["en"])
        footer = footer_map.get(target_lang, footer_map["en"])

        lines = [header, ""]
        for (cat_raw, cat_display) in sorted(grouped.keys(), key=lambda k: k[1]):
            sub_map = grouped[(cat_raw, cat_display)]
            lines.append(f"{cat_emoji(cat_raw)} *{cat_display}*")
            only_general = (len(sub_map) == 1 and list(sub_map.keys())[0][0] == "General")
            for (scat_raw, scat_display) in sorted(sub_map.keys(), key=lambda k: k[1]):
                if only_general:
                    lines.extend(sub_map[(scat_raw, scat_display)])
                else:
                    lines.append(f"  {sub_emoji(scat_raw)}_{scat_display}_")
                    lines.extend(sub_map[(scat_raw, scat_display)])
            lines.append("")
        lines.append(f"— {footer}")
        text = "\n".join(lines).strip()
        encoded = quote(text)

        urls = {
            "whatsapp": (f"https://wa.me/{phone}?text={encoded}" if phone
                         else f"https://wa.me/?text={encoded}"),
            "telegram": f"https://t.me/share/url?url=&text={encoded}",
            "email":    f"mailto:{email_to}?subject={quote(header)}&body={encoded}",
        }

        labels = {
            "he": {"whatsapp": "📲 שלח בוואטסאפ", "telegram": "✈️ שלח בטלגרם", "email": "📧 שלח באימייל"},
            "en": {"whatsapp": "📲 Send via WhatsApp", "telegram": "✈️ Send via Telegram", "email": "📧 Send via Email"},
            "ru": {"whatsapp": "📲 Отправить в WhatsApp", "telegram": "✈️ Отправить в Telegram", "email": "📧 Отправить по Email"},
            "it": {"whatsapp": "📲 Invia su WhatsApp", "telegram": "✈️ Invia su Telegram", "email": "📧 Invia via Email"},
            "es": {"whatsapp": "📲 Enviar por WhatsApp", "telegram": "✈️ Enviar por Telegram", "email": "📧 Enviar por Email"},
            "fr": {"whatsapp": "📲 Envoyer via WhatsApp", "telegram": "✈️ Envoyer via Telegram", "email": "📧 Envoyer par e-mail"},
            "ar": {"whatsapp": "📲 إرسال عبر واتساب", "telegram": "✈️ إرسال عبر تلغرام", "email": "📧 إرسال عبر البريد"},
        }
        L = labels.get(target_lang, labels["en"])

        if channel in ("whatsapp", "telegram", "email"):
            chosen = [channel]
        else:
            chosen = ["whatsapp", "telegram", "email"]

        button_lines = [f"### [{L[ch]}]({urls[ch]})" for ch in chosen]
        md_text = "  \n".join(text.split("\n"))
        notification_body = "\n\n".join(button_lines) + "\n\n---\n\n" + md_text

        try:
            await hass.services.async_call(
                "persistent_notification",
                "create",
                {
                    "title": header,
                    "message": notification_body,
                    "notification_id": "home_organizer_share",
                },
                blocking=False,
            )
        except Exception as e:
            _LOGGER.warning(f"persistent_notification failed: {e}")

        hass.bus.async_fire(
            "home_organizer_share_link",
            {"channel": channel, "urls": urls, "text": text, "chosen": chosen},
        )

        if len(chosen) == 1:
            ch = chosen[0]
            return (
                f"SHARE_URL={urls[ch]}\n"
                f"CHANNEL={ch}\n"
                f"ITEM_COUNT={total}\n"
                f"NOTE: Return the SHARE_URL verbatim in your reply so the user can tap it."
            )
        else:
            return (
                f"SHARE_URL_WHATSAPP={urls['whatsapp']}\n"
                f"SHARE_URL_TELEGRAM={urls['telegram']}\n"
                f"SHARE_URL_EMAIL={urls['email']}\n"
                f"ITEM_COUNT={total}\n"
                f"NOTE: The user did not specify a channel. Return ALL THREE URLs verbatim in your reply, each on its own line with a short label."
            )

    if tool_name == "get_shopping_list":
        async def db_get_shopping():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    async with db.execute("SELECT name, order_qty FROM items WHERE type='item' AND quantity = 0") as cursor:
                        return await cursor.fetchall()
            except Exception:
                return []

        items = await db_get_shopping()
        if not items:
            return "The list is currently empty."
        res = "\n".join([f"- {r[0]} (Qty to buy: {r[1] if r[1] and r[1] > 0 else 1})" for r in items])
        return f"Current Shopping List:\n{res}"

    elif tool_name == "manage_shopping_list":
        items = kwargs.get("items", [])
        results = []
        ask_user = []

        for itm in items:
            nm = str(itm.get("item_name", itm.get("name", ""))).strip()
            if not nm:
                continue

            raw_qty = itm.get("requested_qty", itm.get("qty", itm.get("order_qty", 1)))
            try:
                req_qty = int(raw_qty)
                if req_qty <= 0: req_qty = 1
            except (ValueError, TypeError):
                req_qty = 1

            loc_id = itm.get("location_id", "")
            sl = itm.get("sub_location", "")
            cat = itm.get("category", "General")
            scat = itm.get("sub_category", "")
            icon = itm.get("icon_key", None)

            async def db_process_item():
                try:
                    db_path = get_db_path(hass)
                    async with aiosqlite.connect(db_path, timeout=10.0) as db:
                        async with db.execute("SELECT id, quantity, name FROM items WHERE name = ? AND type='item'", (nm,)) as cursor:
                            row = await cursor.fetchone()
                        
                        if row:
                            item_id, current_qty, matched_name = row
                            if current_qty > 0:
                                await db.execute("UPDATE items SET quantity = 0, order_qty = ? WHERE id = ?", (req_qty, item_id))
                                if sl:
                                    await db.execute("UPDATE items SET level_3 = ? WHERE id = ?", (sl, item_id))
                                await db.commit()
                                return f"Successfully added existing '{matched_name}' to the shopping list with quantity to buy: {req_qty}."
                            else:
                                return f"ASK_USER:{matched_name}"
                        else:
                            return "CREATE_NEW"
                except Exception as e:
                    return f"Error: {e}"

            res = await db_process_item()

            if res == "CREATE_NEW":
                base_path = loc_hierarchy_map.get(loc_id)
                if not base_path:
                    fallback_loc = loc_id
                    for _k, v in loc_hierarchy_map.items():
                        v_str = " ".join(v).replace("ORDER_MARKER", "")
                        if fallback_loc.lower() in v_str.lower() or fallback_loc in v:
                            base_path = v
                            break
                    if not base_path:
                        base_path = [fallback_loc] if fallback_loc else ["General"]

                if sl and len(base_path) > 2:
                    base_path = base_path[:2]
                full_path = list(base_path)
                if sl:
                    full_path.append(sl)

                await async_add_item_db_safe(
                    hass, nm, 0, full_path, cat, scat, "item", icon, "0"
                )

                async def set_new_order_qty():
                    try:
                        db_path = get_db_path(hass)
                        async with aiosqlite.connect(db_path, timeout=10.0) as db:
                            await db.execute("UPDATE items SET order_qty = ? WHERE name = ? AND type='item' AND quantity = 0", (req_qty, nm))
                            await db.commit()
                    except Exception: pass

                await set_new_order_qty()
                results.append(
                    f"Successfully created '{nm}' on the shopping list with quantity to buy: {req_qty}."
                )
            elif str(res).startswith("ASK_USER:"):
                ask_user.append(str(res).split(":")[1])
            else:
                results.append(res)

        hass.bus.async_fire("home_organizer_db_update")

        final_str = " ".join(results)
        if ask_user:
            final_str += (
                f" CRITICAL: The following items are ALREADY out of stock / on "
                f"the shopping list: {', '.join(ask_user)}. You MUST explicitly "
                f"ask the user: 'Do you want to increase the order quantity for "
                f"{', '.join(ask_user)}?'"
            )

        if not final_str.strip():
            return "No items processed."
        return final_str

    elif tool_name == "create_sub_location":
        loc_id = kwargs.get("location_id", "")
        new_sub = kwargs.get("new_sub_location", "")
        
        if not new_sub:
            return "Error: No new_sub_location provided."

        base_path = loc_hierarchy_map.get(loc_id)
        if not base_path:
            fallback_loc = kwargs.get("main_location", loc_id)
            for _k, v in loc_hierarchy_map.items():
                v_str = " ".join(v).replace("ORDER_MARKER", "")
                if fallback_loc.lower() in v_str.lower() or fallback_loc in v:
                    base_path = v
                    break
            if not base_path:
                base_path = [fallback_loc] if fallback_loc else ["General"]

        if len(base_path) > 2:
            base_path = base_path[:2]
            
        full_path = list(base_path)
        full_path.append(new_sub)

        folder_name = f"[Folder] {new_sub}"
        
        await async_add_item_db_safe(
            hass, folder_name, 0, full_path, "Folder", "", "folder_marker", None, "0"
        )
        hass.bus.async_fire("home_organizer_db_update")
        loc_str = " > ".join(base_path)
        return f"Success! Created new empty sub-location '{new_sub}' in {loc_str}."

    elif tool_name == "update_shopping_order_qty":
        nm = str(kwargs.get("item_name", kwargs.get("name", ""))).strip()
        raw_qty = kwargs.get("new_qty", kwargs.get("qty", kwargs.get("requested_qty", 1)))
        
        try:
            qty = int(raw_qty)
            if qty <= 0: qty = 1
        except (ValueError, TypeError):
            qty = 1

        async def db_update_order():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    cursor = await db.execute("UPDATE items SET order_qty = ? WHERE name = ? AND type='item' AND quantity = 0", (qty, nm))
                    if cursor.rowcount > 0:
                        await db.commit()
                        return f"Successfully updated '{nm}' order quantity to {qty}."
                    
                    async with db.execute("SELECT id, name FROM items WHERE name LIKE ? AND type='item' AND quantity = 0 ORDER BY LENGTH(name) ASC LIMIT 1", (f"%{nm}%",)) as sel_cursor:
                        row = await sel_cursor.fetchone()
                    if row:
                        item_id, matched_name = row
                        await db.execute("UPDATE items SET order_qty = ? WHERE id = ?", (qty, item_id))
                        await db.commit()
                        return f"Successfully updated '{matched_name}' order quantity to {qty}."

                    return f"Item '{nm}' not found on shopping list."
            except Exception as e:
                return f"Error updating order qty: {e}"

        res = await db_update_order()
        hass.bus.async_fire("home_organizer_db_update")
        return res

    elif tool_name == "remove_from_shopping_list":
        nm = kwargs.get("item_name", "")

        async def db_remove_shop():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    cursor = await db.execute("DELETE FROM items WHERE name = ? AND quantity = 0 AND type='item'", (nm,))
                    if cursor.rowcount > 0:
                        await db.commit()
                        return f"Removed '{nm}' from the shopping list."
                    
                    async with db.execute("SELECT id, name FROM items WHERE name LIKE ? AND quantity = 0 AND type='item' ORDER BY LENGTH(name) ASC LIMIT 1", (f"%{nm}%",)) as sel_cursor:
                        row = await sel_cursor.fetchone()
                    if row:
                        await db.execute("DELETE FROM items WHERE id = ?", (row[0],))
                        await db.commit()
                        return f"Removed '{row[1]}' from the shopping list."
                        
                    return f"Item '{nm}' not found on the shopping list."
            except Exception as e:
                return f"Error: {e}"

        res = await db_remove_shop()
        hass.bus.async_fire("home_organizer_db_update")
        return res

    elif tool_name == "clear_shopping_list":
        async def db_clear_shop():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    cursor = await db.execute("DELETE FROM items WHERE quantity = 0 AND type='item'")
                    count = cursor.rowcount
                    await db.commit()
                    return f"Cleared {count} items from the shopping list."
            except Exception as e:
                return f"Error: {e}"

        res = await db_clear_shop()
        hass.bus.async_fire("home_organizer_db_update")
        return res

    elif tool_name == "complete_shopping_list":
        async def db_complete_shop():
            try:
                db_path = get_db_path(hass)
                async with aiosqlite.connect(db_path, timeout=10.0) as db:
                    cursor = await db.execute(
                        "UPDATE items SET quantity = "
                        "CASE WHEN order_qty > 0 THEN order_qty ELSE 1 END "
                        "WHERE quantity = 0 AND type='item'"
                    )
                    count = cursor.rowcount
                    await db.commit()
                    return f"Successfully marked {count} items as purchased and restocked them."
            except Exception as e:
                return f"Error: {e}"

        res = await db_complete_shop()
        hass.bus.async_fire("home_organizer_db_update")
        return res

    return f"Error: Unknown shopping tool '{tool_name}'."


# ==========================================
# RUN LOOP
# ==========================================
async def run(hass, entry, messages, target_lang, existing_locs_str,
              loc_hierarchy_map, history_text, last_user_msg, recipe_name,
              is_voice, device_id, user_id, lang_code="en"):
    strings = await get_strings_for_language(hass, entry, lang_code)
    prompt = get_shopping_prompt(target_lang, existing_locs_str, history_text)

    for _ in range(10):
        raw_res, err = await safe_smart_router(
            hass, entry, apply_voice_rules(prompt, is_voice, target_lang)
        )

        if err or not raw_res:
            _LOGGER.error(f"Shopping Agent loop error: {err}")
            return f"❌ {strings['ai_connection_error']} ({err})"

        parsed = safe_parse_json(raw_res)
        if not parsed:
            return strings["invalid_format"]

        intent = parsed.get("intent")

        if intent == "tool":
            tool_name = parsed.get("tool_name")
            kwargs = parsed.get("kwargs", {})
            tool_result = await execute_tool(hass, tool_name, kwargs, loc_hierarchy_map, last_user_msg)
            messages.append({"role": "system", "content": f"System Tool Output: {tool_result}"})

            history_text_new = ""
            for m in messages:
                history_text_new += f"{m['role'].upper()}: {m['content']}\n"
            prompt = get_shopping_prompt(target_lang, existing_locs_str, history_text_new)

        elif intent == "reply":
            reply_msg = parsed.get("message", "")
            messages.append({"role": "assistant", "content": reply_msg})
            return reply_msg

        elif intent == "clarify":
            reply_msg = parsed.get("question") or strings["clarify_no_location"]
            messages.append({"role": "assistant", "content": reply_msg})
            return reply_msg

        else:
            return strings["fallback_unsure"]

    return strings["fallback_stuck"]