// Home Organizer Ultimate - Ver 5.6.7 (Stable 5.6.3 Base + Square Yellow Category Picker)
// License: MIT

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=5.6.4';

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
      this.pendingItem = null;
      this.useAiBg = true; 
      this.shopQuantities = {};
      this.expandedSublocs = new Set(); 
      this.subscribed = false;
      this.pickerContext = 'room'; 
      this.pickerPage = 0;
      this.pickerPageSize = 15;
      
      // Category State
      this.selectedItemCategory = (ICON_LIB_ITEM && Object.keys(ICON_LIB_ITEM).length > 0) ? Object.keys(ICON_LIB_ITEM)[0] : "";

      this.initUI();
    }

    if (this._hass && this._hass.connection && !this.subscribed) {
        this.subscribed = true;
        this._hass.connection.subscribeEvents((e) => this.fetchData(), 'home_organizer_db_update');
        this._hass.connection.subscribeEvents((e) => {
             if (e.data.mode === 'identify') {
                 // AI logic
             }
        }, 'home_organizer_ai_result');
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
      } catch (e) {
          console.error("Fetch error", e);
      }
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
        .nav-btn.edit-active { color: var(--accent); } 
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; position: relative; }
        
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; overflow: visible; }
        .android-folder-icon svg { width: 34px; height: 34px; }
        .android-folder-icon img { width: 38px; height: 38px; object-fit: contain; border-radius: 4px; }
        
        .folder-delete-btn { position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-edit-btn { position: absolute; top: -5px; left: -5px; background: var(--primary); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-edit-btn svg { width: 12px; height: 12px; }
        .folder-img-btn { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); background: #ff9800; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-img-btn svg { width: 12px; height: 12px; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; min-height: 35px; cursor: pointer; }
        .group-separator:hover { background: rgba(255,255,255,0.05); }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); background: rgba(3, 169, 244, 0.1); }
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }
        .delete-subloc-btn { background: none; border: none; color: var(--danger); cursor: pointer; padding: 4px; }

        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; touch-action: pan-y; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; cursor: default; }
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; }
        .item-left { display: flex; align-items: center; gap: 10px; }
        .item-icon { color: var(--primary); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; }
        .item-thumbnail { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #000; display: block; border: 1px solid #444; }

        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        .add-folder-card .android-folder-icon { border: 2px dashed #4caf50; background: rgba(76, 175, 80, 0.1); color: #4caf50; }
        .add-folder-card:hover .android-folder-icon { background: rgba(76, 175, 80, 0.2); }
        .add-folder-input { width: 100%; height: 100%; border: none; background: transparent; color: white; text-align: center; font-size: 12px; padding: 5px; outline: none; }
        
        .text-add-btn { background: none; border: none; color: var(--primary); font-size: 14px; font-weight: bold; cursor: pointer; padding: 8px 0; display: flex; align-items: center; gap: 5px; opacity: 0.8; }
        .text-add-btn:hover { opacity: 1; text-decoration: underline; }
        .group-add-row { padding: 0 10px; margin-bottom: 15px; }

        .add-item-btn-row { width: 100%; margin-top: 10px; }
        .add-item-btn { width: 100%; padding: 12px; background: rgba(76, 175, 80, 0.15); border: 1px dashed #4caf50; color: #4caf50; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; transition: background 0.2s; }
        .add-item-btn:hover { background: rgba(76, 175, 80, 0.3); }

        .expanded-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #555; display: flex; flex-direction: column; gap: 10px; }
        .detail-row { display: flex; gap: 10px; align-items: center; }
        
        .action-btn { width: 40px; height: 40px; border-radius: 8px; border: 1px solid #555; color: #ccc; background: var(--icon-btn-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; }
        .action-btn:hover { background: #555; color: white; }
        .btn-danger { color: #ff8a80; border-color: #d32f2f; }
        .btn-text { width: auto; padding: 0 15px; font-weight: bold; color: white; background: var(--primary); border: none; }
        .move-container { display: flex; gap: 5px; align-items: center; flex: 1; }
        .move-select { flex: 1; padding: 8px; background: #222; color: white; border: 1px solid #555; border-radius: 6px; }
        .search-box { display:none; padding:10px; background:#2a2a2a; display:flex; gap: 5px; align-items: center; }
        
        /* CATEGORY SELECTOR UI (POPUP ONLY) */
        #icon-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2500; display: none; align-items: center; justify-content: center; flex-direction: column; }
        .modal-content { background: #242426; width: 95%; max-width: 450px; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 15px; max-height: 85vh; overflow-y: auto; border: 1px solid #444; }
        
        .category-scroll-area { width: 100%; overflow-x: auto; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #444; }
        .category-row { display: flex; gap: 10px; min-width: max-content; padding: 5px; }
        .category-btn { 
            width: 75px; height: 75px; 
            background: #333; 
            border: 2px solid var(--warning); /* Yellow Border */
            border-radius: 8px; 
            cursor: pointer; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            color: white; flex-shrink: 0; transition: transform 0.1s;
        }
        .category-btn.active { background: var(--warning); color: #000; border-color: #fff; transform: scale(1.05); }
        .category-btn svg { width: 32px; height: 32px; margin-bottom: 4px; }
        .category-btn span { font-size: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; }

        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 10px; min-height: 180px; }
        .lib-icon { background: #333; border-radius: 8px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; }
        .lib-icon:hover { background: #444; }
        .lib-icon svg { width: 34px; height: 34px; }
        .lib-icon b { font-size: 9px; color: #888; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 50px; text-align: center; }
        
        .pagination-ctrls { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 10px 0; border-top: 1px solid #444; }
        .page-btn { background: #444; color: white; border: none; border-radius: 4px; padding: 5px 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        
        #camera-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 2000; display: none; flex-direction: column; align-items: center; justify-content: center; }
        #camera-video { width: 100%; height: 80%; object-fit: cover; }
        .camera-controls { height: 20%; width: 100%; display: flex; align-items: center; justify-content: center; gap: 30px; background: rgba(0,0,0,0.5); position: absolute; bottom: 0; }
        .snap-btn { width: 70px; height: 70px; border-radius: 50%; background: white; border: 5px solid #ccc; cursor: pointer; }
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
                <button class="nav-btn ai-btn" id="btn-ai-search" style="position:absolute;left:0;top:0;height:100%;background:none;border:none;">
                   ${ICONS.camera}
                </button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button></div>
        
        <div class="content" id="content">
            <div style="text-align:center;padding:20px;color:#888;">Loading...</div>
        </div>
      </div>
      
      <div id="icon-modal" onclick="this.style.display='none'">
          <div class="modal-content" onclick="event.stopPropagation()">
              <div class="modal-title">Change Icon</div>
              
              <div class="category-scroll-area" id="cat-scroll" style="display:none">
                 <div class="category-row" id="picker-categories"></div>
              </div>

              <div class="icon-grid" id="icon-lib-grid"></div>
              
              <div class="pagination-ctrls">
                  <button class="page-btn" id="picker-prev">${ICONS.arrow_up}</button>
                  <div class="page-info" id="picker-page-info">Page 1</div>
                  <button class="page-btn" id="picker-next" style="transform: rotate(180deg)">${ICONS.arrow_up}</button>
              </div>

              <div style="display:flex;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid #444">
                  <input type="text" id="icon-url-input" placeholder="URL..." style="flex:1;padding:8px;background:#111;color:white;border:1px solid #444;border-radius:4px">
                  <button class="action-btn" id="btn-load-url">${ICONS.check}</button>
              </div>
              <button class="action-btn" style="width:100%;margin-top:10px;background:#444" onclick="this.closest('#icon-modal').style.display='none'">Cancel</button>
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

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;max-height:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const bind = (id, event, fn) => { const el = root.getElementById(id); if(el) el[event] = fn; };
    const click = (id, fn) => bind(id, 'onclick', fn);

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.currentPath = []; this.fetchData(); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; this.fetchData(); });
    click('btn-search', () => { this.isSearch = !this.isSearch; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    bind('search-input', 'oninput', () => this.fetchData());
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.render(); });
    
    click('btn-load-url', () => {
        const url = root.getElementById('icon-url-input').value;
        if(url) this.handleUrlIcon(url);
    });
    
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

  openIconPicker(targetName, context) {
      this.pendingFolderIcon = targetName;
      this.pickerContext = context; 
      this.pickerPage = 0; 

      const scroll = this.shadowRoot.getElementById('cat-scroll');
      if (context === 'item' && ICON_LIB_ITEM) {
          scroll.style.display = 'block';
          this.selectedItemCategory = Object.keys(ICON_LIB_ITEM)[0];
      } else {
          scroll.style.display = 'none';
      }

      this.renderIconPickerGrid();
      this.shadowRoot.getElementById('icon-modal').style.display = 'flex';
  }

  getCurrentPickerLib() {
      try {
          if (this.pickerContext === 'room') return ICON_LIB_ROOM || {};
          if (this.pickerContext === 'location') return ICON_LIB_LOCATION || {};
          if (this.pickerContext === 'item') {
              return (ICON_LIB_ITEM && ICON_LIB_ITEM[this.selectedItemCategory]) ? ICON_LIB_ITEM[this.selectedItemCategory] : {};
          }
          return ICON_LIB || {};
      } catch (e) { return {}; }
  }

  renderIconPickerGrid() {
      const root = this.shadowRoot;
      const catContainer = root.getElementById('picker-categories');
      const grid = root.getElementById('icon-lib-grid');
      
      if (this.pickerContext === 'item' && ICON_LIB_ITEM) {
          catContainer.innerHTML = '';
          Object.keys(ICON_LIB_ITEM).forEach(cat => {
              const btn = document.createElement('button');
              btn.className = `category-btn ${this.selectedItemCategory === cat ? 'active' : ''}`;
              const firstKey = Object.keys(ICON_LIB_ITEM[cat])[0];
              btn.innerHTML = `${ICON_LIB_ITEM[cat][firstKey]}<span>${cat}</span>`;
              btn.onclick = () => {
                  this.selectedItemCategory = cat;
                  this.pickerPage = 0;
                  this.renderIconPickerGrid();
              };
              catContainer.appendChild(btn);
          });
      }

      const lib = this.getCurrentPickerLib();
      const keys = Object.keys(lib);
      const totalPages = Math.ceil(keys.length / this.pickerPageSize);
      const start = this.pickerPage * this.pickerPageSize;
      const pageKeys = keys.slice(start, start + this.pickerPageSize);

      grid.innerHTML = '';
      pageKeys.forEach(key => {
          const div = document.createElement('div');
          div.className = 'lib-icon';
          div.innerHTML = `${lib[key]}<b>${key}</b>`;
          div.onclick = () => this.selectLibraryIcon(lib[key]);
          grid.appendChild(div);
      });

      root.getElementById('picker-page-info').innerText = `Page ${this.pickerPage + 1} of ${totalPages || 1}`;
      root.getElementById('picker-prev').disabled = this.pickerPage === 0;
      root.getElementById('picker-next').disabled = this.pickerPage >= totalPages - 1;
  }

  selectLibraryIcon(svgHtml) {
      const size = 140; 
      let source = svgHtml;
      if (!source.includes('xmlns')) source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      source = source.replace('<svg', `<svg width="${size}" height="${size}"`);
      if (this.pickerContext !== 'item') source = source.replace('<svg', '<svg fill="#4fc3f7"');

      const img = new Image();
      const blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (this.pickerContext === 'item') {
              ctx.fillStyle = '#000';
              ctx.fillRect(0, 0, size, size);
          }
          ctx.drawImage(img, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/png');
          const isFolder = (this.pickerContext === 'room' || this.pickerContext === 'location');
          const markerName = isFolder ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
          this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
          URL.revokeObjectURL(url);
      };
      img.src = url;
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
      } catch (err) { modal.style.display = 'none'; }
  }

  stopCamera() {
      if (this.stream) this.stream.getTracks().forEach(track => track.stop());
      this.shadowRoot.getElementById('camera-modal').style.display = 'none';
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
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      this.stopCamera();
      if (this.cameraContext === 'search') this.callHA('ai_action', { mode: 'search', image_data: dataUrl });
      else if (this.pendingItem) this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    root.getElementById('display-title').innerText = attrs.path_display || "Organizer";
    const content = root.getElementById('content');
    content.innerHTML = '';

    if (attrs.depth < 2) {
        const grid = document.createElement('div');
        grid.className = 'folder-grid';
        if (attrs.folders) {
            attrs.folders.forEach(folder => {
                const el = document.createElement('div');
                el.className = 'folder-item';
                el.onclick = () => this.navigate('down', folder.name);
                const icon = folder.img ? `<img src="${folder.img}">` : ICONS.folder;
                const deleteBtn = this.isEditMode ? `<div class="folder-delete-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteFolder('${folder.name}')">✕</div>` : '';
                const imgBtn = this.isEditMode ? `<div class="folder-img-btn" onclick="event.stopPropagation(); this.getRootNode().host.openIconPicker('${folder.name}', '${attrs.depth === 0 ? 'room' : 'location'}')">${ICONS.image}</div>` : '';
                el.innerHTML = `<div class="android-folder-icon">${icon}${deleteBtn}${imgBtn}</div><div>${folder.name}</div>`;
                grid.appendChild(el);
            });
        }
        content.appendChild(grid);
    }
    
    if (attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item)));
        content.appendChild(list);
    }
  }

  createItemRow(item) {
      const div = document.createElement('div');
      div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''}`;
      const icon = item.img ? `<img src="${item.img}" class="item-thumbnail">` : `<div class="item-icon">${ICONS.item}</div>`;
      div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.name}')">
            <div class="item-left">${icon}<div><div>${item.name}</div><div class="sub-title">${item.date || ''}</div></div></div>
            <div class="item-qty-ctrl">
                <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">-</button>
                <span style="min-width:20px;text-align:center">${item.qty}</span>
                <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">+</button>
            </div>
        </div>
      `;
      if (this.expandedIdx === item.name) {
          const det = document.createElement('div');
          det.className = 'expanded-details';
          det.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="btn-text" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">Save</button>
            </div>
            <div class="detail-row">
                <button class="action-btn" onclick="this.getRootNode().host.openIconPicker('${item.name}', 'item')">${ICONS.image}</button>
                <button class="action-btn btn-danger" onclick="this.getRootNode().host.del('${item.name}')">${ICONS.delete}</button>
            </div>
          `;
          div.appendChild(det);
      }
      return div;
  }

  navigate(dir, name) { 
      if (dir === 'up') this.currentPath.pop(); 
      else if (dir === 'down' && name) this.currentPath.push(name); 
      this.fetchData(); 
  }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.updateUI(); }
  render() { this.updateUI(); }
  callHA(s, d) { return this._hass.callService('home_organizer', s, d); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  del(name) { this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath }); }
  saveDetails(idx, oldName) { 
    const nEl = this.shadowRoot.getElementById(`name-${idx}`); 
    if(nEl) this.callHA('update_item_details', { original_name: oldName, new_name: nEl.value, current_path: this.currentPath });
    this.expandedIdx = null;
  }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
