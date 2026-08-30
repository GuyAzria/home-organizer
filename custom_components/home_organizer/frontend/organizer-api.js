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
// [MODIFIED v7.7.60 | 2026-05-03] Purpose: Removed complex blur/input event tracking. autoSaveItem now cleanly responds to explicit save actions (like the new Save button in the UI).
// [MODIFIED v7.7.59 | 2026-05-03] Purpose: Completely solved the mobile Companion App "reverting name" bug. Replaced unreliable DOM visibility checks during keyboard blur with a memory-based state tracker (_lastEditedValues) powered by the 'input' event, ensuring the exact text typed by the user is always the one saved.

import { ITEM_CATEGORIES } from './organizer-data.js?v=6.6.10';
import { escapeHtml } from './organizer-utils.js?v=2026.8.26';

export const APIMixin = (Base) => class extends Base {

  // Extremely robust visibility check for duplicate IDs
  _getActiveEl(id) {
    const els = this.shadowRoot.querySelectorAll(`[id="${id}"]`);
    if (!els || els.length === 0) return null;
    
    // 1. Native dimensions check (Fastest, handles most cases)
    for (let i = 0; i < els.length; i++) {
      if (els[i].offsetWidth > 0 || els[i].offsetHeight > 0) return els[i];
    }
    
    // 2. Computed Style check up the DOM tree (Bulletproof for CSS hidden items)
    for (let i = 0; i < els.length; i++) {
      let isHidden = false;
      let curr = els[i];
      while (curr && curr.nodeType === 1 && curr !== this.shadowRoot) {
        const style = window.getComputedStyle(curr);
        if (style.display === 'none' || style.visibility === 'hidden') {
          isHidden = true;
          break;
        }
        curr = curr.parentNode;
      }
      if (!isHidden) return els[i];
    }
    
    // Fallback
    return els[0]; 
  }

  callHA(service, data) {
    return this._hass.callService('home_organizer', service, data);
  }

  async fetchData() {
    if (!this._hass) return;

    try {
      const query = this.shadowRoot.getElementById('search-input')?.value || "";
      if (this.isSearch && query.length > 0) {
        const resolved = this.resolveCatalogIdToPath(query);
        if (resolved) { this.handleCatalogIdSearch(resolved, query); return; }
      }
      const data = await this._hass.callWS({
        type: 'home_organizer/get_data',
        path: this.currentPath,
        search_query: query,
        date_filter: "All",
        shopping_mode: this.isShopMode || this.isReviewMode
      });
      if (data.catalog_map) this.persistentIds = data.catalog_map;
      this.localData = data;
      this.updateUI();
    } catch (e) { console.error("Fetch error", e); }
  }

  handleCatalogIdSearch(pathArray, query) {
    const filteredItems = this.allDbItems.filter(item => {
      let p = [];
      if (item.location) p = item.location.replace(/&gt;/g, '>').split('>').map(s => s.trim());
      const l1 = p[0] || item.main_location || item.level_1 || '';
      const l2 = p[1] || item.sub_location  || item.level_2 || '';
      const l3 = p[2] || item.level_3 || '';
      const stripZone  = s => s.replace(/^\[.*?\]\s*/, '').replace(/^ZONE_MARKER_\d+_/, '');
      const stripOrder = s => s.replace(/^ORDER_MARKER_\d+_/, '');
      const l1m = l1 === pathArray[0] || stripZone(l1) === stripZone(pathArray[0]);
      const l2m = l2 === pathArray[1];
      const l3m = stripOrder(l3) === stripOrder(pathArray[2]);
      if (pathArray.length === 1) return l1m;
      if (pathArray.length === 2) return l1m && l2m;
      if (pathArray.length === 3) return l1m && l2m && l3m;
      return false;
    });
    this.localData = {
      path_display: `Search: ${query} (${pathArray.join(' > ').replace(/(ZONE|ORDER)_MARKER_\d+_/g, '')})`,
      items: filteredItems, depth: 0
    };
    this.updateUI();
  }
  
  updateQty(id, d) { this.callHA('update_qty', { item_id: id, change: d }); }

  updateOrderQty(id, d) { this.callHA('update_order_qty', { item_id: id, change: d }); }

  updateUnitValue(itemId, itemName) {
    const valInput = this._getActiveEl(`unit-val-${itemId}`);
    if (!valInput) return;
    this.callHA('update_item_details', {
      item_id: itemId,
      original_name: itemName || "",
      unit_value: valInput.value || ""
    });
  }

  async submitShopStock(id) {
    const list = this.localData?.shopping_list || [];
    const item = list.find(i => String(i.id) === String(id));
    const qty = (item && item.order_qty) ? item.order_qty : 1;
    await this.callHA('update_stock', { item_id: id, quantity: qty });
    if (this.isShopMode) this.fetchData();
  }

  async bulkDeleteItems() {
    if (!this.selectedItems.size) return;
    const count = this.selectedItems.size;
    const msg = this.translations['confirm_bulk_del']
      ? this.t('confirm_bulk_del', count)
      : `Are you sure you want to delete ${count} selected items?`;
    if (confirm(msg)) {
      for (let id of this.selectedItems)
        await this.callHA('delete_item', { item_id: id, current_path: this.currentPath, is_folder: false });
      this.selectedItems.clear();
      setTimeout(() => this.fetchData(), 500);
    }
  }

  confirmPending(id) {
    const nameEl = this._getActiveEl(`pending-name-${id}`);
    const qtyEl  = this._getActiveEl(`pending-qty-${id}`);
    const state  = this.locationEditState[id] || {};
    const path   = [state.l1, state.l2, state.l3].filter(Boolean);
    this.callHA('confirm_pending', {
      item_id: id,
      name: nameEl?.value.trim() || "",
      quantity: qtyEl ? (parseInt(qtyEl.value) || 1) : 1,
      path
    });
  }

  deletePending(id) {
    this.callHA('delete_item', { item_id: id, current_path: [], is_folder: false });
  }

  updatePendingCategory(itemId, value, type) {
    const mainSel = this._getActiveEl(`pending-cat-main-${itemId}`);
    const subSel  = this._getActiveEl(`pending-cat-sub-${itemId}`);
    let mainCat = type === 'main' ? value : (mainSel?.value || "");
    let subCat  = type === 'sub'  ? value : (type === 'main' ? "" : (subSel?.value || ""));
    
   
    if (type === 'main') {
      if (subSel) {
       
        subSel.textContent = '';

       
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = this.t('select_sub');
        subSel.appendChild(defaultOpt);

  
        if (mainCat && ITEM_CATEGORIES[mainCat]) {
          Object.keys(ITEM_CATEGORIES[mainCat]).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
          
            opt.textContent = this.t('sub_' + s.replace(/[^a-zA-Z0-9]+/g,'_')) || s;
            subSel.appendChild(opt);
          });
        }
      }
    }
    this.callHA('update_item_details', { item_id: itemId, category: mainCat, sub_category: subCat })
      .then(() => this.fetchData());
  }

  updateItemCategory(itemId, value, type, itemName) {
    const mainSel  = this._getActiveEl(`cat-main-${itemId}`);
    const subSel   = this._getActiveEl(`cat-sub-${itemId}`);
    const valInput = this._getActiveEl(`unit-val-${itemId}`);
    const unitDisp = this._getActiveEl(`unit-disp-${itemId}`);
    let mainCat = type === 'main' ? value : (mainSel?.value || "");
    let subCat  = type === 'sub'  ? value : (type === 'main' ? "" : (subSel?.value || ""));
    if (type === 'main') {
      let html = `<option value="">${this.t('select_sub')}</option>`;
      if (mainCat && ITEM_CATEGORIES[mainCat])
        Object.keys(ITEM_CATEGORIES[mainCat]).forEach(s => {
          html += `<option value="${escapeHtml(s)}">${escapeHtml(this.t('sub_' + s.replace(/[^a-zA-Z0-9]+/g,'_')) || s)}</option>`;
        });
      if (subSel) subSel.innerHTML = html;
      subCat = "";
      if (unitDisp) unitDisp.innerText = "-";
    }

    const payload = {
      item_id: itemId, original_name: itemName,
      category: mainCat, sub_category: subCat,
      unit_value: valInput?.value || "", current_path: this.currentPath
    };
    if (mainCat && subCat && ITEM_CATEGORIES[mainCat]?.[subCat]) {
      const newUnit = ITEM_CATEGORIES[mainCat][subCat];
      payload.unit = newUnit;
      if (unitDisp) unitDisp.innerText = this.t('unit_' + newUnit) || newUnit;
    }

    this.callHA('update_item_details', payload).then(() => { if (this.isShopMode) this.fetchData(); });
  }

  autoSaveItem(itemId, triggerType, oldName) {
    const nameEl = this._getActiveEl(`name-${itemId}`);
    const dateEl = this._getActiveEl(`date-${itemId}`);
    
    const payload = { item_id: itemId, original_name: oldName };
    if (nameEl) payload.new_name = nameEl.value.trim();
    if (dateEl) payload.new_date = dateEl.value;
    
    if (payload.new_name !== undefined || payload.new_date !== undefined) {
      // Prevent double network requests
      const saveKey = `save_${itemId}_${payload.new_name}_${payload.new_date}`;
      if (this._recentSaves && this._recentSaves[saveKey] && (Date.now() - this._recentSaves[saveKey] < 500)) {
        return; 
      }
      this._recentSaves = this._recentSaves || {};
      this._recentSaves[saveKey] = Date.now();

      this.callHA('update_item_details', payload).then(() => {
        if (this.isShopMode) this.fetchData();
      });
    }
  }

  pasteItem() { this.callHA('paste_item', { target_path: this.currentPath }); }
  cut(name)   { this.callHA('clipboard_action', { action: 'cut', item_name: name }); }
  duplicateItem(itemId) { if (itemId) this.callHA('duplicate_item', { item_id: itemId }); }

  del(id) {
    if (confirm(this.t('confirm_del_item')))
      this._hass.callService('home_organizer', 'delete_item', { item_id: id, current_path: this.currentPath, is_folder: false });
  }

  deleteFolder(name) {
    if (confirm(this.t('confirm_del_folder', name)))
      this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: true });
  }

  deleteSubloc(name) {
    const realName = this.resolveRealName(name);
    if (confirm(this.t('confirm_del_item', name)))
      this._hass.callService('home_organizer', 'delete_item', { item_name: realName, current_path: this.currentPath, is_folder: true });
  }

  applySuggestion(itemId, match) {
    const nameInput = this._getActiveEl(`name-${itemId}`);
    if (nameInput) nameInput.value = match.name;
    let cleanPath = match.image_path ? match.image_path.split('?')[0].split('/').pop() : null;
    this.callHA('update_item_details', {
      item_id: itemId, original_name: nameInput?.value,
      new_name: match.name, category: match.category,
      sub_category: match.sub_category, unit: match.unit,
      unit_value: match.unit_value, image_path: cleanPath
    }).then(() => this.fetchData());
  }

  handleNameInput(input, itemId) {
    const val = input.value.toLowerCase();
    const parent = input.parentElement;
    parent.querySelector('.suggestions-box')?.remove();
    if (val.length < 2) return;
    const matches = this.allDbItems.filter(i => i.name.toLowerCase().startsWith(val));
    if (!matches.length) return;
    const box = document.createElement('div');
    box.className = 'suggestions-box';
    matches.slice(0, 5).forEach(match => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = match.image_path
        ? `<img src="${escapeHtml(match.image_path)}" class="suggestion-img"><span>${escapeHtml(match.name)}</span>`
        : `<span>${escapeHtml(match.name)}</span>`;
      div.onmousedown = e => { e.preventDefault(); this.applySuggestion(itemId, match); box.remove(); };
      box.appendChild(div);
    });
    parent.appendChild(box);
  }

  handleChatProgress(data) {
    if (!this.isChatMode) return;
    let statusMsg = null;
    for (let i = this.chatHistory.length - 1; i >= 0; i--) {
      if (this.chatHistory[i].role === 'system' && this.chatHistory[i].isStatus) { statusMsg = this.chatHistory[i]; break; }
    }
    if (!statusMsg) return;
    if (data.step && !statusMsg.text.includes(data.step)) statusMsg.text += `<br>✔ <b>${data.step}</b>`;
    if (data.debug_label && data.debug_content) {
      const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
      statusMsg.text += `<details class="debug-details"><summary class="debug-summary">▶ ${data.debug_label}</summary><div class="debug-content">${esc(data.debug_content)}</div></details>`;
    }
    this.render();
    setTimeout(() => { const m = this.shadowRoot.querySelector('.chat-messages'); if (m) m.scrollTop = m.scrollHeight; }, 50);
  }

  updateHierarchyState(itemId, level, newValue) {
    if (!this.locationEditState[itemId]) return;
    this.locationEditState[itemId][`l${level}`] = newValue;
    if (level === 1) { this.locationEditState[itemId].l2 = ""; this.locationEditState[itemId].l3 = ""; }
    else if (level === 2) { this.locationEditState[itemId].l3 = ""; }
    this.render();
  }

  saveHierarchy(itemId) {
    const state = this.locationEditState[itemId];
    if (!state) return;
    const newPath = [state.l1, state.l2, state.l3].filter(Boolean);
    if (newPath.length > 0)
      this.callHA('update_item_details', { item_id: itemId, new_path: newPath })
        .then(() => { if (this.isShopMode) this.fetchData(); });
  }

  handleMoveToPath(itemId) {
    const room = this._getActiveEl(`room-select-${itemId}`)?.value;
    const loc  = this._getActiveEl(`loc-select-${itemId}`)?.value;
    const sub  = this._getActiveEl(`target-subloc-${itemId}`)?.value;
    if (!room || !loc || !sub) return;
    const targetPath = sub === "__ROOT__" ? [room, loc] : [room, loc, sub];
    this.callHA('clipboard_action', { action: 'cut', item_id: itemId });
    setTimeout(() => this.callHA('paste_item', { target_path: targetPath }), 100);
  }

};