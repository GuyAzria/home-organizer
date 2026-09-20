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
# // [MODIFIED v2026.9.19 | 2026-09-19] Purpose: Three fixes to how the
# //   assistant treats the page in front of it. (1) An open recipe with no
# //   steps is an EMPTY PAGE, not a recipe to amend: the model fills it in
# //   full and returns recipe_full, and save_recipe now carries the bound
# //   recipe_id so "write me a caesar salad and save it" writes into the
# //   page the user opened instead of refusing or duplicating. (2) Saving
# //   emits HO_RECIPE_SAVED so the panel can open the new page, which is
# //   what lets a request typed on the contents page ("something for lunch
# //   from what is in my fridge") arrive as a recipe rather than as chat.
# //   (3) Water, salt, oil and pepper are never reported missing - see the
# //   PANTRY STAPLES rule in the prompt. Flour and butter still are.
# //   (4) [FIXED] recipe_full rebuilt the cooking state from scratch and so
# //   threw away the bound recipe_id. The websocket layer then saw a
# //   different id from the panel on the next message, rebuilt the state
# //   from the DATABASE - empty, for a page just created - and destroyed the
# //   recipe that had only just been written. The user could ask to save for
# //   ever and never get a saved recipe. The id now travels with the state,
# //   and a full recipe produced for an EMPTY page is written to that page
# //   at once; a page that already holds steps is never overwritten without
# //   approval. A request to SAVE or UPDATE THE PAGE is also now excluded
# //   from the FIX FIRST rule, which had been swallowing it. A recipe built
# //   for an open page is FROZEN as a proposal and the user approves it - an
# //   earlier pass wrote straight into a blank page, on the reasoning that
# //   filling a blank destroys nothing, which skipped both the approval the
# //   user asked for and the "just this once" choice. Writing without being
# //   asked still happens in exactly one case: nothing is open at all, so
# //   there is no page to protect and the request came from the contents
# //   page, where the whole point was to end up with a new page.
# //   (5) [FIXED] A recipe that has been SHOWN now lives in reference_steps,
# //   not in steps. "steps" means one thing here - a step-by-step cook is
# //   running - and has_active_steps is read straight off it, so a recipe
# //   went from printed to "being cooked" with nothing in between: FIX FIRST
# //   claimed every later message, asking to SAVE was answered by
# //   fix_recipe, and fix_recipe ends by printing step 1. init_recipe and
# //   save_recipe fall back to reference_steps, fix_recipe only runs the
# //   walkthrough when one is actually running, and reference_steps is now
# //   sent to the model at all - the prompt had been asking it about a field
# //   it could not see.
# //   (6) [FIXED] "Add step 6: grate the parmesan" was being read as "jump
# //   to step 6". JUMP_VERBS held the NOUN for step in six languages, so the
# //   jump fast lane matched, printed step 6 and RETURNED - the request was
# //   never read as an intent, which is why no approval buttons appeared.
# //   The list is verbs only now, a jump has to be a short message, and the
# //   verb has to precede the number. Separately, the continuation check
# //   tested for "CONTINUE" as a SUBSTRING, so a model that explained itself
# //   advanced the walkthrough and discarded the message; it reads the first
# //   word now and fails towards QUESTION.
# //   (6b) [FIXED] An adjustment to a recipe being READ - "fewer eggs" on
# //   an open page - was answered by fix_recipe, which revised the text in
# //   the chat and nowhere else: no approval buttons and no change to the
# //   page. fix_recipe now FREEZES a proposal when a recipe is bound and
# //   no walkthrough is running, and the prompt draws the line in one
# //   place: all_steps non-empty is STATE 4, a recipe_id with no
# //   walkthrough is STATE 4b.
# //   (9) Timers are OFFERED, never set behind the cook. A step with a
# //   wait used to create the reminder the moment it came up; a timer
# //   interrupts someone later on their phone and is theirs to agree to.
# //   _offer_timer records the offer and asks; STATE 4e classifies the
# //   answer; _schedule_offered_timer is the ONE place a timer is written,
# //   and it reads the minutes and label from the offer rather than from
# //   the answer (RULE 7). The panel answers through the same function.
# //   (10) [FIXED] init_recipe built its state from scratch and lost
# //   the recipe_id, so the websocket layer rebuilt the binding from
# //   the database on the very next message and emptied "steps". The
# //   walkthrough was gone one press after it began, and "Next step"
# //   was read as a request to CHANGE the recipe - which is why the
# //   approval buttons appeared instead of the next step. Same defect
# //   as the one fixed in recipe_full; this was the other half.
# //   (11) [FIXED] No timer was ever offered for a recipe that came
# //   with the integration or was typed in: those are stored with an
# //   empty timers array, so no step ever had one to offer. STATE 3
# //   now READS the waits out of the step text when the state has no
# //   timers - "stir the tomatoes for 5 minutes" earns a 5 minute
# //   timer - in whatever language the steps are written in.
# //   _timer_for_step was hardened to match: it assumed a list of
# //   dicts, which was safe while timers were only ever copied and
# //   stopped being safe once they are derived from prose.
# //   (12) [FIXED] The timer question was asked twice on screen and in
# //   English: the panel asks it from the translation file, with the two
# //   buttons, so building the same sentence here added nothing and was
# //   stuck on whatever the runtime string cache held. _offer_timer now
# //   speaks only on the VOICE path, where there is no panel to ask.
# //   (13) [FIXED] Fourteen messages this agent says for itself were
# //   English sentences written into the code, so every language except
# //   English got them in English - and the step-out-of-range message was
# //   written twice, in Hebrew and English, which left Italian, Spanish,
# //   French, Arabic and Russian on the English one. All of them now come
# //   from the translated table. None of the new entries carries a
# //   {placeholder}: numbers and dish names are appended by the caller,
# //   because a placeholder inside a translated sentence is one more
# //   thing a translation can lose.
# //   (14) [FIXED] fix_recipe could only rewrite STEPS. "Use 4
# //   tablespoons of olive oil" changed the steps and left the
# //   ingredient list saying 2, so the recipe contradicted itself and
# //   the cook had no way to tell which number was real. STATE 4 now
# //   returns updated_ingredients - the COMPLETE list - and all three
# //   branches use it. A missing or empty list means "unchanged",
# //   never "clear" (RULE 33a.8).
# //   (7) A recipe saved from the chat carried no chapter at all, so
# //   everything the assistant wrote landed under Other. The cookbook's own
# //   chapter list is now put in front of the model and comes back as
# //   "recipe_category"; _resolve_category is the only thing that decides,
# //   it accepts nothing that is not already a chapter - RULE 22 keeps new
# //   top-level categories an explicit user action - and a refusal simply
# //   leaves the recipe unfiled, exactly as before. A recipe that already
# //   sits on a shelf is never re-filed (RULE 33a.8).
# //   (7b) Rewriting a recipe in another language is STATE 4b, not STATE 6.
# //   STATE 6 sends an empty steps array and lets the code supply the
# //   stored ones, so a translation routed there renamed the recipe and
# //   left its ingredients and steps in the old language, with no approval
# //   buttons because save_recipe does not propose. propose_edit now also
# //   carries recipe_name and recipe_language.
# //   (8) The built-in emblem library is removed: EMBLEM_MOTIF_KEYS, the
# //   set_emblem INTENT and the HO_EMBLEM_SET marker are gone, and STATE 4d
# //   now only DESIGNS. Choosing from a fixed library produced the wrong
# //   dish too often - a couscous and a rice were the same bowl. The
# //   drawing-spec path is untouched and is still the only way markup gets
# //   built. The websocket action of the same name, which STORES an emblem,
# //   is a different thing and stays. STATE 4d also fires on a request
# //   with NO description - the panel sends one after a photograph is
# //   deleted, and the title and ingredients are enough to design from.
# // [MODIFIED v2026.9.17 | 2026-09-17] Purpose: Added STATE 4b/4c and the
# //   propose_edit / confirm_edit / cancel_edit intents, so the assistant can
# //   be asked to change a SAVED recipe. It only ever proposes: the change is
# //   frozen in recipe_edits and written by the websocket layer once the user
# //   has approved it and said whether it is for this cook or for keeps. An
# //   unclear answer is never read as "save" (RULE 7, RULE 9, RULE 31).
# //   STATE 4b reads the recipe from reference_steps when one is open but
# //   not being cooked, and propose_edit marks the turn it fired on so an
# //   unanswered proposal cannot re-announce itself on every later message.
# //   Added STATE 4d: the user can ask for a different emblem, and the
# //   model picks a motif and palette from vetted lists - it never draws.
# //   That list now carries specific dishes, not only broad chapters, and
# //   draw_emblem lets the model DRAW one from a description. Its markup
# //   arrives as a DRAWING SPEC - shapes and numbers, never markup - which
# //   validate_emblem_spec rebuilds field by field. The library it can
# //   choose from is now 132 dishes rather than 11 chapters.
# //
# // HOW THIS AGENT PRESENTS A RECIPE - permanent documentation, not a
# // history entry. (RULE 28 caps the history at two entries but keeps
# // notes like this one.)
# // Unified first-turn presentation + free-form
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
from datetime import timedelta

import homeassistant.util.dt as dt_util

from ..database import get_db_path
from ..ai_core.router import safe_smart_router, async_smart_router
from ..ai_core.json_utils import safe_parse_json, apply_voice_rules
from ..ai_core.localized_strings import get_strings_for_language
# [MOVED v2026.9.20] The drawing-spec validator now lives in ai_core: the
# inventory agent draws item icons from the same kind of spec, and one
# allow-list is the only way the two cannot drift (RULE 33d).
from ..ai_core.draw_spec import validate_spec as validate_emblem_spec
from ..ai_core.state_manager import (
    read_state, write_state, clear_state, COOKING_STATE_KEY, TIMER_OFFER_KEY,
)
from .. import recipes_db, reminders_store, reminders_scheduler
# [ADDED v2026.9.17] Holds a proposed change between suggesting and approving.
from .. import recipe_edits


EMBLEM_PALETTE_COUNT = 8

_LOGGER = logging.getLogger(__name__)


# ==========================================
# PROMPTS
# ==========================================
def get_cooking_prompt(inventory_context, recipe_name, target_lang,
                      history_text, current_state_str, saved_suggestions_text,
                      chapters_text="(none)"):
    return f"""You are a strict, interactive Sous-Chef assisting the user with: {recipe_name}.

=== RAW INVENTORY DATA (what the user HAS at home) ===
{inventory_context}
======================================================

=== SAVED RECIPES IN THE USER'S DATABASE ===
{saved_suggestions_text}
============================================

=== CHAPTERS THIS COOKBOOK HAS ===
{chapters_text}
==================================

=== CURRENT RECIPE STATE (JSON) ===
{current_state_str}
===================================

=== CHAT HISTORY ===
{history_text}
====================

PANTRY STAPLES ARE ALWAYS ASSUMED PRESENT.

Water, salt, oil and pepper are never listed as missing and are never added
to a shopping list, whatever the inventory says. Nobody records the salt, so
calling it missing sends the user out for something that is already beside
the hob and hides the one ingredient that genuinely is not there. Treat them
as available in every "missing" array, every recipe_overview and every
shopping_sync. This applies in every language. Flour, butter and sugar are
NOT staples - those really do run out and must be reported honestly.

FILE EVERY RECIPE YOU WRITE.

When you return recipe_full or save_recipe, also return "recipe_category":
the chapter from CHAPTERS THIS COOKBOOK HAS that the dish belongs on.
Copy the value EXACTLY as it is listed, including a "cat_" prefix - those
are keys, not words, and they are what keeps a chapter on the same shelf in
every language. A soup goes on the soups shelf whatever language the recipe
is written in.

You may ONLY choose a chapter that is already on that list. If none of them
fits, return "recipe_category": "" and leave it unfiled - do NOT invent a
new chapter. Creating chapters is the user's to do, not yours.

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
  "recipe_category": "<exactly one value from CHAPTERS THIS COOKBOOK HAS, or \"\">",
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
Trigger: User says "start", "step by step", "begin", "ok", "ready", "let's go", AND CURRENT RECIPE STATE has steps in all_steps OR in reference_steps.
reference_steps is a recipe that has been SHOWN but is not being cooked yet - which is the normal case for this state. The code copies it for you.

ABSOLUTE RULES:
- You MUST return intent "init_recipe".
- NEVER concatenate steps into a single "reply" message.
- REUSE the exact steps from CURRENT RECIPE STATE -- do NOT rebuild or rewrite them.
- The user sees only ONE step at a time. The agent advances on "next".

TIMERS: READ THEM OUT OF THE STEPS WHEN THE STATE HAS NONE.

Copy the timers from CURRENT RECIPE STATE when it has any. When "timers" is
empty - which it is for every recipe that was typed in or came with the
integration rather than being written by you - WORK THEM OUT FROM THE STEP
TEXT, in whatever language the steps are written in.

A step earns a timer when it asks the cook to WAIT: simmer, bake, rest,
prove, chill, fry for a stated time. "Stir the tomatoes for 5 minutes" is a
timer of 5 minutes on that step. "Chop the onion" is not a timer at all, and
neither is "bake until golden" with no time given.

  step_index is 0-BASED: step 1 is index 0.
  minutes is a whole number of minutes. An hour and a half is 90.
  label is a SHORT name for what is waiting, in {target_lang}.

Emit nothing for a step with no stated wait. A recipe where nothing waits
correctly has an empty timers array.

{{
  "intent": "init_recipe",
  "recipe_title": "<same recipe_title from state>",
  "ingredients": "<same ingredients from state>",
  "steps": "<copy all_steps, or reference_steps if all_steps is empty, verbatim>",
  "timers": [{{"step_index": 1, "minutes": 5, "label": "<short, in {target_lang}>"}}]
}}

=====================================================================
[STATE 4 - FIX / ADJUST / QUESTION DURING ACTIVE COOKING]
=====================================================================
Trigger: The CURRENT RECIPE STATE has a non-empty "all_steps" array - a
walkthrough is RUNNING - AND the user sends ANYTHING that can be interpreted
as adjusting, substituting, reducing, or asking about THIS recipe, including
brand-new quantity requests.

If all_steps is empty and there is a "recipe_id", the user is reading a saved
recipe rather than cooking it, and an adjustment is STATE 4b instead.

⚠ ABSOLUTE RULE -- "FIX FIRST" ⚠
When a recipe is on the table (all_steps or reference_steps is not empty), you MUST treat the user's message as a FIX to the current recipe UNLESS the user explicitly uses words like "new recipe", "different recipe", "switch recipe", "cancel this recipe", "forget this recipe" (in any language). This applies EVEN IF the user's message looks like a fresh recipe request.

ONE EXCEPTION, AND IT IS NOT A FIX: asking to SAVE, or to UPDATE THE PAGE.
"save it", "save the recipe", "keep this", "update the recipe", "update the
page I am on", "write it into the recipe" - in ANY language - are STATE 6
(save_recipe), never fix_recipe. The user is not asking you to change the
food. They are asking you to write what is already on screen into their
cookbook. Returning fix_recipe here re-prints the recipe and saves nothing,
which reads as the save being broken.

WHICH STATE AN ADJUSTMENT BELONGS TO DEPENDS ON ONE THING:
is a step-by-step walkthrough actually RUNNING?

  all_steps is NOT empty  -> a cook is in progress -> STATE 4, fix_recipe.
                             The change is for tonight's pot.

  all_steps IS empty and CURRENT RECIPE STATE has a "recipe_id"
                          -> the user is READING a saved recipe on its page
                             -> STATE 4b, propose_edit. It is a change to a
                             recipe that is stored, so the user is shown it
                             and approves it. Returning fix_recipe here
                             changes nothing they can see: the page keeps the
                             old text and no approval is ever asked for.

Concrete examples. Each one is fix_recipe DURING a walkthrough and
propose_edit while reading the page:
  - "I want a recipe for 1 cup of rice"     (user is inside an active sushi recipe -> scale sushi down to 1 cup rice)
  - "use 2 eggs instead of 3"                (swap quantity)
  - "fewer eggs"                             (reduce an ingredient)
  - "less salt"                              (reduce salt)
  - "can I replace butter with oil"          (substitute)
  - "make it smaller"                        (halve it)
  - "I only have 100g of cheese"             (adjust to match)
  - "I prefer more sauce"                    (increase an ingredient)

None of them are recipe_overview or init_recipe.

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
6. SEND THE INGREDIENT LIST BACK, COMPLETE, WITH THE CHANGE IN IT.

   A quantity that changes in the steps has to change in the ingredients too.
   "Use 4 tablespoons of olive oil" is not a change to the steps that happens
   to mention oil - it is a change to how much oil the recipe needs, and a
   recipe whose steps say 4 and whose ingredient list says 2 is wrong on the
   page whichever one the cook reads.

   Emit EVERY ingredient, not only the one that changed, copying the rest
   verbatim from CURRENT RECIPE STATE. What you send replaces the list.
   If nothing about the ingredients changes, send them unchanged.

{{
  "intent": "fix_recipe",
  "reply_message": "<short advice in {target_lang}, e.g. 'Scaling sushi down to 1 cup of rice. Adjusting remaining steps.'>",
  "updated_ingredients": [{{"name": "<{target_lang}>", "qty": "<e.g. 4 tbsp>"}}],
  "updated_remaining_steps": ["<step N in {target_lang}>", "<step N+1 in {target_lang}>"],
  "updated_remaining_timers": [{{"step_index": 0, "minutes": 15, "label": "<{target_lang}>"}}]
}}

=====================================================================
[STATE 4b - THE USER ASKS TO CHANGE THE RECIPE ITSELF]
=====================================================================
Trigger: CURRENT RECIPE STATE has a "recipe_id" (this is a SAVED recipe the
user has open) AND the user asks to change its INGREDIENTS or its STEPS -
adding one, removing one, reordering them or rewording them. Examples in any
language:
  - "change it to 1000g of flour instead of 500"
  - "update the recipe, 1kg flour, and save"
  - "the salt in the dough should go in at the end"
  - "add a teaspoon of vanilla"
  - "remove the sugar"
  - "update the recipe, add step 6: grate the parmesan"
  - "add a step at the end for resting the dough"
  - "delete step 3"

A message naming a step NUMBER is only a jump (STATE 8) when that is all it
asks. "Add step 6: grate the parmesan" names a step number and is a CHANGE -
it says what the step should say. "Go to step 6" is a jump. If the message
carries the CONTENT of a step, it is this state, not STATE 8.

This is NOT state 4. State 4 adjusts the walk-through for the cook happening
right now. This one is a proposed change to the RECORDED recipe.

YOU ARE NOT APPLYING ANYTHING. You are writing a proposal that the user will
be asked to approve. Never say the recipe has been changed or saved, and never
claim anything was written. It has not been.

Rules:
1. Emit the COMPLETE ingredient list and the COMPLETE step list as they would
   read AFTER the change - not just the parts that differ. The lists you emit
   are exactly what will be stored if the user approves, so anything you leave
   out is lost.
2. Copy every ingredient and step that is NOT affected VERBATIM from CURRENT
   RECIPE STATE. Do not reword, re-translate or renumber them.
   The recipe's steps are in "reference_steps" when the user has a recipe
   open but has not started cooking it, and in "all_steps" once they have.
   Read whichever is present.

REWRITING THE RECIPE IN ANOTHER LANGUAGE IS THIS STATE.

"translate this recipe into Hebrew", "write it in English", "put it into
Italian and save it" - in any language - are propose_edit, NOT save_recipe.

Every string changes, so it is the largest change there is, and STATE 6
cannot express it: STATE 6 sends an empty steps array and lets the code
supply the stored ones, so a translation routed there renames the recipe and
leaves its ingredients and steps in the language they were already in. That
is exactly what happens when this rule is ignored.

Emit the COMPLETE recipe in the new language: every ingredient name, every
quantity word, every step. Set "recipe_name" to the translated title and
"recipe_language" to the new code. Numbers and units stay as they are.
The word "and save" in the request does NOT make it STATE 6 - the user is
still asked to approve, and approving with "save" is what stores it.

AN OPEN RECIPE WITH NO STEPS IS AN EMPTY PAGE, NOT A RECIPE TO CHANGE.

If reference_steps AND all_steps are both empty, the user has created a
placeholder - a title and nothing else - and is now asking you to fill it.
That is NOT state 4b and you must NOT return propose_edit for it. Build the
recipe in full and return "recipe_full" (state 1). If they also said to save
it, return "save_recipe" on the turn after showing it, using the title that
is already on the page as recipe_name.
3. "change_summary" is one short sentence naming ONLY what differs, in
   {target_lang} - e.g. "flour 500g -> 1000g".
4. "reply_message" must ASK for approval, in {target_lang}, and must offer
   both choices: for this cook only, or saved into the recipe.
5. Do not ask which one they want in a separate turn first. Propose the
   change and ask in the same reply.

{{
  "intent": "propose_edit",
  "change_summary": "<one short sentence in {target_lang} naming only what changes>",
  "recipe_name": "<the title AFTER the change; omit or repeat the current one if it does not change>",
  "recipe_language": "<two-letter code of the language the recipe is written in AFTER the change, e.g. en, he, it; omit if unchanged>",
  "reply_message": "<in {target_lang}: state the change and ask whether to apply it just for this cook or save it into the recipe>",
  "ingredients": [{{"name": "<{target_lang}>", "qty": "<{target_lang}>"}}],
  "steps": ["<the FULL list of steps in {target_lang}, in order, after the change>"]
}}

=====================================================================
[STATE 4c - THE USER ANSWERS A PROPOSED CHANGE]
=====================================================================
Trigger: your PREVIOUS turn was a "propose_edit" AND the user replies with an
approval, a refusal, or a choice of scope. Examples in any language:
  - "yes" / "ok" / "go ahead"        -> they approve; scope not stated
  - "save it" / "save the recipe"    -> approve AND store it permanently
  - "just for now" / "only today" /
    "only this time"                 -> approve for this cook only
  - "no" / "cancel" / "leave it"     -> refuse

Emit ONLY this. Do NOT re-emit ingredients or steps: the change was already
recorded when you proposed it, and re-sending it would be ignored.

  scope MUST be exactly one of: "save", "session", "unclear"
    "save"    - they want it stored in the recipe
    "session" - they want it for this cook only
    "unclear" - they approved but did not say which. Use this whenever you are
                not certain. Do NOT guess "save": storing a change the user
                did not ask to store is the one mistake that cannot be undone.

{{"intent": "confirm_edit", "approved": true, "scope": "save|session|unclear", "reply_message": "<short in {target_lang}; if scope is unclear, ASK which of the two they meant>"}}

To refuse:
{{"intent": "cancel_edit", "reply_message": "<short in {target_lang}, e.g. 'Left as it was.'>"}}

=====================================================================
[STATE 4e - ANSWERING A TIMER THAT WAS OFFERED]
=====================================================================
Trigger: your PREVIOUS turn offered a timer for a step with a wait, and the
user has now answered. Examples in any language:
  - "yes" / "ok" / "go on" / "set it"        -> accept
  - "no" / "not now" / "leave it" / "skip"   -> decline

A timer is never set without this. Offering one and setting one are two
different turns on purpose: a timer interrupts someone later, on their phone,
and that is theirs to agree to.

Send ONLY the answer. Do NOT re-send the minutes or the label - they were
fixed when the offer was made, and anything you send here is ignored.

{{"intent": "confirm_timer", "accept": true, "reply_message": "<short in {target_lang}>"}}

To decline:
{{"intent": "confirm_timer", "accept": false, "reply_message": "<short in {target_lang}>"}}

=====================================================================
[STATE 4d - THE USER ASKS FOR A DIFFERENT EMBLEM]
=====================================================================
Trigger: CURRENT RECIPE STATE has a "recipe_id" AND the user asks for the
little drawing / symbol / emblem / icon shown on the recipe page. They may
describe what it should be, or simply ask for one. Examples in any language:
  - "change the recipe symbol to a braided bread"
  - "the emblem should be a fish"
  - "make the icon greener"
  - "design a symbol for this recipe"        <- no description: use the dish
  - "draw something for this recipe"

A request with NO description is still this state. The recipe's title and
ingredients tell you what the dish is, and that is enough to design from -
the panel sends exactly this after the user deletes a photograph, so that a
recipe is not left with an empty plate.

There is no library of ready-made pictures. You DESIGN the emblem, every
time, from what the user described and from what the dish actually is. A
recipe starts with no emblem at all and shows a camera on an empty plate
until either you design one or the user photographs their own dish.

"palette" MUST be an integer 0-7:
  0 terracotta  1 olive  2 plum  3 teal  4 ochre  5 iris  6 paprika  7 sage
Pick by the colour the user asked for, or by what suits the dish.

Design what was asked for and nothing else. A drawing that could be any dish
is worse than no drawing: a plain bowl on a plate tells the reader nothing,
and a cake drawn for a pizza tells them something untrue. Draw what makes
THIS dish recognisable - the crust and the toppings, the grain and its
garnish, the shape of the loaf.

YOU DO NOT WRITE SVG. You never write a tag, an attribute or any markup. You
send a list of SHAPES with numbers, and the application draws them. Anything
that is not on the lists below is dropped, and a design that draws nothing
leaves the recipe with the emblem it already had.

THE FIELD: a circle 120 wide. The centre is 60,60 and the visible area is a
circle of radius 46 around it - keep everything inside that or it is cut off
by the frame. Aim to fill roughly a 64-wide area in the middle.

EACH SHAPE is an object with "t" and its own numbers:
  {{"t":"circle","cx":60,"cy":60,"r":22}}
  {{"t":"ellipse","cx":60,"cy":70,"rx":26,"ry":10}}
  {{"t":"rect","x":40,"y":40,"width":20,"height":12,"rx":2}}
  {{"t":"line","x1":30,"y1":40,"x2":90,"y2":40}}
  {{"t":"path","d":"M40 70q10 8 20 0"}}          <- path data only, no letters
  {{"t":"polygon","points":"40,80 60,30 80,80"}}

COLOURS are NAMES, not values. Use "fill" and "stroke" with one of:
  none, ink, accent, wash, cream, white, red, green, brown, gold
"ink" is the dark outline colour and is the default stroke. Give a shape a
fill only when it should be solid. "w" is the line width, 0.5 to 6.

BE SPECIFIC. This is the whole point of designing rather than choosing: a
plate of couscous and a plate of rice must not come out looking the same.
Draw what distinguishes THIS dish - the grain, the shape of the pieces, the
topping, how it is served. Eight to twenty-five shapes usually reads well;
fewer looks unfinished, more turns to mud at the size it is shown.

WORKED EXAMPLE - "a whole pizza with mushrooms":
{{"intent": "draw_emblem", "palette": 6, "shapes": [
  {{"t":"circle","cx":60,"cy":60,"r":30,"fill":"cream","stroke":"brown","w":2.5}},
  {{"t":"circle","cx":60,"cy":60,"r":24,"fill":"red","stroke":"red","w":1}},
  {{"t":"ellipse","cx":50,"cy":52,"rx":6,"ry":4,"fill":"wash","stroke":"ink","w":1.4}},
  {{"t":"path","d":"M47 54v5","stroke":"ink","w":1.4}},
  {{"t":"ellipse","cx":70,"cy":58,"rx":6,"ry":4,"fill":"wash","stroke":"ink","w":1.4}},
  {{"t":"path","d":"M67 60v5","stroke":"ink","w":1.4}},
  {{"t":"ellipse","cx":58,"cy":72,"rx":6,"ry":4,"fill":"wash","stroke":"ink","w":1.4}},
  {{"t":"path","d":"M55 74v5","stroke":"ink","w":1.4}},
  {{"t":"circle","cx":72,"cy":70,"r":2.5,"fill":"green","stroke":"green","w":1}}
]], "reply_message": "..."}}

"palette" is 0-7 as listed above; pick one that suits the food.

{{"intent": "draw_emblem", "palette": <0-7>, "shapes": [ ... ], "reply_message": "<short in {target_lang} confirming the new symbol>"}}

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
- NOT for a request to rewrite the recipe in another language, even when it
  ends with "and save". That is STATE 4b. This state cannot carry translated
  ingredients or steps - it sends an empty steps array on purpose - so using
  it for a translation changes the title and nothing else.
- You must NEVER ask the user WHERE to save. The recipes database is a single internal SQLite file managed by this integration -- there is no choice of location.
- You must NEVER suggest creating a sub-location, folder, or path for the recipe. That is inventory-agent behaviour and does NOT apply to recipes.
- The code will read the FULL steps/ingredients/timers directly from CURRENT RECIPE STATE -- you do NOT need to re-emit them. Send an EMPTY "steps": [] array; the agent will substitute the real ones from state.
- The ONLY field you MUST extract correctly is "recipe_name" -- this is usually given by the user in the message itself ("save as X" / "שמור בשם X"). If not given, use the recipe_title from CURRENT RECIPE STATE.

{{
  "intent": "save_recipe",
  "recipe_name": "<name the user provided, or recipe_title from state>",
  "recipe_category": "<exactly one value from CHAPTERS THIS COOKBOOK HAS, or \"\">",
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
Trigger: CURRENT RECIPE STATE has steps in all_steps or reference_steps AND the user EXPLICITLY asks for a different recipe using phrases like "new recipe", "different recipe", "switch recipe", "cancel this", "forget this recipe", "never mind", etc.

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


def _format_chapters(chapters):
    """The shelves this cookbook actually has, for the model to choose from."""
    return "\n".join(f"- {c}" for c in chapters) if chapters else "(none)"


def _resolve_category(choice, allowed):
    """Map the model's chapter choice onto one this cookbook really has.

    [ADDED v2026.9.19] A recipe saved from the chat carried no chapter at
    all, so everything the assistant wrote landed under Other.

    This is the deterministic half of that: the model proposes a name and
    this function is the only thing that decides. A name that is not already
    a chapter is refused rather than created - RULE 22 reserves new top-level
    categories for an explicit user action - and a refusal means no chapter,
    which shows up under Other exactly as before. Fail closed (RULE 31).

    Matched case-insensitively and returned in the cookbook's OWN spelling,
    so "cat_meat" does not become "Cat_Meat" and a user's "Mum's soups" keeps
    its capitals.
    """
    wanted = str(choice or "").strip().lower()
    if not wanted:
        return None
    for name in allowed or []:
        if str(name).strip().lower() == wanted:
            return name
    # A "cat_" key is an English word with a prefix on it, and a model asked
    # for a chapter name will sometimes answer "soups" rather than
    # "cat_soups". Accepting the word behind the prefix costs nothing: this
    # can still only ever return a chapter the cookbook already has.
    for name in allowed or []:
        bare = str(name).strip().lower()
        if bare.startswith("cat_") and bare[4:] == wanted:
            return name
    _LOGGER.info(
        "[HO-COOKING] Chapter %r is not one of this cookbook's - filed under "
        "Other rather than creating it (RULE 22).", choice,
    )
    return None


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
    """The timer for one step, or None.

    [MODIFIED v2026.9.20] Hardened against a timers value that is not a list
    of objects. It caught a bad step_index but assumed every entry was a dict
    and that the list was a list - so "timers": "none", or a list of plain
    strings, raised AttributeError and took the whole cooking turn down.
    That shape was unlikely while timers were only ever copied from a recipe
    the assistant had written; it stopped being unlikely when the assistant
    started DERIVING them from step text.
    """
    if not isinstance(timers, (list, tuple)):
        return None
    for t in timers:
        if not isinstance(t, dict):
            continue
        try:
            if int(t.get("step_index")) == step_idx:
                return t
        except (ValueError, TypeError):
            continue
    return None


# [MODIFIED v2026.9.19] Verbs only. The NOUN for "step" was in this list.
#
# That made "add step 6, grate the parmesan" look like "jump to step 6": the
# fast lane below fired, printed step 6 and returned, so the request to
# CHANGE the recipe was never read as an intent at all and the approval
# buttons never appeared. The same trap existed in six languages - step,
# shelav, paso, passo, shag, khutwa, schritt - because each of those is the
# noun you use when ADDING a step as much as when jumping to one.
#
# Also gone: the two-letter Hebrew "go", which is a substring of the ordinary
# word for "yours", so "your recipe" plus any number was a jump.
#
# This list is deliberately conservative now. Anything it declines still
# reaches STATE 8 in the prompt, which handles jumps properly; the only cost
# of declining is one model call. The cost of a false positive is the user's
# message being thrown away, which is what was reported.
JUMP_VERBS = [
    "jump to", "skip to", "go to", "goto", "navigate to", "back to",
    "\u05e7\u05e4\u05d5\u05e5",
    "\u05e7\u05e4\u05e6\u05d9",
    "\u05e2\u05d1\u05d5\u05e8",
    "\u05e2\u05d1\u05e8\u05d9",
    "\u05d7\u05d6\u05d5\u05e8",
    "\u05d7\u05d6\u05e8\u05d9",
    "\u05ea\u05e2\u05d1\u05d5\u05e8",
    "salta", "saltar", "pasar",
    "passer", "aller",
    "passa", "torna",
    "\u043f\u0435\u0440\u0435\u0439\u0434\u0438",
    "\u043f\u0440\u043e\u043f\u0443\u0441\u0442\u0438",
    "\u0627\u0646\u062a\u0642\u0644",
    "\u062a\u062e\u0637",
    "springe", "gehe zu",
]

# A jump command is terse: "go to step 4". A sentence long enough to carry a
# request is not one, whatever words it happens to contain.
JUMP_MAX_WORDS = 5


def _detect_jump_step(msg):
    """Is this message plainly "go to step N", and nothing else?

    [MODIFIED v2026.9.19] Two guards added, both because this fast lane
    RETURNS - whatever else the message asked for is discarded unread.

      * Length. A jump command is terse. "Update the recipe, add step 6:
        grate parmesan" is a request that happens to contain a number, and
        answering it by printing step 6 threw the whole sentence away.
      * Order. The verb has to come before the number it refers to.

    Declining is cheap: STATE 8 in the prompt handles jumps the model sees.
    Accepting wrongly costs the user their message, so this errs towards no.
    """
    if not msg:
        return None
    low = msg.strip().lower()

    if len(low.split()) > JUMP_MAX_WORDS:
        return None

    verb_at = min(
        (low.index(v) for v in JUMP_VERBS if v in low),
        default=-1,
    )
    if verb_at < 0:
        return None

    m = re.search(r"\b(\d{1,3})\b", low)
    if not m or m.start() < verb_at:
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


def _offer_timer(messages, timer, strings, is_voice=False):
    """Offer a timer for a step that has a wait. Nothing is scheduled here.

    [MODIFIED v2026.9.20] This used to CREATE the reminder the moment a step
    with a wait came up. A timer is a thing that will interrupt someone later,
    on their phone, and setting one without being asked is not the assistant's
    to decide - so the offer is recorded and the question is asked, and
    _schedule_offered_timer is the only thing that writes one.

    The offer is held in state, not handed to the caller: whoever answers
    sends a yes or a no and nothing else, so no later message can change what
    a "yes" turns out to mean (the same reason recipe_edits freezes a change).

    Returns the line to show, or "" when there is nothing worth timing.
    """
    try:
        minutes = int(timer.get("minutes") or 0)
    except (ValueError, TypeError):
        minutes = 0
    # A timer has to be in the future and inside a day. Anything else is a
    # misread number, not a wait.
    if minutes <= 0 or minutes > 1440:
        return ""

    label = (timer.get("label") or "").strip()[:120] or f"Timer ({minutes} min)"
    write_state(messages, TIMER_OFFER_KEY, {"minutes": minutes, "label": label})
        # The marker must NOT begin with the state key: read_state matches on
    # "<KEY>:" and would find this and parse the 1 as the offer itself.
    messages.append({"role": "system", "content": "HO_TIMER_ASKED:1"})
    _LOGGER.info(
        "[HO-COOKING] Timer OFFERED | minutes=%s | label=%r - awaiting an answer",
        minutes, label,
    )
    # [FIXED v2026.9.20] Only SPEAK the question. On screen the panel asks it,
    # translated, with the two buttons under it - so building a sentence here
    # as well showed the same question twice, and showed it in English until
    # the background translation of these strings caught up. The panel has the
    # full translation file and needs no round trip.
    if not is_voice:
        return ""
    ask = strings.get("cooking_timer_ask", "Shall I set a timer?")
    mins_word = strings.get("cooking_minutes", "minutes")
    return (f"{chr(9201)} {label} - {minutes} {mins_word}. {ask}"
            + chr(10) + chr(10))


async def _schedule_offered_timer(hass, messages, device_id, user_id, now,
                                  strings):
    """Create the timer that was offered. The one place a timer is written.

    Reads the minutes and the label from the OFFER, never from whatever the
    answer carried: the caller says yes, and that is all they get to say
    (RULE 7).
    """
    offer = read_state(messages, TIMER_OFFER_KEY) or {}
    clear_state(messages, TIMER_OFFER_KEY)
    try:
        minutes = int(offer.get("minutes") or 0)
    except (ValueError, TypeError):
        minutes = 0
    if minutes <= 0 or minutes > 1440:
        return strings.get("cooking_timer_skip", "No timer set.")

    label = str(offer.get("label") or "")[:120] or f"Timer ({minutes} min)"
    fire_at = now + timedelta(minutes=minutes)
    fire_iso = fire_at.strftime("%Y-%m-%dT%H:%M:%S")
    try:
        rid = await reminders_store.async_insert(
            hass,
            target_timestamp=fire_iso,
            message=f"{chr(9200)} {label}",
            device_id=device_id,
            user_id=user_id,
            entry_type="cooking_timer",
        )
        reminders_scheduler.async_schedule(
            hass, rid, fire_at, f"{chr(9200)} {label}", device_id, user_id
        )
        _LOGGER.info(
            "[HO-COOKING] Timer set after approval | id=%s | minutes=%s | "
            "label=%r | user=%s", rid, minutes, label, user_id,
        )
        set_msg = strings.get("cooking_timer_set", "Timer set.")
        mins_word = strings.get("cooking_minutes", "minutes")
        return f"{chr(9201)} {set_msg} {label} - {minutes} {mins_word}."
    except Exception as e:
        _LOGGER.error("[HO-COOKING] timer failed: %s", e, exc_info=True)
        # Never report a timer that was not created (RULE 2, RULE 10).
        return strings.get("cooking_timer_skip", "No timer set.")


async def async_schedule_offered_timer(hass, messages, user_id,
                                       device_id=None):
    """Create the offered timer. The panel's way in.

    [ADDED v2026.9.20] The websocket layer answers the buttons under an
    offered timer, and this is the same function the chat and voice paths
    use - one place where a timer is written, so the two cannot drift apart
    (RULE 33d).

    Takes no minutes and no label: both are read from the offer that is
    already in this user's session. The caller says yes, and that is all.
    The panel writes its own confirmation in its own language, so the English
    fallbacks here are only ever seen by a caller that has none.
    """
    return await _schedule_offered_timer(
        hass, messages, device_id, user_id, dt_util.now(), {})


async def _push_to_shopping_list(hass, items_to_add, loc_hierarchy_map,
                                 strings=None):
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
        return (strings or {}).get("cooking_no_items",
                                   "There is nothing to add.")

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
        # The exception text is for the log, not for the cook: it is English
        # whatever the user reads in, and it says nothing they can act on.
        return (strings or {}).get("cooking_add_failed",
                                   "I could not add those.")

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


def _is_finish_request(text):
    """True when the user wants to stop cooking, in any supported language.

    Kept deliberately narrow. "done" on its own is a normal reply to a step
    ("done, what next?"), so only phrases that clearly mean the whole session
    is over are listed - otherwise a user confirming one step would be thrown
    out of the recipe.
    """
    if not text:
        return False
    t = str(text).strip().lower()
    FINISH = (
        # English
        "finish cooking", "finished cooking", "stop cooking", "exit recipe",
        "exit recipe mode", "i'm done cooking", "im done cooking",
        "end the recipe", "stop the recipe", "cancel the recipe",
        "quit cooking", "we're finished", "that's it for now",
        # Hebrew
        "סיים מתכון", "סיום המתכון", "סיים את המתכון", "סיום הבישול",
        "תפסיק את המתכון", "צא ממצב מתכון", "סיימתי לבשל", "בטל את המתכון",
        # Others
        "termina la ricetta", "esci dalla ricetta",
        "terminar la receta", "salir de la receta",
        "terminer la recette", "quitter la recette",
        "إنهاء الوصفة", "أنهِ الطهي",
        "закончить рецепт", "выйти из рецепта", "закончить готовку",
    )
    return any(w in t for w in FINISH)


def _is_listing_request(text):
    """True when the user wants to SEE their recipes rather than cook one.

    Kept as an explicit word list rather than asking the model, because this
    decides what goes INTO the prompt - it has to be answered before the model
    is called, so it cannot be a model decision.

    The vocabulary is multilingual on purpose: this agent is reached in every
    language the panel supports, and the trigger translation cache does not
    cover agent-internal checks.
    """
    if not text:
        return False
    t = str(text).strip().lower()
    LIST_WORDS = (
        # English
        "list", "what recipes", "which recipes", "my recipes", "saved recipes",
        "show me the recipes", "all recipes", "recipes do i have",
        "recipes do you have", "cookbook",
        # Hebrew
        "רשימה של המתכונים", "אילו מתכונים", "איזה מתכונים", "המתכונים שלי",
        "מתכונים שמורים", "כל המתכונים", "ספר המתכונים", "מתכונים ששמרתי",
        # Spanish / French / Italian / Russian / Arabic
        "mis recetas", "qué recetas", "mes recettes", "quelles recettes",
        "le mie ricette", "мои рецепты", "какие рецепты", "وصفاتي",
    )
    return any(w in t for w in LIST_WORDS)


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


# [MODIFIED v2026.9.20] hass, now, device_id and user_id went with the
# timer: this function no longer creates one, it offers one, and an
# offer needs none of them. It is no longer async either, because
# nothing in it awaits any more (RULE 33d).
def _load_saved_into_state(saved, messages, next_hint, strings, is_voice):
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
        return strings.get("cooking_saved_no_steps",
                           "That saved recipe has no steps. Try another.")

    banner = ""
    t0 = _timer_for_step(state["timers"], 0)
    if t0:
        banner = _offer_timer(messages, t0, strings, is_voice)

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
            # [ADDED v2026.9.19] Update the page this recipe came from rather
            # than looking it up by name. A recipe renamed while it was being
            # written would otherwise be filed a second time.
            recipe_id=recipe_state.get("recipe_id"),
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
        return strings.get("cooking_dictation_error",
                           "Something went wrong while recording.")

    parsed = safe_parse_json(raw)
    if not parsed:
        return strings.get(
            "cooking_not_caught",
            "I did not catch that. Say the next step again, or say done.")

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
            return strings.get("cooking_nothing_recorded",
                           "No steps were recorded, so there is nothing to save.")

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

    # [ADDED v2026.10.12] An explicit way out of an active recipe.
    #
    # Finishing previously only happened by running off the end of the steps.
    # A user who abandons a dish halfway - or who presses "Finish cooking" in
    # the cookbook - had no way to leave, and every following question was
    # still answered as part of that recipe.
    #
    # Checked before anything else so it works at any point, and matched on
    # words rather than asking the model, because the model is the thing that
    # would otherwise keep the session alive.
    if recipe_state and _is_finish_request(last_user_msg):
        clear_state(messages, COOKING_STATE_KEY)
        clear_state(messages, DICTATION_STATE_KEY)
        _LOGGER.info("[HO-COOKING] Recipe ended at the user's request.")
        return strings.get("cooking_finished") or "Done."

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
                banner = _offer_timer(messages, t, strings, is_voice)
            return f"{banner}{steps[new_idx]}{next_hint}"
        else:
            _LOGGER.warning(
                f"[HO-COOKING] JUMP out of range: "
                f"requested={jump_target}, total_steps={len(steps)}"
            )
            # [FIXED v2026.9.20] This was written twice - once in Hebrew,
            # once in English - so a user on Italian, Spanish, French,
            # Arabic or Russian got the English one. A sentence hard-coded
            # per language only ever covers the languages someone
            # remembered to write.
            return (strings.get("cooking_step_missing",
                                "That step does not exist.")
                    + f" 1-{len(steps)}")

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
        # [FIXED v2026.9.19] The answer must BE "continue", not contain it.
        #
        # This was a substring test, so a model that explained itself -
        # "the user is not asking to continue, they want to change the
        # recipe" - matched, and the walkthrough advanced a step while the
        # message that asked for a change was discarded.
        #
        # Reading the first word instead fails towards QUESTION, which is the
        # safe direction: a question goes on to the intent machinery, where
        # "next" is still understood. A wrong CONTINUE loses the message.
        first_word = re.findall(r"[A-Za-z]+", check_res or "")
        if first_word and first_word[0].upper() == "CONTINUE":
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
                banner = _offer_timer(messages, t, strings, is_voice)

            return f"{banner}{steps[current_idx]}{next_hint}"

        finished_msg = f"🎉 {strings['cooking_finished']}"
        await _auto_save_completed_recipe(hass, recipe_state, lang_code)
        # [FIXED v2026.10.10] Clear the state, do not overwrite it with an
        # empty one.
        #
        # write_state({"steps": [], "current_idx": 0}) leaves a dict behind,
        # and a non-empty dict is truthy - so `if recipe_state:` still passed
        # on the next turn and the agent carried on asking about a recipe the
        # user had already finished. There was no way out short of restarting
        # the conversation.
        clear_state(messages, COOKING_STATE_KEY)
        return finished_msg

    saved_matches = []
    if not recipe_state and last_user_msg:
        # [FIXED v2026.10.10] "list my saved recipes" returned nothing.
        #
        # saved_matches was only ever filled by a name lookup, so a request to
        # SEE the cookbook produced an empty list and the prompt truthfully
        # reported that there were no saved recipes - while three sat in the
        # database. A browse request is not a dish name and never matched.
        #
        # Asking to list them now loads the whole cookbook instead of
        # searching it.
        if _is_listing_request(last_user_msg):
            saved_matches = await recipes_db.async_list_all(hass) or []
            # Capped: the whole cookbook in the prompt would crowd out the
            # inventory and the conversation on a long list.
            saved_matches = saved_matches[:40]
        else:
            dish_query = _detect_dish_query(last_user_msg) or recipe_name
            saved_matches = await recipes_db.async_find_by_name(
                hass, dish_query, language=lang_code, limit=3
            )

    suggested_id = _extract_suggested_saved_id(messages)
    if suggested_id and _looks_affirmative(last_user_msg):
        loaded = await recipes_db.async_get_by_id(hass, suggested_id)
        if loaded:
            await recipes_db.async_touch(hass, suggested_id)
            return _load_saved_into_state(
                loaded, messages, next_hint, strings, is_voice
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
        # [FIXED v2026.9.19] reference_steps was missing from this payload.
        #
        # The prompt has told the model for several releases to look at
        # reference_steps - to tell a recipe that is open from a blank page,
        # and to know what it may start cooking - but the field was never
        # actually sent. The model was being asked about something it could
        # not see, so it fell back to guessing from the chat history.
        state_str = json.dumps(
            {
                "recipe_title": title,
                "current_idx": curr,
                "all_steps": stps,
                "remaining_planned_steps": stps[curr:],
                "reference_steps": recipe_state.get("reference_steps") or [],
                "ingredients": ings,
                "timers": tims,
            },
            ensure_ascii=False,
        )

    # [ADDED v2026.9.19] The shelves this cookbook actually has.
    #
    # Offered to the model so a recipe it writes is filed where it belongs
    # instead of landing under Other. The list is the allow-list as well as
    # the menu: _resolve_category refuses anything that is not on it.
    try:
        known_chapters = await recipes_db.async_list_categories(hass)
    except Exception as chapter_err:
        known_chapters = []
        _LOGGER.warning("Could not read the chapter list: %s", chapter_err)

    prompt = get_cooking_prompt(
        inventory_context, recipe_name, target_lang,
        history_text, state_str,
        _format_saved_suggestions(saved_matches),
        chapters_text=_format_chapters(known_chapters),
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

    # [ADDED v2026.9.17] Propose a change to the SAVED recipe, and answer one.
    #
    # Nothing here writes to the database. The proposal is frozen in
    # recipe_edits and the websocket layer applies it only after the user has
    # approved it and named a scope. The model can suggest; it cannot save
    # (RULE 7, RULE 9, RULE 11).
    bound_recipe_id = (recipe_state or {}).get("recipe_id")

    if intent_str in ("propose_edit", "proposeedit"):
        if not bound_recipe_id:
            # No saved recipe in hand, so there is nothing to change. Treat it
            # as ordinary advice rather than inventing a target.
            return (parsed.get("reply_message")
                    or "Open a saved recipe first and I can change it.")
        proposal = recipe_edits.put(
            user_id,
            bound_recipe_id,
            parsed.get("change_summary"),
            parsed.get("ingredients"),
            parsed.get("steps"),
            # [ADDED v2026.9.20] A rewrite in another language changes the
            # title and the language too. recipe_edits checks both - the
            # language against a fixed list - and drops anything it does not
            # recognise, so the recipe keeps what it had.
            name=parsed.get("recipe_name"),
            language=parsed.get("recipe_language"),
        )
        if not proposal:
            return (parsed.get("reply_message")
                    or "I could not work out what to change.")
        # [ADDED v2026.9.17] Say that a proposal was made ON THIS TURN.
        #
        # The websocket layer used to hand the panel any proposal it found
        # still pending, on every single message. One unanswered proposal
        # therefore reappeared on screen after every later thing the user
        # said, looking like the assistant repeating itself. The marker makes
        # "a change was proposed just now" a different question from "a
        # change is still waiting somewhere".
        messages.append({"role": "system", "content": "HO_EDIT_PROPOSED:1"})
        _LOGGER.info(
            "[HO-COOKING] Change PROPOSED for recipe=%s (awaiting approval)",
            bound_recipe_id,
        )
        return parsed.get("reply_message") or proposal["summary"]
    if intent_str in ("draw_emblem", "drawemblem"):
        if not bound_recipe_id:
            return (parsed.get("reply_message")
                    or "Open a saved recipe first and I can draw its symbol.")
        spec = validate_emblem_spec(parsed.get("shapes"))
        if not spec:
            _LOGGER.warning(
                "[HO-COOKING] Emblem design refused for recipe=%s; "
                "keeping the existing one.", bound_recipe_id,
            )
            return strings.get(
                "emblem_draw_failed",
                "I could not draw that one. The symbol is unchanged.",
            )
        try:
            palette = int(parsed.get("palette"))
        except (TypeError, ValueError):
            palette = 0
        # The panel draws it and stores the result. Passing the SPEC rather
        # than a picture is the whole point: there is no markup anywhere in
        # this path for anything to hide in.
        messages.append({
            "role": "system",
            "content": "HO_EMBLEM_SPEC:" + json.dumps(
                {"shapes": spec, "palette": palette % EMBLEM_PALETTE_COUNT},
                ensure_ascii=False,
            ),
        })
        _LOGGER.info(
            "[HO-COOKING] Emblem designed for recipe=%s (%d shapes)",
            bound_recipe_id, len(spec),
        )
        return parsed.get("reply_message") or "Drew a new symbol."

    if intent_str in ("cancel_edit", "canceledit"):
        recipe_edits.clear(user_id, bound_recipe_id)
        return parsed.get("reply_message") or "Left as it was."

    if intent_str in ("confirm_edit", "confirmedit"):
        pending = recipe_edits.get(user_id, bound_recipe_id)
        if not pending:
            return (parsed.get("reply_message")
                    or "There is no change waiting to be approved.")
        if not parsed.get("approved"):
            recipe_edits.clear(user_id, bound_recipe_id)
            return parsed.get("reply_message") or "Left as it was."
        # An unclear scope is NOT resolved here. The reply asks which was
        # meant, the proposal stays pending, and nothing is written. Guessing
        # "save" would rewrite a recipe the user only wanted changed for
        # tonight, which is the one mistake with no undo (RULE 31).
        scope = recipe_edits.normalise_scope(parsed.get("scope"))
        if scope is None:
            return (parsed.get("reply_message")
                    or "Just for this time, or save it into the recipe?")
        # The panel performs the write through the confirm_edit websocket
        # action, which is the single execution boundary. Saying so here keeps
        # one path to the database rather than two that can drift (RULE 33d).
        messages.append({
            "role": "system",
            "content": f"HO_EDIT_APPROVED:{scope}",
        })
        return parsed.get("reply_message") or "Applying that now."

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

        # [FIXED v2026.9.19] Carry the binding forward, and put the recipe on
        # the page it was asked for.
        #
        # This state used to be built from scratch, which threw away the
        # recipe_id the websocket layer had just bound. Two things then went
        # wrong on the NEXT message, and together they made every kind of
        # update impossible:
        #
        #   1. The binding was gone, so the websocket layer saw a different
        #      recipe_id from the panel and rebuilt the state from the
        #      DATABASE - which for a page the user had only just created is
        #      empty. The recipe that had just been written was destroyed
        #      before the user could do anything with it.
        #   2. With the recipe gone, the next turn produced the recipe again,
        #      and the turn after that destroyed it again. The user could ask
        #      to save for ever and never get a saved recipe.
        #
        # So the id travels with the state. And because the whole point of
        # asking on a blank page is to END UP with that page filled in, the
        # recipe is written to it here rather than left in the chat.
        prev = recipe_state or {}
        bound_id = prev.get("recipe_id")
        saved_id = None

        # [FIXED v2026.9.19] A page the user has open is never written to
        # without being asked first.
        #
        # An earlier attempt wrote straight into an empty page, on the
        # reasoning that filling a blank destroys nothing. That was wrong:
        # the user asked to be shown what is about to happen and to approve
        # it, and an empty page is still THEIR page. It also skipped the
        # "just this once" choice, which is the whole point of the mechanism.
        #
        # So the recipe is FROZEN as a proposal and the panel draws the
        # approve / just-this-time / cancel buttons over it. Nothing is
        # written until the user answers, and what is then written is exactly
        # what they were shown - recipe_edits.async_apply accepts no recipe
        # content from anyone (RULE 7, RULE 31).
        if bound_id and full_steps:
            proposal = recipe_edits.put(
                user_id,
                bound_id,
                # No summary: the panel writes the question in the user's own
                # language, and it asks a different one for a blank page than
                # for a recipe being changed.
                "",
                full_ingredients,
                full_steps,
            )
            if proposal:
                messages.append(
                    {"role": "system", "content": "HO_EDIT_PROPOSED:1"}
                )
                _LOGGER.info(
                    "[HO-COOKING] STATE 1 proposed filling page %s "
                    "(%d ingredients, %d steps) - awaiting approval",
                    bound_id, len(full_ingredients), len(full_steps),
                )
        elif full_steps:
            # Nothing is open, so there is no page to protect and nothing to
            # overwrite. This is the contents-page request - "something for
            # lunch from what is in the fridge" - and the point of asking was
            # to end up looking at the recipe, so it gets a page of its own.
            try:
                saved_id, action = await recipes_db.async_save(
                    hass,
                    name=parsed.get("recipe_title") or recipe_name,
                    ingredients=full_ingredients,
                    steps=full_steps,
                    timers=full_timers,
                    language=lang_code,
                    tags=[],
                    source_type="ai_generated",
                    # Filed on the right shelf. The model proposed a chapter;
                    # _resolve_category is what decides, and it only ever
                    # returns one this cookbook already has.
                    category=_resolve_category(
                        parsed.get("recipe_category"), known_chapters),
                )
                messages.append(
                    {"role": "system", "content": f"HO_RECIPE_SAVED:{saved_id}"}
                )
                _LOGGER.info(
                    "[HO-COOKING] STATE 1 opened a new page | id=%s | "
                    "action=%s", saved_id, action,
                )
            except Exception as write_err:
                # The recipe is still on screen and still in state, so the
                # user loses nothing and can ask again. Never report a save
                # that did not happen (RULE 2, RULE 10).
                saved_id = None
                _LOGGER.error(
                    "[HO-COOKING] Could not open a page for the recipe: %s",
                    write_err, exc_info=True,
                )

        overview_state = {
            "mode": "overview",
            "current_idx": 0,
            # [FIXED v2026.9.19] The recipe goes on the TABLE, not into a
            # walkthrough. "steps" means one thing to this module - a
            # step-by-step cook is running - and has_active_steps is read
            # straight off it. Putting a freshly written recipe there made
            # the agent believe the user was mid-cook the moment it finished
            # printing, so FIX FIRST claimed every later message: asking to
            # SAVE was answered by fix_recipe, which ends by printing step 1.
            # That is the "it jumps me to step 1" that was reported. The
            # binding does exactly this too, and for the same reason.
            "steps": [],
            "timers": full_timers,
            "ingredients": full_ingredients,
            "recipe_title": parsed.get("recipe_title") or recipe_name,
            "language": lang_code,
            # A page exists for this recipe - either it was just created, or
            # the user had it open - so say so. _auto_save_completed_recipe
            # then TOUCHES it at the end of a walkthrough instead of writing.
            # That matters for the bound case: the recipe sitting in state is
            # a proposal the user has not answered yet, and finishing a cook
            # must not be a way of saving it behind their back.
            "source_type": ("loaded_from_db" if (saved_id or bound_id)
                            else "ai_generated"),
            "missing": full_missing,
            "have": full_have,
            "recipe_id": saved_id or bound_id,
            # The recipe as it now stands, ready to be cooked, saved or
            # adjusted - but not being walked through. init_recipe and
            # save_recipe both read this when "steps" is empty.
            "reference_steps": full_steps,
        }
        write_state(messages, COOKING_STATE_KEY, overview_state)
        _LOGGER.info(
            f"[HO-COOKING] STATE 1 rendered full recipe | "
            f"have={len(full_have)} | missing={len(full_missing)} | "
            f"steps={len(full_steps)} | timers={len(full_timers)} | "
            f"recipe_id={overview_state['recipe_id']!r}"
        )
        return _render_recipe_overview(parsed, target_lang)

    if intent_str in ("init_recipe", "initrecipe"):
        llm_steps = parsed.get("steps") or []
        llm_timers = parsed.get("timers") or []
        llm_ingredients = parsed.get("ingredients") or []

        # [MODIFIED v2026.9.19] Fall back to the recipe on the table.
        #
        # A recipe that has been shown but not started now lives in
        # reference_steps rather than in steps - see the STATE 1 handler for
        # why. Without this fallback, "cook this with me" straight after the
        # recipe was printed found nothing to cook.
        state_steps = ((recipe_state or {}).get("steps")
                       or (recipe_state or {}).get("reference_steps") or [])
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

        # [FIXED v2026.9.20] Starting a walkthrough must not drop the binding.
        #
        # This state was built from scratch and lost the recipe_id. The
        # websocket layer rebuilds the binding whenever the panel names a
        # recipe the state does not - so the very next message, which is what
        # "Next step" is, rebuilt the state from the DATABASE and emptied
        # "steps". The walkthrough was gone one press after it began, and the
        # assistant, seeing an open recipe with no walkthrough, read "next
        # step" as a request to change the recipe and offered the approval
        # buttons instead of the next step.
        #
        # The same defect was fixed in recipe_full; this is the other half of
        # it. source_type and reference_steps travel too: a recipe loaded from
        # the database must not be relabelled as AI-written when the cook
        # finishes (RULE 33a.8).
        prev = recipe_state or {}
        state = {
            "steps": steps,
            "current_idx": 0,
            "timers": timers,
            "ingredients": ingredients,
            "recipe_title": (
                prev.get("recipe_title")
                or parsed.get("recipe_title")
                or recipe_name
            ),
            "language": lang_code,
            "source_type": prev.get("source_type") or "ai_generated",
            "recipe_id": prev.get("recipe_id"),
            "reference_steps": prev.get("reference_steps") or steps,
        }
        write_state(messages, COOKING_STATE_KEY, state)
        _LOGGER.info(
            f"[HO-COOKING] STATE 3 init | "
            f"steps={len(steps)} | from_state={len(state_steps) >= len(llm_steps)}"
        )

        banner = ""
        t = _timer_for_step(state["timers"], 0)
        if t:
            banner = _offer_timer(messages, t, strings, is_voice)
        return f"{banner}{steps[0]}{next_hint}"

    # [ADDED v2026.9.20] The answer to a timer that was offered.
    #
    # The model classifies a yes or a no - in any language, which is the one
    # thing it is better at than a word list - and contributes NOTHING else.
    # The minutes and the label come from the offer that is already in state,
    # so what a "yes" means was settled when the question was asked (RULE 7).
    if intent_str in ("confirm_timer", "confirmtimer"):
        if not read_state(messages, TIMER_OFFER_KEY):
            return parsed.get("reply_message") or strings.get(
                "cooking_timer_skip", "No timer set.")
        if parsed.get("accept") is True:
            return await _schedule_offered_timer(
                hass, messages, device_id, user_id, now, strings)
        clear_state(messages, TIMER_OFFER_KEY)
        _LOGGER.info("[HO-COOKING] Timer offer declined.")
        return parsed.get("reply_message") or strings.get(
            "cooking_timer_skip", "No timer set.")

    if intent_str in ("fix_recipe", "fixrecipe"):
        reply_msg = parsed.get("reply_message", "")
        updated_steps = parsed.get("updated_remaining_steps") or []
        # [ADDED v2026.9.20] The ingredient list after the change.
        #
        # fix_recipe could only ever rewrite STEPS, so "use 4 tablespoons of
        # olive oil" changed the steps and left the ingredient list saying 2 -
        # a recipe that contradicts itself, and the cook has no way to know
        # which number is the real one. An empty or missing list means
        # "unchanged", never "clear" (RULE 33a.8).
        updated_ingredients = parsed.get("updated_ingredients")
        if not isinstance(updated_ingredients, list) or not updated_ingredients:
            updated_ingredients = None
        updated_timers = parsed.get("updated_remaining_timers") or []
        if not updated_steps:
            return reply_msg

        state = recipe_state or {}

        # [ADDED v2026.9.19] A change to a recipe nobody is cooking yet does
        # not start cooking it.
        #
        # This handler used to answer every adjustment by printing step 1 and
        # offering "next". That is right in the middle of a walkthrough, and
        # wrong everywhere else: the user was reading a recipe, asked for a
        # change, and was dropped into a step-by-step cook they had not
        # started. It is what "it jumps me to step 1" describes, and it also
        # fired when the model read a request to SAVE as a request to adjust.
        #
        # So the walkthrough only answers when a walkthrough is running.
        # Otherwise the recipe on the table is updated and the change is
        # explained, which is what was asked for.
        walkthrough_running = bool(state.get("steps"))
        if not walkthrough_running:
            # [FIXED v2026.9.20] A change to a SAVED recipe is proposed,
            # not applied.
            #
            # The first attempt wrote the revision into the assistant's own
            # copy and printed it. That looked like it had worked and had
            # not: no approval buttons, and the page behind the chat still
            # said what it always had. Asking to use fewer eggs ended with
            # the new recipe visible only in the conversation.
            #
            # A page is open, so this is an edit to a stored recipe and it
            # belongs on the same path as every other one: frozen here,
            # approved by the user, written by the websocket layer.
            if bound_recipe_id:
                proposal = recipe_edits.put(
                    user_id,
                    bound_recipe_id,
                    parsed.get("change_summary") or reply_msg,
                    # The changed list when there is one, and the list already
                    # in state when there is not - never an empty one, which
                    # would offer to store a recipe with no ingredients
                    # (RULE 33a.8).
                    updated_ingredients or state.get("ingredients") or [],
                    updated_steps,
                )
                if proposal:
                    messages.append(
                        {"role": "system", "content": "HO_EDIT_PROPOSED:1"})
                    _LOGGER.info(
                        "[HO-COOKING] fix_recipe PROPOSED a change to "
                        "recipe %s (%d steps) - awaiting approval",
                        bound_recipe_id, len(updated_steps),
                    )
                    return reply_msg or proposal["summary"]

            # Nothing is open, so there is no stored recipe to propose
            # against. The revision lives in the conversation, which is all
            # it can do.
            state["reference_steps"] = updated_steps
            state["timers"] = updated_timers
            state["current_idx"] = 0
            if updated_ingredients:
                state["ingredients"] = updated_ingredients
            write_state(messages, COOKING_STATE_KEY, state)
            _LOGGER.info(
                "[HO-COOKING] fix_recipe revised an unsaved recipe "
                "(%d steps)", len(updated_steps),
            )
            revised = _render_recipe_overview(
                {
                    "recipe_title": state.get("recipe_title") or recipe_name,
                    "steps": updated_steps,
                    "have": [],
                    "missing": [],
                },
                target_lang,
            )
            # The explanation on its own would leave the reader guessing what
            # the recipe now says, so the revised recipe comes with it.
            return f"💡 {reply_msg}\n\n{revised}" if reply_msg else revised

        state["steps"] = updated_steps
        state["current_idx"] = 0
        state["timers"] = updated_timers
        # The list a cook is reading from has to agree with the steps they
        # are following, even for a change that is only for tonight.
        if updated_ingredients:
            state["ingredients"] = updated_ingredients
        write_state(messages, COOKING_STATE_KEY, state)

        banner = ""
        t = _timer_for_step(updated_timers, 0)
        if t:
            banner = _offer_timer(messages, t, strings, is_voice)
        return f"💡 {reply_msg}\n\n{banner}{updated_steps[0]}{next_hint}"

    if intent_str in ("shopping_sync", "shoppingsync", "add_to_shopping"):
        items_to_add = parsed.get("items_to_add") or []
        spoken_conf = (parsed.get("spoken_confirmation") or "").strip()
        if not items_to_add:
            return spoken_conf or strings.get(
                "cooking_no_missing", "I could not work out what is missing.")
        db_result = await _push_to_shopping_list(
            hass, items_to_add, loc_hierarchy_map, strings
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
            # [MODIFIED v2026.9.19] The recipe being saved is usually one
            # that has been SHOWN and not cooked, which now lives in
            # reference_steps. STATE 6 tells the model to send an empty
            # "steps" array and let the code supply the real ones, so without
            # this fallback "save it" answered "Missing recipe steps".
            state_steps = (recipe_state.get("steps")
                           or recipe_state.get("reference_steps") or [])
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
            return strings.get("cooking_cannot_save",
                           "The recipe has no steps, so it cannot be saved.")

        _LOGGER.info(
            f"[HO-COOKING] save_recipe | name={final_name!r} | "
            f"steps_src={steps_src} | steps_count={len(final_steps)} | "
            f"ingredients={len(final_ingredients)} | "
            f"timers={len(final_timers)} | "
            f"llm_steps={len(llm_steps)} | state_steps={len(state_steps)}"
        )

        # [ADDED v2026.9.19] Fill the page that is already open.
        #
        # When the user opened an empty recipe - a title they typed and
        # nothing else - and asked for it to be written, this must land IN
        # that recipe. Without the id, async_save upserts by name and
        # language, so a generated title that differs even slightly from the
        # one on the page ("Caesar Salad" against "Ceasar salad") created a
        # SECOND recipe and left the placeholder empty.
        bound_id = (recipe_state or {}).get("recipe_id")

        # [ADDED v2026.9.19] File it, but never RE-file it.
        #
        # A shelf the user chose is theirs. Passing a chapter here on every
        # save would let the assistant quietly move a recipe the user had
        # deliberately put somewhere else, which is the same mistake as
        # overwriting their handwritten notes (RULE 33a.8). So a chapter is
        # only written when the recipe has none.
        chosen_category = _resolve_category(
            parsed.get("recipe_category"), known_chapters)
        if chosen_category and bound_id:
            try:
                existing = await recipes_db.async_get_by_id(hass, bound_id)
            except Exception:
                existing = None
            if existing and str(existing.get("category") or "").strip():
                _LOGGER.info(
                    "[HO-COOKING] Recipe %s is already on a shelf - leaving "
                    "it there rather than re-filing.", bound_id,
                )
                chosen_category = None

        rid, action = await recipes_db.async_save(
            hass,
            name=final_name,
            ingredients=final_ingredients,
            steps=final_steps,
            timers=final_timers,
            language=lang_code,
            tags=llm_tags,
            source_type=(recipe_state or {}).get("source_type", "ai_generated"),
            recipe_id=bound_id,
            # None means "leave the chapter alone" in async_save, which is
            # what an already-filed recipe gets - see above.
            category=chosen_category,
        )
        # Tell the panel which recipe to show. A recipe asked for from the
        # contents page has no page of its own until now, and the point of
        # asking was to end up looking at it.
        messages.append({"role": "system", "content": f"HO_RECIPE_SAVED:{rid}"})
        _LOGGER.info(
            f"[HO-COOKING] Recipe saved | id={rid} | action={action} | "
            f"name={final_name!r} | steps={len(final_steps)} | "
            f"bound={bound_id!r}"
        )
        saved_msg = strings.get("cooking_recipe_saved", "Recipe saved:")
        return spoken_conf or f"{saved_msg} {final_name}"

    if intent_str in ("jump_to_step", "jumptostep", "goto_step"):
        if not recipe_state:
            return strings.get("cooking_no_active",
                           "No recipe is running, so there is no step to jump to.")

        steps = recipe_state.get("steps") or []
        timers = recipe_state.get("timers") or []
        try:
            step_number = int(parsed.get("step_number") or 0)
        except (ValueError, TypeError):
            step_number = 0

        if step_number < 1 or step_number > len(steps):
            # The sentence is translated; the range is numbers, which are
            # the same in every language and are appended rather than
            # interpolated into something a translation could lose.
            return (strings.get("cooking_step_missing",
                                "That step does not exist.")
                    + f" 1-{len(steps)}")

        new_idx = step_number - 1 
        recipe_state["current_idx"] = new_idx
        write_state(messages, COOKING_STATE_KEY, recipe_state)

        _LOGGER.info(
            f"[HO-COOKING] Jumped to step {step_number} (idx {new_idx})"
        )

        banner = ""
        t = _timer_for_step(timers, new_idx)
        if t:
            banner = _offer_timer(messages, t, strings, is_voice)

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
            # The dish name is appended rather than interpolated into the
            # sentence: a translated sentence with a placeholder in it is
            # one more thing a translation can lose.
            return strings.get(
                "cooking_mid_recipe",
                "We are in the middle of a recipe. Cancel it and start "
                "something else?") + f" ({hint})"
        return strings.get(
            "cooking_mid_recipe",
            "We are in the middle of a recipe. Cancel it and start "
            "something else?")

    if intent_str == "reply":
        return parsed.get("message", raw_res)

    return raw_res