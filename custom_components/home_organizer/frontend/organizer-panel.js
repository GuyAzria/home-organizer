// Home Organizer Ultimate - ver 2.2.0 (REPAIR)
// Simplified to fix "Empty Page" crash
// License: MIT

const ICONS = {
  arrow_up: `<svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>`,
  home: `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
  cart: `<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
  edit: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`,
  folder: `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
  item: `<svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>`,
  delete: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  cut: `<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64z"/></svg>`,
  paste: `<svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
  minus: `<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>`,
  save: `<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>`,
  sparkles: `<svg viewBox="0 0 24 24"><path d="M9 9l1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5zM19 19l-2.5-1 2.5-1 1-2.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5z"/></svg>`
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
      this.initUI();
    }
    
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes) {
        this.updateUI();
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
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; }
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">Organizer</div><div class="sub-title" id="display-path">Main</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button></div>
        
        <div class="content" id="content"></div>
        
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
    
    const click = (id, fn) => { const el = root.getElementById(id); if(el) el.onclick = fn; };
    
    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => this.navigate('root'));
    
    click('btn-shop', () => { 
        this.isShopMode = !this.isShopMode; 
        if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } 
        this.notifyContext(); 
    });
    
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.notifyContext(); });
    
    const sInput = root.getElementById('search-input');
    if(sInput) sInput.oninput = (e) => this.notifyContext(e.target.value);
    
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    const fileIn = root.getElementById('add-file');
    if(fileIn) fileIn.onchange = (e) => this.handleFile(e);
    
    click('btn-create-folder', () => this.addItem('folder'));
    click('btn-create-item', () => this.addItem('item'));
    click('btn-paste', () => this.pasteItem());
    
    const dateIn = root.getElementById('add-date');
    if(dateIn) dateIn.value = new Date().toISOString().split('T')[0];
    
    // AI Buttons (Check if exist first)
    const magicBtn = root.getElementById('btn-ai-magic');
    if(magicBtn) magicBtn.onclick = () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    };
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    root.getElementById('display-title').innerText = attrs.path_display || 'Organizer';
    root.getElementById('display-path').innerText = attrs.app_version || '2.2.0';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    const content = root.getElementById('content');
    content.innerHTML = '';

    // 1. SHOPPING LIST MODE
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
    const depth = attrs.depth || 0;
    
    if (depth < 2) {
        // Grid View
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

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

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
            header.innerText = subName; // Simplified: No Edit Button yet to ensure stability
            
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

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     let controls = '';
     if (isShopMode) {
         controls = `
            <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">-</button>
            <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">+</button>
            <button class="qty-btn" style="background:var(--primary)" onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.name}')">OK</button>
         `;
     } else {
         controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">+</button>
                     <span class="qty-val">${item.qty}</span>
                     <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">-</button>`;
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
                    <button class="action-btn" style="background:#555" onclick="this.getRootNode().host.cut('${item.name}')">Cut</button>
                    <button class="action-btn" style="background:var(--danger)" onclick="this.getRootNode().host.del('${item.name}')">Del</button>
                 </div>
            </div>
         `;
         div.appendChild(details);
     }
     return div;
  }

  render() { this.updateUI(); }
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  submitShopStock(name) { this.callHA('update_stock', { item_name: name, quantity: 1 }); }
  notifyContext(query = "") { this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode }); }

  addItem(type) {
    const nEl = this.shadowRoot.getElementById('add-name');
    const dEl = this.shadowRoot.getElementById('add-date');
    if (!nEl || !nEl.value) return alert("Name required");
    this.callHA('add_item', { item_name: nEl.value, item_type: type, item_date: dEl.value, image_data: this.tempAddImage });
    nEl.value = ''; this.tempAddImage = null;
    const ic = this.shadowRoot.getElementById('add-cam-icon');
    if(ic) ic.innerHTML = ICONS.camera;
  }
  
  handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        this.tempAddImage = evt.target.result;
        const ic = this.shadowRoot.getElementById('add-cam-icon');
        if(ic) ic.innerHTML = `<img src="${this.tempAddImage}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
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

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


    
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes && state.attributes.ai_suggestion && state.attributes.ai_suggestion !== this.lastAI) {
        const input = this.shadowRoot.getElementById('add-name');
        if(input && document.activeElement !== input) {
            input.value = state.attributes.ai_suggestion;
            this.lastAI = state.attributes.ai_suggestion;
        }
    }
    this.updateUI();
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
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr;}
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;}
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        .item-icon { color: var(--primary); }

        /* Android-style Folder Icon */
        .android-folder-icon {
            width: 44px; height: 44px;
            background: #3c4043; /* Dark gray adaptive icon bg */
            border-radius: 12px; /* Squircle shape */
            display: flex; align-items: center; justify-content: center;
            color: #8ab4f8; /* Google Blue folder tint */
            flex-shrink: 0;
        }
        .android-folder-icon svg { width: 24px; height: 24px; }

        .item-details { font-size: 14px; }
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">הבית שלי</div><div class="sub-title" id="display-path">ראשי</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box" style="display:none;">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} גזור: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">הדבק</button></div>
        
        <div class="content" id="content"></div>
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <div class="cam-btn" id="add-cam-btn" style="width:45px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative"><input type="file" id="add-file" style="position:absolute;width:100%;height:100%;opacity:0"><span id="add-cam-icon">${ICONS.camera}</span></div>
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="שם..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">מיקום</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">פריט</button></div>
        </div>
      </div>
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('btn-up').onclick = () => this.navigate('up');
    root.getElementById('btn-home').onclick = () => this.navigate('root');
    root.getElementById('btn-shop').onclick = () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.notifyContext(); };
    root.getElementById('btn-search').onclick = () => { this.isSearch = true; this.isShopMode = false; this.render(); };
    root.getElementById('search-close').onclick = () => { this.isSearch = false; this.notifyContext(); };
    root.getElementById('search-input').oninput = (e) => this.notifyContext(e.target.value);
    root.getElementById('btn-edit').onclick = () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); };
    root.getElementById('add-file').onchange = (e) => this.handleFile(e);
    root.getElementById('btn-create-folder').onclick = () => this.addItem('folder');
    root.getElementById('btn-create-item').onclick = () => this.addItem('item');
    root.getElementById('btn-paste').onclick = () => this.pasteItem();
    root.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    
    // AI Events
    const magicBtn = root.getElementById('btn-ai-magic');
    const searchAiBtn = root.getElementById('btn-ai-search');
    
    if(magicBtn) magicBtn.onclick = () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    };
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.0.6';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    const content = root.getElementById('content');
    content.innerHTML = '';
    
    let list = [];
    if (attrs.shopping_list && attrs.shopping_list.length > 0) list = attrs.shopping_list;
    else if ((this.isSearch || attrs.path_display === 'Search Results') && attrs.items) list = attrs.items;
    else {
        if (attrs.folders) attrs.folders.forEach(f => list.push({...f, type:'folder'}));
        if (attrs.items) attrs.items.forEach(i => list.push({...i, type:'item'}));
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''}`;
        
        if (item.type === 'folder') {
             div.innerHTML = `
                <div class="item-main" onclick="this.getRootNode().host.navigate('down', '${item.name}')">
                    <div class="item-left">
                        <div class="android-folder-icon">${ICONS.folder}</div>
                        <span style="font-weight:500; font-size:16px;">${item.name}</span>
                    </div>
                    <!-- Arrow Removed -->
                </div>`;
        } else {
             const isShop = (attrs.path_display === 'Shopping List');
             let controls = '';
             
             if (isShop) {
                 controls = `<button class="qty-btn" style="background:var(--accent)" onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.name}')">${ICONS.plus}</button>
                             <input id="shop-qty-${item.name}" type="number" value="1" style="width:30px;background:#222;color:white;border:none;text-align:center" onclick="event.stopPropagation()">`;
             } else {
                 controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button>
                             <span class="qty-val">${item.qty}</span>
                             <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>`;
             }
             
             div.innerHTML = `
                <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.name}')">
                    <div class="item-left">
                        <span class="item-icon">${ICONS.item}</span>
                        <div>
                            <div>${item.name}</div>
                            <div class="sub-title">${item.date || ''} ${item.location ? '| ' + item.location : ''}</div>
                        </div>
                    </div>
                    <div class="item-qty-ctrl">${controls}</div>
                </div>
             `;
             
             if (this.expandedIdx === item.name) {
                 const details = document.createElement('div');
                 details.className = 'expanded-details';
                 details.innerHTML = `
                    <div class="detail-row">
                        <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                        <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                        <button class="action-btn" style="background:var(--primary)" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">שמור</button>
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
                 `;
                 div.appendChild(details);
             }
        }
        content.appendChild(div);
    });
  }

  render() { this.updateUI(); }
  
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  
  updateQty(name, d) {
       this.callHA('update_qty', { item_name: name, change: d });
  }

  submitShopStock(name) {
      const el = this.shadowRoot.getElementById(`shop-qty-${name}`);
      if(el) {
          this.callHA('update_stock', { item_name: name, quantity: parseInt(el.value) });
      }
  }

  notifyContext(query = "") {
    this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode });
  }

  addItem(type) {
    const name = this.shadowRoot.getElementById('add-name').value;
    const date = this.shadowRoot.getElementById('add-date').value;
    if (!name) return alert("שם חובה");
    this.callHA('add_item', { item_name: name, item_type: type, item_date: date, image_data: this.tempAddImage });
    this.shadowRoot.getElementById('add-name').value = ''; this.tempAddImage = null;
    this.shadowRoot.getElementById('add-cam-icon').innerHTML = ICONS.camera;
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
      const newName = this.shadowRoot.getElementById(`name-${idx}`).value;
      const newDate = this.shadowRoot.getElementById(`date-${idx}`).value;
      this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: newDate });
      this.expandedIdx = null;
  }
  
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this.callHA('delete_item', {item_name: name}); }
  showImg(src) { this.shadowRoot.getElementById('overlay-img').src = src; this.shadowRoot.getElementById('img-overlay').style.display = 'flex'; }

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


        .app-container { background: var(--app-bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; font-family: sans-serif; direction: rtl; }
        svg { width: 24px; height: 24px; fill: currentColor; }
        .top-bar { background: #242426; padding: 10px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; height: 60px; }
        .nav-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr;}
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        /* Item Row Styling */
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        
        /* Out of Stock Styling */
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;}
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        .item-icon { color: var(--primary); }

        .folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 15px;
            padding: 5px;
            margin-bottom: 20px;
        }

        .folder-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            text-align: center;
        }

        .android-folder-icon {
            width: 56px; height: 56px;
            background: #3c4043; 
            border-radius: 16px; 
            display: flex; align-items: center; justify-content: center;
            color: #8ab4f8; 
            margin-bottom: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .android-folder-icon svg { width: 28px; height: 28px; }

        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        
        /* Separator for Groups */
        .group-separator { 
            color: #aaa; font-size: 12px; margin: 15px 0 5px 0; border-bottom: 1px solid #444; padding-bottom: 2px; text-transform: uppercase; font-weight: bold;
            display: flex; justify-content: space-between;
        }
        .oos-separator { color: var(--danger); border-color: var(--danger); }

        .item-details { font-size: 14px; }
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">הבית שלי</div><div class="sub-title" id="display-path">ראשי</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box" style="display:none;">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} גזור: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">הדבק</button></div>
        
        <div class="content" id="content"></div>
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <div class="cam-btn" id="add-cam-btn" style="width:45px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative"><input type="file" id="add-file" style="position:absolute;width:100%;height:100%;opacity:0"><span id="add-cam-icon">${ICONS.camera}</span></div>
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="שם..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">מיקום</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">פריט</button></div>
        </div>
      </div>
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('btn-up').onclick = () => this.navigate('up');
    root.getElementById('btn-home').onclick = () => this.navigate('root');
    root.getElementById('btn-shop').onclick = () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.notifyContext(); };
    root.getElementById('btn-search').onclick = () => { this.isSearch = true; this.isShopMode = false; this.render(); };
    root.getElementById('search-close').onclick = () => { this.isSearch = false; this.notifyContext(); };
    root.getElementById('search-input').oninput = (e) => this.notifyContext(e.target.value);
    root.getElementById('btn-edit').onclick = () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); };
    root.getElementById('add-file').onchange = (e) => this.handleFile(e);
    root.getElementById('btn-create-folder').onclick = () => this.addItem('folder');
    root.getElementById('btn-create-item').onclick = () => this.addItem('item');
    root.getElementById('btn-paste').onclick = () => this.pasteItem();
    root.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    
    // AI Events
    const magicBtn = root.getElementById('btn-ai-magic');
    const searchAiBtn = root.getElementById('btn-ai-search');
    
    if(magicBtn) magicBtn.onclick = () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    };
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.0.8';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    const content = root.getElementById('content');
    content.innerHTML = '';

    // --- RENDER LOGIC ---

    // 1. SHOPPING MODE (Group by Main Location)
    if (attrs.shopping_list && attrs.shopping_list.length > 0) {
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';

        // Group by 'main_location'
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

            grouped[locName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, true));
            });
        });
        content.appendChild(listContainer);
        return;
    }

    // 2. SEARCH MODE
    if ((this.isSearch || attrs.path_display === 'Search Results') && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

    // 3. BROWSE MODE (Based on Depth)
    
    // Depth < 2: Show Grid (Folders) and Loose Items
    if (attrs.depth < 2) {
        // Grid
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
        // Loose Items
        if (attrs.items && attrs.items.length > 0) {
            const list = document.createElement('div');
            list.className = 'item-list';
            attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
            content.appendChild(list);
        }
    } 
    else {
        // Depth >= 2: Main Location View (Sublocations & Out of Stock)
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';

        const inStock = [];
        const outOfStock = [];

        // Split items
        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

        // Render In Stock (Grouped by Sublocation)
        const grouped = {};
        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if(!grouped[sub]) grouped[sub] = [];
            grouped[sub].push(item);
        });

        Object.keys(grouped).sort().forEach(subName => {
            const header = document.createElement('div');
            header.className = 'group-separator';
            header.innerText = subName;
            listContainer.appendChild(header);

            grouped[subName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        });

        // Render Out of Stock (At the bottom)
        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);

            outOfStock.forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        }
        
        content.appendChild(listContainer);
    }
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     // Red frame if OOS
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     // Controls
     let controls = '';
     if (isShopMode) {
         // Shop Mode: +/- and Update Button
         controls = `
            <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>
            <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button>
            <button class="qty-btn" style="background:var(--primary)" onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.name}')">${ICONS.save}</button>
         `;
     } else {
         // Normal Mode
         controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button>
                     <span class="qty-val">${item.qty}</span>
                     <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>`;
     }

     const subText = isShopMode ? 
        `${item.main_location} > ${item.sub_location || ''}` : 
        `${item.date || ''}`;

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
     
     // Expanded Details (Same as before)
     if (this.expandedIdx === item.name) {
         const details = document.createElement('div');
         details.className = 'expanded-details';
         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn" style="background:var(--primary)" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">שמור</button>
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
         `;
         div.appendChild(details);
     }
     return div;
  }

  render() { this.updateUI(); }
  
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  
  updateQty(name, d) {
       this.callHA('update_qty', { item_name: name, change: d });
  }

  submitShopStock(name) {
      // In Shop mode, we just want to "Update" stock. Usually implies restocking.
      // But user said buttons + - and Update on same line.
      // Current + - buttons call updateQty immediately.
      // The Update button (Save icon) can be used to set a specific value or just commit "1".
      // Let's assume Update button sets qty to 1 (Bought) for now, or confirms current state.
      // Given the prompt, + - change amount. Update button... does what?
      // "button to Update on the same line" implies a specific action.
      // Let's make Update button prompt for exact stock or set to 1.
      // For simplicity: + - work live. Update button sets Qty to 1 (Restock).
      this.callHA('update_stock', { item_name: name, quantity: 1 });
  }

  notifyContext(query = "") {
    this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode });
  }

  addItem(type) {
    const name = this.shadowRoot.getElementById('add-name').value;
    const date = this.shadowRoot.getElementById('add-date').value;
    if (!name) return alert("שם חובה");
    this.callHA('add_item', { item_name: name, item_type: type, item_date: date, image_data: this.tempAddImage });
    this.shadowRoot.getElementById('add-name').value = ''; this.tempAddImage = null;
    this.shadowRoot.getElementById('add-cam-icon').innerHTML = ICONS.camera;
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
      const newName = this.shadowRoot.getElementById(`name-${idx}`).value;
      const newDate = this.shadowRoot.getElementById(`date-${idx}`).value;
      this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: newDate });
      this.expandedIdx = null;
  }
  
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this.callHA('delete_item', {item_name: name}); }
  showImg(src) { this.shadowRoot.getElementById('overlay-img').src = src; this.shadowRoot.getElementById('img-overlay').style.display = 'flex'; }

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


    }
    
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes && state.attributes.ai_suggestion && state.attributes.ai_suggestion !== this.lastAI) {
        const input = this.shadowRoot.getElementById('add-name');
        if(input && document.activeElement !== input) {
            input.value = state.attributes.ai_suggestion;
            this.lastAI = state.attributes.ai_suggestion;
        }
    }
    this.updateUI();
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
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr;}
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;}
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        .item-icon { color: var(--primary); }

        .folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 15px;
            padding: 5px;
            margin-bottom: 20px;
        }

        .folder-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            text-align: center;
        }

        .android-folder-icon {
            width: 56px; height: 56px;
            background: #3c4043; 
            border-radius: 16px; 
            display: flex; align-items: center; justify-content: center;
            color: #8ab4f8; 
            margin-bottom: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .android-folder-icon svg { width: 28px; height: 28px; }

        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        
        /* Group Separator */
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
        }
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }

        .item-details { font-size: 14px; }
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">הבית שלי</div><div class="sub-title" id="display-path">ראשי</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box" style="display:none;">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} גזור: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">הדבק</button></div>
        
        <div class="content" id="content"></div>
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <div class="cam-btn" id="add-cam-btn" style="width:45px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative"><input type="file" id="add-file" style="position:absolute;width:100%;height:100%;opacity:0"><span id="add-cam-icon">${ICONS.camera}</span></div>
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="שם..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">מיקום</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">פריט</button></div>
        </div>
      </div>
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('btn-up').onclick = () => this.navigate('up');
    root.getElementById('btn-home').onclick = () => this.navigate('root');
    root.getElementById('btn-shop').onclick = () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.notifyContext(); };
    root.getElementById('btn-search').onclick = () => { this.isSearch = true; this.isShopMode = false; this.render(); };
    root.getElementById('search-close').onclick = () => { this.isSearch = false; this.notifyContext(); };
    root.getElementById('search-input').oninput = (e) => this.notifyContext(e.target.value);
    root.getElementById('btn-edit').onclick = () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); };
    root.getElementById('add-file').onchange = (e) => this.handleFile(e);
    root.getElementById('btn-create-folder').onclick = () => this.addItem('folder');
    root.getElementById('btn-create-item').onclick = () => this.addItem('item');
    root.getElementById('btn-paste').onclick = () => this.pasteItem();
    root.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    
    // AI Events
    const magicBtn = root.getElementById('btn-ai-magic');
    const searchAiBtn = root.getElementById('btn-ai-search');
    
    if(magicBtn) magicBtn.onclick = () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    };
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.0.9';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    const content = root.getElementById('content');
    content.innerHTML = '';

    // --- RENDER LOGIC ---

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

            grouped[locName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, true));
            });
        });
        content.appendChild(listContainer);
        return;
    }

    if ((this.isSearch || attrs.path_display === 'Search Results') && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

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
        // MAIN LOCATION VIEW (Sublocations List)
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

        const grouped = {};
        // Initialize groups with folders (from attrs.folders which now contains all sublocations)
        if (attrs.folders) {
            attrs.folders.forEach(f => grouped[f.name] = []);
        }
        // Also ensure "General" exists if needed
        grouped["General"] = grouped["General"] || [];

        // Distribute items
        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if(!grouped[sub]) grouped[sub] = []; // Should already exist from folders, but safety check
            grouped[sub].push(item);
        });

        Object.keys(grouped).sort().forEach(subName => {
            // Only show General if it has items. Show other sublocations always (to allow adding to them or renaming)
            if (subName === "General" && grouped[subName].length === 0) return;

            const header = document.createElement('div');
            header.className = 'group-separator';
            
            // Add Edit Button for Sublocation Headers
            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `<span>${subName}</span> <button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button>`;
            } else {
                header.innerText = subName;
            }
            
            listContainer.appendChild(header);

            grouped[subName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        });

        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);

            outOfStock.forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        }
        
        content.appendChild(listContainer);
    }
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
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

     const subText = isShopMode ? 
        `${item.main_location} > ${item.sub_location || ''}` : 
        `${item.date || ''}`;

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
         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn" style="background:var(--primary)" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">שמור</button>
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
         `;
         div.appendChild(details);
     }
     return div;
  }

  render() { this.updateUI(); }
  
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  
  updateQty(name, d) {
       this.callHA('update_qty', { item_name: name, change: d });
  }

  submitShopStock(name) {
      this.callHA('update_stock', { item_name: name, quantity: 1 });
  }

  notifyContext(query = "") {
    this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode });
  }

  addItem(type) {
    const name = this.shadowRoot.getElementById('add-name').value;
    const date = this.shadowRoot.getElementById('add-date').value;
    if (!name) return alert("שם חובה");
    this.callHA('add_item', { item_name: name, item_type: type, item_date: date, image_data: this.tempAddImage });
    this.shadowRoot.getElementById('add-name').value = ''; this.tempAddImage = null;
    this.shadowRoot.getElementById('add-cam-icon').innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename Sublocation:", oldName);
      if (newName && newName !== oldName) {
          // We treat sublocation renaming as updating a "folder marker" item details
          // The backend logic is smart enough to handle this as a bulk update for the level
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
      const newName = this.shadowRoot.getElementById(`name-${idx}`).value;
      const newDate = this.shadowRoot.getElementById(`date-${idx}`).value;
      this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: newDate });
      this.expandedIdx = null;
  }
  
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this.callHA('delete_item', {item_name: name}); }
  showImg(src) { this.shadowRoot.getElementById('overlay-img').src = src; this.shadowRoot.getElementById('img-overlay').style.display = 'flex'; }

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


    }
    
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes) {
        if (state.attributes.ai_suggestion && state.attributes.ai_suggestion !== this.lastAI) {
            const input = this.shadowRoot.getElementById('add-name');
            if(input && document.activeElement !== input) {
                input.value = state.attributes.ai_suggestion;
                this.lastAI = state.attributes.ai_suggestion;
            }
        }
        this.updateUI();
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
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr;}
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .app-container.edit-mode .item-row { cursor: grab; }
        
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;}
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        .item-icon { color: var(--primary); }

        .folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 15px;
            padding: 5px;
            margin-bottom: 20px;
        }

        .folder-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            text-align: center;
        }

        .android-folder-icon {
            width: 56px; height: 56px;
            background: #3c4043; 
            border-radius: 16px; 
            display: flex; align-items: center; justify-content: center;
            color: #8ab4f8; 
            margin-bottom: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .android-folder-icon svg { width: 28px; height: 28px; }

        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
        }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); }
        
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }

        .item-details { font-size: 14px; }
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">הבית שלי</div><div class="sub-title" id="display-path">ראשי</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box" style="display:none;">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} גזור: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">הדבק</button></div>
        
        <div class="content" id="content"></div>
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <div class="cam-btn" id="add-cam-btn" style="width:45px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative"><input type="file" id="add-file" style="position:absolute;width:100%;height:100%;opacity:0"><span id="add-cam-icon">${ICONS.camera}</span></div>
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="שם..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">מיקום</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">פריט</button></div>
        </div>
      </div>
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('btn-up').onclick = () => this.navigate('up');
    root.getElementById('btn-home').onclick = () => this.navigate('root');
    root.getElementById('btn-shop').onclick = () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.notifyContext(); };
    root.getElementById('btn-search').onclick = () => { this.isSearch = true; this.isShopMode = false; this.render(); };
    root.getElementById('search-close').onclick = () => { this.isSearch = false; this.notifyContext(); };
    root.getElementById('search-input').oninput = (e) => this.notifyContext(e.target.value);
    root.getElementById('btn-edit').onclick = () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); };
    root.getElementById('add-file').onchange = (e) => this.handleFile(e);
    root.getElementById('btn-create-folder').onclick = () => this.addItem('folder');
    root.getElementById('btn-create-item').onclick = () => this.addItem('item');
    root.getElementById('btn-paste').onclick = () => this.pasteItem();
    root.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    
    const magicBtn = root.getElementById('btn-ai-magic');
    const searchAiBtn = root.getElementById('btn-ai-search');
    
    if(magicBtn) magicBtn.onclick = () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    };
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.1.4';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

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

            grouped[locName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, true));
            });
        });
        content.appendChild(listContainer);
        return;
    }

    if ((this.isSearch || attrs.path_display === 'Search Results') && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

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
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

        const grouped = {};
        if (attrs.folders) {
            attrs.folders.forEach(f => grouped[f.name] = []);
        }
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
            
            if (this.isEditMode) {
                header.ondragover = (e) => { e.preventDefault(); header.classList.add('drag-over'); };
                header.ondragleave = () => header.classList.remove('drag-over');
                header.ondrop = (e) => { e.preventDefault(); header.classList.remove('drag-over'); this.handleDrop(e, subName); };
            }

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <span>${subName}</span> 
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button>
                        <button class="edit-subloc-btn" style="color:var(--danger)" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
            } else {
                header.innerText = subName;
            }
            
            listContainer.appendChild(header);

            grouped[subName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        });

        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);

            outOfStock.forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        }
        
        content.appendChild(listContainer);
    }
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     if (this.isEditMode) {
         div.draggable = true;
         div.ondragstart = (e) => {
             e.dataTransfer.setData("text/plain", item.name);
             e.dataTransfer.effectAllowed = "move";
         };
     }

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

     const subText = isShopMode ? 
        `${item.main_location} > ${item.sub_location || ''}` : 
        `${item.date || ''}`;

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
         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn" style="background:var(--primary)" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">שמור</button>
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
         `;
         div.appendChild(details);
     }
     return div;
  }

  handleDrop(e, targetSubloc) {
      e.preventDefault();
      const itemName = e.dataTransfer.getData("text/plain");
      if (!itemName) return;
      
      let targetPath = [...this.currentPath];
      
      if (targetSubloc !== "General") {
          targetPath.push(targetSubloc);
      }
      
      this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
      setTimeout(() => {
          this.callHA('paste_item', {target_path: targetPath});
          setTimeout(() => this.notifyContext(), 300);
      }, 100);
  }

  deleteSubloc(name) {
      if(confirm(`Delete sublocation '${name}'? Items will move to 'General'.`)) {
          this.callHA('update_item_details', { original_name: name, new_name: "", new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  render() { this.updateUI(); }
  
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  
  updateQty(name, d) {
       this.callHA('update_qty', { item_name: name, change: d });
  }

  submitShopStock(name) {
      this.callHA('update_stock', { item_name: name, quantity: 1 });
  }

  notifyContext(query = "") {
    this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode });
  }

  addItem(type) {
    const name = this.shadowRoot.getElementById('add-name').value;
    const date = this.shadowRoot.getElementById('add-date').value;
    if (!name) return alert("שם חובה");
    this.callHA('add_item', { item_name: name, item_type: type, item_date: date, image_data: this.tempAddImage });
    this.shadowRoot.getElementById('add-name').value = ''; this.tempAddImage = null;
    this.shadowRoot.getElementById('add-cam-icon').innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename Sublocation:", oldName);
      if (newName && newName !== oldName) {
          this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
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
      const newName = this.shadowRoot.getElementById(`name-${idx}`).value;
      const newDate = this.shadowRoot.getElementById(`date-${idx}`).value;
      this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: newDate });
      this.expandedIdx = null;
  }
  
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this.callHA('delete_item', {item_name: name}); }
  showImg(src) { this.shadowRoot.getElementById('overlay-img').src = src; this.shadowRoot.getElementById('img-overlay').style.display = 'flex'; }

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


      this.initUI();
    }
    
    // Safety check for state
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes) {
        if (state.attributes.ai_suggestion && state.attributes.ai_suggestion !== this.lastAI) {
            const input = this.shadowRoot.getElementById('add-name');
            if(input && input !== this.shadowRoot.activeElement) {
                input.value = state.attributes.ai_suggestion;
                this.lastAI = state.attributes.ai_suggestion;
            }
        }
        this.updateUI();
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
        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); }
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }

        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .out-of-stock-frame { border: 2px solid var(--danger); }
        .app-container.edit-mode .item-row { cursor: grab; border: 1px dashed #555; }

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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">Organizer</div><div class="sub-title" id="display-path">Main</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button></div>
        
        <div class="content" id="content"></div>
        
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
    
    const click = (id, fn) => { const el = root.getElementById(id); if(el) el.onclick = fn; };
    
    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => this.navigate('root'));
    click('btn-shop', () => { 
        this.isShopMode = !this.isShopMode; 
        if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } 
        this.notifyContext(); 
    });
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.notifyContext(); });
    
    const sInput = root.getElementById('search-input');
    if(sInput) sInput.oninput = (e) => this.notifyContext(e.target.value);
    
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    const fileIn = root.getElementById('add-file');
    if(fileIn) fileIn.onchange = (e) => this.handleFile(e);
    
    click('btn-create-folder', () => this.addItem('folder'));
    click('btn-create-item', () => this.addItem('item'));
    click('btn-paste', () => this.pasteItem());
    
    const dateIn = root.getElementById('add-date');
    if(dateIn) dateIn.value = new Date().toISOString().split('T')[0];
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.1.8';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    const content = root.getElementById('content');
    content.innerHTML = '';

    // 1. SHOPPING LIST MODE
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
    if ((this.isSearch || attrs.path_display.startsWith('Search')) && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

    // 3. BROWSE MODE
    if (attrs.depth < 2) {
        // Grid View
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

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

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
            
            // Drag Drop
            if (this.isEditMode) {
                header.ondragover = (e) => { e.preventDefault(); header.classList.add('drag-over'); };
                header.ondragleave = () => header.classList.remove('drag-over');
                header.ondrop = (e) => { e.preventDefault(); header.classList.remove('drag-over'); this.handleDrop(e, subName); };
            }

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <span>${subName}</span> 
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button>
                        <button class="edit-subloc-btn" style="color:var(--danger)" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
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

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     if (this.isEditMode) {
         div.draggable = true;
         div.ondragstart = (e) => {
             e.dataTransfer.setData("text/plain", item.name);
             e.dataTransfer.effectAllowed = "move";
         };
     }

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
         `;
         div.appendChild(details);
     }
     return div;
  }

  handleDrop(e, targetSubloc) {
      e.preventDefault();
      const itemName = e.dataTransfer.getData("text/plain");
      if (!itemName) return;
      let targetPath = [...this.currentPath];
      if (targetSubloc !== "General") targetPath.push(targetSubloc);
      
      this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
      setTimeout(() => {
          this.callHA('paste_item', {target_path: targetPath});
          setTimeout(() => this.notifyContext(), 300);
      }, 100);
  }

  deleteSubloc(name) {
      if(confirm(`Delete '${name}'?`)) {
          this.callHA('update_item_details', { original_name: name, new_name: "", new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  render() { this.updateUI(); }
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  submitShopStock(name) { this.callHA('update_stock', { item_name: name, quantity: 1 }); }
  notifyContext(query = "") { this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode }); }

  addItem(type) {
    const nEl = this.shadowRoot.getElementById('add-name');
    const dEl = this.shadowRoot.getElementById('add-date');
    if (!nEl || !nEl.value) return alert("Name required");
    this.callHA('add_item', { item_name: nEl.value, item_type: type, item_date: dEl.value, image_data: this.tempAddImage });
    nEl.value = ''; this.tempAddImage = null;
    const ic = this.shadowRoot.getElementById('add-cam-icon');
    if(ic) ic.innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename:", oldName);
      if (newName && newName !== oldName) {
          this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        this.tempAddImage = evt.target.result;
        const ic = this.shadowRoot.getElementById('add-cam-icon');
        if(ic) ic.innerHTML = `<img src="${this.tempAddImage}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
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

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


    
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes) {
        // Handle AI Suggestions
        const aiSugg = state.attributes.ai_suggestion;
        if (aiSugg && aiSugg !== this.lastAI) {
            const input = this.shadowRoot.getElementById('add-name');
            if(input && document.activeElement !== input) {
                input.value = aiSugg;
                this.lastAI = aiSugg;
            }
        }
        this.updateUI();
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
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr;}
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .out-of-stock-frame { border: 2px solid var(--danger); }
        
        .app-container.edit-mode .item-row { cursor: grab; border: 1px dashed #555; }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;}
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        .item-icon { color: var(--primary); }

        /* Grid */
        .folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 15px;
            padding: 5px;
            margin-bottom: 20px;
        }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; }
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .android-folder-icon svg { width: 28px; height: 28px; }
        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); }
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }

        .item-details { font-size: 14px; }
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">Organizer</div><div class="sub-title" id="display-path">Main</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button></div>
        
        <div class="content" id="content"></div>
        
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
    
    const click = (id, fn) => { const el = root.getElementById(id); if(el) el.onclick = fn; };
    
    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => this.navigate('root'));
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.notifyContext(); });
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.notifyContext(); });
    
    const sInput = root.getElementById('search-input');
    if(sInput) sInput.oninput = (e) => this.notifyContext(e.target.value);
    
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    const fileIn = root.getElementById('add-file');
    if(fileIn) fileIn.onchange = (e) => this.handleFile(e);
    
    click('btn-create-folder', () => this.addItem('folder'));
    click('btn-create-item', () => this.addItem('item'));
    click('btn-paste', () => this.pasteItem());
    
    const dateIn = root.getElementById('add-date');
    if(dateIn) dateIn.value = new Date().toISOString().split('T')[0];
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    // AI Visibility
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    // Titles
    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.1.7';

    // UI Areas
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

    // 2. SEARCH
    if ((this.isSearch || attrs.path_display.startsWith('Search')) && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

    // 3. BROWSE MODE
    if (attrs.depth < 2) {
        // Grid View
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
        // List View with Sublocations
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

        const grouped = {};
        if (attrs.folders) attrs.folders.forEach(f => grouped[f.name] = []);
        if (!grouped["General"]) grouped["General"] = [];

        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if(!grouped[sub]) grouped[sub] = [];
            grouped[sub].push(item);
        });

        Object.keys(grouped).sort().forEach(subName => {
            // Logic: Hide General if empty unless editing. Show other sublocations always.
            if (subName === "General" && grouped[subName].length === 0 && !this.isEditMode) return;

            const header = document.createElement('div');
            header.className = 'group-separator';
            
            if (this.isEditMode) {
                // Drag Over logic
                header.ondragover = (e) => { e.preventDefault(); header.classList.add('drag-over'); };
                header.ondragleave = () => header.classList.remove('drag-over');
                header.ondrop = (e) => { e.preventDefault(); header.classList.remove('drag-over'); this.handleDrop(e, subName); };
            }

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <span>${subName}</span> 
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button>
                        <button class="edit-subloc-btn" style="color:var(--danger)" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
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

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     if (this.isEditMode) {
         div.draggable = true;
         div.ondragstart = (e) => {
             e.dataTransfer.setData("text/plain", item.name);
             e.dataTransfer.effectAllowed = "move";
         };
     }

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
         `;
         div.appendChild(details);
     }
     return div;
  }

  handleDrop(e, targetSubloc) {
      e.preventDefault();
      const itemName = e.dataTransfer.getData("text/plain");
      if (!itemName) return;
      let targetPath = [...this.currentPath];
      if (targetSubloc !== "General") targetPath.push(targetSubloc);
      
      this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
      setTimeout(() => {
          this.callHA('paste_item', {target_path: targetPath});
          setTimeout(() => this.notifyContext(), 300);
      }, 100);
  }

  deleteSubloc(name) {
      if(confirm(`Delete '${name}'?`)) {
          this.callHA('update_item_details', { original_name: name, new_name: "", new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  render() { this.updateUI(); }
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  submitShopStock(name) { this.callHA('update_stock', { item_name: name, quantity: 1 }); }
  notifyContext(query = "") { this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode }); }

  addItem(type) {
    const nEl = this.shadowRoot.getElementById('add-name');
    const dEl = this.shadowRoot.getElementById('add-date');
    if (!nEl || !nEl.value) return alert("Name required");
    this.callHA('add_item', { item_name: nEl.value, item_type: type, item_date: dEl.value, image_data: this.tempAddImage });
    nEl.value = ''; this.tempAddImage = null;
    const ic = this.shadowRoot.getElementById('add-cam-icon');
    if(ic) ic.innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename:", oldName);
      if (newName && newName !== oldName) {
          this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        this.tempAddImage = evt.target.result;
        const ic = this.shadowRoot.getElementById('add-cam-icon');
        if(ic) ic.innerHTML = `<img src="${this.tempAddImage}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
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

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes) {
        // AI Suggestion Check
        const suggestion = state.attributes.ai_suggestion;
        if (suggestion && suggestion !== this.lastAI) {
            const input = this.shadowRoot.getElementById('add-name');
            if(input && document.activeElement !== input) {
                input.value = suggestion;
                this.lastAI = suggestion;
            }
        }
        this.updateUI();
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
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; }
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); }
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .out-of-stock-frame { border: 2px solid var(--danger); }
        .app-container.edit-mode .item-row { cursor: grab; border: 1px dashed #555; }

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
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
      </style>
      
      <div class="app-container" id="app">
         <div class="top-bar">
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">Organizer</div><div class="sub-title" id="display-path">Main</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button></div>
        
        <div class="content" id="content"></div>
        
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
    
    // Helper to safely bind click events
    const on = (id, fn) => { 
        const el = root.getElementById(id); 
        if(el) el.onclick = fn; 
    };

    on('btn-up', () => this.navigate('up'));
    on('btn-home', () => this.navigate('root'));
    
    on('btn-shop', () => { 
        this.isShopMode = !this.isShopMode; 
        if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } 
        this.notifyContext(); 
    });
    
    on('btn-search', () => { 
        this.isSearch = true; 
        this.isShopMode = false; 
        this.render(); 
    });
    
    on('search-close', () => { 
        this.isSearch = false; 
        this.notifyContext(); 
    });
    
    const sInput = root.getElementById('search-input');
    if(sInput) sInput.oninput = (e) => this.notifyContext(e.target.value);
    
    on('btn-edit', () => { 
        this.isEditMode = !this.isEditMode; 
        this.isShopMode = false; 
        this.render(); 
    });
    
    const fileIn = root.getElementById('add-file');
    if(fileIn) fileIn.onchange = (e) => this.handleFile(e);
    
    on('btn-create-folder', () => this.addItem('folder'));
    on('btn-create-item', () => this.addItem('item'));
    on('btn-paste', () => this.pasteItem());
    
    const dateIn = root.getElementById('add-date');
    if(dateIn) dateIn.value = new Date().toISOString().split('T')[0];
    
    // AI
    on('btn-ai-magic', () => {
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.1.6';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    const content = root.getElementById('content');
    content.innerHTML = '';

    // 1. SHOPPING LIST MODE
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
    if ((this.isSearch || attrs.path_display.startsWith('Search')) && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

    // 3. BROWSE MODE
    if (attrs.depth < 2) {
        // Grid View (Rooms / Main Locations)
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

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

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
            
            // Drag Drop
            if (this.isEditMode) {
                header.ondragover = (e) => { e.preventDefault(); header.classList.add('drag-over'); };
                header.ondragleave = () => header.classList.remove('drag-over');
                header.ondrop = (e) => { e.preventDefault(); header.classList.remove('drag-over'); this.handleDrop(e, subName); };
            }

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <span>${subName}</span> 
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button>
                        <button class="edit-subloc-btn" style="color:var(--danger)" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
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

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     if (this.isEditMode) {
         div.draggable = true;
         div.ondragstart = (e) => {
             e.dataTransfer.setData("text/plain", item.name);
             e.dataTransfer.effectAllowed = "move";
         };
     }

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

     const subText = isShopMode ? 
        `${item.main_location} > ${item.sub_location || ''}` : 
        `${item.date || ''}`;

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
         `;
         div.appendChild(details);
     }
     return div;
  }

  handleDrop(e, targetSubloc) {
      e.preventDefault();
      const itemName = e.dataTransfer.getData("text/plain");
      if (!itemName) return;
      let targetPath = [...this.currentPath];
      if (targetSubloc !== "General") targetPath.push(targetSubloc);
      
      this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
      setTimeout(() => {
          this.callHA('paste_item', {target_path: targetPath});
          setTimeout(() => this.notifyContext(), 300);
      }, 100);
  }

  deleteSubloc(name) {
      if(confirm(`Delete '${name}'?`)) {
          this.callHA('update_item_details', { original_name: name, new_name: "", new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  render() { this.updateUI(); }
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  submitShopStock(name) { this.callHA('update_stock', { item_name: name, quantity: 1 }); }
  notifyContext(query = "") { this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode }); }

  addItem(type) {
    const nEl = this.shadowRoot.getElementById('add-name');
    const dEl = this.shadowRoot.getElementById('add-date');
    if (!nEl || !nEl.value) return alert("Name required");
    this.callHA('add_item', { item_name: nEl.value, item_type: type, item_date: dEl.value, image_data: this.tempAddImage });
    nEl.value = ''; this.tempAddImage = null;
    const ic = this.shadowRoot.getElementById('add-cam-icon');
    if(ic) ic.innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename:", oldName);
      if (newName && newName !== oldName) {
          this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        this.tempAddImage = evt.target.result;
        const ic = this.shadowRoot.getElementById('add-cam-icon');
        if(ic) ic.innerHTML = `<img src="${this.tempAddImage}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
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

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


    }
    
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes) {
        if (state.attributes.ai_suggestion && state.attributes.ai_suggestion !== this.lastAI) {
            const input = this.shadowRoot.getElementById('add-name');
            if(input && document.activeElement !== input) {
                input.value = state.attributes.ai_suggestion;
                this.lastAI = state.attributes.ai_suggestion;
            }
        }
        this.updateUI();
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
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr;}
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .app-container.edit-mode .item-row { cursor: grab; }
        
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;}
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        .item-icon { color: var(--primary); }

        .folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 15px;
            padding: 5px;
            margin-bottom: 20px;
        }

        .folder-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            text-align: center;
        }

        .android-folder-icon {
            width: 56px; height: 56px;
            background: #3c4043; 
            border-radius: 16px; 
            display: flex; align-items: center; justify-content: center;
            color: #8ab4f8; 
            margin-bottom: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .android-folder-icon svg { width: 28px; height: 28px; }

        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
        }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); }
        
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }

        .item-details { font-size: 14px; }
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">הבית שלי</div><div class="sub-title" id="display-path">ראשי</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box" style="display:none;">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} גזור: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">הדבק</button></div>
        
        <div class="content" id="content"></div>
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <div class="cam-btn" id="add-cam-btn" style="width:45px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative"><input type="file" id="add-file" style="position:absolute;width:100%;height:100%;opacity:0"><span id="add-cam-icon">${ICONS.camera}</span></div>
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="שם..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">מיקום</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">פריט</button></div>
        </div>
      </div>
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('btn-up').onclick = () => this.navigate('up');
    root.getElementById('btn-home').onclick = () => this.navigate('root');
    root.getElementById('btn-shop').onclick = () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.notifyContext(); };
    root.getElementById('btn-search').onclick = () => { this.isSearch = true; this.isShopMode = false; this.render(); };
    root.getElementById('search-close').onclick = () => { this.isSearch = false; this.notifyContext(); };
    root.getElementById('search-input').oninput = (e) => this.notifyContext(e.target.value);
    root.getElementById('btn-edit').onclick = () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); };
    root.getElementById('add-file').onchange = (e) => this.handleFile(e);
    root.getElementById('btn-create-folder').onclick = () => this.addItem('folder');
    root.getElementById('btn-create-item').onclick = () => this.addItem('item');
    root.getElementById('btn-paste').onclick = () => this.pasteItem();
    root.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    
    const magicBtn = root.getElementById('btn-ai-magic');
    const searchAiBtn = root.getElementById('btn-ai-search');
    
    if(magicBtn) magicBtn.onclick = () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    };
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.1.3';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

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

            grouped[locName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, true));
            });
        });
        content.appendChild(listContainer);
        return;
    }

    if ((this.isSearch || attrs.path_display === 'Search Results') && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

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
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

        const grouped = {};
        if (attrs.folders) {
            attrs.folders.forEach(f => grouped[f.name] = []);
        }
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
            
            if (this.isEditMode) {
                header.ondragover = (e) => { e.preventDefault(); header.classList.add('drag-over'); };
                header.ondragleave = () => header.classList.remove('drag-over');
                header.ondrop = (e) => { e.preventDefault(); header.classList.remove('drag-over'); this.handleDrop(e, subName); };
            }

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <span>${subName}</span> 
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button>
                        <button class="edit-subloc-btn" style="color:var(--danger)" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
            } else {
                header.innerText = subName;
            }
            
            listContainer.appendChild(header);

            grouped[subName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        });

        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);

            outOfStock.forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        }
        
        content.appendChild(listContainer);
    }
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     if (this.isEditMode) {
         div.draggable = true;
         div.ondragstart = (e) => {
             e.dataTransfer.setData("text/plain", item.name);
             e.dataTransfer.effectAllowed = "move";
         };
     }

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

     const subText = isShopMode ? 
        `${item.main_location} > ${item.sub_location || ''}` : 
        `${item.date || ''}`;

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
         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn" style="background:var(--primary)" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">שמור</button>
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
         `;
         div.appendChild(details);
     }
     return div;
  }

  handleDrop(e, targetSubloc) {
      e.preventDefault();
      const itemName = e.dataTransfer.getData("text/plain");
      if (!itemName) return;
      
      // Calculate target path
      let targetPath = [...this.currentPath];
      
      // If we are dragging to "General", we effectively remove the last level (sublocation) if we were viewing a sublocation directly, 
      // BUT here we are inside a Main Location view where path = [Room, Main].
      // Items here usually have a 3rd level defining their sublocation.
      
      // The backend 'paste_item' expects the FULL path where the item should live.
      // If we are at [Room, Main], dropping to "Shelf 1" means the item should have path [Room, Main, Shelf 1].
      // If dragging to "General", it means path [Room, Main].
      
      if (targetSubloc !== "General") {
          targetPath.push(targetSubloc);
      }
      
      this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
      
      // Small delay to ensure cut is processed before paste
      setTimeout(() => {
          this.callHA('paste_item', {target_path: targetPath});
          
          // CRITICAL: Force refresh after paste to show the item in its new group
          setTimeout(() => {
              this.notifyContext(); 
          }, 300);
      }, 100);
  }

  deleteSubloc(name) {
      if(confirm(`Delete sublocation '${name}'? Items will move to 'General'.`)) {
          this.callHA('update_item_details', { original_name: name, new_name: "", new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  render() { this.updateUI(); }
  
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  
  updateQty(name, d) {
       this.callHA('update_qty', { item_name: name, change: d });
  }

  submitShopStock(name) {
      this.callHA('update_stock', { item_name: name, quantity: 1 });
  }

  notifyContext(query = "") {
    this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode });
  }

  addItem(type) {
    const name = this.shadowRoot.getElementById('add-name').value;
    const date = this.shadowRoot.getElementById('add-date').value;
    if (!name) return alert("שם חובה");
    this.callHA('add_item', { item_name: name, item_type: type, item_date: date, image_data: this.tempAddImage });
    this.shadowRoot.getElementById('add-name').value = ''; this.tempAddImage = null;
    this.shadowRoot.getElementById('add-cam-icon').innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename Sublocation:", oldName);
      if (newName && newName !== oldName) {
          this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
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
      const newName = this.shadowRoot.getElementById(`name-${idx}`).value;
      const newDate = this.shadowRoot.getElementById(`date-${idx}`).value;
      this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: newDate });
      this.expandedIdx = null;
  }
  
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this.callHA('delete_item', {item_name: name}); }
  showImg(src) { this.shadowRoot.getElementById('overlay-img').src = src; this.shadowRoot.getElementById('img-overlay').style.display = 'flex'; }

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


    }
    
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes) {
        if (state.attributes.ai_suggestion && state.attributes.ai_suggestion !== this.lastAI) {
            const input = this.shadowRoot.getElementById('add-name');
            if(input && document.activeElement !== input) {
                input.value = state.attributes.ai_suggestion;
                this.lastAI = state.attributes.ai_suggestion;
            }
        }
        this.updateUI();
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
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr;}
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .app-container.edit-mode .item-row { cursor: grab; }
        
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;}
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        .item-icon { color: var(--primary); }

        .folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 15px;
            padding: 5px;
            margin-bottom: 20px;
        }

        .folder-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            text-align: center;
        }

        .android-folder-icon {
            width: 56px; height: 56px;
            background: #3c4043; 
            border-radius: 16px; 
            display: flex; align-items: center; justify-content: center;
            color: #8ab4f8; 
            margin-bottom: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .android-folder-icon svg { width: 28px; height: 28px; }

        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
        }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); }
        
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }

        .item-details { font-size: 14px; }
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">הבית שלי</div><div class="sub-title" id="display-path">ראשי</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box" style="display:none;">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} גזור: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">הדבק</button></div>
        
        <div class="content" id="content"></div>
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <div class="cam-btn" id="add-cam-btn" style="width:45px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative"><input type="file" id="add-file" style="position:absolute;width:100%;height:100%;opacity:0"><span id="add-cam-icon">${ICONS.camera}</span></div>
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="שם..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">מיקום</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">פריט</button></div>
        </div>
      </div>
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('btn-up').onclick = () => this.navigate('up');
    root.getElementById('btn-home').onclick = () => this.navigate('root');
    root.getElementById('btn-shop').onclick = () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.notifyContext(); };
    root.getElementById('btn-search').onclick = () => { this.isSearch = true; this.isShopMode = false; this.render(); };
    root.getElementById('search-close').onclick = () => { this.isSearch = false; this.notifyContext(); };
    root.getElementById('search-input').oninput = (e) => this.notifyContext(e.target.value);
    root.getElementById('btn-edit').onclick = () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); };
    root.getElementById('add-file').onchange = (e) => this.handleFile(e);
    root.getElementById('btn-create-folder').onclick = () => this.addItem('folder');
    root.getElementById('btn-create-item').onclick = () => this.addItem('item');
    root.getElementById('btn-paste').onclick = () => this.pasteItem();
    root.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    
    const magicBtn = root.getElementById('btn-ai-magic');
    const searchAiBtn = root.getElementById('btn-ai-search');
    
    if(magicBtn) magicBtn.onclick = () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    };
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.1.3';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

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

            grouped[locName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, true));
            });
        });
        content.appendChild(listContainer);
        return;
    }

    if ((this.isSearch || attrs.path_display === 'Search Results') && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

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
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

        const grouped = {};
        if (attrs.folders) {
            attrs.folders.forEach(f => grouped[f.name] = []);
        }
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
            
            if (this.isEditMode) {
                header.ondragover = (e) => { e.preventDefault(); header.classList.add('drag-over'); };
                header.ondragleave = () => header.classList.remove('drag-over');
                header.ondrop = (e) => { e.preventDefault(); header.classList.remove('drag-over'); this.handleDrop(e, subName); };
            }

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <span>${subName}</span> 
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button>
                        <button class="edit-subloc-btn" style="color:var(--danger)" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
            } else {
                header.innerText = subName;
            }
            
            listContainer.appendChild(header);

            grouped[subName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        });

        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);

            outOfStock.forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        }
        
        content.appendChild(listContainer);
    }
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     if (this.isEditMode) {
         div.draggable = true;
         div.ondragstart = (e) => {
             e.dataTransfer.setData("text/plain", item.name);
             e.dataTransfer.effectAllowed = "move";
         };
     }

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

     const subText = isShopMode ? 
        `${item.main_location} > ${item.sub_location || ''}` : 
        `${item.date || ''}`;

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
         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn" style="background:var(--primary)" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">שמור</button>
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
         `;
         div.appendChild(details);
     }
     return div;
  }

  handleDrop(e, targetSubloc) {
      e.preventDefault();
      const itemName = e.dataTransfer.getData("text/plain");
      if (!itemName) return;
      
      // Calculate target path
      let targetPath = [...this.currentPath];
      
      // If we are dragging to "General", we effectively remove the last level (sublocation) if we were viewing a sublocation directly, 
      // BUT here we are inside a Main Location view where path = [Room, Main].
      // Items here usually have a 3rd level defining their sublocation.
      
      // The backend 'paste_item' expects the FULL path where the item should live.
      // If we are at [Room, Main], dropping to "Shelf 1" means the item should have path [Room, Main, Shelf 1].
      // If dragging to "General", it means path [Room, Main].
      
      if (targetSubloc !== "General") {
          targetPath.push(targetSubloc);
      }
      
      this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
      
      // Small delay to ensure cut is processed before paste
      setTimeout(() => {
          this.callHA('paste_item', {target_path: targetPath});
          
          // CRITICAL: Force refresh after paste to show the item in its new group
          setTimeout(() => {
              this.notifyContext(); 
          }, 300);
      }, 100);
  }

  deleteSubloc(name) {
      if(confirm(`Delete sublocation '${name}'? Items will move to 'General'.`)) {
          this.callHA('update_item_details', { original_name: name, new_name: "", new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  render() { this.updateUI(); }
  
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  
  updateQty(name, d) {
       this.callHA('update_qty', { item_name: name, change: d });
  }

  submitShopStock(name) {
      this.callHA('update_stock', { item_name: name, quantity: 1 });
  }

  notifyContext(query = "") {
    this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode });
  }

  addItem(type) {
    const name = this.shadowRoot.getElementById('add-name').value;
    const date = this.shadowRoot.getElementById('add-date').value;
    if (!name) return alert("שם חובה");
    this.callHA('add_item', { item_name: name, item_type: type, item_date: date, image_data: this.tempAddImage });
    this.shadowRoot.getElementById('add-name').value = ''; this.tempAddImage = null;
    this.shadowRoot.getElementById('add-cam-icon').innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename Sublocation:", oldName);
      if (newName && newName !== oldName) {
          this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
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
      const newName = this.shadowRoot.getElementById(`name-${idx}`).value;
      const newDate = this.shadowRoot.getElementById(`date-${idx}`).value;
      this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: newDate });
      this.expandedIdx = null;
  }
  
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this.callHA('delete_item', {item_name: name}); }
  showImg(src) { this.shadowRoot.getElementById('overlay-img').src = src; this.shadowRoot.getElementById('img-overlay').style.display = 'flex'; }

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);


    }
    
    const state = this._hass.states['sensor.organizer_view'];
    if (state && state.attributes) {
        if (state.attributes.ai_suggestion && state.attributes.ai_suggestion !== this.lastAI) {
            const input = this.shadowRoot.getElementById('add-name');
            if(input && document.activeElement !== input) {
                input.value = state.attributes.ai_suggestion;
                this.lastAI = state.attributes.ai_suggestion;
            }
        }
        this.updateUI();
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
        .nav-btn.active { color: var(--warning); }
        .nav-btn.shop-active { color: var(--accent); }
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr;}
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; }
        .app-container.edit-mode .item-row { cursor: grab; }
        
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer;}
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        .item-icon { color: var(--primary); }

        .folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 15px;
            padding: 5px;
            margin-bottom: 20px;
        }

        .folder-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            text-align: center;
        }

        .android-folder-icon {
            width: 56px; height: 56px;
            background: #3c4043; 
            border-radius: 16px; 
            display: flex; align-items: center; justify-content: center;
            color: #8ab4f8; 
            margin-bottom: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .android-folder-icon svg { width: 28px; height: 28px; }

        .folder-label { font-size: 12px; color: #e0e0e0; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
        }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); }
        
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }

        .item-details { font-size: 14px; }
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
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button><button class="nav-btn" id="btn-home">${ICONS.home}</button></div>
            <div class="title-box"><div class="main-title" id="display-title">הבית שלי</div><div class="sub-title" id="display-path">ראשי</div></div>
            <div style="display:flex;gap:5px"><button class="nav-btn" id="btn-shop">${ICONS.cart}</button><button class="nav-btn" id="btn-search">${ICONS.search}</button><button class="nav-btn" id="btn-edit">${ICONS.edit}</button></div>
        </div>
        
        <div class="search-box" id="search-box" style="display:none;">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button id="btn-ai-search" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.camera}</button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} גזור: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">הדבק</button></div>
        
        <div class="content" id="content"></div>
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <div class="cam-btn" id="add-cam-btn" style="width:45px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative"><input type="file" id="add-file" style="position:absolute;width:100%;height:100%;opacity:0"><span id="add-cam-icon">${ICONS.camera}</span></div>
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="שם..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">מיקום</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">פריט</button></div>
        </div>
      </div>
      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('btn-up').onclick = () => this.navigate('up');
    root.getElementById('btn-home').onclick = () => this.navigate('root');
    root.getElementById('btn-shop').onclick = () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.notifyContext(); };
    root.getElementById('btn-search').onclick = () => { this.isSearch = true; this.isShopMode = false; this.render(); };
    root.getElementById('search-close').onclick = () => { this.isSearch = false; this.notifyContext(); };
    root.getElementById('search-input').oninput = (e) => this.notifyContext(e.target.value);
    root.getElementById('btn-edit').onclick = () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); };
    root.getElementById('add-file').onchange = (e) => this.handleFile(e);
    root.getElementById('btn-create-folder').onclick = () => this.addItem('folder');
    root.getElementById('btn-create-item').onclick = () => this.addItem('item');
    root.getElementById('btn-paste').onclick = () => this.pasteItem();
    root.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    
    const magicBtn = root.getElementById('btn-ai-magic');
    const searchAiBtn = root.getElementById('btn-ai-search');
    
    if(magicBtn) magicBtn.onclick = () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    };
    
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
    const state = this._hass.states['sensor.organizer_view'];
    if (!state || !state.attributes) return;
    const attrs = state.attributes;
    const root = this.shadowRoot;
    
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.1.2';

    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

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

            grouped[locName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, true));
            });
        });
        content.appendChild(listContainer);
        return;
    }

    if ((this.isSearch || attrs.path_display === 'Search Results') && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

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
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';

        const inStock = [];
        const outOfStock = [];

        if (attrs.items) {
            attrs.items.forEach(item => {
                if (item.qty === 0) outOfStock.push(item);
                else inStock.push(item);
            });
        }

        const grouped = {};
        if (attrs.folders) {
            attrs.folders.forEach(f => grouped[f.name] = []);
        }
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
            
            if (this.isEditMode) {
                header.ondragover = (e) => { e.preventDefault(); header.classList.add('drag-over'); };
                header.ondragleave = () => header.classList.remove('drag-over');
                header.ondrop = (e) => { e.preventDefault(); header.classList.remove('drag-over'); this.handleDrop(e, subName); };
            }

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <span>${subName}</span> 
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="this.getRootNode().host.renameSubloc('${subName}')">${ICONS.edit}</button>
                        <button class="edit-subloc-btn" style="color:var(--danger)" onclick="this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
            } else {
                header.innerText = subName;
            }
            
            listContainer.appendChild(header);

            grouped[subName].forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        });

        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);

            outOfStock.forEach(item => {
                listContainer.appendChild(this.createItemRow(item, false));
            });
        }
        
        content.appendChild(listContainer);
    }
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
     if (this.isEditMode) {
         div.draggable = true;
         div.ondragstart = (e) => {
             e.dataTransfer.setData("text/plain", item.name);
             e.dataTransfer.effectAllowed = "move";
         };
     }

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

     const subText = isShopMode ? 
        `${item.main_location} > ${item.sub_location || ''}` : 
        `${item.date || ''}`;

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
         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn" style="background:var(--primary)" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">שמור</button>
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
         `;
         div.appendChild(details);
     }
     return div;
  }

  handleDrop(e, targetSubloc) {
      e.preventDefault();
      const itemName = e.dataTransfer.getData("text/plain");
      if (!itemName) return;
      
      let targetPath = [...this.currentPath];
      
      // If dropping on "General", we stay in currentPath (removing subloc)
      // If dropping on specific subloc, we append it
      if (targetSubloc !== "General") {
          targetPath.push(targetSubloc);
      }
      
      this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
      setTimeout(() => {
          this.callHA('paste_item', {target_path: targetPath});
          setTimeout(() => this.notifyContext(), 300);
      }, 100);
  }

  deleteSubloc(name) {
      if(confirm(`Delete sublocation '${name}'? Items will move to 'General'.`)) {
          this.callHA('update_item_details', { original_name: name, new_name: "", new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
      }
  }

  render() { this.updateUI(); }
  
  navigate(dir, name) { this.callHA('navigate', {direction: dir, name: name}); }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  
  updateQty(name, d) {
       this.callHA('update_qty', { item_name: name, change: d });
  }

  submitShopStock(name) {
      this.callHA('update_stock', { item_name: name, quantity: 1 });
  }

  notifyContext(query = "") {
    this.callHA('set_view_context', { path: this.currentPath, search_query: query, date_filter: 'All', shopping_mode: this.isShopMode });
  }

  addItem(type) {
    const name = this.shadowRoot.getElementById('add-name').value;
    const date = this.shadowRoot.getElementById('add-date').value;
    if (!name) return alert("שם חובה");
    this.callHA('add_item', { item_name: name, item_type: type, item_date: date, image_data: this.tempAddImage });
    this.shadowRoot.getElementById('add-name').value = ''; this.tempAddImage = null;
    this.shadowRoot.getElementById('add-cam-icon').innerHTML = ICONS.camera;
  }
  
  renameSubloc(oldName) {
      const newName = prompt("Rename Sublocation:", oldName);
      if (newName && newName !== oldName) {
          this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: "" });
          setTimeout(() => this.notifyContext(), 300);
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
      const newName = this.shadowRoot.getElementById(`name-${idx}`).value;
      const newDate = this.shadowRoot.getElementById(`date-${idx}`).value;
      this.callHA('update_item_details', { original_name: oldName, new_name: newName, new_date: newDate });
      this.expandedIdx = null;
  }
  
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this.callHA('delete_item', {item_name: name}); }
  showImg(src) { this.shadowRoot.getElementById('overlay-img').src = src; this.shadowRoot.getElementById('img-overlay').style.display = 'flex'; }

  callHA(service, data) { this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);












