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
// [MODIFIED v2026.9.20 | 2026-09-20] Purpose: The drawing-spec core moved
//   to ../spec-draw.js. Item icons need the same allow-lists and nothing
//   else about this file, and two copies of an allow-list is two things
//   to keep in step (RULE 33d). What stays here is what makes a drawing a
//   recipe emblem: the palettes and the medallion.
// [MODIFIED v2026.9.19 | 2026-09-19] Purpose: The local part library is
//   GONE, along with emblem-parts.js and the 132 composed dishes. An emblem
//   is now only ever the one the assistant designed for THAT recipe. A recipe
//   with no emblem shows a camera on an empty plate instead of a drawing
//   chosen from its chapter - see below.

import { shapesFromSpec } from '../spec-draw.js?v=2026.9.20';

// ---------------------------------------------------------------- identity

// FNV-1a. Short, stable, well spread over small inputs - the avalanche
// matters because "Bread" and "Breads" should not land on the same palette.
// Not a security hash and not used as one.
function hashOf(text) {
  let h = 0x811c9dc5;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// ----------------------------------------------------------------- palette

// Curated rather than computed. A hue picked at random from the whole wheel
// lands on colours that fight the paper this sits on, and the result reads as
// a placeholder. These eight all belong in a printed cookbook.
const PALETTES = [
  { ink: '#7a3b20', accent: '#c8843c', wash: '#f6e7cf' }, // terracotta
  { ink: '#5c5426', accent: '#9aa03f', wash: '#eeeed2' }, // olive
  { ink: '#6b2f3a', accent: '#b25b63', wash: '#f6dfe0' }, // plum
  { ink: '#25565a', accent: '#5d9a97', wash: '#dcebe8' }, // teal
  { ink: '#7a5320', accent: '#caa042', wash: '#f6ecd2' }, // ochre
  { ink: '#4a3f6b', accent: '#8079ad', wash: '#e6e3f2' }, // iris
  { ink: '#7c3626', accent: '#c4703f', wash: '#f7e3d5' }, // paprika
  { ink: '#34543a', accent: '#6f9b6f', wash: '#e0ecdf' }, // sage
];

// ------------------------------------------------------- the drawing spec
//
// [MODIFIED v2026.9.20] The spec core moved to ../spec-draw.js, because item
// icons need exactly the same allow-lists and nothing else about this file.
// What stays here is what makes a drawing a RECIPE EMBLEM: the palettes and
// the medallion it is mounted in.

// The palette, as the roles a spec may name. Built once per emblem from the
// recipe's own palette, so "ink" and "accent" mean something consistent.
function rolesFor(pal) {
  return {
    none: 'none',
    ink: pal.ink,
    accent: pal.accent,
    wash: pal.wash,
    cream: '#f3e7cf',
    white: '#fdfaf3',
    red: '#c0442c',
    green: '#5b8a4a',
    brown: '#8a5a2b',
    gold: '#d8a548',
  };
}

// -------------------------------------------------------------- the frame

// The medallion. Built with loops so the rings stay regular - by hand they
// never are, and the eye notices.
function tickRing(cx, cy, r, count, len) {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    d += `M${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`
      + `L${(cx + Math.cos(a) * (r + len)).toFixed(2)} `
      + `${(cy + Math.sin(a) * (r + len)).toFixed(2)}`;
  }
  return d;
}

function rosette(cx, cy, r, count) {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    d += `M${cx} ${cy}Q${(x + cx) / 2 + Math.cos(a + 1) * 6} `
      + `${(y + cy) / 2 + Math.sin(a + 1) * 6} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

function frame(pal, seed, inner) {
  const petals = 8 + (seed >> 3) % 5;
  const rotation = (seed >> 7) % 30;
  const uid = 'e' + seed.toString(36);
  return `
<svg viewBox="0 0 120 120" aria-hidden="true" class="cookbook-emblem-svg">
  <defs>
    <radialGradient id="${uid}f" cx="38%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#fffdf7"/>
      <stop offset="62%" stop-color="${pal.wash}"/>
      <stop offset="100%" stop-color="${pal.accent}" stop-opacity=".45"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="55" fill="url(#${uid}f)"/>
  <g fill="none" stroke="${pal.ink}" stroke-opacity=".10"
     transform="rotate(${rotation} 60 60)">
    <path d="${rosette(60, 60, 34, petals)}" stroke-width="1"/>
  </g>
  <g fill="none" stroke="${pal.ink}" stroke-linecap="round">
    <circle cx="60" cy="60" r="55" stroke-width="2" stroke-opacity=".85"/>
    <circle cx="60" cy="60" r="50.5" stroke-width="1" stroke-opacity=".45"/>
    <path d="${tickRing(60, 60, 44, 36, 3)}" stroke-width="1" stroke-opacity=".35"/>
  </g>
  ${inner}
  <g fill="${pal.accent}" fill-opacity=".9">
    <circle cx="60" cy="9" r="2.6"/>
    <circle cx="60" cy="111" r="2.6"/>
    <circle cx="9" cy="60" r="2.6"/>
    <circle cx="111" cy="60" r="2.6"/>
  </g>
</svg>`.trim();
}

function paletteFor(seed, index) {
  if (Number.isFinite(index)) {
    const i = Math.floor(index);
    return PALETTES[((i % PALETTES.length) + PALETTES.length) % PALETTES.length];
  }
  return PALETTES[seed % PALETTES.length];
}

function seedFor(rec) {
  // Identity, not content: the id is stable across edits, so changing a
  // quantity - or the name - does not change the emblem.
  return hashOf(String((rec && rec.id) || (rec && rec.name) || ''));
}

// ------------------------------------------------------------------ public

/**
 * The emblem the assistant designed, built from its spec.
 *
 * Returns null when the spec draws nothing, so the caller keeps whatever
 * emblem the recipe already had rather than replacing it with an empty
 * medallion (RULE 31, fail closed).
 */
export function emblemFromSpec(recipe, spec, paletteIndex) {
  const seed = seedFor(recipe);
  const pal = paletteFor(seed, paletteIndex);
  const shapes = shapesFromSpec(spec, rolesFor(pal));
  if (!shapes) return null;
  // The spec is drawn on the same 0..120 field as the frame, so the
  // assistant positions things against the medallion it can see described in
  // the prompt rather than against an inner box it cannot.
  return frame(pal, seed, `<g>${shapes}</g>`);
}
