// Home Organizer Ultimate - Ver 5.6.5 (Defensive Loading & Categorized UI)
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
      this.localData = null; 
      this.pendingItem = null;
      this.useAiBg = true; 
      this.shopQuantities = {};
      this.expandedSublocs = new Set(); 
      this.subscribed = false;
      this.pickerContext = 'room'; 
      // Initialize with first available category or a default
      this.selectedItemCategory = ICON_LIB_ITEM ? Object.keys(ICON_LIB_ITEM)[0] : 'Produce';
      this.pickerPage = 0;
      this.pickerPageSize = 15;

      this.initUI();
    }

    if (this._hass && this._hass.connection && !this.subscribed) {
        this.subscribed = true;
        this._hass.connection.subscribeEvents(() => this.fetchData(), 'home_organizer_db_update');
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
          const content = this.shadowRoot.getElementById('content');
          if (content) content.innerHTML = `<div style="color:red;padding:20px;text-align:center">Error fetching data. Check Home Assistant logs.</div>`;
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
        .nav-btn.active { color: var(--warning); }
        .nav-btn.edit-active { color: var(--accent); } 
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; position: relative; }
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; }
        .android-folder-icon img { width: 38px; height: 38px; object-fit: contain; border-radius: 4px; }
        
        .folder-delete-btn { position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; z-index: 10; }
        .folder-edit-btn { position: absolute; top: -5px; left: -5px; background: var(--primary); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; }
        .folder-img-btn { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); background: #ff9800; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; min-height: 35px; cursor: pointer; }
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .item-thumbnail { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #000; border: 1px solid #444; }

        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        /* Modal & Category Selector */
        #icon-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 2500; display: none; align-items: center; justify-content: center; }
        .modal-content { background: #242426; width: 95%; max-width: 460px; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; max-height: 90vh; border: 1px solid #444; }
        .modal-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px; }
        
        .category-scroll-wrapper { width: 100%; overflow-x: auto; margin-bottom: 15px; padding-bottom: 10px; }
        .category-container { display: flex; gap: 10px; min-width: max-content; padding: 5px; }
        
        .category-btn { 
          width: 80px; height: 80px; 
          border: 3px solid var(--warning); 
          border-radius: 8px; 
          background: #333; 
          color: white; 
          cursor: pointer; 
          display: flex; flex-direction: column; align-items: center; justify-content: center; 
          transition: transform 0.1s;
          flex-shrink: 0;
        }
        .category-btn.active { background: #444; box-shadow: inset 0 0 15px rgba(255, 235, 59, 0.3); transform: scale(1.05); }
        .category-btn svg { width: 35px; height: 35px; margin-bottom: 5px; }
        .category-btn span { font-size: 10px; font-weight: bold; text-transform: capitalize; }
        
        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 12px; overflow-y: auto; flex: 1; padding: 5px; }
        .lib-icon { background: #2c2c2e; border-radius: 10px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; border: 1px solid #444; }
        .lib-icon:hover { border-color: var(--primary); background: #3a3a3c; }
        .lib-icon svg { width: 40px; height: 40px; }
        .lib-icon b { font-size: 9px; color: #aaa; text-align: center; word-break: break-all; }
        
        .pagination-ctrls { display: flex; justify-content: space-between; align-items: center; padding: 15px 0 0 0; border-top: 1px solid #444; margin-top: 10px; }
        .page-btn { background: #444; color: white; border: none; border-radius: 6px; padding: 8px 20px; cursor: pointer; }
        .page-btn:disabled { opacity: 0.2; }

        #camera-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 2000; display: none; flex-direction: column; }
        #camera-video { width: 100%; height: 85%; object-fit: cover; }
        .camera-controls { height: 15%; width: 100%; display: flex; align-items: center; justify-content: center; background: #111; gap: 40px; }
        .snap-btn { width: 60px; height: 60px; border-radius: 50%; background: white; border: 4px solid #888; }
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
            <input type="text" id="search-input" placeholder="Search..." style="flex:1;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333">
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="content" id="content">
            <div style="text-align:center;padding:50px;color:#888;">Loading items...</div>
        </div>
      </div>
      
      <div id="icon-modal" onclick="this.style.display='none'">
          <div class="modal-content" onclick="event.stopPropagation()">
              <div class="modal-title" id="modal-title-text">Select Icon</div>
              
              <div class="category-scroll-wrapper" id="cat-wrapper" style="display:none">
                <div class="category-container" id="picker-categories"></div>
              </div>
              
              <div class="icon-grid" id="icon-lib-grid"></div>
              
              <div class="pagination-ctrls">
                  <button class="page-btn" id="picker-prev">Prev</button>
                  <div id="picker-page-info" style="font-size:12px;color:#888">Page 1</div>
                  <button class="page-btn" id="picker-next">Next</button>
              </div>

              <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid #333; padding-top:15px">
                  <input type="text" id="icon-url-input" placeholder="Image URL..." style="flex:1;padding:8px;background:#111;color:white;border:1px solid #444;border-radius:4px">
                  <button class="page-btn" id="btn-load-url">Add</button>
              </div>
              <button class="page-btn" style="margin-top:10px;background:#d32f2f" onclick="this.closest('#icon-modal').style.display='none'">Close</button>
          </div>
      </div>

      <div id="camera-modal">
          <video id="camera-video" autoplay playsinline muted></video>
          <div class="camera-controls">
              <button class="snap-btn" id="btn-cam-snap"></button>
              <button class="nav-btn" style="color:white" id="btn-cam-close">${ICONS.close}</button>
          </div>
          <canvas id="camera-canvas" style="display:none"></canvas>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const click = (id, fn) => { const el = root.getElementById(id); if(el) el.onclick = fn; };

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.currentPath = []; this.fetchData(); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; this.fetchData(); });
    click('btn-search', () => { 
      const box = root.getElementById('search-box');
      box.style.display = box.style.display === 'none' ? 'flex' : 'none';
    });
    click('search-close', () => { root.getElementById('search-box').style.display = 'none'; });
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.updateUI(); });
    
    click('picker-prev', () => { if(this.pickerPage > 0) { this.pickerPage--; this.renderIconPickerGrid(); } });
    click('picker-next', () => { 
        const lib = this.getCurrentPickerLib();
        const maxPage = Math.ceil(Object.keys(lib).length / this.pickerPageSize) - 1;
        if(this.pickerPage < maxPage) { this.pickerPage++; this.renderIconPickerGrid(); } 
    });
    
    click('btn-cam-close', () => this.stopCamera());
    click('btn-cam-snap', () => this.snapPhoto());
    
    root.getElementById('search-input').oninput = () => this.fetchData();
  }

  openIconPicker(targetName, context) {
      this.pendingFolderIcon = targetName;
      this.pickerContext = context; 
      this.pickerPage = 0; 
      
      const catWrapper = this.shadowRoot.getElementById('cat-wrapper');
      if (context === 'item' && ICON_LIB_ITEM) {
          catWrapper.style.display = 'block';
          this.selectedItemCategory = Object.keys(ICON_LIB_ITEM)[0];
      } else {
          catWrapper.style.display = 'none';
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
              const firstIconKey = Object.keys(ICON_LIB_ITEM[cat])[0];
              btn.innerHTML = `${ICON_LIB_ITEM[cat][firstIconKey]}<span>${cat}</span>`;
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

  async stopCamera() {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      this.shadowRoot.getElementById('camera-modal').style.display = 'none';
  }

  snapPhoto() {
      const video = this.shadowRoot.getElementById('camera-video');
      const canvas = this.shadowRoot.getElementById('camera-canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      this.stopCamera();
      if (this.pendingItem) this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
  }

  navigate(dir, name) { 
      if (dir === 'up') this.currentPath.pop(); 
      else if (dir === 'down' && name) this.currentPath.push(name); 
      this.fetchData(); 
  }
  
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.updateUI(); }
  updateUI() {
      if (!this.localData) return;
      const root = this.shadowRoot;
      root.getElementById('display-title').innerText = this.localData.path_display || "Organizer";
      const content = root.getElementById('content');
      content.innerHTML = '';
      
      const grid = document.createElement('div');
      grid.className = 'folder-grid';
      
      if (this.localData.folders) {
          this.localData.folders.forEach(f => {
              const div = document.createElement('div');
              div.className = 'folder-item';
              div.onclick = () => this.navigate('down', f.name);
              const icon = f.img ? `<img src="${f.img}">` : ICONS.folder;
              div.innerHTML = `<div class="android-folder-icon">${icon}</div><div>${f.name}</div>`;
              grid.appendChild(div);
          });
      }
      content.appendChild(grid);

      if (this.localData.items) {
          const list = document.createElement('div');
          list.className = 'item-list';
          this.localData.items.forEach(item => {
              const row = this.createItemRow(item, this.isShopMode);
              list.appendChild(row);
          });
          content.appendChild(list);
      }
  }

  createItemRow(item, isShop) {
      const div = document.createElement('div');
      div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''}`;
      const icon = item.img ? `<img src="${item.img}" class="item-thumbnail">` : `<div class="item-icon">${ICONS.item}</div>`;
      
      div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.name}')">
            <div class="item-left">${icon}<div>${item.name}</div></div>
            <div class="item-qty-ctrl">
              <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">-</button>
              <span>${item.qty}</span>
              <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">+</button>
            </div>
        </div>
      `;

      if (this.expandedIdx === item.name) {
          const details = document.createElement('div');
          details.className = 'expanded-details';
          details.innerHTML = `
            <div class="detail-row">
                <button class="action-btn" onclick="this.getRootNode().host.openIconPicker('${item.name}', 'item')">${ICONS.image}</button>
                <button class="action-btn btn-danger" onclick="this.getRootNode().host.del('${item.name}')">${ICONS.delete}</button>
            </div>
          `;
          div.appendChild(details);
      }
      return div;
  }

  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  del(name) { this.callHA('delete_item', { item_name: name, current_path: this.currentPath }); }
  callHA(s, d) { return this._hass.callService('home_organizer', s, d); }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
