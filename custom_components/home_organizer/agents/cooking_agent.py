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
# // [MODIFIED v9.9.8 | 2026-08-02] Purpose: Refactored database interactions to use aiosqlite for full asynchronous I/O. Replaced get_db_connection with get_db_path and removed async_add_executor_job wrappers to prevent Event Loop blocking.
# // [v9.9.7 | 2026-04-19] Purpose: Unified first-turn presentation + free-form
# //   questions. Major UX changes requested by the user:
# //
# //   1. FIRST-TURN FULL PRESENTATION. STATE 1 is renamed "recipe_full"
# //      and now returns the COMPLETE recipe -- title, have/missing
# //      ingredients, AND all preparation steps -- in a single turn.
# //      The old two-stage "overview then show full" flow is gone; the
# //      user sees everything immediately.
# //
# //   2. STEP-BY-STEP REUSES THE DISPLAYED RECIPE. STATE 3 now prefers
# //      the steps/timers/ingredients already stored in recipe_state
# //      over whatever the LLM returns. This guarantees "start step by
# //      step" walks through the EXACT same recipe the user just saw,
# //      not a regenerated version that might differ.
# //
# //   3. FREE-FORM QUESTIONS (STATE 2). While a recipe is active, the
# //      user can ask anything about it -- "How do you recommend
# //      decorating the cake?", "How long does it keep?", "What pan
# //      size?" -- and get a conversational answer without modifying
# //      the recipe state. Distinct from STATE 4 (fix_recipe) which is
# //      for quantity/substitution changes.
# //
# //   4. RENDERER EXTENDED. _render_recipe_overview now includes a
# //      localized "Preparation:" section listing every step. Hebrew,
# //      Arabic, Russian, German, Dutch, Portuguese all localized.
# //
# //   SAVE_RECIPE unchanged — it already stores the three columns the
# //   user asked for (name, ingredients, steps). Just confirmed it
# //   picks up the full steps from the now-richer state.

import json
import logging
import re
import aiosqlite
from datetime import datetime, timedelta

import homeassistant.util.dt as dt_util

from ..database import get_db_path
from ..ai_core.router import safe_smart_router, async_smart_router
from ..ai_core.json_utils import safe_parse_json, apply_voice_rules
from ..ai_core.localized_strings import get_strings_for_language
from ..ai_core.state_manager import (
    read_state, write_state, clear_state, COOKING_STATE_KEY,
)
from .. import recipes_db, reminders_store, reminders_scheduler

_LOGGER = logging.getLogger(__name__)


# ==========================================
# PROMPTS
# ==========================================
def get_cooking_prompt(inventory_context, recipe_name, target_lang,
                      history_text, current_state_str, saved_suggestions_text):
    return f"""You are a strict, interactive Sous-Chef assisting the user with: {recipe_name}.

=== RAW INVENTORY DATA (what the user HAS at home) ===
{inventory_context}
======================================================

=== SAVED RECIPES IN THE USER'S DATABASE ===
{saved_suggestions_text}
============================================

=== CURRENT RECIPE STATE (JSON) ===
{current_state_str}
===================================

=== CHAT HISTORY ===
{history_text}
====================

CRITICAL LANGUAGE RULE: Your ENTIRE spoken output MUST be strictly in {target_lang}. Every string inside "steps", "recipe_title", "ingredients.name", "ingredients.qty", "timers.label", "have.*", "missing.*", "spoken_confirmation", "spoken_question", "spoken_prompt", "reply_message", "follow_up_question" and "message" -- ALL of them -- MUST be written in {target_lang}. The word "Step" is a LABEL placeholder only: write the step number prefix naturally in {target_lang} (for Hebrew use the Hebrew word for "Step" followed by the number, for Spanish use "Paso 1:", for French "Etape 1:", for Italian "Passo 1:", for German "Schritt 1:", etc). Do NOT output English phrases unless {target_lang} is English.
CRITICAL OUTPUT RULE: Return ONLY a single valid JSON object. No text outside the JSON. No markdown fences.

Classify the user's latest intent into EXACTLY ONE of these states and return the matching JSON.

=====================================================================
[STATE S0 - SUGGEST SAVED RECIPE]
=====================================================================
Trigger: The user asked for a recipe AND one or more entries in SAVED RECIPES clearly match the dish AND CURRENT RECIPE STATE is "None".
Action: Offer the best saved match and ask if they want to use it.
{{"intent": "suggest_saved", "saved_id": "<id from SAVED RECIPES>", "saved_name": "<name from SAVED RECIPES>", "spoken_question": "<Ask in {target_lang}: I have a saved recipe for X. Want to use it, or should I build a fresh one?>"}}

=====================================================================
[STATE 1 - FULL RECIPE PRESENTATION (first time)]
=====================================================================
Trigger: The user asked for a recipe AND no good saved match exists AND CURRENT RECIPE STATE is "None".

Return the COMPLETE recipe in a single turn: title, ingredients split into have/missing AND the full step-by-step preparation. The user will read everything at once and then decide the next action (add missing to shopping, start step-by-step cooking with this exact recipe, or ask a question about it).

For every step that contains a wait/bake/cook/rest time, emit an entry in the "timers" array. step_index is 0-based (step 1 is index 0, step 2 is index 1, etc).

{{
  "intent": "recipe_full",
  "recipe_title": "<recipe name in {target_lang}>",
  "have": [{{"name": "<{target_lang}>", "qty_needed": "<e.g. 200g>", "location": "<short spoken location in {target_lang}>"}}],
  "missing": [{{"name": "<{target_lang}>", "qty_needed": "<e.g. 3 eggs>", "category": "<English category>"}}],
  "steps": ["<step 1 in {target_lang} — prefixed with the localized word for 'Step 1:'>", "<step 2 in {target_lang}>", "..."],
  "timers": [{{"step_index": 1, "minutes": 20, "label": "<{target_lang}>"}}],
  "follow_up_question": "<Ask in {target_lang}: add missing to shopping list, start step-by-step, or ask a question about the recipe?>"
}}

=====================================================================
[STATE 2 - ANSWER A QUESTION ABOUT THE RECIPE]
=====================================================================
Trigger: CURRENT RECIPE STATE is not empty AND the user asks a free-form question about the recipe that is NOT a quantity tweak (that is STATE 4) and NOT step navigation. Examples:
  - "How do you recommend decorating the cake?"
  - "What can I serve this with?"
  - "How long does it keep in the fridge?"
  - "Can I make this ahead of time?"
  - "What if I don't have vanilla?"
  - "What pan size should I use?"

Return a conversational answer in {target_lang}. Do NOT modify the recipe state. Do NOT re-send steps or ingredients.

{{"intent": "reply", "message": "<full conversational answer in {target_lang}>"}}

=====================================================================
[STATE 3 - START STEP-BY-STEP COOKING]
=====================================================================
Trigger: User says "start", "step by step", "begin", "ok", "ready", "let's go", AND CURRENT RECIPE STATE has all_steps (from the recipe_full turn).

ABSOLUTE RULES:
- You MUST return intent "init_recipe".
- NEVER concatenate steps into a single "reply" message.
- REUSE the exact steps and timers from CURRENT RECIPE STATE -- do NOT rebuild or rewrite them.
- The user sees only ONE step at a time. The agent advances on "next".

{{
  "intent": "init_recipe",
  "recipe_title": "<same recipe_title from state>",
  "ingredients": "<same ingredients from state>",
  "steps": "<copy all_steps from CURRENT RECIPE STATE verbatim>",
  "timers": "<copy timers from CURRENT RECIPE STATE verbatim>"
}}

=====================================================================
[STATE 4 - FIX / ADJUST / QUESTION DURING ACTIVE COOKING]
=====================================================================
Trigger: The CURRENT RECIPE STATE already has a non-empty "all_steps" array AND the user sends ANYTHING that can be interpreted as adjusting, substituting, reducing, or asking about THIS recipe -- including brand-new quantity requests.

⚠ ABSOLUTE RULE -- "FIX FIRST" ⚠
When a recipe is already active (all_steps is not empty), you MUST treat the user's message as a FIX to the current recipe UNLESS the user explicitly uses words like "new recipe", "different recipe", "switch recipe", "cancel this recipe", "forget this recipe" (in any language). This applies EVEN IF the user's message looks like a fresh recipe request.

Concrete examples that MUST route to fix_recipe (NOT recipe_overview, NOT init_recipe):
  - "I want a recipe for 1 cup of rice"     (user is inside an active sushi recipe -> scale sushi down to 1 cup rice)
  - "use 2 eggs instead of 3"                (swap quantity in current recipe)
  - "less salt"                              (reduce salt in current recipe)
  - "can I replace butter with oil"          (substitute in current recipe)
  - "make it smaller"                        (halve the current recipe)
  - "I only have 100g of cheese"             (adjust current recipe to match)
  - "I prefer more sauce"                    (increase an ingredient in current recipe)

Concrete examples that MUST route to switch_recipe (see STATE 9):
  - "I want a new recipe"
  - "forget this, cook something else"
  - "give me a different recipe"
  - "cancel this and start over"
  - "נעבור למתכון חדש"

What to do in STATE 4:
1. Read CURRENT RECIPE STATE carefully -- you have the recipe_title, ingredients, full all_steps, current_idx and remaining_planned_steps.
2. Apply the user's change to the EXISTING recipe (keep the same dish). If they asked to use less rice, that is still the SAME sushi recipe with a smaller rice quantity, NOT a plain rice recipe.
3. Acknowledge what you changed in reply_message (short, in {target_lang}).
4. Regenerate the REMAINING steps from current_idx onward with the adjustment baked in. Preserve the dish identity (sushi stays sushi, cheesecake stays cheesecake).
5. Also update remaining timers for those new steps.

{{
  "intent": "fix_recipe",
  "reply_message": "<short advice in {target_lang}, e.g. 'Scaling sushi down to 1 cup of rice. Adjusting remaining steps.'>",
  "updated_remaining_steps": ["<step N in {target_lang}>", "<step N+1 in {target_lang}>"],
  "updated_remaining_timers": [{{"step_index": 0, "minutes": 15, "label": "<{target_lang}>"}}]
}}

=====================================================================
[STATE 5 - ADD MISSING INGREDIENTS TO SHOPPING LIST]
=====================================================================
Trigger: User confirms they want the missing items added to the shopping list.

ABSOLUTE NO-QUESTION RULE:
You must NEVER ask the user whether to increase / raise / change quantities.
You must NEVER say "do you want to increase the quantity of X" or any paraphrase of it.
You must NEVER return intent "reply" or "clarify" here -- only "shopping_sync".
The user has ALREADY approved adding the missing ingredients. They edit quantities manually in the shopping-list UI if needed.

CRITICAL QUANTITY EXTRACTION RULE:
Look back at YOUR previous "recipe_overview" turn in this conversation. You built a "missing" array where each entry had qty_needed like "200 גרם" or "3 יחידות" or "5 דפים". For EACH of those missing items, extract the FIRST integer you see in qty_needed and put it in requested_qty. Put the remaining text (the unit) in "unit".

WORKED EXAMPLE (follow this pattern EXACTLY):
Suppose the recipe_overview missing list was:
  {{"name": "סלמון טרי", "qty_needed": "200 גרם"}}
  {{"name": "אורז סושי", "qty_needed": "300 גרם"}}
  {{"name": "אצות נורי", "qty_needed": "5 דפים"}}
  {{"name": "חומץ אורז", "qty_needed": "50 מ״ל"}}
  {{"name": "סוכר", "qty_needed": "2 כפות"}}
  {{"name": "מלח", "qty_needed": "1 כפית"}}
  {{"name": "ווסאבי", "qty_needed": "10 גרם"}}
  {{"name": "אבוקדו", "qty_needed": "1 יחידה"}}

Your shopping_sync JSON MUST be:
{{
  "intent": "shopping_sync",
  "items_to_add": [
    {{"item_name": "סלמון טרי",  "requested_qty": 200, "unit": "גרם",  "category": "Seafood",  "sub_category": ""}},
    {{"item_name": "אורז סושי",   "requested_qty": 300, "unit": "גרם",  "category": "Pantry",   "sub_category": ""}},
    {{"item_name": "אצות נורי",   "requested_qty": 5,   "unit": "דפים", "category": "Pantry",   "sub_category": ""}},
    {{"item_name": "חומץ אורז",   "requested_qty": 50,  "unit": "מ״ל",  "category": "Pantry",   "sub_category": ""}},
    {{"item_name": "סוכר",        "requested_qty": 2,   "unit": "כפות", "category": "Pantry",   "sub_category": ""}},
    {{"item_name": "מלח",         "requested_qty": 1,   "unit": "כפית", "category": "Pantry",   "sub_category": ""}},
    {{"item_name": "ווסאבי",      "requested_qty": 10,  "unit": "גרם",  "category": "Pantry",   "sub_category": ""}},
    {{"item_name": "אבוקדו",      "requested_qty": 1,   "unit": "יחידה","category": "Produce",  "sub_category": ""}}
  ],
  "spoken_confirmation": "הוספתי לרשימת הקניות סלמון 200 גרם אורז סושי 300 גרם נורי 5 דפים חומץ אורז 50 מ״ל סוכר 2 כפות מלח 1 כפית ווסאבי 10 גרם ואבוקדו 1 יחידה"
}}

⚠ NEVER hardcode requested_qty=1. Pulling the FIRST number from qty_needed is MANDATORY.
⚠ The spoken_confirmation MUST list every item WITH its quantity and unit in {target_lang}.

=====================================================================
[STATE 6 - SAVE CURRENT RECIPE TO DB]
=====================================================================
Trigger: The user says ANYTHING that expresses a wish to save/store/keep the recipe for later use. Examples in any language:
  - "save this recipe"
  - "save the recipe"
  - "save it in your DB"
  - "keep this recipe"
  - "save the recipe as X" (user names it)

ABSOLUTE RULES:
- You MUST return intent "save_recipe".
- You must NEVER ask the user WHERE to save. The recipes database is a single internal SQLite file managed by this integration -- there is no choice of location.
- You must NEVER suggest creating a sub-location, folder, or path for the recipe. That is inventory-agent behaviour and does NOT apply to recipes.
- The code will read the FULL steps/ingredients/timers directly from CURRENT RECIPE STATE -- you do NOT need to re-emit them. Send an EMPTY "steps": [] array; the agent will substitute the real ones from state.
- The ONLY field you MUST extract correctly is "recipe_name" -- this is usually given by the user in the message itself ("save as X" / "שמור בשם X"). If not given, use the recipe_title from CURRENT RECIPE STATE.

{{
  "intent": "save_recipe",
  "recipe_name": "<name the user provided, or recipe_title from state>",
  "ingredients": [],
  "steps": [],
  "timers": [],
  "tags": ["<lowercase tag>", "<lowercase tag>"],
  "spoken_confirmation": "<short in {target_lang}, e.g. 'Saved the recipe'>"
}}

=====================================================================
[STATE 8 - JUMP TO A SPECIFIC STEP]
=====================================================================
CRITICAL Trigger: The CURRENT RECIPE STATE has a non-empty "steps" array AND the user asks to jump/skip/go to a specific NUMBERED step. Examples in any language:
  - "skip to step 4"
  - "go to step 3"
  - "jump to step 2"
  - "go back to step 1"
  - "קפוץ לשלב 4"
  - "לך לשלב 3"
  - "חזור לשלב 2"
  - "תעבור לשלב 5"

You MUST extract the integer step number mentioned by the user. 1-based counting: step 1 is the first step, step 2 is the second, etc.

If the user asks to jump when CURRENT RECIPE STATE has NO steps (overview-only), DO NOT return jump_to_step — that is an error condition. Instead return intent "init_recipe" to rebuild the recipe first.

Output JSON:
{{
  "intent": "jump_to_step",
  "step_number": <integer 1-based, MANDATORY>,
  "spoken_confirmation": "<short in {target_lang}, e.g. 'Jumping to step 4'>"
}}

=====================================================================

=====================================================================
[STATE 7 - MANUAL DICTATION MODE START]
=====================================================================
Trigger: User wants to dictate a new recipe themselves (e.g. "add a new recipe").
{{
  "intent": "manual_start",
  "recipe_name": "<short name in {target_lang}, best guess from the request>",
  "spoken_prompt": "<Ask in {target_lang}: Okay let's build <name>. Tell me the first step, and say done when finished.>"
}}

=====================================================================
[STATE 9 - CONFIRM SWITCHING AWAY FROM ACTIVE RECIPE]
=====================================================================
Trigger: CURRENT RECIPE STATE has active all_steps AND the user EXPLICITLY asks for a different recipe using phrases like "new recipe", "different recipe", "switch recipe", "cancel this", "forget this recipe", "never mind", etc.

Do NOT silently switch -- ask the user to confirm first.

{{
  "intent": "confirm_switch_recipe",
  "new_recipe_hint": "<short name of the new dish they mentioned, or empty>",
  "spoken_question": "<Ask in {target_lang}, e.g.: We are in the middle of <current recipe>. Want to switch to <new dish> and lose progress?>"
}}

If the user confirms on the next turn, the agent will clear state and produce the normal recipe_overview / init_recipe flow for the new dish.

JSON ONLY:"""


def get_dictation_prompt(target_lang, history_text, working_recipe_str,
                        last_user_msg):
    return f"""You are recording a NEW recipe dictated by the user, step by step.

CURRENT WORKING RECIPE (in progress):
{working_recipe_str}

USER'S LATEST MESSAGE:
{last_user_msg}

CHAT HISTORY:
{history_text}

Your job: interpret the user's latest message and return EXACTLY ONE JSON intent below. Keep language in {target_lang}.

1. If the user is giving a new step (most common):
{{"intent": "add_step", "step_text": "<the step in {target_lang}>", "timer_minutes": <integer, 0 if no explicit wait time>, "timer_label": "<short label in {target_lang} or empty>", "spoken_ack": "<short ack in {target_lang}, e.g. Got it, step 3 recorded. Next?>"}}

2. If the user says they are DONE / finished / save:
{{"intent": "finish", "spoken_confirmation": "<short in {target_lang}>"}}

3. If the user wants to REMOVE the last step / undo:
{{"intent": "undo_step", "spoken_ack": "<short in {target_lang}>"}}

4. If the user wants to cancel/abandon the dictation entirely:
{{"intent": "cancel", "spoken_ack": "<short in {target_lang}>"}}

5. If the user says something unrelated that is clearly not a step:
{{"intent": "clarify", "spoken_question": "<Ask in {target_lang} to state the next step or say done>"}}

JSON ONLY:"""


# ==========================================
# CONSTANTS & HELPERS
# ==========================================
HINT_MAP = {
    "Hebrew":  "\n\n(\u05d0\u05de\u05e8\u05d9 '\u05d4\u05de\u05e9\u05da' \u05db\u05d3\u05d9 \u05dc\u05d4\u05ea\u05e7\u05d3\u05dd)",
    "English": "\n\n(Say 'next' to continue)",
    "Spanish": "\n\n(Di 'siguiente' para continuar)",
    "French":  "\n\n(Dites 'suivant' pour continuer)",
    "Italian": "\n\n(Di 'prossimo' per continuare)",
    "German":  "\n\n(Sag 'weiter' um fortzufahren)",
    "Russian": "\n\n(\u0421\u043a\u0430\u0436\u0438\u0442\u0435 '\u0434\u0430\u043b\u044c\u0448\u0435' \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c)",
    "Portuguese": "\n\n(Diga 'proximo' para continuar)",
    "Arabic":  "\n\n(\u0642\u0644 '\u062a\u0627\u0644\u064a' \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629)",
    "Dutch":   "\n\n(Zeg 'volgende' om door te gaan)",
}

STEP_LABEL_MAP = {
    "Hebrew":  "\u05e9\u05dc\u05d1",
    "English": "Step",
    "Spanish": "Paso",
    "French":  "Etape",
    "Italian": "Passo",
    "German":  "Schritt",
    "Russian": "\u0428\u0430\u0433",
    "Portuguese": "Passo",
    "Arabic":  "\u062e\u0637\u0648\u0629",
    "Dutch":   "Stap",
}

DICTATION_STATE_KEY = "HO_RECIPE_DICTATION"


def _clean_loc(s):
    if not s:
        return ""
    s = str(s)
    s = re.sub(r"\[.*?\]", "", s)
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"(?i)ORDER_?MARKER_?\d+", "", s)
    s = re.sub(r"(?i)ZONE_?MARKER_?\d+", "", s)
    s = s.replace(">", "").replace("-", "").replace("|", "").strip()
    return s


def _build_inventory_context(rows):
    lines = []
    for r in rows:
        name = r.get("name", "Unknown")
        qty = r.get("quantity", 0)
        locs = [_clean_loc(r.get(f"level_{i}")) for i in range(1, 4)
                if r.get(f"level_{i}")]
        locs = [l for l in locs if l.strip()]
        loc_str = " ".join(locs)
        lines.append(f"- {name}: {qty} ({loc_str})")
    return "\n".join(lines) if lines else "(empty)"


def _format_saved_suggestions(matches):
    if not matches:
        return "(no saved recipes match this query)"
    lines = []
    for m in matches:
        n_steps = len(m.get("steps") or [])
        lines.append(
            f"- id={m['id']} | name={m['name']} | "
            f"lang={m['language']} | steps={n_steps} | "
            f"use_count={m.get('use_count') or 0}"
        )
    return "\n".join(lines)


def _timer_for_step(timers, step_idx):
    if not timers:
        return None
    for t in timers:
        try:
            if int(t.get("step_index")) == step_idx:
                return t
        except (ValueError, TypeError):
            continue
    return None


JUMP_VERBS = [
    "jump", "skip", "go to", "goto", "navigate", "step",
    "\u05e7\u05e4\u05d5\u05e5",
    "\u05e7\u05e4\u05e6\u05d9",
    "\u05dc\u05da",
    "\u05dc\u05db\u05d9",
    "\u05e2\u05d1\u05d5\u05e8",
    "\u05e2\u05d1\u05e8\u05d9",
    "\u05d7\u05d6\u05d5\u05e8",
    "\u05d7\u05d6\u05e8\u05d9",
    "\u05ea\u05e2\u05d1\u05d5\u05e8",
    "\u05e9\u05dc\u05d1",
    "salta", "saltar", "paso", "pasar", "al paso",
    "passer", "aller", "etape", "a l'etape",
    "passa", "passo", "al passo",
    "\u043f\u0435\u0440\u0435\u0439\u0434\u0438",
    "\u0448\u0430\u0433",
    "\u0627\u0646\u062a\u0642\u0644",
    "\u062e\u0637\u0648\u0629",
    "springe", "schritt",
]


def _detect_jump_step(msg):
    if not msg:
        return None
    low = msg.strip().lower()

    has_verb = any(v in low for v in JUMP_VERBS)
    if not has_verb:
        return None

    m = re.search(r"\b(\d{1,3})\b", low)
    if not m:
        return None

    try:
        n = int(m.group(1))
        if 1 <= n <= 100:
            return n
    except ValueError:
        pass
    return None


def _render_recipe_overview(parsed, target_lang):
    title = parsed.get("recipe_title") or "the recipe"
    have = parsed.get("have") or []
    missing = parsed.get("missing") or []
    steps = parsed.get("steps") or []
    question = parsed.get("follow_up_question") or ""

    headers = {
        "Hebrew":  ("\u05d9\u05e9 \u05dc\u05da:",
                    "\u05d7\u05e1\u05e8 \u05dc\u05da:",
                    "\u05d0\u05d5\u05e4\u05df \u05d4\u05db\u05e0\u05d4:"),
        "English": ("You already have:", "You are missing:", "Preparation:"),
        "Spanish": ("Ya tienes:", "Te falta:", "Preparacion:"),
        "French":  ("Tu as deja:", "Il te manque:", "Preparation:"),
        "Italian": ("Hai gia:", "Ti manca:", "Preparazione:"),
        "German":  ("Du hast bereits:", "Dir fehlt:", "Zubereitung:"),
        "Russian": ("\u0423 \u0432\u0430\u0441 \u0435\u0441\u0442\u044c:",
                    "\u0412\u0430\u043c \u043d\u0443\u0436\u043d\u043e:",
                    "\u041f\u0440\u0438\u0433\u043e\u0442\u043e\u0432\u043b\u0435\u043d\u0438\u0435:"),
        "Portuguese": ("Voce ja tem:", "Falta:", "Preparo:"),
        "Arabic":  ("\u0644\u062f\u064a\u0643:",
                    "\u064a\u0646\u0642\u0635\u0643:",
                    "\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062a\u062d\u0636\u064a\u0631:"),
        "Dutch":   ("Je hebt al:", "Je mist:", "Bereiding:"),
    }
    have_header, miss_header, prep_header = headers.get(
        target_lang, headers["English"]
    )

    parts = [f"🍰 {title}"]

    if have:
        parts.append(f"\n{have_header}")
        for it in have:
            nm = it.get("name", "")
            qn = it.get("qty_needed", "")
            loc = it.get("location", "")
            loc_tail = f" ({loc})" if loc else ""
            parts.append(f"- {nm} {qn}{loc_tail}")
    else:
        parts.append(f"\n{have_header} -")

    if missing:
        parts.append(f"\n{miss_header}")
        for it in missing:
            nm = it.get("name", "")
            qn = it.get("qty_needed", "")
            parts.append(f"- {nm} {qn}")
    else:
        parts.append(f"\n{miss_header} -")

    if steps:
        parts.append(f"\n{prep_header}")
        for s in steps:
            parts.append(str(s))

    if question:
        parts.append(f"\n{question}")
    return "\n".join(parts)


async def _schedule_auto_timer(hass, timer, device_id, user_id, now):
    try:
        minutes = int(timer.get("minutes") or 0)
    except (ValueError, TypeError):
        minutes = 0
    if minutes <= 0:
        return ""

    label = (timer.get("label") or "").strip() or f"Timer ({minutes} min)"
    fire_at = now + timedelta(minutes=minutes)
    fire_iso = fire_at.strftime("%Y-%m-%dT%H:%M:%S")

    try:
        rid = await reminders_store.async_insert(
            hass,
            target_timestamp=fire_iso,
            message=f"⏰ {label}",
            device_id=device_id,
            user_id=user_id,
            entry_type="cooking_timer",
        )
        reminders_scheduler.async_schedule(
            hass, rid, fire_at, f"⏰ {label}", device_id, user_id
        )
        _LOGGER.info(
            f"[HO-COOKING] Auto-timer set | id={rid} | "
            f"minutes={minutes} | label={label!r}"
        )
        return f"⏱ Timer set for {minutes} minutes: {label}\n\n"
    except Exception as e:
        _LOGGER.error(f"[HO-COOKING] auto-timer failed: {e}", exc_info=True)
        return ""


async def _push_to_shopping_list(hass, items_to_add, loc_hierarchy_map):
    from . import shopping_agent

    default_loc_id = ""
    if loc_hierarchy_map:
        default_loc_id = next(iter(loc_hierarchy_map.keys()))

    qty_map = {}
    items_payload = []
    for it in items_to_add or []:
        nm = str(it.get("item_name") or it.get("name") or "").strip()
        if not nm:
            continue

        try:
            qty = int(it.get("requested_qty") or it.get("qty") or 0)
        except (ValueError, TypeError):
            qty = 0

        if qty <= 1:
            qty_hint = str(
                it.get("qty_needed")
                or it.get("qty_string")
                or it.get("qty")
                or ""
            )
            m = re.search(r"\d+", qty_hint)
            if m:
                try:
                    parsed = int(m.group(0))
                    if parsed > 0:
                        qty = parsed
                except ValueError:
                    pass

        if qty <= 0:
            qty = 1

        unit = (it.get("unit") or "").strip()

        if not unit:
            qty_hint = str(it.get("qty_needed") or it.get("qty") or "")
            m = re.search(r"\d+\s*(.*)", qty_hint)
            if m:
                derived = m.group(1).strip()
                if derived:
                    unit = derived

        sub_cat = it.get("sub_category") or ""
        if unit and not sub_cat:
            sub_cat = unit

        qty_map[nm] = qty
        items_payload.append({
            "item_name": nm,
            "requested_qty": qty,
            "location_id": it.get("location_id") or default_loc_id,
            "sub_location": "",
            "category": it.get("category") or "General",
            "sub_category": sub_cat,
            "icon_key": it.get("icon_key") or "",
        })

    if not items_payload:
        return "No valid items to add."

    _LOGGER.info(
        f"[HO-COOKING] shopping push payload qtys: "
        f"{[(p['item_name'], p['requested_qty'], p.get('sub_category', '')) for p in items_payload]}"
    )

    try:
        first_pass = await shopping_agent.execute_tool(
            hass, "manage_shopping_list",
            {"items": items_payload},
            loc_hierarchy_map or {},
        )
    except Exception as e:
        _LOGGER.error(f"[HO-COOKING] shopping push failed: {e}", exc_info=True)
        return f"Error adding items: {e}"

    first_pass_str = str(first_pass or "")
    ask_user_names = []
    if "ALREADY out of stock" in first_pass_str or "ASK_USER" in first_pass_str:
        for nm in qty_map.keys():
            if nm in first_pass_str:
                if (f"added existing '{nm}'" not in first_pass_str and
                        f"created '{nm}'" not in first_pass_str):
                    ask_user_names.append(nm)

    resolved = []
    for nm in ask_user_names:
        try:
            r = await shopping_agent.execute_tool(
                hass, "update_shopping_order_qty",
                {"item_name": nm, "new_qty": qty_map[nm]},
                loc_hierarchy_map or {},
            )
            resolved.append(str(r))
            _LOGGER.info(
                f"[HO-COOKING] Auto-updated existing shopping qty | "
                f"name={nm!r} | qty={qty_map[nm]}"
            )
        except Exception as e:
            _LOGGER.error(
                f"[HO-COOKING] update_shopping_order_qty failed for "
                f"{nm!r}: {e}"
            )

    if resolved:
        return first_pass_str + " " + " ".join(resolved)
    return first_pass_str


def _detect_dish_query(last_user_msg):
    if not last_user_msg:
        return ""
    txt = last_user_msg.strip()
    tokens = re.split(r"\s+", txt)
    while tokens and len(tokens[0]) <= 3:
        tokens.pop(0)
    return " ".join(tokens).strip() or txt


def _extract_suggested_saved_id(messages):
    for m in reversed(messages):
        if (m.get("role") == "system"
                and isinstance(m.get("content"), str)
                and m["content"].startswith("HO_SAVED_SUGGEST:")):
            return m["content"].split("HO_SAVED_SUGGEST:", 1)[1].strip()
    return None


AFFIRMATIVE_LEXEMES = [
    "yes", "yeah", "yep", "sure", "ok", "okay",
    "use it", "load it", "pull it up", "go ahead", "use the saved",
]


def _looks_affirmative(msg):
    if not msg:
        return False
    m = msg.strip().lower()
    return any(lx in m for lx in AFFIRMATIVE_LEXEMES)


async def _load_saved_into_state(hass, saved, messages, next_hint, now,
                                device_id, user_id):
    state = {
        "steps": saved.get("steps") or [],
        "current_idx": 0,
        "timers": saved.get("timers") or [],
        "ingredients": saved.get("ingredients") or [],
        "recipe_title": saved.get("name") or "Saved recipe",
        "language": saved.get("language") or "en",
        "source_type": "loaded_from_db",
        "recipe_id": saved.get("id"),
    }
    write_state(messages, COOKING_STATE_KEY, state)

    messages[:] = [
        m for m in messages
        if not (m.get("role") == "system"
                and isinstance(m.get("content"), str)
                and m["content"].startswith("HO_SAVED_SUGGEST:"))
    ]

    if not state["steps"]:
        return "The saved recipe has no steps. Try another."

    banner = ""
    t0 = _timer_for_step(state["timers"], 0)
    if t0:
        banner = await _schedule_auto_timer(
            hass, t0, device_id, user_id, now
        )

    return f"{banner}{state['steps'][0]}{next_hint}"


async def _auto_save_completed_recipe(hass, recipe_state, lang_code):
    if not recipe_state:
        return
    if recipe_state.get("source_type") == "loaded_from_db":
        rid = recipe_state.get("recipe_id")
        if rid:
            await recipes_db.async_touch(hass, rid)
        return

    steps = recipe_state.get("steps") or []
    if not steps:
        return

    rname = recipe_state.get("recipe_title") or "Untitled"
    try:
        rid, action = await recipes_db.async_save(
            hass,
            name=rname,
            ingredients=recipe_state.get("ingredients") or [],
            steps=steps,
            timers=recipe_state.get("timers") or [],
            language=lang_code,
            tags=[],
            source_type=recipe_state.get("source_type", "ai_generated"),
        )
        _LOGGER.info(
            f"[HO-COOKING] Auto-saved completed recipe | id={rid} | "
            f"action={action} | name={rname!r}"
        )
    except Exception as e:
        _LOGGER.error(f"[HO-COOKING] auto-save failed: {e}", exc_info=True)


# ==========================================
# DICTATION HANDLER
# ==========================================
async def _handle_dictation_turn(hass, entry, messages, target_lang,
                                history_text, last_user_msg,
                                dictation_state, lang_code, strings):
    working_str = json.dumps(dictation_state, ensure_ascii=False)
    prompt = get_dictation_prompt(
        target_lang, history_text, working_str, last_user_msg or ""
    )

    raw, err = await safe_smart_router(hass, entry, prompt)
    if err or not raw:
        return f"❌ Dictation error: {err}"

    parsed = safe_parse_json(raw)
    if not parsed:
        return "I did not catch that. Please repeat the next step, or say 'done'."

    intent = str(parsed.get("intent", "")).lower()

    if intent == "add_step":
        step_text = (parsed.get("step_text") or "").strip()
        if not step_text:
            return parsed.get("spoken_ack") or "Go ahead with the next step."

        idx = len(dictation_state["steps"])
        step_label = STEP_LABEL_MAP.get(target_lang, "Step")
        dictation_state["steps"].append(f"{step_label} {idx + 1}: {step_text}")

        try:
            minutes = int(parsed.get("timer_minutes") or 0)
        except (ValueError, TypeError):
            minutes = 0
        if minutes > 0:
            label = (parsed.get("timer_label") or step_text)[:80]
            dictation_state["timers"].append({
                "step_index": idx,
                "minutes": minutes,
                "label": label,
            })

        write_state(messages, DICTATION_STATE_KEY, dictation_state)
        return parsed.get("spoken_ack") or f"{step_label} {idx + 1} recorded. Next?"

    if intent == "undo_step":
        if dictation_state["steps"]:
            removed_idx = len(dictation_state["steps"]) - 1
            dictation_state["steps"].pop()
            dictation_state["timers"] = [
                t for t in dictation_state["timers"]
                if int(t.get("step_index", -1)) != removed_idx
            ]
            write_state(messages, DICTATION_STATE_KEY, dictation_state)
        return parsed.get("spoken_ack") or "Removed the last step. Continue?"

    if intent == "cancel":
        clear_state(messages, DICTATION_STATE_KEY)
        return parsed.get("spoken_ack") or "Dictation cancelled."

    if intent == "finish":
        rname = dictation_state.get("recipe_name") or "My recipe"
        steps = dictation_state.get("steps") or []
        timers = dictation_state.get("timers") or []

        if not steps:
            clear_state(messages, DICTATION_STATE_KEY)
            return "No steps were recorded - nothing to save."

        rid, action = await recipes_db.async_save(
            hass,
            name=rname,
            ingredients=[],
            steps=steps,
            timers=timers,
            language=lang_code,
            tags=[],
            source_type="user_manual",
        )
        _LOGGER.info(
            f"[HO-COOKING] Manual recipe saved | id={rid} | "
            f"steps={len(steps)} | timers={len(timers)}"
        )
        clear_state(messages, DICTATION_STATE_KEY)

        return (parsed.get("spoken_confirmation")
                or f"✅ Saved '{rname}' with {len(steps)} steps.")

    return (parsed.get("spoken_question")
            or "Please tell me the next step, or say 'done' when finished.")


# ==========================================
# MAIN RUN LOOP
# ==========================================
async def run(hass, entry, messages, target_lang, existing_locs_str,
              loc_hierarchy_map, history_text, last_user_msg, recipe_name,
              is_voice, device_id, user_id, lang_code="en"):

    strings = await get_strings_for_language(hass, entry, lang_code)
    next_hint = HINT_MAP.get(target_lang, HINT_MAP["English"])
    now = dt_util.now()

    recipe_state = read_state(messages, COOKING_STATE_KEY)
    dictation_state = read_state(messages, DICTATION_STATE_KEY)

    _LOGGER.info(
        f"[HO-COOKING] Turn start | recipe_active={bool(recipe_state)} | "
        f"dictating={bool(dictation_state)} | "
        f"idx={(recipe_state or {}).get('current_idx', 'N/A')} | "
        f"last_user_msg={last_user_msg!r}"
    )

    if dictation_state:
        return await _handle_dictation_turn(
            hass, entry, messages, target_lang, history_text,
            last_user_msg, dictation_state, lang_code, strings
        )

    jump_target = _detect_jump_step(last_user_msg)
    if jump_target is not None and recipe_state and recipe_state.get("steps"):
        steps = recipe_state.get("steps") or []
        timers = recipe_state.get("timers") or []

        if 1 <= jump_target <= len(steps):
            new_idx = jump_target - 1
            recipe_state["current_idx"] = new_idx
            write_state(messages, COOKING_STATE_KEY, recipe_state)
            _LOGGER.info(
                f"[HO-COOKING] JUMP FAST-LANE | step={jump_target} | "
                f"idx={new_idx}"
            )
            banner = ""
            t = _timer_for_step(timers, new_idx)
            if t:
                banner = await _schedule_auto_timer(
                    hass, t, device_id, user_id, now
                )
            return f"{banner}{steps[new_idx]}{next_hint}"
        else:
            _LOGGER.warning(
                f"[HO-COOKING] JUMP out of range: "
                f"requested={jump_target}, total_steps={len(steps)}"
            )
            return (
                f"\u05d4\u05e9\u05dc\u05d1 {jump_target} "
                f"\u05dc\u05d0 \u05e7\u05d9\u05d9\u05dd. "
                f"\u05d9\u05e9 {len(steps)} \u05e9\u05dc\u05d1\u05d9\u05dd "
                f"\u05d1\u05de\u05ea\u05db\u05d5\u05df."
            ) if target_lang == "Hebrew" else (
                f"Step {jump_target} does not exist. "
                f"Recipe has {len(steps)} steps."
            )

    has_active_steps = bool(
        recipe_state and (recipe_state.get("steps") or [])
    )

    is_continuation = False
    if has_active_steps and last_user_msg:
        check_prompt = (
            f"User message: '{last_user_msg}'.\n"
            "Does the user want to continue to the next step (e.g. 'next', "
            "'ready', 'done', 'continue', 'ok', including typos in any "
            "language), OR are they asking a question / reporting a mistake?\n"
            "Reply ONLY with the word 'CONTINUE' or 'QUESTION'."
        )
        check_res, _ = await async_smart_router(hass, entry, check_prompt)
        if check_res and "CONTINUE" in check_res.upper():
            is_continuation = True

    if has_active_steps and is_continuation:
        current_idx = recipe_state.get("current_idx", 0) + 1
        steps = recipe_state.get("steps", [])
        timers = recipe_state.get("timers", [])

        if current_idx < len(steps):
            recipe_state["current_idx"] = current_idx
            write_state(messages, COOKING_STATE_KEY, recipe_state)

            banner = ""
            t = _timer_for_step(timers, current_idx)
            if t:
                banner = await _schedule_auto_timer(
                    hass, t, device_id, user_id, now
                )

            return f"{banner}{steps[current_idx]}{next_hint}"

        finished_msg = f"🎉 {strings['cooking_finished']}"
        await _auto_save_completed_recipe(hass, recipe_state, lang_code)
        write_state(
            messages, COOKING_STATE_KEY, {"steps": [], "current_idx": 0}
        )
        return finished_msg

    saved_matches = []
    if not recipe_state and last_user_msg:
        dish_query = _detect_dish_query(last_user_msg) or recipe_name
        saved_matches = await recipes_db.async_find_by_name(
            hass, dish_query, language=lang_code, limit=3
        )

    suggested_id = _extract_suggested_saved_id(messages)
    if suggested_id and _looks_affirmative(last_user_msg):
        loaded = await recipes_db.async_get_by_id(hass, suggested_id)
        if loaded:
            await recipes_db.async_touch(hass, suggested_id)
            return await _load_saved_into_state(
                hass, loaded, messages, next_hint, now, device_id, user_id
            )

    async def _async_get_all_inventory(hass):
        try:
            db_path = get_db_path(hass)
            async with aiosqlite.connect(db_path, timeout=10.0) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute("SELECT * FROM items WHERE type='item' AND quantity > 0") as cursor:
                    rows = await cursor.fetchall()
                    return [dict(row) for row in rows]
        except Exception:
            return []

    rows = await _async_get_all_inventory(hass)
    inventory_context = _build_inventory_context(rows)

    state_str = "None"
    if recipe_state:
        curr = recipe_state.get("current_idx", 0)
        stps = recipe_state.get("steps", [])
        ings = recipe_state.get("ingredients", [])
        tims = recipe_state.get("timers", [])
        title = recipe_state.get("recipe_title", "")
        state_str = json.dumps(
            {
                "recipe_title": title,
                "current_idx": curr,
                "all_steps": stps,
                "remaining_planned_steps": stps[curr:],
                "ingredients": ings,
                "timers": tims,
            },
            ensure_ascii=False,
        )

    prompt = get_cooking_prompt(
        inventory_context, recipe_name, target_lang,
        history_text, state_str,
        _format_saved_suggestions(saved_matches),
    )

    raw_res, err = await safe_smart_router(
        hass, entry, apply_voice_rules(prompt, is_voice, target_lang)
    )
    if err or not raw_res:
        _LOGGER.error(f"[HO-COOKING] LLM router error: {err}")
        return f"❌ {strings['cooking_engine_error']} ({err})"

    parsed = safe_parse_json(raw_res)
    if not parsed:
        _LOGGER.debug(
            "[HO-COOKING] JSON parse failed (%d chars returned)",
            len(raw_res or ""),
        )
        return raw_res

    intent_str = str(parsed.get("intent", "")).replace("-", "_").lower()
    _LOGGER.info(f"[HO-COOKING] Parsed intent={intent_str!r}")

    if intent_str in ("suggest_saved", "suggestsaved"):
        saved_id = parsed.get("saved_id")
        saved_name = parsed.get("saved_name") or "the saved recipe"
        spoken = (parsed.get("spoken_question")
                  or f"I have a saved recipe for {saved_name}. Use it?")
        messages.append({
            "role": "system",
            "content": f"HO_SAVED_SUGGEST:{saved_id}",
        })
        return spoken

    switch_pending = any(
        m.get("role") == "system"
        and isinstance(m.get("content"), str)
        and m["content"].startswith("HO_SWITCH_PENDING:")
        for m in messages
    )
    user_confirmed_switch = (
        switch_pending and _looks_affirmative(last_user_msg)
    )

    if user_confirmed_switch:
        clear_state(messages, COOKING_STATE_KEY)
        messages[:] = [
            m for m in messages
            if not (m.get("role") == "system"
                    and isinstance(m.get("content"), str)
                    and m["content"].startswith("HO_SWITCH_PENDING:"))
        ]
        recipe_state = None
        has_active_steps = False
        _LOGGER.info("[HO-COOKING] User confirmed switch — state cleared.")

    if (
        has_active_steps
        and not user_confirmed_switch
        and intent_str in (
            "recipe_full", "recipefull",
            "recipe_overview", "recipeoverview",
            "init_recipe", "initrecipe",
        )
    ):
        _LOGGER.info(
            f"[HO-COOKING] SAFETY: LLM returned {intent_str!r} during "
            f"active cooking. Coercing to fix_recipe to preserve the "
            f"original recipe identity."
        )
        coerced = {
            "intent": "fix_recipe",
            "reply_message": (
                parsed.get("follow_up_question")
                or parsed.get("spoken_confirmation")
                or "Adjusting the current recipe."
            ),
            "updated_remaining_steps": (
                parsed.get("steps")
                or recipe_state.get("steps", [])[recipe_state.get("current_idx", 0):]
            ),
            "updated_remaining_timers": parsed.get("timers") or [],
        }
        parsed = coerced
        intent_str = "fix_recipe"

    if intent_str in ("recipe_full", "recipefull",
                      "recipe_overview", "recipeoverview"):
        full_steps = parsed.get("steps") or []
        full_timers = parsed.get("timers") or []
        full_have = parsed.get("have") or []
        full_missing = parsed.get("missing") or []
        full_ingredients = [
            {"name": h.get("name", ""), "qty": h.get("qty_needed", "")}
            for h in full_have
        ] + [
            {"name": m.get("name", ""), "qty": m.get("qty_needed", "")}
            for m in full_missing
        ]

        overview_state = {
            "mode": "overview",
            "current_idx": 0,
            "steps": full_steps,
            "timers": full_timers,
            "ingredients": full_ingredients,
            "recipe_title": parsed.get("recipe_title") or recipe_name,
            "language": lang_code,
            "source_type": "ai_generated",
            "missing": full_missing,
            "have": full_have,
        }
        write_state(messages, COOKING_STATE_KEY, overview_state)
        _LOGGER.info(
            f"[HO-COOKING] STATE 1 rendered full recipe | "
            f"have={len(full_have)} | missing={len(full_missing)} | "
            f"steps={len(full_steps)} | timers={len(full_timers)}"
        )
        return _render_recipe_overview(parsed, target_lang)

    if intent_str in ("init_recipe", "initrecipe"):
        llm_steps = parsed.get("steps") or []
        llm_timers = parsed.get("timers") or []
        llm_ingredients = parsed.get("ingredients") or []

        state_steps = (recipe_state or {}).get("steps") or []
        state_timers = (recipe_state or {}).get("timers") or []
        state_ingredients = (recipe_state or {}).get("ingredients") or []

        steps = state_steps if len(state_steps) >= len(llm_steps) else llm_steps
        timers = (state_timers
                  if len(state_timers) >= len(llm_timers) else llm_timers)
        ingredients = (state_ingredients
                       if len(state_ingredients) >= len(llm_ingredients)
                       else llm_ingredients)

        if not steps:
            return strings["cooking_step_error"]

        state = {
            "steps": steps,
            "current_idx": 0,
            "timers": timers,
            "ingredients": ingredients,
            "recipe_title": (
                (recipe_state or {}).get("recipe_title")
                or parsed.get("recipe_title")
                or recipe_name
            ),
            "language": lang_code,
            "source_type": "ai_generated",
        }
        write_state(messages, COOKING_STATE_KEY, state)
        _LOGGER.info(
            f"[HO-COOKING] STATE 3 init | "
            f"steps={len(steps)} | from_state={len(state_steps) >= len(llm_steps)}"
        )

        banner = ""
        t = _timer_for_step(state["timers"], 0)
        if t:
            banner = await _schedule_auto_timer(
                hass, t, device_id, user_id, now
            )
        return f"{banner}{steps[0]}{next_hint}"

    if intent_str in ("fix_recipe", "fixrecipe"):
        reply_msg = parsed.get("reply_message", "")
        updated_steps = parsed.get("updated_remaining_steps") or []
        updated_timers = parsed.get("updated_remaining_timers") or []
        if not updated_steps:
            return reply_msg

        state = recipe_state or {}
        state["steps"] = updated_steps
        state["current_idx"] = 0
        state["timers"] = updated_timers
        write_state(messages, COOKING_STATE_KEY, state)

        banner = ""
        t = _timer_for_step(updated_timers, 0)
        if t:
            banner = await _schedule_auto_timer(
                hass, t, device_id, user_id, now
            )
        return f"💡 {reply_msg}\n\n{banner}{updated_steps[0]}{next_hint}"

    if intent_str in ("shopping_sync", "shoppingsync", "add_to_shopping"):
        items_to_add = parsed.get("items_to_add") or []
        spoken_conf = (parsed.get("spoken_confirmation") or "").strip()
        if not items_to_add:
            return spoken_conf or "I could not identify missing items to add."
        db_result = await _push_to_shopping_list(
            hass, items_to_add, loc_hierarchy_map
        )
        return spoken_conf or f"✅ {db_result}"

    if intent_str in ("save_recipe", "saverecipe"):
        llm_rname = (parsed.get("recipe_name") or "").strip()
        llm_ingredients = parsed.get("ingredients") or []
        llm_steps = parsed.get("steps") or []
        llm_timers = parsed.get("timers") or []
        llm_tags = parsed.get("tags") or []
        spoken_conf = (parsed.get("spoken_confirmation") or "").strip()

        state_steps = []
        state_ingredients = []
        state_timers = []
        state_name = ""
        if recipe_state:
            state_steps = recipe_state.get("steps") or []
            state_ingredients = recipe_state.get("ingredients") or []
            state_timers = recipe_state.get("timers") or []
            state_name = (recipe_state.get("recipe_title") or "").strip()

        if len(state_steps) >= len(llm_steps):
            final_steps = state_steps
            steps_src = "state"
        else:
            final_steps = llm_steps
            steps_src = "llm"

        if len(state_ingredients) >= len(llm_ingredients):
            final_ingredients = state_ingredients
        else:
            final_ingredients = llm_ingredients

        if steps_src == "state" and state_timers:
            final_timers = state_timers
        elif llm_timers:
            final_timers = llm_timers
        else:
            final_timers = state_timers or llm_timers

        final_name = llm_rname or state_name or recipe_name or "Saved recipe"

        if not final_steps:
            return "❌ Missing recipe steps - cannot save."

        _LOGGER.info(
            f"[HO-COOKING] save_recipe | name={final_name!r} | "
            f"steps_src={steps_src} | steps_count={len(final_steps)} | "
            f"ingredients={len(final_ingredients)} | "
            f"timers={len(final_timers)} | "
            f"llm_steps={len(llm_steps)} | state_steps={len(state_steps)}"
        )

        rid, action = await recipes_db.async_save(
            hass,
            name=final_name,
            ingredients=final_ingredients,
            steps=final_steps,
            timers=final_timers,
            language=lang_code,
            tags=llm_tags,
            source_type=(recipe_state or {}).get("source_type", "ai_generated"),
        )
        _LOGGER.info(
            f"[HO-COOKING] Recipe saved | id={rid} | action={action} | "
            f"name={final_name!r} | steps={len(final_steps)}"
        )
        return spoken_conf or f"✅ Recipe '{final_name}' saved ({action})."

    if intent_str in ("jump_to_step", "jumptostep", "goto_step"):
        if not recipe_state:
            return "❌ No active recipe to jump within."

        steps = recipe_state.get("steps") or []
        timers = recipe_state.get("timers") or []
        try:
            step_number = int(parsed.get("step_number") or 0)
        except (ValueError, TypeError):
            step_number = 0

        if step_number < 1 or step_number > len(steps):
            return (
                f"❌ Step {step_number} is out of range "
                f"(1-{len(steps)})."
            )

        new_idx = step_number - 1 
        recipe_state["current_idx"] = new_idx
        write_state(messages, COOKING_STATE_KEY, recipe_state)

        _LOGGER.info(
            f"[HO-COOKING] Jumped to step {step_number} (idx {new_idx})"
        )

        banner = ""
        t = _timer_for_step(timers, new_idx)
        if t:
            banner = await _schedule_auto_timer(
                hass, t, device_id, user_id, now
            )

        spoken_conf = (parsed.get("spoken_confirmation") or "").strip()
        prefix = f"{spoken_conf}\n\n" if spoken_conf else ""
        return f"{prefix}{banner}{steps[new_idx]}{next_hint}"

    if intent_str in ("manual_start", "manualstart"):
        rname = (parsed.get("recipe_name") or "New recipe").strip()
        prompt_msg = (
            parsed.get("spoken_prompt")
            or f"Okay let's build '{rname}'. Tell me step one, say 'done' when finished."
        )
        write_state(messages, DICTATION_STATE_KEY, {
            "recipe_name": rname,
            "language": lang_code,
            "steps": [],
            "timers": [],
            "ingredients": [],
        })
        return prompt_msg

    if intent_str in ("confirm_switch_recipe", "confirmswitchrecipe",
                      "switch_recipe"):
        spoken_q = (parsed.get("spoken_question") or "").strip()
        hint = (parsed.get("new_recipe_hint") or "").strip()
        messages.append({
            "role": "system",
            "content": f"HO_SWITCH_PENDING:{hint}",
        })
        if spoken_q:
            return spoken_q
        if hint:
            return f"We're in the middle of the current recipe. Switch to {hint} and lose progress?"
        return "We're in the middle of a recipe. Do you want to cancel it and start something new?"

    if intent_str == "reply":
        return parsed.get("message", raw_res)

    return raw_res