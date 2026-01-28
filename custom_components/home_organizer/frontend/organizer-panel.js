// Home Organizer Ultimate - Ver 6.2.8 (Fixed Camera ID Logic)
// License: MIT

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=5.6.4';

const ITEM_CATEGORIES = {
  "Food": { "Fresh Produce": "Kg", "Meat & Fish": "Kg", "Dairy": "Liter", "Dry Goods": "Kg", "Frozen Food": "Kg", "Beverages": "Liter", "Snacks": "Units", "Spices & Herbs": "g", "Oils & Sauces": "Liter", "Canned Food": "Units" },
  "Clothing": { "Tops": "Units", "Bottoms": "Units", "Outerwear": "Units", "Shoes": "Units", "Underwear": "Units", "Accessories": "Units", "Workwear": "Units", "Sportswear": "Units" },
  "Furniture": { "Seating": "Units", "Tables": "Units", "Storage Furniture": "Units", "Beds": "Units", "Shelving": "Units", "Outdoor Furniture": "Units" },
  "Electronics": { "Computing Devices": "Units", "Mobile Devices": "Units", "Audio Equipment": "Units", "Video Equipment": "Units", "Networking": "Units", "Accessories": "Units", "Batteries": "Units" },
  "Tools": { "Hand Tools": "Units", "Power Tools": "Units", "Measuring Tools": "Units", "Cutting Tools": "Units", "Workshop Equipment": "Units" },
  "Cleaning Supplies": { "Liquid Cleaners": "Liter", "Powders & Tablets": "Kg", "Tools & Brushes": "Units", "Paper Products": "Units", "Disinfectants": "Liter" },
  "Stationery": { "Writing Tools": "Units", "Paper Products": "Units", "Office Accessories": "Units", "Printing Supplies": "Units", "Filing & Storage": "Units" },
  "Storage & Organization": { "Boxes & Bins": "Units", "Shelving Containers": "Units", "Bags & Covers": "Units", "Drawer Organizers": "Units" },
  "Personal Care": { "Skin Care": "ml", "Hair Care": "ml", "Oral Care": "Units", "Grooming Tools": "Units", "Cosmetics": "Units" },
  "Health & Medical": { "Medications": "Units", "Supplements": "Units", "First Aid": "Units", "Medical Devices": "Units", "Hygiene Protection": "Units" },
  "Hardware": { "Fasteners": "Units", "Pipes & Fittings": "Units", "Electrical Parts": "Units", "Building Materials": "Kg", "Adhesives & Sealants": "ml" },
  "Garden": { "Plants": "Units", "Seeds": "g", "Soil & Compost": "Liter", "Fertilizers": "Kg", "Irrigation": "Units", "Garden Tools": "Units", "Pots & Planters": "Units", "Mulch & Ground Cover": "Liter", "Pest Control": "ml" },
  "Appliances": { "Kitchen Appliances": "Units", "Laundry Appliances": "Units", "Climate Control": "Units", "Small Appliances": "Units" },
  "Lighting": { "Bulbs": "Units", "Lamps": "Units", "Outdoor Lighting": "Units", "Fixtures": "Units" },
  "Toys & Games": { "Children Toys": "Units", "Board Games": "Units", "Outdoor Games": "Units", "Educational Toys": "Units" },
  "Miscellaneous": { "Decorations": "Units", "Seasonal Items": "Units", "Collectibles": "Units", "Other": "Units" }
};

class HomeOrganizerPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.currentPath = [];
      this.catalogPath = []; 
      this.isEditMode = false;
      this.isSearch = false;
      this.isShopMode = false;
      this.viewMode = 'list'; 
      this.expandedIdx = null; 
      this.lastAI = "";
      this.localData = null; 
      this.pendingItem = null;
      this.pendingItemId = null; 
      this.useAiBg = true; 
      this.shopQuantities = {}; 
      this.expandedSublocs = new Set(); 
      this.subscribed = false;
      this.pickerContext = 'room'; 
      this.pickerCategory = null; 
      this.pickerPage = 0;
      this.pickerPageSize = 15;
      
      this.translations = {}; 
      this.availableLangs = [];
      this.allDbItems = []; // Store unique items for autocomplete

      try { 
          this.persistentIds = JSON.parse(localStorage.getItem('home_organizer_ids')) || {}; 
          this.showIds = localStorage.getItem('home_organizer_show_ids') !== 'false'; 
      } 
      catch { 
          this.persistentIds = {}; 
          this.showIds = true;
      }
      
      this.currentLang = localStorage.getItem('home_organizer_lang') || 'en';
      
      this.initUI();
      this.loadTranslations();
      this.fetchAllItems(); // Fetch items for autocomplete
    }

    if (this._hass && this._hass.connection && !this.subscribed) {
        this.subscribed = true;
        this._hass.connection.subscribeEvents((e) => this.fetchData(), 'home_organizer_db_update');
        this._hass.connection.subscribeEvents((e) => {
             if (e.data.mode === 'identify') { /* AI logic */ }
        }, 'home_organizer_ai_result');
        this.fetchData();
        // Refresh full list occasionally or on update
        this._hass.connection.subscribeEvents(() => this.fetchAllItems(), 'home_organizer_db_update');
    }
  }

  async fetchAllItems() {
      if (!this._hass) return;
      try {
          const items = await this._hass.callWS({ type: 'home_organizer/get_all_items' });
          this.allDbItems = items || [];
      } catch (e) { console.error("Failed to fetch all items", e); }
  }

  async loadTranslations() {
      try {
          const timestamp = new Date().getTime();
          const response = await fetch(`/home_organizer_static/translations.csv?v=${timestamp}`);
          if (!response.ok) throw new Error("CSV not found");
          const text = await response.text();
          this.parseCSV(text);
      } catch (err) {
          console.error("Failed to load translations:", err);
          this.availableLangs = ['en'];
          this.translations = { "_direction": { "en": "ltr" } };
          this.render();
      }
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
              const langCode = headers[j];
              this.translations[key][langCode] = (cols[j] || "").trim();
          }
      }
      if (!this.translations['duplicate']) {
          this.translations['duplicate'] = { "en": "Duplicate", "he": "שכפל", "it": "Duplica", "es": "Duplicar", "fr": "Dupliquer", "ar": "تكرار" };
      }
      this.changeLanguage(this.currentLang);
  }

  t(key, ...args) {
      if (!this.translations[key]) return key.replace(/^cat_|^sub_|^unit_/, '').replace(/_/g, ' '); 
      let text = this.translations[key][this.currentLang] || this.translations[key]['en'] || key;
      args.forEach((arg, i) => { text = text.replace(`{${i}}`, arg); });
      return text;
  }
  
  getPersistentID(scope, itemName) {
      if (!this.persistentIds[scope]) this.persistentIds[scope] = {};
      if (this.persistentIds[scope][itemName]) return this.persistentIds[scope][itemName];
      const used = Object.values(this.persistentIds[scope]).map(Number);
      let idx = 1;
      while (used.includes(idx)) { idx++; }
      this.persistentIds[scope][itemName] = idx;
      localStorage.setItem('home_organizer_ids', JSON.stringify(this.persistentIds));
      return idx;
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

  async fetchData() {
      if (!this._hass) return;
      try {
          const data = await this._hass.callWS({
              type: 'home_organizer/get_data',
              path: this.currentPath,
              search_query: this.shadowRoot.getElementById('search-input')?.value || "",
              date_filter: "All",
              shopping_mode: this.isShopMode
          });
          this.localData = data;
          this.updateUI();
      } catch (e) { console.error("Fetch error", e); }
  }

  initUI() {
    this.content = true;
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host { 
            --primary: #03a9f4; --accent: #4caf50; --danger: #f44336; --warning: #ffeb3b; --icon-btn-bg: #444;
            --bg-body: #1c1c1e; --bg-bar: #242426; --bg-sub-bar: #2a2a2c;
            --bg-card: #2c2c2e; --bg-card-hover: #3a3a3c;
            --bg-input: #111; --bg-input-edit: #222;
            --bg-dropdown: #2c2c2e; --bg-qty-ctrl: #222;
            --text-main: #fff; --text-sub: #aaa;
            --border-color: #333; --border-light: #444; --border-input: #333;
            --bg-badge: #444; --text-badge: #fff;
            --bg-icon-box: #3c4043; --text-icon-box: #8ab4f8;
            --catalog-bg: #ff9800; --catalog-text: #fff;
        }
        .light-mode {
            --bg-body: #f5f5f5; --bg-bar: #ffffff; --bg-sub-bar: #f0f0f0;
            --bg-card: #ffffff; --bg-card-hover: #f9f9f9;
            --bg-input: #ffffff; --bg-input-edit: #ffffff;
            --bg-dropdown: #ffffff; --bg-qty-ctrl: #e0e0e0;
            --text-main: #333; --text-sub: #666;
            --border-color: #ddd; --border-light: #ccc; --border-input: #ccc;
            --icon-btn-bg: #e0e0e0;
            --bg-badge: #e0e0e0; --text-badge: #000000;
            --bg-icon-box: #e0e0e0; --text-icon-box: #03a9f4;
        }
        * { box-sizing: border-box; }
        .app-container { background: var(--bg-body); color: var(--text-main); height: 100vh; display: flex; flex-direction: column; font-family: sans-serif; }
        svg { width: 24px; height: 24px; fill: currentColor; }
        .top-bar { background: var(--bg-bar); padding: 10px; border-bottom: 1px solid var(--border-color); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; height: 60px; position: relative; }
        .sub-bar { background: var(--bg-sub-bar); height: 30px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .sub-bar-left { display: flex; align-items: center; gap: 10px; }
        .sub-bar-right { display: flex; align-items: center; gap: 10px; }
        .nav-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .nav-btn:hover { background: rgba(125,125,125,0.1); }
        .nav-btn.active { color: var(--warning); }
        .nav-btn.edit-active { color: var(--accent); } 
        .sub-bar .nav-btn { padding: 4px; }
        .sub-bar .nav-btn svg { width: 20px; height: 20px; }
        .setup-wrapper { position: relative; display: flex; align-items: center; }
        .setup-dropdown { position: absolute; top: 50px; inset-inline-start: 0; background: var(--bg-dropdown); border: 1px solid var(--border-color); border-radius: 8px; display: none; flex-direction: column; min-width: 180px; z-index: 3000; box-shadow: 0 8px 16px rgba(0,0,0,0.3); overflow: hidden; }
        .setup-dropdown.show { display: flex; }
        .dropdown-item { padding: 12px 15px; cursor: pointer; color: var(--text-main); font-size: 14px; text-align: start; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: flex-start; gap: 10px; }
        .dropdown-item:hover { background: var(--primary); color: white; }
        .dropdown-item:last-child { border-bottom: none; }
        .dropdown-item svg { width: 18px; height: 18px; opacity: 0.8; }
        .back-btn { font-weight: bold; color: var(--primary); }
        .back-btn:hover { color: white; }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: var(--text-sub); direction: ltr; } 
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; position: relative; }
        .folder-item.dragging { opacity: 0.4; transform: scale(0.9); transition: all 0.2s ease; border: 1px dashed var(--primary); border-radius: 12px; }
        .android-folder-icon { width: 56px; height: 56px; background: var(--bg-icon-box); color: var(--text-icon-box); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; overflow: visible; }
        .android-folder-icon svg { width: 34px; height: 34px; }
        .android-folder-icon img { width: 38px; height: 38px; object-fit: contain; border-radius: 4px; }
        .folder-delete-btn { position: absolute; top: -5px; inset-inline-end: -5px; background: var(--danger); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-edit-btn { position: absolute; top: -5px; inset-inline-start: -5px; background: var(--primary); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-edit-btn svg { width: 12px; height: 12px; }
        .folder-img-btn { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); background: #ff9800; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-img-btn svg { width: 12px; height: 12px; }
        .catalog-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: transparent; color: var(--catalog-bg); font-size: 14px; font-weight: 900; padding: 0; border: none; box-shadow: none; z-index: 20; direction: ltr; unicode-bidi: isolate; pointer-events: none; }
        .hide-catalog-ids .catalog-badge { display: none !important; }
        .catalog-id-text { font-size: 13px; color: var(--catalog-bg); font-weight: bold; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: var(--text-sub); font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid var(--border-light); padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; min-height: 35px; cursor: pointer; }
        .group-separator:hover { background: rgba(125,125,125,0.05); }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); background: rgba(3, 169, 244, 0.1); }
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        .edit-subloc-btn { background: none; border: none; color: var(--text-sub); cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }
        .delete-subloc-btn { background: none; border: none; color: var(--danger); cursor: pointer; padding: 4px; }
        .arrow-btn { background: none; border: none; color: var(--text-sub); cursor: pointer; padding: 4px; }
        .arrow-btn:hover { color: var(--warning); }
        .item-row { background: var(--bg-card); margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; touch-action: pan-y; }
        .item-row.expanded { background: var(--bg-card-hover); flex-direction: column; align-items: stretch; cursor: default; }
        .out-of-stock-frame { border: 2px solid var(--danger); }
        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; }
        .item-left { display: flex; align-items: center; gap: 10px; }
        .item-icon { color: var(--primary); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; }
        .item-thumbnail { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #000; display: block; border: 1px solid var(--border-light); }
        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: var(--bg-qty-ctrl); color: var(--text-main); padding: 4px; border-radius: 20px; }
        .qty-btn { background: var(--icon-btn-bg); border: none; color: var(--text-main); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .xl-grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 10px; }
        .xl-card { background: var(--bg-card); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; aspect-ratio: 1; position: relative; border: 1px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .xl-card:hover { background: var(--bg-card-hover); }
        .xl-icon-area { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; overflow: hidden; cursor: zoom-in; }
        .xl-icon-area svg { width: 48px; height: 48px; color: var(--primary); }
        .xl-icon-area img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
        .xl-badge { position: absolute; top: 8px; inset-inline-end: 8px; background: var(--bg-badge); color: var(--text-badge); border: 1px solid var(--border-light); min-width: 24px; height: 24px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; }
        .xl-info { width: 100%; text-align: center; margin-top: 8px; cursor: pointer; }
        .xl-name { font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; color: var(--text-main); }
        .xl-date { font-size: 10px; color: var(--text-sub); margin-top: 2px; }
        .add-folder-card .android-folder-icon { border: 2px dashed #4caf50; background: rgba(76, 175, 80, 0.1); color: #4caf50; }
        .add-folder-card:hover .android-folder-icon { background: rgba(76, 175, 80, 0.2); }
        .add-folder-input { width: 100%; height: 100%; border: none; background: transparent; color: white; text-align: center; font-size: 12px; padding: 5px; outline: none; }
        .text-add-btn { background: none; border: none; color: var(--primary); font-size: 14px; font-weight: bold; cursor: pointer; padding: 8px 0; display: flex; align-items: center; gap: 5px; opacity: 0.8; }
        .text-add-btn:hover { opacity: 1; text-decoration: underline; }
        .group-add-row { padding: 0 10px; margin-bottom: 15px; }
        .add-item-btn-row { width: 100%; margin-top: 10px; }
        .add-item-btn { width: 100%; padding: 12px; background: rgba(76, 175, 80, 0.15); border: 1px dashed #4caf50; color: #4caf50; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; transition: background 0.2s; }
        .add-item-btn:hover { background: rgba(76, 175, 80, 0.3); }
        .expanded-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 10px; }
        .detail-row { display: flex; gap: 10px; align-items: center; }
        .action-btn { width: 40px; height: 40px; border-radius: 8px; border: 1px solid var(--border-light); color: var(--text-sub); background: var(--icon-btn-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; }
        .action-btn:hover { background: var(--border-light); color: var(--text-main); }
        .btn-danger { color: #ff8a80; border-color: #d32f2f; }
        .btn-text { width: auto; padding: 0 15px; font-weight: bold; color: white; background: var(--primary); border: none; }
        .move-container { display: flex; gap: 5px; align-items: center; flex: 1; }
        .move-select { flex: 1; padding: 8px; background: var(--bg-input-edit); color: var(--text-main); border: 1px solid var(--border-light); border-radius: 6px; }
        .search-box { display:none; padding:10px; background:var(--bg-sub-bar); display:flex; gap: 5px; align-items: center; }
        
        .suggestions-box {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--bg-dropdown);
            border: 1px solid var(--border-light);
            border-radius: 4px;
            z-index: 10000; /* Increased to ensure visibility */
            max-height: 150px;
            overflow-y: auto;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            text-align: inherit; /* Align based on RTL/LTR */
            padding: 5px 0;
        }
        .suggestion-item {
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            gap: 10px;
            background: var(--bg-card); /* Ensure solid background */
            color: var(--text-main);
        }
        .suggestion-item:hover {
            background: var(--primary);
            color: white;
        }
        .suggestion-img {
            width: 30px; height: 30px; object-fit: cover; border-radius: 4px; border: 1px solid #444;
        }
        
        #icon-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2500; display: none; align-items: center; justify-content: center; flex-direction: column; }
        .modal-content { background: var(--bg-card); color:var(--text-main); width: 95%; max-width: 450px; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 15px; max-height: 90vh; overflow-y: auto; }
        .modal-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 5px; }
        .category-bar { display: none; gap: 10px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 10px; scrollbar-width: thin; scrollbar-color: var(--warning) transparent; }
        .category-bar::-webkit-scrollbar { height: 4px; }
        .category-bar::-webkit-scrollbar-thumb { background: var(--warning); border-radius: 2px; }
        .cat-btn { min-width: 65px; height: 65px; background: #333; border: 2px solid var(--warning); border-radius: 8px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; text-align: center; padding: 5px; flex-shrink: 0; transition: all 0.2s; }
        .cat-btn.active { background: var(--warning); color: #000; font-weight: bold; }
        .cat-btn svg { width: 24px; height: 24px; margin-bottom: 4px; }
        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px; min-height: 200px; }
        .lib-icon { background: #333; border-radius: 8px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; }
        .lib-icon:hover { background: #444; }
        .lib-icon svg { width: 32px; height: 32px; fill: #ccc; }
        .lib-icon span { font-size: 10px; color: #888; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 50px; text-align: center; }
        .pagination-ctrls { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 10px 0; border-top: 1px solid #444; }
        .page-btn { background: #444; color: white; border: none; border-radius: 4px; padding: 5px 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-info { font-size: 12px; color: #aaa; }
        .url-input-row { display: flex; gap: 10px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; }
        #camera-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 2000; display: none; flex-direction: column; align-items: center; justify-content: center; }
        #camera-video { width: 100%; height: 80%; object-fit: cover; }
        .camera-controls { height: 20%; width: 100%; display: flex; align-items: center; justify-content: center; gap: 30px; background: rgba(0,0,0,0.5); position: absolute; bottom: 0; }
        .snap-btn { width: 70px; height: 70px; border-radius: 50%; background: white; border: 5px solid #ccc; cursor: pointer; }
        .snap-btn.white-bg-active { background: #e3f2fd; border-color: var(--primary); }
        .close-cam-btn { color: white; background: none; border: none; font-size: 16px; cursor: pointer; }
        .wb-btn { color: #aaa; background: none; border: 2px solid #555; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-direction: column; font-size: 10px; }
        .wb-btn.active { color: #333; background: white; border-color: white; }
        .wb-btn svg { width: 24px; height: 24px; margin-bottom: 2px; }
        #camera-canvas { display: none; }
        .overlay { display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:2500;justify-content:center;align-items:center }
        #overlay-img { max-width: 50% !important; max-height: 35vh !important; border-radius: 8px; object-fit: contain; margin-bottom: 15px; display: none; border: 1px solid #444; }
        #overlay-icon-big { display: none; margin-bottom: 15px; color: white; }
        #overlay-icon-big svg { width: 60px; height: 60px; }
      </style>
      
      <div class="app-container" id="app">
        <!-- Main Top Bar (60px) -->
        <div class="top-bar">
            <div class="setup-wrapper">
                <button class="nav-btn" id="btn-user-setup">
                    <svg viewBox="0 0 24 24"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.35 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.47,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.53,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.35 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.53,18.67 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.47,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" /></svg>
                </button>
                <div class="setup-dropdown" id="setup-dropdown-menu">
                    <!-- Dynamic Menu Container -->
                    <div id="menu-main">
                        <div class="dropdown-item" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('lang')">
                            <svg viewBox="0 0 24 24"><path d="M12.87,15.07L10.33,12.56L10.36,12.53C12.1,10.59 13.34,8.36 14.07,6H17V4H11V2H9V4H2V6H4.18C4.87,8.8 6.13,11.23 7.82,13.23L4.25,16.8L5.66,18.21L9.24,14.65L12.87,18.73L12.87,15.07M18.5,10H16.5L12,22H14L15.12,19H19.87L20.98,22H22.97L18.5,10M15.88,17L17.5,12.67L19.12,17H15.88Z" /></svg>
                            ${this.t('language')}
                        </div>
                        <div class="dropdown-item" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('theme')">
                            <svg viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16Z" /></svg>
                            ${this.t('theme')}
                        </div>
                    </div>
                    <!-- Language Submenu (Dynamic) -->
                    <div id="menu-lang" style="display:none">
                        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
                           <svg viewBox="0 0 24 24"><path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" /></svg>
                           ${this.t('back')}
                        </div>
                        <!-- Languages injected here by renderMenu() -->
                    </div>
                    <!-- Theme Submenu -->
                    <div id="menu-theme" style="display:none">
                        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
                           <svg viewBox="0 0 24 24"><path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" /></svg>
                           ${this.t('back')}
                        </div>
                        <div class="dropdown-item" onclick="this.getRootNode().host.setTheme('light')">${this.t('light')}</div>
                        <div class="dropdown-item" onclick="this.getRootNode().host.setTheme('dark')">${this.t('dark')}</div>
                    </div>
                </div>
            </div>
            
            <div class="title-box">
                <div class="main-title" id="display-title">${this.t('app_title')}</div>
                <div class="sub-title" id="display-path">${this.t('default_path')}</div>
            </div>
            <div style="display:flex;gap:5px">
                <button class="nav-btn" id="btn-shop">${ICONS.cart}</button>
                <button class="nav-btn" id="btn-search">${ICONS.search}</button>
                <button class="nav-btn" id="btn-edit">${ICONS.edit}</button>
            </div>
        </div>

        <div class="sub-bar">
            <div class="sub-bar-right">
                <button class="nav-btn" id="btn-home">${ICONS.home}</button>
                <button class="nav-btn" id="btn-up" style="display:none;">${ICONS.arrow_up}</button>
            </div>
            <div class="sub-bar-left">
                <button class="nav-btn" id="btn-toggle-ids" title="Toggle IDs">
                    <svg viewBox="0 0 24 24"><path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3M17,18L12,15.82L7,18V5H17V18Z" /></svg>
                </button>
                <button class="nav-btn" id="btn-view-toggle" style="display:none;">
                   <svg id="icon-view-grid" viewBox="0 0 24 24" style="display:block"><path d="M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3"/></svg>
                   <svg id="icon-view-list" viewBox="0 0 24 24" style="display:none"><path d="M3,4H21V6H3M3,8H21V10H3M3,12H21V14H3M3,16H21V18H3M3,20H21V22H3"/></svg>
                </button>
            </div>
        </div>
        
        <div class="search-box" id="search-box">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" placeholder="${this.t('search_placeholder')}" style="width:100%;padding:8px;padding-inline-start:35px;border-radius:8px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border-input)">
                <button class="nav-btn ai-btn" id="btn-ai-search" style="position:absolute;inset-inline-start:0;top:0;height:100%;background:none;border:none;">
                    ${ICONS.camera}
                </button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button></div>
        
        <div class="content" id="content">
            <div style="text-align:center;padding:20px;color:#888;">${this.t('loading')}</div>
        </div>
      </div>
      
      <div id="icon-modal" onclick="this.style.display='none'">
          <div class="modal-content" onclick="event.stopPropagation()">
              <div class="modal-title">${this.t('change_icon')}</div>
              <div class="category-bar" id="picker-categories"></div>
              <div class="icon-grid" id="icon-lib-grid"></div>
              <div class="pagination-ctrls">
                  <button class="page-btn" id="picker-prev">${ICONS.arrow_up}</button>
                  <div class="page-info" id="picker-page-info">Page 1 of 1</div>
                  <button class="page-btn" id="picker-next" style="transform: rotate(180deg)">${ICONS.arrow_up}</button>
              </div>
              <div class="url-input-row">
                  <input type="text" id="icon-url-input" placeholder="${this.t('paste_url')}" style="flex:1;padding:8px;background:#111;color:white;border:1px solid #444;border-radius:4px">
                  <button class="action-btn" id="btn-load-url">${ICONS.check}</button>
              </div>
              <div style="text-align:center; margin-top:10px;">
                  <label class="action-btn" style="width:100%; display:flex; gap:10px; justify-content:center;">
                      ${ICONS.image} ${this.t('upload_file')}
                      <input type="file" id="icon-file-upload" accept="image/*" style="display:none">
                  </label>
              </div>
              <button class="action-btn" style="width:100%;margin-top:10px;background:#444" onclick="this.closest('#icon-modal').style.display='none'">${this.t('cancel')}</button>
          </div>
      </div>
      
      <div id="camera-modal">
          <video id="camera-video" autoplay playsinline muted></video>
          <div class="camera-controls">
              <button class="close-cam-btn" id="btn-cam-switch">${ICONS.refresh}</button>
              <button class="snap-btn" id="btn-cam-snap"></button>
              <button class="wb-btn active" id="btn-cam-wb" title="Toggle AI Background Removal">${ICONS.wand}<span>AI BG</span></button>
              <button class="close-cam-btn" id="btn-cam-close" style="position:absolute;top:-50px;right:20px;background:rgba(0,0,0,0.5);border-radius:50%;width:40px;height:40px">✕</button>
          </div>
          <canvas id="camera-canvas"></canvas>
      </div>

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'">
          <div style="display:flex;flex-direction:column;align-items:center;max-width:90%;max-height:90%;width:100%">
              <img id="overlay-img">
              <div id="overlay-icon-big">${ICONS.item}</div>
              <div id="overlay-details" style="color:white;text-align:center;background:#2a2a2a;padding:20px;border-radius:12px;width:100%;max-width:300px;box-shadow:0 4px 15px rgba(0,0,0,0.7);display:none;border:1px solid #444"></div>
          </div>
      </div>
    `;

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          console.warn("Camera access requires HTTPS.");
    }

    // --- AUTO-DETECT SETTINGS (First Time Only) ---
    
    // 1. Language Auto-Detect
    let currentLang = localStorage.getItem('home_organizer_lang');
    if (!currentLang && this._hass) {
        if (this._hass.language === 'he') {
            currentLang = 'he';
        } else {
            currentLang = 'en'; // Default to English for all other langs
        }
        localStorage.setItem('home_organizer_lang', currentLang);
    }
    
    // Apply Language Class
    if (currentLang === 'en') {
        this.shadowRoot.getElementById('app').classList.add('ltr');
    }

    // 2. Theme Auto-Detect
    let currentTheme = localStorage.getItem('home_organizer_theme');
    if (!currentTheme && this._hass) {
        currentTheme = (this._hass.themes && this._hass.themes.darkMode) ? 'dark' : 'light';
        localStorage.setItem('home_organizer_theme', currentTheme);
    }

    // Apply Theme Class
    if (currentTheme === 'light') {
        this.shadowRoot.getElementById('app').classList.add('light-mode');
    }
    
    // Apply ID Visibility Class based on stored setting
    if (!this.showIds) {
        this.shadowRoot.getElementById('app').classList.add('hide-catalog-ids');
    }

    this.bindEvents();
  }
  
  // NEW: Input Handler for Autocomplete
  handleNameInput(input, itemId) {
      const val = input.value.toLowerCase();
      // Use the closest positioned relative wrapper as the parent for the dropdown
      const parent = input.parentElement; 
      
      // Remove old suggestions
      const old = parent.querySelector('.suggestions-box');
      if(old) old.remove();

      if(val.length < 2) return;

      const matches = this.allDbItems.filter(i => i.name.toLowerCase().startsWith(val));
      if(matches.length === 0) return;

      const box = document.createElement('div');
      box.className = 'suggestions-box';
      
      // Limit to 5 suggestions
      matches.slice(0, 5).forEach(match => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          let imgHtml = '';
          if(match.image_path) {
              imgHtml = `<img src="${match.image_path}" class="suggestion-img">`;
          }
          div.innerHTML = `${imgHtml}<span>${match.name}</span>`;
          // Use mousedown to prevent blur from firing first
          div.onmousedown = (e) => {
              e.preventDefault(); // Prevent focus loss
              this.applySuggestion(itemId, match);
              box.remove();
          };
          box.appendChild(div);
      });
      
      parent.appendChild(box);
  }

  // NEW: Apply Suggestion Logic
  applySuggestion(itemId, match) {
      const nameInput = this.shadowRoot.getElementById(`name-${itemId}`);
      if(nameInput) nameInput.value = match.name;
      
      // Clean image path (strip prefix and params)
      let cleanPath = null;
      if (match.image_path) {
          cleanPath = match.image_path.split('?')[0].split('/').pop();
      }

      this.callHA('update_item_details', {
          item_id: itemId,
          original_name: nameInput.value,
          new_name: match.name,
          category: match.category,
          sub_category: match.sub_category,
          unit: match.unit,
          unit_value: match.unit_value,
          image_path: cleanPath
      });
      
      // Refresh UI to show new details
      setTimeout(() => this.fetchData(), 200); 
  }

  // Generate Menu Items Dynamically from Loaded CSV Headers
  renderMenu() {
      const menuLang = this.shadowRoot.getElementById('menu-lang');
      if (!menuLang) return;
      
      let html = `
        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
           <svg viewBox="0 0 24 24"><path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" /></svg>
           ${this.t('back')}
        </div>
      `;
      
      // If we have loaded languages, iterate them
      if (this.availableLangs && this.availableLangs.length > 0) {
          this.availableLangs.forEach(lang => {
              // Uppercase first letter for display, or use a map if preferred
              const display = lang.toUpperCase(); 
              html += `<div class="dropdown-item" onclick="this.getRootNode().host.changeLanguage('${lang}')">${display}</div>`;
          });
      } else {
           // Fallback if CSV failed
           html += `<div class="dropdown-item" onclick="this.getRootNode().host.changeLanguage('en')">English</div>`;
      }
      
      menuLang.innerHTML = html;
  }

  bindEvents() {
    const root = this.shadowRoot;
    const bind = (id, event, fn) => { const el = root.getElementById(id); if(el) el[event] = fn; };
    const click = (id, fn) => bind(id, 'onclick', fn);

    click('btn-user-setup', (e) => {
        e.stopPropagation();
        this.renderMenu(); // Re-render menu before showing
        const menu = root.getElementById('setup-dropdown-menu');
        this.showMenu('main'); // Always reset to main menu on open
        menu.classList.toggle('show');
    });

    window.addEventListener('click', () => {
        root.getElementById('setup-dropdown-menu')?.classList.remove('show');
    });
    
    const menu = root.getElementById('setup-dropdown-menu');
    if(menu) menu.onclick = (e) => e.stopPropagation();

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.isSearch = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.fetchData(); });
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    bind('search-input', 'oninput', (e) => this.fetchData());
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    click('btn-view-toggle', () => {
        this.viewMode = (this.viewMode === 'list') ? 'grid' : 'list';
        const gridIcon = root.getElementById('icon-view-grid');
        const listIcon = root.getElementById('icon-view-list');
        if (this.viewMode === 'grid') {
            gridIcon.style.display = 'none';
            listIcon.style.display = 'block';
        } else {
            gridIcon.style.display = 'block';
            listIcon.style.display = 'none';
        }
        this.render();
    });
    
    // Toggle IDs Event
    click('btn-toggle-ids', () => this.toggleIds());

    click('btn-paste', () => this.pasteItem());
    click('btn-load-url', () => {
        const url = root.getElementById('icon-url-input').value;
        if(url) this.handleUrlIcon(url);
    });
    bind('icon-file-upload', 'onchange', (e) => this.handleIconUpload(e.target));
    
    click('picker-prev', () => { if(this.pickerPage > 0) { this.pickerPage--; this.renderIconPickerGrid(); } });
    click('picker-next', () => { 
        const lib = this.getCurrentPickerLib();
        const maxPage = Math.ceil(Object.keys(lib).length / this.pickerPageSize) - 1;
        if(this.pickerPage < maxPage) { this.pickerPage++; this.renderIconPickerGrid(); } 
    });

    click('btn-ai-search', () => this.openCamera('search'));
    click('btn-cam-close', () => this.stopCamera());
    click('btn-cam-snap', () => this.snapPhoto());
    click('btn-cam-switch', () => this.switchCamera());
    click('btn-cam-wb', () => this.toggleWhiteBG());
  }
  
  toggleIds() {
      this.showIds = !this.showIds;
      localStorage.setItem('home_organizer_show_ids', this.showIds);
      const app = this.shadowRoot.getElementById('app');
      if (this.showIds) app.classList.remove('hide-catalog-ids');
      else app.classList.add('hide-catalog-ids');
      
      // Update button color
      const btn = this.shadowRoot.getElementById('btn-toggle-ids');
      if (btn) btn.style.color = this.showIds ? 'var(--catalog-bg)' : 'var(--primary)';
  }

  showMenu(menuId) {
      const root = this.shadowRoot;
      root.getElementById('menu-main').style.display = 'none';
      root.getElementById('menu-lang').style.display = 'none';
      root.getElementById('menu-theme').style.display = 'none';
      
      const target = root.getElementById(`menu-${menuId}`);
      if(target) target.style.display = 'block';
  }

  setTheme(mode) {
      const app = this.shadowRoot.getElementById('app');
      if(mode === 'light') {
          app.classList.add('light-mode');
      } else {
          app.classList.remove('light-mode');
      }
      localStorage.setItem('home_organizer_theme', mode);
      this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
  }

  changeLanguage(lang) {
      this.currentLang = lang;
      localStorage.setItem('home_organizer_lang', lang);
      
      // Update Direction
      const dir = (this.translations && this.translations['_direction'] && this.translations['_direction'][lang]) || 'ltr';
      const app = this.shadowRoot.getElementById('app');
      app.style.direction = dir;
      
      if (dir === 'ltr') app.classList.add('ltr'); else app.classList.remove('ltr');
      
      this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
      this.render(); // Re-render to update text
  }
  
  toggleWhiteBG() {
      this.useAiBg = !this.useAiBg;
      const btn = this.shadowRoot.getElementById('btn-cam-wb');
      if (this.useAiBg) btn.classList.add('active'); else btn.classList.remove('active');
  }

  async openCamera(context) {
      this.cameraContext = context;
      const modal = this.shadowRoot.getElementById('camera-modal');
      const video = this.shadowRoot.getElementById('camera-video');
      modal.style.display = 'flex';
      try {
          this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facingMode || "environment" } });
          video.srcObject = this.stream;
      } catch (err) {
          alert("Camera Error: " + err.message);
          modal.style.display = 'none';
      }
  }

  stopCamera() {
      const modal = this.shadowRoot.getElementById('camera-modal');
      const video = this.shadowRoot.getElementById('camera-video');
      if (this.stream) this.stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      modal.style.display = 'none';
  }

  async switchCamera() {
      this.facingMode = (this.facingMode === "user") ? "environment" : "user";
      this.stopCamera();
      setTimeout(() => this.openCamera(this.cameraContext), 200);
  }

  snapPhoto() {
      const video = this.shadowRoot.getElementById('camera-video');
      const canvas = this.shadowRoot.getElementById('camera-canvas');
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      if (this.useAiBg) {
          let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          let data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
              let r = data[i], g = data[i+1], b = data[i+2];
              if (r > 190 && g > 190 && b > 190) { data[i] = 255; data[i+1] = 255; data[i+2] = 255; }
          }
          context.putImageData(imageData, 0, 0);
      }
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      this.stopCamera();
      
      if (this.cameraContext === 'search') {
          this.callHA('ai_action', { mode: 'search', image_data: dataUrl });
      } else if (this.pendingItemId) {
          // --- FIX APPLIED HERE: Use pendingItemId if available ---
          this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
          this.pendingItemId = null;
      } else if (this.pendingItem) {
          // Fallback to legacy name-based update if needed
          this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
          this.pendingItem = null;
      }
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    
    // Update Title & Path
    root.getElementById('display-title').innerText = this.t('app_title');
    root.getElementById('display-path').innerText = 
        this.isShopMode ? this.t('shopping_list') : 
        (this.isSearch ? this.t('search_results') : 
        (attrs.path_display === "Main" ? this.t('default_path') : attrs.path_display));
        
    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');
    
    const editBtn = root.getElementById('btn-edit');
    if (editBtn) {
        if (this.isEditMode) editBtn.classList.add('edit-active');
        else editBtn.classList.remove('edit-active');
    }

    const content = root.getElementById('content');
    content.innerHTML = '';

    const upBtn = root.getElementById('btn-up');
    if (upBtn) {
        if (attrs.depth === 0) {
            upBtn.style.display = 'none';
        } else {
            upBtn.style.display = 'flex'; 
        }
    }

    const viewBtn = root.getElementById('btn-view-toggle');
    if (attrs.depth >= 2) viewBtn.style.display = 'block'; else viewBtn.style.display = 'none';
    
    // Toggle Button Logic (Hide at Level 3 / Depth >= 2)
    const toggleBtn = root.getElementById('btn-toggle-ids');
    if (toggleBtn) {
        if (attrs.depth >= 2) {
            toggleBtn.style.display = 'none';
        } else {
            toggleBtn.style.display = 'flex';
            toggleBtn.style.color = this.showIds ? 'var(--catalog-bg)' : 'var(--primary)';
        }
    }

    if (attrs.shopping_list && attrs.shopping_list.length > 0) {
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';
        const grouped = {};
        attrs.shopping_list.forEach(item => {
            const loc = item.main_location || "Other";
            if(!grouped[loc]) grouped[loc] = [];
            grouped[loc].push(item);
        });
        Object.keys(grouped).sort().forEach(locName => {
            const header = document.createElement('div');
            header.className = 'group-separator';
            header.innerText = locName;
            listContainer.appendChild(header);
            grouped[locName].forEach(item => listContainer.appendChild(this.createItemRow(item, true)));
        });
        content.appendChild(listContainer);
        return;
    }

    if ((this.isSearch || (attrs.path_display && attrs.path_display.startsWith('Search'))) && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

    // ROOM LEVEL (Depth 0) - WITH ZONE/FLOOR SUPPORT
    if (attrs.depth === 0) {
        const zoneContainer = document.createElement('div');
        zoneContainer.className = 'item-list';

        // 1. Identify Zones (Group rooms by prefix [ZoneName])
        const groupedRooms = {};
        const knownZones = new Set();
        
        // Regex to extract [Zone] Name
        const zoneRegex = /^\[(.*?)\] (.*)$/;
        // Regex for Zone Marker with Order: ZONE_MARKER_010_Floor1
        const markerRegex = /^ZONE_MARKER_(\d+)_+(.*)$/;

        const zonesList = []; // Array to store { name, order, markerName }

        if (attrs.folders) {
            attrs.folders.forEach(f => {
                let zone = "General Rooms";
                let displayName = f.name;

                // Check for explicit Zone Marker first
                if (f.name.startsWith("ZONE_MARKER_")) {
                    let zOrder = 9999;
                    let zName = f.name.replace("ZONE_MARKER_", "").trim();
                    
                    const match = f.name.match(markerRegex);
                    if (match) {
                        zOrder = parseInt(match[1]);
                        zName = match[2];
                    }
                    
                    if (zName) {
                        knownZones.add(zName);
                        zonesList.push({ name: zName, order: zOrder, markerName: f.name });
                    }
                    return; // Don't show marker as room
                }

                // Check for Prefix "[Zone] Name"
                const match = f.name.match(zoneRegex);
                if (match) {
                    zone = match[1];
                    displayName = match[2];
                } else if (f.zone) {
                    // Fallback to legacy zone property if available
                    zone = f.zone;
                }

                if (!groupedRooms[zone]) groupedRooms[zone] = [];
                
                // Store processed folder info
                groupedRooms[zone].push({
                    originalName: f.name,
                    displayName: displayName,
                    img: f.img
                });
            });
        }
        
        // Ensure empty zones (from markers) exist in list
        knownZones.forEach(z => { if (!groupedRooms[z]) groupedRooms[z] = []; });
        if (!groupedRooms["General Rooms"]) groupedRooms["General Rooms"] = [];

        // 2. Sort Zones based on Marker Order
        // First, add "General Rooms" if not in zonesList (it usually isn't)
        const hasGeneral = zonesList.find(z => z.name === "General Rooms");
        if (!hasGeneral && groupedRooms["General Rooms"].length > 0) {
            zonesList.push({ name: "General Rooms", order: -1, markerName: null }); // Always top
        }

        // Add any discovered zones from rooms that didn't have markers
        Object.keys(groupedRooms).forEach(z => {
            if (!zonesList.find(i => i.name === z)) {
                zonesList.push({ name: z, order: 9999, markerName: null });
            }
        });

        // Sort the list
        zonesList.sort((a, b) => a.order - b.order);

        // 3. Render Zones
        zonesList.forEach(zoneObj => {
            const zoneName = zoneObj.name;
            const rooms = groupedRooms[zoneName] || [];
            
            // Skip empty General Rooms if not editing
            if (zoneName === "General Rooms" && rooms.length === 0 && !this.isEditMode) return;

            // Zone Header - acts as drop target for rooms
            const header = document.createElement('div');
            header.className = 'group-separator';
            
            // Build Header Content with Edit/Delete/Reorder if in Edit Mode
            let headerContent = `<span>${this.t('zone_' + zoneName) === ('zone_' + zoneName) ? zoneName : this.t('zone_' + zoneName)}</span>`; // Try to translate zone name if possible (e.g., General Rooms)
            if (this.isEditMode && zoneName !== "General Rooms") {
                headerContent = `
                    <div style="display:flex;align-items:center;">
                        <span class="subloc-title">${zoneName}</span>
                    </div>
                    <div style="display:flex;gap:5px;align-items:center">
                        <button class="arrow-btn" onclick="event.stopPropagation(); this.getRootNode().host.moveZone('${zoneName}', -1)" title="Move Up">${ICONS.arrow_up}</button>
                        <button class="arrow-btn" onclick="event.stopPropagation(); this.getRootNode().host.moveZone('${zoneName}', 1)" style="transform:rotate(180deg)" title="Move Down">${ICONS.arrow_up}</button>
                        <div style="width:1px;height:15px;background:#444;margin:0 5px"></div>
                        <button class="edit-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableZoneRename(this, '${zoneName}')">${ICONS.edit}</button>
                        <button class="delete-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteZone('${zoneName}')">${ICONS.delete}</button>
                    </div>`;
            }
            header.innerHTML = headerContent;
            
            // Allow Drop ALWAYS (Requirement: drag and drop not in edit mode)
            this.setupZoneDropTarget(header, zoneName);
            zoneContainer.appendChild(header);

            // Room Grid for this Zone
            const grid = document.createElement('div');
            grid.className = 'folder-grid';
            
            rooms.forEach(folder => {
                // PERSISTENT ID
                const rawID = this.getPersistentID('root', folder.originalName);
                const catalogID = this.toAlphaId(rawID);

                const el = document.createElement('div');
                el.className = 'folder-item';
                
                // DRAG & DROP Support for Rooms - ENABLED ALWAYS for Zone Moving
                this.setupRoomDragSource(el, folder.originalName);

                // Pass the generated ID to navigate
                el.onclick = () => { if (!this.isEditMode) this.navigate('down', folder.originalName, catalogID); };
                
                let folderContent = ICONS.folder;
                if (folder.img) folderContent = `<img src="${folder.img}">`;

                const deleteBtnHtml = this.isEditMode ? `<div class="folder-delete-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteFolder('${folder.originalName}')">✕</div>` : '';
                const editBtnHtml = this.isEditMode ? `<div class="folder-edit-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableFolderRename(this.closest('.folder-item').querySelector('.folder-label'), '${folder.originalName}')">${ICONS.edit}</div>` : '';
                const imgBtnHtml = this.isEditMode ? `<div class="folder-img-btn" onclick="event.stopPropagation(); this.getRootNode().host.openIconPicker('${folder.originalName}', 'room')">${ICONS.image}</div>` : '';

                el.innerHTML = `
                    <div class="android-folder-icon">
                        ${folderContent}
                        <div class="catalog-badge">${catalogID}</div>
                        ${editBtnHtml}${deleteBtnHtml}${imgBtnHtml}
                    </div>
                    <div class="folder-label">${folder.displayName}</div>
                `;
                grid.appendChild(el);
            });

            // Add room specifically to this zone button (INLINE INPUT)
            if (this.isEditMode) {
                const addBtn = document.createElement('div');
                addBtn.className = 'folder-item add-folder-card';
                addBtn.innerHTML = `<div class="android-folder-icon">${ICONS.plus}</div><div class="folder-label">${this.t('add_room')}</div>`;
                addBtn.onclick = (e) => this.enableZoneRoomInput(e.currentTarget, zoneName);
                grid.appendChild(addBtn);
            }

            zoneContainer.appendChild(grid);
        });

        // Global Edit Mode Options for Zone Management (No Popup - Instant Add)
        if (this.isEditMode) {
            const addZoneBtn = document.createElement('button');
            addZoneBtn.className = 'add-item-btn';
            addZoneBtn.style.marginTop = '20px';
            addZoneBtn.innerHTML = this.t('add_zone_btn');
            addZoneBtn.onclick = () => this.createNewZone();
            zoneContainer.appendChild(addZoneBtn);
        }

        content.appendChild(zoneContainer);
        return;
    }

    if (attrs.depth < 2) {
        if (attrs.folders && attrs.folders.length > 0 || this.isEditMode) {
            const grid = document.createElement('div');
            grid.className = 'folder-grid';
            
            // Current ID Parent (e.g., "A" if inside Kitchen)
            const parentID = this.catalogPath[0] || "";

            if (attrs.folders) {
                attrs.folders.forEach(folder => {
                    // PERSISTENT ID
                    const rawID = this.getPersistentID(this.currentPath[0], folder.name);
                    const catalogID = parentID + rawID;

                    const el = document.createElement('div');
                    el.className = 'folder-item';
                    
                    // Pass the generated ID to navigate
                    el.onclick = () => this.navigate('down', folder.name, catalogID);
                    
                    let folderContent = ICONS.folder;
                    if (folder.img) folderContent = `<img src="${folder.img}">`;

                    const deleteBtnHtml = this.isEditMode ? `<div class="folder-delete-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteFolder('${folder.name}')">✕</div>` : '';
                    const editBtnHtml = this.isEditMode ? `<div class="folder-edit-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableFolderRename(this.closest('.folder-item').querySelector('.folder-label'), '${folder.name}')">${ICONS.edit}</div>` : '';
                    const context = attrs.depth === 0 ? 'room' : 'location';
                    const imgBtnHtml = this.isEditMode ? `<div class="folder-img-btn" onclick="event.stopPropagation(); this.getRootNode().host.openIconPicker('${folder.name}', '${context}')">${ICONS.image}</div>` : '';

                    el.innerHTML = `
                        <div class="android-folder-icon">
                            ${folderContent}
                            <div class="catalog-badge">${catalogID}</div>
                            ${editBtnHtml}${deleteBtnHtml}${imgBtnHtml}
                        </div>
                        <div class="folder-label">${folder.name}</div>
                    `;
                    grid.appendChild(el);
                });
            }
            if (this.isEditMode) {
                const addBtn = document.createElement('div');
                addBtn.className = 'folder-item add-folder-card';
                addBtn.innerHTML = `<div class="android-folder-icon" id="add-folder-icon">${ICONS.plus}</div><div class="folder-label">${this.t('add')}</div>`;
                addBtn.onclick = (e) => this.enableFolderInput(e.currentTarget);
                grid.appendChild(addBtn);
            }
            content.appendChild(grid);
        }
        
        if (attrs.items && attrs.items.length > 0) {
            const list = document.createElement('div');
            list.className = 'item-list';
            attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
            content.appendChild(list);
        }
        
        if (this.isEditMode && attrs.depth === 1) {
             const addBtn = document.createElement('div');
             addBtn.className = 'add-item-btn-row';
             addBtn.innerHTML = `<button class="add-item-btn" onclick="this.getRootNode().host.addQuickItem()">+ ${this.t('add')}</button>`;
             content.appendChild(addBtn);
        }
    } else {
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';
        const inStock = [], outOfStock = [];
        if (attrs.items) attrs.items.forEach(item => (item.qty === 0 ? outOfStock : inStock).push(item));
        const grouped = {};
        
        // SUB-LOCATION ORDERING LOGIC
        const markerRegex = /^ORDER_MARKER_(\d+)_(.*)$/;
        const orderedGroups = []; // { name: 'Fridge', order: 10, markerKey: 'ORDER_MARKER_010_Fridge' }
        const foundMarkers = new Set();

        // 1. Identify groups and markers
        // Scan folders or implicit sub-locations from items
        const rawGroups = new Set();
        if (attrs.folders) attrs.folders.forEach(f => {
             // If this folder is a marker
             if (f.name.startsWith("ORDER_MARKER_")) {
                 const match = f.name.match(markerRegex);
                 if (match) {
                     const order = parseInt(match[1]);
                     const realName = match[2];
                     orderedGroups.push({ name: realName, order: order, markerKey: f.name });
                     foundMarkers.add(realName);
                 }
             } else {
                 rawGroups.add(f.name);
             }
        });
        
        // Scan items for sub_location groupings
        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if (sub.startsWith("ORDER_MARKER_")) {
                 // It's a marker item, parse it
                 const match = sub.match(markerRegex);
                 if (match) {
                     const order = parseInt(match[1]);
                     const realName = match[2];
                     // Only add if not already added via folders loop
                     if (!orderedGroups.find(g => g.markerKey === sub)) {
                         orderedGroups.push({ name: realName, order: order, markerKey: sub });
                         foundMarkers.add(realName);
                     }
                 }
            } else {
                rawGroups.add(sub);
            }
        });

        // 2. Add non-marked groups with default order
        rawGroups.forEach(g => {
            if (!foundMarkers.has(g)) {
                let order = 9999;
                if (g === "General") order = -1; 
                orderedGroups.push({ name: g, order: order, markerKey: null });
            }
        });

        // 3. Sort
        orderedGroups.sort((a,b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.name.localeCompare(b.name);
        });

        // 4. Populate grouped items
        orderedGroups.forEach(g => grouped[g.name] = []);
        
        // Fill items into groups
        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if (!sub.startsWith("ORDER_MARKER_")) {
                if(!grouped[sub]) grouped[sub] = []; // Just in case
                grouped[sub].push(item);
            }
        });

        // Current ID Parent (e.g., "A1" if inside Kitchen -> Fridge)
        const parentID = this.catalogPath[1] || "";

        // 5. Render
        orderedGroups.forEach(groupObj => {
            const subName = groupObj.name;
            const items = grouped[subName] || [];
            const count = items.length;
            
            // PERSISTENT ID
            const rawID = this.getPersistentID(this.currentPath.join('_'), subName);
            const catalogID = parentID ? `${parentID}.${rawID}` : "";

            if (subName === "General" && count === 0 && !this.isEditMode) return;
            if (this.viewMode === 'grid' && count === 0) return;
            
            const isExpanded = (this.viewMode === 'grid') ? true : this.expandedSublocs.has(subName);
            const icon = isExpanded ? ICONS.chevron_down : ICONS.chevron_right;
            const countBadge = `<span style="font-size:12px; background:var(--bg-badge); color:var(--text-badge); padding:2px 6px; border-radius:10px; margin-inline-start:8px;">${count}</span>`;
            
            const header = document.createElement('div');
            header.className = 'group-separator';
            this.setupDropTarget(header, subName);
            
            if (this.viewMode === 'list') {
                header.onclick = () => this.toggleSubloc(subName);
            } else {
                header.style.cursor = 'default';
            }
            
            // Build visual text for ID if available
            // Note: class updated to handle flex positioning
            const idHtml = catalogID ? `<span class="catalog-id-text">${catalogID}</span>` : '';

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <div style="display:flex;align-items:center;">
                        <span style="margin-inline-end:5px;display:flex;align-items:center">${icon}</span>
                        <span class="subloc-title">${subName}</span>
                        ${countBadge}
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${idHtml}
                        <div style="display:flex;gap:5px;align-items:center">
                            <button class="arrow-btn" onclick="event.stopPropagation(); this.getRootNode().host.moveSubLoc('${subName}', -1)" title="Move Up">${ICONS.arrow_up}</button>
                            <button class="arrow-btn" onclick="event.stopPropagation(); this.getRootNode().host.moveSubLoc('${subName}', 1)" style="transform:rotate(180deg)" title="Move Down">${ICONS.arrow_up}</button>
                            <div style="width:1px;height:15px;background:#444;margin:0 5px"></div>
                            <button class="edit-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableSublocRename(this, '${subName}')">${ICONS.edit}</button>
                            <button class="delete-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                        </div>
                    </div>`;
            } else {
                // FIXED RTL ALIGNMENT: Swapped ID to be the second child so it appears at the End in both modes
                // Flex Row: [Title Group] ...space-between... [ID]
                header.innerHTML = `
                    <div style="display:flex;align-items:center;">
                        <span style="margin-inline-end:5px;display:flex;align-items:center">${icon}</span>
                        <span>${subName}</span>
                        ${countBadge}
                    </div>
                    ${idHtml}
                `;
            }
            listContainer.appendChild(header);

            if (isExpanded) {
                if (this.viewMode === 'grid' && count > 0) {
                      const gridDiv = document.createElement('div');
                      gridDiv.className = 'xl-grid-container';
                      items.forEach(item => {
                          const card = document.createElement('div');
                          card.className = 'xl-card';
                          let iconHtml = ICONS.item;
                          if (item.img) iconHtml = `<img src="${item.img}">`;
                          card.innerHTML = `
                              <div class="xl-icon-area">${iconHtml}</div>
                              <div class="xl-badge">${item.qty}</div>
                              <div class="xl-info">
                                  <div class="xl-name">${item.name}</div>
                                  <div class="xl-date">${item.date || ''}</div>
                              </div>
                          `;
                          const iconArea = card.querySelector('.xl-icon-area');
                          if(iconArea) {
                              iconArea.onclick = (e) => {
                                  e.stopPropagation();
                                  this.showItemDetails(item);
                              };
                          }
                          card.onclick = () => { 
                              this.viewMode = 'list';
                              this.expandedIdx = item.id;
                              this.render();
                          };
                          gridDiv.appendChild(card);
                      });
                      listContainer.appendChild(gridDiv);
                } else {
                    items.forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
                }

                if (this.isEditMode) {
                      const addRow = document.createElement('div');
                      addRow.className = "group-add-row";
                      addRow.innerHTML = `<button class="text-add-btn" onclick="this.getRootNode().host.addQuickItem('${subName}')">${ICONS.plus} ${this.t('add')}</button>`;
                      listContainer.appendChild(addRow);
                }
            }
        });
        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = this.t('out_of_stock');
            listContainer.appendChild(oosHeader);
            outOfStock.forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
        }
        if (this.isEditMode) {
            const gridContainer = document.createElement('div');
            gridContainer.className = 'folder-grid';
            gridContainer.style.marginTop = '20px';
            const addBtn = document.createElement('div');
            addBtn.className = 'folder-item add-folder-card';
            addBtn.innerHTML = `<div class="android-folder-icon" id="add-subloc-icon">${ICONS.plus}</div><div class="folder-label">${this.t('add_sub')}</div>`;
            addBtn.onclick = (e) => this.enableFolderInput(e.currentTarget);
            gridContainer.appendChild(addBtn);
            listContainer.appendChild(gridContainer);
        }
        content.appendChild(listContainer);
    }
  }

  // --- SUB-LOCATION REORDERING ---
  
  // Helper to find the actual database name if it's hidden behind a marker
  resolveRealName(displayName) {
      if (!this.localData) return displayName;
      
      // Check folders
      if (this.localData.folders) {
          const markerRegex = new RegExp(`^ORDER_MARKER_\\d+_${displayName}$`);
          const found = this.localData.folders.find(f => f.name.match(markerRegex));
          if (found) return found.name;
      }
      
      // Check items (sub-location markers)
      if (this.localData.items) {
          const markerRegex = new RegExp(`^ORDER_MARKER_\\d+_${displayName}$`);
          const found = this.localData.items.find(i => i.sub_location && i.sub_location.match(markerRegex));
          if (found) return found.sub_location;
      }
      
      return displayName;
  }

  async moveSubLoc(subName, direction) {
      // 1. Reconstruct list from items/folders data to ensure current state
      const subGroups = [];
      const markerRegex = /^ORDER_MARKER_(\d+)_(.*)$/;
      const seen = new Set();
      const currentMarkers = {}; // Map RealName -> MarkerItemName

      // Check folders
      if (this.localData.folders) this.localData.folders.forEach(f => {
          if (f.name.startsWith("ORDER_MARKER_")) {
              const match = f.name.match(markerRegex);
              if (match) {
                  const realName = match[2];
                  if (!seen.has(realName)) {
                      subGroups.push({ name: realName, order: parseInt(match[1]) });
                      seen.add(realName);
                      currentMarkers[realName] = f.name;
                  }
              }
          } else {
              if (!seen.has(f.name)) { subGroups.push({ name: f.name, order: 9999 }); seen.add(f.name); }
          }
      });
      // Check items
      if (this.localData.items) this.localData.items.forEach(i => {
          const s = i.sub_location || "General";
          if (s.startsWith("ORDER_MARKER_")) {
              const match = s.match(markerRegex);
              if (match) {
                  const realName = match[2];
                  if (!seen.has(realName)) {
                      subGroups.push({ name: realName, order: parseInt(match[1]) });
                      seen.add(realName);
                      currentMarkers[realName] = s;
                  }
              }
          } else {
              if (!seen.has(s)) { 
                  let ord = 9999; if(s==="General") ord = -1;
                  subGroups.push({ name: s, order: ord }); seen.add(s); 
              }
          }
      });

      // Stable Sort
      subGroups.sort((a,b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.name.localeCompare(b.name);
      });
      
      const idx = subGroups.findIndex(g => g.name === subName);
      if (idx === -1) return;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= subGroups.length) return;

      // Swap
      [subGroups[idx], subGroups[newIdx]] = [subGroups[newIdx], subGroups[idx]];

      // Apply new orders sequentially
      for (let i = 0; i < subGroups.length; i++) {
          const g = subGroups[i];
          const newOrder = (i + 1) * 10;
          const padded = String(newOrder).padStart(3, '0');
          const newMarkerName = `ORDER_MARKER_${padded}_${g.name}`;
          const oldMarkerName = currentMarkers[g.name];

          if (g.name !== "General") {
              if (oldMarkerName && oldMarkerName !== newMarkerName) {
                  // Rename existing marker group (this moves the marker item to new sub_location)
                  await this.callHA('update_item_details', { 
                      original_name: oldMarkerName, // treating sub_loc as folder name for update
                      new_name: newMarkerName,
                      current_path: this.currentPath, 
                      is_folder: true 
                  });
              } else if (!oldMarkerName) {
                  // Create new marker item to establish order
                  await this.callHA('add_item', { 
                      item_name: "OrderMarker", 
                      item_type: 'item', 
                      current_path: [...this.currentPath, newMarkerName] // putting it into the marker sub-loc
                  });
              }
          }
      }
      this.fetchData();
  }

  // --- ZONE/FLOOR MANAGEMENT LOGIC ---
  
  // Instant creation of zone without popup
  createNewZone() {
      let base = "New Zone";
      let name = base;
      let count = 1;
      const existingZones = new Set();
      if (this.localData && this.localData.folders) {
          // Check both f.zone and ZONE_MARKERs
          this.localData.folders.forEach(f => { 
              if(f.zone) existingZones.add(f.zone);
              if(f.name.startsWith("ZONE_MARKER_")) existingZones.add(f.name.replace(/^ZONE_MARKER_\d+_/, "").trim());
          });
      }
      while (existingZones.has(name)) {
          name = `${base} ${count++}`;
      }
      
      const markerName = "ZONE_MARKER_999_" + name;
      // CHANGED TO 'folder' so backend accepts it properly
      this.callHA('add_item', { item_name: markerName, item_type: 'folder', zone: name, current_path: [] });
  }

  // NEW: Inline Input for adding room to a specific zone
  enableZoneRoomInput(cardEl, zoneName) {
      const iconContainer = cardEl.querySelector('.android-folder-icon');
      const label = cardEl.querySelector('.folder-label');
      if(iconContainer.querySelector('input')) return;
      
      iconContainer.innerHTML = `<input type="text" class="add-folder-input" placeholder="Name">`;
      const input = iconContainer.querySelector('input');
      label.innerText = this.t('save_to') + " " + zoneName;
      
      input.focus();
      input.onkeydown = (e) => { 
          if (e.key === 'Enter') this.saveNewRoomInZone(input.value, zoneName); 
      };
      input.onblur = () => { 
          if (input.value.trim()) this.saveNewRoomInZone(input.value, zoneName); 
          else this.render(); 
      };
  }

  // NEW: Save room and immediately force zone update using PREFIX hack since DB has no zone column
  saveNewRoomInZone(name, zoneName) {
      if(!name) return;
      
      let finalName = name;
      if (zoneName !== "General Rooms") {
          finalName = `[${zoneName}] ${name}`;
      }
      
      this.callHA('add_item', { item_name: finalName, item_type: 'folder', current_path: [] });
  }

  setupRoomDragSource(el, roomName) {
      el.draggable = true;
      el.ondragstart = (e) => { 
          e.dataTransfer.setData("text/plain", roomName); 
          e.dataTransfer.effectAllowed = "move"; 
          el.classList.add('dragging'); 
      };
      el.ondragend = () => el.classList.remove('dragging');
  }

  setupZoneDropTarget(el, zoneName) {
      el.ondragover = (e) => { 
          e.preventDefault(); 
          e.dataTransfer.dropEffect = 'move'; 
          el.classList.add('drag-over'); 
      };
      el.ondragleave = () => el.classList.remove('drag-over');
      el.ondrop = (e) => { 
          e.preventDefault(); 
          el.classList.remove('drag-over'); 
          const roomName = e.dataTransfer.getData("text/plain"); 
          if (roomName) this.moveRoomToZone(roomName, zoneName); 
      };
  }

  async moveRoomToZone(roomName, zoneName) {
      try {
          // Calculate new name with prefix
          const cleanName = roomName.replace(/^\[(.*?)\]\s*/, "");
          let newName = cleanName;
          if (zoneName !== "General Rooms") {
              newName = `[${zoneName}] ${cleanName}`;
          }
          
          if (newName !== roomName) {
              await this.callHA('update_item_details', { 
                  original_name: roomName, 
                  new_name: newName,
                  current_path: [], 
                  is_folder: true 
              });
              this.fetchData();
          }
      } catch (err) { console.error("Zone move failed", err); }
  }

  // --- REORDERING LOGIC ---
  
  moveZone(zoneName, direction) {
      // 1. Reconstruct current sorted list from DOM/Data
      // We need to parse all markers to get current order
      const zones = [];
      const markerRegex = /^ZONE_MARKER_(\d+)_(.*)$/;
      const seen = new Set();

      if (this.localData && this.localData.folders) {
          this.localData.folders.forEach(f => {
              if (f.name.startsWith("ZONE_MARKER_")) {
                  const match = f.name.match(markerRegex);
                  let zOrder = 9999;
                  let zName = f.name.replace("ZONE_MARKER_", "");
                  if (match) {
                      zOrder = parseInt(match[1]);
                      zName = match[2];
                  } else {
                      // Handle unindexed legacy markers if any
                      zName = f.name.replace("ZONE_MARKER_", "").trim();
                  }
                  if (!seen.has(zName)) {
                      zones.push({ name: zName, order: zOrder, markerName: f.name });
                      seen.add(zName);
                  }
              }
          });
      }
      
      // Sort by current order
      zones.sort((a,b) => a.order - b.order);
      
      // Find current index
      const idx = zones.findIndex(z => z.name === zoneName);
      if (idx === -1) return; // Should not happen
      
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= zones.length) return; // Out of bounds
      
      // Swap
      const temp = zones[idx];
      zones[idx] = zones[newIdx];
      zones[newIdx] = temp;
      
      // Re-assign indices (10, 20, 30...) and Rename Markers
      zones.forEach((z, index) => {
          const newOrder = (index + 1) * 10;
          const paddedOrder = String(newOrder).padStart(3, '0');
          const newMarkerName = `ZONE_MARKER_${paddedOrder}_${z.name}`;
          
          if (z.markerName !== newMarkerName) {
              this.callHA('update_item_details', { 
                  original_name: z.markerName, 
                  new_name: newMarkerName,
                  current_path: [], 
                  is_folder: true 
              });
          }
      });
      
      // Refresh UI after short delay to allow DB writes
      setTimeout(() => this.fetchData(), 600);
  }

  // Handle Zone Rename
  enableZoneRename(btn, oldName) {
      const header = btn.closest('.group-separator');
      if (header.querySelector('input')) return; 
      const titleSpan = header.querySelector('.subloc-title') || header.querySelector('span');
      if(!titleSpan) return;
      
      const input = document.createElement('input');
      input.value = oldName;
      input.style.background = 'var(--bg-input-edit)';
      input.style.color = 'var(--text-main)';
      input.style.border = '1px solid var(--primary)';
      input.style.borderRadius = '4px';
      input.style.padding = '4px';
      input.style.fontSize = '14px';
      input.style.width = '200px'; 
      input.onclick = (e) => e.stopPropagation();
      titleSpan.replaceWith(input);
      input.focus();
      
      let isSaving = false;
      const save = () => {
          if (isSaving) return;
          isSaving = true;
          const newVal = input.value.trim();
          if (newVal && newVal !== oldName) {
              const newSpan = document.createElement('span');
              newSpan.className = 'subloc-title';
              newSpan.innerText = newVal;
              input.replaceWith(newSpan);
              this.batchUpdateZone(oldName, newVal);
          } else {
              const originalSpan = document.createElement('span');
              originalSpan.className = 'subloc-title'; 
              originalSpan.innerText = oldName; 
              input.replaceWith(originalSpan);
          }
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
      input.onblur = () => save();
  }

  batchUpdateZone(oldZone, newZone) {
      if (this.localData && this.localData.folders) {
          const markerRegex = new RegExp(`^ZONE_MARKER_\\d+_${oldZone}$`); // Match specific zone marker
          
          this.localData.folders.forEach(f => {
              // Update Marker (Preserve Order)
              if (f.name.startsWith("ZONE_MARKER_") && f.name.endsWith(`_${oldZone}`)) {
                    const prefix = f.name.substring(0, f.name.lastIndexOf(`_${oldZone}`)); // Extract 'ZONE_MARKER_010'
                    this.callHA('update_item_details', { 
                        original_name: f.name, 
                        new_name: `${prefix}_${newZone}`,
                        current_path: [], 
                        is_folder: true 
                    });
              } 
              // Update prefixed rooms
              else if (f.name.startsWith(`[${oldZone}] `)) {
                    const cleanName = f.name.replace(`[${oldZone}] `, "");
                    const newName = `[${newZone}] ${cleanName}`;
                    this.callHA('update_item_details', { 
                        original_name: f.name, 
                        new_name: newName,
                        current_path: [], 
                        is_folder: true 
                    });
              }
          });
          // Refresh after slight delay for batch updates
          setTimeout(() => this.fetchData(), 800);
      }
  }

  deleteZone(zoneName) {
      if(confirm(this.t('confirm_del_zone', zoneName))) {
          if (this.localData && this.localData.folders) {
              this.localData.folders.forEach(f => {
                  if (f.name.startsWith("ZONE_MARKER_") && f.name.endsWith(`_${zoneName}`)) {
                      this.callHA('delete_item', { item_name: f.name, current_path: [], is_folder: true });
                  } else if (f.name.startsWith(`[${zoneName}] `)) {
                      // Move to General (strip prefix)
                      const cleanName = f.name.replace(`[${zoneName}] `, "");
                      this.callHA('update_item_details', { 
                          original_name: f.name, 
                          new_name: cleanName,
                          current_path: [], 
                          is_folder: true 
                      });
                  }
              });
          }
          setTimeout(() => this.fetchData(), 800);
      }
  }

  // --- END ZONE LOGIC ---

  showItemDetails(item) {
      const ov = this.shadowRoot.getElementById('img-overlay');
      const img = this.shadowRoot.getElementById('overlay-img');
      const det = this.shadowRoot.getElementById('overlay-details');
      const iconBig = this.shadowRoot.getElementById('overlay-icon-big');
      
      ov.style.display = 'flex';
      det.style.display = 'block';
      
      if(item.img) {
          img.src = item.img;
          img.style.display = 'block';
          iconBig.style.display = 'none';
      } else {
          img.style.display = 'none';
          iconBig.style.display = 'block';
      }
      
      det.innerHTML = `
          <div style="font-size:20px;font-weight:bold;margin-bottom:8px">${item.name}</div>
          <div style="font-size:16px;color:#aaa;margin-bottom:15px">${item.date || this.t('no_date')}</div>
          <div style="font-size:18px;font-weight:bold;color:var(--accent);background:#333;padding:8px 20px;border-radius:20px;display:inline-block">${this.t('quantity')}: ${item.qty}</div>
      `;
  }

  showImg(src) { 
      const ov = this.shadowRoot.getElementById('img-overlay'); 
      const img = this.shadowRoot.getElementById('overlay-img'); 
      const det = this.shadowRoot.getElementById('overlay-details');
      const iconBig = this.shadowRoot.getElementById('overlay-icon-big');
      if(ov && img) { 
          img.src = src; 
          img.style.display = 'block';
          if(det) det.style.display = 'none'; 
          if(iconBig) iconBig.style.display = 'none';
          ov.style.display = 'flex'; 
      } 
  }

  toggleSubloc(name) {
      if (this.expandedSublocs.has(name)) this.expandedSublocs.delete(name); else this.expandedSublocs.add(name);
      this.render();
  }
  
  enableFolderInput(cardEl) {
      const iconContainer = cardEl.querySelector('.android-folder-icon');
      const label = cardEl.querySelector('.folder-label');
      if(iconContainer.querySelector('input')) return;
      iconContainer.innerHTML = `<input type="text" class="add-folder-input" placeholder="Name">`;
      const input = iconContainer.querySelector('input');
      label.innerText = this.t('saving');
      input.focus();
      input.onkeydown = (e) => { if (e.key === 'Enter') this.saveNewFolder(input.value); };
      input.onblur = () => { if (input.value.trim()) this.saveNewFolder(input.value); else this.render(); };
  }
  
  enableFolderRename(labelEl, oldName) {
      if (!labelEl || labelEl.querySelector('input')) return;
      const input = document.createElement('input');
      input.value = oldName;
      input.style.width = '100%';
      input.style.background = 'var(--bg-input-edit)';
      input.style.color = 'var(--text-main)';
      input.style.border = '1px solid var(--primary)';
      input.style.borderRadius = '4px';
      input.style.textAlign = 'center';
      input.style.fontSize = '12px';
      input.onclick = (e) => e.stopPropagation();
      labelEl.innerHTML = '';
      labelEl.appendChild(input);
      input.focus();
      let isSaving = false;
      const save = () => {
          if (isSaving) return; 
          isSaving = true;
          const newVal = input.value.trim();
          if (newVal && newVal !== oldName) {
              this.callHA('update_item_details', { original_name: oldName, new_name: newVal, new_date: "", current_path: this.currentPath, is_folder: true });
          } else this.render();
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
      input.onblur = () => save();
  }

  saveNewFolder(name) {
      if(!name) return;
      this._hass.callService('home_organizer', 'add_item', { item_name: name, item_type: 'folder', item_date: '', image_data: null, current_path: this.currentPath });
  }

  addQuickItem(targetSubloc) {
      const tempName = this.t('new_item') + " " + new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
      const today = new Date().toISOString().split('T')[0];
      let usePath = [...this.currentPath];
      if (targetSubloc && targetSubloc !== "General") usePath.push(targetSubloc);
      this._hass.callService('home_organizer', 'add_item', { item_name: tempName, item_type: 'item', item_date: today, image_data: null, current_path: usePath });
  }

  setupDragSource(el, itemName) {
      el.draggable = true;
      el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", itemName); e.dataTransfer.effectAllowed = "move"; el.classList.add('dragging'); };
      el.ondragend = () => el.classList.remove('dragging');
  }

  setupDropTarget(el, subName) {
      el.dataset.subloc = subName;
      el.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); };
      el.ondragleave = () => el.classList.remove('drag-over');
      el.ondrop = (e) => { e.preventDefault(); el.classList.remove('drag-over'); const itemName = e.dataTransfer.getData("text/plain"); this.handleDropAction(subName, itemName); };
  }

  async handleDropAction(targetSubloc, itemName) {
      if (!itemName) return;
      let targetPath = [...this.currentPath];
      if (targetSubloc !== "General") targetPath.push(targetSubloc);
      try {
          await this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
          await this.callHA('paste_item', {target_path: targetPath});
      } catch (err) { console.error("Drop failed:", err); }
  }

  triggerCameraEdit(id, name) { 
      this.pendingItemId = id; 
      this.pendingItemName = name;
      this.openCamera('update'); 
  }
  adjustShopQty(id, delta) {
      if (this.shopQuantities[id] === undefined) this.shopQuantities[id] = 0;
      this.shopQuantities[id] = Math.max(0, this.shopQuantities[id] + delta);
      this.render();
  }
  
  duplicateItem(itemId) {
      if (!itemId) return;
      this.callHA('duplicate_item', { item_id: itemId });
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.id ? 'expanded' : ''} ${oosClass}`;
     this.setupDragSource(div, item.name);
     const appEl = this.shadowRoot.getElementById('app');
     const isRTL = appEl && !appEl.classList.contains('ltr');

     let controls = '';
     if (isShopMode) {
         const localQty = (this.shopQuantities[item.id] !== undefined) ? this.shopQuantities[item.id] : 0;
         const checkStyle = (localQty === 0) ? "background:#555;color:#888;cursor:not-allowed;width:40px;height:40px;margin-inline-start:8px;" : "background:var(--accent);width:40px;height:40px;margin-inline-start:8px;";
         const checkDisabled = (localQty === 0) ? "disabled" : "";
         const minusBtn = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.adjustShopQty('${item.id}', -1)">${ICONS.minus}</button>`;
         const plusBtn = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.adjustShopQty('${item.id}', 1)">${ICONS.plus}</button>`;
         const qtySpan = `<span class="qty-val" style="margin:0 8px">${localQty}</span>`;
         const checkBtn = `<button class="qty-btn" style="${checkStyle}" ${checkDisabled} title="Complete" onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.id}')">${ICONS.check}</button>`;
         if (isRTL) { controls = `${plusBtn}${qtySpan}${minusBtn}${checkBtn}`; } else { controls = `${minusBtn}${qtySpan}${plusBtn}${checkBtn}`; }
     } else {
         controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.id}', 1)">${ICONS.plus}</button><span class="qty-val">${item.qty}</span><button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.id}', -1)">${ICONS.minus}</button>`;
     }
     const subText = isShopMode ? `${item.main_location} > ${item.sub_location || ''}` : `${item.date || ''}`;
     let iconHtml = `<span class="item-icon">${ICONS.item}</span>`;
     if (item.img) iconHtml = `<img src="${item.img}" class="item-thumbnail" alt="${item.name}" onclick="event.stopPropagation(); this.getRootNode().host.showImg('${item.img}')">`;

     div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.id}')">
            <div class="item-left">${iconHtml}<div><div>${item.name}</div><div class="sub-title">${subText}</div></div></div>
            <div class="item-qty-ctrl">${controls}</div>
        </div>
     `;
     
     if (this.expandedIdx === item.id) {
         const details = document.createElement('div');
         details.className = 'expanded-details';
         
         // Options logic
         let roomOptions = `<option value="">-- ${this.t('move_to')} --</option>`;
         if(this.localData.hierarchy) Object.keys(this.localData.hierarchy).forEach(room => { roomOptions += `<option value="${room}">${room}</option>`; });

         // Category Options (Translated Keys)
         let mainCatOptions = `<option value="">${this.t('select_cat')}</option>`;
         Object.keys(ITEM_CATEGORIES).forEach(cat => {
             const selected = (item.category === cat) ? 'selected' : '';
             mainCatOptions += `<option value="${cat}" ${selected}>${this.t('cat_' + cat.replace(/[^a-zA-Z0-9]+/g, '_')) || cat}</option>`;
         });

         // Sub Category Options
         let subCatOptions = `<option value="">${this.t('select_sub')}</option>`;
         let currentUnit = "";
         if (item.category && ITEM_CATEGORIES[item.category]) {
             const subs = ITEM_CATEGORIES[item.category];
             Object.keys(subs).forEach(sub => {
                 const selected = (item.sub_category === sub) ? 'selected' : '';
                 const transKey = 'sub_' + sub.replace(/[^a-zA-Z0-9]+/g, '_');
                 subCatOptions += `<option value="${sub}" ${selected}>${this.t(transKey) || sub}</option>`;
                 if (selected) currentUnit = subs[sub];
             });
         }
         
         // SVG for Copy/Duplicate Icon
         const COPY_SVG = `<svg viewBox="0 0 24 24"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" /></svg>`;

         details.innerHTML = `
            <div class="detail-row">
                <!-- Relative Wrapper for Autocomplete -->
                <div style="position:relative; flex:1;">
                    <input type="text" id="name-${item.id}" value="${item.name}" 
                        style="width:100%;padding:8px;background:var(--bg-input-edit);color:var(--text-main);border:1px solid var(--border-light);border-radius:4px;margin-inline-start:5px"
                        autocomplete="off"
                        oninput="this.getRootNode().host.handleNameInput(this, '${item.id}')"
                        onblur="setTimeout(() => { if(this.parentElement.querySelector('.suggestions-box')) this.parentElement.querySelector('.suggestions-box').remove() }, 200)"
                        onkeydown="if(event.key==='Enter') { this.blur(); this.getRootNode().host.autoSaveItem('${item.id}', 'name', '${item.name}') }">
                </div>

                <div style="position:relative; width:120px; height:36px; margin-inline-start:5px;">
                    <button class="action-btn" style="width:100%; height:100%; text-align:center; padding:0; display:flex; align-items:center; justify-content:center; background:var(--bg-input-edit); color:var(--text-main); border:1px solid var(--border-light);"
                        onclick="this.nextElementSibling.showPicker()">
                        ${item.date || this.t('set_date')}
                    </button>
                    <input type="date" id="date-${item.id}" value="${item.date}" 
                        style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;"
                        onchange="this.previousElementSibling.innerText = this.value || '${this.t('set_date')}'; this.getRootNode().host.autoSaveItem('${item.id}', 'date', '${item.name}')">
                </div>
            </div>
            
            <div class="detail-row" style="margin-top:10px; gap:5px; align-items:center;">
                <select class="move-select" id="cat-main-${item.id}" onchange="this.getRootNode().host.updateItemCategory('${item.id}', this.value, 'main', '${item.name}')">
                    ${mainCatOptions}
                </select>
                <select class="move-select" id="cat-sub-${item.id}" onchange="this.getRootNode().host.updateItemCategory('${item.id}', this.value, 'sub', '${item.name}')">
                    ${subCatOptions}
                </select>
                <!-- NEW: Unit Value Input -->
                <input type="text" id="unit-val-${item.id}" value="${item.unit_value || ''}" placeholder="Val" 
                    style="width:60px;padding:8px;background:var(--bg-input-edit);color:var(--text-main);border:1px solid var(--border-light);border-radius:4px;text-align:center"
                    onchange="this.getRootNode().host.updateItemCategory('${item.id}', null, 'val', '${item.name}')">
                <div id="unit-disp-${item.id}" style="background:var(--bg-badge);color:var(--text-badge);padding:4px 8px;border-radius:4px;font-size:11px;min-width:30px;text-align:center;">
                    ${this.t('unit_' + currentUnit) || currentUnit || '-'}
                </div>
            </div>

            <div class="detail-row" style="justify-content:space-between; margin-top:10px;">
                 <div style="display:flex;gap:10px;">
                    <button class="action-btn" title="${this.t('take_photo')}" onclick="this.getRootNode().host.triggerCameraEdit('${item.id}', '${item.name}')">${ICONS.camera}</button>
                    <button class="action-btn" title="${this.t('change_img')}" onclick="this.getRootNode().host.openIconPicker('${item.id}', 'item')">${ICONS.image}</button>
                 </div>
                 <div style="display:flex;gap:10px;">
                    <button class="action-btn" title="${this.t('duplicate')}" onclick="this.getRootNode().host.duplicateItem('${item.id}')">${COPY_SVG}</button>
                    <button class="action-btn btn-danger" title="${this.t('delete')}" onclick="this.getRootNode().host.del('${item.id}')">${ICONS.delete}</button>
                 </div>
            </div>
            <div class="detail-row" style="margin-top:10px; border-top:1px solid #444; padding-top:10px; flex-direction:column; gap:8px;">
                <div class="move-container" style="width:100%"><span style="font-size:12px;color:#aaa;width:60px">${this.t('move_to')}</span><select class="move-select" id="room-select-${item.id}" onchange="this.getRootNode().host.updateLocationDropdown('${item.id}', this.value)">${roomOptions}</select></div>
                <div class="move-container" style="width:100%; display:none;" id="loc-container-${item.id}"><span style="font-size:12px;color:#aaa;width:60px">${this.t('loc_label')}</span><select class="move-select" id="loc-select-${item.id}" onchange="this.getRootNode().host.updateSublocDropdown('${item.id}', this.value)"><option value="">-- Select --</option></select></div>
                <div class="move-container" style="width:100%; display:none;" id="subloc-container-${item.id}"><span style="font-size:12px;color:#aaa;width:60px">${this.t('sub_label')}</span><select class="move-select" id="target-subloc-${item.id}" onchange="this.getRootNode().host.handleMoveToPath('${item.id}')"><option value="">-- Select --</option></select></div>
            </div>
         `;
         div.appendChild(details);
     }
     return div;
  }
  
  updateItemCategory(itemId, value, type, itemName) {
      const mainSelect = this.shadowRoot.getElementById(`cat-main-${itemId}`);
      const subSelect = this.shadowRoot.getElementById(`cat-sub-${itemId}`);
      const valInput = this.shadowRoot.getElementById(`unit-val-${itemId}`);
      const unitDisp = this.shadowRoot.getElementById(`unit-disp-${itemId}`);
      
      let mainCat = (type === 'main') ? value : mainSelect.value;
      let subCat = (type === 'sub') ? value : (type === 'main' ? "" : subSelect.value);
      let unitVal = valInput ? valInput.value : "";
      let unit = "";

      // If Main Category changed, rebuild Sub Category options
      if (type === 'main') {
          let html = `<option value="">${this.t('select_sub')}</option>`;
          if (mainCat && ITEM_CATEGORIES[mainCat]) {
              Object.keys(ITEM_CATEGORIES[mainCat]).forEach(sub => {
                  const transKey = 'sub_' + sub.replace(/[^a-zA-Z0-9]+/g, '_');
                  html += `<option value="${sub}">${this.t(transKey) || sub}</option>`;
              });
          }
          subSelect.innerHTML = html;
          subCat = ""; // Reset sub
          unitDisp.innerText = "-";
      }

      // If Sub Category changed (or is present), update unit
      if (mainCat && subCat && ITEM_CATEGORIES[mainCat] && ITEM_CATEGORIES[mainCat][subCat]) {
          unit = ITEM_CATEGORIES[mainCat][subCat];
          unitDisp.innerText = this.t('unit_' + unit) || unit;
      } else {
          unitDisp.innerText = "-";
      }

      // Save to Backend
      this.callHA('update_item_details', { 
          item_id: itemId,
          original_name: itemName, 
          category: mainCat, 
          sub_category: subCat, 
          unit: unit,
          unit_value: unitVal,
          current_path: this.currentPath
      });
  }
  
  autoSaveItem(itemId, triggerType, oldName) {
      const nameEl = this.shadowRoot.getElementById(`name-${itemId}`);
      const dateEl = this.shadowRoot.getElementById(`date-${itemId}`);
      if(!nameEl || !dateEl) return;
      const newName = nameEl.value.trim();
      const newDate = dateEl.value;
      // if(triggerType === 'name' && newName !== oldName) { this.expandedIdx = newName; } // No longer needed as we track by ID
      this.callHA('update_item_details', { item_id: itemId, original_name: oldName, new_name: newName, new_date: newDate });
  }

  updateLocationDropdown(itemId, roomName) {
      const locContainer = this.shadowRoot.getElementById(`loc-container-${itemId}`);
      const locSelect = this.shadowRoot.getElementById(`loc-select-${itemId}`);
      const subContainer = this.shadowRoot.getElementById(`subloc-container-${itemId}`);
      subContainer.style.display = 'none';
      locSelect.innerHTML = '<option value="">-- Select --</option>';
      if(!roomName) { locContainer.style.display = 'none'; return; }
      let html = `<option value="">-- Select Location --</option>`;
      if(this.localData.hierarchy && this.localData.hierarchy[roomName]) Object.keys(this.localData.hierarchy[roomName]).forEach(loc => { html += `<option value="${loc}">${loc}</option>`; });
      locSelect.innerHTML = html;
      locContainer.style.display = 'flex';
      locSelect.dataset.room = roomName;
  }
  
  updateSublocDropdown(itemId, locationName) {
      const subContainer = this.shadowRoot.getElementById(`subloc-container-${itemId}`);
      const subSelect = this.shadowRoot.getElementById(`target-subloc-${itemId}`);
      const roomName = this.shadowRoot.getElementById(`room-select-${itemId}`).value;
      if(!locationName) { subContainer.style.display = 'none'; return; }
      let html = `<option value="">-- Select Sublocation --</option>`;
      html += `<option value="__ROOT__">Main ${locationName}</option>`;
      if(this.localData.hierarchy && this.localData.hierarchy[roomName] && this.localData.hierarchy[roomName][locationName]) this.localData.hierarchy[roomName][locationName].forEach(sub => { html += `<option value="${sub}">${sub}</option>`; });
      subSelect.innerHTML = html;
      subContainer.style.display = 'flex';
  }
  
  handleMoveToPath(itemId) {
      const room = this.shadowRoot.getElementById(`room-select-${itemId}`).value;
      const loc = this.shadowRoot.getElementById(`loc-select-${itemId}`).value;
      const sub = this.shadowRoot.getElementById(`target-subloc-${itemId}`).value;
      if(!room || !loc || !sub) return;
      let targetPath = [room, loc];
      if(sub !== "__ROOT__") targetPath.push(sub);
      // For clipboard operations, we might still need name if backend isn't fully updated for ID move, 
      // but assuming clipboard action handles ID or name:
      // We pass the ITEM NAME for legacy compat if ID logic fails on paste, but paste uses stored clipboard obj
      // Let's rely on cut logic.
      // We need to find the item name associated with ID if we want to be safe, but let's pass ID to cut.
      this.callHA('clipboard_action', {action: 'cut', item_id: itemId});
      setTimeout(() => { this.callHA('paste_item', {target_path: targetPath}); }, 100);
  }

  deleteFolder(name) { if(confirm(this.t('confirm_del_folder', name))) this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: true }); }
  
  // Updated delete to use ID
  del(id) { 
      if(confirm(this.t('confirm_del_item'))) this._hass.callService('home_organizer', 'delete_item', { item_id: id, current_path: this.currentPath, is_folder: false }); 
  }
  
  deleteSubloc(name) { 
      const realName = this.resolveRealName(name);
      if(confirm(this.t('confirm_del_item', name))) this._hass.callService('home_organizer', 'delete_item', { item_name: realName, current_path: this.currentPath, is_folder: true }); 
  }

  render() { this.updateUI(); }
  
  navigate(dir, name, catalogId) { 
      if (dir === 'root') {
          this.currentPath = []; 
          this.catalogPath = [];
      } else if (dir === 'up') {
          this.currentPath.pop(); 
          this.catalogPath.pop();
      } else if (dir === 'down') {
          this.currentPath.push(name); 
          this.catalogPath.push(catalogId);
      }
      this.expandedSublocs.clear();
      this.fetchData(); 
  }

  toggleRow(id) { 
      const nId = Number(id);
      this.expandedIdx = (this.expandedIdx === nId) ? null : nId; 
      this.render(); 
  }
  updateQty(id, d) { this.callHA('update_qty', { item_id: id, change: d }); }
  submitShopStock(id) { 
      const qty = this.shopQuantities[id] || 1;
      this.callHA('update_stock', { item_id: id, quantity: qty }); 
      delete this.shopQuantities[id];
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

  enableSublocRename(btn, oldName) {
      const header = btn.closest('.group-separator');
      if (header.querySelector('input')) return; 
      const titleSpan = header.querySelector('.subloc-title') || header.querySelector('span');
      if(!titleSpan) return;
      const input = document.createElement('input');
      input.value = oldName;
      input.style.background = 'var(--bg-input-edit)';
      input.style.color = 'var(--text-main)';
      input.style.border = '1px solid var(--primary)';
      input.style.borderRadius = '4px';
      input.style.padding = '4px';
      input.style.fontSize = '14px';
      input.style.width = '200px'; 
      input.onclick = (e) => e.stopPropagation();
      titleSpan.replaceWith(input);
      input.focus();
      let isSaving = false;
      
      const save = () => {
          if (isSaving) return;
          isSaving = true;
          const newVal = input.value.trim();
          if (newVal && newVal !== oldName) {
              const newSpan = document.createElement('span');
              newSpan.className = 'subloc-title';
              newSpan.innerText = newVal;
              newSpan.style.opacity = '0.7';
              input.replaceWith(newSpan);
              
              // FIX: Resolve real name (which might include ORDER_MARKER_010_...)
              const realOldName = this.resolveRealName(oldName);
              
              // Calculate new name preserving marker prefix if it exists
              let finalNewName = newVal;
              const markerRegex = /^(ORDER_MARKER_\d+_)(.*)$/;
              const match = realOldName.match(markerRegex);
              if (match) {
                  finalNewName = match[1] + newVal; // Keep prefix, change name
              }

              this.callHA('update_item_details', { 
                  original_name: realOldName, 
                  new_name: finalNewName, 
                  new_date: "", 
                  current_path: this.currentPath, 
                  is_folder: true 
              }).catch(err => {
                  newSpan.innerText = oldName; newSpan.style.opacity = '1'; alert(this.t('failed_rename'));
              });
          } else {
              const originalSpan = document.createElement('span');
              originalSpan.className = 'subloc-title'; originalSpan.innerText = oldName; input.replaceWith(originalSpan);
          }
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
      input.onblur = () => save();
  }

  openIconPicker(target, context) {
      // If target is ID (number/string ID), store it. If name (folder), store name.
      // Context 'item' implies target is ID. Context 'room'/'location' implies target is name.
      if (context === 'item') {
           this.pendingItemId = target;
           this.pendingFolderIcon = null; // Clear folder target
      } else {
           this.pendingFolderIcon = target;
           this.pendingItemId = null;
      }
      
      this.pickerContext = context; 
      this.pickerPage = 0; 
      if (context === 'item') { this.pickerCategory = Object.keys(ICON_LIB_ITEM)[0]; } else { this.pickerCategory = null; }
      this.renderIconPickerGrid();
      this.shadowRoot.getElementById('icon-modal').style.display = 'flex';
  }

  getCurrentPickerLib() {
      if (this.pickerContext === 'room') return ICON_LIB_ROOM;
      if (this.pickerContext === 'location') return ICON_LIB_LOCATION;
      if (this.pickerContext === 'item') { return ICON_LIB_ITEM[this.pickerCategory] || {}; }
      return ICON_LIB;
  }

  renderIconPickerGrid() {
      const lib = this.getCurrentPickerLib();
      const keys = Object.keys(lib);
      const totalPages = Math.ceil(keys.length / this.pickerPageSize);
      const grid = this.shadowRoot.getElementById('icon-lib-grid');
      const categoryBar = this.shadowRoot.getElementById('picker-categories');
      const pageInfo = this.shadowRoot.getElementById('picker-page-info');
      const prevBtn = this.shadowRoot.getElementById('picker-prev');
      const nextBtn = this.shadowRoot.getElementById('picker-next');

      if (this.pickerContext === 'item') {
          categoryBar.style.display = 'flex';
          categoryBar.innerHTML = '';
          Object.keys(ICON_LIB_ITEM).forEach(cat => {
              const btn = document.createElement('button');
              btn.className = `cat-btn ${this.pickerCategory === cat ? 'active' : ''}`;
              const firstIconKey = Object.keys(ICON_LIB_ITEM[cat])[0];
              const sampleIcon = ICON_LIB_ITEM[cat][firstIconKey] || '';
              btn.innerHTML = `${sampleIcon}<span>${cat}</span>`;
              btn.onclick = () => { this.pickerCategory = cat; this.pickerPage = 0; this.renderIconPickerGrid(); };
              categoryBar.appendChild(btn);
          });
      } else { categoryBar.style.display = 'none'; }

      grid.innerHTML = '';
      const start = this.pickerPage * this.pickerPageSize;
      const end = Math.min(start + this.pickerPageSize, keys.length);
      const pageKeys = keys.slice(start, end);

      pageKeys.forEach(key => {
          const div = document.createElement('div');
          div.className = 'lib-icon';
          div.innerHTML = `${lib[key]}<span>${key}</span>`;
          div.onclick = () => this.selectLibraryIcon(lib[key]);
          grid.appendChild(div);
      });

      pageInfo.innerText = `Page ${this.pickerPage + 1} of ${totalPages || 1}`;
      prevBtn.disabled = this.pickerPage === 0;
      nextBtn.disabled = this.pickerPage >= totalPages - 1;
  }

  selectLibraryIcon(svgHtml) {
      let source = svgHtml;
      const size = 140; 
      if (!source.includes('xmlns')) source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      if (source.includes('width=')) { source = source.replace(/width="[^"]*"/, `width="${size}"`).replace(/height="[^"]*"/, `height="${size}"`); } 
      else { source = source.replace('<svg', `<svg width="${size}" height="${size}"`); }
      source = source.replace('<svg', '<svg fill="#4fc3f7"');
      const img = new Image();
      const blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (this.pickerContext === 'item') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size); }
          ctx.drawImage(img, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/png');
          
          if(this.pendingItemId) {
              // Item Update
              this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
          } else if(this.pendingFolderIcon) {
              // Folder Update
              const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
              const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
              this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          }
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
          URL.revokeObjectURL(url);
      };
      img.src = url;
  }

  handleUrlIcon(url) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          try {
              const dataUrl = canvas.toDataURL('image/jpeg');
              
              if(this.pendingItemId) {
                   this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
              } else if(this.pendingFolderIcon) {
                  const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
                  const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
                  this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
              }
              this.shadowRoot.getElementById('icon-modal').style.display = 'none';
              this.shadowRoot.getElementById('icon-url-input').value = '';
          } catch(e) { alert("CORS prevented saving this image. Try uploading the file directly."); }
      };
      img.src = url;
  }

  handleIconUpload(input) {
      const file = input.files[0]; if (!file) return;
      this.compressImage(file, (dataUrl) => {
          if(this.pendingItemId) {
               this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
          } else if(this.pendingFolderIcon) {
              const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
              const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
              this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          }
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
      });
      input.value = '';
  }

  compressImage(file, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX = 1024;
              let w = img.width, h = img.height;
              if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } }
              canvas.width = w; canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              callback(canvas.toDataURL('image/jpeg', 0.5));
          };
          img.src = e.target.result;
      };
      reader.readAsDataURL(file);
  }

  pasteItem() { this.callHA('paste_item', { target_path: this.currentPath }); }
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  // del(name) replaced by del(id) above
  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
