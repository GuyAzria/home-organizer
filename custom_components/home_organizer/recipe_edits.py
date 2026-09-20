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
# [MODIFIED v2026.9.20 | 2026-09-20] Purpose: A proposal can carry a new
#   TITLE and a new LANGUAGE, not just ingredients and steps. Without
#   them, asking for a recipe to be rewritten in another language left
#   the title untranslated and the language column claiming the old one.
#   Both are checked here rather than trusted: the language against the
#   integration's own list, the title against a length. Same release:
#   async_apply no longer CLEARS a list the proposal omitted. put() only
#   requires that one of the two changes, so a steps-only proposal would
#   have stored a recipe with no ingredients at all (RULE 33a.8).
# [ADDED v2026.9.17 | 2026-09-17] Purpose: Holds a proposed recipe change
#   between the turn that suggests it and the turn that approves it.
#
# WHY THIS MODULE EXISTS - permanent architectural note.
#
# The assistant can now be asked to change a recipe: "make it 1000g of flour
# instead of 500", "move the salt to the end of the dough". Those changes can
# be written to the user's saved recipe, which makes this a write path driven
# by model output - exactly the class RULE 7 and RULE 11 call untrusted.
#
# The control is that the CONTENT of a change is decided once, when it is
# proposed, and frozen here. The turn that approves it does not regenerate
# anything: it names a proposal that already exists and picks a scope from a
# two-value allow-list. So whatever the user approves is exactly what they were
# shown, and no later model output can alter it.
#
# The model therefore chooses WHAT TO SUGGEST. It never chooses what is
# written, and it cannot authorise its own suggestion (RULE 9, RULE 10).
#
# Proposals live in memory only. They are a question awaiting an answer, not
# user data: losing them on restart costs nothing, and persisting them would
# mean a restart could silently apply a change nobody confirmed.

import logging
import time

from . import recipes_db

_LOGGER = logging.getLogger(__name__)

# {(user_id, recipe_id): proposal}
_PENDING = {}

# A proposal the user never answered is dead after this, so a "yes" typed much
# later cannot reach back and apply something long forgotten.
TTL_SECONDS = 900

# The only scopes that may ever be applied. Anything else is rejected before
# it reaches the database (RULE 7: a constrained intent mapped to a vetted
# allow-list, never a value taken straight from the model).
SCOPE_SESSION = "session"   # this cook only; the saved recipe is untouched
SCOPE_SAVE = "save"         # write it into the saved recipe
ALLOWED_SCOPES = frozenset({SCOPE_SESSION, SCOPE_SAVE})


def _key(user_id, recipe_id):
    return (str(user_id or ""), str(recipe_id or ""))


def _clean_ingredients(raw):
    """Normalise an ingredient list to [{name, qty}].

    The model has produced both plain strings and {name, qty} objects over
    this project's life, and old saved recipes still hold the string form, so
    both are accepted here rather than rejected.
    """
    out = []
    for item in (raw or []):
        if isinstance(item, str):
            name, qty = item.strip(), ""
        elif isinstance(item, dict):
            name = str(item.get("name") or item.get("item") or "").strip()
            qty = str(item.get("qty") or item.get("quantity") or "").strip()
        else:
            continue
        if name:
            out.append({"name": name, "qty": qty})
    return out


def _clean_steps(raw):
    out = []
    for step in (raw or []):
        text = step.strip() if isinstance(step, str) else str(step or "").strip()
        if text:
            out.append(text)
    return out


# [ADDED v2026.9.20] The languages a recipe may be rewritten into.
#
# Read from LANG_NAME_MAP so there is ONE list of languages in this
# integration rather than a copy here that can drift (RULE 33a.6).
#
# Imported inside the function on purpose. localized_strings pulls in the AI
# router, which pulls in aiohttp - and this module is otherwise pure: a dict,
# a clock and some string checks. Importing it at module level would make a
# store of pending proposals impossible to load without the whole HTTP stack
# behind it. The import is cached after the first call.
def _allowed_languages():
    from .ai_core.localized_strings import LANG_NAME_MAP
    return frozenset(LANG_NAME_MAP)

# A title is a line, not a document. Long enough for any real recipe name and
# short enough that nothing can be smuggled through the field.
MAX_NAME_LENGTH = 120


def put(user_id, recipe_id, summary, ingredients, steps,
        name=None, language=None):
    """Freeze a proposed change and return it, or None if it says nothing.

    A proposal that changes neither the ingredients nor the steps is dropped:
    asking the user to approve nothing trains them to approve without reading,
    which is the thing this whole mechanism exists to avoid.

    [MODIFIED v2026.9.20] A proposal can now carry a new TITLE and a new
    LANGUAGE. Without them, asking for a recipe to be rewritten in another
    language produced a recipe whose ingredients and steps were translated
    and whose title was not - and whose language column still claimed the
    old one, which is the column every later translation decision reads.

    Both are optional and both are checked here rather than trusted: the
    language against a fixed list, the name against a length. Anything else
    is dropped and the recipe keeps what it had.
    """
    if not recipe_id:
        return None
    clean_ing = _clean_ingredients(ingredients)
    clean_steps = _clean_steps(steps)
    if not clean_ing and not clean_steps:
        return None

    clean_name = str(name or "").strip()
    if len(clean_name) > MAX_NAME_LENGTH:
        _LOGGER.warning("[HO-EDIT] Ignored a proposed title of %d characters.",
                        len(clean_name))
        clean_name = ""

    clean_lang = str(language or "").strip().lower().split("-")[0]
    if clean_lang and clean_lang not in _allowed_languages():
        _LOGGER.warning("[HO-EDIT] Ignored an unknown language %r.", language)
        clean_lang = ""

    proposal = {
        "recipe_id": str(recipe_id),
        "summary": str(summary or "").strip(),
        "ingredients": clean_ing,
        "steps": clean_steps,
        "name": clean_name,
        "language": clean_lang,
        "created": time.time(),
    }
    _PENDING[_key(user_id, recipe_id)] = proposal
    _LOGGER.debug(
        "[HO-EDIT] Proposal held for recipe=%s (%d ingredients, %d steps)",
        recipe_id, len(clean_ing), len(clean_steps),
    )
    return proposal


def get(user_id, recipe_id):
    """The live proposal for this user and recipe, or None."""
    key = _key(user_id, recipe_id)
    proposal = _PENDING.get(key)
    if not proposal:
        return None
    if time.time() - proposal.get("created", 0) > TTL_SECONDS:
        _PENDING.pop(key, None)
        _LOGGER.debug("[HO-EDIT] Proposal for recipe=%s expired.", recipe_id)
        return None
    return proposal


def pop(user_id, recipe_id):
    """Take the proposal so it can be applied exactly once."""
    proposal = get(user_id, recipe_id)
    if proposal:
        _PENDING.pop(_key(user_id, recipe_id), None)
    return proposal


def clear(user_id, recipe_id):
    _PENDING.pop(_key(user_id, recipe_id), None)


def normalise_scope(raw):
    """Map an incoming scope onto the allow-list, or None to reject.

    Returning None is a refusal, not a default. A scope that cannot be read is
    never treated as "save": guessing wrong in that direction rewrites the
    user's recipe (RULE 31, fail closed).
    """
    value = str(raw or "").strip().lower()
    return value if value in ALLOWED_SCOPES else None


async def async_apply(hass, user_id, recipe_id, scope):
    """THE execution boundary. Applies a frozen proposal, or refuses.

    Reached from two places - the buttons on the proposal, and a typed
    approval - and written once so the two cannot drift apart (RULE 33d).
    Both are the same authenticated user answering the same question; the
    only difference is how they said it.

    Note what this does not accept: no ingredients, no steps, no recipe
    content of any kind. Everything written comes from the proposal that was
    frozen when it was shown. A caller can say which proposal and how far to
    apply it, and nothing else.

    Returns a dict describing what happened, or {"error": ...}. Never raises
    for an ordinary refusal.
    """
    checked_scope = normalise_scope(scope)
    if checked_scope is None:
        # Fail closed. An unreadable scope is never read as "save": guessing
        # that way rewrites a recipe nobody asked to change (RULE 31).
        return {"error": "Unknown scope."}
    if not user_id or not recipe_id:
        return {"error": "Unknown user or recipe."}

    proposal = pop(user_id, recipe_id)
    if not proposal:
        return {"error": "Nothing to confirm."}

    if checked_scope == SCOPE_SESSION:
        # The screen changes, the stored recipe does not. This is the "more
        # people are coming tonight" case: one cook at a different scale,
        # with the recipe left as it was.
        _LOGGER.info("[HO-EDIT] Applied to this session only: %s", recipe_id)
        return {
            "applied": SCOPE_SESSION,
            "ingredients": proposal["ingredients"],
            "steps": proposal["steps"],
            "name": proposal.get("name") or "",
            "language": proposal.get("language") or "",
        }

    rec = await recipes_db.async_get_by_id(hass, recipe_id)
    if not rec:
        return {"error": "Recipe not found."}

    # async_save directly rather than the panel's "save" action: that action
    # stamps source_type='manual', which would relabel a recipe the assistant
    # wrote as the user's own. handwritten_notes and prep_time are not passed
    # at all, and an omitted argument means "leave alone", so a drawing made
    # on the page survives an edit to the text (RULE 33a.8).
    # [FIXED v2026.9.20] An omitted list means "leave it alone", never "clear
    # it". put() only requires that a proposal changes ONE of the two, so a
    # proposal carrying steps and no ingredients would have stored a recipe
    # with no ingredients at all - the exact shape of loss RULE 33a.8 exists
    # to stop, and reachable from any model turn that answers with one list.
    await recipes_db.async_save(
        hass,
        proposal.get("name") or rec["name"],
        proposal["ingredients"] or rec["ingredients"],
        proposal["steps"] or rec["steps"],
        rec["timers"],
        language=proposal.get("language") or rec["language"],
        tags=rec["tags"],
        notes=rec["notes"],
        source_type=rec["source_type"],
        recipe_id=rec["id"],
        category=rec.get("category"),
    )
    hass.bus.async_fire("home_organizer_db_update")
    _LOGGER.info("[HO-EDIT] Saved into recipe %s", recipe_id)
    return {
        "applied": SCOPE_SAVE,
        "ingredients": proposal["ingredients"] or rec["ingredients"],
        "steps": proposal["steps"] or rec["steps"],
        "name": proposal.get("name") or rec["name"],
        "language": proposal.get("language") or rec["language"],
    }
