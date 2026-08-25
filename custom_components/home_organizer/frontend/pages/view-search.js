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
// [ADDED v10.0.4] Search View

export const SearchMixin = (Base) => class extends Base {
  renderSearchView(content, attrs) {
      const list = document.createElement('div'); 
      list.className = 'item-list';
      if (attrs.items && attrs.items.length > 0) {
          attrs.items.forEach(item => {
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