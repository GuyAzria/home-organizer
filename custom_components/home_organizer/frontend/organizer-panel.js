// Home Organizer Ultimate - Ver 5.6.4 (Categorized 3D Icons)
// License: MIT

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=5.6.3';

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
      this.selectedItemCategory = 'Produce'; // Default category for 3D items
      this.pickerPage = 0;
      this.pickerPageSize = 15;

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
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; touch-action: pan-y; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; cursor: default; }
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; }
        .item-left { display: flex; align-items: center; gap: 10px; }
        .item-icon { color: var(--primary); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; }
        .item-thumbnail { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #000; display: block; border: 1px solid #444; }

        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        .add-item-btn { width: 100%; padding: 12px; background: rgba(76, 175, 80, 0.15); border: 1px dashed #4caf50; color: #4caf50; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; }

        .expanded-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #555; display: flex; flex-direction: column; gap: 10px; }
        .detail-row { display: flex; gap: 10px; align-items: center; }
        
        .action-btn { width: 40px; height: 40px; border-radius: 8px; border: 1px solid #555; color: #ccc; background: var(--icon-btn-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; }
        .action-btn:hover { background: #555; color: white; }
        .btn-danger { color: #ff8a80; border-color: #d32f2f; }
        .btn-text { width: auto; padding: 0 15px; font-weight: bold; color: white; background: var(--primary); border: none; }
        
        /* Modal Styles */
        #icon-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2500; display: none; align-items: center; justify-content: center; flex-direction: column; }
        .modal-content { background: #242426; width: 95%; max-width: 450px; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 15px; max-height: 90vh; overflow-y: auto; }
        .modal-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        
        /* Category Selector */
        .category-container { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; justify-content: center; padding-bottom: 15px; border-bottom: 1px solid #444; }
        .category-btn { width: 65px; height: 65px; border: 2px solid var(--warning); border-radius: 8px; background: #333; color: white; font-size: 9px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; transition: all 0.2s; text-align: center; overflow: hidden; padding: 2px; }
        .category-btn.active { background: var(--warning); color: #000; box-shadow: 0 0 10px rgba(255, 235, 59, 0.4); }
        
        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 10px; min-height: 150px; }
        .lib-icon { background: #333; border-radius: 8px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; }
        .lib-icon svg { width: 38px; height: 38px; }
        .lib-icon span { font-size: 10px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; }
        
        .pagination-ctrls { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 10px 0; border-top: 1px solid #444; }
        .page-btn { background: #444; color: white; border: none; border-radius: 4px; padding: 5px 15px; cursor: pointer; }
        .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-info { font-size: 12px; color: #aaa; }

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
        
        <div class="search-box" id="search-box" style="display:none; padding:10px; background:#2a2a2a; gap: 5px; align-items: center;">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button class="nav-btn ai-btn" id="btn-ai-search" style="position:absolute;left:0;top:0;height:100%;background:none;border:none;">${ICONS.camera}</button>
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
              
              <div class="category-container" id="picker-categories"></div>
              
              <div class="icon-grid" id="icon-lib-grid"></div>
              
              <div class="pagination-ctrls">
                  <button class="page-btn" id="picker-prev">${ICONS.arrow_up}</button>
                  <div class="page-info" id="picker-page-info">Page 1 of 1</div>
                  <button class="page-btn" id="picker-next" style="transform: rotate(180deg)">${ICONS.arrow_up}</button>
              </div>

              <div class="url-input-row">
                  <input type="text" id="icon-url-input" placeholder="Paste Image URL..." style="flex:1;padding:8px;background:#111;color:white;border:1px solid #444;border-radius:4px">
                  <button class="action-btn" id="btn-load-url">${ICONS.check}</button>
              </div>
              <button class="action-btn" style="width:100%;margin-top:10px;background:#444" onclick="this.closest('#icon-modal').style.display='none'">Cancel</button>
          </div>
      </div>
      
      <div id="camera-modal">
          <video id="camera-video" autoplay playsinline muted></video>
          <div class="camera-controls">
              <button class="snap-btn" id="btn-cam-snap"></button>
              <button class="nav-btn" style="color:white" id="btn-cam-close">✕</button>
          </div>
          <canvas id="camera-canvas" style="display:none"></canvas>
      </div>

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;max-height:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const click = (id, fn) => { const el = root.getElementById(id); if(el) el.onclick = fn; };

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.isSearch = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; this.fetchData(); });
    click('btn-search', () => { this.isSearch = true; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.render(); });
    click('btn-paste', () => this.pasteItem());
    click('picker-prev', () => { if(this.pickerPage > 0) { this.pickerPage--; this.renderIconPickerGrid(); } });
    click('picker-next', () => { 
        const lib = this.getCurrentPickerLib();
        const maxPage = Math.ceil(Object.keys(lib).length / this.pickerPageSize) - 1;
        if(this.pickerPage < maxPage) { this.pickerPage++; this.renderIconPickerGrid(); } 
    });
    click('btn-cam-close', () => this.stopCamera());
    click('btn-cam-snap', () => this.snapPhoto());
  }

  openIconPicker(targetName, context) {
      this.pendingFolderIcon = targetName;
      this.pickerContext = context; 
      this.pickerPage = 0; 
      // If picking an item, initialize with first category
      if (context === 'item') {
          this.selectedItemCategory = Object.keys(ICON_LIB_ITEM)[0];
      }
      this.renderIconPickerGrid();
      this.shadowRoot.getElementById('icon-modal').style.display = 'flex';
  }

  getCurrentPickerLib() {
      if (this.pickerContext === 'room') return ICON_LIB_ROOM;
      if (this.pickerContext === 'location') return ICON_LIB_LOCATION;
      if (this.pickerContext === 'item') {
          return ICON_LIB_ITEM[this.selectedItemCategory] || {};
      }
      return ICON_LIB;
  }

  renderIconPickerGrid() {
      const root = this.shadowRoot;
      const catContainer = root.getElementById('picker-categories');
      const grid = root.getElementById('icon-lib-grid');
      const pageInfo = root.getElementById('picker-page-info');
      
      catContainer.innerHTML = '';
      grid.innerHTML = '';

      // Render Categories only for Items
      if (this.pickerContext === 'item') {
          Object.keys(ICON_LIB_ITEM).forEach(cat => {
              const btn = document.createElement('button');
              btn.className = `category-btn ${this.selectedItemCategory === cat ? 'active' : ''}`;
              // Show first icon of category as preview
              const firstIconKey = Object.keys(ICON_LIB_ITEM[cat])[0];
              btn.innerHTML = `${ICON_LIB_ITEM[cat][firstIconKey]}<div>${cat}</div>`;
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
      root.getElementById('picker-prev').disabled = this.pickerPage === 0;
      root.getElementById('picker-next').disabled = this.pickerPage >= totalPages - 1;
  }

  selectLibraryIcon(svgHtml) {
      const size = 140; 
      let source = svgHtml;
      if (!source.includes('xmlns')) source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      source = source.replace('<svg', `<svg width="${size}" height="${size}"`);

      const img = new Image();
      const blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          
          // Force black background for 3D item icons to make them pop
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

  async openCamera(context) {
      this.cameraContext = context;
      const modal = this.shadowRoot.getElementById('camera-modal');
      const video = this.shadowRoot.getElementById('camera-video');
      modal.style.display = 'flex';
      try {
          this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          video.srcObject = this.stream;
      } catch (err) { modal.style.display = 'none'; }
  }

  stopCamera() {
      const modal = this.shadowRoot.getElementById('camera-modal');
      if (this.stream) this.stream.getTracks().forEach(track => track.stop());
      modal.style.display = 'none';
  }

  snapPhoto() {
      const video = this.shadowRoot.getElementById('camera-video');
      const canvas = this.shadowRoot.getElementById('camera-canvas');
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      this.stopCamera();
      if (this.cameraContext === 'search') this.callHA('ai_action', { mode: 'search', image_data: dataUrl });
      else if (this.pendingItem) this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
  }

  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  navigate(dir, name) { 
      if (dir === 'root') this.currentPath = []; 
      else if (dir === 'up') this.currentPath.pop(); 
      else if (dir === 'down' && name) this.currentPath.push(name); 
      this.fetchData(); 
  }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  render() { this.updateUI(); }
  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
  del(name) { this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath }); }
  saveDetails(idx, oldName) { 
    const nEl = this.shadowRoot.getElementById(`name-${idx}`); 
    const dEl = this.shadowRoot.getElementById(`date-${idx}`); 
    if(nEl && dEl) { this.callHA('update_item_details', { original_name: oldName, new_name: nEl.value, new_date: dEl.value }); this.expandedIdx = null; } 
  }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
