// Home Organizer Ultimate - Ver 7.0.0 (Two-Step AI UI)
// License: MIT

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=6.6.6';
import { ITEM_CATEGORIES } from './organizer-data.js?v=6.6.7';

class HomeOrganizerPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.currentPath = [];
      this.catalogPath = []; 
      this.isEditMode = false;
      this.isSearch = false;
      this.isShopMode = false;
      this.isChatMode = false; 
      this.chatHistory = []; 
      this.viewMode = 'list'; 
      this.expandedIdx = null; 
      this.lastAI = "";
      this.localData = null; 
      this.pendingItem = null;
      this.pendingItemId = null;
      this.pendingFolderIcon = null; 
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
      this.allDbItems = []; 

      this.loadingSet = new Set(); 
      this.imageVersions = {}; 

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
      this.fetchAllItems(); 
    }

    if (this._hass && this._hass.connection && !this.subscribed) {
        this.subscribed = true;
        this._hass.connection.subscribeEvents((e) => this.fetchData(), 'home_organizer_db_update');
        this._hass.connection.subscribeEvents((e) => {
              if (e.data.mode === 'identify') { /* AI logic */ }
        }, 'home_organizer_ai_result');
        
        // SUBSCRIBE TO CHAT PROGRESS EVENT
        this._hass.connection.subscribeEvents((e) => this.handleChatProgress(e.data), 'home_organizer_chat_progress');
        
        this.fetchData();
        this._hass.connection.subscribeEvents(() => this.fetchAllItems(), 'home_organizer_db_update');
    }
  }

  handleChatProgress(data) {
    if (!this.isChatMode) return;
    
    // Append to the last status message, or update it
    let statusMsg = this.chatHistory.find(msg => msg.isStatus);
    
    if (statusMsg) {
       // Append new step nicely
       if (data.step) {
           statusMsg.text += `<br>✔ ${data.step}`;
       }
       
       if (data.sql_debug) {
           statusMsg.text += `
             <details class="debug-details">
                <summary class="debug-summary">▶ SQL Data (Raw)</summary>
                <div class="debug-content">${data.sql_debug}</div>
             </details>
           `;
       }
       if (data.context) {
           statusMsg.text += `
             <details class="debug-details">
                <summary class="debug-summary">▶ AI Context (Prompt)</summary>
                <div class="debug-content">${data.context}</div>
             </details>
           `;
       }
       
       this.render(); // Re-render immediately
       
       // Auto-scroll
       setTimeout(() => {
          const msgs = this.shadowRoot.querySelector('.chat-messages');
          if(msgs) msgs.scrollTop = msgs.scrollHeight;
       }, 50);
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
      if (!this.translations[key]) return key.replace(/^cat_|^sub_|^unit_|^zone_/, '').replace(/_/g, ' '); 
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

  setLoading(target, state) {
      if(state) this.loadingSet.add(target);
      else this.loadingSet.delete(target);
      this.render();
  }

  refreshImageVersion(target) {
      this.imageVersions[target] = Date.now();
  }

  initUI() {
    this.content = true;
    this.attachShadow({mode: 'open'});
    const timestamp = new Date().getTime();
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/home_organizer_static/organizer-panel.css?v=${timestamp}">
      
      <div class="app-container" id="app">
        <!-- Main Top Bar (60px) -->
        <div class="top-bar">
            <div class="setup-wrapper">
                <button class="nav-btn" id="btn-user-setup">
                    ${ICONS.settings}
                </button>
                <div class="setup-dropdown" id="setup-dropdown-menu">
                    <!-- Dynamic Menu Container -->
                    <div id="menu-main">
                        <div class="dropdown-item" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('lang')">
                            ${ICONS.language}
                            ${this.t('language')}
                        </div>
                        <div class="dropdown-item" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('theme')">
                            ${ICONS.theme}
                            ${this.t('theme')}
                        </div>
                    </div>
                    <!-- Language Submenu (Dynamic) -->
                    <div id="menu-lang" style="display:none">
                        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
                           ${ICONS.back}
                           ${this.t('back')}
                        </div>
                    </div>
                    <!-- Theme Submenu -->
                    <div id="menu-theme" style="display:none">
                        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
                           ${ICONS.back}
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
                <button class="nav-btn" id="btn-chat" style="display:none;" title="AI Chat">${ICONS.robot}</button>
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
                    ${ICONS.id_card}
                </button>
                <button class="nav-btn" id="btn-view-toggle" style="display:none;">
                   <span id="icon-view-grid" style="display:block">${ICONS.view_grid}</span>
                   <span id="icon-view-list" style="display:none">${ICONS.view_list}</span>
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
      
      <!-- Icon Picker Modal -->
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
      
      <!-- Camera Modal -->
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

      <!-- Image Overlay -->
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
  
  handleNameInput(input, itemId) {
      const val = input.value.toLowerCase();
      const parent = input.parentElement; 
      
      const old = parent.querySelector('.suggestions-box');
      if(old) old.remove();

      if(val.length < 2) return;

      const matches = this.allDbItems.filter(i => i.name.toLowerCase().startsWith(val));
      if(matches.length === 0) return;

      const box = document.createElement('div');
      box.className = 'suggestions-box';
      
      matches.slice(0, 5).forEach(match => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          let imgHtml = '';
          if(match.image_path) {
              imgHtml = `<img src="${match.image_path}" class="suggestion-img">`;
          }
          div.innerHTML = `${imgHtml}<span>${match.name}</span>`;
          div.onmousedown = (e) => {
              e.preventDefault(); 
              this.applySuggestion(itemId, match);
              box.remove();
          };
          box.appendChild(div);
      });
      
      parent.appendChild(box);
  }

  applySuggestion(itemId, match) {
      const nameInput = this.shadowRoot.getElementById(`name-${itemId}`);
      if(nameInput) nameInput.value = match.name;
      
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
      
      setTimeout(() => this.fetchData(), 200); 
  }

  renderMenu() {
      const menuLang = this.shadowRoot.getElementById('menu-lang');
      if (!menuLang) return;
      
      let html = `
        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
           ${ICONS.back}
           ${this.t('back')}
        </div>
      `;
      
      if (this.availableLangs && this.availableLangs.length > 0) {
          this.availableLangs.forEach(lang => {
              const display = lang.toUpperCase(); 
              html += `<div class="dropdown-item" onclick="this.getRootNode().host.changeLanguage('${lang}')">${display}</div>`;
          });
      } else {
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
        this.renderMenu();
        const menu = root.getElementById('setup-dropdown-menu');
        this.showMenu('main');
        menu.classList.toggle('show');
    });

    window.addEventListener('click', () => {
        root.getElementById('setup-dropdown-menu')?.classList.remove('show');
    });
    
    const menu = root.getElementById('setup-dropdown-menu');
    if(menu) menu.onclick = (e) => e.stopPropagation();

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { 
        this.isShopMode = false; this.isSearch = false; this.isChatMode = false; 
        this.navigate('root'); 
    });
    click('btn-shop', () => { 
        this.isShopMode = !this.isShopMode; 
        if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; this.isChatMode = false; } 
        this.fetchData(); 
    });
    click('btn-search', () => { 
        this.isSearch = true; this.isShopMode = false; this.isChatMode = false; 
        this.render(); 
    });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    bind('search-input', 'oninput', (e) => this.fetchData());
    click('btn-edit', () => { 
        this.isEditMode = !this.isEditMode; this.isShopMode = false; this.isChatMode = false;
        this.render(); 
    });
    
    // NEW: Chat Button Handler
    click('btn-chat', () => {
        this.isChatMode = !this.isChatMode;
        if(this.isChatMode) { this.isShopMode = false; this.isSearch = false; this.isEditMode = false; }
        this.render();
    });
    
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
      
      const dir = (this.translations && this.translations['_direction'] && this.translations['_direction'][lang]) || 'ltr';
      const app = this.shadowRoot.getElementById('app');
      app.style.direction = dir;
      
      if (dir === 'ltr') app.classList.add('ltr'); else app.classList.remove('ltr');
      
      this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
      this.render(); 
  }
  
  toggleWhiteBG() {
      this.useAiBg = !this.useAiBg;
      const btn = this.shadowRoot.getElementById('btn-cam-wb');
      if (this.useAiBg) btn.classList.add('active'); else btn.classList.remove('active');
  }

  async openCamera(context) {
      this.cameraContext = context;
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn("Secure context required for Camera API. Switching to native file input.");
          this.openNativeCamera(context);
          return;
      }

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

  openNativeCamera(context) {
      let input = this.shadowRoot.getElementById('native-camera-input');
      if (!input) {
          input = document.createElement('input');
          input.id = 'native-camera-input';
          input.type = 'file';
          input.accept = 'image/*';
          input.capture = 'environment';
          input.style.display = 'none';
          this.shadowRoot.appendChild(input);
      }
      
      input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          this.compressImage(file, async (dataUrl) => {
              const targetId = this.pendingItemId || this.pendingItem;
              const isSearch = context === 'search';

              if (!isSearch && targetId) {
                  this.setLoading(targetId, true);
              }

              try {
                  if (isSearch) {
                      await this.callHA('ai_action', { mode: 'search', image_data: dataUrl });
                  } else if (this.pendingItemId) {
                      await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
                      this.refreshImageVersion(this.pendingItemId);
                  } else if (this.pendingItem) {
                      await this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
                      this.refreshImageVersion(this.pendingItem);
                  }
              } catch(e) { console.error(e); }
              finally {
                  if (!isSearch && targetId) this.setLoading(targetId, false);
                  this.pendingItemId = null;
                  this.pendingItem = null;
              }
          }, this.useAiBg); 
          
          input.value = ''; 
      };
      
      input.click();
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

  async snapPhoto() {
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
      
      const targetId = this.pendingItemId || this.pendingItem;
      const isSearch = this.cameraContext === 'search';

      if (!isSearch && targetId) {
          this.setLoading(targetId, true);
      }

      try {
          if (isSearch) {
              await this.callHA('ai_action', { mode: 'search', image_data: dataUrl });
          } else if (this.pendingItemId) {
              await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
              this.refreshImageVersion(this.pendingItemId);
          } else if (this.pendingItem) {
              await this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
              this.refreshImageVersion(this.pendingItem);
          }
      } catch(e) { console.error(e); }
      finally {
          if(!isSearch && targetId) this.setLoading(targetId, false);
          this.pendingItemId = null;
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
        this.isChatMode ? "AI Chat Assistant" : 
        (this.isShopMode ? this.t('shopping_list') : 
        (this.isSearch ? this.t('search_results') : 
        (attrs.path_display === "Main" ? this.t('default_path') : attrs.path_display)));
        
    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    // NEW: Show/Hide Chat Button
    const chatBtn = root.getElementById('btn-chat');
    if (attrs.enable_ai) {
        chatBtn.style.display = 'flex';
        chatBtn.classList.toggle('active', this.isChatMode);
    } else {
        chatBtn.style.display = 'none';
    }

    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');
    
    const editBtn = root.getElementById('btn-edit');
    if (editBtn) {
        if (this.isEditMode) editBtn.classList.add('edit-active');
        else editBtn.classList.remove('edit-active');
    }

    const content = root.getElementById('content');
    content.innerHTML = '';
    
    // NEW: Chat Mode Logic
    if (this.isChatMode) {
        this.renderChatUI(content);
        return;
    }

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

    if (attrs.depth === 0) {
        const zoneContainer = document.createElement('div');
        zoneContainer.className = 'item-list';

        const groupedRooms = {};
        const knownZones = new Set();
        
        const zoneRegex = /^\[(.*?)\] (.*)$/;
        const markerRegex = /^ZONE_MARKER_(\d+)_+(.*)$/;

        const zonesList = [];

        if (attrs.folders) {
            attrs.folders.forEach(f => {
                let zone = "General Rooms";
                let displayName = f.name;

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
                    return; 
                }

                const match = f.name.match(zoneRegex);
                if (match) {
                    zone = match[1];
                    displayName = match[2];
                } else if (f.zone) {
                    zone = f.zone;
                }

                if (!groupedRooms[zone]) groupedRooms[zone] = [];
                
                groupedRooms[zone].push({
                    originalName: f.name,
                    displayName: displayName,
                    img: f.img
                });
            });
        }
        
        knownZones.forEach(z => { if (!groupedRooms[z]) groupedRooms[z] = []; });
        if (!groupedRooms["General Rooms"]) groupedRooms["General Rooms"] = [];

        const hasGeneral = zonesList.find(z => z.name === "General Rooms");
        if (!hasGeneral && groupedRooms["General Rooms"].length > 0) {
            zonesList.push({ name: "General Rooms", order: -1, markerName: null });
        }

        Object.keys(groupedRooms).forEach(z => {
            if (!zonesList.find(i => i.name === z)) {
                zonesList.push({ name: z, order: 9999, markerName: null });
            }
        });

        zonesList.sort((a, b) => a.order - b.order);

        zonesList.forEach(zoneObj => {
            const zoneName = zoneObj.name;
            const rooms = groupedRooms[zoneName] || [];
            
            if (zoneName === "General Rooms" && rooms.length === 0 && !this.isEditMode) return;

            const header = document.createElement('div');
            header.className = 'group-separator';
            
            let headerContent = `<span>${this.t('zone_' + zoneName) === ('zone_' + zoneName) ? zoneName : this.t('zone_' + zoneName)}</span>`; 
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
            
            this.setupZoneDropTarget(header, zoneName);
            zoneContainer.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'folder-grid';
            
            rooms.forEach(folder => {
                const rawID = this.getPersistentID('root', folder.originalName);
                const catalogID = this.toAlphaId(rawID);

                const el = document.createElement('div');
                el.className = 'folder-item';
                
                this.setupRoomDragSource(el, folder.originalName);

                el.onclick = () => { if (!this.isEditMode) this.navigate('down', folder.originalName, catalogID); };
                
                let folderContent = ICONS.folder;
                if (folder.img) {
                    const isLoading = this.loadingSet.has(folder.originalName);
                    const ver = this.imageVersions[folder.originalName] || '';
                    const src = folder.img + (folder.img.includes('?') ? '&' : '?') + 'v=' + ver;
                    
                    let loaderHtml = '';
                    if (isLoading) {
                        loaderHtml = `<div class="loader-container"><span class="loader"></span></div>`;
                    }
                    folderContent = `<div style="position:relative;width:100%;height:100%"><img src="${src}" style="width:100%;height:100%;object-fit:contain;border-radius:4px">${loaderHtml}</div>`;
                }

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

            if (this.isEditMode) {
                const addBtn = document.createElement('div');
                addBtn.className = 'folder-item add-folder-card';
                addBtn.innerHTML = `<div class="android-folder-icon">${ICONS.plus}</div><div class="folder-label">${this.t('add_room')}</div>`;
                addBtn.onclick = (e) => this.enableZoneRoomInput(e.currentTarget, zoneName);
                grid.appendChild(addBtn);
            }

            zoneContainer.appendChild(grid);
        });

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
            
            const parentID = this.catalogPath[0] || "";

            if (attrs.folders) {
                attrs.folders.forEach(folder => {
                    const rawID = this.getPersistentID(this.currentPath[0], folder.name);
                    const catalogID = parentID + rawID;

                    const el = document.createElement('div');
                    el.className = 'folder-item';
                    
                    el.onclick = () => this.navigate('down', folder.name, catalogID);
                    
                    let folderContent = ICONS.folder;
                    if (folder.img) {
                        const isLoading = this.loadingSet.has(folder.name);
                        const ver = this.imageVersions[folder.name] || '';
                        const src = folder.img + (folder.img.includes('?') ? '&' : '?') + 'v=' + ver;
                        
                        let loaderHtml = '';
                        if (isLoading) {
                            loaderHtml = `<div class="loader-container"><span class="loader"></span></div>`;
                        }
                        folderContent = `<div style="position:relative;width:100%;height:100%"><img src="${src}" style="width:100%;height:100%;object-fit:contain;border-radius:4px">${loaderHtml}</div>`;
                    }

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
        
        const markerRegex = /^ORDER_MARKER_(\d+)_(.*)$/;
        const orderedGroups = []; 
        const foundMarkers = new Set();

        const rawGroups = new Set();
        if (attrs.folders) attrs.folders.forEach(f => {
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
        
        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if (sub.startsWith("ORDER_MARKER_")) {
                 const match = sub.match(markerRegex);
                 if (match) {
                     const order = parseInt(match[1]);
                     const realName = match[2];
                     if (!orderedGroups.find(g => g.markerKey === sub)) {
                         orderedGroups.push({ name: realName, order: order, markerKey: sub });
                         foundMarkers.add(realName);
                     }
                 }
            } else {
                rawGroups.add(sub);
            }
        });

        rawGroups.forEach(g => {
            if (!foundMarkers.has(g)) {
                let order = 9999;
                if (g === "General") order = -1; 
                orderedGroups.push({ name: g, order: order, markerKey: null });
            }
        });

        orderedGroups.sort((a,b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.name.localeCompare(b.name);
        });

        orderedGroups.forEach(g => grouped[g.name] = []);
        
        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if (!sub.startsWith("ORDER_MARKER_")) {
                if(!grouped[sub]) grouped[sub] = []; 
                grouped[sub].push(item);
            }
        });

        const parentID = this.catalogPath[1] || "";

        orderedGroups.forEach(groupObj => {
            const subName = groupObj.name;
            const items = grouped[subName] || [];
            const count = items.length;
            
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
                          if (item.img) {
                              const isLoading = this.loadingSet.has(item.id);
                              const ver = this.imageVersions[item.id] || '';
                              const src = item.img + (item.img.includes('?') ? '&' : '?') + 'v=' + ver;
                              let loaderHtml = '';
                              if (isLoading) {
                                  loaderHtml = `<div class="loader-container"><span class="loader"></span></div>`;
                              }
                              iconHtml = `<div style="position:relative;width:80%;height:80%"><img src="${src}" style="width:100%;height:100%;object-fit:contain;border-radius:8px">${loaderHtml}</div>`;
                          }
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

  // --- UPDATED CHAT UI ---
  renderChatUI(container) {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-container';
      
      const messagesDiv = document.createElement('div');
      messagesDiv.className = 'chat-messages';
      
      if (this.chatHistory.length === 0) {
          const welcome = document.createElement('div');
          welcome.className = 'message ai';
          welcome.innerHTML = `
            <b>AI Assistant Ready</b><br>
            I have access to your inventory.<br><br>
            <b>Capabilities:</b><br>
            • Recipe suggestions based on ingredients<br>
            • Finding items<br>
            • Organization tips<br><br>
            Ask me anything!
          `;
          messagesDiv.appendChild(welcome);
      }
      
      this.chatHistory.forEach(msg => {
          const div = document.createElement('div');
          div.className = `message ${msg.role}`;
          div.innerHTML = msg.text; 
          
          if(msg.isStatus) {
              div.id = 'chat-status-msg'; 
          }
          
          messagesDiv.appendChild(div);
      });
      
      chatContainer.appendChild(messagesDiv);
      
      const inputBar = document.createElement('div');
      inputBar.className = 'chat-input-bar';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'chat-input';
      input.placeholder = "Ask about your inventory...";
      
      const sendBtn = document.createElement('button');
      sendBtn.className = 'chat-send-btn';
      sendBtn.innerHTML = ICONS.send;
      
      const sendMessage = async () => {
          const text = input.value.trim();
          if (!text) return;
          
          this.chatHistory.push({ role: 'user', text: text });
          this.render(); 
          
          // Initial Status Message
          const statusMsg = { role: 'system', text: "Starting Process...<br>Analyzing request...", isStatus: true };
          this.chatHistory.push(statusMsg);
          this.render();
          
          // Scroll to bottom
          setTimeout(() => {
              const msgs = this.shadowRoot.querySelector('.chat-messages');
              if(msgs) msgs.scrollTop = msgs.scrollHeight;
          }, 100);

          try {
              // This triggers the 2-step backend flow
              const result = await this._hass.callWS({
                  type: 'home_organizer/ai_chat',
                  message: text
              });
              
              if (result) {
                   // Replace status message
                   let debugHTML = "";
                   if (result.sql_debug) {
                       debugHTML += `
                         <details class="debug-details">
                            <summary class="debug-summary">▶ SQL Data (Raw)</summary>
                            <div class="debug-content">${result.sql_debug}</div>
                         </details>
                       `;
                   }
                   if (result.context) {
                       debugHTML += `
                         <details class="debug-details">
                            <summary class="debug-summary">▶ AI Context (Prompt)</summary>
                            <div class="debug-content">${result.context}</div>
                         </details>
                       `;
                   }
                   
                   statusMsg.text = "✔ Complete" + debugHTML;

                   if (result.error) {
                       this.chatHistory.push({ role: 'ai', text: "<b>Error:</b> " + result.error });
                   } else if (result.response) {
                       let formatted = result.response.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                       formatted = formatted.replace(/\n/g, '<br>');
                       this.chatHistory.push({ role: 'ai', text: formatted });
                   }
              }
          } catch (e) {
              statusMsg.text += "<br>❌ Failed";
              this.chatHistory.push({ role: 'ai', text: "Error: " + e.message });
          }
          
          this.render();
          setTimeout(() => {
              const msgs = this.shadowRoot.querySelector('.chat-messages');
              if(msgs) msgs.scrollTop = msgs.scrollHeight;
          }, 100);
      };

      sendBtn.onclick = sendMessage;
      input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
      
      inputBar.appendChild(input);
      inputBar.appendChild(sendBtn);
      chatContainer.appendChild(inputBar);
      
      container.appendChild(chatContainer);
      setTimeout(() => messagesDiv.scrollTop = messagesDiv.scrollHeight, 0);
  }

  // Handle the real-time progress event from backend
  handleChatProgress(data) {
    if (!this.isChatMode) return;
    
    // Find the active status message (last one)
    let statusMsg = null;
    for (let i = this.chatHistory.length - 1; i >= 0; i--) {
        if (this.chatHistory[i].role === 'system' && this.chatHistory[i].isStatus) {
            statusMsg = this.chatHistory[i];
            break;
        }
    }
    
    if (statusMsg) {
       // Append the new step
       if (data.step) {
           // Prevent duplicate step logging
           if (!statusMsg.text.includes(data.step)) {
                statusMsg.text += `<br>✔ ${data.step}`;
                if (data.details) statusMsg.text += `<br><small style="margin-inline-start:15px;color:#888">${data.details}</small>`;
           }
       }
       
       this.render(); 
       
       // Auto-scroll
       setTimeout(() => {
          const msgs = this.shadowRoot.querySelector('.chat-messages');
          if(msgs) msgs.scrollTop = msgs.scrollHeight;
       }, 50);
    }
  }

  // [ ... rest of class methods like resolveRealName, moveSubLoc, etc. must remain ... ]
  // IMPORTANT: Ensure you include all existing methods from your original file here.
  // I am putting simplified placeholders for methods required by the updateUI loop.
  
  resolveRealName(displayName) {
      if (!this.localData) return displayName;
      
      if (this.localData.folders) {
          const markerRegex = new RegExp(`^ORDER_MARKER_\\d+_${displayName}$`);
          const found = this.localData.folders.find(f => f.name.match(markerRegex));
          if (found) return found.name;
      }
      
      if (this.localData.items) {
          const markerRegex = new RegExp(`^ORDER_MARKER_\\d+_${displayName}$`);
          const found = this.localData.items.find(i => i.sub_location && i.sub_location.match(markerRegex));
          if (found) return found.sub_location;
      }
      
      return displayName;
  }

  async moveSubLoc(subName, direction) {
      const subGroups = [];
      const markerRegex = /^ORDER_MARKER_(\d+)_(.*)$/;
      const seen = new Set();
      const currentMarkers = {}; 

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

      subGroups.sort((a,b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.name.localeCompare(b.name);
      });
      
      const idx = subGroups.findIndex(g => g.name === subName);
      if (idx === -1) return;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= subGroups.length) return;

      [subGroups[idx], subGroups[newIdx]] = [subGroups[newIdx], subGroups[idx]];

      for (let i = 0; i < subGroups.length; i++) {
          const g = subGroups[i];
          const newOrder = (i + 1) * 10;
          const padded = String(newOrder).padStart(3, '0');
          const newMarkerName = `ORDER_MARKER_${padded}_${g.name}`;
          const oldMarkerName = currentMarkers[g.name];

          if (g.name !== "General") {
              if (oldMarkerName && oldMarkerName !== newMarkerName) {
                  await this.callHA('update_item_details', { 
                      original_name: oldMarkerName, 
                      new_name: newMarkerName,
                      current_path: this.currentPath, 
                      is_folder: true 
                  });
              } else if (!oldMarkerName) {
                  await this.callHA('add_item', { 
                      item_name: "OrderMarker", 
                      item_type: 'item', 
                      current_path: [...this.currentPath, newMarkerName]
                  });
              }
          }
      }
      this.fetchData();
  }

  createNewZone() {
      let base = "New Zone";
      let name = base;
      let count = 1;
      const existingZones = new Set();
      if (this.localData && this.localData.folders) {
          this.localData.folders.forEach(f => { 
              if(f.zone) existingZones.add(f.zone);
              if(f.name.startsWith("ZONE_MARKER_")) existingZones.add(f.name.replace(/^ZONE_MARKER_\d+_/, "").trim());
          });
      }
      while (existingZones.has(name)) {
          name = `${base} ${count++}`;
      }
      
      const markerName = "ZONE_MARKER_999_" + name;
      this.callHA('add_item', { item_name: markerName, item_type: 'folder', zone: name, current_path: [] });
  }

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

  moveZone(zoneName, direction) {
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
                      zName = f.name.replace("ZONE_MARKER_", "").trim();
                  }
                  if (!seen.has(zName)) {
                      zones.push({ name: zName, order: zOrder, markerName: f.name });
                      seen.add(zName);
                  }
              }
          });
      }
      
      zones.sort((a,b) => a.order - b.order);
      
      const idx = zones.findIndex(z => z.name === zoneName);
      if (idx === -1) return; 
      
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= zones.length) return; 
      
      const temp = zones[idx];
      zones[idx] = zones[newIdx];
      zones[newIdx] = temp;
      
      zones.forEach((z, index) => {
          const newOrder = (index + 1) * 10;
          const paddedOrder = String(newOrder).padStart(3, '0');
          const newMarkerName = `ZONE_MARKER_${padded}_${z.name}`;
          
          if (z.markerName !== newMarkerName) {
              this.callHA('update_item_details', { 
                  original_name: z.markerName, 
                  new_name: newMarkerName,
                  current_path: [], 
                  is_folder: true 
              });
          }
      });
      
      setTimeout(() => this.fetchData(), 600);
  }

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
          const markerRegex = new RegExp(`^ZONE_MARKER_\\d+_${oldZone}$`); 
          
          this.localData.folders.forEach(f => {
              if (f.name.startsWith("ZONE_MARKER_") && f.name.endsWith(`_${oldZone}`)) {
                    const prefix = f.name.substring(0, f.name.lastIndexOf(`_${oldZone}`)); 
                    this.callHA('update_item_details', { 
                        original_name: f.name, 
                        new_name: `${prefix}_${newZone}`,
                        current_path: [], 
                        is_folder: true 
                    });
              } 
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
     if (item.img) {
         const isLoading = this.loadingSet.has(item.id);
         const ver = this.imageVersions[item.id] || '';
         const src = item.img + (item.img.includes('?') ? '&' : '?') + 'v=' + ver;
         
         let loaderHtml = '';
         if (isLoading) {
             loaderHtml = `<div class="loader-container"><span class="loader"></span></div>`;
         }
         iconHtml = `<div style="position:relative;width:40px;height:40px"><img src="${src}" class="item-thumbnail" alt="${item.name}" onclick="event.stopPropagation(); this.getRootNode().host.showImg('${item.img}')">${loaderHtml}</div>`;
     }

     div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.id}')">
            <div class="item-left">${iconHtml}<div><div>${item.name}</div><div class="sub-title">${subText}</div></div></div>
            <div class="item-qty-ctrl">${controls}</div>
        </div>
     `;
     
     if (this.expandedIdx === item.id) {
         const details = document.createElement('div');
         details.className = 'expanded-details';
         
         let roomOptions = `<option value="">-- ${this.t('move_to')} --</option>`;
         if(this.localData.hierarchy) Object.keys(this.localData.hierarchy).forEach(room => { roomOptions += `<option value="${room}">${room}</option>`; });

         let mainCatOptions = `<option value="">${this.t('select_cat')}</option>`;
         Object.keys(ITEM_CATEGORIES).forEach(cat => {
             const selected = (item.category === cat) ? 'selected' : '';
             mainCatOptions += `<option value="${cat}" ${selected}>${this.t('cat_' + cat.replace(/[^a-zA-Z0-9]+/g, '_')) || cat}</option>`;
         });

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
         
         const COPY_SVG = ICONS.copy || ICONS.paste;

         details.innerHTML = `
            <div class="detail-row">
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

      if (type === 'main') {
          let html = `<option value="">${this.t('select_sub')}</option>`;
          if (mainCat && ITEM_CATEGORIES[mainCat]) {
              Object.keys(ITEM_CATEGORIES[mainCat]).forEach(sub => {
                  const transKey = 'sub_' + sub.replace(/[^a-zA-Z0-9]+/g, '_');
                  html += `<option value="${sub}">${this.t(transKey) || sub}</option>`;
              });
          }
          subSelect.innerHTML = html;
          subCat = ""; 
          unitDisp.innerText = "-";
      }

      if (mainCat && subCat && ITEM_CATEGORIES[mainCat] && ITEM_CATEGORIES[mainCat][subCat]) {
          unit = ITEM_CATEGORIES[mainCat][subCat];
          unitDisp.innerText = this.t('unit_' + unit) || unit;
      } else {
          unitDisp.innerText = "-";
      }

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
      this.callHA('clipboard_action', {action: 'cut', item_id: itemId});
      setTimeout(() => { this.callHA('paste_item', {target_path: targetPath}); }, 100);
  }

  deleteFolder(name) { if(confirm(this.t('confirm_del_folder', name))) this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: true }); }
  
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
  
  openIconPicker(target, context) {
      if (context === 'item') {
           this.pendingItemId = target;
           this.pendingFolderIcon = null; 
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

  async selectLibraryIcon(svgHtml) {
      let source = svgHtml;
      const size = 140; 
      if (!source.includes('xmlns')) source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      if (source.includes('width=')) { source = source.replace(/width="[^"]*"/, `width="${size}"`).replace(/height="[^"]*"/, `height="${size}"`); } 
      else { source = source.replace('<svg', `<svg width="${size}" height="${size}"`); }
      source = source.replace('<svg', '<svg fill="#4fc3f7"');
      
      const loadImage = (src) => new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
      });

      const blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const img = await loadImage(url);
      
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (this.pickerContext === 'item') { 
          ctx.fillStyle = '#000'; 
          ctx.fillRect(0, 0, size, size);
          const padding = size * 0.15; 
          const drawSize = size * 0.7; 
          ctx.drawImage(img, padding, padding, drawSize, drawSize);
      } else {
          ctx.drawImage(img, 0, 0, size, size);
      }

      const dataUrl = canvas.toDataURL('image/png');
      
      const target = this.pendingItemId || this.pendingFolderIcon;
      if (target) this.setLoading(target, true);
      this.shadowRoot.getElementById('icon-modal').style.display = 'none';

      try {
          if(this.pendingItemId) {
              await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
              this.refreshImageVersion(this.pendingItemId);
          } else if(this.pendingFolderIcon) {
              const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
              const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
              await this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
              this.refreshImageVersion(this.pendingFolderIcon);
          }
      } catch(e) { console.error(e); }
      finally {
          if(target) this.setLoading(target, false);
          URL.revokeObjectURL(url);
      }
  }

  async handleUrlIcon(url) {
      const loadImage = (src) => new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
      });

      try {
          const img = await loadImage(url);
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg');
          
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
          this.shadowRoot.getElementById('icon-url-input').value = '';

          const target = this.pendingItemId || this.pendingFolderIcon;
          if (target) this.setLoading(target, true);

          try {
              if(this.pendingItemId) {
                   await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
                   this.refreshImageVersion(this.pendingItemId);
              } else if(this.pendingFolderIcon) {
                  const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
                  const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
                  await this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
                  this.refreshImageVersion(this.pendingFolderIcon);
              }
          } finally {
              if(target) this.setLoading(target, false);
          }
      } catch(e) { alert("Error loading image (CORS or Invalid URL)."); }
  }

  handleIconUpload(input) {
      const file = input.files[0]; if (!file) return;
      this.compressImage(file, async (dataUrl) => {
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
          
          const target = this.pendingItemId || this.pendingFolderIcon;
          if (target) this.setLoading(target, true);

          try {
              if(this.pendingItemId) {
                   await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl });
                   this.refreshImageVersion(this.pendingItemId);
              } else if(this.pendingFolderIcon) {
                  const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
                  const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
                  await this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
                  this.refreshImageVersion(this.pendingFolderIcon);
              }
          } catch(e) { console.error(e); }
          finally {
              if(target) this.setLoading(target, false);
          }
      });
      input.value = '';
  }

  compressImage(file, callback, applyBgFilter = false) {
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
              
              if (applyBgFilter) {
                  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  let data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                      let r = data[i], g = data[i+1], b = data[i+2];
                      if (r > 190 && g > 190 && b > 190) { data[i] = 255; data[i+1] = 255; data[i+2] = 255; }
                  }
                  ctx.putImageData(imageData, 0, 0);
              }

              callback(canvas.toDataURL('image/jpeg', 0.5));
          };
          img.src = e.target.result;
      };
      reader.readAsDataURL(file);
  }

  pasteItem() { this.callHA('paste_item', { target_path: this.currentPath }); }
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
