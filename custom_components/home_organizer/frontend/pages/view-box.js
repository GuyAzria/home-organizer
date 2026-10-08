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
// [MODIFIED v2026.10.1 | 2026-10-01] Purpose: boxCountBadge puts the box icon
//   and a count on a group heading, so a shelf says how many boxes are in it
//   without being opened - and the badge is a BUTTON: a tap opens the box, a
//   long press offers to move it to another group on the same page.
//
//   Both answer the same question first: WHICH box. The badge counts them, so
//   with more than one there is nothing single to act on and the group is
//   expanded instead, putting the box cards on screen where each carries its
//   own menu. Guessing which of three boxes was meant is worse than showing
//   them.
//
//   buildAnchoredMenu was factored out of openBoxMenu for the long-press
//   picker: the fixed positioning that keeps a menu out of the scroll box,
//   the rect it is placed from and the catcher that dismisses it on touch are
//   the awkward parts, and two copies would drift (RULE 33d).
//
//   The 500ms hold is cancelled by pointercancel and pointerleave, so a thumb
//   dragging the shelf past does not open a picker, and contextmenu is
//   suppressed because some webviews raise the native one over it. It returns HTML because the heading is built with
//   innerHTML, and the number is escaped even though it came from a length -
//   the rule is that nothing reaches innerHTML unescaped, not that a given
//   value happens to look safe (RULE 15).
//
//   The heading is the page title,
//   and the three-dot menu opens panels instead of windows.
//
//   The title is twice the size and centred, and it WRAPS rather than
//   clipping - a centred heading on two lines reads fine, a box name cut off
//   at an ellipsis does not. box.css steps it down on a phone, because 30px
//   of bold Hebrew in a 360px column is two or three words (RULE 36).
//
//   The back arrow left the page. The app already has one beside Home and
//   that button leaves the box page now, so there are not two arrows on one
//   screen meaning the same thing. It is shown on the box page whatever the
//   depth, because it is the only way off that screen.
//
//   Renaming happens where the title IS - the same shape as
//   enableSublocRename, so there is one in-place rename in this panel and
//   not two (RULE 33d). window.prompt is a system dialog over the whole
//   panel in the Android companion app, for a one-word edit.
//
//   The box type and the receipt list are panels on the page. Their ticks
//   live in this.boxPicked and not in the checkboxes: the panel is inside
//   #content, every refetch rebuilds it, and on a websocket-driven panel a
//   refetch arrives whenever another device changes anything.
//
//   Two overlays remain, for reasons that are not laziness. Creating a box
//   needs a title and a place BEFORE a page exists to type them on, and a
//   box number is permanent - async_create_box takes MAX+1 and never reuses
//   it, so a box made only to be typed into and then abandoned burns that
//   number for good. The bulk picker is launched from the inventory toolbar
//   with items ticked on a shelf, not from here. The delete confirm stays a
//   dialog because that one exists to interrupt.
// [ADDED v2026.9.30 | 2026-09-30] Purpose: The page heading states the name,
//   the number and how much is in the box, and a box is moved with the same
//   three destination selects an item uses - room, location, sub-location -
//   from a strip the three-dot menu opens.
//
//   The count is TWO numbers. An unreviewed line can be sorted into a box
//   before it is approved, so it is in the list and has to be counted - but
//   separately, because folding it into the plain count would claim things
//   are in the box that nobody has agreed are real (RULE 23). The plain
//   number therefore matches the one on the card on the shelf. The contents
//   are worked out before the header is built, which is the only reason that
//   order matters.
//
//   renderHierarchyControl draws them and its save button is suppressed,
//   because a box does not SAVE a path: saveHierarchy calls
//   update_item_details, which rewrites the ten level columns of one row and
//   would leave everything inside the box on the old shelf. move_box rewrites
//   the box and its contents in one transaction, which is the whole reason a
//   box is worth having.
//
//   The strip is in #content and not in an overlay. The selects cascade by
//   calling updateHierarchyState, which re-renders, and an overlay is a
//   SIBLING of #content - it would survive that render without being rebuilt,
//   so the second and third selects would never refresh.
//
//   openMoveBoxSheet went with it: it offered the groups on the current shelf,
//   a strict subset of what these three selects express, and both called the
//   same service (RULE 33d).
//
//   Nothing closes the page after a move. move_box broadcasts, the panel
//   refetches, and if the box has left this shelf the view dispatch finds no
//   such row and drops back to it - the guard written for a box deleted in
//   another session answers this case too.

import { ICONS } from '../organizer-icon.js?v=10.11.112';
import { escapeHtml } from '../organizer-utils.js?v=10.11.112';

// The canonical box types, in English.
//
// A chip stores the ENGLISH word and the screen translates it back, so
// switching the interface language does not leave a box labelled in the
// language it was filed in. A type the user types by hand is stored exactly as
// typed and shown exactly as stored - it is their own word for their own box,
// and there is nothing to translate it against (RULE 20).
const BOX_TYPES = ['Cardboard', 'Plastic', 'Drawer', 'Bag', 'Basket', 'Toolbox'];

export const BoxMixin = (Base) => class extends Base {

  // ── shared chrome ─────────────────────────────────────────────────────────

  // One overlay, used by every box sheet. Tapping the backdrop closes it, and
  // every control inside is at least 40px because this is used with a thumb
  // (RULE 36).
  buildBoxOverlay(titleText) {
    const ov = document.createElement('div');
    ov.className = 'box-overlay';
    const card = document.createElement('div');
    card.className = 'box-sheet';
    const head = document.createElement('div');
    head.className = 'box-sheet-head';
    head.innerHTML = `<span class="box-sheet-icon">${ICONS.box}</span>`
      + `<span>${escapeHtml(titleText)}</span>`;
    card.appendChild(head);
    ov.appendChild(card);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    this.mountOverlay(ov);
    return { ov, card };
  }

  // Cancel and a confirm, in that order, for every sheet that has both.
  buildSheetBar(ov, okText, onOk) {
    const bar = document.createElement('div');
    bar.className = 'box-sheet-bar';
    const cancel = document.createElement('button');
    cancel.className = 'action-btn';
    cancel.type = 'button';
    cancel.textContent = this._t('cancel', 'Cancel');
    cancel.onclick = () => ov.remove();
    const ok = document.createElement('button');
    ok.className = 'action-btn';
    ok.type = 'button';
    ok.textContent = okText;
    ok.onclick = () => onOk(ok);
    bar.appendChild(cancel);
    bar.appendChild(ok);
    return { bar, ok };
  }

  // The list of places on the page, as a set of thumb-sized buttons.
  //
  // The names come from subGroupsOnPage, which moveSubLoc also uses and which
  // the group headings are drawn from, so a location cannot appear in one and
  // not the other (RULE 33d). "General" is shown exactly as the heading shows
  // it - it is not translated anywhere else in this panel, and translating it
  // only here would make the two disagree one line apart.
  buildLocationPicker(initial) {
    const groups = (typeof this.subGroupsOnPage === 'function')
      ? this.subGroupsOnPage().groups.map(g => g.name) : [];
    if (!groups.includes('General')) groups.unshift('General');

    const state = { chosen: groups.includes(initial) ? initial : groups[0] };
    const wrap = document.createElement('div');
    wrap.className = 'box-pick';
    const buttons = [];
    const paint = () => buttons.forEach(b =>
      b.classList.toggle('is-on', b.dataset.name === state.chosen));
    groups.forEach(name => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'box-pick-btn';
      b.dataset.name = name;
      b.textContent = name;
      b.onclick = () => { state.chosen = name; paint(); };
      buttons.push(b);
      wrap.appendChild(b);
    });
    paint();
    return { wrap, state };
  }

  // A chosen group name turned into a path.
  //
  // Two things are easy to get wrong here and both fail silently. A group
  // shown as "Top shelf" may be STORED as ORDER_MARKER_010_Top shelf, so the
  // display name has to go through resolveRealName or a second group is
  // created that looks identical to the first. And "General" is not a value -
  // it is the ABSENCE of a level, which is the convention handleDropAction
  // established by not pushing it onto a path.
  pathForGroup(groupName) {
    const target = [...this.currentPath];
    const real = (typeof this.resolveRealName === 'function')
      ? this.resolveRealName(groupName) : groupName;
    if (real && real !== 'General') target.push(real);
    return target;
  }

  // A stored box type, as it should read on screen.
  boxTypeLabel(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (BOX_TYPES.includes(v)) {
      return this._t('box_type_' + v.toLowerCase(), v);
    }
    return v;
  }

  // ── the card on the shelf ─────────────────────────────────────────────────

  // A box is a card at the level of the group headings - it is not an item row.
  //
  // It was built with className 'item-row' once, so it was drawn in the exact
  // shape of an item and read as one: a row sitting in General with the name of
  // the box on it. A box is a container standing in the location, so it gets
  // its own card with its number, its title, its type, how much is in it, and a
  // chevron that says it opens.
  createBoxRow(box, contents) {
    const div = document.createElement('div');
    div.className = 'box-card';

    const count = contents.length;
    const label = box.box_label || '';
    const title = box.box_title || box.name || '';
    const type = this.boxTypeLabel(box.box_type);

    div.innerHTML = `
      <span class="box-card-icon">${ICONS.box}</span>
      <div class="box-card-text">
        <div class="box-card-title">${escapeHtml(title)}</div>
        <div class="box-card-meta">
          <span class="box-card-label">${escapeHtml(label)}</span>
          <span>${escapeHtml(String(count))} ${escapeHtml(this._t('box_items', 'items'))}</span>
          ${type ? `<span class="box-card-type">&middot; ${escapeHtml(type)}</span>` : ''}
        </div>
      </div>
      <div class="box-card-actions">
        <span class="box-card-chevron">${ICONS.chevron_right}</span>
      </div>`;

    div.onclick = () => this.openBox(box.id);

    // Move it and empty it, in edit mode only, so a thumb scrolling a shelf
    // cannot reach either. Always visible once edit mode is on - there is no
    // hover on a phone or a tablet to reveal them (RULE 36).
    if (this.isEditMode) {
      const bar = div.querySelector('.box-card-actions');
      const move = document.createElement('button');
      move.className = 'action-btn';
      move.type = 'button';
      // Its own key: this arms a paste, it does not move anything yet, and a
      // button labelled the same as the one that DOES move is a lie in every
      // language (RULE 33a.7).
      move.title = this._t('box_cut', 'Cut - paste it elsewhere');
      move.innerHTML = ICONS.cut;
      move.onclick = (e) => { e.stopPropagation(); this.cutBox(box); };
      bar.insertBefore(move, bar.firstChild);

      const del = document.createElement('button');
      del.className = 'action-btn btn-danger';
      del.type = 'button';
      del.title = this._t('box_delete', 'Delete box');
      del.innerHTML = ICONS.delete;
      del.onclick = (e) => { e.stopPropagation(); this.confirmDeleteBox(box); };
      bar.insertBefore(del, bar.firstChild);
    }

    // A drop target on a pointer device. On touch the box page and the multi
    // selection do the same job, because there is no drag worth having there.
    if (typeof this.setupBoxDropTarget === 'function') {
      this.setupBoxDropTarget(div, box.id);
    }
    return div;
  }

  // [ADDED v2026.10.1] How many boxes are in one group, as a badge.
  //
  // Returned as an HTML string because the group heading is built with
  // innerHTML. The number is escaped even though it came from a length - the
  // rule is that nothing reaches innerHTML unescaped, not that this
  // particular value happens to look safe (RULE 15).
  //
  // Empty when there is no box, so a heading without one is unchanged.
  boxCountBadge(rows) {
    const n = (rows || []).filter(i => i.type === 'box').length;
    if (!n) return '';
    const label = this._t('box_count_here', 'boxes here');
    return `<span class="box-count-badge" title="${escapeHtml(label)}">`
      + `<span class="box-count-icon">${ICONS.box}</span>`
      + `<span>${escapeHtml(String(n))}</span></span>`;
  }

  // Draw the box cards for one list, and answer with the rows left over.
  //
  // FOUR lists can contain a box - a shelf, a shelf in grid view, a room,
  // and a search result - and each needs the same two things: a card per
  // box, and the loose rows. Only the shelf had it; the other three drew a
  // box with createItemRow or as a grid tile, which gave it no way to open
  // and is why the box page could not be reached from them. One function,
  // four callers, so a list cannot be handed boxes and not know it
  // (RULE 33a.6).
  //
  // keepBoxedRows is the one real difference between them. On a shelf the
  // contents of a box belong on the box's own page and drawing them loose as
  // well is what would look like a duplicate. A SEARCH result has to show
  // the thing that was searched for wherever it is, and the box line under
  // its name - box3, and the box's title - is exactly what answers where it
  // went.
  appendBoxCards(rows, container, keepBoxedRows) {
    const all = rows || [];
    all.filter(i => i.type === 'box').forEach(box => {
      const contents = all.filter(
        i => i.type !== 'box' && String(i.box_id) === String(box.id));
      container.appendChild(this.createBoxRow(box, contents));
    });
    return all.filter(
      i => i.type !== 'box' && (keepBoxedRows || !i.box_id));
  }

  // ── opening and leaving ───────────────────────────────────────────────────

  // openBoxId is the box page's whole state. There is no isBoxMode flag,
  // deliberately: two things to clear is how isReceiptsMode, isRecipesMode and
  // isBarcodeMode each shipped stuck on, and one value is one thing to forget
  // instead of two (RULE 33a.1). Every entry point clears it, and so does
  // applyNavMode.
  openBox(boxId) {
    this.openBoxId = boxId;
    this.expandedIdx = null;
    // The move strip is page-local and starts closed, so a box never opens
    // with a destination editor already showing.
    this.boxMoveOpen = false;
    // The receipt panel and its ticks are page-local too, and a box never
    // opens with somebody else's selection still in it.
    this.boxReceiptOpen = false;
    this.boxTypeOpen = false;
    this.boxPicked = new Set();
    this.render();
  }

  closeBox() {
    this.openBoxId = null;
    this.expandedIdx = null;
    this.boxMoveOpen = false;
    this.boxReceiptOpen = false;
    this.boxTypeOpen = false;
    this.boxPicked = new Set();
    this.render();
  }

  // ── the page ──────────────────────────────────────────────────────────────

  // Keyed on box_id, never on a path. A box cannot be a folder level -
  // navigation is two levels deep and a box would put its contents where
  // nothing looks - so this screen is opened from a box card and left by its
  // back button, and it draws from the SAME localData the shelf behind it was
  // loaded with.
  //
  // Nothing extra is fetched. An item in a box carries the box's own levels so
  // it is already in attrs.items, and a pending line carries box_id too.
  //
  // openBoxId is deliberately NOT saved in the nav state. A reload comes back
  // to the shelf, which is a screen that always exists; restoring a page keyed
  // on a row that may since have been deleted is how someone gets stranded.
  renderBoxView(content, attrs, box) {
    content.innerHTML = '';
    const label = box.box_label || '';
    const title = box.box_title || box.name || '';
    const type = this.boxTypeLabel(box.box_type);

    // Worked out before the header, because the header states the count.
    //
    // An item in a box carries the box's own levels, so it is already in
    // attrs.items and needs no query. A pending line carries box_id too,
    // which is what lets a receipt that has not been approved yet be sorted
    // into a box - it is counted SEPARATELY, because nothing about it is
    // confirmed and folding it into the plain count would claim things are in
    // the box that nobody has agreed are real (RULE 23).
    const items = (attrs.items || []).filter(
      i => i.type !== 'box' && String(i.box_id) === String(box.id));
    const waiting = (attrs.pending_list || []).filter(
      p => String(p.box_id) === String(box.id));

    // ---- the header ------------------------------------------------------
    const head = document.createElement('div');
    head.className = 'box-page-head';

    // [MODIFIED v2026.10.1] No back arrow here.
    //
    // The app already has one in the sub-bar beside Home, and that button
    // leaves the box page now - see the btn-up handler in organizer-ui.js.
    // Two arrows on one screen meaning the same thing is one too many, and
    // the heading gets the width back.
    const heading = document.createElement('div');
    heading.className = 'box-page-heading';
    // The name, the number and how much is in it. The number is ltr in every
    // language: box3 is an identifier, like a barcode, and a translation must
    // never alter one (RULE 20).
    heading.innerHTML = `
      <div class="box-page-title">${escapeHtml(title)}</div>
      <div class="box-page-sub">
        <span class="box-page-label">${escapeHtml(label)}</span>
        <span class="box-page-count">${escapeHtml(String(items.length))} ${escapeHtml(this._t('box_items', 'items'))}</span>
        ${waiting.length ? `<span class="box-page-pending">+${escapeHtml(String(waiting.length))} ${escapeHtml(this._t('receipt_unreviewed', 'unreviewed'))}</span>` : ''}
        ${type ? `<span class="box-page-type">${escapeHtml(type)}</span>` : ''}
      </div>`;
    head.appendChild(heading);

    // Everything the box itself can be told to do is behind the three dots.
    // The header would otherwise carry five icons on a phone, and a row of
    // five 40px targets does not leave room for the title.
    const dots = document.createElement('button');
    dots.className = 'action-btn box-icon-btn';
    dots.type = 'button';
    dots.title = this._t('box_options', 'Box options');
    dots.innerHTML = ICONS.dots;
    dots.onclick = (e) => { e.stopPropagation(); this.openBoxMenu(head, box); };
    head.appendChild(dots);

    content.appendChild(head);

    // ---- where it should go -----------------------------------------------
    // The SAME three cascading selects an item uses, with its save button
    // suppressed. A box does not save a path: saveHierarchy writes the ten
    // level columns of one row, which would leave everything inside the box
    // behind on the old shelf. The Move button calls move_box instead.
    //
    // In #content rather than an overlay, because the selects cascade by
    // calling updateHierarchyState - which re-renders. An overlay is a
    // sibling of #content and would survive that render without being
    // rebuilt, so the second and third selects would never refresh.
    if (this.boxMoveOpen) {
      if (!this.locationEditState[box.id]
          && typeof this.seedLocationEditState === 'function') {
        this.seedLocationEditState(box);
      }
      const strip = document.createElement('div');
      strip.className = 'box-move-strip';
      const lbl = document.createElement('div');
      lbl.className = 'box-sheet-label';
      lbl.textContent = this._t('box_where', 'Where does it go');
      strip.appendChild(lbl);

      const row = document.createElement('div');
      row.className = 'box-move-row';
      row.innerHTML = (typeof this.renderHierarchyControl === 'function')
        ? this.renderHierarchyControl(box, true) : '';
      const go = document.createElement('button');
      go.className = 'action-btn btn-text box-move-go';
      go.type = 'button';
      go.textContent = this._t('box_move', 'Move box');
      go.onclick = () => this.moveBoxToPicked(box);
      row.appendChild(go);
      strip.appendChild(row);
      content.appendChild(strip);
    }

    // ---- what is inside ---------------------------------------------------
    // items and waiting were worked out above, for the header's count.
    const list = document.createElement('div');
    list.className = 'box-list';
    content.appendChild(list);

    if (!items.length && !waiting.length) {
      const empty = document.createElement('div');
      empty.className = 'box-empty';
      empty.textContent = this._t('box_empty',
        'This box is empty. Add something to it.');
      list.appendChild(empty);
    }

    items.forEach(it => {
      const row = this.createItemRow(it, false);
      // The "in box3" line is on every row here and says nothing on the box's
      // own page.
      const line = row.querySelector('.item-box-line');
      if (line) line.remove();
      const ctrl = row.querySelector('.item-qty-ctrl');
      if (ctrl) ctrl.appendChild(this.buildTakeOutButton(it.id));
      list.appendChild(row);
    });

    waiting.forEach(p => {
      list.appendChild(this.buildPendingRow(p));
    });

    // ---- the two ways to put something in ---------------------------------
    const bar = document.createElement('div');
    bar.className = 'box-actions';

    const add = document.createElement('button');
    add.className = 'action-btn';
    add.type = 'button';
    add.innerHTML = `<span class="box-btn-icon">${ICONS.plus}</span>`
      + `<span>${escapeHtml(this._t('box_add_item', 'Add item'))}</span>`;
    // The SAME manual add a shelf uses, so there is one of them and not two
    // (RULE 33d). box_id makes the back end take the levels from the box.
    add.onclick = () => this.addQuickItem(null, box.id);
    bar.appendChild(add);

    const fromReceipt = document.createElement('button');
    fromReceipt.className = 'action-btn';
    fromReceipt.type = 'button';
    fromReceipt.textContent = this._t('box_from_receipt', 'From a receipt');
    // A panel on this page, not an overlay. One fewer window to dismiss.
    fromReceipt.onclick = () => {
      this.boxReceiptOpen = !this.boxReceiptOpen;
      this.render();
    };
    bar.appendChild(fromReceipt);

    content.appendChild(bar);

    // ---- the receipt panel, when it is open ------------------------------
    // On the page, not in an overlay. One fewer window to dismiss, and the
    // list of what is in the box stays visible above it while you choose.
    if (this.boxTypeOpen) {
      content.appendChild(this.buildTypePanel(box));
    }
    if (this.boxReceiptOpen) {
      content.appendChild(this.buildReceiptPanel(box));
    }
  }

  buildTakeOutButton(itemId) {
    const out = document.createElement('button');
    out.className = 'action-btn';
    out.type = 'button';
    out.title = this._t('box_take_out_item', 'Take out of this box');
    out.style.minWidth = '40px';
    out.style.minHeight = '40px';
    out.innerHTML = ICONS.close;
    out.onclick = async (e) => {
      e.stopPropagation();
      await this.putItemInBox(itemId, null);
    };
    return out;
  }

  // A line that is in this box but has not been reviewed yet. It is not drawn
  // by createItemRow: that row offers quantity controls and an edit form, and
  // none of it applies to something a human has not confirmed exists (RULE 23).
  buildPendingRow(p) {
    const row = document.createElement('div');
    row.className = 'item-row box-pending';
    row.innerHTML = `
      <div class="item-main">
        <div class="item-left">
          <span class="item-icon">${ICONS.item}</span>
          <div class="item-text">
            <div class="item-name">${escapeHtml(p.name || '')}</div>
            <div class="box-pending-tag">${escapeHtml(this._t('receipt_unreviewed', 'unreviewed'))}</div>
          </div>
        </div>
        <div class="item-qty-ctrl"></div>
      </div>`;
    row.querySelector('.item-qty-ctrl').appendChild(
      this.buildTakeOutButton(p.id));
    return row;
  }

  // ── the three-dot menu ────────────────────────────────────────────────────

  // [ADDED v2026.10.1] One anchored menu, used by the three dots on the box
  // page and by a long press on the badge in a group heading.
  //
  // The awkward parts are shared: a menu that is position:fixed so the scroll
  // box cannot clip it, placed from the anchor's own rect, with a full-screen
  // catcher behind it because a menu has to close on touch where there is no
  // blur to rely on. Two copies of that would drift (RULE 33d).
  //
  // Returns null when a menu was already open - the caller has nothing more
  // to do, because re-tapping closes rather than stacking a second one.
  buildAnchoredMenu(anchor) {
    const existing = this.shadowRoot.querySelector('.box-menu-catch');
    if (existing) {
      existing.remove();
      const old = this.shadowRoot.querySelector('.box-menu');
      if (old) old.remove();
      return null;
    }

    const catcher = document.createElement('div');
    catcher.className = 'box-menu-catch';
    const menu = document.createElement('div');
    menu.className = 'box-menu';
    // Geometry, not style: the menu is fixed, so it is placed from the
    // anchor's own rect. Both left and right are set and box.css hugs the
    // inline end with an auto margin, so this does not have to know which
    // physical side that is in the current language (RULE 33b).
    const r = anchor.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 4) + 'px';
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.right = Math.round(
      (window.innerWidth || r.right) - r.right) + 'px';
    const shut = () => { catcher.remove(); menu.remove(); };
    catcher.onclick = shut;

    const add = (iconSvg, text, fn, danger) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'box-menu-item' + (danger ? ' is-danger' : '');
      b.innerHTML = `<span class="box-menu-icon">${iconSvg}</span>`
        + `<span>${escapeHtml(text)}</span>`;
      b.onclick = (e) => { e.stopPropagation(); shut(); fn(); };
      menu.appendChild(b);
      return b;
    };
    const sep = () => {
      const d = document.createElement('div');
      d.className = 'box-menu-sep';
      menu.appendChild(d);
    };
    const show = () => {
      this.mountOverlay(catcher);
      this.mountOverlay(menu);
    };
    return { menu, add, sep, shut, show };
  }

  openBoxMenu(anchor, box) {
    const m = this.buildAnchoredMenu(anchor);
    if (!m) return;
    const { add, sep, show } = m;

    add(ICONS.move, this._t('box_move_here', 'Change location'),
        () => { this.boxMoveOpen = !this.boxMoveOpen; this.render(); });
    add(ICONS.box, this._t('box_type', 'Box type'),
        () => { this.boxTypeOpen = !this.boxTypeOpen; this.render(); });
    add(ICONS.edit, this._t('box_rename', 'Rename box'),
        () => this.renameBoxInline(box));
    sep();
    // Cut keeps the clipboard route, which is the only way to move a box to a
    // DIFFERENT room - the picker above offers the groups on this shelf.
    add(ICONS.cut, this._t('box_cut', 'Cut - paste it elsewhere'),
        () => { this.cutBox(box); this.closeBox(); });
    add(ICONS.delete, this._t('box_delete', 'Delete box'),
        () => this.confirmDeleteBox(box), true);

    show();
  }

  // [ADDED v2026.10.1] The badge on a group heading is a button.
  //
  // A tap opens the box. A long press offers to move it to another group on
  // the same page.
  //
  // Both have to answer the same question first: WHICH box. The badge counts
  // them, so with more than one there is nothing to open - the group is
  // expanded instead, so the box cards are on screen and each carries its own
  // menu. Guessing which of three boxes was meant is worse than showing them.
  //
  // Wired after the heading's innerHTML is set, because the heading is built
  // as a string and a handler cannot be attached to one.
  wireBoxCountBadge(header, rows, subName) {
    const badge = header.querySelector('.box-count-badge');
    if (!badge) return;
    const boxes = (rows || []).filter(i => i.type === 'box');
    if (!boxes.length) return;

    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.title = boxes.length === 1
      ? (boxes[0].box_label || '') + ' ' + (boxes[0].box_title || '')
      : this._t('box_count_here', 'boxes here');

    let timer = null;
    let longPressed = false;
    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

    const openOrShow = () => {
      if (boxes.length === 1) this.openBox(boxes[0].id);
      else this.expandGroupForBoxes(subName);
    };

    badge.onpointerdown = (e) => {
      // The heading toggles its group on click and the badge sits inside it.
      e.stopPropagation();
      longPressed = false;
      clear();
      // 500ms: long enough not to fire while a thumb drags the shelf past,
      // short enough that holding it does not feel broken.
      timer = setTimeout(() => {
        timer = null;
        longPressed = true;
        if (boxes.length === 1) {
          this.openBoxGroupMovePicker(badge, boxes[0], subName);
        } else {
          this.expandGroupForBoxes(subName);
        }
      }, 500);
    };
    badge.onpointerup = (e) => {
      e.stopPropagation();
      clear();
      if (!longPressed) openOrShow();
    };
    // A pointer that leaves the badge, or is taken over by a scroll, is not a
    // long press - otherwise the picker opens while the list is moving.
    badge.onpointercancel = () => clear();
    badge.onpointerleave = () => clear();
    // Some webviews raise the native context menu on a long touch, on top of
    // the picker that has just opened.
    badge.oncontextmenu = (e) => { e.preventDefault(); return false; };
    badge.onclick = (e) => e.stopPropagation();
    badge.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        openOrShow();
      }
    };
  }

  // More than one box in the group, so there is nothing single to act on:
  // open the group and let the box cards speak for themselves.
  expandGroupForBoxes(subName) {
    if (!this.expandedSublocs) return;
    this.expandedSublocs.add(subName);
    this.render();
  }

  // Move one box to another group on the SAME page, from a long press.
  //
  // The groups come from subGroupsOnPage, the same list the headings are
  // drawn from, and the path from pathForGroup - which is what turns a
  // display name back into the stored ORDER_MARKER_ value and knows that
  // General means the absence of a level (RULE 33d).
  //
  // The group it is already in is left out. Moving a box to where it already
  // is would be a menu entry that does nothing.
  openBoxGroupMovePicker(anchor, box, subName) {
    const m = this.buildAnchoredMenu(anchor);
    if (!m) return;
    const { add, show, menu } = m;

    const here = this.stripMarkerForDisplay
      ? this.stripMarkerForDisplay(subName) : subName;
    const groups = ((typeof this.subGroupsOnPage === 'function')
      ? this.subGroupsOnPage().groups.map(g => g.name) : [])
      .filter(n => n !== here);
    if (!groups.includes('General') && here !== 'General') {
      groups.unshift('General');
    }

    const head = document.createElement('div');
    head.className = 'box-group-head';
    head.textContent = [box.box_label, box.box_title || box.name]
      .filter(Boolean).join('  ');
    menu.insertBefore(head, menu.firstChild);

    if (!groups.length) {
      const none = document.createElement('div');
      none.className = 'box-sheet-note';
      none.style.padding = '8px 10px';
      none.textContent = this._t('box_no_other_group',
        'There is nowhere else on this page to move it to.');
      menu.appendChild(none);
      show();
      return;
    }

    groups.forEach(name => {
      add(ICONS.move, name, async () => {
        try {
          await this.callHA('move_box', {
            box_id: String(box.id),
            target_path: this.pathForGroup(name),
          });
        } catch (err) { console.error("Box move failed:", err); }
      });
    });
    show();
  }

  // ── what the menu opens ──────────────────────────────────────────────────

  // What kind of box it is.
  //
  // Free text, with the common answers offered as chips. A chip stores the
  // ENGLISH word so the label survives a change of interface language; a
  // typed answer is stored exactly as typed, because it is the user's own
  // word and there is nothing to translate it against.
  //
  // [MODIFIED v2026.10.1] A panel on the page instead of an overlay.
  buildTypePanel(box) {
    const panel = document.createElement('div');
    panel.className = 'box-receipt-panel';

    const head = document.createElement('div');
    head.className = 'box-sheet-label';
    head.textContent = this._t('box_type', 'Box type');
    panel.appendChild(head);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'box-input';
    input.placeholder = this._t('box_type_ph', 'What kind of box');
    input.value = box.box_type || '';
    panel.appendChild(input);

    const chips = document.createElement('div');
    chips.className = 'box-chips';
    BOX_TYPES.forEach(canonical => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'box-pick-btn';
      b.textContent = this._t('box_type_' + canonical.toLowerCase(),
                              canonical);
      b.onclick = () => {
        input.value = canonical;
        chips.querySelectorAll('.box-pick-btn').forEach(
          x => x.classList.toggle('is-on', x === b));
      };
      if ((box.box_type || '') === canonical) b.classList.add('is-on');
      chips.appendChild(b);
    });
    panel.appendChild(chips);

    const bar = document.createElement('div');
    bar.className = 'box-sheet-bar';
    const ok = document.createElement('button');
    ok.className = 'action-btn btn-text';
    ok.type = 'button';
    ok.style.minHeight = '40px';
    ok.textContent = this._t('save', 'Save');
    ok.onclick = async () => {
      ok.disabled = true;
      this.boxTypeOpen = false;
      try {
        // An empty string, not null: update_item_details writes only the
        // fields it was given and an omitted one means "leave alone", so
        // clearing the type has to be an explicit empty value (RULE 33a.8).
        await this.callHA('update_item_details', {
          item_id: String(box.id),
          box_type: (input.value || '').trim(),
        });
      } catch (err) {
        console.error("Box type save failed:", err);
        this.render();
      }
    };
    bar.appendChild(ok);
    panel.appendChild(bar);
    return panel;
  }

  // Move the box, and everything in it, to the chosen destination.
  //
  // move_box and not update_item_details: async_move_box rewrites the
  // box's levels AND the levels of every row whose box_id points at it,
  // in one transaction. That is the whole reason a box is worth having -
  // the things inside it cannot be left behind.
  //
  // Nothing is closed here. move_box broadcasts, the panel refetches, and
  // if the box has left this shelf the view dispatch finds no such row
  // and drops back to it - the guard written for a box deleted in another
  // session answers this case too. A move WITHIN the shelf leaves the
  // page open, which is what should happen.
  async moveBoxToPicked(box) {
    const state = this.locationEditState[box.id];
    if (!state) return;
    const path = [state.l1, state.l2, state.l3].filter(Boolean);
    // A box has to land somewhere. An empty path would file it at the
    // root, where no screen lists it (RULE 31).
    if (!path.length) return;
    try {
      await this.callHA('move_box', {
        box_id: String(box.id),
        target_path: path,
      });
    } catch (err) { console.error("Box move failed:", err); }
    this.boxMoveOpen = false;
  }

  // [MODIFIED v2026.10.1] Rename where the title IS, not in a dialog.
  //
  // The same shape as enableSublocRename: the heading is swapped for an input
  // that looks like it, focused, and saved on Enter or on blur. One in-place
  // rename pattern in this panel, not two (RULE 33d). A window.prompt for a
  // one-word edit is a screen you have to dismiss, and on the Android
  // companion app it is a system dialog over the whole panel.
  //
  // The title is the user's own words. The number never changes, so only the
  // title is editable - box3 is what is written on the carton.
  renameBoxInline(box) {
    const titleEl = this.shadowRoot.querySelector('.box-page-title');
    // Already open. A second input over the first would leave one of them
    // orphaned and the heading gone.
    if (!titleEl || this.shadowRoot.querySelector('.box-title-input')) return;

    const current = box.box_title || box.name || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'box-title-input';
    input.value = current;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let saving = false;
    const save = async () => {
      if (saving) return;
      saving = true;
      const next = (input.value || '').trim();
      // Nothing to write. Re-rendering puts the heading back - the input is
      // standing where it used to be, so simply returning would leave the
      // page with a text box for a title.
      if (!next || next === current) {
        this.render();
        return;
      }
      try {
        // update_item_details broadcasts, so the panel refetches and draws
        // the new heading itself. Nothing to re-render here on success.
        await this.callHA('update_item_details', {
          item_id: String(box.id), new_name: next,
        });
      } catch (err) {
        console.error("Box rename failed:", err);
        this.render();
      }
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        input.blur();
      } else if (e.key === 'Escape') {
        // Put the heading back untouched. saving is set first so the blur
        // that follows does not then write the value anyway.
        saving = true;
        this.render();
      }
    };
    input.onblur = () => save();
  }

  // ── filling a box ─────────────────────────────────────────────────────────

  // Create a box, and choose WHERE it goes.
  //
  // Every box landed in General once, because the create call sent
  // current_path and nothing else - and General is the absence of a level_3,
  // not a value. Create opens the new box's page, which is where items are
  // added without a limit; a popup was the wrong shape for that.
  openNewBoxSheet() {
    const { ov, card } = this.buildBoxOverlay(this._t('box_new', 'New box'));

    const body = document.createElement('div');
    body.className = 'box-sheet-body';

    const titleIn = document.createElement('input');
    titleIn.type = 'text';
    titleIn.className = 'box-input';
    titleIn.placeholder = this._t('box_title_ph',
      'What is in it - e.g. M8 screws');
    body.appendChild(titleIn);

    const lbl = document.createElement('label');
    lbl.className = 'box-sheet-label';
    lbl.textContent = this._t('box_where', 'Where does it go');
    body.appendChild(lbl);

    const { wrap, state } = this.buildLocationPicker('General');
    body.appendChild(wrap);
    card.appendChild(body);

    const { bar } = this.buildSheetBar(ov, this._t('box_create', 'Create'),
      async (ok) => {
        const title = (titleIn.value || '').trim();
        if (!title) { titleIn.focus(); return; }
        ok.disabled = true;
        try {
          // A websocket command, not the service: the new id has to come back
          // so the box's page can be opened on it.
          const made = await this._hass.callWS({
            type: 'home_organizer/create_box',
            title,
            current_path: this.pathForGroup(state.chosen),
          });
          ov.remove();
          if (made && made.id) {
            // Set, then fetch. fetchData renders, and a render before the new
            // box is in localData would find no such row and close the page
            // again - see the guard in the view dispatch.
            this.openBoxId = made.id;
            this.expandedIdx = null;
            await this.fetchData();
            return;
          }
          console.error("Box create returned no id:", made);
        } catch (err) {
          console.error("Box create failed:", err);
          ov.remove();
        }
        this.fetchData();
      });
    card.appendChild(bar);
  }

  // Send the ticked items to a box. The touch route that replaces dragging -
  // there is no drag worth having on a phone.
  //
  // It offers the boxes standing in THIS location, which is where something in
  // your hand goes. A box elsewhere is reached by walking to it.
  openPickBoxSheet() {
    if (!this.selectedItems || !this.selectedItems.size) return;
    const boxes = ((this.localData && this.localData.items) || [])
      .filter(i => i.type === 'box');
    const { ov, card } = this.buildBoxOverlay(
      this._t('box_move_to', 'Move to box'));

    if (!boxes.length) {
      const none = document.createElement('div');
      none.className = 'box-sheet-note';
      none.textContent = this._t('box_none_here',
        'There is no box in this location yet. Create one first.');
      card.appendChild(none);
    }

    boxes.forEach(box => {
      const btn = document.createElement('button');
      btn.className = 'action-btn box-menu-item';
      btn.type = 'button';
      btn.innerHTML = `<span class="box-card-label">${escapeHtml(box.box_label || '')}</span>`
        + `<span>${escapeHtml(box.box_title || box.name || '')}</span>`;
      btn.onclick = async () => {
        const ids = Array.from(this.selectedItems);
        ov.remove();
        for (const id of ids) await this.putItemInBox(id, box.id);
        this.selectedItems.clear();
        this.fetchData();
      };
      card.appendChild(btn);
    });

    // Taking things OUT is the same operation with no box, so it belongs here.
    const out = document.createElement('button');
    out.className = 'action-btn';
    out.type = 'button';
    out.style.minHeight = '44px';
    out.textContent = this._t('box_take_out', 'Take out of any box');
    out.onclick = async () => {
      const ids = Array.from(this.selectedItems);
      ov.remove();
      for (const id of ids) await this.putItemInBox(id, null);
      this.selectedItems.clear();
      this.fetchData();
    };
    card.appendChild(out);
  }

  // Put lines from a receipt that has NOT been approved into this box.
  //
  // Assigning a pending line to a box does not approve it. It stays in the
  // review queue and stays untrusted until a human confirms it (RULE 23) -
  // this only records which box it is going into, so that when it IS approved
  // the levels come from the box rather than from the review tab.
  //
  // [MODIFIED v2026.10.1] A panel on the page instead of an overlay.
  //
  // The ticks are held in this.boxPicked and not in the checkboxes: the
  // panel lives inside #content, every refetch rebuilds it, and on a
  // websocket-driven panel a refetch can arrive at any moment because
  // another device changed something. A selection kept in the markup would
  // simply disappear.
  buildReceiptPanel(box) {
    this.boxPicked = this.boxPicked || new Set();
    const panel = document.createElement('div');
    panel.className = 'box-receipt-panel';

    const head = document.createElement('div');
    head.className = 'box-sheet-label';
    head.textContent = this._t('box_from_receipt', 'From a receipt');
    panel.appendChild(head);

    const pending = ((this.localData && this.localData.pending_list) || [])
      .filter(p => String(p.box_id) !== String(box.id));

    if (!pending.length) {
      const none = document.createElement('div');
      none.className = 'box-sheet-note';
      none.textContent = this._t('box_no_pending',
        'There is nothing waiting for review.');
      panel.appendChild(none);
      return panel;
    }

    const body = document.createElement('div');
    body.className = 'box-scroll';

    // Grouped by receipt, because "which receipt was that on" is how a person
    // remembers a line they have not reviewed yet.
    const byReceipt = new Map();
    pending.forEach(p => {
      const key = p.receipt_id ? String(p.receipt_id) : '';
      if (!byReceipt.has(key)) byReceipt.set(key, []);
      byReceipt.get(key).push(p);
    });

    byReceipt.forEach((rows, key) => {
      const groupHead = document.createElement('div');
      groupHead.className = 'box-group-head';
      const rec = (this.localData && this.localData.pending_receipts
                   && this.localData.pending_receipts[key]) || null;
      groupHead.textContent = rec
        ? [rec.vendor, rec.purchase_date].filter(Boolean).join('  -  ')
        : this._t('box_no_receipt', 'No receipt');
      body.appendChild(groupHead);

      rows.forEach(p => {
        const row = document.createElement('label');
        row.className = 'box-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = this.boxPicked.has(String(p.id));
        cb.onchange = () => {
          if (cb.checked) this.boxPicked.add(String(p.id));
          else this.boxPicked.delete(String(p.id));
        };
        const text = document.createElement('span');
        text.className = 'box-row-text';
        text.textContent = p.name || '';
        row.appendChild(cb);
        row.appendChild(text);
        body.appendChild(row);
      });
    });
    panel.appendChild(body);

    const bar = document.createElement('div');
    bar.className = 'box-sheet-bar';
    const ok = document.createElement('button');
    ok.className = 'action-btn btn-text';
    ok.type = 'button';
    ok.style.minHeight = '40px';
    ok.textContent = this._t('box_put_in', 'Put in the box');
    ok.onclick = async () => {
      const ids = Array.from(this.boxPicked);
      if (!ids.length) return;
      ok.disabled = true;
      // Cleared and closed before the calls, so the broadcast each one makes
      // cannot re-render the panel with ticks for rows that have moved.
      this.boxPicked = new Set();
      this.boxReceiptOpen = false;
      for (const id of ids) await this.putItemInBox(id, box.id);
    };
    bar.appendChild(ok);
    panel.appendChild(bar);
    return panel;
  }

  // ── moving and emptying ───────────────────────────────────────────────────

  // Cutting a box puts it on the same clipboard an item uses, so the existing
  // paste bar and the existing paste service move it - and paste_item is what
  // knows a box brings its contents.
  async cutBox(box) {
    try {
      await this.callHA('clipboard_action',
        { action: 'cut', item_name: box.name });
    } catch (err) { console.error("Box cut failed:", err); }
  }

  // Deleting a box empties it onto the shelf. It never deletes an item
  // (RULE 5) - see async_delete_box.
  async confirmDeleteBox(box) {
    const label = box.box_label || box.name || '';
    if (!confirm(this._t('box_delete_confirm',
        'Remove this box? The items inside it stay where they are.')
        + '\n\n' + label)) {
      return;
    }
    try {
      await this.callHA('delete_box', { box_id: String(box.id) });
    } catch (err) { console.error("Box delete failed:", err); }
    // The page cannot survive its own box.
    if (String(this.openBoxId) === String(box.id)) this.closeBox();
  }
};
