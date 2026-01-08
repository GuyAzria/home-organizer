// Home Organizer Ultimate - Ver 5.1.0 (Fixed Add Logic)
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
  cut: '<svg viewBox="0 0 24 24"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5 .5-.5 .5 .22 .5 .5-.22 .5-.5 .5z"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24"><path d="M9 9l1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5zM19 19l-2.5-1 2.5-1 1-2.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
  wand: '<svg viewBox="0 0 24 24"><path d="M7.5 5.6L10 7 7.5 8.4 6.1 10.9 4.7 8.4 2.2 7 4.7 5.6 6.1 3.1 7.5 5.6zm12 9.8L17 14l2.5-1.4L18.1 10.1 19.5 12.6 22 14 19.5 15.4 18.1 17.9 17 15.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zm-8.8 11.2l-1.4-2.5L10.4 13.2 8 14.6 10.4 16 11.8 18.5 13.2 16 15.6 14.6 13.2 13.2z"/></svg>',
  move: '<svg viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>',
  plus_thick: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>' 
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
      this.shopQuantities = {};
      this.subscribed = false;
      this.initUI();
    }

    if (this._hass && this._hass.connection && !this.subscribed) {
        this.subscribed = true;
        this._hass.connection.subscribeEvents((e) => this.fetchData(), 'home_organizer_db_update');
        this.fetchData();
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
      } catch (e) { console.error("Fetch error", e); }
  }

  initUI() {
    this.content = true;
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host { --app-bg: #1c1c1e; --primary: #03a9f4; --accent: #4caf50; --danger: #f44336; --text: #fff; --border: #333; --warning: #ffeb3b; --icon-btn-bg: #444; }
        * { box-sizing: border-box; }
        .app-container { background: var(--app-bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; font-family: sans-serif; direction: rtl; }
        svg { width: 24px; height: 24px; fill: currentColor; }
        .top-bar { background: #242426; padding: 10px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; height: 60px; }
        .nav-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .nav-btn:hover { background: rgba(255,255,255,0.1); }
        .nav-btn.active { color: var(--warning); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; position: relative; }
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; }
        .folder-delete-btn { position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        
        /* Inline Add Button Style */
        .add-folder-btn .android-folder-icon { border: 2px solid var(--accent); background: rgba(76, 175, 80, 0.1); color: var(--accent); }
        .folder-input { width: 100%; font-size: 12px; text-align: center; background: #222; color: white; border: 1px solid var(--accent); border-radius: 4px; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; min-height: 35px; }
        .edit-subloc-btn { width: 32px; height: 32px; background: none; border: none; color: #aaa; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .delete-subloc-btn { width: 32px; height: 32px; background: none; border: none; color: var(--danger); cursor: pointer; display: flex; align-items: center; justify-content: center; }

        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; touch-action: pan-y; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; cursor: default; }
        .out-of-stock-frame { border: 2px solid var(--danger); }
        
        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; }
        .item-left { display: flex; align-items: center; gap: 10px; }
        .item-icon { color: var(--primary); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; }
        .item-thumbnail { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #fff; display: block; border: 1px solid #444; }
        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        .bottom-bar { display: none; } 
        .expanded-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #555; display: flex; flex-direction: column; gap: 10px; }
        .detail-row { display: flex; gap: 10px; align-items: center; }
        .action-btn { width: 40px; height: 40px; border-radius: 8px; border: 1px solid #555; color: #ccc; background: var(--icon-btn-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; }
        .btn-text { width: auto; padding: 0 15px; font-weight: bold; color: white; background: var(--primary); border: none; }
        
        /* Add Item Button (List View) */
        .add-item-row { background: rgba(76, 175, 80, 0.1); border: 1px dashed var(--accent); color: var(--accent); text-align: center; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 10px; }
        
        .move-container { display: flex; gap: 5px; align-items: center; flex: 1; }
        .move-select { flex: 1; padding: 8px; background: #222; color: white; border: 1px solid #555; border-radius: 6px; }
        .search-box { display:none; padding:10px; background:#2a2a2a; display:flex; gap: 5px; align-items: center; }
        
        /* Camera Overlay */
        #camera-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 2000; display: none; flex-direction: column; align-items: center; justify-content: center; }
        #camera-video { width: 100%; height: 80%; object-fit: cover; }
        .camera-controls { height: 20%; width: 100%; display: flex; align-items: center; justify-content: center; gap: 30px; background: rgba(0,0,0,0.5); position: absolute; bottom: 0; }
        .snap-btn { width: 70px; height: 70px; border-radius: 50%; background: white; border: 5px solid #ccc; cursor: pointer; }
        .close-cam-btn { color: white; background: none; border: none; font-size: 16px; cursor: pointer; }
        .wb-btn { color: #aaa; background: none; border: 2px solid #555; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-direction: column; font-size: 10px; }
        .wb-btn.active { color: #333; background: white; border-color: white; }
        #camera-canvas { display: none; }
        .direct-input-label { width: 40px; height: 40px; background: var(--icon-btn-bg); border-radius: 8px; border: 1px solid #555; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; color: #ccc; }
        .hidden-input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10; }
      </style>
      
      <div class="app-container" id="app">
         <div class="top-bar">
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">Organizer</div><div class="sub-title" id="display-path">Main</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box" style="display:none;padding:10px;background:#2a2a2a">
            <input type="text" id="search-input" style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333">
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="content" id="content"><div style="text-align:center;padding:20px;color:#888;">Loading...</div></div>
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
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;max-height:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const bind = (id, event, fn) => { const el = root.getElementById(id); if(el) el[event] = fn; };
    const click = (id, fn) => bind(id, 'onclick', fn);

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; this.fetchData(); });
    click('btn-search', () => { this.shadowRoot.getElementById('search-box').style.display = 'flex'; });
    click('search-close', () => { this.shadowRoot.getElementById('search-box').style.display = 'none'; });
    bind('search-input', 'oninput', (e) => this.fetchData());
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.render(); });
    
    click('btn-cam-close', () => this.stopCamera());
    click('btn-cam-snap', () => this.snapPhoto());
    click('btn-cam-switch', () => this.switchCamera());
    click('btn-cam-wb', () => this.toggleWhiteBG());
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    root.getElementById('display-title').innerText = attrs.path_display;
    const content = root.getElementById('content');
    content.innerHTML = '';

    // Shopping List
    if (attrs.shopping_list && attrs.shopping_list.length > 0) {
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';
        const grouped = {};
        attrs.shopping_list.forEach(item => { const loc = item.main_location || "Other"; if(!grouped[loc]) grouped[loc] = []; grouped[loc].push(item); });
        Object.keys(grouped).sort().forEach(locName => {
            const header = document.createElement('div'); header.className = 'group-separator'; header.innerText = locName; listContainer.appendChild(header);
            grouped[locName].forEach(item => listContainer.appendChild(this.createItemRow(item, true)));
        });
        content.appendChild(listContainer);
        return;
    }

    // Grid View
    if (attrs.depth < 2) {
        const grid = document.createElement('div');
        grid.className = 'folder-grid';
        if (attrs.folders) {
            attrs.folders.forEach(folder => {
                const el = document.createElement('div'); el.className = 'folder-item';
                el.onclick = () => this.navigate('down', folder.name);
                const deleteBtnHtml = this.isEditMode ? `<div class="folder-delete-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteFolder('${folder.name}')">✕</div>` : '';
                el.innerHTML = `<div class="android-folder-icon">${ICONS.folder}${deleteBtnHtml}</div><div class="folder-label">${folder.name}</div>`;
                grid.appendChild(el);
            });
        }
        
        // Inline Add Button
        const addBtn = document.createElement('div');
        addBtn.className = 'folder-item add-folder-btn';
        const labelText = (attrs.depth === 0) ? "הוסף חדר" : "הוסף מיקום";
        addBtn.innerHTML = `<div class="android-folder-icon">${ICONS.plus_thick}</div><div class="folder-label" id="add-folder-label">${labelText}</div>`;
        addBtn.onclick = (e) => {
            const labelEl = addBtn.querySelector('#add-folder-label');
            if (labelEl.querySelector('input')) return;
            const input = document.createElement('input'); input.type = 'text'; input.className = 'folder-input'; input.placeholder = labelText;
            input.onclick = (ev) => ev.stopPropagation();
            const create = () => { if(input.value) this.addItem('folder', input.value); };
            input.onblur = create; input.onkeydown = (ev) => { if(ev.key === 'Enter') create(); };
            labelEl.innerHTML = ''; labelEl.appendChild(input); input.focus();
        };
        grid.appendChild(addBtn);
        content.appendChild(grid);
    } 
    // List View
    else {
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';
        const inStock = [];
        const outOfStock = [];
        if (attrs.items) attrs.items.forEach(item => { if(item.qty === 0) outOfStock.push(item); else inStock.push(item); });
        
        const grouped = {};
        if (attrs.folders) attrs.folders.forEach(f => grouped[f.name] = []);
        if (!grouped["General"]) grouped["General"] = [];
        inStock.forEach(item => { const sub = item.sub_location || "General"; if(!grouped[sub]) grouped[sub] = []; grouped[sub].push(item); });

        Object.keys(grouped).sort().forEach(subName => {
            const header = document.createElement('div');
            header.className = 'group-separator';
            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `<span>${subName}</span> <div style="display:flex;gap:5px"><button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button><button class="delete-subloc-btn" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button></div>`;
            } else { header.innerText = subName; }
            listContainer.appendChild(header);
            grouped[subName].forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
            
            // Add Item Button inside Group
            const addSubItemBtn = document.createElement('div');
            addSubItemBtn.className = 'add-item-row';
            addSubItemBtn.innerText = "הוסף";
            addSubItemBtn.onclick = () => this.addItem('item', 'New Item', subName);
            listContainer.appendChild(addSubItemBtn);
        });
        
        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div'); oosHeader.className = 'group-separator oos-separator'; oosHeader.innerText = "Out of Stock"; listContainer.appendChild(oosHeader);
            outOfStock.forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
        }
        content.appendChild(listContainer);
    }
  }
  
  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     div.onclick = (e) => {
         if(!e.target.closest('button') && !e.target.closest('select') && !e.target.closest('input')) {
             this.toggleRow(item.name);
         }
     };

     let iconHtml = `<span class="item-icon">${ICONS.item}</span>`;
     if (item.img) iconHtml = `<img src="${item.img}" class="item-thumbnail" onclick="event.stopPropagation(); this.getRootNode().host.showImg('${item.img}')">`;
     
     let controls = '';
     if (isShopMode) {
         const localQty = (this.shopQuantities[item.name] !== undefined) ? this.shopQuantities[item.name] : 0;
         const checkStyle = (localQty === 0) ? "background:#555;color:#888;cursor:not-allowed;width:40px;height:40px;margin-left:8px;" : "background:var(--accent);width:40px;height:40px;margin-left:8px;";
         const checkDisabled = (localQty === 0) ? "disabled" : "";
         controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.adjustShopQty('${item.name}', -1)">${ICONS.minus}</button><span class="qty-val" style="margin:0 8px">${localQty}</span><button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.adjustShopQty('${item.name}', 1)">${ICONS.plus}</button><button class="qty-btn" style="${checkStyle}" ${checkDisabled} title="Complete" onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.name}')">${ICONS.check}</button>`;
     } else {
         controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button><span class="qty-val">${item.qty}</span><button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>`;
     }

     const subText = isShopMode ? `${item.main_location} > ${item.sub_location || ''}` : `${item.date || ''}`;

     div.innerHTML = `
        <div class="item-main">
            <div class="item-left">${iconHtml}<div><div>${item.name}</div><div class="sub-title">${subText}</div></div></div>
            <div class="item-qty-ctrl">${controls}</div>
        </div>
     `;
     
     if (this.expandedIdx === item.name) {
         const details = document.createElement('div');
         details.className = 'expanded-details';
         
         let dropdownOptions = `<option value="">-- Move to... --</option>`;
         dropdownOptions += `<option value="General">General (Root)</option>`;
         let roomOptions = `<option value="">-- Change Room --</option>`;
         if(this.localData.hierarchy) { Object.keys(this.localData.hierarchy).forEach(room => { roomOptions += `<option value="${room}">${room}</option>`; }); }
         if(this.localData.folders) { this.localData.folders.forEach(f => { dropdownOptions += `<option value="${f.name}">${f.name}</option>`; }); }

         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px" onclick="event.stopPropagation()">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px" onclick="event.stopPropagation()">
                <button class="action-btn btn-text" onclick="event.stopPropagation(); this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">Save</button>
            </div>
            <div class="detail-row" style="justify-content:space-between; margin-top:10px;">
                 <div style="display:flex;gap:10px;">
                    <button class="action-btn" title="Take Photo" onclick="event.stopPropagation(); this.getRootNode().host.triggerCameraEdit('${item.name}')">${ICONS.camera}</button>
                    <label class="action-btn" title="Upload Image" onclick="event.stopPropagation()">
                        ${ICONS.image}
                        <input type="file" accept="image/*" style="display:none" onchange="this.getRootNode().host.handleUpdateImage(this, '${item.name}')">
                    </label>
                 </div>
                 <div style="display:flex;gap:10px;">
                    <button class="action-btn btn-danger" title="Delete" onclick="event.stopPropagation(); this.getRootNode().host.del('${item.name}')">${ICONS.delete}</button>
                 </div>
            </div>
            <div class="detail-row" style="margin-top:10px; border-top:1px solid #444; padding-top:10px; flex-direction:column; gap:8px;">
                <div class="move-container" style="width:100%">
                    <span style="font-size:12px;color:#aaa;width:60px">Move to:</span>
                    <select class="move-select" id="room-select-${item.name}" onchange="event.stopPropagation(); this.getRootNode().host.updateLocationDropdown('${item.name}', this.value)" onclick="event.stopPropagation()">
                        ${roomOptions}
                    </select>
                </div>
                <div class="move-container" style="width:100%; display:none;" id="loc-container-${item.name}">
                    <span style="font-size:12px;color:#aaa;width:60px">Loc:</span>
                    <select class="move-select" id="loc-select-${item.name}" onchange="event.stopPropagation(); this.getRootNode().host.updateSublocDropdown('${item.name}', this.value)" onclick="event.stopPropagation()">
                        <option value="">-- Select --</option>
                    </select>
                </div>
                <div class="move-container" style="width:100%; display:none;" id="subloc-container-${item.name}">
                    <span style="font-size:12px;color:#aaa;width:60px">Sub:</span>
                    <select class="move-select" id="target-subloc-${item.name}" onchange="event.stopPropagation(); this.getRootNode().host.handleMoveToPath('${item.name}')" onclick="event.stopPropagation()">
                        <option value="">-- Select --</option>
                    </select>
                </div>
            </div>
         `;
         div.appendChild(details);
     }
     return div;
  }
  
  // Updated addItem to support sublocation context
  addItem(type, nameOverride, subLocation) {
    const name = nameOverride || `New Item ${Date.now().toString().slice(-4)}`;
    const date = new Date().toISOString().split('T')[0];
    let path = [...this.currentPath];
    if (subLocation && subLocation !== "General") { path.push(subLocation); }
    
    this._hass.callService('home_organizer', 'add_item', { item_name: name, item_type: type, item_date: date, image_data: null, current_path: path });
  }

  // --- Helper Methods ---
  toggleWhiteBG() { this.useAiBg = !this.useAiBg; const btn = this.shadowRoot.getElementById('btn-cam-wb'); if (this.useAiBg) btn.classList.add('active'); else btn.classList.remove('active'); }
  async openCamera(context) { this.cameraContext = context; const modal = this.shadowRoot.getElementById('camera-modal'); const video = this.shadowRoot.getElementById('camera-video'); modal.style.display = 'flex'; try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facingMode || "environment" } }); video.srcObject = this.stream; } catch (err) { alert("Camera Error: " + err.message); modal.style.display = 'none'; } }
  stopCamera() { const modal = this.shadowRoot.getElementById('camera-modal'); const video = this.shadowRoot.getElementById('camera-video'); if (this.stream) this.stream.getTracks().forEach(track => track.stop()); video.srcObject = null; modal.style.display = 'none'; }
  async switchCamera() { this.facingMode = (this.facingMode === "user") ? "environment" : "user"; this.stopCamera(); setTimeout(() => this.openCamera(this.cameraContext), 200); }
  snapPhoto() { const video = this.shadowRoot.getElementById('camera-video'); const canvas = this.shadowRoot.getElementById('camera-canvas'); const context = canvas.getContext('2d'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0, canvas.width, canvas.height); if (this.useAiBg) { let imageData = context.getImageData(0, 0, canvas.width, canvas.height); let data = imageData.data; for (let i = 0; i < data.length; i += 4) { let r = data[i], g = data[i+1], b = data[i+2]; if (r > 190 && g > 190 && b > 190) { data[i] = 255; data[i+1] = 255; data[i+2] = 255; } } context.putImageData(imageData, 0, 0); } const dataUrl = canvas.toDataURL('image/jpeg', 0.5); this.stopCamera(); if (this.cameraContext === 'search') { this.callHA('ai_action', { mode: 'search', image_data: dataUrl }); } else if (this.pendingItem) { this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl }); this.pendingItem = null; } else { /* No logic for new item from camera */ } }
  
  handleUpdateImage(input, name) { const file = input.files[0]; if (!file) return; this.compressImage(file, (dataUrl) => { this.callHA('update_image', { item_name: name, image_data: dataUrl }); }); input.value = ''; }
  compressImage(file, callback) { const reader = new FileReader(); reader.onload = (e) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const MAX = 1024; let w = img.width, h = img.height; if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } } canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h); callback(canvas.toDataURL('image/jpeg', 0.5)); }; img.src = e.target.result; }; reader.readAsDataURL(file); }
  
  updateLocationDropdown(itemName, roomName) { const locContainer = this.shadowRoot.getElementById(`loc-container-${itemName}`); const locSelect = this.shadowRoot.getElementById(`loc-select-${itemName}`); const subContainer = this.shadowRoot.getElementById(`subloc-container-${itemName}`); subContainer.style.display = 'none'; locSelect.innerHTML = '<option value="">-- Select --</option>'; if(!roomName) { locContainer.style.display = 'none'; return; } let html = `<option value="">-- Select Location --</option>`; if(this.localData.hierarchy && this.localData.hierarchy[roomName]) { Object.keys(this.localData.hierarchy[roomName]).forEach(loc => { html += `<option value="${loc}">${loc}</option>`; }); } locSelect.innerHTML = html; locContainer.style.display = 'flex'; locSelect.dataset.room = roomName; }
  updateSublocDropdown(itemName, locationName) { const subContainer = this.shadowRoot.getElementById(`subloc-container-${itemName}`); const subSelect = this.shadowRoot.getElementById(`target-subloc-${itemName}`); const roomName = this.shadowRoot.getElementById(`room-select-${itemName}`).value; if(!locationName) { subContainer.style.display = 'none'; return; } let html = `<option value="">-- Select Sublocation --</option>`; html += `<option value="__ROOT__">Main ${locationName}</option>`; if(this.localData.hierarchy && this.localData.hierarchy[roomName] && this.localData.hierarchy[roomName][locationName]) { this.localData.hierarchy[roomName][locationName].forEach(sub => { html += `<option value="${sub}">${sub}</option>`; }); } subSelect.innerHTML = html; subContainer.style.display = 'flex'; }
  handleMoveToPath(itemName) { const room = this.shadowRoot.getElementById(`room-select-${itemName}`).value; const loc = this.shadowRoot.getElementById(`loc-select-${itemName}`).value; const sub = this.shadowRoot.getElementById(`target-subloc-${itemName}`).value; if(!room || !loc || !sub) return; let targetPath = [room, loc]; if(sub !== "__ROOT__") targetPath.push(sub); this.callHA('clipboard_action', {action: 'cut', item_name: itemName}); setTimeout(() => { this.callHA('paste_item', {target_path: targetPath}); }, 100); }
  
  deleteFolder(name) { if(confirm(`Delete folder '${name}' and ALL items inside it?`)) { this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: true }); } }
  deleteSubloc(name) { if(confirm(`Delete '${name}'?`)) { this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: true }); } }
  renameSubloc(oldName) { const newName = prompt("Rename:", oldName); if (newName && newName !== oldName) { this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" }); } }
  submitShopStock(name) { const qty = this.shopQuantities[name] || 1; this.callHA('update_stock', { item_name: name, quantity: qty }); delete this.shopQuantities[name]; }
  adjustShopQty(name, delta) { if (this.shopQuantities[name] === undefined) { this.shopQuantities[name] = 0; } this.shopQuantities[name] = Math.max(0, this.shopQuantities[name] + delta); this.render(); }
  pasteItem() { this.callHA('paste_item', { target_path: this.currentPath }); }
  saveDetails(idx, oldName) { const nEl = this.shadowRoot.getElementById(`name-${idx}`); const dEl = this.shadowRoot.getElementById(`date-${idx}`); if(nEl && dEl) { this.callHA('update_item_details', { original_name: oldName, new_name: nEl.value, new_date: dEl.value }); this.expandedIdx = null; } }
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: false }); }
  showImg(src) { const ov = this.shadowRoot.getElementById('overlay-img'); const ovc = this.shadowRoot.getElementById('img-overlay'); if(ov && ovc) { ov.src = src; ovc.style.display = 'flex'; } }
  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);
