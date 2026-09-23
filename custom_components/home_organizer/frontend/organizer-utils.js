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
// [MODIFIED v2026.9.22 | 2026-09-22] Purpose: localeTag maps the panel
//   language onto a BCP-47 tag, in ONE place. view-recipes had the table
//   for the speech engines and the dashboard was about to grow a second
//   one for month names and money; two copies drift and then one language
//   formats its dates in another's (RULE 33d).
// [ADDED v2026.9.22 | 2026-09-22] Purpose: folderIcon decides what a folder
//   tile shows - photo, then drawing, then library key, then the plain
//   folder. The two loops in view-inventory.js each had their own copy of
//   that order, which is the shape RULE 33a.6 warns about.

import { ICONS, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=6.6.10';
// [ADDED v2026.9.20] Item icons the assistant designed, drawn from the
// spec it sent. See item-icon.js for why they carry no background and
// inherit their colour.
import { itemIconFromSpec } from './item-icon.js?v=2026.9.22';

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

  // [ADDED v2026.9.22] The panel language as a BCP-47 tag.
  //
  // Everything that formats a number, a date or a month name needs one, and
  // so do the speech engines. There was already a table of these inside
  // view-recipes for the voice; a second copy for the dashboard is how one
  // of them ends up with six entries and the other with seven (RULE 33d).
  //
  // Anything unknown falls back to en-US rather than to the raw code:
  // Intl will accept a two-letter tag, but the region is what decides the
  // date order and the digits, and guessing the region is worse than
  // being plainly English.
  localeTag() {
    const MAP = { he: 'he-IL', en: 'en-US', it: 'it-IT', es: 'es-ES',
                  fr: 'fr-FR', ar: 'ar-SA', ru: 'ru-RU' };
    return MAP[this.currentLang] || 'en-US';
  }

  escapeJSArg(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  getSafeIcon(val) {
    if (typeof val === 'string' && val.includes('<svg')) return val;
    return '';
  }

  // [ADDED v2026.9.20] The icon for one item, in one place.
  //
  // Seven render sites worked this out for themselves, each with its own
  // copy of "library key or photograph". A drawn icon is a third possibility
  // and adding it to seven places is how the second one ended up subtly
  // different in some of them (RULE 33a.6).
  //
  // The order is: a photograph the user chose, then an icon the assistant
  // drew for THIS item, then the nearest thing from the shipped library,
  // then the plain default. Each step is more specific to this item than
  // the next.
  //
  // What comes back is markup, and it is injected with innerHTML like every
  // other icon here. A drawn icon was built by this panel from a checked
  // spec and passed through emblem_sanitizer before it was stored, which is
  // the same gate a recipe emblem goes through (RULE 15).
  getItemIcon(item) {
    const drawn = this.drawnItemIcon(item);
    if (drawn) return drawn;
    return this.getIconByKey(item && item.img) || ICONS.item;
  }

  // The icon the assistant designed for this item, built here from the spec
  // it sent, or '' when there is none or it draws nothing.
  //
  // The SPEC is what was stored, not the picture. It was rebuilt field by
  // field before it was written, and every value is coerced again on the way
  // through spec-draw.js - so neither end of this trusts the other, and the
  // markup is written by us both times (RULE 7, RULE 11, RULE 15).
  drawnItemIcon(item) {
    const raw = item && item.icon_spec;
    if (!raw) return '';
    let spec = raw;
    if (typeof raw === 'string') {
      try {
        spec = JSON.parse(raw);
      } catch (e) {
        // A row that cannot be parsed simply has no drawn icon. The item
        // still has its library icon and its default behind it.
        return '';
      }
    }
    return itemIconFromSpec(spec);
  }

  // Is this item showing a PHOTOGRAPH rather than an icon? A library key
  // lives in the same field, so the two are told apart by its prefix.
  itemHasPhoto(item) {
    const img = item && item.img;
    return !!img && !String(img).startsWith('ICON_LIB');
  }

  // [ADDED v2026.9.22] What a folder tile shows, decided in ONE place.
  //
  // The two folder loops in view-inventory.js each carried their own copy of
  // this, and adding the drawn branch to one and not the other is exactly
  // the shape RULE 33a.6 warns about - it has already cost this project a
  // screen that showed nothing.
  //
  // Same order of preference as an item: a photograph the user chose, then a
  // drawing the assistant designed, then the shipped library key, then the
  // plain folder. `key` is what the loading spinner and the cache-buster are
  // filed under, which differs between the two callers.
  folderIcon(folder, key) {
    const drawn = this.drawnItemIcon(folder);
    const img = folder && folder.img;
    if (img && !String(img).startsWith('ICON_LIB')) {
      const cleanPath = String(img).split('?')[0];
      const ver = this.imageVersions[key] || 'ok';
      const loader = this.loadingSet.has(key)
        ? '<div class="loader-container"><span class="loader"></span></div>' : '';
      return `<div style="position:relative;width:100%;height:100%">`
        + `<img src="${escapeHtml(cleanPath)}?v=${escapeHtml(ver)}" `
        + `style="width:100%;height:100%;object-fit:contain;">${loader}</div>`;
    }
    if (drawn) return drawn;
    if (img) return this.getIconByKey(img);
    return ICONS.folder;
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
    // [MODIFIED v2026.9.21] Also strip ZONE markers and any leftover brackets.
    //
    // The old pattern only caught ORDER_MARKER, so a name like
    // "מקרר מדף תחתון [ORDER_MARKER_040]" was cleaned but "[קומה א] מטבח"
    // was not, and the raw zone prefix appeared in the dropdowns.
    return String(text)
      .replace(/\[?\s*(?:ORDER_MARKER|ZONE_MARKER)_\d+\s*\]?[_\s]*/g, '')
      // A zone prefix the user wrote themselves, e.g. "[קומה א] מטבח".
      .replace(/^\s*\[[^\]]*\]\s*/, '')
      .replace(/\s*\[[^\]]*\]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // [ADDED v2026.9.21] Currency symbols.
  //
  // A three-letter code is what the database stores, because a symbol is
  // ambiguous - $ is USD, CAD and AUD - but the symbol is what a person reads
  // at a glance. So the code stays the stored value and the symbol is only a
  // display concern.
  //
  // Anything not in this table falls back to the code itself rather than to a
  // generic sign, because "PLN" tells the user more than "¤".
  currencySymbol(code) {
    const SYMBOLS = {
      USD:'$', ILS:'\u20AA', EUR:'\u20AC', GBP:'\u00A3', JPY:'\u00A5', CNY:'\u00A5',
      RUB:'\u20BD', INR:'\u20B9', KRW:'\u20A9', TRY:'\u20BA', SAR:'\uFDFC',
      VND:'\u20AB', PHP:'\u20B1', UAH:'\u20B4', GHS:'\u20B5', KZT:'\u20B8',
      AZN:'\u20BC', GEL:'\u20BE', BTC:'\u20BF', KGS:'\u20C0', AMD:'\u058F',
      NGN:'\u20A6', PYG:'\u20B2', CRC:'\u20A1', LAK:'\u20AD', MNT:'\u20AE',
      THB:'\u0E3F', BRL:'R$', CHF:'CHF', CAD:'$', AUD:'$', PLN:'z\u0142',
      SEK:'kr', NOK:'kr', DKK:'kr', CZK:'K\u010D', HUF:'Ft', MXN:'$', ZAR:'R',
    };
    const key = String(code || '').trim().toUpperCase();
    return SYMBOLS[key] || key || '';
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