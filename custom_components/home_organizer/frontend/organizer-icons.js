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

import { ICONS, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=6.6.10';
import { ITEM_CATEGORIES } from './organizer-data.js?v=6.6.10';

export const IconsMixin = (Base) => class extends Base {

  openIconPicker(target, context) {
    if (context === 'item') {
      this.pendingItemId = target;
      this.pendingFolderIcon = null;
      let currentCat = null, currentSub = null;
      const item = (this.localData?.items || []).find(i => i.id == target)
                || (this.localData?.shopping_list || []).find(i => i.id == target)
                || (this.localData?.pending_list || []).find(i => i.id == target);
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
          if (this.pickerSubCategory && ITEM_CATEGORIES[this.pickerMainCategory]?.[this.pickerSubCategory])
            newUnit = ITEM_CATEGORIES[this.pickerMainCategory][this.pickerSubCategory];
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

};
