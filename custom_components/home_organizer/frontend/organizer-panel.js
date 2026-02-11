// Home Organizer Ultimate - Ver 7.1.9 (Two-Step AI UI + High-Res Invoice Scan + PDF Support)
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
      
      // State for Chat Image/File Upload
      this.chatImage = null; 
        
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
              if (e.data.mode === 'identify') { /* identify logic */ }
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
                    <div id="menu-main">
                        <div class="dropdown-item" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('lang')">
                            ${ICONS.language} ${this.t('language')}
                        </div>
                        <div class="dropdown-item" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('theme')">
                            ${ICONS.theme} ${this.t('theme')}
                        </div>
                    </div>
                    <div id="menu-lang" style="display:none">
                        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
                           ${ICONS.back} ${this.t('back')}
                        </div>
                    </div>
                    <div id="menu-theme" style="display:none">
                        <div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">
                           ${ICONS.back} ${this.t('back')}
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

    let currentLang = localStorage.getItem('home_organizer_lang');
    if (!currentLang && this._hass) {
        currentLang = this._hass.language === 'he' ? 'he' : 'en';
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
          let imgHtml = match.image_path ? `<img src="${match.image_path}" class="suggestion-img">` : '';
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
      let cleanPath = match.image_path ? match.image_path.split('?')[0].split('/').pop() : null;
      this.callHA('update_item_details', { item_id: itemId, original_name: nameInput.value, new_name: match.name, category: match.category, sub_category: match.sub_category, unit: match.unit, unit_value: match.unit_value, image_path: cleanPath });
      setTimeout(() => this.fetchData(), 200); 
  }

  renderMenu() {
      const menuLang = this.shadowRoot.getElementById('menu-lang');
      if (!menuLang) return;
      let html = `<div class="dropdown-item back-btn" onclick="event.stopPropagation(); this.getRootNode().host.showMenu('main')">${ICONS.back}${this.t('back')}</div>`;
      if (this.availableLangs && this.availableLangs.length > 0) {
          this.availableLangs.forEach(lang => {
              html += `<div class="dropdown-item" onclick="this.getRootNode().host.changeLanguage('${lang}')">${lang.toUpperCase()}</div>`;
          });
      } else { html += `<div class="dropdown-item" onclick="this.getRootNode().host.changeLanguage('en')">English</div>`; }
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

    window.addEventListener('click', () => { root.getElementById('setup-dropdown-menu')?.classList.remove('show'); });
    const menu = root.getElementById('setup-dropdown-menu');
    if(menu) menu.onclick = (e) => e.stopPropagation();

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.isSearch = false; this.isChatMode = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; this.isChatMode = false; } this.fetchData(); });
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.isChatMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    bind('search-input', 'oninput', (e) => this.fetchData());
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.isChatMode = false; this.render(); });
    click('btn-chat', () => { this.isChatMode = !this.isChatMode; if(this.isChatMode) { this.isShopMode = false; this.isSearch = false; this.isEditMode = false; } this.render(); });
    click('btn-view-toggle', () => {
        this.viewMode = (this.viewMode === 'list') ? 'grid' : 'list';
        root.getElementById('icon-view-grid').style.display = this.viewMode === 'grid' ? 'none' : 'block';
        root.getElementById('icon-view-list').style.display = this.viewMode === 'grid' ? 'block' : 'none';
        this.render();
    });
    click('btn-toggle-ids', () => this.toggleIds());
    click('btn-paste', () => this.pasteItem());
    click('btn-load-url', () => { const url = root.getElementById('icon-url-input').value; if(url) this.handleUrlIcon(url); });
    bind('icon-file-upload', 'onchange', (e) => this.handleIconUpload(e.target));
    click('picker-prev', () => { if(this.pickerPage > 0) { this.pickerPage--; this.renderIconPickerGrid(); } });
    click('picker-next', () => { const lib = this.getCurrentPickerLib(); const maxPage = Math.ceil(Object.keys(lib).length / this.pickerPageSize) - 1; if(this.pickerPage < maxPage) { this.pickerPage++; this.renderIconPickerGrid(); } });
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
      if (this.showIds) app.classList.remove('hide-catalog-ids'); else app.classList.add('hide-catalog-ids');
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
      if(mode === 'light') app.classList.add('light-mode'); else app.classList.remove('light-mode');
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
          input.accept = 'image/*,application/pdf'; 
          input.capture = 'environment';
          input.style.display = 'none';
          this.shadowRoot.appendChild(input);
      }
      input.onchange = (e) => {
          const file = e.target.files[0]; if (!file) return;
          if (file.type === 'application/pdf') {
              const reader = new FileReader();
              reader.onload = (ev) => { this.chatImage = ev.target.result; this.render(); };
              reader.readAsDataURL(file);
              return;
          }
          const maxRes = context === 'chat' ? 2048 : 1024;
          this.compressImage(file, async (dataUrl) => {
              if (context === 'chat') { this.chatImage = dataUrl; this.render(); return; }
              const targetId = this.pendingItemId || this.pendingItem;
              const isSearch = context === 'search';
              if (!isSearch && targetId) this.setLoading(targetId, true);
              try {
                  if (isSearch) await this.callHA('ai_action', { mode: 'search', image_data: dataUrl });
                  else if (this.pendingItemId) { await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl }); this.refreshImageVersion(this.pendingItemId); }
                  else if (this.pendingItem) { await this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl }); this.refreshImageVersion(this.pendingItem); }
              } catch(err) { console.error(err); }
              finally { if (!isSearch && targetId) this.setLoading(targetId, false); this.pendingItemId = null; this.pendingItem = null; }
          }, this.useAiBg, maxRes); 
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
              if (data[i] > 190 && data[i+1] > 190 && data[i+2] > 190) { data[i] = 255; data[i+1] = 255; data[i+2] = 255; }
          }
          context.putImageData(imageData, 0, 0);
      }
      const quality = this.cameraContext === 'chat' ? 0.8 : 0.5;
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      this.stopCamera();
      if (this.cameraContext === 'chat') { this.chatImage = dataUrl; this.render(); return; }
      const targetId = this.pendingItemId || this.pendingItem;
      const isSearch = this.cameraContext === 'search';
      if (!isSearch && targetId) this.setLoading(targetId, true);
      try {
          if (isSearch) await this.callHA('ai_action', { mode: 'search', image_data: dataUrl });
          else if (this.pendingItemId) { await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl }); this.refreshImageVersion(this.pendingItemId); }
          else if (this.pendingItem) { await this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl }); this.refreshImageVersion(this.pendingItem); }
      } catch(e) { console.error(e); }
      finally { if(!isSearch && targetId) this.setLoading(targetId, false); this.pendingItemId = null; this.pendingItem = null; }
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    root.getElementById('display-title').innerText = this.t('app_title');
    root.getElementById('display-path').innerText = this.isChatMode ? "AI Chat Assistant" : (this.isShopMode ? this.t('shopping_list') : (this.isSearch ? this.t('search_results') : (attrs.path_display === "Main" ? this.t('default_path') : attrs.path_display)));
    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const chatBtn = root.getElementById('btn-chat');
    if (attrs.enable_ai) { chatBtn.style.display = 'flex'; chatBtn.classList.toggle('active', this.isChatMode); } else { chatBtn.style.display = 'none'; }
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');
    
    const editBtn = root.getElementById('btn-edit');
    if (editBtn) { if (this.isEditMode) editBtn.classList.add('edit-active'); else editBtn.classList.remove('edit-active'); }
    
    const content = root.getElementById('content');
    content.innerHTML = '';
    
    if (this.isChatMode) { this.renderChatUI(content); return; }

    const upBtn = root.getElementById('btn-up');
    if (upBtn) { upBtn.style.display = attrs.depth === 0 ? 'none' : 'flex'; }
    
    const viewBtn = root.getElementById('btn-view-toggle');
    viewBtn.style.display = attrs.depth >= 2 ? 'block' : 'none';
    
    const toggleBtn = root.getElementById('btn-toggle-ids');
    if (toggleBtn) { if (attrs.depth >= 2) toggleBtn.style.display = 'none'; else { toggleBtn.style.display = 'flex'; toggleBtn.style.color = this.showIds ? 'var(--catalog-bg)' : 'var(--primary)'; } }

    if (attrs.shopping_list && attrs.shopping_list.length > 0) {
        const listContainer = document.createElement('div'); listContainer.className = 'item-list';
        const grouped = {}; attrs.shopping_list.forEach(item => { const loc = item.main_location || "Other"; if(!grouped[loc]) grouped[loc] = []; grouped[loc].push(item); });
        Object.keys(grouped).sort().forEach(locName => { const header = document.createElement('div'); header.className = 'group-separator'; header.innerText = locName; listContainer.appendChild(header); grouped[locName].forEach(item => listContainer.appendChild(this.createItemRow(item, true))); });
        content.appendChild(listContainer); return;
    }

    if (attrs.depth === 0) {
        const zoneContainer = document.createElement('div'); zoneContainer.className = 'item-list';
        const groupedRooms = {}; const knownZones = new Set(); const markerRegex = /^ZONE_MARKER_(\d+)_+(.*)$/; const zonesList = [];
        if (attrs.folders) {
            attrs.folders.forEach(f => {
                let zone = "General Rooms", displayName = f.name;
                if (f.name.startsWith("ZONE_MARKER_")) {
                    let zOrder = 9999, zName = f.name.replace("ZONE_MARKER_", "").trim();
                    const match = f.name.match(markerRegex); if (match) { zOrder = parseInt(match[1]); zName = match[2]; }
                    if (zName) { knownZones.add(zName); zonesList.push({ name: zName, order: zOrder, markerName: f.name }); } return; 
                }
                const match = f.name.match(/^\[(.*?)\] (.*)$/); if (match) { zone = match[1]; displayName = match[2]; } else if (f.zone) zone = f.zone;
                if (!groupedRooms[zone]) groupedRooms[zone] = []; groupedRooms[zone].push({ originalName: f.name, displayName: displayName, img: f.img });
            });
        }
        knownZones.forEach(z => { if (!groupedRooms[z]) groupedRooms[z] = []; }); if (!groupedRooms["General Rooms"]) groupedRooms["General Rooms"] = [];
        if (!zonesList.find(z => z.name === "General Rooms") && groupedRooms["General Rooms"].length > 0) zonesList.push({ name: "General Rooms", order: -1, markerName: null });
        Object.keys(groupedRooms).forEach(z => { if (!zonesList.find(i => i.name === z)) zonesList.push({ name: z, order: 9999, markerName: null }); });
        zonesList.sort((a, b) => a.order - b.order);
        zonesList.forEach(zoneObj => {
            const zoneName = zoneObj.name, rooms = groupedRooms[zoneName] || []; if (zoneName === "General Rooms" && rooms.length === 0 && !this.isEditMode) return;
            const header = document.createElement('div'); header.className = 'group-separator';
            let headerContent = `<span>${this.t('zone_' + zoneName) === ('zone_' + zoneName) ? zoneName : this.t('zone_' + zoneName)}</span>`; 
            if (this.isEditMode && zoneName !== "General Rooms") {
                headerContent = `<div style="display:flex;align-items:center;"><span class="subloc-title">${zoneName}</span></div><div style="display:flex;gap:5px;align-items:center"><button class="arrow-btn" onclick="event.stopPropagation(); this.getRootNode().host.moveZone('${zoneName}', -1)">${ICONS.arrow_up}</button><button class="arrow-btn" onclick="event.stopPropagation(); this.getRootNode().host.moveZone('${zoneName}', 1)" style="transform:rotate(180deg)">${ICONS.arrow_up}</button><button class="edit-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableZoneRename(this, '${zoneName}')">${ICONS.edit}</button><button class="delete-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteZone('${zoneName}')">${ICONS.delete}</button></div>`;
            }
            header.innerHTML = headerContent; this.setupZoneDropTarget(header, zoneName); zoneContainer.appendChild(header);
            const grid = document.createElement('div'); grid.className = 'folder-grid';
            rooms.forEach(folder => {
                const rawID = this.getPersistentID('root', folder.originalName), catalogID = this.toAlphaId(rawID);
                const el = document.createElement('div'); el.className = 'folder-item'; this.setupRoomDragSource(el, folder.originalName);
                el.onclick = () => { if (!this.isEditMode) this.navigate('down', folder.originalName, catalogID); };
                let folderContent = ICONS.folder; if (folder.img) { const isLoading = this.loadingSet.has(folder.originalName), ver = this.imageVersions[folder.originalName] || '', src = folder.img + (folder.img.includes('?') ? '&' : '?') + 'v=' + ver; folderContent = `<div style="position:relative;width:100%;height:100%"><img src="${src}" style="width:100%;height:100%;object-fit:contain;border-radius:4px">${isLoading ? `<div class="loader-container"><span class="loader"></span></div>` : ''}</div>`; }
                const delBtn = this.isEditMode ? `<div class="folder-delete-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteFolder('${folder.originalName}')">✕</div>` : '';
                const edBtn = this.isEditMode ? `<div class="folder-edit-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableFolderRename(this.closest('.folder-item').querySelector('.folder-label'), '${folder.originalName}')">${ICONS.edit}</div>` : '';
                const imBtn = this.isEditMode ? `<div class="folder-img-btn" onclick="event.stopPropagation(); this.getRootNode().host.openIconPicker('${folder.originalName}', 'room')">${ICONS.image}</div>` : '';
                el.innerHTML = `<div class="android-folder-icon">${folderContent}<div class="catalog-badge">${catalogID}</div>${edBtn}${delBtn}${imBtn}</div><div class="folder-label">${folder.displayName}</div>`; grid.appendChild(el);
            });
            if (this.isEditMode) { const addBtn = document.createElement('div'); addBtn.className = 'folder-item add-folder-card'; addBtn.innerHTML = `<div class="android-folder-icon">${ICONS.plus}</div><div class="folder-label">${this.t('add_room')}</div>`; addBtn.onclick = (e) => this.enableZoneRoomInput(e.currentTarget, zoneName); grid.appendChild(addBtn); }
            zoneContainer.appendChild(grid);
        });
        if (this.isEditMode) { const addZoneBtn = document.createElement('button'); addZoneBtn.className = 'add-item-btn'; addZoneBtn.style.marginTop = '20px'; addZoneBtn.innerHTML = this.t('add_zone_btn'); addZoneBtn.onclick = () => this.createNewZone(); zoneContainer.appendChild(addZoneBtn); }
        content.appendChild(zoneContainer); return;
    }

    if (attrs.depth < 2) {
        if ((attrs.folders && attrs.folders.length > 0) || this.isEditMode) {
            const grid = document.createElement('div'); grid.className = 'folder-grid';
            if (attrs.folders) {
                attrs.folders.forEach(folder => {
                    const catalogID = this.toAlphaId(this.getPersistentID(this.currentPath[0] || 'root', folder.name));
                    const el = document.createElement('div'); el.className = 'folder-item'; el.onclick = () => this.navigate('down', folder.name, catalogID);
                    let folderContent = ICONS.folder; if (folder.img) { const isLoading = this.loadingSet.has(folder.name); folderContent = `<div style="position:relative;width:100%;height:100%"><img src="${folder.img}" style="width:100%;height:100%;object-fit:contain;border-radius:4px">${isLoading ? `<div class="loader-container"><span class="loader"></span></div>` : ''}</div>`; }
                    el.innerHTML = `<div class="android-folder-icon">${folderContent}<div class="catalog-badge">${catalogID}</div></div><div class="folder-label">${folder.name}</div>`; grid.appendChild(el);
                });
            }
            if (this.isEditMode) {
                const addBtn = document.createElement('div'); addBtn.className = 'folder-item add-folder-card'; addBtn.innerHTML = `<div class="android-folder-icon">${ICONS.plus}</div><div class="folder-label">${this.t('add')}</div>`; addBtn.onclick = (e) => this.enableFolderInput(e.currentTarget); grid.appendChild(addBtn);
            }
            content.appendChild(grid);
        }
    } else {
        const listContainer = document.createElement('div'); listContainer.className = 'item-list';
        const markerRegex = /^ORDER_MARKER_(\d+)_(.*)$/;
        const grouped = {}; const orderedGroups = []; const foundMarkers = new Set();
        if (attrs.folders) attrs.folders.forEach(f => { if (f.name.startsWith("ORDER_MARKER_")) { const match = f.name.match(markerRegex); if (match) { orderedGroups.push({ name: match[2], order: parseInt(match[1]), markerKey: f.name }); foundMarkers.add(match[2]); } } });
        if (attrs.items) attrs.items.forEach(item => { const sub = item.sub_location || "General"; if (!foundMarkers.has(sub)) { orderedGroups.push({ name: sub, order: sub === "General" ? -1 : 9999, markerKey: null }); foundMarkers.add(sub); } });
        orderedGroups.sort((a,b) => a.order - b.order).forEach(g => grouped[g.name] = []);
        if (attrs.items) attrs.items.forEach(item => { const sub = item.sub_location || "General"; if(grouped[sub]) grouped[sub].push(item); });
        
        orderedGroups.forEach(groupObj => {
            const subName = groupObj.name, items = grouped[subName] || [], count = items.length;
            if (subName === "General" && count === 0 && !this.isEditMode) return;
            const icon = this.expandedSublocs.has(subName) ? ICONS.chevron_down : ICONS.chevron_right;
            const header = document.createElement('div'); header.className = 'group-separator'; header.onclick = () => this.toggleSubloc(subName);
            header.innerHTML = `<span>${icon} ${subName} <small>(${count})</small></span>`; listContainer.appendChild(header);
            if (this.expandedSublocs.has(subName)) { items.forEach(item => listContainer.appendChild(this.createItemRow(item, false))); }
        });
        content.appendChild(listContainer);
    }

    if (attrs.items && attrs.depth < 2) {
        const list = document.createElement('div'); list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
    }
  }

  renderChatUI(container) {
      const chatContainer = document.createElement('div'); chatContainer.className = 'chat-container';
      const messagesDiv = document.createElement('div'); messagesDiv.className = 'chat-messages';
      
      if (this.chatHistory.length === 0) {
          const welcome = document.createElement('div'); welcome.className = 'message ai';
          welcome.innerHTML = `<b>AI Assistant Ready</b><br>I can scan invoices from photos or PDFs.<br><br><b>Capabilities:</b><br>• Add Items: "Add 3 batteries to kitchen"<br>• Scan Invoices: Choose a photo or a <b>PDF</b> file!<br>• Find things: "Where is the milk?"`;
          messagesDiv.appendChild(welcome);
      }
      this.chatHistory.forEach(msg => {
          const div = document.createElement('div'); div.className = `message ${msg.role}`; div.innerHTML = msg.text; 
          if(msg.image) { 
              const isPdf = msg.image.startsWith('data:application/pdf');
              if (isPdf) {
                  div.innerHTML += `<div style="height:80px; width:80px; background:#f44336; color:white; display:flex; align-items:center; justify-content:center; border-radius:8px; font-weight:bold; margin-top:5px;">PDF</div>`;
              } else {
                  const img = document.createElement('img'); img.src = msg.image; img.style.maxWidth = "100%"; img.style.borderRadius = "8px"; img.style.marginTop = "5px"; div.appendChild(img); 
              }
          }
          if(msg.isStatus) div.id = 'chat-status-msg'; messagesDiv.appendChild(div);
      });
      chatContainer.appendChild(messagesDiv);
      
      const previewArea = document.createElement('div'); previewArea.id = "chat-img-preview"; previewArea.style.display = this.chatImage ? "flex" : "none"; previewArea.style.padding = "10px"; previewArea.style.background = "#222"; previewArea.style.borderTop = "1px solid #444"; previewArea.style.alignItems = "center"; previewArea.style.gap = "10px";
      const isPdfAttached = this.chatImage && this.chatImage.startsWith('data:application/pdf');
      previewArea.innerHTML = `
        <div style="display:inline-block; position:relative;">
            ${isPdfAttached ? `<div style="height:50px; width:50px; background:#f44336; color:white; display:flex; align-items:center; justify-content:center; border-radius:4px; font-weight:bold; font-size:10px;">PDF</div>` : `<img src="${this.chatImage || ''}" style="height:50px; border-radius:4px; border:1px solid #666">`}
            <div id="chat-remove-img" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; width:15px; height:15px; font-size:10px; text-align:center; cursor:pointer; line-height:15px;">✕</div>
        </div>
        <span style="color:#aaa; font-size:12px;">File attached (Scan Mode)</span>
      `;
      chatContainer.appendChild(previewArea);
      
      const inputBar = document.createElement('div'); inputBar.className = 'chat-input-bar';
      const cameraIcon = ICONS.camera || `<svg viewBox="0 0 24 24" style="width:24px; height:24px;"><path fill="currentColor" d="M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z" /></svg>`;
      const uploadIcon = ICONS.image || `<svg viewBox="0 0 24 24" style="width:24px; height:24px;"><path fill="currentColor" d="M21,19V5c0-1.1-0.9-2-2-2H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14C20.1,21,21,20.1,21,19z M8.5,13.5l2.5,3.01L14.5,12l4.5,6H5L8.5,13.5z" /></svg>`;
      
      inputBar.innerHTML = `
        <button id="chat-camera-btn" type="button" style="background:none; border:none; color:var(--primary, #03a9f4); cursor:pointer; padding:0 10px; height:40px; width:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${cameraIcon}</button>
        <button id="chat-file-btn" type="button" style="background:none; border:none; color:var(--primary, #03a9f4); cursor:pointer; padding:0 10px; height:40px; width:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${uploadIcon}</button>
        <input type="text" class="chat-input" placeholder="Type message or scan file..." style="flex:1; padding:10px; border-radius:20px; border:1px solid var(--border-input); background:var(--bg-input); color:var(--text-main); outline:none;">
        <button id="chat-send-btn" class="chat-send-btn" style="flex-shrink:0; background:var(--primary); color:white; border:none; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer;">${ICONS.send}</button>
      `;

      const camBtn = inputBar.querySelector('#chat-camera-btn');
      const fileBtn = inputBar.querySelector('#chat-file-btn');
      const input = inputBar.querySelector('input');
      const sendBtn = inputBar.querySelector('#chat-send-btn');
      
      previewArea.querySelector('#chat-remove-img').onclick = () => { this.chatImage = null; this.render(); };
      
      const sendMessage = async () => {
          const text = input.value.trim(), fileData = this.chatImage; if (!text && !fileData) return;
          this.chatHistory.push({ role: 'user', text: text || (fileData.startsWith('data:application/pdf') ? "Scanned PDF Invoice" : "Scanned Photo Invoice"), image: fileData });
          this.chatImage = null; this.render(); 
          const statusMsg = { role: 'system', text: `Starting Process...<br>${fileData ? "Reading Document..." : "Analyzing..."}`, isStatus: true };
          this.chatHistory.push(statusMsg); this.render();
          try {
              const result = await this._hass.callWS({ type: 'home_organizer/ai_chat', message: text, image_data: fileData });
              if (result) {
                    let debugHTML = "";
                    if (result.debug) {
                        const d = result.debug, esc = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
                        if (d.raw_json) debugHTML += `<details class="debug-details"><summary class="debug-summary">📄 Raw Data</summary><div class="debug-content">${esc(d.raw_json)}</div></details>`;
                        if (d.intent === "add_invoice") debugHTML += `<details class="debug-details"><summary class="debug-summary">➕ Items List</summary><div class="debug-content">${JSON.stringify(d, null, 2)}</div></details>`;
                    }
                    statusMsg.text = "✔ Complete" + debugHTML;
                    if (result.error) this.chatHistory.push({ role: 'ai', text: "<b>Error:</b> " + result.error });
                    else if (result.response) { this.chatHistory.push({ role: 'ai', text: result.response.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') }); }
              }
          } catch (e) { statusMsg.text += "<br>❌ Failed"; this.chatHistory.push({ role: 'ai', text: "Error: " + e.message }); }
          this.render();
      };

      camBtn.onclick = () => this.handleChatCamera();
      fileBtn.onclick = () => {
          let fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*,application/pdf';
          fileInput.onchange = (e) => {
              const file = e.target.files[0]; if (!file) return;
              if (file.type === 'application/pdf') {
                  const reader = new FileReader();
                  reader.onload = (ev) => { this.chatImage = ev.target.result; this.render(); };
                  reader.readAsDataURL(file);
              } else {
                  this.compressImage(file, (dataUrl) => { this.chatImage = dataUrl; this.render(); }, false, 2048);
              }
          };
          fileInput.click();
      };
      sendBtn.onclick = sendMessage; input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
      chatContainer.appendChild(inputBar); container.appendChild(chatContainer);
      setTimeout(() => messagesDiv.scrollTop = messagesDiv.scrollHeight, 50);
  }
  
  handleChatCamera() { this.openCamera('chat'); }
  
  handleChatProgress(data) {
    if (!this.isChatMode) return; let statusMsg = null;
    for (let i = this.chatHistory.length - 1; i >= 0; i--) { if (this.chatHistory[i].role === 'system' && this.chatHistory[i].isStatus) { statusMsg = this.chatHistory[i]; break; } }
    if (!statusMsg) return;
    if (data.step && !statusMsg.text.includes(data.step)) statusMsg.text += `<br>✔ <b>${data.step}</b>`;
    this.render(); setTimeout(() => { const msgs = this.shadowRoot.querySelector('.chat-messages'); if(msgs) msgs.scrollTop = msgs.scrollHeight; }, 50);
  }
  
  resolveRealName(displayName) {
      if (!this.localData) return displayName;
      if (this.localData.folders) { const found = this.localData.folders.find(f => f.name.match(new RegExp(`^ORDER_MARKER_\\d+_${displayName}$`))); if (found) return found.name; }
      return displayName;
  }
  
  async moveSubLoc(subName, direction) {
      const subGroups = []; const seen = new Set(); const currentMarkers = {}; 
      if (this.localData.folders) this.localData.folders.forEach(f => { if (f.name.startsWith("ORDER_MARKER_")) { const match = f.name.match(/^ORDER_MARKER_(\d+)_(.*)$/); if (match) { const realName = match[2]; if (!seen.has(realName)) { subGroups.push({ name: realName, order: parseInt(match[1]) }); seen.add(realName); currentMarkers[realName] = f.name; } } } else if (!seen.has(f.name)) { subGroups.push({ name: f.name, order: 9999 }); seen.add(f.name); } });
      if (this.localData.items) this.localData.items.forEach(i => { const s = i.sub_location || "General"; if (s.startsWith("ORDER_MARKER_")) { const match = s.match(/^ORDER_MARKER_(\d+)_(.*)$/); if (match) { const realName = match[2]; if (!seen.has(realName)) { subGroups.push({ name: realName, order: parseInt(match[1]) }); seen.add(realName); currentMarkers[realName] = s; } } } else if (!seen.has(s)) { subGroups.push({ name: s, order: s==="General" ? -1 : 9999 }); seen.add(s); } });
      subGroups.sort((a,b) => a.order - b.order);
      const idx = subGroups.findIndex(g => g.name === subName); if (idx === -1) return;
      const newIdx = idx + direction; if (newIdx < 0 || newIdx >= subGroups.length) return;
      [subGroups[idx], subGroups[newIdx]] = [subGroups[newIdx], subGroups[idx]];
      for (let i = 0; i < subGroups.length; i++) {
          const ord = String((i + 1) * 10).padStart(3, '0'), nm = `ORDER_MARKER_${ord}_${subGroups[i].name}`, old = currentMarkers[subGroups[i].name];
          if (subGroups[i].name !== "General") { if (old && old !== nm) await this.callHA('update_item_details', { original_name: old, new_name: nm, current_path: this.currentPath, is_folder: true }); else if (!old) await this.callHA('add_item', { item_name: "OrderMarker", item_type: 'item', current_path: [...this.currentPath, nm] }); }
      }
      this.fetchData();
  }

  createNewZone() {
      let base = "New Zone", name = base, count = 1; const seen = new Set();
      if (this.localData && this.localData.folders) this.localData.folders.forEach(f => { if(f.zone) seen.add(f.zone); if(f.name.startsWith("ZONE_MARKER_")) seen.add(f.name.replace(/^ZONE_MARKER_\d+_/, "").trim()); });
      while (seen.has(name)) name = `${base} ${count++}`;
      this.callHA('add_item', { item_name: "ZONE_MARKER_999_" + name, item_type: 'folder', zone: name, current_path: [] });
  }

  enableZoneRoomInput(cardEl, zoneName) {
      const iconContainer = cardEl.querySelector('.android-folder-icon'), label = cardEl.querySelector('.folder-label'); if(iconContainer.querySelector('input')) return;
      iconContainer.innerHTML = `<input type="text" class="add-folder-input" placeholder="Name">`; const input = iconContainer.querySelector('input'); label.innerText = this.t('save_to') + " " + zoneName;
      input.focus(); input.onkeydown = (e) => { if (e.key === 'Enter') this.saveNewRoomInZone(input.value, zoneName); };
      input.onblur = () => { if (input.value.trim()) this.saveNewRoomInZone(input.value, zoneName); else this.render(); };
  }

  saveNewRoomInZone(name, zoneName) { if(!name) return; let finalName = zoneName !== "General Rooms" ? `[${zoneName}] ${name}` : name; this.callHA('add_item', { item_name: finalName, item_type: 'folder', current_path: [] }); }
  setupRoomDragSource(el, roomName) { el.draggable = true; el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", roomName); e.dataTransfer.effectAllowed = "move"; el.classList.add('dragging'); }; el.ondragend = () => el.classList.remove('dragging'); }
  setupZoneDropTarget(el, zoneName) { el.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); }; el.ondragleave = () => el.classList.remove('drag-over'); el.ondrop = (e) => { e.preventDefault(); el.classList.remove('drag-over'); const roomName = e.dataTransfer.getData("text/plain"); if (roomName) this.moveRoomToZone(roomName, zoneName); }; }
  async moveRoomToZone(roomName, zoneName) { try { const cleanName = roomName.replace(/^\[(.*?)\]\s*/, ""); let newName = zoneName !== "General Rooms" ? `[${zoneName}] ${cleanName}` : cleanName; if (newName !== roomName) { await this.callHA('update_item_details', { original_name: roomName, new_name: newName, current_path: [], is_folder: true }); this.fetchData(); } } catch (err) { console.error(err); } }
  
  moveZone(zoneName, direction) {
      const zones = []; const seen = new Set();
      if (this.localData && this.localData.folders) { this.localData.folders.forEach(f => { if (f.name.startsWith("ZONE_MARKER_")) { const match = f.name.match(/^ZONE_MARKER_(\d+)_(.*)$/); let zOrder = match ? parseInt(match[1]) : 9999, zName = match ? match[2] : f.name.replace("ZONE_MARKER_", "").trim(); if (!seen.has(zName)) { zones.push({ name: zName, order: zOrder, markerName: f.name }); seen.add(zName); } } }); }
      zones.sort((a,b) => a.order - b.order); const idx = zones.findIndex(z => z.name === zoneName); if (idx === -1) return; 
      const newIdx = idx + direction; if (newIdx < 0 || newIdx >= zones.length) return; 
      [zones[idx], zones[newIdx]] = [zones[newIdx], zones[idx]];
      zones.forEach((z, index) => { const nm = `ZONE_MARKER_${String((index + 1) * 10).padStart(3, '0')}_${z.name}`; if (z.markerName !== nm) this.callHA('update_item_details', { original_name: z.markerName, new_name: nm, current_path: [], is_folder: true }); });
      setTimeout(() => this.fetchData(), 600);
  }

  enableZoneRename(btn, oldName) {
      const header = btn.closest('.group-separator'); if (header.querySelector('input')) return; const titleSpan = header.querySelector('.subloc-title') || header.querySelector('span'); if(!titleSpan) return;
      const input = document.createElement('input'); input.value = oldName; input.style.background = 'var(--bg-input-edit)'; input.style.color = 'var(--text-main)'; input.style.border = '1px solid var(--primary)'; input.style.borderRadius = '4px'; input.style.padding = '4px'; input.style.fontSize = '14px'; input.style.width = '200px'; input.onclick = (e) => e.stopPropagation(); titleSpan.replaceWith(input); input.focus();
      let isSaving = false; input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); }; 
      input.onblur = () => { if (isSaving) return; isSaving = true; const newVal = input.value.trim(); if (newVal && newVal !== oldName) { const newSpan = document.createElement('span'); newSpan.className = 'subloc-title'; newSpan.innerText = newVal; input.replaceWith(newSpan); this.batchUpdateZone(oldName, newVal); } else { const originalSpan = document.createElement('span'); originalSpan.className = 'subloc-title'; originalSpan.innerText = oldName; input.replaceWith(originalSpan); } };
  }

  batchUpdateZone(oldZone, newZone) {
      if (this.localData && this.localData.folders) {
          this.localData.folders.forEach(f => {
              if (f.name.startsWith("ZONE_MARKER_") && f.name.endsWith(`_${oldZone}`)) this.callHA('update_item_details', { original_name: f.name, new_name: f.name.replace(`_${oldZone}`, `_${newZone}`), current_path: [], is_folder: true }); 
              else if (f.name.startsWith(`[${oldZone}] `)) this.callHA('update_item_details', { original_name: f.name, new_name: f.name.replace(`[${oldZone}] `, `[${newZone}] `), current_path: [], is_folder: true });
          });
          setTimeout(() => this.fetchData(), 800);
      }
  }

  deleteZone(zoneName) { if(confirm(this.t('confirm_del_zone', zoneName))) { if (this.localData && this.localData.folders) { this.localData.folders.forEach(f => { if (f.name.startsWith("ZONE_MARKER_") && f.name.endsWith(`_${zoneName}`)) this.callHA('delete_item', { item_name: f.name, current_path: [], is_folder: true }); else if (f.name.startsWith(`[${zoneName}] `)) this.callHA('update_item_details', { original_name: f.name, new_name: f.name.replace(`[${zoneName}] `, ""), current_path: [], is_folder: true }); }); } setTimeout(() => this.fetchData(), 800); } }
  showItemDetails(item) { const ov = this.shadowRoot.getElementById('img-overlay'), img = this.shadowRoot.getElementById('overlay-img'), det = this.shadowRoot.getElementById('overlay-details'), iconBig = this.shadowRoot.getElementById('overlay-icon-big'); ov.style.display = 'flex'; det.style.display = 'block'; if(item.img) { img.src = item.img; img.style.display = 'block'; iconBig.style.display = 'none'; } else { img.style.display = 'none'; iconBig.style.display = 'block'; } det.innerHTML = `<div style="font-size:20px;font-weight:bold;margin-bottom:8px">${item.name}</div><div style="font-size:16px;color:#aaa;margin-bottom:15px">${item.date || this.t('no_date')}</div><div style="font-size:18px;font-weight:bold;color:var(--accent);background:#333;padding:8px 20px;border-radius:20px;display:inline-block">${this.t('quantity')}: ${item.qty}</div>`; }
  showImg(src) { const ov = this.shadowRoot.getElementById('img-overlay'), img = this.shadowRoot.getElementById('overlay-img'), det = this.shadowRoot.getElementById('overlay-details'), iconBig = this.shadowRoot.getElementById('overlay-icon-big'); if(ov && img) { img.src = src; img.style.display = 'block'; if(det) det.style.display = 'none'; if(iconBig) iconBig.style.display = 'none'; ov.style.display = 'flex'; } }
  toggleSubloc(name) { if (this.expandedSublocs.has(name)) this.expandedSublocs.delete(name); else this.expandedSublocs.add(name); this.render(); }
  enableFolderInput(cardEl) { const iconContainer = cardEl.querySelector('.android-folder-icon'), label = cardEl.querySelector('.folder-label'); if(iconContainer.querySelector('input')) return; iconContainer.innerHTML = `<input type="text" class="add-folder-input" placeholder="Name">`; const input = iconContainer.querySelector('input'); label.innerText = this.t('saving'); input.focus(); input.onkeydown = (e) => { if (e.key === 'Enter') this.saveNewFolder(input.value); }; input.onblur = () => { if (input.value.trim()) this.saveNewFolder(input.value); else this.render(); }; }
  enableFolderRename(labelEl, oldName) { if (!labelEl || labelEl.querySelector('input')) return; const input = document.createElement('input'); input.value = oldName; input.style.width = '100%'; input.style.background = 'var(--bg-input-edit)'; input.style.color = 'var(--text-main)'; input.style.border = '1px solid var(--primary)'; input.style.borderRadius = '4px'; input.style.textAlign = 'center'; input.style.fontSize = '12px'; input.onclick = (e) => e.stopPropagation(); labelEl.innerHTML = ''; labelEl.appendChild(input); input.focus(); let isSaving = false; input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); }; input.onblur = () => { if (isSaving) return; isSaving = true; const newVal = input.value.trim(); if (newVal && newVal !== oldName) this.callHA('update_item_details', { original_name: oldName, new_name: newVal, new_date: "", current_path: this.currentPath, is_folder: true }); else this.render(); }; }
  saveNewFolder(name) { if(!name) return; this._hass.callService('home_organizer', 'add_item', { item_name: name, item_type: 'folder', item_date: '', image_data: null, current_path: this.currentPath }); }
  addQuickItem(targetSubloc) { const tempName = this.t('new_item') + " " + new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'}), today = new Date().toISOString().split('T')[0]; let usePath = [...this.currentPath]; if (targetSubloc && targetSubloc !== "General") usePath.push(targetSubloc); this._hass.callService('home_organizer', 'add_item', { item_name: tempName, item_type: 'item', item_date: today, image_data: null, current_path: usePath }); }
  setupDragSource(el, itemName) { el.draggable = true; el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", itemName); e.dataTransfer.effectAllowed = "move"; el.classList.add('dragging'); }; el.ondragend = () => el.classList.remove('dragging'); }
  setupDropTarget(el, subName) { el.dataset.subloc = subName; el.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); }; el.ondragleave = () => el.classList.remove('drag-over'); el.ondrop = (e) => { e.preventDefault(); el.classList.remove('drag-over'); const itemName = e.dataTransfer.getData("text/plain"); if (itemName) this.handleDropAction(subName, itemName); }; }
  async handleDropAction(targetSubloc, itemName) { let targetPath = [...this.currentPath]; if (targetSubloc !== "General") targetPath.push(targetSubloc); try { await this.callHA('clipboard_action', {action: 'cut', item_name: itemName}); await this.callHA('paste_item', {target_path: targetPath}); } catch (err) { console.error(err); } }
  triggerCameraEdit(id, name) { this.pendingItemId = id; this.pendingItemName = name; this.openCamera('update'); }
  adjustShopQty(id, delta) { if (this.shopQuantities[id] === undefined) this.shopQuantities[id] = 0; this.shopQuantities[id] = Math.max(0, this.shopQuantities[id] + delta); this.render(); }
  duplicateItem(itemId) { if (itemId) this.callHA('duplicate_item', { item_id: itemId }); }
  createItemRow(item, isShopMode) {
     const div = document.createElement('div'), oosClass = item.qty === 0 ? 'out-of-stock-frame' : '', appEl = this.shadowRoot.getElementById('app'), isRTL = appEl && !appEl.classList.contains('ltr');
     div.className = `item-row ${this.expandedIdx === item.id ? 'expanded' : ''} ${oosClass}`; this.setupDragSource(div, item.name);
     let controls = ''; if (isShopMode) {
         const localQty = this.shopQuantities[item.id] || 0, checkStyle = localQty === 0 ? "background:#555;color:#888;cursor:not-allowed;" : "background:var(--accent);";
         const minus = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.adjustShopQty('${item.id}', -1)">${ICONS.minus}</button>`, plus = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.adjustShopQty('${item.id}', 1)">${ICONS.plus}</button>`, qty = `<span class="qty-val" style="margin:0 8px">${localQty}</span>`, check = `<button class="qty-btn" style="${checkStyle}" ${localQty === 0 ? "disabled" : ""} onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.id}')">${ICONS.check}</button>`;
         controls = isRTL ? `${plus}${qty}${minus}${check}` : `${minus}${qty}${plus}${check}`;
     } else controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.id}', 1)">${ICONS.plus}</button><span class="qty-val">${item.qty}</span><button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.id}', -1)">${ICONS.minus}</button>`;
     let iconHtml = `<span class="item-icon">${ICONS.item}</span>`; if (item.img) { const isLoading = this.loadingSet.has(item.id), ver = this.imageVersions[item.id] || '', src = item.img + (item.img.includes('?') ? '&' : '?') + 'v=' + ver; iconHtml = `<div style="position:relative;width:40px;height:40px"><img src="${src}" class="item-thumbnail" onclick="event.stopPropagation(); this.getRootNode().host.showImg('${item.img}')">${isLoading ? `<div class="loader-container"><span class="loader"></span></div>` : ''}</div>`; }
     div.innerHTML = `<div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.id}')"><div class="item-left">${iconHtml}<div><div>${item.name}</div><div class="sub-title">${isShopMode ? `${item.main_location} > ${item.sub_location || ''}` : (item.date || '')}</div></div></div><div class="item-qty-ctrl">${controls}</div></div>`;
     if (this.expandedIdx === item.id) {
         const details = document.createElement('div'); details.className = 'expanded-details'; let roomOpts = `<option value="">-- ${this.t('move_to')} --</option>`; if(this.localData.hierarchy) Object.keys(this.localData.hierarchy).forEach(room => roomOpts += `<option value="${room}">${room}</option>`);
         let mainOpts = `<option value="">${this.t('select_cat')}</option>`; Object.keys(ITEM_CATEGORIES).forEach(cat => mainOpts += `<option value="${cat}" ${item.category === cat ? 'selected' : ''}>${this.t('cat_' + cat.replace(/[^a-zA-Z0-9]+/g, '_')) || cat}</option>`);
         let subOpts = `<option value="">${this.t('select_sub')}</option>`, currentUnit = ""; if (item.category && ITEM_CATEGORIES[item.category]) { Object.keys(ITEM_CATEGORIES[item.category]).forEach(sub => { const sel = item.sub_category === sub; subOpts += `<option value="${sub}" ${sel ? 'selected' : ''}>${this.t('sub_' + sub.replace(/[^a-zA-Z0-9]+/g, '_')) || sub}</option>`; if (sel) currentUnit = ITEM_CATEGORIES[item.category][sub]; }); }
         details.innerHTML = `<div class="detail-row"><div style="position:relative; flex:1;"><input type="text" id="name-${item.id}" value="${item.name}" style="width:100%;padding:8px;background:var(--bg-input-edit);color:var(--text-main);border:1px solid var(--border-light);border-radius:4px;" autocomplete="off" oninput="this.getRootNode().host.handleNameInput(this, '${item.id}')" onblur="setTimeout(() => { if(this.parentElement.querySelector('.suggestions-box')) this.parentElement.querySelector('.suggestions-box').remove() }, 200)" onkeydown="if(event.key==='Enter') { this.blur(); this.getRootNode().host.autoSaveItem('${item.id}', 'name', '${item.name}') }"></div><div style="position:relative; width:120px; height:36px;"><button class="action-btn" style="width:100%;" onclick="this.nextElementSibling.showPicker()">${item.date || this.t('set_date')}</button><input type="date" id="date-${item.id}" value="${item.date}" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0;" onchange="this.previousElementSibling.innerText = this.value || '${this.t('set_date')}'; this.getRootNode().host.autoSaveItem('${item.id}', 'date', '${item.name}')"></div></div><div class="detail-row" style="margin-top:10px;"><select class="move-select" onchange="this.getRootNode().host.updateItemCategory('${item.id}', this.value, 'main', '${item.name}')">${mainOpts}</select><select class="move-select" onchange="this.getRootNode().host.updateItemCategory('${item.id}', this.value, 'sub', '${item.name}')">${subOpts}</select><input type="text" value="${item.unit_value || ''}" placeholder="Val" style="width:60px;" onchange="this.getRootNode().host.updateItemCategory('${item.id}', null, 'val', '${item.name}')"><div style="background:var(--bg-badge);color:var(--text-badge);padding:4px 8px;border-radius:4px;font-size:11px;">${this.t('unit_' + currentUnit) || currentUnit || '-'}</div></div><div class="detail-row" style="justify-content:space-between; margin-top:10px;"><div style="display:flex;gap:10px;"><button class="action-btn" onclick="this.getRootNode().host.triggerCameraEdit('${item.id}', '${item.name}')">${ICONS.camera}</button><button class="action-btn" onclick="this.getRootNode().host.openIconPicker('${item.id}', 'item')">${ICONS.image}</button></div><div style="display:flex;gap:10px;"><button class="action-btn" onclick="this.getRootNode().host.duplicateItem('${item.id}')">${ICONS.copy || ICONS.paste}</button><button class="action-btn btn-danger" onclick="this.getRootNode().host.del('${item.id}')">${ICONS.delete}</button></div></div><div class="detail-row" style="margin-top:10px; border-top:1px solid #444; padding-top:10px; flex-direction:column; gap:8px;"><div class="move-container" style="width:100%"><select class="move-select" id="room-select-${item.id}" onchange="this.getRootNode().host.updateLocationDropdown('${item.id}', this.value)">${roomOpts}</select></div><div class="move-container" style="width:100%; display:none;" id="loc-container-${item.id}"><select class="move-select" id="loc-select-${item.id}" onchange="this.getRootNode().host.updateSublocDropdown('${item.id}', this.value)"><option value="">-- Select --</option></select></div><div class="move-container" style="width:100%; display:none;" id="subloc-container-${item.id}"><select class="move-select" id="target-subloc-${item.id}" onchange="this.getRootNode().host.handleMoveToPath('${item.id}')"><option value="">-- Select --</option></select></div></div>`; div.appendChild(details);
     } return div;
  }
  updateItemCategory(itemId, value, type, itemName) { this.callHA('update_item_details', { item_id: itemId, original_name: itemName, [type === 'main' ? 'category' : (type === 'sub' ? 'sub_category' : 'unit_value')]: value }); setTimeout(() => this.fetchData(), 300); }
  autoSaveItem(itemId, trigger, oldName) { const nm = this.shadowRoot.getElementById(`name-${itemId}`).value, dt = this.shadowRoot.getElementById(`date-${itemId}`).value; this.callHA('update_item_details', { item_id: itemId, original_name: oldName, new_name: nm, new_date: dt }); }
  updateLocationDropdown(itemId, room) { const c = this.shadowRoot.getElementById(`loc-container-${itemId}`), s = this.shadowRoot.getElementById(`loc-select-${itemId}`); c.style.display = room ? 'flex' : 'none'; if(!room) return; let h = '<option value="">-- Select --</option>'; if(this.localData.hierarchy[room]) Object.keys(this.localData.hierarchy[room]).forEach(l => h += `<option value="${l}">${l}</option>`); s.innerHTML = h; }
  updateSublocDropdown(itemId, loc) { const c = this.shadowRoot.getElementById(`subloc-container-${itemId}`), s = this.shadowRoot.getElementById(`target-subloc-${itemId}`), r = this.shadowRoot.getElementById(`room-select-${itemId}`).value; c.style.display = loc ? 'flex' : 'none'; if(!loc) return; let h = '<option value="">-- Select --</option><option value="__ROOT__">Main</option>'; if(this.localData.hierarchy[r][loc]) this.localData.hierarchy[r][loc].forEach(sl => h += `<option value="${sl}">${sl}</option>`); s.innerHTML = h; }
  handleMoveToPath(itemId) { const r = this.shadowRoot.getElementById(`room-select-${itemId}`).value, l = this.shadowRoot.getElementById(`loc-select-${itemId}`).value, s = this.shadowRoot.getElementById(`target-subloc-${itemId}`).value; if(!r || !l || !s) return; let p = [r, l]; if(s !== "__ROOT__") p.push(s); this.callHA('clipboard_action', {action: 'cut', item_id: itemId}); setTimeout(() => this.callHA('paste_item', {target_path: p}), 200); }
  deleteFolder(n) { if(confirm(this.t('confirm_del_folder', n))) this.callHA('delete_item', { item_name: n, current_path: this.currentPath, is_folder: true }); }
  del(id) { if(confirm(this.t('confirm_del_item'))) this.callHA('delete_item', { item_id: id, is_folder: false }); }
  deleteSubloc(n) { const r = this.resolveRealName(n); if(confirm(this.t('confirm_del_item', n))) this.callHA('delete_item', { item_name: r, current_path: this.currentPath, is_folder: true }); }
  render() { this.updateUI(); }
  navigate(dir, n, cid) { if(dir==='root'){this.currentPath=[];this.catalogPath=[];}else if(dir==='up'){this.currentPath.pop();this.catalogPath.pop();}else if(dir==='down'){this.currentPath.push(n);this.catalogPath.push(cid);} this.expandedSublocs.clear(); this.fetchData(); }
  toggleRow(id) { this.expandedIdx = this.expandedIdx === Number(id) ? null : Number(id); this.render(); }
  updateQty(id, d) { this.callHA('update_qty', { item_id: id, change: d }); }
  submitShopStock(id) { this.callHA('update_stock', { item_id: id, quantity: this.shopQuantities[id] || 1 }); delete this.shopQuantities[id]; }
  openIconPicker(t, c) { this.pickerContext = c; this.pickerPage = 0; if(c==='item') {this.pendingItemId=t;this.pendingFolderIcon=null;this.pickerCategory=Object.keys(ICON_LIB_ITEM)[0];} else {this.pendingFolderIcon=t;this.pendingItemId=null;this.pickerCategory=null;} this.renderIconPickerGrid(); this.shadowRoot.getElementById('icon-modal').style.display = 'flex'; }
  getCurrentPickerLib() { return this.pickerContext==='room' ? ICON_LIB_ROOM : (this.pickerContext==='location' ? ICON_LIB_LOCATION : (this.pickerContext==='item' ? ICON_LIB_ITEM[this.pickerCategory] : ICON_LIB)); }
  renderIconPickerGrid() {
      const lib = this.getCurrentPickerLib(), keys = Object.keys(lib), pages = Math.ceil(keys.length/15), grid = this.shadowRoot.getElementById('icon-lib-grid'), cats = this.shadowRoot.getElementById('picker-categories');
      if(this.pickerContext==='item'){ cats.style.display='flex'; cats.innerHTML=''; Object.keys(ICON_LIB_ITEM).forEach(c => cats.innerHTML += `<button class="cat-btn ${this.pickerCategory===c?'active':''}" onclick="this.getRootNode().host.pickerCategory='${c}'; this.getRootNode().host.pickerPage=0; this.getRootNode().host.renderIconPickerGrid()">${ICON_LIB_ITEM[c][Object.keys(ICON_LIB_ITEM[c])[0]]}<span>${c}</span></button>`); } else cats.style.display='none';
      grid.innerHTML = ''; keys.slice(this.pickerPage*15, (this.pickerPage+1)*15).forEach(k => grid.innerHTML += `<div class="lib-icon" onclick="this.getRootNode().host.selectLibraryIcon('${lib[k].replace(/'/g,"\\\\'")}')">${lib[k]}<span>${k}</span></div>`);
      this.shadowRoot.getElementById('picker-page-info').innerText = `Page ${this.pickerPage+1} of ${pages||1}`; this.shadowRoot.getElementById('picker-prev').disabled = this.pickerPage===0; this.shadowRoot.getElementById('picker-next').disabled = this.pickerPage >= pages-1;
  }
  async selectLibraryIcon(svg) {
      const size = 140; let s = svg.includes('xmlns') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'); s = s.replace('<svg', `<svg width="${size}" height="${size}" fill="#4fc3f7"`);
      const img = new Image(); const blob = new Blob([s], {type:'image/svg+xml;charset=utf-8'}); const url = URL.createObjectURL(blob);
      await new Promise(r => { img.onload = r; img.src = url; }); const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d');
      if(this.pickerContext==='item'){ ctx.fillStyle='#000'; ctx.fillRect(0,0,size,size); ctx.drawImage(img, size*0.15, size*0.15, size*0.7, size*0.7); } else ctx.drawImage(img, 0,0,size,size);
      const data = canvas.toDataURL('image/png'), t = this.pendingItemId || this.pendingFolderIcon; if(t) this.setLoading(t, true); this.shadowRoot.getElementById('icon-modal').style.display='none';
      try { if(this.pendingItemId) await this.callHA('update_image', {item_id:this.pendingItemId, image_data:data}); else await this.callHA('update_image', {item_name: (this.pickerContext==='room'||this.pickerContext==='location' ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon), image_data:data}); this.refreshImageVersion(t); } catch(e){console.error(e);} finally { this.setLoading(t, false); URL.revokeObjectURL(url); }
  }
  async handleUrlIcon(u) { const img = new Image(); img.crossOrigin="Anonymous"; await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=u;}); const c = document.createElement('canvas'); c.width=img.width; c.height=img.height; c.getContext('2d').drawImage(img,0,0); const d = c.toDataURL('image/jpeg'), t = this.pendingItemId||this.pendingFolderIcon; this.shadowRoot.getElementById('icon-modal').style.display='none'; if(t) this.setLoading(t,true); try { if(this.pendingItemId) await this.callHA('update_image',{item_id:t,image_data:d}); else await this.callHA('update_image',{item_name: (this.pickerContext==='room'||this.pickerContext==='location' ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon),image_data:d}); this.refreshImageVersion(t); } finally { this.setLoading(t,false); } }
  handleIconUpload(i) { const f = i.files[0]; if(!f) return; this.compressImage(f, async d => { const t = this.pendingItemId||this.pendingFolderIcon; this.shadowRoot.getElementById('icon-modal').style.display='none'; if(t) this.setLoading(t,true); try { if(this.pendingItemId) await this.callHA('update_image',{item_id:t,image_data:d}); else await this.callHA('update_image',{item_name: (this.pickerContext==='room'||this.pickerContext==='location' ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon),image_data:d}); this.refreshImageVersion(t); } finally { this.setLoading(t,false); } }); i.value=''; }
  compressImage(f, c, b=false, m=1024) { const r = new FileReader(); r.onload = e => { const i = new Image(); i.onload = () => { const cv = document.createElement('canvas'), ctx = cv.getContext('2d'); let w = i.width, h = i.height; if(w>h){ if(w>m){ h*=m/w; w=m; } } else { if(h>m){ w*=m/h; h=m; } } cv.width=w; cv.height=h; ctx.drawImage(i,0,0,w,h); if(b){ let d = ctx.getImageData(0,0,w,h), p = d.data; for(let j=0; j<p.length; j+=4) if(p[j]>190 && p[j+1]>190 && p[j+2]>190){ p[j]=255; p[j+1]=255; p[j+2]=255; } ctx.putImageData(d,0,0); } c(cv.toDataURL('image/jpeg', 0.8)); }; i.src = e.target.result; }; r.readAsDataURL(f); }
  pasteItem() { this.callHA('paste_item', { target_path: this.currentPath }); }
  cut(n) { this.callHA('clipboard_action', {action: 'cut', item_name: n}); }
  callHA(s, d) { return this._hass.callService('home_organizer', s, d); }

  renderChatUI(container) {
      const chatContainer = document.createElement('div'); chatContainer.className = 'chat-container';
      const messagesDiv = document.createElement('div'); messagesDiv.className = 'chat-messages';
      
      if (this.chatHistory.length === 0) {
          const welcome = document.createElement('div'); welcome.className = 'message ai';
          welcome.innerHTML = `<b>AI Assistant Ready</b><br>I can scan invoices from photos or PDFs.<br><br><b>Capabilities:</b><br>• Add Items: "Add 3 batteries to kitchen"<br>• Scan Invoices: Choose a photo or a <b>PDF</b> file!<br>• Find things: "Where is the milk?"`;
          messagesDiv.appendChild(welcome);
      }
      this.chatHistory.forEach(msg => {
          const div = document.createElement('div'); div.className = `message ${msg.role}`; div.innerHTML = msg.text; 
          if(msg.image) { 
              const isPdf = msg.image.startsWith('data:application/pdf');
              if (isPdf) {
                  div.innerHTML += `<div style="height:80px; width:80px; background:#f44336; color:white; display:flex; align-items:center; justify-content:center; border-radius:8px; font-weight:bold; margin-top:5px;">PDF</div>`;
              } else {
                  const img = document.createElement('img'); img.src = msg.image; img.style.maxWidth = "100%"; img.style.borderRadius = "8px"; img.style.marginTop = "5px"; div.appendChild(img); 
              }
          }
          if(msg.isStatus) div.id = 'chat-status-msg'; messagesDiv.appendChild(div);
      });
      chatContainer.appendChild(messagesDiv);
      
      const previewArea = document.createElement('div'); previewArea.id = "chat-img-preview"; previewArea.style.display = this.chatImage ? "flex" : "none"; previewArea.style.padding = "10px"; previewArea.style.background = "#222"; previewArea.style.borderTop = "1px solid #444"; previewArea.style.alignItems = "center"; previewArea.style.gap = "10px";
      const isPdfAttached = this.chatImage && this.chatImage.startsWith('data:application/pdf');
      previewArea.innerHTML = `
        <div style="display:inline-block; position:relative;">
            ${isPdfAttached ? `<div style="height:50px; width:50px; background:#f44336; color:white; display:flex; align-items:center; justify-content:center; border-radius:4px; font-weight:bold; font-size:10px;">PDF</div>` : `<img src="${this.chatImage || ''}" style="height:50px; border-radius:4px; border:1px solid #666">`}
            <div id="chat-remove-img" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; width:15px; height:15px; font-size:10px; text-align:center; cursor:pointer; line-height:15px;">✕</div>
        </div>
        <span style="color:#aaa; font-size:12px;">File attached (Scan Mode)</span>
      `;
      chatContainer.appendChild(previewArea);
      
      const inputBar = document.createElement('div'); inputBar.className = 'chat-input-bar';
      const cameraIcon = ICONS.camera || `<svg viewBox="0 0 24 24" style="width:24px; height:24px;"><path fill="currentColor" d="M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z" /></svg>`;
      const uploadIcon = ICONS.image || `<svg viewBox="0 0 24 24" style="width:24px; height:24px;"><path fill="currentColor" d="M21,19V5c0-1.1-0.9-2-2-2H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14C20.1,21,21,20.1,21,19z M8.5,13.5l2.5,3.01L14.5,12l4.5,6H5L8.5,13.5z" /></svg>`;
      
      inputBar.innerHTML = `
        <button id="chat-camera-btn" type="button" style="background:none; border:none; color:var(--primary, #03a9f4); cursor:pointer; padding:0 10px; height:40px; width:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${cameraIcon}</button>
        <button id="chat-file-btn" type="button" style="background:none; border:none; color:var(--primary, #03a9f4); cursor:pointer; padding:0 10px; height:40px; width:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${uploadIcon}</button>
        <input type="text" class="chat-input" placeholder="Type message or scan file..." style="flex:1; padding:10px; border-radius:20px; border:1px solid var(--border-input); background:var(--bg-input); color:var(--text-main); outline:none;">
        <button id="chat-send-btn" class="chat-send-btn" style="flex-shrink:0; background:var(--primary); color:white; border:none; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer;">${ICONS.send}</button>
      `;

      const camBtn = inputBar.querySelector('#chat-camera-btn');
      const fileBtn = inputBar.querySelector('#chat-file-btn');
      const input = inputBar.querySelector('input');
      const sendBtn = inputBar.querySelector('#chat-send-btn');
      
      previewArea.querySelector('#chat-remove-img').onclick = () => { this.chatImage = null; this.render(); };
      
      const sendMessage = async () => {
          const text = input.value.trim(), fileData = this.chatImage; if (!text && !fileData) return;
          this.chatHistory.push({ role: 'user', text: text || (fileData.startsWith('data:application/pdf') ? "Scanned PDF Invoice" : "Scanned Photo Invoice"), image: fileData });
          this.chatImage = null; this.render(); 
          const statusMsg = { role: 'system', text: `Starting Process...<br>${fileData ? "Reading Document..." : "Analyzing..."}`, isStatus: true };
          this.chatHistory.push(statusMsg); this.render();
          try {
              const result = await this._hass.callWS({ type: 'home_organizer/ai_chat', message: text, image_data: fileData });
              if (result) {
                    let debugHTML = "";
                    if (result.debug) {
                        const d = result.debug, esc = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
                        if (d.raw_json) debugHTML += `<details class="debug-details"><summary class="debug-summary">📄 Raw Data</summary><div class="debug-content">${esc(d.raw_json)}</div></details>`;
                        if (d.intent === "add_invoice") debugHTML += `<details class="debug-details"><summary class="debug-summary">➕ Items List</summary><div class="debug-content">${JSON.stringify(d, null, 2)}</div></details>`;
                    }
                    statusMsg.text = "✔ Complete" + debugHTML;
                    if (result.error) this.chatHistory.push({ role: 'ai', text: "<b>Error:</b> " + result.error });
                    else if (result.response) { this.chatHistory.push({ role: 'ai', text: result.response.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') }); }
              }
          } catch (e) { statusMsg.text += "<br>❌ Failed"; this.chatHistory.push({ role: 'ai', text: "Error: " + e.message }); }
          this.render();
      };

      camBtn.onclick = () => this.handleChatCamera();
      fileBtn.onclick = () => {
          let fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*,application/pdf';
          fileInput.onchange = (e) => {
              const file = e.target.files[0]; if (!file) return;
              if (file.type === 'application/pdf') {
                  const reader = new FileReader();
                  reader.onload = (ev) => { this.chatImage = ev.target.result; this.render(); };
                  reader.readAsDataURL(file);
              } else {
                  this.compressImage(file, (dataUrl) => { this.chatImage = dataUrl; this.render(); }, false, 2048);
              }
          };
          fileInput.click();
      };
      sendBtn.onclick = sendMessage; input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
      chatContainer.appendChild(inputBar); container.appendChild(chatContainer);
      setTimeout(() => messagesDiv.scrollTop = messagesDiv.scrollHeight, 50);
  }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
