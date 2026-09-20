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
// [ADDED v2026.9.20 | 2026-09-20] Purpose: An item's icon, drawn from a spec
//   the assistant designed, instead of picked from the shipped library.
//
// WHY THIS EXISTS - permanent architectural note.
//
// The library holds fifty icons. A guitar, a pickle jar, a socket set - none
// of them are in it, so the assistant had to pick the nearest thing, and the
// nearest thing to a guitar is not a guitar. It also cost ~900 tokens of
// prompt on every single inventory turn to offer that choice.
//
// So the assistant draws instead. What it sends is a DRAWING SPEC - shapes
// and numbers, never markup - and spec-draw.js builds the SVG here in the
// panel from values it has already checked. Nothing about that path trusts
// the model (RULE 7, RULE 15).
//
// THREE THINGS THIS MUST KEEP:
//
// 1. TRANSPARENT. An icon sits on a list row, a folder tile, a chat bubble
//    and a dark overlay. It carries no background of its own.
//
// 2. ONE COLOUR, INHERITED. Everything is drawn in currentColor, so the icon
//    is whatever colour the text beside it is - which is the only way one
//    drawing reads on both the light and the dark theme. The assistant still
//    names colour ROLES; they all resolve to the same thing here. It cannot
//    send a colour value in either case.
//
// 3. ONE DRAWING, TWO SIZES. The same icon is shown at about 40px in a list
//    and at 140px in the enlarge overlay. It is a vector, so that costs no
//    quality - but it means the drawing has to be designed for the LARGE
//    view, and stroke widths are in viewBox units so they shrink with it.

import { shapesFromSpec } from './spec-draw.js?v=2026.9.20';

// Every role resolves to the same thing, except "none". The assistant is
// still free to name any of them; an icon simply has one colour.
//
// currentColor is the whole trick: the icon inherits the colour of the text
// around it, so a theme change needs no redraw and nothing stored has to
// know which theme was in use when it was drawn.
const ICON_ROLES = Object.freeze({
  none: 'none',
  ink: 'currentColor',
  accent: 'currentColor',
  wash: 'none',
  cream: 'none',
  white: 'none',
  red: 'currentColor',
  green: 'currentColor',
  brown: 'currentColor',
  gold: 'currentColor',
});

// Fewer than an emblem gets. An emblem is decoration at 132px and can carry
// sixty shapes; an icon has to stay legible at 40px, where every extra line
// is one more thing to turn into mud. Enough for a recognisable guitar,
// not enough to draw its strings individually.
export const MAX_ICON_SHAPES = 28;

/**
 * Build an item's icon from a spec, or return '' when it draws nothing.
 *
 * '' rather than an empty frame on purpose: the caller then keeps whatever
 * the item had - its library icon, or the default - instead of replacing a
 * picture with a blank square (RULE 31, fail closed).
 */
export function itemIconFromSpec(spec) {
  const shapes = shapesFromSpec(spec, ICON_ROLES, MAX_ICON_SHAPES);
  if (!shapes) return '';
  // The same 0..120 field the emblems use, so one spec vocabulary covers
  // both and the assistant does not have to be told which it is drawing for.
  return `<svg viewBox="0 0 120 120" class="ho-item-icon" role="img" `
    + `aria-hidden="true" fill="none">${shapes}</svg>`;
}
