// Home Organizer Ultimate - Ver 5.6.5 (Layout Update)
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
      this.pickerCategory = null; 
      this.pickerPage = 0;
      this.pickerPageSize = 15;

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
        
        /* Main Bars */
        .top-bar { background: #242426; padding: 10px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; height: 60px; }
        .sub-bar { background: #2a2a2c; height: 30px; display: flex; align-items: center; padding: 0 10px; border-bottom: 1px solid var(--border); gap: 15px; flex-shrink: 0; }
        
        .nav-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .sub-bar .nav-btn { padding: 2px; }
        .sub-bar .nav-btn svg { width: 18px; height: 18px; }
        
        .nav-btn:hover { background: rgba(255,255,255,0.1); }
        .nav-btn.active { color: var(--warning); }
        .nav-btn.edit-active { color: var(--accent); } 
        
        /* Dropdown Setup */
        .setup-wrapper { position: relative; display: flex; align-items: center; }
        .dropdown-menu { 
            position: absolute; top: 50px; right: 0; background: #2c2c2e; border: 1px solid var(--border); 
            border-radius: 8px; display: none; flex-direction: column; min-width: 150px; z-index: 3000;
            box-shadow: 0 8px 16px rgba(0,0,0,0.5); overflow: hidden;
        }
        .dropdown-menu.show { display: flex; }
        .dropdown-item { padding: 12px 15px; cursor: pointer; color: white; font-size: 14px; text-align: right; }
        .dropdown-item:hover { background: var(--primary); }

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
        
        .category-bar { display: none; gap: 10px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 10px; scrollbar-width: thin; scrollbar-color: var(--warning) transparent; }
        .cat-btn { min-width: 65px; height: 65px; background: #333; border: 2px solid var(--warning); border-radius: 8px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; text-align: center; padding: 5px; flex-shrink: 0; }
        .cat-btn.active { background: var(--warning); color: #000; font-weight: bold; }

        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px; min-height: 200px; }
        .lib-icon { background: #333; border-radius: 8px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; }

        #camera-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 2000; display: none; flex-direction: column; align-items: center; justify-content: center; }
        #camera-video { width: 100%; height: 80%; object-fit: cover; }
        .camera-controls { height: 20%; width: 100%; display: flex; align-items: center; justify-content: center; gap: 30px; background: rgba(0,0,0,0.5); position: absolute; bottom: 0; }
      </style>
      
      <div class="app-container" id="app">
        <div class="top-bar">
            <div class="setup-wrapper">
                <button class="nav-btn" id="btn-setup">
                    <svg viewBox="0 0 24 24"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.35 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.47,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.53,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.35 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.53,18.67 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.47,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" /></svg>
                </button>
                <div class="dropdown-menu" id="setup-dropdown">
                    <div class="dropdown-item" data-lang="he">עברית (Hebrew)</div>
                    <div class="dropdown-item" data-lang="en">English</div>
                </div>
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

        <div class="sub-bar">
            <button class="nav-btn" id="btn-home">${ICONS.home}</button>
            <button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button>
        </div>
        
        <div class="search-box" id="search-box" style="display:none; padding:10px; background:#2a2a2a; display:flex; gap: 5px; align-items: center;">
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
              <div class="category-bar" id="picker-categories"></div>
              <div class="icon-grid" id="icon-lib-grid"></div>
              <div class="pagination-ctrls" style="display:flex; justify-content:space-between; margin-top:10px;">
                  <button class="page-btn" id="picker-prev">${ICONS.arrow_up}</button>
                  <div class="page-info" id="picker-page-info">Page 1 of 1</div>
                  <button class="page-btn" id="picker-next" style="transform: rotate(180deg)">${ICONS.arrow_up}</button>
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
          <canvas id="camera-canvas" style="display:none;"></canvas>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const bind = (id, event, fn) => { const el = root.getElementById(id); if(el) el[event] = fn; };
    const click = (id, fn) => bind(id, 'onclick', fn);

    // Setup Dropdown Logic
    click('btn-setup', (e) => {
        e.stopPropagation();
        const menu = root.getElementById('setup-dropdown');
        menu.classList.toggle('show');
    });

    // Close dropdown on outside click
    window.addEventListener('click', () => {
        root.getElementById('setup-dropdown')?.classList.remove('show');
    });

    // Language selection
    root.querySelectorAll('.dropdown-item').forEach(item => {
        item.onclick = (e) => {
            const lang = e.target.dataset.lang;
            console.log("Selected Language:", lang);
            // Add your language logic here
            root.getElementById('setup-dropdown').classList.remove('show');
        };
    });

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.isSearch = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.fetchData(); });
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    bind('search-input', 'oninput', (e) => this.fetchData());
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    click('btn-paste', () => this.pasteItem());
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
  
  // All other methods (toggleWhiteBG, openCamera, snapPhoto, updateUI, createItemRow, etc.) 
  // remain exactly as in your original code.
  
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
      } else if (this.pendingItem) {
          this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
          this.pendingItem = null;
      }
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    root.getElementById('display-title').innerText = attrs.path_display;
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

    if (attrs.depth < 2) {
        if (attrs.folders && attrs.folders.length > 0 || this.isEditMode) {
            const grid = document.createElement('div');
            grid.className = 'folder-grid';
            if (attrs.folders) {
                attrs.folders.forEach(folder => {
                    const el = document.createElement('div');
                    el.className = 'folder-item';
                    el.onclick = () => this.navigate('down', folder.name);
                    let folderContent = ICONS.folder;
                    if (folder.img) folderContent = `<img src="${folder.img}">`;

                    const deleteBtnHtml = this.isEditMode ? `<div class="folder-delete-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteFolder('${folder.name}')">✕</div>` : '';
                    const editBtnHtml = this.isEditMode ? `<div class="folder-edit-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableFolderRename(this.closest('.folder-item').querySelector('.folder-label'), '${folder.name}')">${ICONS.edit}</div>` : '';
                    const context = attrs.depth === 0 ? 'room' : 'location';
                    const imgBtnHtml = this.isEditMode ? `<div class="folder-img-btn" onclick="event.stopPropagation(); this.getRootNode().host.openIconPicker('${folder.name}', '${context}')">${ICONS.image}</div>` : '';

                    el.innerHTML = `
                        <div class="android-folder-icon">${folderContent}${editBtnHtml}${deleteBtnHtml}${imgBtnHtml}</div>
                        <div class="folder-label">${folder.name}</div>
                    `;
                    grid.appendChild(el);
                });
            }
            if (this.isEditMode) {
                const addBtn = document.createElement('div');
                addBtn.className = 'folder-item add-folder-card';
                addBtn.innerHTML = `<div class="android-folder-icon" id="add-folder-icon">${ICONS.plus}</div><div class="folder-label">Add</div>`;
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
    } else {
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
            const isExpanded = this.expandedSublocs.has(subName);
            const count = grouped[subName].length;
            const icon = isExpanded ? ICONS.chevron_down : ICONS.chevron_right;
            const countBadge = `<span style="font-size:12px; background:#444; padding:2px 6px; border-radius:10px; margin-left:8px;">${count}</span>`;
            const header = document.createElement('div');
            header.className = 'group-separator';
            header.onclick = () => this.toggleSubloc(subName);
            header.innerHTML = `<div style="display:flex;align-items:center;"><span style="margin-right:5px;display:flex;align-items:center">${icon}</span><span>${subName}</span>${countBadge}</div>`;
            listContainer.appendChild(header);
            if (isExpanded) {
                grouped[subName].forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
            }
        });
        content.appendChild(listContainer);
    }
  }
  
  // Logic helpers
  navigate(dir, name) { 
      if (dir === 'root') this.currentPath = []; 
      else if (dir === 'up') this.currentPath.pop(); 
      else if (dir === 'down' && name) this.currentPath.push(name); 
      this.expandedSublocs.clear();
      this.fetchData(); 
  }

  createItemRow(item, isShopMode) {
      const div = document.createElement('div');
      div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''}`;
      div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.name}')">
            <div class="item-left"><span class="item-icon">${ICONS.item}</span><div><div>${item.name}</div><div class="sub-title">${item.date || ''}</div></div></div>
            <div class="item-qty-ctrl">
                <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button>
                <span class="qty-val">${item.qty}</span>
                <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>
            </div>
        </div>
      `;
      return div;
  }

  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  render() { this.updateUI(); }
  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
