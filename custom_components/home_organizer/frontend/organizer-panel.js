// Home Organizer Ultimate - Ver 2.3.4 (Syntax Fix)
// License: MIT

const ICONS = {
  arrow_up: '<svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  item: '<svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>',
  delete: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  cut: '<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64z"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
  folder_add: '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/></svg>',
  item_add: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24"><path d="M9 9l1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5zM19 19l-2.5-1 2.5-1 1-2.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>'
};

class HomeOrganizerPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.currentPath = [];
      this.isEditMode = false;
      this.isSearch = false;
      this.isShopMode = false;
      this.expandedIdx = null;
      this.lastAI = "";
      this.localData = null; 
      this.initUI();
      
      // Connect to websocket updates safely
      if (this._hass && this._hass.connection) {
          this._hass.connection.subscribeEvents((e) => this.fetchData(), 'home_organizer_db_update');
          this._hass.connection.subscribeEvents((e) => {
              if (e.data.mode === 'identify') {
                  const input = this.shadowRoot.getElementById('add-name');
                  if(input) input.value = e.data.result;
              }
          }, 'home_organizer_ai_result');
          this.fetchData(); 
      }
    }
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
      } catch (e) {
          console.error("Fetch error", e);
          const content = this.shadowRoot.getElementById('content');
          if(content) {
              content.innerHTML = `<div style="padding:20px;text-align:center;color:#f44336">
                <strong>Connection Error</strong><br>
                Integration not ready.<br>
                1. Check Logs<br>
                2. Restart Home Assistant<br>
                3. Clear Browser Cache
              </div>`;
          }
      }
  }

  initUI() {
    this.content = true;
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host { --app-bg: #1c1c1e; --primary: #03a9f4; --accent: #4caf50; --danger: #f44336; --text: #fff; --border: #333; --warning: #ffeb3b; }
        * { box-sizing: border-box; }
        .app-container { background: var(--app-bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; font-family: sans-serif; direction: rtl; }
        svg { width: 24px; height: 24px; fill: currentColor; }
        .top-bar { background: #242426; padding: 10px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; height: 60px; }
        .nav-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .nav-btn:hover { background: rgba(255,255,255,0.1); }
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; }
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .android-folder-icon svg { width: 28px; height: 28px; }
        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 20px 0 10px 0; 
            border-bottom: 1px solid #444; padding-bottom: 4px; 
            text-transform: uppercase; font-weight: bold; 
            display: flex; justify-content: space-between; align-items: center;
            min-height: 35px; /* Bigger drop target for mobile */
        }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); background: rgba(3, 169, 244, 0.1); }
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }

        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; touch-action: pan-y; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; cursor: default; }
        .out-of-stock-frame { border: 2px solid var(--danger); }
        
        /* Dragging visuals */
        .item-row.dragging { opacity: 0.5; border: 2px dashed var(--primary); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; }
        .item-left { display: flex; align-items: center; gap: 10px; }
        .item-icon { color: var(--primary); }
        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .qty-val { min-width: 20px; text-align: center; font-weight: bold; }

        .bottom-bar { background: #242426; padding: 15px; border-top: 1px solid var(--border); display: none; }
        .edit-mode .bottom-bar { display: block; }
        
        .expanded-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #555; display: flex; flex-direction: column; gap: 10px; }
        .detail-row { display: flex; gap: 10px; align-items: center; }
        .action-btn { flex: 1; padding: 8px; border-radius: 6px; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .img-preview { width: 50px; height: 50px; border-radius: 4px; object-fit: cover; background: #333; }
        
        .search-box { display:none; padding:10px; background:#2a2a2a; display:flex; gap: 5px; align-items: center; }
        .ai-btn { color: #FFD700 !important; }
      </style>
      
      <div class="app-container" id="app">
         <div class="top-bar">
            <div style="display:flex;gap:5px">
                <button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button>
                <button class="nav-btn" id="btn-home">${ICONS.home}</button>
            </div>
            <div class="title-box">
                <div class="main-title" id="display-title">Organizer</div>
                <div class="sub-title" id="display-path">Main</div>
            </div>
            <div style="display:flex;gap:5px">
                <button class="nav-btn" id="btn-shop">${ICONS.cart}</button>
                <button class="nav-btn" id="btn-search">${ICONS.search}</button>
                <button class="nav-btn" id="btn-edit">${ICONS.edit}</button>
            </div>
        </div>
        
        <div class="search-box" id="search-box">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button></div>
        
        <div class="content" id="content">
            <div style="text-align:center;padding:20px;color:#888;">Loading...</div>
        </div>
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <div class="cam-btn" id="add-cam-btn" style="width:45px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative"><input type="file" id="add-file" style="position:absolute;width:100%;height:100%;opacity:0"><span id="add-cam-icon">${ICONS.camera}</span></div>
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="Name..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">Location</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">Item</button></div>
        </div>
      </div>
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    
    // Bind Helper
    const bind = (id, event, fn) => { const el = root.getElementById(id); if(el) el[event] = fn; };
    const click = (id, fn) => bind(id, 'onclick', fn);

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => this.navigate('root'));
    
    click('btn-shop', () => { 
        this.isShopMode = !this.isShopMode; 
        if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } 
        this.fetchData(); 
    });
    
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    
    bind('search-input', 'oninput', (e) => this.fetchData()); // Real-time search
    
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    bind('add-file', 'onchange', (e) => this.handleFile(e));
    
    click('btn-create-folder', () => this.addItem('folder'));
    click('btn-create-item', () => this.addItem('item'));
    click('btn-paste', () => this.pasteItem());
    
    const dateIn = root.getElementById('add-date');
    if(dateIn) dateIn.value = new Date().toISOString().split('T')[0];
    
    // AI
    click('btn-ai-magic', () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    });
    
    const searchAiBtn = root.getElementById('btn-ai-search');
    if(searchAiBtn) {
        const searchInput = document.createElement('input');
        searchInput.type = 'file';
        searchInput.accept = 'image/*';
        searchInput.style.display = 'none';
        searchInput.onchange = (e) => {
             const file = e.target.files[0]; if (!file) return;
             const reader = new FileReader();
             reader.onload = (evt) => this.callHA('ai_action', { mode: 'search', image_data: evt.target.result });
             reader.readAsDataURL(file);
        };
        searchAiBtn.onclick = () => searchInput.click();
    }
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    
    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.3.4';
    
    // Controls Visibility
    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    const content = root.getElementById('content');
    content.innerHTML = '';

    // 1. SHOPPING LIST
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

    // 2. SEARCH MODE
    if ((this.isSearch || (attrs.path_display && attrs.path_display.startsWith('Search'))) && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

    // 3. BROWSE MODE
    if (attrs.depth < 2) {
        if (attrs.folders && attrs.folders.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'folder-grid';
            attrs.folders.forEach(folder => {
                const el = document.createElement('div');
                el.className = 'folder-item';
                el.onclick = () => this.navigate('down', folder.name);
                el.innerHTML = `<div class="android-folder-icon">${ICONS.folder}</div><div class="folder-label">${folder.name}</div>`;
                grid.appendChild(el);
            });
            content.appendChild(grid);
        }
        if (attrs.items && attrs.items.length > 0) {
            const list = document.createElement('div');
            list.className = 'item-list';
            attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
            content.appendChild(list);
        }
    } 
    else {
        // List View (Inside Main Location)
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';
        
        const inStock = [], outOfStock = [];
        if (attrs.items) attrs.items.forEach(item => (item.qty === 0 ? outOfStock : inStock).push(item));

        const grouped = {};
        if (attrs.folders) attrs.folders.forEach(f => grouped[f.name] = []);
        if (!grouped["General"]) grouped["General"] = [];

        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if(!grouped[sub]) grouped[sub] = [];
            grouped[sub].push(item);
        });

        Object.keys(grouped).sort().forEach(subName => {
            if (subName === "General" && grouped[subName].length === 0 && !this.isEditMode) return;

            const header = document.createElement('div');
            header.className = 'group-separator';
            // Setup Drag Drop Handlers for Desktop
            this.setupDropTarget(header, subName);

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `<span>${subName}</span> <div style="display:flex;gap:5px"><button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button><button class="edit-subloc-btn" style="color:var(--danger)" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button></div>`;
            } else {
                header.innerText = subName;
            }
            listContainer.appendChild(header);
            grouped[subName].forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
        });

        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);
            outOfStock.forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
        }
        content.appendChild(listContainer);
    }
  }

  // --- MOBILE DRAG & DROP LOGIC ---
  setupDragSource(el, itemName) {
      // Desktop
      el.draggable = true;
      el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", itemName); e.dataTransfer.effectAllowed = "move"; el.classList.add('dragging'); };
      el.ondragend = () => el.classList.remove('dragging');

      // Mobile (Touch)
      let longPressTimer;
      el.addEventListener('touchstart', (e) => {
          longPressTimer = setTimeout(() => {
              el.classList.add('dragging');
              // Store dragged item data globally or on host
              this.draggedItemName = itemName;
              this.isDragging = true;
              // Vibration feedback
              if (navigator.vibrate) navigator.vibrate(50);
          }, 500); 
      }, {passive: false});

      el.addEventListener('touchmove', (e) => {
          if (this.isDragging) {
              e.preventDefault(); // Stop scrolling
              const touch = e.touches[0];
              // Move ghost element if we implemented one, for now just highlight
              
              // Detect Drop Target
              const target = document.elementFromPoint(touch.clientX, touch.clientY);
              const header = target?.closest('.group-separator');
              
              // Clear previous highlights
              this.shadowRoot.querySelectorAll('.group-separator').forEach(h => h.classList.remove('drag-over'));
              
              if (header) header.classList.add('drag-over');
          } else {
              clearTimeout(longPressTimer);
          }
      }, {passive: false});

      el.addEventListener('touchend', (e) => {
          clearTimeout(longPressTimer);
          if (this.isDragging) {
              const touch = e.changedTouches[0];
              const target = document.elementFromPoint(touch.clientX, touch.clientY);
              const header = target?.closest('.group-separator');
              
              if (header && header.dataset.subloc) {
                  this.handleDropAction(header.dataset.subloc, this.draggedItemName);
              }
              
              this.isDragging = false;
              this.draggedItemName = null;
              el.classList.remove('dragging');
              this.shadowRoot.querySelectorAll('.group-separator').forEach(h => h.classList.remove('drag-over'));
          }
      });
  }

  setupDropTarget(el, subName) {
      el.dataset.subloc = subName; // Store for touch
      el.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); };
      el.ondragleave = () => el.classList.remove('drag-over');
      el.ondrop = (e) => { 
          e.preventDefault(); 
          el.classList.remove('drag-over'); 
          const itemName = e.dataTransfer.getData("text/plain");
          this.handleDropAction(subName, itemName); 
      };
  }

  async handleDropAction(targetSubloc, itemName) {
      if (!itemName) return;
      let targetPath = [...this.currentPath];
      if (targetSubloc !== "General") targetPath.push(targetSubloc);
      
      try {
          await this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
          await this.callHA('paste_item', {target_path: targetPath});
          // No need to notifyContext, backend event will trigger refresh
      } catch (err) { console.error("Drop failed:", err); }
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     // Attach Drag Logic
     this.setupDragSource(div, item.name);

     let controls = '';
     if (isShopMode) {
         controls = `
            <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>
            <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button>
            <button class="qty-btn" style="background:var(--primary)" onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.name}')">${ICONS.save}</button>
         `;
     } else {
         controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button>
                     <span class="qty-val">${item.qty}</span>
                     <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>`;
     }

     const subText = isShopMode ? `${item.main_location} > ${item.sub_location || ''}` : `${item.date || ''}`;

     div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.name}')">
            <div class="item-left">
                <span class="item-icon">${ICONS.item}</span>
                <div>
                    <div>${item.name}</div>
                    <div class="sub-title">${subText}</div>
                </div>
            </div>
            <div class="item-qty-ctrl">${controls}</div>
        </div>
     `;
     
     if (this.expandedIdx === item.name) {
         const details = document.createElement('div');
         details.className = 'expanded-details';
         
         // FEATURE: Button to Move Item (Alternative to Drag)
         // Calculate possible move targets (sublocations)
         let moveOptions = "";
         if(this.localData.folders) {
             this.localData.folders.forEach(f => {
                 moveOptions += `<button class="action-btn" style="background:#444;margin-top:5px" onclick="this.getRootNode().host.handleDropAction('${f.name}', '${item.name}')">Move to ${f.name}</button>`;
             });
             // Always option to move to General
             moveOptions += `<button class="action-btn" style="background:#444;margin-top:5px" onclick="this.getRootNode().host.handleDropAction('General', '${item.name}')">Move to General</button>`;
         }

         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn" style="background:var(--primary)" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">Save</button>
            </div>
            <div class="detail-row" style="justify-content:space-between">
                 <div style="position:relative;width:50px;height:50px">
                    ${item.img ? `<img src="${item.img}" class="img-preview" onclick="this.getRootNode().host.showImg('${item.img}')">` : '<div class="img-preview"></div>'}
                    <input type="file" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0" onchange="this.getRootNode().host.handleUpdateImage(this, '${item.name}')">
                 </div>
                 <div style="display:flex;gap:5px">
                    <button class="action-btn" style="background:#555" onclick="this.getRootNode().host.cut('${item.name}')">${ICONS.cut}</button>
                    <button class="action-btn" style="background:var(--danger)" onclick="this.getRootNode().host.del('${item.name}')">${ICONS.delete}</button>
                 </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;border-top:1px solid #444;padding-top:5px;margin-top:5px">
                ${moveOptions}
            </div>
         `;
         div.appendChild(details);
     }
     return div;
  }

  deleteSubloc(name) {
      if(confirm(`Delete '${name}'?`)) {
          this.callHA('update_item_details', { original_name: name, new_name: "", new_date: "" });
      }
  }

  render() { this.updateUI(); }
  navigate(dir, name) { 
      if (dir === 'root') this.currentPath = [];
      else if (dir === 'up') this.currentPath.pop();
      else if (dir === 'down' && name) this.currentPath.push(name);
      
      // We don't call HA navigate logic anymore, we just fetch new data for our new path
      this.fetchData();
  }
  
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  submitShopStock(name) { this.callHA('update_stock', { item_name: name, quantity: 1 }); }
  
  // No longer needed: notifyContext (we pull, not push context)

  addItem(type) {
    const nEl = this.shadowRoot.getElementById('add-name');
    const dEl = this.shadowRoot.getElementById('add-date');
    if (!nEl || !nEl.value) return alert("Name required");
    // Pass current_path context explicitly
    this._hass.callService('home_organizer', 'add_item', { 
        item_name: nEl.value, item_type: type, item_date: dEl.value, image_data: this.tempAddImage, 
        current_path: this.currentPath // Custom injection
    });
    nEl.value = ''; this.tempAddImage = null;
    const ic = this.shadowRoot.getElementById('add-cam-icon');
    if(ic) ic.innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename:", oldName);
      if (newName && newName !== oldName) {
          this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" });
      }
  }

  handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        this.tempAddImage = evt.target.result;
        this.shadowRoot.getElementById('add-cam-icon').innerHTML = `<img src="${this.tempAddImage}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
    }; reader.readAsDataURL(file);
  }

  handleUpdateImage(input, name) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => this.callHA('update_image', { item_name: name, image_data: evt.target.result });
    reader.readAsDataURL(file);
  }

  pasteItem() { this.callHA('paste_item', { target_path: this.currentPath }); }
  
  saveDetails(idx, oldName) {
      const nEl = this.shadowRoot.getElementById(`name-${idx}`);
      const dEl = this.shadowRoot.getElementById(`date-${idx}`);
      if(nEl && dEl) {
          this.callHA('update_item_details', { original_name: oldName, new_name: nEl.value, new_date: dEl.value });
          this.expandedIdx = null;
      }
  }
  
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this.callHA('delete_item', {item_name: name}); }
  showImg(src) { 
      const ov = this.shadowRoot.getElementById('overlay-img');
      const ovc = this.shadowRoot.getElementById('img-overlay');
      if(ov && ovc) { ov.src = src; ovc.style.display = 'flex'; }
  }

  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);
