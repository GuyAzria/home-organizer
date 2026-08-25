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
// [MODIFIED v10.0.9 | 2026-05-03] Purpose: Removed all sharing logic from the shopping view. Share functionality has been completely abstracted into the UIMixin (organizer-ui.js) for proper routing and modal interaction.
// [ADDED v10.0.4] Shopping View

import { ICONS } from '../organizer-icon.js?v=10.4.2';

export const ShoppingMixin = (Base) => class extends Base {

  renderShoppingView(content, attrs) {
      const listContainer = document.createElement('div');
      listContainer.className = 'item-list';
      if (attrs.shopping_list?.length > 0) {
        const grouped = {};
        attrs.shopping_list.forEach(item => {
          const cat = item.category || "Other";
          const sub = item.sub_category || "General";
          if (!grouped[cat]) grouped[cat] = { total: 0, subs: {} };
          if (!grouped[cat].subs[sub]) grouped[cat].subs[sub] = [];
          grouped[cat].subs[sub].push(item);
          grouped[cat].total++;
        });
        Object.keys(grouped).sort().forEach(catName => {
          const catData    = grouped[catName];
          const isCollapsed = this.collapsedShopCats.has(catName);
          const icon = isCollapsed ? ICONS.chevron_right : ICONS.chevron_down;
          const translatedCat = this._t('cat_' + catName.replace(/[^a-zA-Z0-9]+/g,'_'), catName);
          
          const header = document.createElement('div');
          header.className = 'group-separator'; header.style.cursor = 'pointer';
          header.innerHTML = `<div style="display:flex;align-items:center;color:var(--primary);"><span style="margin-inline-end:5px;display:flex;align-items:center;fill:currentColor;">${icon}</span><span style="font-weight:bold;">${translatedCat}</span><span class="shop-badge" style="background:#555;color:white;margin-inline-start:8px;">${catData.total}</span></div>`;
          header.onclick = () => { if (this.collapsedShopCats.has(catName)) this.collapsedShopCats.delete(catName); else this.collapsedShopCats.add(catName); this.render(); };
          listContainer.appendChild(header);
          
          if (!isCollapsed) {
            Object.keys(catData.subs).sort().forEach(subName => {
              const subItems = catData.subs[subName];
              const subKey   = `${catName}_${subName}`;
              const isSubColl = this.collapsedShopSubCats.has(subKey);
              const subIcon   = isSubColl ? ICONS.chevron_right : ICONS.chevron_down;
              
              if (subName && subName !== "General" || Object.keys(catData.subs).length > 1) {
                const subHeader = document.createElement('div');
                subHeader.className = 'sub-group-separator';
                Object.assign(subHeader.style, { padding:'8px 15px 4px 15px', fontSize:'14px', color:'var(--accent)', fontWeight:'bold', borderBottom:'1px solid var(--border-light)', cursor:'pointer' });
                const translatedSub = this._t('sub_' + subName.replace(/[^a-zA-Z0-9]+/g,'_'), subName);
                subHeader.innerHTML = `<div style="display:flex;align-items:center;"><span style="margin-inline-end:5px;display:flex;align-items:center;fill:currentColor;transform:scale(.8);">${subIcon}</span><span>${translatedSub}</span><span style="font-size:11px;background:var(--bg-badge,#555);color:var(--text-badge,#fff);padding:2px 6px;border-radius:10px;margin-inline-start:8px;">${subItems.length}</span></div>`;
                subHeader.onclick = () => { if (this.collapsedShopSubCats.has(subKey)) this.collapsedShopSubCats.delete(subKey); else this.collapsedShopSubCats.add(subKey); this.render(); };
                listContainer.appendChild(subHeader);
              }
              const shouldHide = (subName && subName !== "General" || Object.keys(catData.subs).length > 1) ? isSubColl : false;
              
              if (!shouldHide) {
                  subItems.forEach(item => {
                      if (typeof this.createItemRow === 'function') {
                          listContainer.appendChild(this.createItemRow(item, true));
                      }
                  });
              }
            });
          }
        });
      } else {
        listContainer.innerHTML = `<div style="text-align:center;padding:20px;color:#888;">${this._t('no_items_list', 'No items in the list.')}</div>`;
      }
      content.appendChild(listContainer);
  }
};