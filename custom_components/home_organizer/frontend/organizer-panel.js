// Home Organizer Ultimate - Ver 5.6.4 (Categorized Icon Picker)
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
      this.pickerCategory = Object.keys(ICON_LIB_ITEM)[0]; // Default to first category

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
        
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 20px 0 10px 0; 
            border-bottom: 1px solid #444; padding-bottom: 4px; 
            text-transform: uppercase; font-weight: bold; 
            display: flex; justify-content: space-between; align-items: center;
            min-height: 35px;
            cursor: pointer; 
        }
        .group-separator:hover { background: rgba(255,255,255,0.05); }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); background: rgba(3, 169, 244, 0.1); }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .out-of-stock-frame { border: 2px solid var(--danger); }
        .item-thumbnail { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #000; display: block; border: 1px solid #444; }

        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        .expanded-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #555; display: flex; flex-direction: column; gap: 10px; }
        .detail-row { display: flex; gap: 10px; align-items: center; }
        
        .action-btn { width: 40px; height: 40px; border-radius: 8px; border: 1px solid #555; color: #ccc; background: var(--icon-btn-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; }
        .btn-text { width: auto; padding: 0 15px; font-weight: bold; color: white; background: var(--primary); border: none; }
        
        #icon-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2500; display: none; align-items: center; justify-content: center; }
        .modal-content { background: #242426; width: 95%; max-width: 450px; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 10px; max-height: 90vh; overflow-y: auto; }
        
        /* Category Selector Styles */
        .category-scroll { display: flex; gap: 8px; overflow-x: auto; padding: 5px 0 12px 0; margin-bottom: 5px; scrollbar-width: none; }
        .category-scroll::-webkit-scrollbar { display: none; }
        .category-btn { 
          min-width: 85px; height: 45px; background: #333; color: #fff; 
          border: 2px solid var(--warning); border-radius: 4px; 
          cursor: pointer; font-size: 11px; font-weight: bold; 
          display: flex; align-items: center; justify-content: center; 
          white-space: nowrap; padding: 0 5px; flex-shrink: 0;
        }
        .category-btn.active { background: var(--warning); color: #000; }

        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 10px; min-height: 200px; }
        .lib-icon { background: #333; border-radius: 8px; padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; }
        .lib-icon svg { width: 32px; height: 32px; fill: #ccc; }
        .lib-icon span { font-size: 9px; color: #888; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 55px; text-align: center; }
        
        .pagination-ctrls { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #444; }
        .page-btn { background: #444; color: white; border: none; border-radius: 4px; padding: 5px 15px; cursor: pointer; }
        .page-btn:disabled { opacity: 0.3; }

        #camera-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 2000; display: none; flex-direction: column; }
        #camera-video { width: 100%; height: 80%; object-fit: cover; }
        .camera-controls { height: 20%; width: 100%; display: flex; align-items: center; justify-content: center; gap: 30px; }
        .snap-btn { width: 70px; height: 70px; border-radius: 50%; background: white; border: 5px solid #ccc; }
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
        
        <div class="search-box" id="search-box" style="display:none; padding:10px; background:#2a2a2a; gap:5px;">
            <input type="text" id="search-input" style="flex:1;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333">
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="content" id="content"></div>
      </div>
      
      <div id="icon-modal" onclick="this.style.display='none'">
          <div class="modal-content" onclick="event.stopPropagation()">
              <div style="font-weight:bold; text-align:center; margin-bottom:5px;">Select Icon</div>
              
              <div class="category-scroll" id="category-tabs" style="display:none"></div>

              <div class="icon-grid" id="icon-lib-grid"></div>
              
              <div class="pagination-ctrls">
                  <button class="page-btn" id="picker-prev">${ICONS.arrow_up}</button>
                  <div id="picker-page-info" style="font-size:12px; color:#aaa;">Page 1</div>
                  <button class="page-btn" id="picker-next" style="transform:rotate(180deg)">${ICONS.arrow_up}</button>
              </div>

              <div style="display:flex; gap:10px; margin-top:10px;">
                  <input type="text" id="icon-url-input" placeholder="Image URL..." style="flex:1;padding:8px;background:#111;color:white;border:1px solid #444;border-radius:4px">
                  <button class="action-btn" id="btn-load-url">${ICONS.check}</button>
              </div>
              <button class="action-btn" style="width:100%;margin-top:10px;background:#444;color:white;border:none;" onclick="this.closest('#icon-modal').style.display='none'">Cancel</button>
          </div>
      </div>
      
      <div id="camera-modal">
          <video id="camera-video" autoplay playsinline muted></video>
          <div class="camera-controls">
              <button class="snap-btn" id="btn-cam-snap"></button>
              <button class="nav-btn" id="btn-cam-close" style="color:white">✕</button>
          </div>
          <canvas id="camera-canvas" style="display:none"></canvas>
      </div>

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:2000;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;max-height:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('btn-up').onclick = () => this.navigate('up');
    root.getElementById('btn-home').onclick = () => { this.isShopMode = false; this.navigate('root'); };
    root.getElementById('btn-shop').onclick = () => { this.isShopMode = !this.isShopMode; this.fetchData(); };
    root.getElementById('btn-search').onclick = () => { root.getElementById('search-box').style.display = 'flex'; };
    root.getElementById('search-close').onclick = () => { root.getElementById('search-box').style.display = 'none'; this.fetchData(); };
    root.getElementById('btn-edit').onclick = () => { this.isEditMode = !this.isEditMode; this.render(); };
    
    root.getElementById('picker-prev').onclick = () => { if(this.pickerPage > 0) { this.pickerPage--; this.renderIconPickerGrid(); } };
    root.getElementById('picker-next').onclick = () => { this.pickerPage++; this.renderIconPickerGrid(); };
    root.getElementById('btn-load-url').onclick = () => this.handleUrlIcon(root.getElementById('icon-url-input').value);

    root.getElementById('btn-cam-snap').onclick = () => this.snapPhoto();
    root.getElementById('btn-cam-close').onclick = () => this.stopCamera();
  }

  async openCamera(context) {
      this.cameraContext = context;
      const modal = this.shadowRoot.getElementById('camera-modal');
      const video = this.shadowRoot.getElementById('camera-video');
      modal.style.display = 'flex';
      try {
          this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          video.srcObject = this.stream;
      } catch (err) { alert("Camera Error: " + err.message); modal.style.display = 'none'; }
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
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      this.stopCamera();
      if (this.pendingItem) {
          this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
          this.pendingItem = null;
      }
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    root.getElementById('display-title').innerText = attrs.path_display || "Organizer";
    root.getElementById('display-path').innerText = this.currentPath.join(' / ') || "Main";
    
    const content = root.getElementById('content');
    content.innerHTML = '';

    if (attrs.shopping_list && this.isShopMode) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.shopping_list.forEach(item => list.appendChild(this.createItemRow(item, true)));
        content.appendChild(list);
        return;
    }

    if (attrs.depth < 2) {
        const grid = document.createElement('div');
        grid.className = 'folder-grid';
        if (attrs.folders) {
            attrs.folders.forEach(folder => {
                const el = document.createElement('div');
                el.className = 'folder-item';
                el.onclick = () => this.navigate('down', folder.name);
                const context = attrs.depth === 0 ? 'room' : 'location';
                const imgBtn = this.isEditMode ? `<div class="folder-img-btn" onclick="event.stopPropagation(); this.getRootNode().host.openIconPicker('${folder.name}', '${context}')">${ICONS.image}</div>` : '';
                el.innerHTML = `<div class="android-folder-icon">${folder.img ? `<img src="${folder.img}">` : ICONS.folder}${imgBtn}</div><div class="folder-label">${folder.name}</div>`;
                grid.appendChild(el);
            });
        }
        content.appendChild(grid);
    } 

    if (attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
    }
  }

  createItemRow(item, isShop) {
      const div = document.createElement('div');
      div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''}`;
      const icon = item.img ? `<img src="${item.img}" class="item-thumbnail" onclick="event.stopPropagation(); this.getRootNode().host.showImg('${item.img}')">` : `<span style="color:var(--primary); width:40px; height:40px; display:flex; align-items:center; justify-content:center;">${ICONS.item}</span>`;
      
      div.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; cursor:pointer;" onclick="this.getRootNode().host.toggleRow('${item.name}')">
            <div style="display:flex; align-items:center; gap:10px;">
                ${icon}
                <div>
                    <div>${item.name}</div>
                    <div style="font-size:11px; color:#aaa;">${item.date || ''}</div>
                </div>
            </div>
            <div class="item-qty-ctrl">
                <button class="qty-btn" onclick="event.stopPropagation(); this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button>
                <span>${item.qty}</span>
                <button class="qty-btn" onclick="event.stopPropagation(); this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>
            </div>
        </div>
      `;

      if (this.expandedIdx === item.name) {
          const details = document.createElement('div');
          details.className = 'expanded-details';
          details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" value="${item.date || ''}" style="width:120px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="btn-text" onclick="this.getRootNode().host.saveDetails('${item.name}')">Save</button>
            </div>
            <div class="detail-row" style="margin-top:10px;">
                <button class="action-btn" onclick="this.getRootNode().host.triggerCameraEdit('${item.name}')">${ICONS.camera}</button>
                <button class="action-btn" onclick="this.getRootNode().host.openIconPicker('${item.name}', 'item')">${ICONS.image}</button>
                <button class="action-btn" style="color:var(--danger); border-color:var(--danger);" onclick="this.getRootNode().host.del('${item.name}')">${ICONS.delete}</button>
            </div>
          `;
          div.appendChild(details);
      }
      return div;
  }

  // --- ICON PICKER LOGIC ---
  openIconPicker(targetName, context) {
      this.pendingFolderIcon = targetName;
      this.pickerContext = context;
      this.pickerPage = 0;
      if (context === 'item' && !this.pickerCategory) {
          this.pickerCategory = Object.keys(ICON_LIB_ITEM)[0];
      }
      this.renderIconPickerGrid();
      this.shadowRoot.getElementById('icon-modal').style.display = 'flex';
  }

  renderIconPickerGrid() {
      const root = this.shadowRoot;
      const grid = root.getElementById('icon-lib-grid');
      const tabs = root.getElementById('category-tabs');
      grid.innerHTML = '';
      
      let lib = {};
      if (this.pickerContext === 'room') lib = ICON_LIB_ROOM;
      else if (this.pickerContext === 'location') lib = ICON_LIB_LOCATION;
      else if (this.pickerContext === 'item') {
          tabs.style.display = 'flex';
          tabs.innerHTML = '';
          Object.keys(ICON_LIB_ITEM).forEach(cat => {
              const btn = document.createElement('button');
              btn.className = `category-btn ${this.pickerCategory === cat ? 'active' : ''}`;
              btn.innerText = cat;
              btn.onclick = (e) => {
                  e.stopPropagation();
                  this.pickerCategory = cat;
                  this.pickerPage = 0;
                  this.renderIconPickerGrid();
              };
              tabs.appendChild(btn);
          });
          lib = ICON_LIB_ITEM[this.pickerCategory] || {};
      } else {
          tabs.style.display = 'none';
          lib = ICON_LIB;
      }

      const keys = Object.keys(lib);
      const start = this.pickerPage * this.pickerPageSize;
      const pageKeys = keys.slice(start, start + this.pickerPageSize);

      pageKeys.forEach(key => {
          const div = document.createElement('div');
          div.className = 'lib-icon';
          div.innerHTML = `${lib[key]}<span>${key}</span>`;
          div.onclick = () => this.selectLibraryIcon(lib[key]);
          grid.appendChild(div);
      });

      root.getElementById('picker-page-info').innerText = `Page ${this.pickerPage + 1} of ${Math.ceil(keys.length / this.pickerPageSize) || 1}`;
      root.getElementById('picker-next').disabled = (start + this.pickerPageSize) >= keys.length;
  }

  selectLibraryIcon(svgHtml) {
      const canvas = document.createElement('canvas');
      canvas.width = 140; canvas.height = 140;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      let source = svgHtml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"');
      const blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      img.onload = () => {
          if (this.pickerContext === 'item') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 140, 140); }
          ctx.drawImage(img, 0, 0, 140, 140);
          this.callHA('update_image', { 
              item_name: (this.pickerContext !== 'item' ? `[Folder] ` : '') + this.pendingFolderIcon, 
              image_data: canvas.toDataURL('image/png') 
          });
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
          URL.revokeObjectURL(url);
      };
      img.src = url;
  }

  handleUrlIcon(url) {
      if(!url) return;
      this.callHA('update_image', { item_name: this.pendingFolderIcon, image_data: url });
      this.shadowRoot.getElementById('icon-modal').style.display = 'none';
  }

  navigate(dir, name) { 
      if (dir === 'root') this.currentPath = []; 
      else if (dir === 'up') this.currentPath.pop(); 
      else if (dir === 'down') this.currentPath.push(name); 
      this.fetchData(); 
  }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  triggerCameraEdit(name) { this.pendingItem = name; this.openCamera('update'); }
  showImg(src) { this.shadowRoot.getElementById('overlay-img').src = src; this.shadowRoot.getElementById('img-overlay').style.display = 'flex'; }
  render() { this.updateUI(); }
  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}

customElements.define('home-organizer-panel', HomeOrganizerPanel);
