// Home Organizer Ultimate - Ver 3.3.0 (Item Image Icons)
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
  image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24"><path d="M9 9l1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5zM19 19l-2.5-1 2.5-1 1-2.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
  wand: '<svg viewBox="0 0 24 24"><path d="M7.5 5.6L10 7 7.5 8.4 6.1 10.9 4.7 8.4 2.2 7 4.7 5.6 6.1 3.1 7.5 5.6zm12 9.8L17 14l2.5-1.4L18.1 10.1 19.5 12.6 22 14 19.5 15.4 18.1 17.9 17 15.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zm-8.8 11.2l-1.4-2.5L10.4 13.2 8 14.6 10.4 16 11.8 18.5 13.2 16 15.6 14.6 13.2 13.2z"/></svg>'
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
      this.pendingItem = null;
      
      this.useAiBg = true; 

      this.initUI();
      
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
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; position: relative; }
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; }
        .folder-delete-btn { position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .item-list { display: flex; flex-direction: column; gap: 5px; }
        .group-separator { color: #aaa; font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #444; padding-bottom: 4px; text-transform: uppercase; font-weight: bold; display: flex; justify-content: space-between; align-items: center; min-height: 35px; }
        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; touch-action: pan-y; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; cursor: default; }
        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; }
        .item-left { display: flex; align-items: center; gap: 10px; }
        
        /* Updated Icon Styling for Thumbnail */
        .item-icon { color: var(--primary); display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; overflow: hidden; }
        .item-thumbnail { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; background: #fff; display: block; }
        
        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .bottom-bar { background: #242426; padding: 15px; border-top: 1px solid var(--border); display: none; }
        .edit-mode .bottom-bar { display: block; }
        .expanded-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #555; display: flex; flex-direction: column; gap: 10px; }
        .detail-row { display: flex; gap: 10px; align-items: center; }
        .action-btn { flex: 1; padding: 8px; border-radius: 6px; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .img-preview { width: 50px; height: 50px; border-radius: 4px; object-fit: cover; background: #333; }
        .search-box { display:none; padding:10px; background:#2a2a2a; display:flex; gap: 5px; align-items: center; }
        .ai-btn { color: #FFD700 !important; }
        
        /* CAMERA OVERLAY STYLES */
        #camera-modal {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: black; z-index: 2000; display: none;
            flex-direction: column; align-items: center; justify-content: center;
        }
        #camera-video { width: 100%; height: 80%; object-fit: cover; }
        .camera-controls {
            height: 20%; width: 100%; display: flex; 
            align-items: center; justify-content: center; gap: 30px;
            background: rgba(0,0,0,0.5); position: absolute; bottom: 0;
        }
        .snap-btn {
            width: 70px; height: 70px; border-radius: 50%;
            background: white; border: 5px solid #ccc;
            cursor: pointer;
        }
        .snap-btn.white-bg-active { background: #e3f2fd; border-color: var(--primary); }
        .close-cam-btn {
            color: white; background: none; border: none; font-size: 16px; cursor: pointer;
        }
        /* AI Background Toggle Button */
        .wb-btn {
            color: #aaa; background: none; border: 2px solid #555; border-radius: 50%; width: 50px; height: 50px;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            flex-direction: column; font-size: 10px;
        }
        .wb-btn.active { color: #333; background: white; border-color: white; }
        .wb-btn svg { width: 24px; height: 24px; margin-bottom: 2px; }
        
        #camera-canvas { display: none; }
      </style>
      
      <!-- MAIN APP UI -->
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
        
        <div class="bottom-bar" id="add-area">
             <div style="display:flex;gap:10px;margin-bottom:10px">
                <!-- IN-APP CAMERA BUTTON (Main) -->
                <button class="action-btn" id="btn-open-cam" style="background:#333;width:45px;height:45px;padding:0;display:flex;align-items:center;justify-content:center">
                   ${ICONS.camera}
                </button>
                
                <div style="flex:1; display:flex; position:relative;">
                    <input type="text" id="add-name" placeholder="Name..." style="width:100%;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                    <button id="btn-ai-magic" class="nav-btn ai-btn" style="position:absolute;left:0;top:0;height:100%;border:none;background:none;display:none;">${ICONS.sparkles}</button>
                </div>
                <input type="date" id="add-date" style="width:110px;padding:10px;border-radius:8px;background:#111;color:white;border:1px solid #333">
             </div>
             <div style="display:flex;gap:10px"><button id="btn-create-folder" style="flex:1;padding:12px;background:#03a9f4;color:white;border:none;border-radius:8px">Location</button><button id="btn-create-item" style="flex:1;padding:12px;background:#4caf50;color:white;border:none;border-radius:8px">Item</button></div>
        </div>
      </div>
      
      <!-- CUSTOM IN-APP CAMERA OVERLAY -->
      <div id="camera-modal">
          <video id="camera-video" autoplay playsinline muted></video>
          <div class="camera-controls">
              <!-- Switch Cam -->
              <button class="close-cam-btn" id="btn-cam-switch">${ICONS.refresh}</button>
              
              <!-- Snap Button -->
              <button class="snap-btn" id="btn-cam-snap"></button>
              
              <!-- AI BG Toggle (Renamed to AI BG) -->
              <button class="wb-btn active" id="btn-cam-wb" title="Toggle AI Background Removal">
                  ${ICONS.wand}
                  <span>AI BG</span>
              </button>
              
              <!-- Close -->
              <button class="close-cam-btn" id="btn-cam-close" style="position:absolute;top:-50px;right:20px;background:rgba(0,0,0,0.5);border-radius:50%;width:40px;height:40px">✕</button>
          </div>
          <canvas id="camera-canvas"></canvas>
      </div>

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;border-radius:8px"></div>
    `;

    // Secure Context Warning
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
         console.warn("Camera access requires HTTPS.");
    }

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const bind = (id, event, fn) => { const el = root.getElementById(id); if(el) el[event] = fn; };
    const click = (id, fn) => bind(id, 'onclick', fn);

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.isSearch = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.fetchData(); });
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    bind('search-input', 'oninput', (e) => this.fetchData());
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    // Add logic
    click('btn-create-folder', () => this.addItem('folder'));
    click('btn-create-item', () => this.addItem('item'));
    click('btn-paste', () => this.pasteItem());
    const dateIn = root.getElementById('add-date');
    if(dateIn) dateIn.value = new Date().toISOString().split('T')[0];
    
    // --- CAMERA LOGIC BINDINGS ---
    click('btn-open-cam', () => this.openCamera(null)); // New Item
    click('btn-ai-search', () => this.openCamera('search')); // Search AI
    click('btn-ai-magic', () => {
         if (!this.tempAddImage) return alert("Take a picture first!");
         this.callHA('ai_action', { mode: 'identify', image_data: this.tempAddImage });
    });

    // Camera Modal Buttons
    click('btn-cam-close', () => this.stopCamera());
    click('btn-cam-snap', () => this.snapPhoto());
    click('btn-cam-switch', () => this.switchCamera());
    click('btn-cam-wb', () => this.toggleWhiteBG());
  }
  
  toggleWhiteBG() {
      this.useAiBg = !this.useAiBg;
      const btn = this.shadowRoot.getElementById('btn-cam-wb');
      if (this.useAiBg) btn.classList.add('active'); else btn.classList.remove('active');
  }

  // --- CUSTOM CAMERA IMPLEMENTATION ---
  async openCamera(context) {
      this.cameraContext = context;
      const modal = this.shadowRoot.getElementById('camera-modal');
      const video = this.shadowRoot.getElementById('camera-video');
      modal.style.display = 'flex';
      
      try {
          this.stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: this.facingMode || "environment" } 
          });
          video.srcObject = this.stream;
      } catch (err) {
          alert("Camera Error: " + err.message + "\nEnsure HTTPS is used.");
          modal.style.display = 'none';
      }
  }

  stopCamera() {
      const modal = this.shadowRoot.getElementById('camera-modal');
      const video = this.shadowRoot.getElementById('camera-video');
      if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
      }
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
      
      // AI BACKGROUND REMOVAL (Simulated via White Threshold)
      if (this.useAiBg) {
          let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          let data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
              let r = data[i], g = data[i+1], b = data[i+2];
              if (r > 190 && g > 190 && b > 190) { // Threshold for "dirty white" background
                  data[i] = 255; data[i+1] = 255; data[i+2] = 255;
              }
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
      } else {
          this.tempAddImage = dataUrl;
          const ic = this.shadowRoot.getElementById('add-cam-icon');
          if(ic) ic.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
      }
  }

  // --- EXISTING LOGIC ---

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    
    root.getElementById('display-title').innerText = attrs.path_display;
    root.getElementById('display-path').innerText = attrs.app_version || '3.3.0';
    
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
        if (attrs.folders && attrs.folders.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'folder-grid';
            attrs.folders.forEach(folder => {
                const el = document.createElement('div');
                el.className = 'folder-item';
                
                el.onclick = () => this.navigate('down', folder.name);
                
                const deleteBtnHtml = this.isEditMode 
                    ? `<div class="folder-delete-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteFolder('${folder.name}')">✕</div>` 
                    : '';

                el.innerHTML = `
                    <div class="android-folder-icon">
                        ${ICONS.folder}
                        ${deleteBtnHtml}
                    </div>
                    <div class="folder-label">${folder.name}</div>
                `;
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

  setupDragSource(el, itemName) {
      el.draggable = true;
      el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", itemName); e.dataTransfer.effectAllowed = "move"; el.classList.add('dragging'); };
      el.ondragend = () => el.classList.remove('dragging');

      let longPressTimer;
      el.addEventListener('touchstart', (e) => {
          longPressTimer = setTimeout(() => {
              el.classList.add('dragging');
              this.draggedItemName = itemName;
              this.isDragging = true;
              if (navigator.vibrate) navigator.vibrate(50);
          }, 500); 
      }, {passive: false});

      el.addEventListener('touchmove', (e) => {
          if (this.isDragging) {
              e.preventDefault();
              const touch = e.touches[0];
              const realTarget = this.shadowRoot.elementFromPoint(touch.clientX, touch.clientY) || document.elementFromPoint(touch.clientX, touch.clientY);
              const header = realTarget?.closest('.group-separator');
              
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
              const realTarget = this.shadowRoot.elementFromPoint(touch.clientX, touch.clientY) || document.elementFromPoint(touch.clientX, touch.clientY);
              const header = realTarget?.closest('.group-separator');
              
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
      el.dataset.subloc = subName;
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
      } catch (err) { console.error("Drop failed:", err); }
  }

  triggerCameraEdit(itemName) {
      this.pendingItem = itemName;
      this.openCamera('update');
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     
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
     
     // ITEM ICON: Render Image if available, else SVG
     let iconHtml = `<span class="item-icon">${ICONS.item}</span>`;
     if (item.img) {
         iconHtml = `<img src="${item.img}" class="item-thumbnail" alt="${item.name}">`;
     }

     div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.name}')">
            <div class="item-left">
                ${iconHtml}
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
         
         let moveOptions = "";
         if(this.localData.folders) {
             this.localData.folders.forEach(f => {
                 moveOptions += `<button class="action-btn" style="background:#444;margin-top:5px" onclick="this.getRootNode().host.handleDropAction('${f.name}', '${item.name}')">Move to ${f.name}</button>`;
             });
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
                    
                    <div style="position:absolute;bottom:-25px;left:0;display:flex;gap:5px;z-index:3;">
                       <!-- IN-APP CAMERA BUTTON (EDIT) -->
                       <button class="action-btn" style="background:#444;padding:4px;cursor:pointer" onclick="this.getRootNode().host.triggerCameraEdit('${item.name}')">
                          ${ICONS.camera}
                       </button>
                    </div>
                 </div>
                 <div style="display:flex;gap:5px">
                    <button class="action-btn" style="background:#555" onclick="this.getRootNode().host.cut('${item.name}')">${ICONS.cut}</button>
                    <button class="action-btn" style="background:var(--danger)" onclick="this.getRootNode().host.del('${item.name}')">${ICONS.delete}</button>
                 </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;border-top:1px solid #444;padding-top:5px;margin-top:25px">
                ${moveOptions}
            </div>
         `;
         div.appendChild(details);
     }
     return div;
  }

  deleteFolder(name) {
      if(confirm(`Delete folder '${name}' and ALL items inside it?`)) {
          this._hass.callService('home_organizer', 'delete_item', {
              item_name: name,
              current_path: this.currentPath,
              is_folder: true
          });
      }
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
      this.fetchData();
  }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  submitShopStock(name) { this.callHA('update_stock', { item_name: name, quantity: 1 }); }
  
  addItem(type) {
    const nEl = this.shadowRoot.getElementById('add-name');
    const dEl = this.shadowRoot.getElementById('add-date');
    if (!nEl || !nEl.value) return alert("Name required");
    this._hass.callService('home_organizer', 'add_item', { 
        item_name: nEl.value, item_type: type, item_date: dEl.value, image_data: this.tempAddImage, 
        current_path: this.currentPath 
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

  handleFile(e) { }
  handleUpdateImage(input, name) {
    const file = input.files[0]; if (!file) return;
    this.compressImage(file, (dataUrl) => {
        this.callHA('update_image', { item_name: name, image_data: dataUrl });
    });
    input.value = '';
  }

  // Compression & Utils
  compressImage(file, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX = 1024;
              let w = img.width, h = img.height;
              if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } }
              else { if (h > MAX) { w *= MAX/h; h = MAX; } }
              canvas.width = w; canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              callback(canvas.toDataURL('image/jpeg', 0.5));
          };
          img.src = e.target.result;
      };
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
  del(name) { 
      this._hass.callService('home_organizer', 'delete_item', {
          item_name: name, 
          current_path: this.currentPath,
          is_folder: false
      }); 
  }
  
  showImg(src) { 
      const ov = this.shadowRoot.getElementById('overlay-img');
      const ovc = this.shadowRoot.getElementById('img-overlay');
      if(ov && ovc) { ov.src = src; ovc.style.display = 'flex'; }
  }

  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}
customElements.define('home-organizer-panel', HomeOrganizerPanel);
