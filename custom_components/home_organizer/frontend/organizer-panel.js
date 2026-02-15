// Home Organizer Ultimate - Ver 7.6.3 (Fix: Pre-filled Buttons, Shop List Edit, Delayed Save)
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
      
      this.chatImage = null; 
      this.chatMimeType = "image/jpeg";
      
      this.locationEditIds = new Set();
      this.locationEditState = {};
        
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
        
        this._hass.connection.subscribeEvents((e) => this.handleChatProgress(e.data), 'home_organizer_chat_progress');
        
        this.fetchData();
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
    
    const UPLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>';
    
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/home_organizer_static/organizer-panel.css?v=${timestamp}">
      
      <div class="app-container" id="app">
        <div class="top-bar">
            <div class="setup-wrapper">
                <button class="nav-btn" id="btn-user-setup">
                    ${ICONS.settings}
                </button>
                <div class="setup-dropdown" id="setup-dropdown-menu">
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
                    <div id="menu-lang" style="display:none">
                        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
                           ${ICONS.back}
                           ${this.t('back')}
                        </div>
                    </div>
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
                <input type="text" id="search-input" placeholder="${this.t('search_placeholder')}" style="width:100%;padding:8px;padding-inline-start:65px;border-radius:8px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border-input)">
                <button class="nav-btn ai-btn" id="btn-ai-search" style="position:absolute;inset-inline-start:0;top:0;height:100%;background:none;border:none;">
                    ${ICONS.camera}
                </button>
                <button class="nav-btn ai-btn" id="btn-ai-upload" style="position:absolute;inset-inline-start:30px;top:0;height:100%;background:none;border:none;" title="Upload File">
                    ${UPLOAD_SVG}
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
      
      <input type="file" id="universal-file-upload" accept="image/*,application/pdf" style="display:none">
    `;

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          console.warn("Camera access requires HTTPS.");
    }

    let currentLang = localStorage.getItem('home_organizer_lang');
    if (!currentLang && this._hass) {
        if (this._hass.language === 'he') {
            currentLang = 'he';
        } else {
            currentLang = 'en'; 
        }
        localStorage.setItem('home_organizer_lang', currentLang);
    }
    
    if (currentLang === 'en') {
        this.shadowRoot.getElementById('app').classList.add('ltr');
    }

    let currentTheme = localStorage.getItem('home_organizer_theme');
    if (!currentTheme && this._hass) {
        currentTheme = (this._hass.themes && this._hass.themes.darkMode) ? 'dark' : 'light';
        localStorage.setItem('home_organizer_theme', currentTheme);
    }

    if (currentTheme === 'light') {
        this.shadowRoot.getElementById('app').classList.add('light-mode');
    }
    
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
    click('btn-ai-upload', () => this.openFileUpload('search'));
    
    click('btn-cam-close', () => this.stopCamera());
    click('btn-cam-snap', () => this.snapPhoto());
    click('btn-cam-switch', () => this.switchCamera());
    click('btn-cam-wb', () => this.toggleWhiteBG());
  }
  
  openFileUpload(context) {
      const input = this.shadowRoot.getElementById('universal-file-upload');
      if (!input) return;
      
      input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          if (file.size > 10 * 1024 * 1024) {
              alert("File is too large. Max size is 10MB.");
              input.value = '';
              return;
          }

          if (file.type === 'application/pdf') {
              const reader = new FileReader();
              reader.onload = async (re) => {
                  this.processUploadedFile(re.target.result, context, 'application/pdf');
              };
              reader.readAsDataURL(file);
          } else {
              this.compressImage(file, (dataUrl) => {
                  this.processUploadedFile(dataUrl, context, 'image/jpeg');
              }, this.useAiBg);
          }
          input.value = ''; 
      };
      input.click();
  }

  async processUploadedFile(dataUrl, context, mimeType) {
      const isSearch = context === 'search';
      const isChat = context === 'chat';
      
      if (isChat) {
          this.chatImage = dataUrl;
          this.chatMimeType = mimeType;
          this.render();
          return;
      }

      const targetId = this.pendingItemId || this.pendingItem;
      if (!isSearch && targetId) {
          this.setLoading(targetId, true);
      }

      try {
          if (isSearch) {
              await this.callHA('ai_action', { mode: 'search', image_data: dataUrl, mime_type: mimeType });
          } else if (this.pendingItemId) {
              await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl, mime_type: mimeType });
              this.refreshImageVersion(this.pendingItemId);
          } else if (this.pendingItem) {
              await this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl, mime_type: mimeType });
              this.refreshImageVersion(this.pendingItem);
          }
      } catch(e) { console.error(e); }
      finally {
          if (!isSearch && targetId) this.setLoading(targetId, false);
          this.pendingItemId = null;
          this.pendingItem = null;
      }
  }

  // [MODIFIED v7.6.3] Purpose: Initialize edit state properly on toggle
  toggleRow(id) { 
      const nId = Number(id);
      this.expandedIdx = (this.expandedIdx === nId) ? null : nId; 
      
      if (this.expandedIdx === nId) {
          // Initialize edit state when opening the row so dropdowns show current location
          const item = this.localData.items.find(i => i.id == id) || this.localData.shopping_list.find(i => i.id == id);
          if (item) {
              // Ensure path parts are extracted correctly even if item.location is empty but main/sub are set
              const path = item.location ? item.location.split(' > ') : [];
              this.locationEditState[id] = {
                  l1: item.main_location || path[0] || "",
                  l2: item.sub_location || path[1] || "",
                  l3: path[2] || ""
              };
          }
      }
      this.render(); 
  }

  updateHierarchyState(itemId, level, newValue) {
      if (!this.locationEditState[itemId]) return;
      
      this.locationEditState[itemId][`l${level}`] = newValue;
      
      if (level === 1) {
          this.locationEditState[itemId].l2 = "";
          this.locationEditState[itemId].l3 = "";
      } else if (level === 2) {
          this.locationEditState[itemId].l3 = "";
      }
      this.render();
  }
  
  saveHierarchy(itemId) {
      const state = this.locationEditState[itemId];
      if (!state) return;
      
      const newPath = [];
      if (state.l1) newPath.push(state.l1);
      if (state.l2) newPath.push(state.l2);
      if (state.l3) newPath.push(state.l3);
      
      if (newPath.length > 0) {
           this.callHA('update_item_details', { 
              item_id: itemId, 
              new_path: newPath 
          });
      }
      // UI update happens via broadcast_update from backend
  }

  renderLocationControl(item, isShopMode) {
      if (!isShopMode) return `<div class="sub-title">${item.date || ''}</div>`;
      return `<div class="sub-title">${item.location || ''}</div>`;
  }
    
  // [MODIFIED v7.6.3] Purpose: Render 3-button hierarchy with correct current values
  renderHierarchyControl(item) {
      const hierarchy = this.localData.hierarchy || {};
      
      // Use edit state if available, else fallback to item data
      const state = this.locationEditState[item.id] || {};
      const l1 = state.l1 !== undefined ? state.l1 : (item.main_location || '');
      const l2 = state.l2 !== undefined ? state.l2 : (item.sub_location || '');
      const l3 = state.l3 !== undefined ? state.l3 : '';
      
      // [FIX 1] Force current location to be an option if missing from hierarchy keys
      let l1Keys = Object.keys(hierarchy).sort();
      if (l1 && !l1Keys.includes(l1)) { l1Keys.unshift(l1); }

      let l1Opts = `<option value="" disabled ${!l1 ? 'selected' : ''}>${this.t('select')} Room</option>`;
      l1Keys.forEach(k => {
          l1Opts += `<option value="${k}" ${l1 === k ? 'selected' : ''}>${k}</option>`;
      });
      
      let l2Opts = `<option value="" disabled ${!l2 ? 'selected' : ''}>${this.t('select')} Loc</option>`;
      let l2Disabled = true;
      if (l1) {
          l2Disabled = false;
          let l2Keys = (hierarchy[l1] ? Object.keys(hierarchy[l1]).sort() : []);
          if (l2 && !l2Keys.includes(l2)) l2Keys.unshift(l2);
          l2Keys.forEach(k => {
              l2Opts += `<option value="${k}" ${l2 === k ? 'selected' : ''}>${k}</option>`;
          });
      }

      let l3Opts = `<option value="" disabled ${!l3 ? 'selected' : ''}>${this.t('select')} Sub</option>`;
      let l3Disabled = true;
      if (l1 && l2) {
          l3Disabled = false;
          let l3Keys = (hierarchy[l1] && hierarchy[l1][l2] ? hierarchy[l1][l2].sort() : []);
          if (l3 && !l3Keys.includes(l3)) l3Keys.unshift(l3);
          l3Keys.forEach(k => {
              l3Opts += `<option value="${k}" ${l3 === k ? 'selected' : ''}>${k}</option>`;
          });
      }
      
      const sep = `<span class="hierarchy-sep">&gt;</span>`;

      return `
        <div class="hierarchy-container">
            <select class="hierarchy-select" onchange="this.getRootNode().host.updateHierarchyState('${item.id}', 1, this.value)">${l1Opts}</select>
            ${sep}
            <select class="hierarchy-select" ${l2Disabled ? 'disabled' : ''} onchange="this.getRootNode().host.updateHierarchyState('${item.id}', 2, this.value)">${l2Opts}</select>
            ${sep}
            <select class="hierarchy-select" ${l3Disabled ? 'disabled' : ''} onchange="this.getRootNode().host.updateHierarchyState('${item.id}', 3, this.value)">${l3Opts}</select>
            <button class="hierarchy-update-btn" title="Save Location" onclick="this.getRootNode().host.saveHierarchy('${item.id}')">${ICONS.check}</button>
        </div>
      `;
  }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
