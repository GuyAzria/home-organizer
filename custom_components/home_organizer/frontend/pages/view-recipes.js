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
// [MODIFIED v2026.9.20 | 2026-09-20] Purpose: The recipe toolbar had grown
//   to five controls. Edit title, move to another chapter and delete are
//   now behind one three-dot button - renderRecipeMenu - leaving the row
//   holding what people actually press. The shelf the recipe sits on is
//   shown beside the item that changes it, so moving the chip off the
//   toolbar did not also hide what it was telling you. recipeMenu is a UI
//   mode and is cleared everywhere its siblings are (RULE 33a.1).
//   Same release: absorbAppliedEdit takes the new title and language
//   as well, so approving a rewrite in another language updates the
//   heading and clears the "Translated" badge - the recipe IS in that
//   language now, so it is not a translation of anything.
//   Same release: a timer for a step with a wait is OFFERED with two
//   buttons instead of being set silently. The buttons send yes or no;
//   the minutes and label stay in the session, so the answer cannot
//   change what it is answering.
//   Same release: opening a recipe from the contents page now resets the
//   assistant panel, which only the page arrows used to do - the reply
//   about the previous recipe stayed on screen beside the new one.
// [MODIFIED v2026.9.19 | 2026-09-19] Purpose: A recipe page created with
//   only a title could not be filled in: the assistant read the open page
//   as a recipe to amend and kept re-showing it instead of saving. The
//   page now hands the assistant its recipe id, and openRecipeById opens
//   whatever the assistant saved - which is also how a request typed on
//   the contents page ("something for lunch from what is in the fridge")
//   arrives as a recipe page rather than as a chat reply. check_stock now
//   sends pantryStaples(): water, salt, oil and pepper are assumed to be
//   in the house and are never reported missing. The words come from the
//   translation file, not from this file, because an ingredient is written
//   in whatever language the recipe is written in.
//   Same release: a recipe built for a blank page is now OFFERED rather than
//   written - the approval box asks a question fitted to an empty page. A
//   chosen photo is re-encoded here to a long edge of 1280px instead of being
//   refused over 6 MB, which had made the picture people had just taken the
//   one picture they could not use; see shrinkRecipePhoto for why it decodes
//   through an <img> and why the canvas is target-sized.
//   Same release: the contents page keeps its place. Opening a chapter
//   redraws the view, which rebuilt the scrolling element and sent the
//   reader back to the top of a long list; the position is now remembered
//   per screen, and revealOpenedChapter scrolls the minimum needed to bring
//   the opened chapter's recipes into view without pushing its heading off.
//   Same release: the local emblem library is GONE. Nothing is drawn
//   speculatively any more - a plate shows a photo, or an emblem the
//   assistant designed for that dish, or a camera inviting one. See the
//   plate in renderCookbookPage for why a plausible drawing of the wrong
//   dish is worse than none.
//   Same release: pressing a photograph opens it full screen, with a
//   delete button - a 130px plate is not where anyone looks at a picture
//   of their own dinner. Deleting one asks the assistant to design an
//   emblem so the recipe is not left on an empty plate; if it cannot, the
//   camera plate is what remains.
//
// THE COOKBOOK SCREEN - architecture.
// (Kept as permanent documentation, not a history entry: RULE 28 caps the
// history at two entries but explicitly preserves notes like this one.)
//
// A note on the architecture, because the request asked for a Lit element:
// this panel is not built from Lit elements. It is ONE custom element whose
// behaviour is composed from mixins (ChatMixin, InventoryMixin, CameraMixin
// and so on), all sharing a single shadowRoot, a single `_t()` translator,
// `callHA`, `localData` and one `render()`. A Lit element dropped in here
// would need its own shadow root, its own style pipeline and its own copy of
// the translation and websocket plumbing, and it could not use the existing
// FAB, theming or RTL handling.
//
// So this follows the established pattern: a mixin in pages/, with its
// styling in a dedicated pages/recipes.css exactly like the other screens.
// It is a new self-contained component in the pages directory as asked; it is
// simply a mixin rather than a Lit element, which is what "a new component"
// means in this codebase.

import { escapeHtml } from '../organizer-utils.js?v=2026.10.9';
// [MODIFIED v2026.9.19] Only the assistant's drawing is built here now. The
// local part library that composed emblems from the recipe's chapter has been
// removed - see the plate in renderCookbookPage for why.
import { emblemFromSpec } from './recipe-emblem.js?v=2026.9.19';

const CHEF_HAT_SVG =
  '<svg viewBox="0 0 24 24"><path d="M12 3a5 5 0 0 0-4.9 4.02A4 4 0 0 0 6 15v1h12v-1a4 4 0 0 0-1.1-7.98A5 5 0 0 0 12 3zM6 18h12v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2z"/></svg>';
// [ADDED v2026.9.17] The page arrows, drawn rather than typed.
//
// They were the HEAVY LEFT- and RIGHT-POINTING ANGLE QUOTATION
// MARK ORNAMENT. Both carry Unicode's Bidi_Mirrored property, so inside the
// right-to-left context this panel sets, the browser MIRRORS them: the button
// stayed on its side while the character it contained turned round. Pinning
// the buttons with physical left/right fixed the positions and left the
// glyphs still flipping.
//
// Every chevron-shaped character has this property - 2039, 203A, 27E8, 2329
// and the rest - so choosing a different one does not help. A path has no
// bidi semantics and no font substitution, and it points where it is drawn
// in every language.
const NAV_PREV_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 4.6 8 12l7.4 7.4 1.4-1.4L10.8 12l6-6z"/></svg>';
const NAV_NEXT_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 4.6 7.2 6l6 6-6 6 1.4 1.4L16 12z"/></svg>';
const PENCIL_SVG =
  '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';

// [ADDED v2026.9.20] The three dots that open a recipe's tools.
//
// Drawn rather than typed, for the same reason the page arrows are: a glyph
// would be at the mercy of the font, and anything that looks directional gets
// mirrored inside the RTL context this panel runs in. Three circles cannot be
// mirrored into anything but three circles.
const KEBAB_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/>'
  + '<circle cx="12" cy="19" r="2"/></svg>';

// [ADDED v2026.9.19] The empty plate: a place setting with a camera on it.
//
// What a recipe shows when it has neither a photograph nor an emblem the
// assistant drew. It is deliberately a PROMPT rather than a picture of food -
// pressing the plate opens the camera or the file picker - because a generic
// drawing of the wrong dish says something untrue about the recipe, and an
// empty circle says nothing at all.
//
// Every character is written here. No recipe text reaches it, so there is
// nothing to escape (RULE 15), and it is inline so there is nothing to fetch
// (RULE 16). The 120x120 field matches the drawn emblems it stands in for.
const CAMERA_PLATE_SVG = `
<svg class="cookbook-emblem-svg" viewBox="0 0 120 120" role="img" aria-hidden="true">
  <g fill="none" stroke="#7a5c38" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="60" cy="60" r="41" stroke-width="2" opacity=".55"/>
    <circle cx="60" cy="60" r="33" stroke-width="1" opacity=".3"/>
    <path d="M40 54h8l4-5h16l4 5h8a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4V58a4 4 0 0 1 4-4z"
          stroke-width="2.4"/>
    <circle cx="60" cy="67" r="9" stroke-width="2.4"/>
    <circle cx="76" cy="59" r="1.6" stroke-width="1.6"/>
  </g>
</svg>`;

export const RecipesMixin = (Base) => class extends Base {

  // ------------------------------------------------------------------ entry

  renderRecipesView(content) {
    content.style.padding = '0';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.overflow = 'hidden';

    const wrap = document.createElement('div');
    // [ADDED v2026.10.17] with-souschef shifts the book aside for the docked
    // column on wide screens. Applied only while the panel is open, so a
    // closed panel leaves the book centred as before.
    wrap.className = 'cookbook-wrap with-souschef';
    content.appendChild(wrap);
    this.rememberCookbookScroll(wrap);

    // First visit: nothing fetched yet. Kick off the load and draw the
    // placeholder, rather than rendering an empty shelf that looks like the
    // user has no recipes.
    if (this.recipeList === undefined) {
      this.loadRecipes();
      const loading = document.createElement('div');
      loading.className = 'cookbook-empty';
      loading.textContent = this._t('loading', 'Loading...');
      wrap.appendChild(loading);
      return;
    }

    if (this.openRecipe) {
      this.renderCookbookPage(wrap);
    } else {
      this.renderCookbookShelf(wrap);
      // The assistant belongs on the shelf too: asking for a new recipe is
      // something you do before choosing one, not after.
      this.renderSousChefPanel(wrap);
    }

    // Both of these read the tree that was just built, so they come last.
    this.restoreCookbookScroll(wrap);
    this.revealOpenedChapter(wrap);
  }

  // ==================================================================
  // [ADDED v2026.9.19] Keeping your place in the book
  //
  // Every change of state here redraws the whole view, and .cookbook-wrap -
  // the element that actually scrolls - is rebuilt with it. A new element
  // starts at scrollTop 0, so opening a chapter near the bottom of a long
  // contents page threw the reader back to the very top, and they had to
  // scroll all the way down again to see the list they had just opened.
  //
  // The position is remembered PER SCREEN rather than as a single number:
  // opening a recipe starts at its title, and coming back to the contents
  // returns to the chapter you left rather than to the top.
  //
  // It is recorded from a scroll listener rather than read at render time,
  // because by the time this mixin is called the old element has already
  // been discarded and there is nothing left to measure.
  // ==================================================================

  cookbookScrollKey() {
    return this.openRecipe ? 'recipe:' + this.openRecipe.id : 'shelf';
  }

  rememberCookbookScroll(wrap) {
    const key = this.cookbookScrollKey();
    this._cookbookScroll = this._cookbookScroll || {};
    // passive: this listener never calls preventDefault, and saying so keeps
    // scrolling off the main thread on touch.
    wrap.addEventListener('scroll', () => {
      this._cookbookScroll[key] = wrap.scrollTop;
    }, { passive: true });
  }

  restoreCookbookScroll(wrap) {
    const top = (this._cookbookScroll || {})[this.cookbookScrollKey()] || 0;
    if (!top) return;
    // Twice on purpose. The first assignment avoids a visible flash at the
    // top; but the children have only just been appended and the browser may
    // not have laid them out yet, in which case scrollHeight is still short
    // and the value is silently clamped to 0. The second runs after layout.
    wrap.scrollTop = top;
    requestAnimationFrame(() => { wrap.scrollTop = top; });
  }

  // Bring a chapter's list into view - but only as far as it needs, and never
  // far enough to push the chapter's own heading off the top.
  //
  // Simply holding the scroll position is not enough on its own: a chapter
  // tapped while it sits at the BOTTOM of the screen opens its recipes below
  // the fold, where they cannot be seen at all. Scrolling it to the top of
  // the screen every time would be the opposite mistake - a jump the reader
  // did not ask for when the list already fitted.
  revealOpenedChapter(wrap) {
    const name = this._chapterJustOpened;
    this._chapterJustOpened = null;
    if (!name) return;

    requestAnimationFrame(() => {
      let row = null;
      wrap.querySelectorAll('.cookbook-chapter').forEach(el => {
        if (el.dataset.chapter === name) row = el;
      });
      if (!row) return;
      const body = row.nextElementSibling;
      if (!body || body.dataset.chapterBody !== name) return;

      // Measured against the scrolling box rather than offsetTop: the pages
      // in this view are positioned, so offsetParent is not the scroller.
      const box = wrap.getBoundingClientRect();
      const overflow = body.getBoundingClientRect().bottom - box.bottom;
      if (overflow <= 0) return;           // already on screen - leave it be

      const headroom = Math.max(0, row.getBoundingClientRect().top - box.top);
      wrap.scrollTop += Math.min(overflow, headroom);
    });
  }

  // -------------------------------------------------------------- the shelf

  // [MODIFIED v2026.10.18] A table of contents, not a heap of tiles.
  //
  // The shelf listed every recipe as a loose tile, which stops being readable
  // at about a dozen. It is now the contents page of the book: closed
  // chapters with a count, and the titles only once a chapter is opened.
  //
  // The ten defaults are a starting structure, not a fixed list - a chapter
  // the user invents sits alongside them, and a chapter the assistant fills
  // in appears by itself. Empty default chapters are still shown, because an
  // empty shelf you can file into is more useful than one that only appears
  // after you have already filed something.
  // [FIXED v2026.9.17] These are KEYS now, not translated labels.
  //
  // They used to be the translated names, which meant the chapter a recipe
  // belonged to was stored as whatever the panel happened to be showing when
  // it was filed. Switching the panel to Hebrew then produced ten empty
  // Hebrew chapters beside the English ones that actually held the recipes -
  // the same shelf twice, in two languages, which is what was reported.
  //
  // A category is now one of two things, and the difference is visible at a
  // glance: a "cat_" key, which is a built-in chapter and is translated when
  // it is drawn, or any other text, which is a chapter the user invented and
  // is shown exactly as they typed it.
  //
  // Nothing needs migrating. A recipe still carrying an old translated label
  // simply falls into the second case and keeps its own shelf.
  defaultRecipeCategories() {
    return [
      'cat_meat', 'cat_poultry', 'cat_fish', 'cat_soups', 'cat_salads',
      'cat_pasta', 'cat_vegetarian', 'cat_baking', 'cat_desserts',
      'cat_drinks',
    ];
  }

  // The English fallbacks, used when a translation is missing and to
  // recognise a built-in chapter typed by name.
  recipeCategoryFallbacks() {
    return {
      cat_meat: 'Meat dishes',
      cat_poultry: 'Chicken & poultry',
      cat_fish: 'Fish & seafood',
      cat_soups: 'Soups',
      cat_salads: 'Salads & starters',
      cat_pasta: 'Pasta & rice',
      cat_vegetarian: 'Vegetarian',
      cat_baking: 'Cakes & baking',
      cat_desserts: 'Ice cream & desserts',
      cat_drinks: 'Drinks',
    };
  }

  // What to SHOW for a stored category value.
  categoryLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return this._t('cat_other', 'Other');
    const fallbacks = this.recipeCategoryFallbacks();
    if (Object.prototype.hasOwnProperty.call(fallbacks, raw)) {
      return this._t(raw, fallbacks[raw]);
    }
    return raw;
  }

  renderCookbookShelf(wrap) {
    this.openChapters = this.openChapters || {};

    const chapters = this.buildRecipeChapters();

    const toc = document.createElement('div');
    toc.className = 'cookbook-toc';

    const heading = document.createElement('h1');
    heading.className = 'cookbook-toc-title';
    heading.textContent = this._t('recipe_contents', 'Contents');
    toc.appendChild(heading);

    chapters.forEach((list, name) => {
      const open = !!this.openChapters[name];

      const row = document.createElement('div');
      row.className = 'cookbook-chapter';
      // Named so the row and its list can be found again after the redraw
      // that opening one causes - see revealOpenedChapter.
      row.dataset.chapter = name;
      row.innerHTML = `
        <span class="cookbook-chapter-caret">${open ? '&#9662;' : '&#9656;'}</span>
        <span class="cookbook-chapter-name">${escapeHtml(this.categoryLabel(name))}</span>
        <span class="cookbook-chapter-dots"></span>
        <span class="cookbook-chapter-count">${list.length}</span>`;
      row.onclick = () => {
        this.openChapters[name] = !this.openChapters[name];
        // Only an OPENING is worth scrolling for. Closing one should leave
        // the page exactly where it is.
        this._chapterJustOpened = this.openChapters[name] ? name : null;
        this.render();
      };

      // [ADDED v2026.9.17] Rename and remove, per chapter.
      //
      // Appended as elements after innerHTML has been assigned, never inside
      // the template: assigning innerHTML to a container that already holds
      // appended children destroys them (RULE 33a.5), and a handler cannot be
      // attached from a string.
      //
      // [MODIFIED v2026.9.17] Only while the pencil in the top bar is on.
      //
      // A contents page is for reading. Showing a delete cross beside every
      // chapter all the time puts a destructive control under the thumb of
      // someone who only meant to open a recipe, and it clutters a page
      // whose whole point is the list of names and their counts. The pencil
      // is the panel's existing way of saying "now I am arranging things",
      // and this follows it.
      //
      // "Other" never gets the controls even then: it is not a chapter
      // anyone made, it is where uncategorised recipes show up, and there is
      // nothing there to rename or remove.
      if (this.isEditMode && name !== '') {
        const tool = (cls, glyph, titleKey, fallback, handler) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'cookbook-chapter-tool ' + cls;
          b.textContent = glyph;
          b.title = this._t(titleKey, fallback);
          b.setAttribute('aria-label', b.title);
          b.onclick = (e) => { e.stopPropagation(); handler(); };
          return b;
        };
        row.appendChild(tool('', '✎', 'recipe_cat_rename',
          'Rename this category', () => this.renameRecipeCategory(name)));
        row.appendChild(tool('cookbook-chapter-danger', '✕',
          'recipe_cat_delete', 'Remove this category',
          () => this.deleteRecipeCategory(name, list.length)));
      }

      toc.appendChild(row);

      if (!open) return;

      const inner = document.createElement('div');
      inner.className = 'cookbook-chapter-body';
      inner.dataset.chapterBody = name;

      list.forEach(rec => {
        const line = document.createElement('div');
        line.className = 'cookbook-toc-entry';
        const meta = [rec.prep_time].filter(Boolean)
          .map(x => escapeHtml(String(x))).join(' · ');
        line.innerHTML = `
          ${rec.has_handwritten_notes
            ? `<span class="cookbook-entry-mark" title="${escapeHtml(this._t('recipe_has_notes', 'Has handwritten notes'))}">&#9998;</span>`
            : '<span class="cookbook-entry-mark"></span>'}
          <span class="cookbook-entry-name">${escapeHtml(rec.name || '')}</span>
          <span class="cookbook-chapter-dots"></span>
          <span class="cookbook-entry-meta">${meta}</span>`;
        line.onclick = () => this.openRecipeById(rec.id);

        // Move to another shelf. Appended as an element AFTER innerHTML has
        // been assigned, never inside the template: assigning innerHTML to a
        // container that already holds appended children destroys them
        // (RULE 33a.5), and a handler cannot be attached from a template.
        const move = document.createElement('button');
        move.type = 'button';
        move.className = 'cookbook-entry-move';
        move.textContent = '⇄';
        move.title = this._t('recipe_move', 'Move to another category');
        move.setAttribute('aria-label', move.title);
        move.onclick = (e) => { e.stopPropagation(); this.moveRecipeToCategory(rec); };
        line.appendChild(move);

        inner.appendChild(line);
      });

      // Every chapter can be written into directly, so a new recipe lands on
      // the right shelf without a second step to file it.
      const add = document.createElement('button');
      add.className = 'cookbook-addline';
      add.textContent = '+ ' + this._t('recipe_new', 'New recipe');
      add.onclick = (e) => { e.stopPropagation(); this.startNewRecipe(name); };
      inner.appendChild(add);

      toc.appendChild(inner);
    });

    // A chapter of the user's own.
    const addChapter = document.createElement('button');
    addChapter.className = 'cookbook-addline cookbook-add-chapter';
    addChapter.textContent = '+ ' + this._t('recipe_new_category', 'New category');
    addChapter.onclick = () => this.addRecipeCategory();
    toc.appendChild(addChapter);

    wrap.appendChild(toc);
  }

  // [ADDED v2026.9.16] Move one recipe from one chapter to another.
  //
  // Uses `update`, not `save`: save stamps source_type='manual', which would
  // relabel an assistant-written recipe as the user's own (RULE 33a.8). Every
  // other field is left out of the message, and the update handler falls back
  // to the stored row for each one, so filing a recipe cannot touch its
  // ingredients, steps, prep time or drawing.
  //
  // An empty string clears the category rather than null, because async_save
  // reads null as "leave this column alone" - passing null could move a
  // recipe onto a shelf but never back off one.
  async moveRecipeToCategory(rec) {
    const current = this.categoryLabel(rec.category);
    const answer = window.prompt(
      this._t('recipe_ask_move', 'Move to which category?')
        + '\n\n'
        + this.knownRecipeCategories()
            .map(value => this.categoryLabel(value)).join('\n'),
      current);
    if (answer === null) return;
    await this.applyRecipeCategory(rec, this.categoryInputToValue(answer));
  }

  // Every shelf that exists, in the order they are shown: the built-in
  // chapters, the ones the user created, whatever the recipes themselves
  // name, and Other last.
  //
  // This is the ONLY place that list is assembled. The contents page, the
  // category sheet and the move prompt all read it, so none of them can
  // disagree about what exists (RULE 33a.6).
  //
  // [FIXED v2026.9.17] recipeCategories was missing here. A chapter created
  // on the contents page holds no recipe, so nothing else could produce its
  // name, and it never reached the sheet - the recipe could not be moved into
  // the chapter the user had just made.
  // [ADDED v2026.9.17] The contents page laid out as chapters, built once.
  //
  // The contents page draws this and the side arrows walk it, so both agree
  // on what the book contains and in what order. Assembling it twice is how
  // the stored chapters went missing from the category sheet, so it is
  // deliberately one function (RULE 33a.6).
  // [MODIFIED v2026.9.17] Keyed by the STORED value, not by a label.
  //
  // The empty string is the shelf for a recipe with no category at all -
  // which is what categoryInputToValue writes for "Other" - so the map key
  // and the stored value are the same thing everywhere. categoryLabel turns
  // it into a name only at the moment it is drawn.
  buildRecipeChapters() {
    const chapters = new Map();
    // Every known chapter is seeded empty first, so one holding nothing still
    // gets a row - with 0 beside it - rather than vanishing until a recipe is
    // filed in it.
    this.knownRecipeCategories().forEach(value => chapters.set(value, []));
    (this.recipeList || []).forEach(rec => {
      const value = String(rec.category || '').trim();
      if (!chapters.has(value)) chapters.set(value, []);
      chapters.get(value).push(rec);
    });
    // "Other" only earns a place once something is actually in it.
    if (chapters.has('') && !chapters.get('').length) chapters.delete('');
    return chapters;
  }

  // Every recipe in reading order - chapter by chapter, exactly as the
  // contents page lists them - which is the order the arrows turn through.
  orderedRecipes() {
    const flat = [];
    this.buildRecipeChapters().forEach(list => list.forEach(r => flat.push(r)));
    return flat;
  }

  // Where the open recipe sits in that order, and what is either side of it.
  // Returns nulls at the two ends: the book does not wrap around, because
  // silently jumping from the last recipe to the first reads as a glitch.
  recipeNeighbours() {
    const flat = this.orderedRecipes();
    const i = this.openRecipe
      ? flat.findIndex(r => r.id === this.openRecipe.id)
      : -1;
    if (i === -1) return { prev: null, next: null, index: -1, total: flat.length };
    return {
      prev: flat[i - 1] || null,
      next: flat[i + 1] || null,
      index: i,
      total: flat.length,
    };
  }

  // [ADDED v2026.9.17] Turn one page of the book.
  async stepRecipe(delta) {
    const { prev, next } = this.recipeNeighbours();
    const target = delta > 0 ? next : prev;
    if (!target) return;

    // The assistant was talking about the recipe being left behind, so its
    // conversation goes with it - and its voice stops rather than carrying on
    // reading a recipe that is no longer on screen.
    this.resetSousChef();

    await this.openRecipeById(target.id);
  }

  knownRecipeCategories() {
    return [...new Set([
      ...this.defaultRecipeCategories(),
      ...(this.recipeCategories || [])
        .map(n => String(n || '').trim())
        .filter(Boolean),
      ...(this.recipeList || [])
        .map(r => (r.category || '').trim())
        .filter(Boolean),
      // The uncategorised shelf, as its stored value rather than its name.
      '',
    ])];
  }

  // Naming the Other shelf means "file it nowhere", which is the one shelf
  // that is not a stored value.
  // [MODIFIED v2026.9.17] Turns what was chosen or typed into what is STORED.
  //
  // A built-in chapter is stored as its key, so it stays that chapter in
  // every language. The name is matched against the current translation AND
  // the English fallback, so typing "Soups" works in a Hebrew panel and the
  // Hebrew name works too. Anything else is a chapter the user invented and
  // is stored exactly as they wrote it.
  categoryInputToValue(raw) {
    const target = String(raw == null ? '' : raw).trim();
    if (!target) return '';
    if (target === this._t('cat_other', 'Other')) return '';

    const fallbacks = this.recipeCategoryFallbacks();
    // Already a key - the picker and the seeded recipes pass these.
    if (Object.prototype.hasOwnProperty.call(fallbacks, target)) return target;

    const lowered = target.toLowerCase();
    for (const key of Object.keys(fallbacks)) {
      if (this._t(key, fallbacks[key]).trim().toLowerCase() === lowered
          || fallbacks[key].toLowerCase() === lowered) {
        return key;
      }
    }
    return target;
  }

  // [ADDED v2026.9.16] The single place a recipe's category is written.
  // Called from the contents page and from the open recipe; two entry points
  // calling one function, rather than two copies that drift (RULE 33d).
  async applyRecipeCategory(rec, value) {
    if (!rec || !rec.id) return false;
    try {
      await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'update',
        recipe_id: rec.id,
        category: value,
      });
    } catch (e) {
      console.error(e);
      return false;
    }

    // Bring the copies already on screen into line with what was just
    // written, so the chip reads correctly even before the list comes back.
    rec.category = value;
    if (this.openRecipe && this.openRecipe.id === rec.id) {
      this.openRecipe.category = value;
    }
    // Open the destination so the recipe is visible where it landed.
    this.openChapters = this.openChapters || {};
    this.openChapters[value || this._t('cat_other', 'Other')] = true;
    await this.loadRecipes();   // re-renders
    return true;
  }

  // [ADDED v2026.9.16] The category sheet for the recipe that is open.
  //
  // Built from DOM nodes with textContent rather than an innerHTML template:
  // a category name is text the user typed, and this is the one screen that
  // shows all of them at once (RULE 15).
  renderRecipeCategoryPicker(wrap) {
    const rec = this.openRecipe;
    if (!rec) return;
    // Compared against the stored VALUE, not the label, so the tick lands on
    // the right row whatever language the names are drawn in.
    const current = String(rec.category || '').trim();
    const close = () => { this.recipeCatPicker = false; this.render(); };

    const overlay = document.createElement('div');
    overlay.className = 'cookbook-catpick';
    // The backdrop closes without changing anything.
    overlay.onclick = close;

    const sheet = document.createElement('div');
    sheet.className = 'cookbook-catpick-sheet';
    sheet.onclick = (e) => e.stopPropagation();

    const head = document.createElement('div');
    head.className = 'cookbook-catpick-head';
    head.textContent = this._t('recipe_ask_move', 'Move to which category?');
    sheet.appendChild(head);

    const list = document.createElement('div');
    list.className = 'cookbook-catpick-list';
    this.knownRecipeCategories().forEach(name => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cookbook-catpick-row';
      if (name === current) {
        row.classList.add('is-current');
        row.setAttribute('aria-current', 'true');
      }
      row.textContent = this.categoryLabel(name);
      row.onclick = async () => {
        this.recipeCatPicker = false;
        await this.applyRecipeCategory(rec, this.categoryInputToValue(name));
      };
      list.appendChild(row);
    });
    sheet.appendChild(list);

    // A brand-new shelf. Unlike the contents page this does NOT start a new
    // recipe - there is already one in hand, and it moves onto the new shelf.
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'cookbook-catpick-new';
    add.textContent = '+ ' + this._t('recipe_new_category', 'New category');
    add.onclick = async () => {
      const name = window.prompt(
        this._t('recipe_ask_category', 'New category name:'), '');
      if (name === null || !String(name).trim()) return;
      this.recipeCatPicker = false;
      // Registered as well as assigned, so the chapter survives this recipe
      // later being moved off it again.
      await this.registerRecipeCategory(name);
      await this.applyRecipeCategory(rec, this.categoryInputToValue(name));
    };
    sheet.appendChild(add);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'cookbook-catpick-cancel';
    cancel.textContent = this._t('cancel', 'Cancel');
    cancel.onclick = close;
    sheet.appendChild(cancel);

    overlay.appendChild(sheet);
    wrap.appendChild(overlay);
  }

  // [ADDED v2026.9.16] Delete the open recipe.
  //
  // Asks first and names the recipe, because this destroys user data that
  // cannot be recovered from the panel - including any handwritten notes
  // drawn on it, which are stored on the same row.
  async deleteRecipe() {
    const rec = this.openRecipe;
    if (!rec || !rec.id) return;

    const msg = this._t('recipe_delete_confirm', 'Delete "{n}"? This cannot be undone.')
      .replace('{n}', rec.name || '');
    if (!window.confirm(msg)) return;

    try {
      await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'delete',
        recipe_id: rec.id,
      });
    } catch (e) {
      console.error(e);
      return;
    }

    // The recipe is gone, so every piece of state that pointed at it has to
    // go with it - otherwise the page would redraw a recipe that no longer
    // exists (RULE 33a.1, one level down).
    this.openRecipe = null;
    this.recipeCatPicker = false;
    this.recipeMenu = false;
    this.pendingTimer = null;
    this.recipeDrawing = false;
    this.pendingEdit = null;
    this.stockCheck = null;
    await this.loadRecipes();   // returns to the shelf and re-renders
  }

  // [FIXED v2026.9.16] Creating a chapter no longer drags the user into
  // creating a recipe as well.
  //
  // It used to chain straight into startNewRecipe, because a category was
  // only a column on a recipe row and an empty one had nowhere to be stored.
  // That produced a second prompt identical to the one that had just closed,
  // which read as the field clearing itself, and backing out of it discarded
  // the category too. Chapters now have a table of their own, so one press
  // creates one chapter and the contents page shows it with a count of 0.
  async addRecipeCategory() {
    const name = window.prompt(
      this._t('recipe_ask_category', 'New category name:'), '');
    if (name === null || !String(name).trim()) return;
    const clean = String(name).trim();

    if (!await this.registerRecipeCategory(clean)) return;

    // Open it, so the new chapter is visible and can be written into at once.
    this.openChapters = this.openChapters || {};
    this.openChapters[clean] = true;
    await this.loadRecipes();   // re-renders
  }

  // [ADDED v2026.9.17] Show a recipe in the language the panel is set to.
  //
  // Asked for only when it is actually needed. A recipe written in the
  // language already being shown is left completely alone - no call, no
  // cost, no chance of a machine rewriting text that was already right.
  //
  // Every way this can fail ends with the recipe shown as it was written
  // (RULE 31). An unavailable model, a locked recipe, a reply that does not
  // match - all of them simply leave the original on screen. A recipe in the
  // wrong language is readable; half a recipe is not.
  async ensureRecipeTranslation(rec) {
    if (!rec || !rec.id) return;
    const want = String(this.currentLang || 'en').toLowerCase();
    const have = String(rec.language || 'en').toLowerCase();
    if (want === have) return;          // nothing to do, and nothing to risk
    if (rec.translate_lock) return;     // hand-edited: the text stands as written

    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'translate',
        recipe_id: rec.id,
        to_language: want,
      });
      const t = res && res.translation;
      if (!t) return;                   // same_language, locked or unavailable
      // Still the same recipe on screen? The user may have turned the page
      // while the model was thinking.
      if (!this.openRecipe || this.openRecipe.id !== rec.id) return;

      // The ORIGINAL is kept beside the translation, so the badge can offer
      // to show it and nothing is lost by translating.
      this.openRecipe = {
        ...this.openRecipe,
        _original: {
          name: rec.name,
          ingredients: rec.ingredients,
          steps: rec.steps,
          prep_time: rec.prep_time,
        },
        name: t.name || rec.name,
        ingredients: Array.isArray(t.ingredients) && t.ingredients.length
          ? t.ingredients : rec.ingredients,
        steps: Array.isArray(t.steps) && t.steps.length ? t.steps : rec.steps,
        prep_time: t.prep_time || rec.prep_time,
        _translated: true,
      };
      this.render();
    } catch (e) {
      // The recipe is already on screen in its own language. A failed
      // translation is not worth interrupting the cook for.
      console.error(e);
    }
  }

  // [ADDED v2026.9.17] Rename a chapter from the contents page.
  //
  // The new name is free text, so a built-in chapter that is renamed stops
  // being a built-in one - which is what renaming it means. From then on it
  // reads the same in every language, because it is the user's own word.
  async renameRecipeCategory(value) {
    const current = this.categoryLabel(value);
    const answer = window.prompt(
      this._t('recipe_cat_rename', 'Rename this category'), current);
    if (answer === null) return;
    const clean = String(answer).trim();
    if (!clean || clean === current) return;
    try {
      await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'rename_category',
        category: value,
        name: clean,
      });
      // Carry the open/closed state across to the new name, so a chapter the
      // user had expanded does not silently collapse on being renamed.
      this.openChapters = this.openChapters || {};
      if (this.openChapters[value]) this.openChapters[clean] = true;
      delete this.openChapters[value];
      await this.loadRecipes();
    } catch (e) { console.error(e); }
  }

  // [ADDED v2026.9.17] Remove a chapter. The recipes on it are KEPT.
  //
  // They move to "Other", where they stay visible and can be filed again.
  // Deleting a shelf must never delete what was standing on it (RULE 5), and
  // the confirmation says exactly what will happen to how many recipes so
  // there is no room to misread it.
  async deleteRecipeCategory(value, count) {
    const label = this.categoryLabel(value);
    const message = count
      ? this._t('recipe_cat_delete_n',
          'Remove "{c}"? Its {n} recipes are kept and move to Other.')
          .replace('{c}', label).replace('{n}', count)
      : this._t('recipe_cat_delete_empty', 'Remove the empty category "{c}"?')
          .replace('{c}', label);
    if (!window.confirm(message)) return;
    try {
      await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'delete_category',
        category: value,
      });
      this.openChapters = this.openChapters || {};
      delete this.openChapters[value];
      await this.loadRecipes();
    } catch (e) { console.error(e); }
  }

  // Registers a chapter so it survives a restart and shows while empty.
  // Idempotent at the database end, so naming one that already exists is
  // harmless. Used by the contents page and by the category sheet.
  async registerRecipeCategory(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    try {
      await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'add_category',
        category: clean,
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // [ADDED v2026.9.20] The recipe's tools, behind one button.
  //
  // Built as a element rather than held in the page template, because the
  // handlers cannot be attached from an innerHTML string, and because a menu
  // that is open is a UI mode - recipeMenu - which is cleared everywhere its
  // siblings are (RULE 33a.1).
  //
  // The backdrop is what closes it on an outside press. A document-level
  // listener would be the other way, but clicks inside a shadow root are
  // retargeted on the way out and that is a detail worth not depending on.
  renderRecipeMenu(rec) {
    const wrapEl = document.createElement('div');
    wrapEl.className = 'cookbook-menu-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cookbook-tool cookbook-menu-btn'
      + (this.recipeMenu ? ' active' : '');
    btn.innerHTML = KEBAB_SVG;
    btn.title = this._t('recipe_more', 'More');
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', this.recipeMenu ? 'true' : 'false');
    btn.onclick = () => { this.recipeMenu = !this.recipeMenu; this.render(); };
    wrapEl.appendChild(btn);

    if (!this.recipeMenu) return wrapEl;

    const close = () => { this.recipeMenu = false; this.render(); };

    const backdrop = document.createElement('div');
    backdrop.className = 'cookbook-menu-backdrop';
    backdrop.onclick = close;
    wrapEl.appendChild(backdrop);

    const menu = document.createElement('div');
    menu.className = 'cookbook-menu';
    menu.setAttribute('role', 'menu');

    // label and note are set with textContent, never innerHTML: the note
    // carries a category name, which is text the user typed (RULE 15).
    const item = (cls, label, note, onPick) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cookbook-menu-item ' + cls;
      row.setAttribute('role', 'menuitem');
      const main = document.createElement('span');
      main.textContent = label;
      row.appendChild(main);
      if (note) {
        const sub = document.createElement('span');
        sub.className = 'cookbook-menu-note';
        sub.textContent = note;
        row.appendChild(sub);
      }
      row.onclick = () => { close(); onPick(); };
      return row;
    };

    menu.appendChild(item('', this._t('recipe_edit_title', 'Edit title'), '',
      () => this.renameRecipe()));
    // The shelf it sits on comes with the item, so moving it out of the
    // toolbar does not also hide which shelf that is.
    menu.appendChild(item('',
      this._t('recipe_move', 'Move to another category'),
      this.categoryLabel(rec.category),
      () => { this.recipeCatPicker = true; this.render(); }));
    menu.appendChild(item('cookbook-menu-danger',
      this._t('delete', 'Delete'), '',
      () => this.deleteRecipe()));

    wrapEl.appendChild(menu);
    return wrapEl;
  }

  // --------------------------------------------------------- the open book

  renderCookbookPage(wrap) {
    const rec = this.openRecipe;

    const back = document.createElement('div');
    back.className = 'cookbook-back';
    const backBtn = document.createElement('button');
    backBtn.className = 'cookbook-tool';
    backBtn.innerHTML = '&#8592; ' + escapeHtml(this._t('recipe_shelf', 'Cookbook'));
    backBtn.onclick = () => {
      // Leaving the page drops the drawing tool, so returning later does not
      // land the user in pencil mode with no visible reason.
      this.recipeDrawing = false;
      // ...and the category sheet and the tools menu, for the same reason: a
      // sub-state left set on the way out is the shape of bug RULE 33a.1
      // describes.
      this.recipeCatPicker = false;
      this.recipeMenu = false;
      this.pendingTimer = null;
      // A proposed change belongs to the recipe that was open. Leaving must
      // not carry it to the next one (RULE 33a.1).
      this.pendingEdit = null;
      this.openRecipe = null;
      this.render();
    };
    back.appendChild(backBtn);

    // [ADDED v2026.10.11] Recipe tools: check the cupboards, and edit.
    const checkBtn = document.createElement('button');
    checkBtn.className = 'cookbook-tool';
    checkBtn.textContent = this.stockCheck && this.stockCheck.busy
      // [FIXED v2026.10.16] Was scan_in_progress, whose Hebrew reads
      // "reading the receipt" - right for the scanner, wrong here.
      ? this._t('recipe_checking', 'Checking...')
      : this._t('recipe_check_stock', 'Check my inventory');
    checkBtn.onclick = () => this.checkRecipeStock();
    back.appendChild(checkBtn);

    // Only offered once a check has actually run and found something missing.
    // A button that adds nothing is worse than no button.
    const missing = (this.stockCheck?.report || []).filter(r => !r.in_stock);
    if (missing.length) {
      const addBtn = document.createElement('button');
      addBtn.className = 'cookbook-tool';
      addBtn.textContent = this._t('recipe_add_missing', 'Add {n} missing to shopping')
        .replace('{n}', missing.length);
      addBtn.onclick = () => this.addMissingToShopping();
      back.appendChild(addBtn);
    }

    // [ADDED v2026.9.17] Say so when what is on screen was machine
    // translated.
    //
    // This is not decoration. A translation is model output, which RULE 11
    // treats as untrusted, and a mistranslated quantity - a teaspoon read as
    // a tablespoon - is a threefold error in a dough with nothing on screen
    // to hint at it. The badge shows the original on press, so the words the
    // recipe was actually written in are always one tap away.
    if (rec._translated && rec._original) {
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'cookbook-tool cookbook-translated';
      badge.textContent = this._t('recipe_translated', 'Translated');
      badge.title = this._t('recipe_show_original', 'Show the original');
      badge.onclick = () => {
        this.openRecipe = { ...this.openRecipe, ...rec._original,
                            _translated: false, _original: null };
        this.render();
      };
      back.appendChild(badge);
    }

    // [MODIFIED v2026.9.20] Everything else is behind one button.
    //
    // The strip had grown to five controls, three of which are used rarely -
    // renaming, re-filing, deleting - and one of which is destructive. They
    // now live in a menu, so what is left on the row is what people actually
    // press: get back to the cookbook, and check the cupboards.
    //
    // Delete keeps its distance in a different way now: it is last in the
    // menu and marked, rather than sitting in a row of harmless buttons.
    back.appendChild(this.renderRecipeMenu(rec));

    wrap.appendChild(back);

    const book = document.createElement('div');
    book.className = 'cookbook-book';

    const spread = document.createElement('div');
    spread.className = 'cookbook-spread';
    spread.style.position = 'relative';

    // --- left page: title and ingredients ---
    const left = document.createElement('div');
    left.className = 'cookbook-page';
    const ingredients = Array.isArray(rec.ingredients) ? rec.ingredients : [];
    // Positional: the report is built from this exact list, so entry i
    // describes ingredient i.
    const report = (this.stockCheck && this.stockCheck.report) || [];

    // [MODIFIED v2026.9.19] Three things can sit on the plate, in this order:
    // a photo the user chose, an emblem the assistant drew, or an invitation
    // to take a photo.
    //
    // The local drawing library is gone. It composed an emblem from a fixed
    // set of parts keyed off the recipe's chapter, and the result rarely
    // looked like the dish - a couscous and a rice both came out as a bowl,
    // and a Neapolitan pizza came out as a cake. A generic picture of the
    // wrong food is worse than no picture: it tells the reader something
    // untrue about their own recipe.
    //
    // So nothing is drawn speculatively any more. The assistant can still
    // design one on request - that path is unchanged, and it arrives as a
    // spec of shapes and numbers that this panel draws (see recipe-emblem.js)
    // - and when there is neither a photo nor a drawn emblem, the plate says
    // so and offers the camera. An empty plate that does something is more
    // honest than a full one that misleads.
    //
    // A stored emblem is still shown exactly as saved and is never
    // recomputed: it is the user's choice, not a function of the recipe.

    // [ADDED v2026.9.17] A photo of the dish wins over the drawing.
    //
    // The drawing is kept underneath rather than deleted, so removing the
    // photo brings it back rather than leaving a blank plate.
    // [FIXED v2026.9.17] The URL is built by the backend, not here.
    //
    // This used to assemble "/local/home_organizer_images/" + the stored
    // value. Two things were wrong: the stored value was the absolute disk
    // path rather than a filename, and the prefix is not always /local/ -
    // it depends on whether the user chose www or media storage. The result
    // was a 404 and an empty frame. The row now carries image_url, worked
    // out where the storage settings actually live.
    const photoUrl = rec.image_url || '';
    const plateInner = photoUrl
      // A generated name - ten hex characters - never user text. Escaped
      // anyway, because an attribute is an attribute (RULE 15).
      ? `<img class="cookbook-emblem-photo" src="${escapeHtml(photoUrl)}" alt="">`
      : (rec.emblem_svg || CAMERA_PLATE_SVG);

    left.innerHTML = `
      <div class="cookbook-emblem">
        <button type="button" class="cookbook-emblem-plate${photoUrl ? ' has-photo' : ''}"
                title="${escapeHtml(this._t('recipe_photo_add', 'Add a photo of the dish'))}">
          ${plateInner}
        </button>
      </div>
      <h1 class="cookbook-title">${escapeHtml(rec.name || '')}</h1>
      <div class="cookbook-meta">
        ${[rec.prep_time, (ingredients.length
            ? this._t('recipe_n_ingredients', '{n} ingredients').replace('{n}', ingredients.length)
            : null)]
          .filter(Boolean).map(x => escapeHtml(String(x))).join(' &middot; ')}
      </div>
      <hr class="cookbook-rule">
      <h2 class="cookbook-h2">${escapeHtml(this._t('recipe_ingredients', 'Ingredients'))}</h2>
      <ul class="cookbook-ing-list">
        ${ingredients.map((ing, i) => {
          // An ingredient may be a plain string or {name, qty} - the AI has
          // produced both shapes over time, and old saved recipes still hold
          // the string form.
          const name = typeof ing === 'string' ? ing : (ing.name || ing.item || '');
          const qty  = typeof ing === 'string' ? '' : (ing.qty || ing.quantity || '');
          // The stock answer sits under the ingredient it belongs to, rather
          // than in a separate report the reader has to cross-reference.
          const st = report[i];
          let stockLine = '';
          if (st) {
            // [ADDED v2026.9.19] A staple says so. Water and salt are
            // reported as present without the inventory being consulted, and
            // claiming they are "in stock" would be a claim about a shelf
            // nobody ever filled in - the reader would go looking for a row
            // that does not exist.
            stockLine = st.in_stock
              ? `<div class="cookbook-stock have">&#10003; ${escapeHtml(
                   st.assumed
                     ? this._t('recipe_in_stock_assumed', 'Always in the kitchen')
                     : st.location
                       ? this._t('recipe_in_stock_at', 'In stock: {where}')
                           .replace('{where}', st.location)
                       : this._t('recipe_in_stock', 'In stock'))}</div>`
              : `<div class="cookbook-stock need">&#10007; ${escapeHtml(
                   this._t('recipe_not_in_stock', 'Not in stock'))}</div>`;
          }
          return `
            <li class="cookbook-ing">
              <input type="checkbox" class="cookbook-check" id="ing-${i}">
              <span class="cookbook-ing-text">
                <label for="ing-${i}">${escapeHtml(String(name))}</label>
                ${stockLine}
              </span>
              ${qty ? `<span class="cookbook-ing-qty">${escapeHtml(String(qty))}</span>` : ''}
              <button class="cookbook-mini" title="${escapeHtml(this._t('delete', 'Delete'))}"
                      onclick="this.getRootNode().host.removeRecipeIngredient(${i})">&#10005;</button>
            </li>`;
        }).join('')}
      </ul>
      <button class="cookbook-addline"
              onclick="this.getRootNode().host.addRecipeIngredient()">
        + ${escapeHtml(this._t('recipe_add_ingredient', 'Add ingredient'))}
      </button>`;

    // --- right page: the steps ---
    const right = document.createElement('div');
    right.className = 'cookbook-page';
    const steps = Array.isArray(rec.steps) ? rec.steps : [];
    right.innerHTML = `
      <h2 class="cookbook-h2">${escapeHtml(this._t('recipe_method', 'Method'))}</h2>
      <ol class="cookbook-steps">
        ${steps.map((st, i) => {
          const text = typeof st === 'string' ? st : (st.text || st.step || '');
          return `<li class="cookbook-step cookbook-body">${escapeHtml(String(text))}
            <button class="cookbook-mini" title="${escapeHtml(this._t('delete', 'Delete'))}"
                    onclick="this.getRootNode().host.removeRecipeStep(${i})">&#10005;</button>
          </li>`;
        }).join('')}
      </ol>
      <button class="cookbook-addline"
              onclick="this.getRootNode().host.addRecipeStep()">
        + ${escapeHtml(this._t('recipe_add_step', 'Add step'))}
      </button>`;

    spread.appendChild(left);
    spread.appendChild(right);

    // --- the saved drawing, under the live canvas ---
    if (rec.handwritten_notes) {
      const img = document.createElement('img');
      img.className = 'cookbook-notes-img';
      img.src = rec.handwritten_notes;
      img.alt = this._t('recipe_has_notes', 'Has handwritten notes');
      spread.appendChild(img);
    }

    // --- the drawing layer ---
    const canvas = document.createElement('canvas');
    canvas.className = 'cookbook-canvas' + (this.recipeDrawing ? ' drawing' : '');
    spread.appendChild(canvas);

    // --- pencil controls ---
    const bar = document.createElement('div');
    bar.className = 'cookbook-pencil-bar';

    const pencil = document.createElement('button');
    pencil.className = 'cookbook-tool' + (this.recipeDrawing ? ' active' : '');
    pencil.title = this._t('recipe_draw', 'Handwritten notes');
    pencil.innerHTML = PENCIL_SVG;
    pencil.onclick = () => {
      this.recipeDrawing = !this.recipeDrawing;
      this.render();
    };
    bar.appendChild(pencil);

    if (this.recipeDrawing) {
      const save = document.createElement('button');
      save.className = 'cookbook-tool';
      save.textContent = this._t('save', 'Save');
      save.onclick = () => this.saveRecipeNotes(canvas);
      bar.appendChild(save);

      const clear = document.createElement('button');
      clear.className = 'cookbook-tool';
      clear.textContent = this._t('recipe_clear_notes', 'Erase');
      clear.onclick = () => this.clearRecipeNotes(canvas);
      bar.appendChild(clear);
    }
    spread.appendChild(bar);

    book.appendChild(spread);

    // [ADDED v2026.9.17] Page arrows, halfway down each edge of the book.
    //
    // Appended to the book rather than the spread so the page can flip
    // underneath them. Both are always rendered and simply disabled at the
    // two ends of the book, so the edges of the page do not shift as you
    // read through it.
    //
    // [FIXED v2026.9.17] These two do NOT follow the text direction.
    //
    // They were built logically at first - side chosen with inset-inline-*,
    // glyph chosen from _direction - on the reasoning that a Hebrew book is
    // read right to left. In practice that reads as backwards: an arrow is
    // understood as pointing away from its own position, so one sitting on
    // the left that points right is simply wrong whatever the language.
    //
    // So: back is always on the left pointing left, forward always on the
    // right pointing right, in every language. Two things are needed for
    // that, and the first attempt only did one of them:
    //   - the SIDES use physical left/right in the stylesheet, and
    //   - the MARKS are drawn paths, because every chevron character is
    //     Bidi_Mirrored and the browser turns it round in an RTL context.
    // A deliberate exception to RULE 33b, which exists so TEXT and LAYOUT
    // follow the reading direction - a media control is neither. Do not
    // "fix" this back to inset-inline-* or to a chevron character.
    const { prev, next } = this.recipeNeighbours();
    const arrow = (dir, enabled, markSvg, key, fallback) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cookbook-nav cookbook-nav-' + dir;
      // A shipped SVG constant, not user data - the same way the chef's hat
      // and the pencil are drawn on this screen.
      b.innerHTML = markSvg;
      b.title = this._t(key, fallback);
      b.setAttribute('aria-label', b.title);
      b.disabled = !enabled;
      b.onclick = () => this.stepRecipe(dir === 'next' ? 1 : -1);
      return b;
    };
    book.appendChild(arrow('prev', !!prev, NAV_PREV_SVG,
      'recipe_prev', 'Previous recipe'));
    book.appendChild(arrow('next', !!next, NAV_NEXT_SVG,
      'recipe_next', 'Next recipe'));

    wrap.appendChild(book);

    // --- Sous-Chef ---
    // [MODIFIED v2026.10.18] "Start Sous-Chef Mode" is now "Cook this".
    //
    // The panel is always open, so a button whose job was to reveal it has no
    // purpose. What is still needed is a way to say "walk me through THIS
    // recipe", which is what this does - it just talks to the panel that is
    // already there instead of summoning one.
    const ctaWrap = document.createElement('div');
    ctaWrap.style.cssText = 'max-width:1100px;margin:0 auto;';
    const cta = document.createElement('button');
    cta.className = 'cookbook-cta';
    cta.innerHTML = `${CHEF_HAT_SVG}<span>${escapeHtml(this._t('recipe_cook_this', 'Cook this with me'))}</span>`;
    cta.onclick = () => this.startSousChef(rec);
    ctaWrap.appendChild(cta);
    wrap.appendChild(ctaWrap);

    // The canvas has to be sized from its laid-out box, which only exists
    // after it is in the document - hence the deferral.
    // The Sous-Chef panel sits over the page, so it is mounted last.
    this.renderSousChefPanel(wrap);

    // The category sheet sits over everything, so it is mounted after even
    // the Sous-Chef column.
    if (this.recipeCatPicker) this.renderRecipeCategoryPicker(wrap);

    // [ADDED v2026.9.17] The plate is a button. Wired here rather than in the
    // template, because a handler cannot be attached from an innerHTML string.
    // [MODIFIED v2026.9.19] The plate does one of two things, depending on
    // whether there is a photograph on it. A photograph opens full screen -
    // a 130px plate is not where you look at a picture of your own dinner -
    // and everything else invites one.
    const plateBtn = left.querySelector('.cookbook-emblem-plate');
    if (plateBtn) {
      plateBtn.onclick = () => (rec.image_url
        ? this.openRecipePhoto(rec)
        : this.chooseRecipePhoto(rec));
    }

    // The page-turn, started now that the book is in the document and has a
    // size. Cleared immediately: the animation runs on its own from here, so
    // nothing needs to hold the flag while it plays.

    setTimeout(() => this.initRecipeCanvas(canvas, spread), 0);
  }

  // ------------------------------------------------------------ the canvas

  // Sized to the rendered page and wired for mouse, touch and stylus.
  //
  // Pointer events rather than separate mouse/touch handlers: one code path
  // covers a finger, a mouse and a pressure-sensitive pen, which is the case
  // this feature exists for.
  initRecipeCanvas(canvas, spread) {
    if (!canvas || canvas._ready) return;
    const rect = spread.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // [FIXED v2026.10.10] Three separate drawing bugs.
    //
    // 1. COORDINATES WERE OFF. The backing store was set to rect * dpr but the
    //    CSS box was left to `inset:0`, so the element's layout size and its
    //    pixel size were only in step by accident. Both are now set
    //    explicitly, so one CSS pixel is one drawing unit and the ink lands
    //    under the pointer.
    //
    // 2. NOTHING DREW ON PHONES. A tall page at dpr 3 asks for something like
    //    3240 x 6000 = 19.4 million pixels. iOS Safari refuses to allocate a
    //    canvas over roughly 16.7 million and hands back a blank one with no
    //    error at all - which is exactly "I draw and nothing appears". The
    //    resolution is now capped to fit inside that budget.
    //
    // 3. THE PAGE WOULD NOT SCROLL. `touch-action: none` over the whole sheet
    //    meant a finger swipe was swallowed by the canvas, so the lower half
    //    of a long recipe was unreachable while the pencil was on. Touch now
    //    scrolls and the pen and mouse draw, which is the right split for a
    //    tablet in a kitchen: you hold the stylus to write and use a finger to
    //    move the page.
    const MAX_PIXELS = 14000000;          // under the ~16.7M mobile ceiling
    const cssW = Math.round(rect.width);
    const cssH = Math.round(rect.height);
    const rawDpr = window.devicePixelRatio || 1;
    const fit = Math.sqrt(MAX_PIXELS / Math.max(1, cssW * cssH * rawDpr * rawDpr));
    const dpr = Math.max(1, Math.min(rawDpr, rawDpr * fit));

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // The layout box, stated rather than inherited.
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1c3a63';
    ctx.lineWidth = 2.2;

    let drawing = false;

    // Read from the CANVAS box, not the spread's, and live on every event so
    // scrolling mid-stroke cannot shift the line.
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // A finger is for scrolling. Anything else is for drawing.
    const isDrawingPointer = (e) =>
      e.pointerType === 'pen' || e.pointerType === 'mouse' || !e.pointerType;

    // [FIXED v2026.10.15] Freeze the page for the duration of a stroke.
    //
    // `touch-action: pan-y` let a finger scroll, which was the point - but it
    // also meant the page kept moving WHILE the pen was writing, because the
    // hand resting on the screen scrolled it. Writing a note on a phone was
    // effectively impossible: the line drifted as the page slid.
    //
    // Locking only for the length of a stroke is the narrow fix. Locking
    // whenever the pencil is on would trap the user at the top of a long
    // recipe, which is the bug that was reported before this one.
    const scroller = canvas.closest('.cookbook-wrap');
    const lockPage = () => { if (scroller) scroller.classList.add('drawing-lock'); };
    const unlockPage = () => { if (scroller) scroller.classList.remove('drawing-lock'); };

    canvas.onpointerdown = (e) => {
      if (!this.recipeDrawing || !isDrawingPointer(e)) return;
      drawing = true;
      lockPage();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      // A single tap should leave a dot, not nothing.
      ctx.lineTo(p.x + 0.01, p.y);
      ctx.stroke();
      e.preventDefault();
    };

    canvas.onpointermove = (e) => {
      if (!drawing || !this.recipeDrawing) return;
      const p = pos(e);
      ctx.lineWidth = (e.pointerType === 'pen' && e.pressure > 0)
        ? 0.8 + e.pressure * 3
        : 2.2;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    };

    const end = (e) => {
      if (!drawing) return;
      drawing = false;
      unlockPage();
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    canvas.onpointerup = end;
    canvas.onpointercancel = end;
    canvas.onpointerleave = end;

    canvas._ready = true;

    // Restore what was drawn before, so Save does not discard earlier notes.
    // Drawn at CSS size because the context is already scaled.
    const existing = this.openRecipe && this.openRecipe.handwritten_notes;
    if (existing) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cssW, cssH);
      img.src = existing;
    }
  }

  async saveRecipeNotes(canvas) {
    if (!canvas || !this.openRecipe) return;
    try {
      const data = canvas.toDataURL('image/png');
      await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'save_notes',
        recipe_id: this.openRecipe.id,
        handwritten_notes: data,
      });
      this.openRecipe.handwritten_notes = data;
      this.recipeDrawing = false;
      // The shelf shows a mark for annotated recipes, so it needs refreshing.
      await this.loadRecipes();
    } catch (e) { console.error(e); }
  }

  async clearRecipeNotes(canvas) {
    if (!this.openRecipe) return;
    if (!window.confirm(this._t('recipe_clear_confirm',
        'Erase the handwritten notes on this recipe?'))) return;
    try {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'save_notes',
        recipe_id: this.openRecipe.id,
        handwritten_notes: '',
      });
      this.openRecipe.handwritten_notes = null;
      await this.loadRecipes();
    } catch (e) { console.error(e); }
  }

  // ------------------------------------------------------------------ data

  // [FIXED v2026.9.16] `language` is deliberately NOT sent.
  //
  // async_list_all applies `WHERE language = ?` when it is given one, and a
  // recipe stores the language it was WRITTEN in, not the language the panel
  // happens to be showing. Sending the current UI language therefore hid
  // every recipe generated in another language - switching the panel to
  // Hebrew emptied a cookbook full of recipes the assistant had saved as
  // 'en', and the shelf showed 0 in every chapter.
  //
  // The cookbook is the user's whole library, so it lists everything. The
  // per-language lookup still exists for async_find_by_name, where matching a
  // spoken recipe name against the right language IS the correct behaviour.
  async loadRecipes() {
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'list',
      });
      this.recipeList = (res && res.recipes) || [];
      // [ADDED v2026.9.16] Chapters the user made that hold nothing yet.
      // They exist only here - no recipe names them - so without this the
      // contents page could not show them at all.
      this.recipeCategories = (res && res.categories) || [];
    } catch (e) {
      console.error(e);
      this.recipeList = [];
      this.recipeCategories = [];
    }
    // [ADDED v2026.9.20] Reopen the recipe the user was reading.
    //
    // Consumed here rather than in restoreNavState because a recipe is
    // fetched by id and there is nothing to fetch with until the cookbook is
    // on screen. Taken before the await so a second load cannot open it
    // twice, and a recipe that has since been deleted simply leaves the
    // contents page showing - openRecipeById does nothing when the id is
    // gone, and the render below is what puts something on screen.
    const reopen = this._restoreRecipeId;
    this._restoreRecipeId = null;
    if (reopen) await this.openRecipeById(reopen);
    this.render();
  }

  async openRecipeById(recipeId) {
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes', action: 'get', recipe_id: recipeId,
      });
      if (res && res.recipe) {
        // [ADDED v2026.9.20] A different recipe is a different conversation.
        //
        // The page arrows already did this through resetSousChef; opening one
        // from the contents page did not, so the reply about the PREVIOUS
        // recipe stayed on screen beside the new one and the assistant was
        // still reading aloud from a page nobody was looking at. The server
        // clears its own side of the conversation on the same switch.
        const changed = !this.openRecipe || this.openRecipe.id !== res.recipe.id;
        if (changed) this.resetSousChef();
        this.openRecipe = res.recipe;
        // [ADDED v2026.9.17] Show it in the panel's language, if it is not
        // already. Deliberately not awaited: the recipe appears at once in
        // the language it was written in, and is replaced if and when a
        // translation arrives. Waiting would hold a blank page behind a
        // model call that may be slow or may never answer.
        this.ensureRecipeTranslation(res.recipe);
        this.recipeDrawing = false;
        // Opening a different recipe must not inherit the previous one's
        // open category sheet, its tools menu, or a change proposed for it
        // (RULE 33a.1).
        this.recipeCatPicker = false;
        this.recipeMenu = false;
        this.pendingTimer = null;
        this.pendingEdit = null;
        this.render();
      }
    } catch (e) { console.error(e); }
  }

  // Manual entry. Kept as prompts rather than a modal form: it reuses the
  // pattern already used elsewhere in this panel, and the assistant is the
  // intended route for anything longer than a few lines.
  // Returns true only if a recipe was actually saved, so a caller that
  // chained into this - addRecipeCategory does - can tell whether anything
  // came of it instead of assuming it did.
  async startNewRecipe(category) {
    // [FIXED v2026.9.16] Naming the category makes this unmistakably the
    // SECOND step. Without it this prompt is identical to the category prompt
    // that just closed, so pressing OK looked like the field had simply
    // cleared itself - which is exactly how the bug was reported.
    const ask = category
      ? this._t('recipe_ask_name_in', 'New recipe in "{c}":').replace('{c}', category)
      : this._t('recipe_ask_name', 'Recipe name:');
    const name = window.prompt(ask, '');
    if (name === null) return false;
    if (!String(name).trim()) return false;

    const prep = window.prompt(
      this._t('recipe_ask_prep', 'Prep time (optional), e.g. 40 minutes:'), '') || '';

    const rawIng = window.prompt(
      this._t('recipe_ask_ingredients',
        'Ingredients, one per line.\nOptionally "name | quantity".'), '') || '';
    const rawSteps = window.prompt(
      this._t('recipe_ask_steps', 'Steps, one per line.'), '') || '';

    const ingredients = rawIng.split('\n').map(l => l.trim()).filter(Boolean)
      .map(line => {
        const [n, q] = line.split('|');
        return { name: (n || '').trim(), qty: (q || '').trim() };
      });
    const steps = rawSteps.split('\n').map(l => l.trim()).filter(Boolean);

    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'save',
        name: String(name).trim(),
        prep_time: String(prep).trim() || null,
        ingredients,
        steps,
        category: category || null,
        language: this.currentLang || 'en',
      });
      await this.loadRecipes();
      if (res && res.recipe_id) await this.openRecipeById(res.recipe_id);
      return true;
    } catch (e) { console.error(e); return false; }
  }

  // ------------------------------------------------------------ Sous-Chef

  // Hands the recipe to the cooking agent by name.
  //
  // Phrased as a sentence rather than sent as structured data on purpose: the
  // agent already resolves a recipe by name, checks the ingredients against
  // the inventory and adds what is missing to the shopping list. Going through
  // the same path the voice command uses means there is one behaviour to
  // maintain, not two that can drift.
  // [ADDED v2026.10.11] Check the ingredients against the inventory.
  //
  // Runs on the recipe's own ingredient list, so it reflects any edit made
  // before it was pressed. The result is held in state and drawn into the
  // ingredient list rather than shown as a separate report - the answer to
  // "do I have this" belongs next to the ingredient, not in another panel.
  // [ADDED v2026.9.19] The things a kitchen is assumed to have.
  //
  // Read from the translation file rather than hard-coded, because an
  // ingredient is written in whatever language the recipe is in, and a list
  // of English words would never recognise the Hebrew or Italian word for
  // salt. Pipe-separated, so the value needs no quoting inside a
  // comma-separated file.
  //
  // Reporting salt as missing sends someone shopping for what is already by
  // the hob, and buries the one ingredient that really is absent among three
  // that are not.
  pantryStaples() {
    return this.wordList('pantry_staples', 'water|salt|oil|pepper');
  }

  // [ADDED v2026.9.19] Words that describe an ingredient without naming it.
  //
  // The backend drops these before comparing a recipe line against the
  // shelf, so "fresh large tomato" still finds "tomato". It knows the
  // English ones itself; every other language has to be handed to it,
  // for the same reason the staples are.
  ingredientStopwords() {
    return this.wordList('ingredient_stopwords', '');
  }

  // One pipe-separated translation value, as a list of words.
  wordList(key, fallback) {
    const raw = this._t(key, fallback);
    return String(raw || '')
      .split('|')
      .map(word => word.trim())
      .filter(Boolean);
  }

  async checkRecipeStock() {
    if (!this.openRecipe) return;
    this.stockCheck = { busy: true, report: null };
    this.render();
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'check_stock',
        recipe_id: this.openRecipe.id,
        assume_available: this.pantryStaples(),
        stopwords: this.ingredientStopwords(),
      });
      this.stockCheck = { busy: false, report: (res && res.report) || [] };
    } catch (e) {
      console.error(e);
      this.stockCheck = { busy: false, report: [] };
    }
    this.render();
  }

  // Offer the missing items to the shopping list.
  //
  // Asks first, and names the count. Silently adding eight things to someone's
  // shopping list because they tapped "check what I have" would be a surprise.
  async addMissingToShopping() {
    const missing = (this.stockCheck?.report || []).filter(r => !r.in_stock);
    if (!missing.length) return;
    const names = missing.map(m => m.ingredient).filter(Boolean);
    const msg = this._t('recipe_add_missing_confirm',
      'Add {n} missing ingredient(s) to your shopping list?')
      .replace('{n}', names.length);
    if (!window.confirm(msg)) return;

    for (const name of names) {
      try {
        await this.callHA('add_item', {
          item_name: name,
          item_type: 'item',
          // Quantity 0 is what marks something as needed: the shopping list is
          // built from items at zero, so this is the same route the rest of
          // the panel uses rather than a second mechanism.
          quantity: 0,
          current_path: [],
        });
      } catch (e) { console.error(e); }
    }
    this.stockCheck = null;
    await this.checkRecipeStock();
  }

  // [ADDED v2026.10.11] Editing an existing recipe.
  //
  // Appends rather than replaces: the common need is "one more ingredient" or
  // "I forgot a step", and re-typing the whole recipe to add a line would be
  // worse than not offering it at all.
  async addRecipeIngredient() {
    if (!this.openRecipe) return;
    const raw = window.prompt(this._t('recipe_ask_add_ingredient',
      'New ingredient. Optionally "name | quantity":'), '');
    if (raw === null || !String(raw).trim()) return;
    const [n, q] = String(raw).split('|');
    const next = [...(this.openRecipe.ingredients || []),
                  { name: (n || '').trim(), qty: (q || '').trim() }];
    await this.updateRecipe({ ingredients: next });
  }

  async addRecipeStep() {
    if (!this.openRecipe) return;
    const raw = window.prompt(this._t('recipe_ask_add_step', 'New step:'), '');
    if (raw === null || !String(raw).trim()) return;
    const next = [...(this.openRecipe.steps || []), String(raw).trim()];
    await this.updateRecipe({ steps: next });
  }

  async removeRecipeIngredient(index) {
    if (!this.openRecipe) return;
    const list = [...(this.openRecipe.ingredients || [])];
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    await this.updateRecipe({ ingredients: list });
  }

  async removeRecipeStep(index) {
    if (!this.openRecipe) return;
    const list = [...(this.openRecipe.steps || [])];
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    await this.updateRecipe({ steps: list });
  }

  async renameRecipe() {
    if (!this.openRecipe) return;
    const name = window.prompt(this._t('recipe_ask_name', 'Recipe name:'),
                               this.openRecipe.name || '');
    if (name === null || !String(name).trim()) return;
    const prep = window.prompt(this._t('recipe_ask_prep',
      'Prep time (optional), e.g. 40 minutes:'), this.openRecipe.prep_time || '');
    await this.updateRecipe({
      name: String(name).trim(),
      prep_time: prep === null ? this.openRecipe.prep_time : String(prep).trim(),
    });
  }

  // One write path for every edit, so the reload and the stale-stock reset
  // cannot be forgotten at one call site.
  async updateRecipe(changes) {
    if (!this.openRecipe) return;
    try {
      await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'update',
        recipe_id: this.openRecipe.id,
        ...changes,
      });
      // A stock report made before the edit no longer describes this recipe.
      this.stockCheck = null;
      await this.openRecipeById(this.openRecipe.id);
      await this.loadRecipes();
    } catch (e) { console.error(e); }
  }

  // [FIXED v2026.10.10] The button used to clear every view mode, including
  // its own, so render() matched nothing and dropped the user on the home
  // screen - and the agent's reply had nowhere to appear because the chat
  // screen was removed in 2026.9.14.
  //
  // It now stays on the recipe and shows the conversation in a panel over the
  // page, which is what a sous-chef needs anyway: the recipe still visible
  // while it talks you through it.
  async startSousChef(rec) {
    if (!rec || !rec.name) return;
    this.sousChef = { busy: true, reply: null, error: null };
    this.sousChefHeard = null;
    this.recipeDrawing = false;
    this.render();

    // [FIXED v2026.10.14] Clear any recipe still running before starting.
    //
    // Pressing Sous-Chef on a recipe used to be answered with "you are in the
    // middle of another recipe" - the agent still held the state of whatever
    // was cooked last, possibly days earlier, and refused. Pressing the button
    // on THIS page is an unambiguous instruction to cook THIS dish, so the old
    // session is ended first.
    //
    // Failures here are ignored on purpose: if there was no active recipe the
    // finish command is a harmless no-op, and it must never block the start.
    try {
      await this._hass.callWS({
        type: 'home_organizer/ai_chat',
        message: this._t('recipe_finish_cmd', 'Finish cooking. Exit recipe mode.'),
        image_data: null,
        mime_type: 'image/jpeg',
        language: this.currentLang || 'en',
      });
    } catch (_) { /* nothing was running; carry on */ }

    const phrase = this._t('recipe_sous_chef_cmd', "Let's cook {name}")
      .replace('{name}', rec.name);
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/ai_chat',
        message: phrase,
        image_data: null,
        mime_type: 'image/jpeg',
        language: this.currentLang || 'en',
        recipe_id: rec.id || null,
      });
      if (res && res.error) {
        this.sousChef = { busy: false, reply: null, error: String(res.error) };
      } else {
        this.sousChef = {
          busy: false,
          reply: (res && res.response) || this._t('recipe_no_reply', 'No reply.'),
          error: null,
        };
        this.speak(this.sousChef.reply);
      }
    } catch (e) {
      this.sousChef = { busy: false, reply: null, error: e?.message || String(e) };
    }
    this.render();
  }

  // Send a follow-up without leaving the recipe, so "next step" and "how long
  // does it simmer" work in the same place.
  async sousChefSay(text) {
    if (!text) return;
    this.sousChef = { ...(this.sousChef || {}), busy: true };
    this.render();
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/ai_chat',
        message: text,
        image_data: null,
        mime_type: 'image/jpeg',
        language: this.currentLang || 'en',
        // [ADDED v2026.9.17] Ask the backend to say the reply on this user's
        // phone, but ONLY when this browser cannot say it itself. Sending it
        // unconditionally would read every answer out twice on desktop.
        speak: !!(this.sousChefVoice && !this.hasLocalSpeech()),
        // [ADDED v2026.9.17] Which recipe this is about. Named outright
        // rather than left for the model to infer from the words, so
        // everything typed here is understood as being about THIS recipe.
        recipe_id: (this.openRecipe && this.openRecipe.id) || null,
      });
      this.sousChef = {
        busy: false,
        reply: (res && res.response) || '',
        error: (res && res.error) ? String(res.error) : null,
      };
      // [ADDED v2026.9.17] A change the assistant is PROPOSING. Nothing has
      // been written yet; this is what the confirmation box renders.
      this.pendingEdit = (res && res.pending_edit) || null;
      // ...and a change a typed approval has just applied.
      if (res && res.applied_edit) this.absorbAppliedEdit(res.applied_edit);
      // [ADDED v2026.9.20] A timer the assistant is OFFERING. Nothing
      // has been scheduled: this is the question, not the answer.
      this.pendingTimer = (res && res.pending_timer) || null;
      // [ADDED v2026.9.17] A symbol the user asked to have redrawn. Applied
      // straight away rather than confirmed: they asked for it in words, and
      // unlike an ingredient change it costs nothing to ask for again.
      // [ADDED v2026.9.19] The assistant wrote a recipe. Turn to its page.
      //
      // This is what makes "suggest something for lunch" from the contents
      // page end with a recipe on screen rather than a wall of text in the
      // chat. Also covers filling in an empty page the user had open: the
      // same recipe is reloaded, now with its ingredients and steps in it.
      if (res && res.saved_recipe_id) {
        await this.loadRecipes();
        await this.openRecipeById(res.saved_recipe_id);
      }
      // [MODIFIED v2026.9.17] The assistant DESIGNED one. What arrives is a
      // list of shapes and numbers, never markup: the picture is built here,
      // by our own code, from values that were checked on the way through.
      if (res && res.emblem_spec && this.openRecipe) {
        await this.applyEmblemSpec(this.openRecipe, res.emblem_spec);
      }
      this.speak(this.sousChef.reply);
      // [ADDED v2026.10.18] The assistant can create or change a recipe in
      // the course of answering - "save it as Chocolate Cake", "add an egg to
      // the shakshuka". Reloading here is what makes that appear on the shelf
      // without the user having to know to refresh.
      await this.loadRecipes();
      if (this.openRecipe) {
        const again = await this._hass.callWS({
          type: 'home_organizer/recipes', action: 'get', recipe_id: this.openRecipe.id,
        }).catch(() => null);
        if (again && again.recipe) this.openRecipe = again.recipe;
      }
    } catch (e) {
      this.sousChef = { busy: false, reply: null, error: e?.message || String(e) };
    }
    this.render();
  }

  // Tell the agent the recipe is over, then close.
  //
  // The phrase is sent in the user's own language, because the agent's finish
  // detection reads the message text - sending the English label from a Hebrew
  // panel would not be recognised.
  async finishSousChef() {
    const phrase = this._t('recipe_finish_cmd', 'Finish cooking. Exit recipe mode.');
    this.sousChef = { ...(this.sousChef || {}), busy: true };
    this.render();
    try {
      await this._hass.callWS({
        type: 'home_organizer/ai_chat',
        message: phrase,
        image_data: null,
        mime_type: 'image/jpeg',
        language: this.currentLang || 'en',
      });
    } catch (e) {
      // Closing is still correct even if the message never landed: the
      // alternative is trapping the user in a session they asked to end.
      console.error(e);
    }
    this.sousChef = null;
    this.render();
  }

  // ==================================================================
  // [ADDED v2026.10.15] Voice
  //
  // Both halves use browser APIs, so nothing is added to the integration:
  // no library, no CDN, no extra requirement in manifest.json, and no
  // dependency on a configured TTS engine or media player. The recipe is
  // being read on the device that is in the kitchen, so that device speaking
  // and listening is also the shortest path.
  //
  // Speech synthesis is on-device on every current OS and works without
  // internet. Speech RECOGNITION is not: Chrome sends audio to a Google
  // service, and several webviews do not implement it at all. So the
  // microphone is only offered when the API is actually present, and its
  // absence is not an error - typing still works.
  // ==================================================================

  micSupported() {
    return typeof window !== 'undefined'
      && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  // Map the panel language onto a BCP-47 tag for the speech engines.
  _voiceLang() {
    const MAP = { he: 'he-IL', en: 'en-US', it: 'it-IT', es: 'es-ES',
                  fr: 'fr-FR', ar: 'ar-SA', ru: 'ru-RU' };
    return MAP[this.currentLang] || 'en-US';
  }

  // [ADDED v2026.9.17] Redraw the emblem, because the user asked.
  //
  // motifKey and palette come from the assistant, but only as a CHOICE from
  // sets this file owns: an unknown motif falls back to the neutral one and
  // an out-of-range palette wraps. The assistant never supplies markup, and
  // the drawing is always made here (RULE 7, RULE 11, RULE 15).
  // [ADDED v2026.9.17] Put your own photo of the dish on the plate.
  //
  // A file input covers both routes on a phone: with `capture` the Android
  // and iOS pickers offer the camera alongside the gallery, which is one
  // control instead of two and avoids a second camera implementation beside
  // the one CameraMixin already owns.
  //
  // The input is created, used and dropped rather than living in the
  // template, so nothing accumulates across renders.
  // [ADDED v2026.9.19] The photograph, full screen.
  //
  // Built and torn down on the spot rather than rendered as part of the page:
  // it belongs to a press, not to the recipe's state, so nothing about it
  // survives a re-render and there is no flag to forget to clear (RULE 33a.1
  // exists because of flags like that).
  //
  // Mounted on the panel's own root, not on the book, so the book's
  // overflow-x: hidden and the page's own stacking cannot clip it.
  openRecipePhoto(rec) {
    if (!rec || !rec.image_url) return;
    const root = this.shadowRoot;
    if (!root) return;

    // One at a time. A second press while the viewer is open would otherwise
    // stack a second copy behind the first.
    const existing = root.querySelector('.cookbook-photo-viewer');
    if (existing) existing.remove();

    const viewer = document.createElement('div');
    viewer.className = 'cookbook-photo-viewer';

    const img = document.createElement('img');
    img.className = 'cookbook-photo-full';
    // A generated filename, never user text - escaped anyway, and set as a
    // property rather than through markup (RULE 15).
    img.src = rec.image_url;
    img.alt = rec.name || '';
    viewer.appendChild(img);

    const bar = document.createElement('div');
    bar.className = 'cookbook-photo-bar';

    const close = () => {
      document.removeEventListener('keydown', onKey);
      viewer.remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    const btn = (cls, label, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cookbook-photo-btn ' + cls;
      b.textContent = label;
      b.onclick = (e) => { e.stopPropagation(); onClick(); };
      return b;
    };

    bar.appendChild(btn('', this._t('close', 'Close'), close));
    bar.appendChild(btn('cookbook-photo-danger',
      this._t('delete', 'Delete'),
      () => {
        // The file itself is left on disk; what is removed is this recipe's
        // reference to it. Still asked about: it is a photograph the user
        // took, and there is no way back to it from this screen.
        if (!window.confirm(this._t('recipe_photo_remove',
            'Remove the photo and go back to the drawn symbol?'))) return;
        close();
        this.removeRecipePhoto(rec);
      }));
    viewer.appendChild(bar);

    // Anywhere off the picture closes it - the usual way out of a lightbox,
    // and the only one a phone has without a keyboard.
    viewer.onclick = (e) => { if (e.target === viewer) close(); };

    root.appendChild(viewer);
  }

  // [ADDED v2026.9.19] Take the photograph off, then ask for a drawing.
  //
  // A recipe that loses its photo would otherwise drop to the empty camera
  // plate, which is right when nothing has ever been set but reads as a loss
  // straight after a deletion. So the assistant is asked to design one. If it
  // cannot - no AI configured, no answer, a design that draws nothing - the
  // camera plate is what remains, which is the honest fallback rather than an
  // error (RULE 31).
  async removeRecipePhoto(rec) {
    await this.setRecipePhoto(rec, null);
    const current = (this.openRecipe && this.openRecipe.id === rec.id)
      ? this.openRecipe : rec;
    if (current.emblem_svg) return;      // it already has one to fall back to
    if (await this.requestEmblemFromAI(current)) {
      // storeEmblem updates the record in place but deliberately does not
      // redraw - it is called from paths where a render is already coming.
      // This is not one of them.
      this.render();
    }
  }

  // Ask the assistant to design an emblem for a recipe.
  //
  // Sent the same way finishSousChef sends its phrase: a real chat turn, in
  // the user's own language, bound to this recipe - but without drawing it in
  // the chat panel, because the user asked for a picture, not a conversation.
  // What comes back is a drawing SPEC, never markup, and applyEmblemSpec
  // builds it here from values that were checked on the way through.
  async requestEmblemFromAI(rec) {
    if (!rec || !rec.id) return false;
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/ai_chat',
        message: this._t('recipe_emblem_cmd',
          'Design a symbol for this recipe, based on what the dish is.'),
        image_data: null,
        mime_type: 'image/jpeg',
        language: this.currentLang || 'en',
        recipe_id: rec.id,
      });
      if (res && res.emblem_spec) {
        return await this.applyEmblemSpec(rec, res.emblem_spec);
      }
    } catch (e) {
      // Not worth an alert: the plate shows the camera and the user can try
      // again by asking in the chat.
      console.error(e);
    }
    return false;
  }

  chooseRecipePhoto(rec) {
    if (!rec || !rec.id) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    // A hint, not a restriction: the picker still offers the gallery.
    input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      // [MODIFIED v2026.9.19] Shrink it here rather than refusing it.
      //
      // A phone camera writes 8-12 megapixel JPEGs and plenty of them are
      // over 6 MB, which this used to reject outright - so the photo the
      // user had just taken of their own dinner was the one photo they could
      // not use. Nothing on this page needs that resolution: the picture is
      // shown in a plate a couple of hundred pixels across.
      try {
        const small = await this.shrinkRecipePhoto(file);
        await this.setRecipePhoto(rec, small);
      } catch (e) {
        console.error(e);
        window.alert(this._t('recipe_photo_failed',
          'Could not read that photo. Try another one.'));
      }
    };
    input.click();
  }

  // [ADDED v2026.9.19] Re-encode a chosen photo to something a page can show.
  //
  // Decoded through an <img> rather than createImageBitmap on purpose:
  // browsers apply EXIF orientation to an <img> by default, and a photo taken
  // in portrait on a phone carries orientation 6. Skipping that would store
  // every portrait picture on its side.
  //
  // The canvas is created at the TARGET size, never the source size, so a
  // 48-megapixel photo never needs a 48-megapixel canvas. iOS Safari returns
  // a BLANK canvas with no error above roughly 16.7M pixels, and a silently
  // blank photo is worse than a refused one (RULE 33b).
  //
  // JPEG, over a white ground: a photo of food has nothing to gain from an
  // alpha channel, and transparency in a PNG would otherwise composite to
  // black.
  async shrinkRecipePhoto(file) {
    const MAX_EDGE = 1280;
    const QUALITY = 0.85;

    const img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const el = new Image();
      el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
      el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      el.src = url;
    });

    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    if (!sw || !sh) throw new Error('image has no dimensions');

    // Only ever downwards: a small photo is left at its own size rather than
    // being blown up into a blurry one.
    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
    const tw = Math.max(1, Math.round(sw * scale));
    const th = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);

    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
    // A blank or truncated result is a failure, not a photo. Better to say so
    // than to store an empty picture over the drawn emblem (RULE 2).
    if (!dataUrl || dataUrl.length < 256) throw new Error('encode failed');
    return dataUrl;
  }

  async setRecipePhoto(rec, dataUrl) {
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'set_photo',
        recipe_id: rec.id,
        photo: dataUrl,
      });
      if (res && res.error) {
        window.alert(String(res.error));
        return;
      }
      // Re-read rather than guessing the stored path, so the page shows what
      // the database actually holds.
      await this.openRecipeById(rec.id);
      await this.loadRecipes();
    } catch (e) {
      console.error(e);
    }
  }

  // [ADDED v2026.9.17] Draw and keep an emblem the assistant designed.
  //
  // emblemFromSpec returns null when the design draws nothing, and then the
  // recipe keeps the emblem it had - a refusal never blanks a good one.
  async applyEmblemSpec(rec, spec) {
    if (!rec || !rec.id || !spec) return false;
    const svg = emblemFromSpec(rec, spec, Number(spec.palette));
    if (!svg) return false;
    return this.storeEmblem(rec, svg);
  }

  // The one place a deliberate emblem replacement is written, so the two
  // routes into it cannot drift apart (RULE 33d).
  async storeEmblem(rec, svg) {
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'set_emblem',
        recipe_id: rec.id,
        emblem_svg: svg,
      });
      if (res && res.error) return false;
      rec.emblem_svg = svg;
      if (this.openRecipe && this.openRecipe.id === rec.id) {
        this.openRecipe.emblem_svg = svg;
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // [ADDED v2026.9.17] Put an approved change onto the page.
  //
  // Used for both scopes. The difference between them is what the BACKEND
  // did - "session" left the stored recipe alone, "save" wrote it - and not
  // what the screen shows: either way the page must now show the change the
  // user just approved.
  absorbAppliedEdit(applied) {
    if (!applied || !this.openRecipe) return;
    if (Array.isArray(applied.ingredients) && applied.ingredients.length) {
      this.openRecipe.ingredients = applied.ingredients;
    }
    if (Array.isArray(applied.steps) && applied.steps.length) {
      this.openRecipe.steps = applied.steps;
    }
    // [ADDED v2026.9.20] A rewrite in another language changes the title and
    // the language as well. Without these, approving "just this time" left a
    // Hebrew recipe under its English title, and the page still believed it
    // was reading English - which is what decides whether it offers to
    // translate the recipe at all.
    if (applied.name) this.openRecipe.name = applied.name;
    if (applied.language) {
      this.openRecipe.language = applied.language;
      // It is now written in that language, so it is not a translation OF
      // anything and the "Translated" badge must go.
      this.openRecipe._translated = false;
      this.openRecipe._original = null;
    }
    this.pendingEdit = null;
    // A stock check made against the old quantities is now wrong, and a stale
    // "you have everything" is worse than no answer at all.
    this.stockCheck = null;
  }

  // [ADDED v2026.9.20] Answer an offered timer.
  //
  // Sends a boolean and nothing else. The minutes and the label live in the
  // session the offer was written into, so this cannot change what it is
  // agreeing to - the same rule the change-approval buttons follow.
  async answerRecipeTimer(accept) {
    const offer = this.pendingTimer;
    this.pendingTimer = null;
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: 'answer_timer',
        accept: !!accept,
      });
      if (accept && res && res.timer === 'set') {
        const mins = Number(offer && offer.minutes) || 0;
        this.sousChef = {
          ...(this.sousChef || {}),
          reply: this._t('recipe_timer_set', 'Timer set for {n} minutes.')
            .replace('{n}', mins),
        };
      }
    } catch (e) {
      console.error(e);
    }
    this.render();
  }

  // [ADDED v2026.9.17] Answer a proposed change: the button path.
  //
  // scope is 'session' or 'save'; anything else is refused by the backend.
  // Deliberately sends no ingredients and no steps - the content was frozen
  // when the change was proposed, so what gets applied is exactly what is on
  // screen above these buttons.
  async answerRecipeEdit(scope) {
    const rec = this.openRecipe;
    if (!rec || !rec.id) return;
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/recipes',
        action: scope ? 'confirm_edit' : 'cancel_edit',
        recipe_id: rec.id,
        scope: scope || null,
      });
      if (res && res.error) {
        this.sousChef = { ...(this.sousChef || {}), error: String(res.error) };
        this.pendingEdit = null;
        this.render();
        return;
      }
      if (scope) {
        this.absorbAppliedEdit(res);
        // Re-read from the database after a permanent save, so the page shows
        // what was actually stored rather than what we hoped was stored.
        if (res && res.applied === 'save') {
          await this.openRecipeById(rec.id);
          await this.loadRecipes();
          return;
        }
      } else {
        this.pendingEdit = null;
      }
    } catch (e) {
      console.error(e);
    }
    this.render();
  }

  // [ADDED v2026.9.17] Is there a speech engine in THIS browser?
  //
  // Android's WebView - which is what the Home Assistant companion app runs -
  // does not implement window.speechSynthesis, so on the platform people
  // actually cook with, the answer is no. speak() used to discover that and
  // return silently while the speaker button still showed as on, which is why
  // it looked as though the toggle did nothing.
  //
  // Speech RECOGNITION is a separate interface and is available there, which
  // is why the microphone works and the voice does not.
  hasLocalSpeech() {
    try {
      return !!(typeof window !== 'undefined'
        && window.speechSynthesis
        && (window.SpeechSynthesisUtterance
            || typeof SpeechSynthesisUtterance !== 'undefined'));
    } catch (_) {
      return false;
    }
  }

  speak(text) {
    if (!this.sousChefVoice || !text) return;
    const synth = (typeof window !== 'undefined') ? window.speechSynthesis : null;
    const Utter = (typeof SpeechSynthesisUtterance !== 'undefined')
      ? SpeechSynthesisUtterance
      : (typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null);
    if (!synth || !Utter) return;
    try {
      // Anything still queued describes a step that has been superseded, so
      // it is dropped rather than played after the new one.
      synth.cancel();
      const u = new Utter(String(text));
      u.lang = this._voiceLang();
      u.rate = 0.95;   // a shade slower: this is being followed, not skimmed
      // getVoices() is populated asynchronously and is empty on the first
      // call in several browsers. No match simply means the engine picks its
      // own default for the language, which is fine.
      const voices = (typeof synth.getVoices === 'function' && synth.getVoices()) || [];
      const voice = voices.find(v => v.lang === u.lang)
        || voices.find(v => v.lang && v.lang.startsWith(this.currentLang || 'en'));
      if (voice) u.voice = voice;
      synth.speak(u);
      // Some webviews leave the queue paused after an earlier cancel(), which
      // looks exactly like the speech being ignored.
      try { if (synth.paused && typeof synth.resume === 'function') synth.resume(); } catch (_) {}
    } catch (e) { console.error(e); }
  }

  stopSpeaking() {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch (_) {}
  }

  toggleSousChefVoice() {
    this.sousChefVoice = !this.sousChefVoice;
    if (!this.sousChefVoice) {
      this.stopSpeaking();
    } else {
      // [FIXED v2026.10.18] Unlock the engine inside the click itself.
      //
      // Android's webview only allows speech that begins during a real user
      // gesture. Every reply is spoken from a websocket callback, which is
      // not a gesture, so speak() was called, reported no error, and produced
      // silence - the button appeared to work and nothing was heard.
      //
      // Speaking one empty utterance here, synchronously inside the click,
      // marks the engine as user-activated for the rest of the page, and
      // later replies play normally.
      //
      // [MODIFIED v2026.9.17] Only when there IS an engine. Where there is
      // not - Android's WebView - priming is a no-op and the reply is spoken
      // by the companion app instead, so the button now means "speak", not
      // "speak in this browser", and it no longer claims to be on while
      // producing silence.
      if (this.hasLocalSpeech()) {
        this._primeSpeech();
        if (this.sousChef && this.sousChef.reply) this.speak(this.sousChef.reply);
      }
    }
    this.render();
  }

  // Must run synchronously in a user gesture - do not await anything first.
  _primeSpeech() {
    try {
      const synth = window.speechSynthesis;
      const Utter = window.SpeechSynthesisUtterance
        || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
      if (!synth || !Utter) return;
      const u = new Utter(' ');
      u.volume = 0;
      u.lang = this._voiceLang();
      synth.speak(u);
      this._speechPrimed = true;
      // getVoices() is empty until the engine has loaded them; this event is
      // the only reliable signal that the list is ready.
      if (typeof synth.addEventListener === 'function' && !this._voicesBound) {
        this._voicesBound = true;
        synth.addEventListener('voiceschanged', () => { this._voicesReady = true; });
      }
    } catch (_) { /* no engine here; typing still works */ }
  }

  // Listen once and send what was heard.
  //
  // Single-shot rather than continuous: an always-on microphone in a kitchen
  // picks up the extractor fan and the radio, and would fire questions the
  // user never asked.
  toggleListening() {
    if (this.sousChefListening) {
      try { this._recog && this._recog.stop(); } catch (_) {}
      this.sousChefListening = false;
      this.render();
      return;
    }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return;

    try {
      // Speaking and listening at once would have the assistant transcribe
      // its own voice.
      this.stopSpeaking();
      // Also a user gesture, so it is a second chance to unlock the engine -
      // useful when the user starts by talking rather than by pressing the
      // speaker.
      if (this.sousChefVoice && !this._speechPrimed) this._primeSpeech();
      const recog = new Rec();
      this._recog = recog;
      recog.lang = this._voiceLang();
      recog.interimResults = false;
      recog.maxAlternatives = 1;
      recog.continuous = false;

      recog.onresult = (e) => {
        const said = e?.results?.[0]?.[0]?.transcript || '';
        this.sousChefListening = false;
        if (said.trim()) {
          this.sousChefDraft = '';
          // [ADDED v2026.10.16] Kept so the panel can show what it heard.
          // Speech recognition mishears, and a reply that does not match the
          // question is baffling unless the question is on screen too.
          this.sousChefHeard = said.trim();
          this.sousChefSay(said.trim());
        } else {
          this.render();
        }
      };
      recog.onerror = (e) => {
        this.sousChefListening = false;
        // "no-speech" is the user changing their mind, not a failure worth
        // shouting about.
        if (e && e.error && e.error !== 'no-speech' && e.error !== 'aborted') {
          this.sousChef = { ...(this.sousChef || {}), busy: false,
                            error: this._t('voice_error', 'Could not hear that.') };
        }
        this.render();
      };
      recog.onend = () => {
        if (this.sousChefListening) { this.sousChefListening = false; this.render(); }
      };

      this.sousChefListening = true;
      this.render();
      recog.start();
    } catch (e) {
      console.error(e);
      this.sousChefListening = false;
      this.render();
    }
  }

  // [ADDED v2026.9.17] Clear the conversation without redrawing.
  //
  // Extracted from closeSousChef so turning a page can reuse it: both need
  // the same four things undone, and two copies of that would drift the first
  // time a fifth was added (RULE 33d). Deliberately does NOT render - the
  // caller decides when, and stepRecipe must not redraw mid-animation.
  resetSousChef() {
    // Stopping the voice matters most: otherwise it carries on reading a
    // recipe that is no longer on screen.
    this.stopSpeaking();
    this.sousChefListening = false;
    try { this._recog && this._recog.stop(); } catch (_) {}
    this.sousChef = null;
    this.sousChefHeard = null;
    // The question the proposal was answering is gone with the conversation.
    this.pendingEdit = null;
  }

  closeSousChef() {
    this.resetSousChef();
    this.render();
  }

  renderSousChefPanel(wrap) {
    // [MODIFIED v2026.10.18] Always rendered, on every cookbook screen.
    //
    // It used to appear only after pressing Start Sous-Chef. That made the
    // assistant something you had to go and fetch, when it is the fastest way
    // to use this screen - "give me a chocolate cake recipe and save it as
    // Chocolate Cake" should be typeable the moment the cookbook opens,
    // without first choosing a recipe to talk about.
    //
    // sousChef holds the conversation; its absence now means "no conversation
    // yet", not "no panel".
    const sc = this.sousChef || { busy: false, reply: null, error: null };

    const panel = document.createElement('div');
    panel.className = 'cookbook-souschef';

    const head = document.createElement('div');
    head.className = 'cookbook-sc-head';
    // The question being answered, or the mode name when there is none yet.
    head.innerHTML = this.sousChefHeard
      ? `<span class="cookbook-sc-heard" title="${escapeHtml(this.sousChefHeard)}">&#8220;${escapeHtml(this.sousChefHeard)}&#8221;</span>`
      // [FIXED v2026.10.18] The panel is permanent, so its title can no longer
      // be an instruction to start it.
      : `<span>${escapeHtml(this._t('recipe_assistant', 'Kitchen assistant'))}</span>`;
    // [FIXED v2026.10.17] Always rendered, never feature-detected.
    //
    // Two rounds of widening the detection still left the button missing on
    // the Android companion app while the microphone worked there, so the
    // detection itself is the problem: webviews report this API
    // inconsistently and there is no check that is reliable across all of
    // them.
    //
    // The trade-off is decided the other way now. A button that does nothing
    // on some exotic browser is a small annoyance; a working feature that is
    // invisible on the most common phone is a real loss. speak() already
    // resolves the engine at call time and exits quietly when it is absent,
    // so the worst case is genuinely silent.
    const speaker = document.createElement('button');
    speaker.className = 'cookbook-tool' + (this.sousChefVoice ? ' active' : '');
    speaker.title = this._t('voice_read_aloud', 'Read replies aloud');
    speaker.innerHTML = this.sousChefVoice ? '&#128266;' : '&#128263;';
    speaker.onclick = () => this.toggleSousChefVoice();
    head.appendChild(speaker);

    // Collapse rather than close: with no Start button there would be no way
    // to bring a closed panel back.
    const collapse = document.createElement('button');
    collapse.className = 'cookbook-tool';
    collapse.title = this._t('recipe_collapse', 'Collapse');
    collapse.innerHTML = this.sousChefCollapsed ? '&#9650;' : '&#9660;';
    collapse.onclick = () => {
      this.sousChefCollapsed = !this.sousChefCollapsed;
      if (this.sousChefCollapsed) this.stopSpeaking();
      this.render();
    };
    head.appendChild(collapse);
    panel.appendChild(head);

    const body = document.createElement('div');
    body.className = 'cookbook-sc-body';
    if (this.sousChefListening) {
      body.textContent = this._t('voice_listening', 'Listening...');
    } else if (!sc.reply && !sc.error && !sc.busy) {
      // Nothing asked yet: say what this box is for rather than sit blank.
      body.textContent = this._t('recipe_assistant_hint',
        'Ask for a recipe, or ask about the one on screen. Say "save it as ..." to keep it.');
      body.style.opacity = '.7';
    } else if (sc.busy) {
      body.textContent = this._t('recipe_thinking', 'Thinking...');
    } else if (sc.error) {
      body.textContent = sc.error;
      body.style.color = 'var(--error-color, #c62828)';
    } else {
      // The agent's reply is plain text from a model, so it is escaped and
      // only the line breaks are turned into markup.
      body.innerHTML = escapeHtml(sc.reply || '').replace(/\n/g, '<br>');
    }
    if (!this.sousChefCollapsed) panel.appendChild(body);

    // [ADDED v2026.9.17] A change waiting to be approved.
    //
    // Rendered as a distinct block with three explicit buttons rather than
    // relying on the user typing "yes": pressing one is unambiguous and does
    // not depend on the words being understood. Typing still works - the
    // agent recognises an approval too - but this is the certain path.
    //
    // Nothing here has been written yet. The summary is what WILL happen.
    if (this.pendingEdit && !this.sousChefCollapsed) {
      const box = document.createElement('div');
      box.className = 'cookbook-editbox';

      const what = document.createElement('div');
      what.className = 'cookbook-editbox-what';
      // textContent: this is model output describing the change (RULE 15).
      //
      // [MODIFIED v2026.9.19] A blank page is asked about differently. The
      // assistant sends no summary when it has just built a recipe for a page
      // that had nothing in it, and "Update this recipe?" over an empty page
      // asks about a recipe that is not there yet.
      const pageIsBlank = !((this.openRecipe && this.openRecipe.steps) || []).length;
      what.textContent = this.pendingEdit.summary
        || (pageIsBlank
              ? this._t('recipe_fill_confirm', 'Put this recipe on the page?')
              : this._t('recipe_edit_generic', 'Update this recipe?'));
      box.appendChild(what);

      const row = document.createElement('div');
      row.className = 'cookbook-editbox-row';
      const btn = (cls, key, fallback, scope) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cookbook-tool ' + cls;
        b.textContent = this._t(key, fallback);
        b.onclick = () => this.answerRecipeEdit(scope);
        return b;
      };
      // Order matters: the reversible choice comes first, and the one that
      // rewrites the stored recipe is never the default.
      row.appendChild(btn('', 'recipe_edit_once', 'Just this time',
                          'session'));
      row.appendChild(btn('cookbook-editbox-save', 'recipe_edit_save',
                          'Save to recipe', 'save'));
      row.appendChild(btn('', 'cancel', 'Cancel', null));
      box.appendChild(row);

      panel.appendChild(box);
    }

    // [ADDED v2026.9.20] The offered timer, with its two answers.
    //
    // Deliberately the same shape as the change-approval box: a sentence
    // saying what will happen, then the answers. Nothing is set until one is
    // pressed, and what gets set is read back from the session - the buttons
    // send a yes or a no and nothing else.
    if (this.pendingTimer && !this.sousChefCollapsed) {
      const box = document.createElement('div');
      box.className = 'cookbook-editbox';

      const what = document.createElement('div');
      what.className = 'cookbook-editbox-what';
      // textContent: the label came from the model (RULE 15).
      // [MODIFIED v2026.9.20] The question names the time AND the action:
      // "a timer for 5 minutes" is not enough to decide on, "for stirring the
      // tomatoes" is. The label came from the model, so it goes in through
      // textContent like everything else (RULE 15).
      const mins = Number(this.pendingTimer.minutes) || 0;
      const what_ = this.pendingTimer.label
        || this._t('recipe_timer_step', 'this step');
      what.textContent = this._t('recipe_timer_ask',
        'Set a timer for {n} minutes for {what}?')
        .replace('{n}', mins)
        .replace('{what}', what_);
      box.appendChild(what);

      const row = document.createElement('div');
      row.className = 'cookbook-editbox-row';
      const tbtn = (cls, key, fallback, accept) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cookbook-tool ' + cls;
        b.textContent = this._t(key, fallback);
        b.onclick = () => this.answerRecipeTimer(accept);
        return b;
      };
      // The reversible answer first, and the one that will interrupt someone
      // later is never the default.
      row.appendChild(tbtn('', 'recipe_timer_no', 'Not now', false));
      row.appendChild(tbtn('cookbook-editbox-save', 'recipe_timer_yes',
                           'Set a timer', true));
      box.appendChild(row);
      panel.appendChild(box);
    }

    if (!sc.busy && !this.sousChefCollapsed) {
      // [ADDED v2026.10.14] Ask about the recipe without leaving it.
      //
      // This is the answer to "I cannot see the recipe and the chat at the
      // same time": rather than sending the user to Home Assistant's chat,
      // the conversation happens here, over the open book. The panel is
      // sticky, so the page stays scrollable behind it and the ingredients
      // and steps remain visible while you type.
      const ask = document.createElement('div');
      ask.className = 'cookbook-sc-ask';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cookbook-sc-input';
      input.placeholder = this._t('recipe_ask_placeholder',
        'Ask about this recipe, e.g. can I use less sugar?');
      // Preserved across renders: every reply re-renders the panel, and
      // losing a half-typed question each time would make it unusable.
      input.value = this.sousChefDraft || '';
      input.oninput = (e) => { this.sousChefDraft = e.target.value; };

      const send = () => {
        const text = (input.value || '').trim();
        if (!text) return;
        this.sousChefDraft = '';
        // Shown in the header the same way a spoken question is, so the panel
        // always says what it is answering.
        this.sousChefHeard = text;
        this.sousChefSay(text);
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') send(); };

      const sendBtn = document.createElement('button');
      sendBtn.className = 'cookbook-tool';
      sendBtn.textContent = this._t('send', 'Send');
      sendBtn.onclick = send;

      ask.appendChild(input);

      // The microphone: the whole point of this feature is hands covered in
      // flour, so it sits next to the field rather than in a menu.
      if (this.micSupported()) {
        const mic = document.createElement('button');
        mic.className = 'cookbook-tool'
          + (this.sousChefListening ? ' listening' : '');
        mic.title = this.sousChefListening
          ? this._t('voice_listening', 'Listening...')
          : this._t('voice_ask_by_voice', 'Ask by voice');
        mic.innerHTML = '&#127908;';
        mic.onclick = () => this.toggleListening();
        ask.appendChild(mic);
      }

      ask.appendChild(sendBtn);
      panel.appendChild(ask);

      const actions = document.createElement('div');
      actions.className = 'cookbook-sc-actions';
      [
        ['recipe_next_step', 'Next step'],
        ['recipe_repeat', 'Repeat that'],
      ].forEach(([key, fallback]) => {
        const b = document.createElement('button');
        b.className = 'cookbook-tool';
        b.textContent = this._t(key, fallback);
        b.onclick = () => this.sousChefSay(this._t(key, fallback));
        actions.appendChild(b);
      });

      // [FIXED v2026.10.12] Finishing has to close the panel, not just say so.
      //
      // This used to be a third sousChefSay button: it sent the words and left
      // the panel open, so the session looked like it was still running and
      // the next question was still answered as part of the recipe.
      //
      // It now tells the agent to finish AND closes the panel, so the two
      // agree. The panel is closed regardless of what the agent replies -
      // pressing "finish" is the user's decision, not a request the assistant
      // gets to decline.
      const finishBtn = document.createElement('button');
      finishBtn.className = 'cookbook-tool';
      finishBtn.textContent = this._t('recipe_finish', 'Finish cooking');
      finishBtn.onclick = () => this.finishSousChef();
      actions.appendChild(finishBtn);
      panel.appendChild(actions);
    }

    wrap.appendChild(panel);
  }
};