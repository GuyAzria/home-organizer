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

// [ADDED v2026.8.26] HTML escaping for any value that reaches innerHTML.
//
// Item names, dates and barcode-scan results are user-controlled and can also
// come back from the AI agent, so interpolating them into a raw HTML string
// lets a name like <img src=x onerror=...> execute for anyone viewing the
// panel. Escaping the five significant characters covers both element-text
// and quoted-attribute contexts.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// [ADDED v2026.8.26] Safe renderer for AI assistant replies.
//
// The model's reply used to be turned into HTML directly, so any markup it
// produced executed in the dashboard. That is reachable without touching the
// chat: the agents read calendar entries and shopping-list items as context,
// so a prompt-injected item could make the model echo a payload back.
//
// The text is escaped FIRST, then the two intentional transforms (**bold**
// and newline to <br>) are applied to the already-escaped string. Formatting
// keeps working exactly as before; injected markup does not.
export function formatAiText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}

export const UtilsMixin = (Base) => class extends Base {

  escapeJSArg(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  getSafeIcon(val) {
    if (typeof val === 'string' && val.includes('<svg')) return val;
    return '';
  }

  getIconByKey(keyString) {
    if (!keyString) return ICONS.item;
    let searchItemName = "";

    if (keyString.startsWith('ICON_LIB_ITEM|')) {
      const parts = keyString.split('|');
      if (parts.length >= 4) {
        const [, mainCat, subCat, itemName] = parts;
        searchItemName = itemName;
        if (ICON_LIB_ITEM[mainCat]?.[subCat]?.[itemName]) return ICON_LIB_ITEM[mainCat][subCat][itemName];
      }
    } else if (keyString.startsWith('ICON_LIB_')) {
      const parts = keyString.split('_');
      if (parts.length >= 4) {
        const context = parts[2];
        const key = parts.slice(3).join('_');
        if (context === 'ROOM') return ICON_LIB_ROOM[key] || ICONS.folder;
        if (context === 'LOCATION') return ICON_LIB_LOCATION[key] || ICONS.folder;
        if (context === 'ITEM') searchItemName = key.includes('_') ? key.split('_').pop() : key;
      }
    }

    if (searchItemName) {
      for (const mCat of Object.keys(ICON_LIB_ITEM)) {
        if (mCat === '_icon') continue;
        for (const sCat of Object.keys(ICON_LIB_ITEM[mCat])) {
          if (sCat === '_icon') continue;
          if (ICON_LIB_ITEM[mCat][sCat][searchItemName]) return ICON_LIB_ITEM[mCat][sCat][searchItemName];
        }
      }
    }
    return ICONS.item;
  }

  stripMarkerForDisplay(text) {
    if (!text) return text;
    return text.replace(/\[?ORDER_MARKER_\d+\]?[_\s]*/g, '').trim();
  }

  toAlphaId(num) {
    let s = "";
    while (num > 0) {
      let rem = (num - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      num = Math.floor((num - 1) / 26);
    }
    return s || "A";
  }

  getPersistentID(scope, itemName) {
    if (!this.persistentIds[scope]) this.persistentIds[scope] = {};
    if (this.persistentIds[scope][itemName]) return this.persistentIds[scope][itemName];
    const used = Object.values(this.persistentIds[scope]).map(Number);
    let idx = 1;
    while (used.includes(idx)) idx++;
    this.persistentIds[scope][itemName] = idx;
    return idx;
  }

  resolveCatalogIdToPath(query) {
    const cleanQuery = query.trim().toUpperCase();
    const match = cleanQuery.match(/^([A-Z]+)(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    const [, alphaPart, locStr, subStr] = match;
    const locPart = parseInt(locStr, 10);
    const subPart = subStr ? parseInt(subStr, 10) : null;

    let roomNum = 0;
    for (let i = 0; i < alphaPart.length; i++) roomNum = roomNum * 26 + (alphaPart.charCodeAt(i) - 64);

    const rootIds = this.persistentIds['root'] || {};
    const roomName = Object.keys(rootIds).find(k => rootIds[k] === roomNum);
    if (!roomName) return null;
    const path = [roomName];

    const locIds = this.persistentIds[roomName] || {};
    const locName = Object.keys(locIds).find(k => locIds[k] === locPart);
    if (!locName) return null;
    path.push(locName);

    if (subPart !== null) {
      const subIds = this.persistentIds[`${roomName}_${locName}`] || {};
      const subName = Object.keys(subIds).find(k => subIds[k] === subPart);
      if (!subName) return null;
      path.push(subName);
    }
    return path;
  }

  resolveRealName(displayName) {
    if (!this.localData) return displayName;
    if (this.localData.folders) {
      const rx = new RegExp(`^ORDER_MARKER_\\d+_${displayName}$`);
      const found = this.localData.folders.find(f => f.name.match(rx));
      if (found) return found.name;
    }
    if (this.localData.items) {
      const rx = new RegExp(`^ORDER_MARKER_\\d+_${displayName}$`);
      const found = this.localData.items.find(i => i.sub_location?.match(rx));
      if (found) return found.sub_location;
    }
    return displayName;
  }

  playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = 800;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    } catch (e) { console.warn("Beep failed", e); }
  }

  fetchAllItems() {
    if (!this._hass) return;
    try {
      this._hass.callWS({ type: 'home_organizer/get_all_items' }).then(items => {
        this.allDbItems = items || [];
      });
    } catch (e) { console.error("Failed to fetch all items", e); }
  }

};
