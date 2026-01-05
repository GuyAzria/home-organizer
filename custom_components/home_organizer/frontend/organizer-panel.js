// Home Organizer Ultimate - ver 2.0.3
// Written by Guy Azaria with AI help
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
  place: `<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  folder_add: `<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/></svg>`,
  item_add: `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
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
    
    // AI Listeners
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
    
    // Toggle AI Buttons Visibility based on Config
    const useAI = attrs.use_ai; 
    const aiMagicBtn = root.getElementById('btn-ai-magic');
    const aiSearchBtn = root.getElementById('btn-ai-search');
    
    if(aiMagicBtn) aiMagicBtn.style.display = useAI ? 'block' : 'none';
    if(aiSearchBtn) aiSearchBtn.style.display = useAI ? 'block' : 'none';

    // Update Titles
    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '2.0.3';

    // Show/Hide Areas
    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    
    const app = root.getElementById('app');
    if(this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    // Render List
    const content = root.getElementById('content');
    content.innerHTML = '';
    
    let list = [];
    if (attrs.shopping_list && attrs.shopping_list.length > 0) list = attrs.shopping_list;
    else if ((this.isSearch || attrs.path_display === 'Search Results') && attrs.items) list = attrs.items;
    else {
        // Browse Mode
        if (attrs.folders) attrs.folders.forEach(f => list.push({...f, type:'folder'}));
        if (attrs.items) attrs.items.forEach(i => list.push({...i, type:'item'}));
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''}`;
        
        if (item.type === 'folder') {
             div.innerHTML = `
                <div class="item-main" onclick="this.getRootNode().host.navigate('down', '${item.name}')">
                    <div class="item-left"><span class="item-icon">${ICONS.folder}</span><span>${item.name}</span></div>
                    <span>${ICONS.arrow_up}</span>
                </div>`;
        } else {
             // Item Row
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
             
             // Expanded Details
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
