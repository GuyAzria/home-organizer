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
// [MODIFIED v2026.9.30 | 2026-09-30] Purpose: A search result that IS a box
//   gets a box card and opens the box page. It was drawn with createItemRow,
//   so the boxes toggle in the search bar returned rows nobody could open.
//
//   The cards come from appendBoxCards in pages/view-box.js - one function
//   for every list that can hold a box (RULE 33a.6). Boxed ITEMS are kept in
//   the list here, unlike on a shelf: a search has to show the thing that was
//   searched for wherever it is, and the box line under its name is what
//   answers where it went.
// [ADDED v10.0.4] Search View

export const SearchMixin = (Base) => class extends Base {
  renderSearchView(content, attrs) {
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
          list.innerHTML = `<div style="text-align:center;padding:20px;color:#888;">${this._t('no_results', 'No results found.')}</div>`;
      }
      content.appendChild(list);
  }
};