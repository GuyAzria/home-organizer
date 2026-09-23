// Home Organizer for Home Assistant
// Copyright (C) 2026 Guy Azria
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details. <https://www.gnu.org/licenses/>.
//
// [MODIFIED v2026.9.22 | 2026-09-22] Purpose: Each shape carries its colour
//   ROLE as data-f, not only the colour it resolved to, so a stylesheet can
//   answer the same role differently per theme. fill= keeps the value that
//   works when no rule applies - deliberately not a var(), because an
//   unsupported var() invalidates the whole attribute and the shape falls
//   back to black.
// [ADDED v2026.9.20 | 2026-09-20] Purpose: The drawing spec, in one place.
//   Extracted from pages/recipe-emblem.js, which was the only thing that
//   could draw one. Item icons need the same core and nothing else about a
//   recipe emblem - not the medallion, not the palettes - and copying it
//   would have left two allow-lists to keep in step (RULE 33d).
//
// WHAT THIS IS - permanent architectural note.
//
// The assistant is never allowed to send a picture. It sends a SPEC: a list
// of shapes, each one a name from a fixed list and a handful of numbers. This
// module turns that into SVG.
//
// Every character of the output is written here. Values from the spec are
// coerced to numbers, or matched against a fixed list, before they are used,
// so the markup is ours whatever the input was. A number cannot carry a
// script; that is the whole reason the interface is shaped this way, and it
// is why nothing downstream has to trust the model (RULE 7, RULE 15).
//
// Two things are deliberately NOT here: the frame a drawing is mounted in,
// and what the colour roles resolve to. A recipe emblem is a medallion on
// cream paper in one of eight palettes; an item icon is line art on nothing
// at all, in the colour of whatever text sits beside it. Those belong to the
// caller.

// The shapes, and which numeric fields each one accepts. A field that is not
// listed here is dropped, whatever the spec says.
export const SPEC_SHAPES = {
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height', 'rx'],
  line: ['x1', 'y1', 'x2', 'y2'],
  path: [],
  polyline: [],
  polygon: [],
};

// The colour ROLES a spec may name. It cannot send a colour value - it names
// one of these and the caller's palette decides what it is.
export const SPEC_COLOR_KEYS = [
  'none', 'ink', 'accent', 'wash',
  'cream', 'white', 'red', 'green', 'brown', 'gold',
];

// Path data is letters and numbers. It cannot express a script, a URL or an
// element, which is why it is the one string the assistant may send.
const PATH_DATA = /^[\s\d.,+\-eEmMzZlLhHvVcCsSqQtTaA]{0,900}$/;
const POINTS_DATA = /^[\s\d.,+\-]{0,600}$/;

export const MAX_SPEC_SHAPES = 60;
const FIELD_MIN = -40;
const FIELD_MAX = 160;

function num(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(FIELD_MIN, Math.min(FIELD_MAX, Math.round(n * 100) / 100));
}

/**
 * Turn a drawing spec into SVG shape markup, or '' if nothing survives.
 *
 * `palette` maps a colour role to a value. It is a plain object, so a caller
 * that wants everything in one colour passes one that answers the same for
 * every role - which is exactly what an item icon does with currentColor.
 *
 * `limit` caps the shape count. A recipe emblem can afford sixty; an icon
 * that has to read at 40px cannot, and the cap is the caller's to set.
 */
export function shapesFromSpec(spec, palette, limit = MAX_SPEC_SHAPES) {
  const list = Array.isArray(spec && spec.shapes) ? spec.shapes : [];
  const pal = palette || {};
  const cap = Math.max(1, Math.min(MAX_SPEC_SHAPES, Number(limit) || MAX_SPEC_SHAPES));
  const out = [];

  for (const raw of list.slice(0, cap)) {
    if (!raw || typeof raw !== 'object') continue;
    const kind = String(raw.t || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(SPEC_SHAPES, kind)) continue;

    const attrs = [];
    for (const field of SPEC_SHAPES[kind]) {
      if (raw[field] === undefined || raw[field] === null) continue;
      attrs.push(`${field}="${num(raw[field], 0)}"`);
    }

    if (kind === 'path') {
      const d = String(raw.d || '');
      if (!PATH_DATA.test(d) || !d.trim()) continue;
      attrs.push(`d="${d.trim()}"`);
    }
    if (kind === 'polyline' || kind === 'polygon') {
      const pts = String(raw.points || '');
      if (!POINTS_DATA.test(pts) || !pts.trim()) continue;
      attrs.push(`points="${pts.trim()}"`);
    }
    if (!attrs.length) continue;

    // A role the palette does not answer for falls back to no fill and the
    // ink stroke, never to whatever string arrived.
    const fillKey = String(raw.fill || 'none');
    const strokeKey = String(raw.stroke || 'ink');
    const fill = Object.prototype.hasOwnProperty.call(pal, fillKey)
      ? pal[fillKey] : 'none';
    const stroke = Object.prototype.hasOwnProperty.call(pal, strokeKey)
      ? pal[strokeKey] : (pal.ink || 'currentColor');
    const width = Math.max(0.5, Math.min(6, Number(raw.w) || 2.2));

    // [ADDED v2026.9.22] The ROLE travels with the shape, not just its
    // colour, so a stylesheet can answer a role differently per theme.
    //
    // A presentation attribute is the weakest thing in the cascade - any
    // real selector beats it - so fill= below stays as the value that
    // works everywhere and CSS may override it where a theme needs to.
    // No var() in the attribute: an unsupported var() invalidates the whole
    // attribute and the shape falls back to black, which is a far worse
    // failure than a colour that is merely not ideal.
    //
    // The role name is one of SPEC_COLOR_KEYS, checked above - it is never
    // a string that arrived from the model.
    const fillRole = Object.prototype.hasOwnProperty.call(pal, fillKey)
      ? fillKey : 'none';

    attrs.push(`fill="${fill}"`, `stroke="${stroke}"`,
      `data-f="${fillRole}"`,
      `stroke-width="${width}"`, 'stroke-linecap="round"',
      'stroke-linejoin="round"');
    out.push(`<${kind} ${attrs.join(' ')}/>`);
  }
  return out.join('');
}
