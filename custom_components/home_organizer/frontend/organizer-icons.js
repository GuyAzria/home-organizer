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
// [MODIFIED v2026.9.20 | 2026-09-20] Purpose: drawIconWithAi asks the
//   assistant to draw THIS item, from a sentence the user typed. It is the
//   repair for an icon that landed wrong: the voice path draws as it adds,
//   but a receipt and a barcode still choose from the shipped library, so
//   an item can arrive with the nearest thing rather than the thing. Same
//   release: openIconPicker shows the row for items only, and every other
//   way of setting a picture now clears the drawing (see services.py) -
//   a drawn icon outranks image_path, so without that the first drawing
//   would have been permanent. A failure now names its reason - the code
//   rides on the end of the message - because every one of them used to
//   read as the same single sentence.

import { ICONS, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=6.6.10';

export const IconsMixin = (Base) => class extends Base {

  openIconPicker(target, context) {
    if (context === 'item') {
      this.pendingItemId = target;
      this.pendingFolderIcon = null;
      let currentCat = null, currentSub = null;
      const item = (this.localData?.items || []).find(i => i.id == target)
                || (this.localData?.shopping_list || []).find(i => i.id == target)
                || (this.localData?.pending_list || []).find(i => i.id == target);
      // [ADDED v2026.9.20] Kept for the AI row's description field. It is a
      // STARTING POINT for the user to edit, not the subject of the drawing -
      // the backend reads the name it draws from the database.
      this.pendingItemName = (item && item.name) ? String(item.name) : '';
      if (item?.category && ICON_LIB_ITEM[item.category]) {
        currentCat = item.category;
        if (item.sub_category && ICON_LIB_ITEM[item.category][item.sub_category]) currentSub = item.sub_category;
      }
      const mainCats = Object.keys(ICON_LIB_ITEM).filter(k => k !== '_icon');
      this.pickerMainCategory = currentCat || mainCats[0] || null;
      if (this.pickerMainCategory) {
        const subs = Object.keys(ICON_LIB_ITEM[this.pickerMainCategory] || {}).filter(k => k !== '_icon');
        this.pickerSubCategory = currentSub || subs[0] || null;
      }
    } else {
      this.pendingFolderIcon = target;
      this.pendingItemId = null;
      this.pickerMainCategory = null;
      this.pickerSubCategory = null;
    }
    this.pickerContext = context;
    this.renderIconPickerGrid();

    // [ADDED v2026.9.20] The AI row belongs to items only. A room or a shelf
    // is a place; there is no object to draw, and the folder icons are a
    // small closed set the library covers properly.
    const aiRow = this.shadowRoot.getElementById('ai-icon-row');
    if (aiRow) {
      aiRow.style.display = (context === 'item') ? 'flex' : 'none';
      const desc = this.shadowRoot.getElementById('ai-icon-desc');
      // Prefilled, and left editable. "Milk" draws a carton; the user typing
      // "glass bottle with a blue cap" is the whole point of the field.
      if (desc) desc.value = this.pendingItemName || '';
    }

    this.shadowRoot.getElementById('icon-modal').style.display = 'flex';
  }

  getCurrentPickerLib() {
    if (this.pickerContext === 'room')     return ICON_LIB_ROOM;
    if (this.pickerContext === 'location') return ICON_LIB_LOCATION;
    if (this.pickerContext === 'item') {
      if (!this.pickerMainCategory || !this.pickerSubCategory) return {};
      const lib = ICON_LIB_ITEM[this.pickerMainCategory]?.[this.pickerSubCategory] || {};
      return Object.fromEntries(Object.entries(lib).filter(([k]) => k !== '_icon'));
    }
    return {};
  }

  renderIconPickerGrid() {
    const lib = this.getCurrentPickerLib();
    const grid     = this.shadowRoot.getElementById('icon-lib-grid');
    const mainBar  = this.shadowRoot.getElementById('picker-main-categories');
    const subBar   = this.shadowRoot.getElementById('picker-sub-categories');

    if (this.pickerContext === 'item') {
      mainBar.style.display = 'flex'; subBar.style.display = 'flex';
      mainBar.innerHTML = ''; subBar.innerHTML = '';

      Object.keys(ICON_LIB_ITEM).forEach(mainCat => {
        if (mainCat === '_icon') return;
        const btn = document.createElement('button');
        btn.className = 'cat-btn' + (this.pickerMainCategory === mainCat ? ' active' : '');
        const iconSvg = this.getSafeIcon(ICON_LIB_ITEM[mainCat]['_icon']);
        btn.innerHTML = `<div class="cat-svg-wrapper">${iconSvg || ''}</div><span>${this.t('cat_' + mainCat.replace(/[^a-zA-Z0-9]+/g,'_')) || mainCat}</span>`;
        btn.onclick = () => {
          this.pickerMainCategory = mainCat;
          const subs = Object.keys(ICON_LIB_ITEM[mainCat]).filter(k => k !== '_icon');
          this.pickerSubCategory = subs[0] || null;
          this.renderIconPickerGrid();
        };
        mainBar.appendChild(btn);
      });

      if (this.pickerMainCategory && ICON_LIB_ITEM[this.pickerMainCategory]) {
        Object.keys(ICON_LIB_ITEM[this.pickerMainCategory]).forEach(subCat => {
          if (subCat === '_icon') return;
          const btn = document.createElement('button');
          btn.className = 'subcat-btn' + (this.pickerSubCategory === subCat ? ' active' : '');
          const iconSvg = this.getSafeIcon(ICON_LIB_ITEM[this.pickerMainCategory][subCat]['_icon']);
          btn.innerHTML = `<div class="subcat-svg-wrapper">${iconSvg || ''}</div><span>${this.t('sub_' + subCat.replace(/[^a-zA-Z0-9]+/g,'_')) || subCat}</span>`;
          btn.onclick = () => { this.pickerSubCategory = subCat; this.renderIconPickerGrid(); };
          subBar.appendChild(btn);
        });
      }
    } else {
      mainBar.style.display = 'none'; subBar.style.display = 'none';
    }

    grid.innerHTML = '';
    Object.keys(lib).forEach(key => {
      const div = document.createElement('div');
      div.className = 'lib-icon';
      div.innerHTML = `${lib[key]}<span>${this.t('item_' + key.replace(/[^a-zA-Z0-9]+/g,'_')) || key}</span>`;
      div.onclick = () => this.selectLibraryIconKey(key);
      grid.appendChild(div);
    });
  }

  async selectLibraryIconKey(key) {
    let fullKey = "";
    if      (this.pickerContext === 'room')     fullKey = `ICON_LIB_ROOM_${key}`;
    else if (this.pickerContext === 'location') fullKey = `ICON_LIB_LOCATION_${key}`;
    else if (this.pickerContext === 'item')     fullKey = `ICON_LIB_ITEM|${this.pickerMainCategory}|${this.pickerSubCategory}|${key}`;
    else                                        fullKey = `ICON_LIB_${key}`;

    const target = this.pendingItemId || this.pendingFolderIcon;
    if (target) this.setLoading(target, true);
    this.shadowRoot.getElementById('icon-modal').style.display = 'none';

    try {
      if (this.pendingItemId) {
        if (this.pickerContext === 'item' && this.pickerMainCategory) {
          let newUnit = "Units";
          if (this.pickerSubCategory && this.categories[this.pickerMainCategory]?.[this.pickerSubCategory])
            newUnit = this.categories[this.pickerMainCategory][this.pickerSubCategory];
          await this.callHA('update_item_details', {
            item_id: this.pendingItemId, image_path: fullKey,
            category: this.pickerMainCategory, sub_category: this.pickerSubCategory || "", unit: newUnit
          });
        } else {
          await this.callHA('update_image', { item_id: this.pendingItemId, icon_key: fullKey });
        }
        this.refreshImageVersion(this.pendingItemId);
        this.fetchData();
      } else if (this.pendingFolderIcon) {
        const isFolderCtx = this.pickerContext === 'room' || this.pickerContext === 'location';
        const markerName  = isFolderCtx ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
        await this.callHA('update_image', { item_name: markerName, icon_key: fullKey });
        this.refreshImageVersion(this.pendingFolderIcon);
        this.fetchData();
      }
    } catch (e) { console.error(e); }
    finally { if (target) this.setLoading(target, false); }
  }

  async selectLibraryIcon(svgHtml) {
    let source = svgHtml;
    const size = 140;
    if (!source.includes('xmlns')) source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    if (source.includes('width=')) source = source.replace(/width="[^"]*"/, `width="${size}"`).replace(/height="[^"]*"/, `height="${size}"`);
    else source = source.replace('<svg', `<svg width="${size}" height="${size}"`);
    if (!source.includes('fill=')) source = source.replace('<svg', '<svg fill="#4fc3f7"');

    const loadImage = src => new Promise(resolve => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
    });
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = await loadImage(url);
    if (!img) return;

    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    canvas.getContext('2d').drawImage(img, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/png');

    const target = this.pendingItemId || this.pendingFolderIcon;
    if (target) this.setLoading(target, true);
    this.shadowRoot.getElementById('icon-modal').style.display = 'none';

    try {
      if (this.pendingItemId) {
        await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
        this.refreshImageVersion(this.pendingItemId); this.fetchData();
      } else if (this.pendingFolderIcon) {
        const isFolderCtx = this.pickerContext === 'room' || this.pickerContext === 'location';
        const markerName  = isFolderCtx ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
        await this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
        this.refreshImageVersion(this.pendingFolderIcon); this.fetchData();
      }
    } catch (e) { console.error(e); }
    finally { if (target) this.setLoading(target, false); URL.revokeObjectURL(url); }
  }

  async handleUrlIcon(url) {
    const loadImage = src => new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => resolve(img); img.onerror = reject; img.src = src;
    });
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      this.shadowRoot.getElementById('icon-modal').style.display = 'none';
      this.shadowRoot.getElementById('icon-url-input').value = '';
      const target = this.pendingItemId || this.pendingFolderIcon;
      if (target) this.setLoading(target, true);
      try {
        if (this.pendingItemId) {
          await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
          this.refreshImageVersion(this.pendingItemId); this.fetchData();
        } else if (this.pendingFolderIcon) {
          const isFolderCtx = this.pickerContext === 'room' || this.pickerContext === 'location';
          const markerName  = isFolderCtx ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
          await this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          this.refreshImageVersion(this.pendingFolderIcon); this.fetchData();
        }
      } finally { if (target) this.setLoading(target, false); }
    } catch (e) { alert("Error loading image (CORS or Invalid URL)."); }
  }

  handleIconUpload(input) {
    const file = input.files[0]; if (!file) return;
    this.compressImage(file, async (dataUrl) => {
      this.shadowRoot.getElementById('icon-modal').style.display = 'none';
      const target = this.pendingItemId || this.pendingFolderIcon;
      if (target) this.setLoading(target, true);
      try {
        if (this.pendingItemId) {
          await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
          this.refreshImageVersion(this.pendingItemId); this.fetchData();
        } else if (this.pendingFolderIcon) {
          const isFolderCtx = this.pickerContext === 'room' || this.pickerContext === 'location';
          const markerName  = isFolderCtx ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
          await this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          this.refreshImageVersion(this.pendingFolderIcon); this.fetchData();
        }
      } catch (e) { console.error(e); }
      finally { if (target) this.setLoading(target, false); }
    });
    input.value = '';
  }

  // [ADDED v2026.9.20] Ask the assistant to draw this item, from a sentence.
  //
  // WHY THE BUTTON EXISTS - permanent architectural note.
  //
  // An item added by voice is drawn as it is added. An item that arrived on a
  // receipt or a barcode is not: those read many products in one answer and
  // still pick from the shipped library, which is the right trade for a scan
  // that must not truncate. This is the repair for the ones that land wrong -
  // the user says what the thing actually is and gets a drawing of it.
  //
  // Nothing about the drawing is decided here. The panel sends an id and a
  // sentence; the backend reads the item's real name, asks for shapes, and
  // rebuilds every field before storing it. What comes back is a spec that
  // item-icon.js draws, never markup (RULE 7, RULE 15).
  async drawIconWithAi() {
    const itemId = this.pendingItemId;
    if (!itemId) return;
    const descEl = this.shadowRoot.getElementById('ai-icon-desc');
    const description = (descEl && descEl.value ? descEl.value : '').trim();

    const btn = this.shadowRoot.getElementById('btn-ai-icon');
    if (btn) btn.disabled = true;
    this.setLoading(itemId, true);

    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/draw_item_icon',
        item_id: itemId,
        description: description
      });
      if (res && res.icon_spec) {
        // Only now is the window closed. A failure leaves it open with the
        // sentence still in the box, because the answer to a drawing that
        // did not work is usually a better description, not starting again.
        this.shadowRoot.getElementById('icon-modal').style.display = 'none';
        this.refreshImageVersion(itemId);
        this.fetchData();
      } else {
        // [MODIFIED v2026.9.20] The reason travels with the message.
        //
        // Every failure looked identical from the outside - one sentence
        // that could mean the AI is unreachable, or that the item is gone,
        // or that the drawing came back unreadable. The code is three words
        // of English on the end of a translated sentence, and it is the
        // difference between a bug report and a shrug.
        const code = (res && res.error) ? String(res.error) : 'no_reply';
        const key = (code === 'not_drawable')
          ? 'ai_icon_not_drawable' : 'ai_icon_failed';
        const text = this.t(key) || 'The assistant could not draw this item.';
        alert(text + '\n\n[' + code + ']');
      }
    } catch (e) {
      // A rejected callWS is the websocket refusing the command outright -
      // an unregistered type, or a key the schema was never told about
      // (RULE 33a.2). That is a different fault from a drawing that came
      // back unusable, and it now says so.
      console.error(e);
      const text = this.t('ai_icon_failed') || 'The assistant could not draw this item.';
      alert(text + '\n\n[' + ((e && (e.message || e.code)) || 'call_failed') + ']');
    } finally {
      this.setLoading(itemId, false);
      if (btn) btn.disabled = false;
    }
  }

};