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
// [MODIFIED v2026.9.20 | 2026-09-20] Purpose: The icon has COLOUR and is
//   FILLED. Every role in the palette resolved to currentColor, which made
//   each drawing a single-colour outline - cyan on a list row, white on the
//   enlarge overlay, because currentColor is whatever the container's text
//   colour happens to be. Only ink stays currentColor now, because a
//   contour is the one part that has to flip with the background; the rest
//   are fixed mid-tones chosen to read on the light theme, the dark theme
//   and the overlay's near-black scrim alike.
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
// 2. COLOUR BY NAME, NEVER BY VALUE. The assistant names a colour ROLE and
//    the palette below decides what that is. It cannot send a colour, the
//    same way it cannot send markup - a name from a fixed list carries
//    nothing. The fills are fixed mid-tones that read on the light theme,
//    the dark theme and the near-black enlarge overlay alike; only the
//    contour is currentColor, because a contour is the one part that has to
//    flip with the background behind it.
//
// 3. ONE DRAWING, TWO SIZES. The same icon is shown at about 40px in a list
//    and at 140px in the enlarge overlay. It is a vector, so that costs no
//    quality - but it means the drawing has to be designed for the LARGE
//    view, and stroke widths are in viewBox units so they shrink with it.

import { shapesFromSpec } from './spec-draw.js?v=2026.9.22';

// THE PALETTE. A role name in, a colour out.
//
// The assistant never sends a colour. It sends the NAME of a role, and this
// table decides what that is - which is the same boundary as everything
// else here: a name from a fixed list cannot carry anything (RULE 7).
//
// [MODIFIED v2026.9.20] These were all currentColor, which made every icon a
// single-colour line drawing - cyan in a list, white on the enlarge overlay,
// because currentColor is whatever the container's text colour happens to
// be. A tomato came out the same colour as a hammer.
//
// TWO KINDS OF ENTRY, and the difference matters:
//
//   ink is still currentColor. It is the CONTOUR, and a contour has to be
//   dark on the light theme and light on the dark one - which is exactly
//   what currentColor gives for free, with nothing stored knowing which
//   theme was in use when the drawing was made.
//
//   Everything else is a fixed mid-tone. Mid-tone on purpose: these sit on
//   a #2c2c2e card, on a white card, and on the overlay's near-black scrim,
//   and one value has to read on all three. Every shape also carries the ink
//   stroke by default, so even the palest fill keeps a visible edge.
const ICON_ROLES = Object.freeze({
  none: 'none',
  ink: 'currentColor',
  accent: '#3fa9dd',
  wash: 'rgba(128,128,128,0.22)',
  cream: '#ead9ae',
  white: '#f2f2f2',
  red: '#e2574c',
  green: '#52a447',
  brown: '#a5714a',
  gold: '#dfa42a',
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
