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
# [MODIFIED v2026.9.20 | 2026-09-20] Purpose: "type" is accepted as a
#   spelling of "t". The value still has to be one of the seven shape
#   names and every field is still rebuilt from the allow-list, so the
#   boundary is exactly where it was - but a model that wrote "type" had
#   its whole drawing discarded in silence, which reached the user as a
#   button that did nothing.
# [ADDED v2026.9.20 | 2026-09-20] Purpose: The drawing-spec validator, moved
#   out of agents/cooking_agent.py. It was written for recipe emblems and has
#   nothing to do with cooking: the inventory agent now draws item icons the
#   same way, and two copies of an allow-list is two things to keep in step
#   (RULE 33d).
#
# WHY A SPEC AND NOT A PICTURE - permanent architectural note.
#
# This is the boundary that lets the assistant contribute a drawing without
# ever being trusted. It does not accept SVG, or any markup. It accepts a
# list of SHAPES: a type from a fixed set, numbers, and colour ROLE names
# from another fixed set.
#
# Nothing is "stripped". A new list is built and only recognised shapes,
# fields and names are copied into it, which is a stronger promise than
# removing what looks wrong - there is no path by which an unrecognised key
# reaches the output, because the output is assembled from scratch.
#
# A number cannot carry a script. That is the whole point (RULE 7, RULE 11).
#
# Kept in step with frontend/spec-draw.js, which does the drawing from the
# same two lists.

import logging
import math
import re

_LOGGER = logging.getLogger(__name__)


# [ADDED v2026.9.17] The shapes an emblem design may be made of.
#
# This replaced accepting SVG from the model. A shape is a type from this
# list plus numbers, so there is no markup to sanitise and nothing that could
# carry a script, a URL or an element. The panel turns it into a picture.
#
# Kept in step with SPEC_SHAPES and SPEC_COLORS in
# frontend/pages/recipe-emblem.js, which does the drawing.
EMBLEM_SPEC_SHAPES = frozenset({
    "circle", "ellipse", "rect", "line", "path", "polyline", "polygon",
})
EMBLEM_SPEC_COLORS = frozenset({
    "none", "ink", "accent", "wash", "cream", "white",
    "red", "green", "brown", "gold",
})
EMBLEM_SPEC_NUMBERS = frozenset({
    "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height",
    "x1", "y1", "x2", "y2", "w",
})
EMBLEM_MAX_SHAPES = 60
# An icon is read at 40px. See validate_icon_spec.
MAX_ICON_SHAPES = 28
_PATH_DATA_RE = re.compile(r"^[\s\d.,+\-eEmMzZlLhHvVcCsSqQtTaA]{1,900}$")
_POINTS_RE = re.compile(r"^[\s\d.,+\-]{1,600}$")


def validate_spec(raw_shapes, max_shapes=EMBLEM_MAX_SHAPES):
    """Rebuild a drawing spec from scratch, keeping only what is allowed.

    Returns a clean list, or [] to refuse. Nothing is "stripped": a new list
    is built and only recognised shapes, fields and colour names are copied
    into it, which is a stronger promise than removing what looks wrong.
    """
    if not isinstance(raw_shapes, list):
        return []
    out = []
    for item in raw_shapes[:max(1, int(max_shapes or EMBLEM_MAX_SHAPES))]:
        if not isinstance(item, dict):
            continue
        # [MODIFIED v2026.9.20] "type" is accepted as a spelling of "t".
        #
        # This is NOT a loosening of the boundary - whatever the key is
        # called, the VALUE still has to be one of the seven names below, and
        # everything else about the shape is rebuilt field by field exactly
        # as before. It is only that models write "type" about as often as
        # "t", and a spec that used it was discarded in full and in silence:
        # every shape failed this line, the list came back empty, and the
        # user saw a button that did nothing.
        kind = str(item.get("t") or item.get("type") or "").strip().lower()
        if kind not in EMBLEM_SPEC_SHAPES:
            continue
        shape = {"t": kind}
        for key, value in item.items():
            if key in EMBLEM_SPEC_NUMBERS:
                try:
                    number = float(value)
                except (TypeError, ValueError):
                    continue
                # Infinity and NaN are floats, and they survive round().
                # json.dumps writes them as bare Infinity/NaN, which is not
                # valid JSON and would break the reply on its way to the
                # panel - so they are dropped here rather than debugged
                # later from a websocket error.
                if not math.isfinite(number):
                    continue
                shape[key] = round(number, 2)
            elif key in ("fill", "stroke"):
                name = str(value or "").strip().lower()
                if name in EMBLEM_SPEC_COLORS:
                    shape[key] = name
            elif key == "d" and kind == "path":
                text = str(value or "").strip()
                if _PATH_DATA_RE.match(text):
                    shape["d"] = text
            elif key == "points" and kind in ("polyline", "polygon"):
                text = str(value or "").strip()
                if _POINTS_RE.match(text):
                    shape["points"] = text
        # A shape with no geometry draws nothing and is not worth sending.
        if len(shape) > 1:
            out.append(shape)
    return out


def validate_icon_spec(raw_shapes):
    """The same validator, with an icon's smaller budget.

    [ADDED v2026.9.20] An emblem is decoration at 132px and can carry sixty
    shapes. An item icon has to stay legible at 40px in a list, where every
    extra line is one more thing to turn into mud - and the same drawing is
    enlarged to 140px, so it has to hold up at both. Twenty-eight is enough
    for a recognisable guitar and not enough to draw its strings one by one.
    """
    return validate_spec(raw_shapes, max_shapes=MAX_ICON_SHAPES)
