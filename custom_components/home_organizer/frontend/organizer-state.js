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
// [MODIFIED v7.7.56 | 2026-04-20] Purpose: Removed obsolete adjustShopQty method and shopQuantities state object. The shopping list qty is now persisted directly to DB via updateOrderQty (see organizer-api.js v7.7.50), so the transient client-side counter is no longer needed.
// [ADDED v7.7.55 | 2026-04-07] Purpose: Added showExternalAppSetup method to display the new dedicated Android App setup modal.

export const StateMixin = (Base) => class extends Base {

  initState() {
    this.currentPath = [];
    this.catalogPath = [];
    this.isEditMode = false;
    this.isSearch = false;
    this.isShopMode = false;
    this.isChatMode = false;
    this.isStylistMode = false;
    this.isReviewMode = false;

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

  parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return;
    let headerLine = lines[0].trim();
    if (headerLine.charCodeAt(0) === 0xFEFF) headerLine = headerLine.substr(1);
    const headers = headerLine.split(',').map(h => h.trim());
    this.availableLangs = headers.slice(1);
    this.translations = {};

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].trim();
      if (!row) continue;
      const cols = row.split(',');
      const key = cols[0].trim();
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