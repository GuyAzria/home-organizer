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
// [MODIFIED v2026.10.8 | 2026-10-08] Purpose: the sub-category chips.
//
//   This renderer already drew exactly the rows a category drill-down
//   needs, so the strip was added here rather than in a screen of its own -
//   one list renderer, not two (RULE 33d). It appears only when
//   attrs.category_view says the list came from a category.
//
//   The chips are built from what is IN the list, not from the category
//   table: a sub-category nobody owns anything in would lead to an empty
//   screen, and the group that matters most - items with no sub-category at
//   all - is in no table.
//
//   The empty state is appended now instead of assigned. innerHTML on a
//   container destroys whatever was added to it (RULE 33a.5); it was the
//   only writer here and so harmless, which is exactly how the next
//   addition above it would have been silently deleted.
// [MODIFIED v2026.9.30 | 2026-09-30] Purpose: A search result that IS a box
//   gets a box card and opens the box page. It was drawn with createItemRow,
//   so the boxes toggle in the search bar returned rows nobody could open.
//
//   The cards come from appendBoxCards in pages/view-box.js - one function
//   for every list that can hold a box (RULE 33a.6). Boxed ITEMS are kept in
//   the list here, unlike on a shelf: a search has to show the thing that was
//   searched for wherever it is, and the box line under its name is what
//   answers where it went.

export const SearchMixin = (Base) => class extends Base {
  // [ADDED v2026.10.8] The sub-category chips, when this list came from a
  // category on the dashboard breakdown rather than from the search box.
  //
  // Built from what is actually in the list, not from the category table:
  // a sub-category nobody owns anything in would be a chip that leads to an
  // empty screen, and the one case that matters - items with NO
  // sub-category - is in no table at all.
  buildCategoryFilterStrip(view) {
    const strip = document.createElement('div');
    strip.className = 'cat-filter-strip';
    // Logical properties and wrapping, per RULE 33b and RULE 36: this sits
    // above a list on a phone as readily as on a desktop, and a house with
    // thirty sub-categories must wrap rather than scroll the page sideways.
    strip.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;'
      + 'padding:10px 12px;align-items:center;';

    const chip = (label, count, active, onTap) => {
      const b = document.createElement('button');
      b.type = 'button';
      // 40px minimum, because this is a touch target (RULE 36).
      b.style.cssText = 'min-height:40px;padding-inline:14px;border-radius:'
        + '20px;font-size:13px;cursor:pointer;border:1px solid '
        + 'var(--border-light,#333);background:' + (active
          ? 'var(--primary,#4fc3f7)' : 'transparent')
        + ';color:' + (active ? '#000' : 'var(--text-main)')
        + ';font-weight:' + (active ? 'bold' : 'normal') + ';';
      b.textContent = count === null ? label : (label + '  ' + count);
      b.onclick = onTap;
      return b;
    };

    strip.appendChild(chip(
      this._t('cat_filter_all', 'All'), view.total, view.sub === null,
      () => this.setCategorySubFilter(null)));

    (view.subs || []).forEach((sc) => {
      // An empty name is a real group, not a missing one, so it gets a
      // label of its own rather than a blank chip.
      const label = sc.name
        ? this._t('sub_' + sc.name.replace(/[^a-zA-Z0-9]+/g, '_'), sc.name)
        : this._t('cat_filter_none', 'No sub-category');
      strip.appendChild(chip(
        label, sc.n,
        view.sub !== null && String(view.sub).toLowerCase()
          === String(sc.name).toLowerCase(),
        () => this.setCategorySubFilter(sc.name)));
    });
    return strip;
  }

  renderSearchView(content, attrs) {
      // [ADDED v2026.10.8] Appended to `content`, above the list, and only
      // when this view was opened from a category.
      if (attrs && attrs.category_view
          && typeof this.buildCategoryFilterStrip === 'function') {
        content.appendChild(
          this.buildCategoryFilterStrip(attrs.category_view));
      }

      const list = document.createElement('div'); 
      list.className = 'item-list';
      if (attrs.items && attrs.items.length > 0) {
          // [MODIFIED v2026.9.30] A search result can BE a box - that is
          // what the boxes toggle in the search bar returns - and it was
          // drawn as an item row with no way to open it.
          //
          // keepBoxedRows is true here, unlike on a shelf: a search has to
          // show the thing that was searched for wherever it is, and the box
          // line under its name is exactly what answers where it went.
          const loose = (typeof this.appendBoxCards === 'function')
            ? this.appendBoxCards(attrs.items, list, true)
            : attrs.items;
          loose.forEach(item => {
              if (typeof this.createItemRow === 'function') {
                  list.appendChild(this.createItemRow(item, false));
              }
          });
      } else {
          // [MODIFIED v2026.10.8] Appended, not assigned. innerHTML on a
          // container destroys anything already added to it (RULE 33a.5);
          // this one is still empty here, but writing it the unsafe way is
          // how the next addition above it gets silently deleted.
          const none = document.createElement('div');
          none.style.cssText = 'text-align:center;padding:20px;color:#888;';
          none.textContent = (attrs && attrs.category_view)
            ? this._t('cat_filter_empty', 'Nothing here under that filter.')
            : this._t('no_results', 'No results found.');
          list.appendChild(none);
      }
      content.appendChild(list);
  }
};