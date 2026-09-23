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
// [FIXED v2026.9.22 | 2026-09-22] Purpose: A refresh put the user back on
//   the locations screen instead of the dashboard. isDashboardMode was a
//   view mode this file had never been told about - absent from initState,
//   from applyNavMode and from currentNavState - so the dashboard saved
//   itself as 'home' and came back as the old screen. It worked at all
//   only because an undefined property is falsy. applyNavMode now clears
//   it like the other eight, which is the half of RULE 33a.1 that had no
//   symptom yet: the one function whose job is to leave exactly one flag
//   true could not turn off a flag it did not name.
// [ADDED v2026.9.20 | 2026-09-20] Purpose: The panel remembers which screen
//   the user was on. A Home Assistant panel is destroyed on navigating away
//   and rebuilt from nothing on return, so answering a phone call dropped
//   the user at the front door with the whole path to walk again.
//   saveNavState records mode, open recipe, inventory path, shopping tab
//   and search text; restoreNavState puts them back. Kept in localStorage,
//   because a position is not user data: it is per device, costs no round
//   trip, and losing it costs nothing - every read and write is wrapped and
//   every failure ends at the home screen. applyNavMode sets all eight view
//   flags in ONE place, so a restored screen cannot leave two of them true
//   (RULE 33a.1). The barcode scanner is deliberately not restored.

// [ADDED v2026.9.20] Where the user was, kept between visits.
//
// A Home Assistant panel is destroyed when you navigate away from it and
// built again from nothing when you come back - so answering the phone, or
// glancing at another dashboard, dropped you back at the front door. This
// remembers the screen you were on and puts you back on it.
//
// localStorage, not the database: this is a position, not user data. It is
// per device, which is what "where I was on this phone" means, it costs no
// round trip on a screen that is already waiting for one, and losing it costs
// nothing at all - which is why every read and write here is wrapped and
// every failure ends at the home screen (RULE 31).
const NAV_KEY = 'home_organizer_nav';
// Bumped when the shape below changes, so an older saved position is ignored
// rather than half-read.
const NAV_VERSION = 1;

export const StateMixin = (Base) => class extends Base {

  // The eight view flags, set in one place so a restored mode cannot leave
  // two of them true - the failure RULE 33a.1 describes, which has shipped
  // three times in this project.
  //
  // The FAB handlers still set their own flags inline. They are not touched
  // here: changing them is a refactor nobody asked for (RULE 30), and this
  // function is only ever used to restore.
  applyNavMode(mode) {
    this.isRecipesMode  = mode === 'recipes';
    // [ADDED v2026.9.22] The dashboard is a view mode like the other eight
    // and was missing from all three places in this file. The visible cost
    // was that a refresh threw the user off the home screen and back onto
    // the locations view; the quieter one is the line below - this function
    // exists to leave exactly ONE flag true, and a flag it never touched
    // could not be turned off by it (RULE 33a.1).
    this.isDashboardMode = mode === 'dashboard';
    this.isReceiptsMode = mode === 'receipts';
    this.isReviewMode   = mode === 'review';
    this.isChatMode     = mode === 'chat';
    this.isShopMode     = mode === 'shop';
    this.isSearch       = mode === 'search';
    this.isStylistMode  = mode === 'stylist';
    this.isBarcodeMode  = false;   // never restored - see restoreNavState
  }

  currentNavState() {
    // The order mirrors the dispatch in renderView: whichever flag that
    // function would honour is the one recorded here, so a restore puts
    // back the screen that was actually on show.
    const mode =
        this.isRecipesMode  ? 'recipes'
      : this.isDashboardMode ? 'dashboard'
      : this.isReceiptsMode ? 'receipts'
      : this.isReviewMode   ? 'review'
      : this.isChatMode     ? 'chat'
      : this.isShopMode     ? 'shop'
      : this.isSearch       ? 'search'
      : this.isStylistMode  ? 'stylist'
      : this.isBarcodeMode  ? 'barcode'
      : 'home';
    let query = '';
    try {
      query = this.shadowRoot?.getElementById('search-input')?.value || '';
    } catch { query = ''; }
    return {
      v: NAV_VERSION,
      mode,
      // The open recipe, the inventory path, the shopping tab and the search
      // text: the four things that make one screen a different screen.
      recipeId: (this.openRecipe && this.openRecipe.id) || null,
      path: Array.isArray(this.currentPath) ? this.currentPath.slice(0, 8) : [],
      catalogPath: Array.isArray(this.catalogPath)
        ? this.catalogPath.slice(0, 8) : [],
      shopTab: this.shopTab || 'list',
      query: String(query).slice(0, 120),
    };
  }

  // Called from render(), which is the one place every change of screen
  // passes through - so no new screen can be added and forgotten here.
  // Written only when something actually moved: render runs on every keypress
  // in the chat, and localStorage writes are synchronous.
  saveNavState() {
    try {
      const json = JSON.stringify(this.currentNavState());
      if (json === this._navSaved) return;
      this._navSaved = json;
      localStorage.setItem(NAV_KEY, json);
    } catch {
      // Private browsing, a full quota, storage turned off. A forgotten
      // position is not worth interrupting anyone for.
    }
  }

  // Called once, after initUI has built the shell - it needs the search box
  // to exist - and before the first fetchData, which then loads the restored
  // path rather than the root.
  restoreNavState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(NAV_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (!saved || saved.v !== NAV_VERSION || typeof saved.mode !== 'string') {
      return;
    }

    // The barcode screen is a live camera, not a view. Coming back from a
    // phone call to a running scanner is a side effect nobody asked for, so
    // it restores to the home screen instead.
    const mode = saved.mode === 'barcode' ? 'home' : saved.mode;
    this.applyNavMode(mode);

    if (Array.isArray(saved.path)) this.currentPath = saved.path.slice(0, 8);
    if (Array.isArray(saved.catalogPath)) {
      this.catalogPath = saved.catalogPath.slice(0, 8);
    }
    if (saved.shopTab) this.shopTab = saved.shopTab;

    // Held for the cookbook to pick up once its list has loaded: the recipe
    // has to be fetched by id, and there is nothing to fetch it with yet.
    this._restoreRecipeId = (mode === 'recipes' && saved.recipeId)
      ? saved.recipeId : null;

    // The search box holds its own text - it is a DOM value, not state - so
    // putting the query back is what makes a restored search show results
    // rather than an empty list.
    if (mode === 'search' && saved.query) {
      try {
        const el = this.shadowRoot?.getElementById('search-input');
        if (el) el.value = saved.query;
      } catch {
        // Then it restores as an empty search, which is still a search.
      }
    }
  }


  initState() {
    this.currentPath = [];
    this.catalogPath = [];
    this.isEditMode = false;
    this.isSearch = false;
    this.isShopMode = false;
    this.isChatMode = false;
    this.isStylistMode = false;
    this.isReviewMode = false;
    // [ADDED v2026.9.22] It was never declared here at all, and worked only
    // because an undefined property is falsy. A flag this file does not know
    // about is a flag it cannot save or clear, which is exactly what went
    // wrong: see applyNavMode and currentNavState below.
    this.isDashboardMode = false;

    this.useExternalCamera = localStorage.getItem('ho_use_ext_camera') === 'true';

    this.shopTab = 'list';
    this.collapsedShopCats = new Set();
    this.collapsedShopSubCats = new Set();

    this.chatHistory = [];
    this.viewMode = 'list';
    this.expandedIdx = null;
    this.lastAI = "";
    this.localData = null;
    this.pendingItem = null;
    this.pendingItemId = null;
    this.pendingFolderIcon = null;
    this.useAiBg = true;
    this.expandedSublocs = new Set();
    this.subscribed = false;
    this.pickerContext = 'room';
    this.pickerMainCategory = null;
    this.pickerSubCategory = null;

    this.chatImage = null;
    this.chatMimeType = "image/jpeg";

    this.locationEditIds = new Set();
    this.locationEditState = {};

    this.translations = {};
    this.availableLangs = [];
    this.allDbItems = [];

    this.loadingSet = new Set();
    this.imageVersions = {};
    this.persistentIds = {};

    this.selectedItems = new Set();

    try {
      this.showIds = localStorage.getItem('home_organizer_show_ids') !== 'false';
    } catch {
      this.showIds = true;
    }

    this.currentLang = localStorage.getItem('home_organizer_lang') || 'en';
  }

  loadTranslations() {
    const timestamp = new Date().getTime();
    fetch(`/home_organizer_static/translations.csv?v=${timestamp}`)
      .then(r => { if (!r.ok) throw new Error("CSV not found"); return r.text(); })
      .then(text => this.parseCSV(text))
      .catch(err => {
        console.error("Failed to load translations:", err);
        this.availableLangs = ['en'];
        this.translations = { "_direction": { "en": "ltr" } };
        this.render();
      });
  }

  // [ADDED v2026.9.16] RFC-4180 field splitter.
  //
  // translations.csv is written with standard CSV quoting: a value containing
  // a comma is wrapped in double quotes, and a literal quote inside such a
  // value is doubled. The previous row.split(',') knew nothing about that, so
  // one comma inside a translated sentence pushed that value into the NEXT
  // language column, shifted every later language by one, and left a stray
  // quote on screen. Python's csv.reader already reads this same file
  // correctly in agents/shopping_agent.py; this brings the panel in line.
  //
  // The scan runs over the whole text rather than line by line, because a
  // quoted value may legitimately contain a newline, and splitting on
  // newlines first would tear such a record in half.
  parseCsvRows(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"') {
          // A doubled quote is one literal quote; a single one ends the field.
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else if (c !== '\r') {
          field += c;
        }
        continue;
      }

      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== '\r') field += c;
    }
    // The last record has no trailing newline to close it.
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  parseCSV(csvText) {
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
    const rows = this.parseCsvRows(csvText);
    if (rows.length < 2) return;

    const headers = rows[0].map(h => h.trim());
    this.availableLangs = headers.slice(1);
    this.translations = {};

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const key = (cols[0] || "").trim();
      if (!key) continue;
      if (!this.translations[key]) this.translations[key] = {};
      for (let j = 1; j < headers.length; j++) {
        this.translations[key][headers[j]] = (cols[j] || "").trim();
      }
    }

    // Fallback keys
    const fb = (k, v) => { if (!this.translations[k]) this.translations[k] = v; };
    fb('duplicate', { en: "Duplicate", he: "שכפל", it: "Duplica", es: "Duplicar", fr: "Dupliquer", ar: "تكرار" });
    fb('review_tab', { en: "AI Exports", he: "ייצוא AI", it: "Esportazioni AI", es: "Exportaciones de IA", fr: "Exportations IA", ar: "صادرات الذكاء الاصطناعي" });
    fb('reject',     { en: "Reject", he: "דחה", it: "Rifiuta", es: "Rechazar", fr: "Rejeter", ar: "رفض" });
    fb('confirm',    { en: "Confirm", he: "אישור", it: "Conferma", es: "Confirmar", fr: "Confirmer", ar: "تأكيد" });
    fb('stylist',    { en: "Stylist", he: "סטייליסט", it: "Stilista", es: "Estilista", fr: "Styliste", ar: "مصمم أزياء" });

    this.changeLanguage(this.currentLang);
  }

  t(key, ...args) {
    if (!this.translations[key])
      return key.replace(/^cat_|^sub_|^unit_|^zone_|^item_/, '').replace(/_/g, ' ');
    let text = this.translations[key][this.currentLang] || this.translations[key]['en'] || key;
    args.forEach((arg, i) => { text = text.replace(`{${i}}`, arg); });
    return text;
  }

  changeLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('home_organizer_lang', lang);
    const dir = this.translations?._direction?.[lang] || 'ltr';
    const app = this.shadowRoot.getElementById('app');
    app.style.direction = dir;
    if (dir === 'ltr') app.classList.add('ltr'); else app.classList.remove('ltr');
    const dropdown = this.shadowRoot.getElementById('setup-dropdown-menu');
    if (dropdown) dropdown.style.direction = dir;
    this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
    this.applyStaticTranslations();
    this.render();
  }

  setTheme(mode) {
    const app = this.shadowRoot.getElementById('app');
    if (mode === 'light') app.classList.add('light-mode');
    else app.classList.remove('light-mode');
    localStorage.setItem('home_organizer_theme', mode);
    this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
  }

  showMenu(menuId) {
    ['main', 'lang', 'theme'].forEach(id => {
      const el = this.shadowRoot.getElementById(`menu-${id}`);
      if (el) el.style.display = 'none';
    });
    const target = this.shadowRoot.getElementById(`menu-${menuId}`);
    if (target) target.style.display = 'block';
  }

  showAbout() {
    this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
    this.shadowRoot.getElementById('about-modal').style.display = 'flex';
  }

  // [ADDED v7.7.55 | 2026-04-07] Purpose: Shows the External Camera App setup modal and closes the setup dropdown.
  showExternalAppSetup() {
    this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
    this.shadowRoot.getElementById('ext-app-modal').style.display = 'flex';
  }

  toggleIds() {
    this.showIds = !this.showIds;
    localStorage.setItem('home_organizer_show_ids', this.showIds);
    const app = this.shadowRoot.getElementById('app');
    if (this.showIds) app.classList.remove('hide-catalog-ids');
    else app.classList.add('hide-catalog-ids');
    const btn = this.shadowRoot.getElementById('btn-toggle-ids');
    if (btn) btn.style.color = this.showIds ? 'var(--catalog-bg)' : 'var(--primary)';
  }

  toggleExternalCamera() {
    this.useExternalCamera = !this.useExternalCamera;
    localStorage.setItem('ho_use_ext_camera', this.useExternalCamera);
    const cb = this.shadowRoot.getElementById('ext-cam-checkbox');
    if (cb) cb.checked = this.useExternalCamera;
  }

  toggleWhiteBG() {
    this.useAiBg = !this.useAiBg;
    const btn = this.shadowRoot.getElementById('btn-cam-wb');
    if (this.useAiBg) btn.classList.add('active'); else btn.classList.remove('active');
  }

  setShopTab(tab) {
    this.shopTab = tab;
    this.render();
  }

  setLoading(target, state) {
    if (state) this.loadingSet.add(target); else this.loadingSet.delete(target);
    this.render();
  }

  refreshImageVersion(target) {
    this.imageVersions[target] = Date.now();
  }

  clearSearchInput() {
    const el = this.shadowRoot.getElementById('search-input');
    if (el) el.value = '';
  }

  toggleItemSelection(id, isChecked) {
    const numId = Number(id);
    if (isChecked) this.selectedItems.add(numId); else this.selectedItems.delete(numId);
    this.render();
  }

};