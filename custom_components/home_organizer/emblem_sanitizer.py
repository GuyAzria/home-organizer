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
# [ADDED v2026.9.17 | 2026-09-17] Makes a model-written SVG safe to keep.
#
# WHY THIS MODULE EXISTS - permanent security note. Read before changing it.
#
# A recipe's emblem can now be DRAWN by the assistant from a description. That
# means markup written by a language model is stored in the database and later
# rendered inside the panel, which is the exact shape RULE 11 and RULE 15 warn
# about: SVG is not a picture format, it is a document format, and it can
# carry <script>, event handlers, javascript: URLs and <foreignObject> with
# full HTML inside it.
#
# Prompt instructions are NOT a security control (RULE 7). The model is asked
# for a narrow drawing, and it is assumed to fail at that - through confusion,
# through a bad day, or because a recipe title it was fed carried an
# injection. So nothing it returns is trusted.
#
# THE APPROACH IS REBUILD, NOT STRIP.
#
# Removing bad things from a document leaves you guessing at what "bad" is,
# and every such filter has been defeated by something its author had not
# thought of. This walks the parsed tree and builds a NEW document from
# scratch, copying across only elements and attributes that are on a list of
# what is known to be safe and needed. Anything unrecognised is not removed -
# it is simply never emitted, which is a different and much stronger promise.
#
# The same function guards the emblem the PANEL generates, so there is one
# gate rather than two that can drift (RULE 33d).

import logging
import re
import xml.etree.ElementTree as ET

_LOGGER = logging.getLogger(__name__)

# The drawing is meant to be small. These caps are the first defence: they
# bound the work done on the event loop and stop a huge document long before
# anything is parsed.
MAX_INPUT_CHARS = 12000
MAX_OUTPUT_CHARS = 9000
MAX_ELEMENTS = 160
MAX_DEPTH = 8

# The canvas every emblem is drawn on. Forced on the way out, so a model that
# picks its own coordinate space cannot produce something that overflows its
# frame or renders as a speck.
CANVAS = "0 0 120 120"

# Shapes and structure. No <text>, so an emblem stays a drawing and can never
# show words - which keeps the "no user text is drawn" property the local
# generator has. No <use> or <image>, which pull in content from elsewhere.
# No <foreignObject>, which is a door into full HTML.
ALLOWED_TAGS = {
    "svg", "g", "defs", "title",
    "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
    "linearGradient", "radialGradient", "stop",
}

# Presentation only. Nothing that can navigate, load or execute: no href, no
# xlink:href, no style, no on* handler, no class that could match a rule
# outside this drawing.
ALLOWED_ATTRS = {
    "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
    "width", "height", "points", "transform", "viewBox",
    "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
    "stroke-dasharray", "stroke-opacity", "fill-opacity", "fill-rule",
    "opacity", "offset", "stop-color", "stop-opacity",
    "gradientUnits", "gradientTransform", "id",
}

# Attribute values are checked as well as attribute names. An allowed name
# carrying "javascript:" would otherwise walk straight through.
# Percent is allowed because gradient coordinates are normally written that
# way - cx="40%" - and dropping them silently flattened every gradient the
# model drew. It carries no risk: the character class admits nothing that can
# start a URL, an entity or a tag.
_NUMERIC = re.compile(r"^[\s\d.,+\-eE%]*$")
_PATH_DATA = re.compile(r"^[\s\d.,+\-eEmMzZlLhHvVcCsSqQtTaA]*$")
_COLOR = re.compile(
    r"^(?:#[0-9a-fA-F]{3,8}"
    r"|rgba?\(\s*[\d.,\s%]+\)"
    r"|none|currentColor|transparent"
    r"|black|white|red|green|blue|yellow|orange|brown|grey|gray|gold|silver)$"
)
# A gradient reference may only point INSIDE this same document, by a plain
# id. That is what stops url(http://...) and url(javascript:...).
_LOCAL_URL = re.compile(r"^url\(#[A-Za-z][\w\-]{0,62}\)$")
_ID = re.compile(r"^[A-Za-z][\w\-]{0,62}$")
_TRANSFORM = re.compile(
    r"^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)"
    r"\(\s*[-\d.,\s]+\)\s*)+$"
)
_PERCENT_OR_NUM = re.compile(r"^[\d.]+%?$")

_COLOR_ATTRS = {"fill", "stroke", "stop-color"}
_NUMERIC_ATTRS = {
    "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
    "width", "height", "stroke-width", "stroke-opacity", "fill-opacity",
    "opacity", "stop-opacity", "stroke-dasharray",
}


def _localname(tag):
    """Drop the namespace ElementTree attaches, so 'svg' matches 'svg'."""
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1]


def _attr_ok(name, value):
    """Is this attribute allowed to carry this value?"""
    if name not in ALLOWED_ATTRS:
        return False
    low = value.strip().lower()
    # Belt and braces. None of these can survive the per-attribute checks
    # below either, but a value that even mentions them is not worth keeping.
    if "javascript:" in low or "<" in low or "expression(" in low:
        return False

    if name in _COLOR_ATTRS:
        return bool(_COLOR.match(value.strip()) or _LOCAL_URL.match(value.strip()))
    if name == "d":
        return bool(_PATH_DATA.match(value))
    if name == "points":
        return bool(_NUMERIC.match(value))
    if name == "transform" or name == "gradientTransform":
        return bool(_TRANSFORM.match(value))
    if name == "viewBox":
        return bool(_NUMERIC.match(value))
    if name == "id":
        return bool(_ID.match(value.strip()))
    if name == "offset":
        return bool(_PERCENT_OR_NUM.match(value.strip()))
    if name in _NUMERIC_ATTRS:
        return bool(_NUMERIC.match(value))
    if name == "gradientUnits":
        return value.strip() in ("userSpaceOnUse", "objectBoundingBox")
    if name in ("stroke-linecap", "stroke-linejoin", "fill-rule"):
        return value.strip() in (
            "butt", "round", "square", "miter", "bevel", "nonzero", "evenodd",
        )
    return False


def _rebuild(src, depth, budget):
    """Copy one element into a NEW element, keeping only what is allowed.

    Returns None for anything that is not on the list, which drops it and
    everything inside it.
    """
    if depth > MAX_DEPTH or budget["n"] >= MAX_ELEMENTS:
        return None
    tag = _localname(src.tag)
    if tag not in ALLOWED_TAGS:
        return None

    budget["n"] += 1
    out = ET.Element(tag)
    for name, value in (src.attrib or {}).items():
        clean_name = _localname(name)
        # An attribute that arrived namespaced - xlink:href and friends - is
        # dropped outright. Nothing legitimate here needs one.
        if clean_name != name and ":" in name:
            continue
        if _attr_ok(clean_name, str(value)):
            out.set(clean_name, str(value))

    for child in list(src):
        built = _rebuild(child, depth + 1, budget)
        if built is not None:
            out.append(built)

    # Text is never carried over. <title> keeps its tag for accessibility but
    # arrives empty, and no other allowed element has meaningful text.
    return out


def sanitize_emblem_svg(raw):
    """Return safe SVG built from `raw`, or None if nothing usable remains.

    None means refuse. The caller keeps whatever emblem the recipe already
    had rather than storing something that could not be made safe (RULE 31,
    fail closed).
    """
    if not raw or not isinstance(raw, str):
        return None
    text = raw.strip()
    if len(text) > MAX_INPUT_CHARS:
        _LOGGER.warning("[HO-EMBLEM] Rejected: %d chars.", len(text))
        return None

    # Strip a code fence if the model wrapped its answer in one. This is
    # cosmetic tidying of a known habit, not a security measure.
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()

    # Refuse doctypes and entity declarations BEFORE parsing. This is what
    # keeps the parser away from entity-expansion and external-entity tricks,
    # which are attacks on the parser itself rather than on the output.
    lowered = text.lower()
    if "<!doctype" in lowered or "<!entity" in lowered or "<![cdata[" in lowered:
        _LOGGER.warning("[HO-EMBLEM] Rejected: doctype/entity/cdata present.")
        return None
    # Only the five standard entities and numeric references may appear.
    for match in re.finditer(r"&([^;\s]{0,32});", text):
        if not re.match(r"^(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6})$",
                        match.group(1)):
            _LOGGER.warning("[HO-EMBLEM] Rejected: entity %r.", match.group(1))
            return None

    try:
        root = ET.fromstring(text)
    except ET.ParseError as err:
        _LOGGER.warning("[HO-EMBLEM] Rejected: will not parse (%s).", err)
        return None

    if _localname(root.tag) != "svg":
        _LOGGER.warning("[HO-EMBLEM] Rejected: root is not <svg>.")
        return None

    budget = {"n": 0}
    clean = _rebuild(root, 0, budget)
    if clean is None:
        return None

    # A drawing with nothing drawable in it is a refusal, not a blank emblem:
    # storing an empty circle would replace a good emblem with nothing.
    drawable = sum(
        1 for el in clean.iter()
        if _localname(el.tag) in
        ("path", "circle", "ellipse", "rect", "line", "polyline", "polygon")
    )
    if drawable == 0:
        _LOGGER.warning("[HO-EMBLEM] Rejected: nothing drawable survived.")
        return None

    # The canvas and the sizing are ours, not the model's. Width and height
    # are removed so the stylesheet decides how big it is drawn.
    clean.set("viewBox", CANVAS)
    clean.attrib.pop("width", None)
    clean.attrib.pop("height", None)
    clean.set("aria-hidden", "true")
    clean.set("class", "cookbook-emblem-svg")

    out = ET.tostring(clean, encoding="unicode")
    # ElementTree writes namespaces back in as ns0: prefixes when the source
    # carried them. They are harmless but noisy, and a browser needs the real
    # SVG namespace on the root to render a standalone document.
    out = re.sub(r'\sxmlns:ns\d+="[^"]*"', "", out)
    out = re.sub(r"</?ns\d+:", lambda m: m.group(0).replace(
        m.group(0).split("/")[-1].split(":")[0] + ":", ""), out)
    out = re.sub(r"\sns\d+:", " ", out)
    if "xmlns=" not in out:
        out = out.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)

    if len(out) > MAX_OUTPUT_CHARS:
        _LOGGER.warning("[HO-EMBLEM] Rejected: %d chars after cleaning.", len(out))
        return None
    return out
