// Home Organizer Ultimate - Ver 5.6.8 (Grid View Update)
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
      this.viewMode = 'list'; // New state: 'list' or 'grid'
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
        
        /* --- Top Bar & Sub Bar Styles --- */
        .top-bar { background: #242426; padding: 10px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; height: 60px; position: relative; }
        
        /* Sub-bar: 50% smaller height (30px), Flex layout for Left/Right alignment */
        .sub-bar { background: #2a2a2c; height: 30px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        
        .sub-bar-left { display: flex; align-items: center; }
        .sub-bar-right { display: flex; align-items: center; gap: 10px; }

        .nav-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .nav-btn:hover { background: rgba(255,255,255,0.1); }
        .nav-btn.active { color: var(--warning); }
        .nav-btn.edit-active { color: var(--accent); } 
        
        /* Smaller buttons for sub-bar */
        .sub-bar .nav-btn { padding: 4px; }
        .sub-bar .nav-btn svg { width: 20px; height: 20px; }

        /* Setup Dropdown */
        .setup-wrapper { position: relative; display: flex; align-items: center; }
        .setup-dropdown { 
            position: absolute; top: 50px; right: 0; background: #2c2c2e; border: 1px solid var(--border); 
            border-radius: 8px; display: none; flex-direction: column; min-width: 160px; z-index: 3000;
            box-shadow: 0 8px 16px rgba(0,0,0,0.5); overflow: hidden;
        }
        .setup-dropdown.show { display: flex; }
        .dropdown-item { padding: 12px 15px; cursor: pointer; color: white; font-size: 14px; text-align: right; border-bottom: 1px solid #333; }
        .dropdown-item:hover { background: var(--primary); }
        .dropdown-item:last-child { border-bottom: none; }

        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        /* --- Folders & Grid --- */
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; position: relative; }
        
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; overflow: visible; }
        .android-folder-icon svg { width: 34px; height: 34px; }
        .android-folder-icon img { width: 38px; height: 38px; object-fit: contain; border-radius: 4px; }
        
        /* Folder Action Buttons */
        .folder-delete-btn { position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-edit-btn { position: absolute; top: -5px; left: -5px; background: var(--primary); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-edit-btn svg { width: 12px; height: 12px; }
        .folder-img-btn { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); background: #ff9800; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-img-btn svg { width: 12px; height: 12px; }

        /* --- List View Styles --- */
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
        
        /* --- NEW XL GRID STYLES --- */
        .xl-grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 10px; }
        .xl-card { 
            background: #2c2c2e; border-radius: 12px; padding: 10px; 
            display: flex; flex-direction: column; align-items: center; justify-content: space-between;
            aspect-ratio: 1; position: relative; border: 1px solid transparent;
        }
        .xl-card:hover { background: #3a3a3c; }
        .xl-icon-area { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; overflow: hidden; }
        .xl-icon-area svg { width: 48px; height: 48px; color: var(--primary); }
        .xl-icon-area img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
        .xl-badge { 
            position: absolute; top: 8px; right: 8px; 
            background: rgba(0,0,0,0.6); color: white; border: 1px solid #555;
            min-width: 24px; height: 24px; border-radius: 12px; 
            display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; 
        }
        .xl-info { width: 100%; text-align: center; margin-top: 8px; }
        .xl-name { font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        .xl-date { font-size: 10px; color: #888; margin-top: 2px; }

        /* --- Editing & Inputs --- */
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
        
        /* --- Modals --- */
        #icon-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2500; display: none; align-items: center; justify-content: center; flex-direction: column; }
        .modal-content { background: #242426; width: 95%; max-width: 450px; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 15px; max-height: 90vh; overflow-y: auto; }
        .modal-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 5px; }
        
        .category-bar { display: none; gap: 10px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 10px; scrollbar-width: thin; scrollbar-color: var(--warning) transparent; }
        .category-bar::-webkit-scrollbar { height: 4px; }
        .category-bar::-webkit-scrollbar-thumb { background: var(--warning); border-radius: 2px; }
        .cat-btn { min-width: 65px; height: 65px; background: #333; border: 2px solid var(--warning); border-radius: 8px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; text-align: center; padding: 5px; flex-shrink: 0; transition: all 0.2s; }
        .cat-btn.active { background: var(--warning); color: #000; font-weight: bold; }
        .cat-btn svg { width: 24px; height: 24px; margin-bottom: 4px; }

        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px; min-height: 200px; }
        .lib-icon { background: #333; border-radius: 8px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; }
        .lib-icon:hover { background: #444; }
        .lib-icon svg { width: 32px; height: 32px; fill: #ccc; }
        .lib-icon span { font-size: 10px; color: #888; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 50px; text-align: center; }
        
        .pagination-ctrls { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 10px 0; border-top: 1px solid #444; }
        .page-btn { background: #444; color: white; border: none; border-radius: 4px; padding: 5px 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-info { font-size: 12px; color: #aaa; }

        .url-input-row { display: flex; gap: 10px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; }
        
        #camera-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 2000; display: none; flex-direction: column; align-items: center; justify-content: center; }
        #camera-video { width: 100%; height: 80%; object-fit: cover; }
        .camera-controls { height: 20%; width: 100%; display: flex; align-items: center; justify-content: center; gap: 30px; background: rgba(0,0,0,0.5); position: absolute; bottom: 0; }
        .snap-btn { width: 70px; height: 70px; border-radius: 50%; background: white; border: 5px solid #ccc; cursor: pointer; }
        .snap-btn.white-bg-active { background: #e3f2fd; border-color: var(--primary); }
        .close-cam-btn { color: white; background: none; border: none; font-size: 16px; cursor: pointer; }
        .wb-btn { color: #aaa; background: none; border: 2px solid #555; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-direction: column; font-size: 10px; }
        .wb-btn.active { color: #333; background: white; border-color: white; }
        .wb-btn svg { width: 24px; height: 24px; margin-bottom: 2px; }
        #camera-canvas { display: none; }
        .overlay { display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center }
      </style>
      
      <div class="app-container" id="app">
        <!-- Main Top Bar (60px) -->
        <div class="top-bar">
            <div class="setup-wrapper">
                <button class="nav-btn" id="btn-user-setup">
                    <svg viewBox="0 0 24 24"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.35 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.47,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.53,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.35 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.53,18.67 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.47,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" /></svg>
                </button>
                <div class="setup-dropdown" id="setup-dropdown-menu">
                    <div class="dropdown-item" onclick="this.getRootNode().host.changeLanguage('he')">עברית (Hebrew)</div>
                    <div class="dropdown-item" onclick="this.getRootNode().host.changeLanguage('en')">English</div>
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

        <!-- Sub-Bar (30px) -->
        <div class="sub-bar">
            <div class="sub-bar-left">
                <!-- View Toggle Button (Hidden unless depth >= 2) -->
                <button class="nav-btn" id="btn-view-toggle" style="display:none;">
                   <svg id="icon-view-grid" viewBox="0 0 24 24" style="display:block"><path d="M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3"/></svg>
                   <svg id="icon-view-list" viewBox="0 0 24 24" style="display:none"><path d="M3,4H21V6H3M3,8H21V10H3M3,12H21V14H3M3,16H21V18H3M3,20H21V22H3"/></svg>
                </button>
            </div>
            <div class="sub-bar-right">
                <button class="nav-btn" id="btn-home">${ICONS.home}</button>
                <button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button>
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
      
      <!-- Icon Modal -->
      <div id="icon-modal" onclick="this.style.display='none'">
          <div class="modal-content" onclick="event.stopPropagation()">
              <div class="modal-title">Change Icon</div>
              <div class="category-bar" id="picker-categories"></div>
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
              <div style="text-align:center; margin-top:10px;">
                  <label class="action-btn" style="width:100%; display:flex; gap:10px; justify-content:center;">
                      ${ICONS.image} Upload File
                      <input type="file" id="icon-file-upload" accept="image/*" style="display:none">
                  </label>
              </div>
              <button class="action-btn" style="width:100%;margin-top:10px;background:#444" onclick="this.closest('#icon-modal').style.display='none'">Cancel</button>
          </div>
      </div>
      
      <!-- Camera Modal -->
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

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'"><img id="overlay-img" style="max-width:90%;max-height:90%;border-radius:8px"></div>
    `;

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          console.warn("Camera access requires HTTPS.");
    }

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const bind = (id, event, fn) => { const el = root.getElementById(id); if(el) el[event] = fn; };
    const click = (id, fn) => bind(id, 'onclick', fn);

    // Setup Dropdown Toggle
    click('btn-user-setup', (e) => {
        e.stopPropagation();
        const menu = root.getElementById('setup-dropdown-menu');
        menu.classList.toggle('show');
    });

    // Close dropdown on outside click
    window.addEventListener('click', () => {
        root.getElementById('setup-dropdown-menu')?.classList.remove('show');
    });

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.isSearch = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.fetchData(); });
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    bind('search-input', 'oninput', (e) => this.fetchData());
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    // View Toggle
    click('btn-view-toggle', () => {
        this.viewMode = (this.viewMode === 'list') ? 'grid' : 'list';
        const gridIcon = root.getElementById('icon-view-grid');
        const listIcon = root.getElementById('icon-view-list');
        if (this.viewMode === 'grid') {
            gridIcon.style.display = 'none';
            listIcon.style.display = 'block';
        } else {
            gridIcon.style.display = 'block';
            listIcon.style.display = 'none';
        }
        this.render();
    });

    click('btn-paste', () => this.pasteItem());
    click('btn-load-url', () => {
        const url = root.getElementById('icon-url-input').value;
        if(url) this.handleUrlIcon(url);
    });
    bind('icon-file-upload', 'onchange', (e) => this.handleIconUpload(e.target));
    
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

  changeLanguage(lang) {
      console.log("Language change requested:", lang);
      this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
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

    // SHOW/HIDE VIEW BUTTON based on depth
    const viewBtn = root.getElementById('btn-view-toggle');
    if (attrs.depth >= 2) viewBtn.style.display = 'block'; else viewBtn.style.display = 'none';

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
        
        if (this.isEditMode && attrs.depth === 1) {
             const addBtn = document.createElement('div');
             addBtn.className = 'add-item-btn-row';
             addBtn.innerHTML = `<button class="add-item-btn" onclick="this.getRootNode().host.addQuickItem()">+ הוסף</button>`;
             content.appendChild(addBtn);
        }
    } else {
        // LOCATION LEVEL (Depth 2+)
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
            const items = grouped[subName];
            const count = items.length;

            if (subName === "General" && count === 0 && !this.isEditMode) return;
            // Requirement: Hide empty in grid
            if (this.viewMode === 'grid' && count === 0) return;

            // Requirement: Show all open in grid
            const isExpanded = (this.viewMode === 'grid') ? true : this.expandedSublocs.has(subName);
            
            const icon = isExpanded ? ICONS.chevron_down : ICONS.chevron_right;
            const countBadge = `<span style="font-size:12px; background:#444; padding:2px 6px; border-radius:10px; margin-left:8px;">${count}</span>`;
            
            const header = document.createElement('div');
            header.className = 'group-separator';
            this.setupDropTarget(header, subName);
            
            // Only toggle in list mode
            if (this.viewMode === 'list') {
                header.onclick = () => this.toggleSubloc(subName);
            } else {
                header.style.cursor = 'default';
            }
            
            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <div style="display:flex;align-items:center;">
                        <span style="margin-right:5px;display:flex;align-items:center">${icon}</span>
                        <span class="subloc-title">${subName}</span>
                        ${countBadge}
                    </div>
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableSublocRename(this, '${subName}')">${ICONS.edit}</button>
                        <button class="delete-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
            } else {
                header.innerHTML = `<div style="display:flex;align-items:center;"><span style="margin-right:5px;display:flex;align-items:center">${icon}</span><span>${subName}</span>${countBadge}</div>`;
            }
            listContainer.appendChild(header);

            if (isExpanded) {
                // RENDER GRID OR LIST BASED ON VIEW MODE
                if (this.viewMode === 'grid' && count > 0) {
                     const gridDiv = document.createElement('div');
                     gridDiv.className = 'xl-grid-container';
                     items.forEach(item => {
                         const card = document.createElement('div');
                         card.className = 'xl-card';
                         card.onclick = () => { 
                             // Clicking grid item returns to list view and expands item
                             this.viewMode = 'list';
                             this.expandedIdx = item.name;
                             this.render();
                         };
                         
                         let iconHtml = ICONS.item;
                         if (item.img) iconHtml = `<img src="${item.img}">`;
                         
                         card.innerHTML = `
                             <div class="xl-icon-area">${iconHtml}</div>
                             <div class="xl-badge">${item.qty}</div>
                             <div class="xl-info">
                                 <div class="xl-name">${item.name}</div>
                                 <div class="xl-date">${item.date || ''}</div>
                             </div>
                         `;
                         gridDiv.appendChild(card);
                     });
                     listContainer.appendChild(gridDiv);
                } else {
                    items.forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
                }

                if (this.isEditMode) {
                     const addRow = document.createElement('div');
                     addRow.className = "group-add-row";
                     addRow.innerHTML = `<button class="text-add-btn" onclick="this.getRootNode().host.addQuickItem('${subName}')">${ICONS.plus} הוסף</button>`;
                     listContainer.appendChild(addRow);
                }
            }
        });
        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);
            outOfStock.forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
        }
        if (this.isEditMode) {
            const gridContainer = document.createElement('div');
            gridContainer.className = 'folder-grid';
            gridContainer.style.marginTop = '20px';
            const addBtn = document.createElement('div');
            addBtn.className = 'folder-item add-folder-card';
            addBtn.innerHTML = `<div class="android-folder-icon" id="add-subloc-icon">${ICONS.plus}</div><div class="folder-label">Add Sub</div>`;
            addBtn.onclick = (e) => this.enableFolderInput(e.currentTarget);
            gridContainer.appendChild(addBtn);
            listContainer.appendChild(gridContainer);
        }
        content.appendChild(listContainer);
    }
  }
  
  toggleSubloc(name) {
      if (this.expandedSublocs.has(name)) this.expandedSublocs.delete(name); else this.expandedSublocs.add(name);
      this.render();
  }
  
  enableFolderInput(cardEl) {
      const iconContainer = cardEl.querySelector('.android-folder-icon');
      const label = cardEl.querySelector('.folder-label');
      if(iconContainer.querySelector('input')) return;
      iconContainer.innerHTML = `<input type="text" class="add-folder-input" placeholder="Name">`;
      const input = iconContainer.querySelector('input');
      label.innerText = "Saving...";
      input.focus();
      input.onkeydown = (e) => { if (e.key === 'Enter') this.saveNewFolder(input.value); };
      input.onblur = () => { if (input.value.trim()) this.saveNewFolder(input.value); else this.render(); };
  }
  
  enableFolderRename(labelEl, oldName) {
      if (!labelEl || labelEl.querySelector('input')) return;
      const input = document.createElement('input');
      input.value = oldName;
      input.style.width = '100%';
      input.style.background = '#222';
      input.style.color = 'white';
      input.style.border = '1px solid var(--primary)';
      input.style.borderRadius = '4px';
      input.style.textAlign = 'center';
      input.style.fontSize = '12px';
      input.onclick = (e) => e.stopPropagation();
      labelEl.innerHTML = '';
      labelEl.appendChild(input);
      input.focus();
      let isSaving = false;
      const save = () => {
          if (isSaving) return; 
          isSaving = true;
          const newVal = input.value.trim();
          if (newVal && newVal !== oldName) {
              this.callHA('update_item_details', { original_name: oldName, new_name: newVal, new_date: "", current_path: this.currentPath, is_folder: true });
          } else this.render();
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
      input.onblur = () => save();
  }

  saveNewFolder(name) {
      if(!name) return;
      this._hass.callService('home_organizer', 'add_item', { item_name: name, item_type: 'folder', item_date: '', image_data: null, current_path: this.currentPath });
  }

  addQuickItem(targetSubloc) {
      const tempName = "New Item " + new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
      const today = new Date().toISOString().split('T')[0];
      let usePath = [...this.currentPath];
      if (targetSubloc && targetSubloc !== "General") usePath.push(targetSubloc);
      this._hass.callService('home_organizer', 'add_item', { item_name: tempName, item_type: 'item', item_date: today, image_data: null, current_path: usePath });
  }

  setupDragSource(el, itemName) {
      el.draggable = true;
      el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", itemName); e.dataTransfer.effectAllowed = "move"; el.classList.add('dragging'); };
      el.ondragend = () => el.classList.remove('dragging');
  }

  setupDropTarget(el, subName) {
      el.dataset.subloc = subName;
      el.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); };
      el.ondragleave = () => el.classList.remove('drag-over');
      el.ondrop = (e) => { e.preventDefault(); el.classList.remove('drag-over'); const itemName = e.dataTransfer.getData("text/plain"); this.handleDropAction(subName, itemName); };
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

  triggerCameraEdit(itemName) { this.pendingItem = itemName; this.openCamera('update'); }
  adjustShopQty(name, delta) {
      if (this.shopQuantities[name] === undefined) this.shopQuantities[name] = 0;
      this.shopQuantities[name] = Math.max(0, this.shopQuantities[name] + delta);
      this.render();
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     this.setupDragSource(div, item.name);
     
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
     let iconHtml = `<span class="item-icon">${ICONS.item}</span>`;
     if (item.img) iconHtml = `<img src="${item.img}" class="item-thumbnail" alt="${item.name}" onclick="event.stopPropagation(); this.getRootNode().host.showImg('${item.img}')">`;

     div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.name}')">
            <div class="item-left">${iconHtml}<div><div>${item.name}</div><div class="sub-title">${subText}</div></div></div>
            <div class="item-qty-ctrl">${controls}</div>
        </div>
     `;
     
     if (this.expandedIdx === item.name) {
         const details = document.createElement('div');
         details.className = 'expanded-details';
         let roomOptions = `<option value="">-- Change Room --</option>`;
         if(this.localData.hierarchy) Object.keys(this.localData.hierarchy).forEach(room => { roomOptions += `<option value="${room}">${room}</option>`; });

         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn btn-text" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">Save</button>
            </div>
            <div class="detail-row" style="justify-content:space-between; margin-top:10px;">
                 <div style="display:flex;gap:10px;">
                    <button class="action-btn" title="Take Photo" onclick="this.getRootNode().host.triggerCameraEdit('${item.name}')">${ICONS.camera}</button>
                    <button class="action-btn" title="Change Icon/Image" onclick="this.getRootNode().host.openIconPicker('${item.name}', 'item')">${ICONS.image}</button>
                 </div>
                 <div style="display:flex;gap:10px;"><button class="action-btn btn-danger" title="Delete" onclick="this.getRootNode().host.del('${item.name}')">${ICONS.delete}</button></div>
            </div>
            <div class="detail-row" style="margin-top:10px; border-top:1px solid #444; padding-top:10px; flex-direction:column; gap:8px;">
                <div class="move-container" style="width:100%"><span style="font-size:12px;color:#aaa;width:60px">Move to:</span><select class="move-select" id="room-select-${item.name}" onchange="this.getRootNode().host.updateLocationDropdown('${item.name}', this.value)">${roomOptions}</select></div>
                <div class="move-container" style="width:100%; display:none;" id="loc-container-${item.name}"><span style="font-size:12px;color:#aaa;width:60px">Loc:</span><select class="move-select" id="loc-select-${item.name}" onchange="this.getRootNode().host.updateSublocDropdown('${item.name}', this.value)"><option value="">-- Select --</option></select></div>
                <div class="move-container" style="width:100%; display:none;" id="subloc-container-${item.name}"><span style="font-size:12px;color:#aaa;width:60px">Sub:</span><select class="move-select" id="target-subloc-${item.name}" onchange="this.getRootNode().host.handleMoveToPath('${item.name}')"><option value="">-- Select --</option></select></div>
            </div>
         `;
         div.appendChild(details);
     }
     return div;
  }
  
  updateLocationDropdown(itemName, roomName) {
      const locContainer = this.shadowRoot.getElementById(`loc-container-${itemName}`);
      const locSelect = this.shadowRoot.getElementById(`loc-select-${itemName}`);
      const subContainer = this.shadowRoot.getElementById(`subloc-container-${itemName}`);
      subContainer.style.display = 'none';
      locSelect.innerHTML = '<option value="">-- Select --</option>';
      if(!roomName) { locContainer.style.display = 'none'; return; }
      let html = `<option value="">-- Select Location --</option>`;
      if(this.localData.hierarchy && this.localData.hierarchy[roomName]) Object.keys(this.localData.hierarchy[roomName]).forEach(loc => { html += `<option value="${loc}">${loc}</option>`; });
      locSelect.innerHTML = html;
      locContainer.style.display = 'flex';
      locSelect.dataset.room = roomName;
  }
  
  updateSublocDropdown(itemName, locationName) {
      const subContainer = this.shadowRoot.getElementById(`subloc-container-${itemName}`);
      const subSelect = this.shadowRoot.getElementById(`target-subloc-${itemName}`);
      const roomName = this.shadowRoot.getElementById(`room-select-${itemName}`).value;
      if(!locationName) { subContainer.style.display = 'none'; return; }
      let html = `<option value="">-- Select Sublocation --</option>`;
      html += `<option value="__ROOT__">Main ${locationName}</option>`;
      if(this.localData.hierarchy && this.localData.hierarchy[roomName] && this.localData.hierarchy[roomName][locationName]) this.localData.hierarchy[roomName][locationName].forEach(sub => { html += `<option value="${sub}">${sub}</option>`; });
      subSelect.innerHTML = html;
      subContainer.style.display = 'flex';
  }
  
  handleMoveToPath(itemName) {
      const room = this.shadowRoot.getElementById(`room-select-${itemName}`).value;
      const loc = this.shadowRoot.getElementById(`loc-select-${itemName}`).value;
      const sub = this.shadowRoot.getElementById(`target-subloc-${itemName}`).value;
      if(!room || !loc || !sub) return;
      let targetPath = [room, loc];
      if(sub !== "__ROOT__") targetPath.push(sub);
      this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
      setTimeout(() => { this.callHA('paste_item', {target_path: targetPath}); }, 100);
  }

  deleteFolder(name) { if(confirm(`Delete folder '${name}' and ALL items inside it?`)) this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: true }); }
  deleteSubloc(name) { if(confirm(`Delete '${name}'?`)) this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: true }); }

  render() { this.updateUI(); }
  navigate(dir, name) { 
      if (dir === 'root') this.currentPath = []; 
      else if (dir === 'up') this.currentPath.pop(); 
      else if (dir === 'down') this.currentPath.push(name); 
      this.expandedSublocs.clear();
      this.fetchData(); 
  }
  toggleRow(name) { this.expandedIdx = (this.expandedIdx === name) ? null : name; this.render(); }
  updateQty(name, d) { this.callHA('update_qty', { item_name: name, change: d }); }
  submitShopStock(name) { 
      const qty = this.shopQuantities[name] || 1;
      this.callHA('update_stock', { item_name: name, quantity: qty }); 
      delete this.shopQuantities[name];
  }
  
  enableSublocRename(btn, oldName) {
      const header = btn.closest('.group-separator');
      if (header.querySelector('input')) return; 
      const titleSpan = header.querySelector('.subloc-title') || header.querySelector('span');
      if(!titleSpan) return;
      const input = document.createElement('input');
      input.value = oldName;
      input.style.background = '#222';
      input.style.color = 'white';
      input.style.border = '1px solid var(--primary)';
      input.style.borderRadius = '4px';
      input.style.padding = '4px';
      input.style.fontSize = '14px';
      input.style.width = '200px'; 
      input.onclick = (e) => e.stopPropagation();
      titleSpan.replaceWith(input);
      input.focus();
      let isSaving = false;
      const save = () => {
          if (isSaving) return;
          isSaving = true;
          const newVal = input.value.trim();
          if (newVal && newVal !== oldName) {
              const newSpan = document.createElement('span');
              newSpan.className = 'subloc-title';
              newSpan.innerText = newVal;
              newSpan.style.opacity = '0.7';
              input.replaceWith(newSpan);
              this.callHA('update_item_details', { original_name: oldName, new_name: newVal, new_date: "", current_path: this.currentPath, is_folder: true }).catch(err => {
                  newSpan.innerText = oldName; newSpan.style.opacity = '1'; alert("Failed to rename");
              });
          } else {
              const originalSpan = document.createElement('span');
              originalSpan.className = 'subloc-title'; originalSpan.innerText = oldName; input.replaceWith(originalSpan);
          }
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
      input.onblur = () => save();
  }

  openIconPicker(targetName, context) {
      this.pendingFolderIcon = targetName;
      this.pickerContext = context; 
      this.pickerPage = 0; 
      
      if (context === 'item') {
          this.pickerCategory = Object.keys(ICON_LIB_ITEM)[0];
      } else {
          this.pickerCategory = null;
      }

      this.renderIconPickerGrid();
      this.shadowRoot.getElementById('icon-modal').style.display = 'flex';
  }

  getCurrentPickerLib() {
      if (this.pickerContext === 'room') return ICON_LIB_ROOM;
      if (this.pickerContext === 'location') return ICON_LIB_LOCATION;
      if (this.pickerContext === 'item') {
          return ICON_LIB_ITEM[this.pickerCategory] || {};
      }
      return ICON_LIB;
  }

  renderIconPickerGrid() {
      const lib = this.getCurrentPickerLib();
      const keys = Object.keys(lib);
      const totalPages = Math.ceil(keys.length / this.pickerPageSize);
      
      const grid = this.shadowRoot.getElementById('icon-lib-grid');
      const categoryBar = this.shadowRoot.getElementById('picker-categories');
      const pageInfo = this.shadowRoot.getElementById('picker-page-info');
      const prevBtn = this.shadowRoot.getElementById('picker-prev');
      const nextBtn = this.shadowRoot.getElementById('picker-next');

      if (this.pickerContext === 'item') {
          categoryBar.style.display = 'flex';
          categoryBar.innerHTML = '';
          Object.keys(ICON_LIB_ITEM).forEach(cat => {
              const btn = document.createElement('button');
              btn.className = `cat-btn ${this.pickerCategory === cat ? 'active' : ''}`;
              const firstIconKey = Object.keys(ICON_LIB_ITEM[cat])[0];
              const sampleIcon = ICON_LIB_ITEM[cat][firstIconKey] || '';
              btn.innerHTML = `${sampleIcon}<span>${cat}</span>`;
              btn.onclick = () => {
                  this.pickerCategory = cat;
                  this.pickerPage = 0;
                  this.renderIconPickerGrid();
              };
              categoryBar.appendChild(btn);
          });
      } else {
          categoryBar.style.display = 'none';
      }

      grid.innerHTML = '';
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
      prevBtn.disabled = this.pickerPage === 0;
      nextBtn.disabled = this.pickerPage >= totalPages - 1;
  }

  selectLibraryIcon(svgHtml) {
      let source = svgHtml;
      const size = 140; 
      if (!source.includes('xmlns')) source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      if (source.includes('width=')) {
          source = source.replace(/width="[^"]*"/, `width="${size}"`).replace(/height="[^"]*"/, `height="${size}"`);
      } else {
          source = source.replace('<svg', `<svg width="${size}" height="${size}"`);
      }
      source = source.replace('<svg', '<svg fill="#4fc3f7"');

      const img = new Image();
      const blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (this.pickerContext === 'item') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size); }
          ctx.drawImage(img, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/png');
          if(this.pendingFolderIcon) {
              const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
              const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
              this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          }
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
          URL.revokeObjectURL(url);
      };
      img.src = url;
  }

  handleUrlIcon(url) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          try {
              const dataUrl = canvas.toDataURL('image/jpeg');
              if(this.pendingFolderIcon) {
                  const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
                  const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
                  this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
              }
              this.shadowRoot.getElementById('icon-modal').style.display = 'none';
              this.shadowRoot.getElementById('icon-url-input').value = '';
          } catch(e) { alert("CORS prevented saving this image. Try uploading the file directly."); }
      };
      img.src = url;
  }

  handleIconUpload(input) {
      const file = input.files[0]; if (!file) return;
      this.compressImage(file, (dataUrl) => {
          if(this.pendingFolderIcon) {
              const isFolderContext = (this.pickerContext === 'room' || this.pickerContext === 'location');
              const markerName = isFolderContext ? `[Folder] ${this.pendingFolderIcon}` : this.pendingFolderIcon;
              this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          }
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
      });
      input.value = '';
  }

  compressImage(file, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX = 1024;
              let w = img.width, h = img.height;
              if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } }
              canvas.width = w; canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              callback(canvas.toDataURL('image/jpeg', 0.5));
          };
          img.src = e.target.result;
      };
      reader.readAsDataURL(file);
  }

  pasteItem() { this.callHA('paste_item', { target_path: this.currentPath }); }
  saveDetails(idx, oldName) { const nEl = this.shadowRoot.getElementById(`name-${idx}`); const dEl = this.shadowRoot.getElementById(`date-${idx}`); if(nEl && dEl) { this.callHA('update_item_details', { original_name: oldName, new_name: nEl.value, new_date: dEl.value }); this.expandedIdx = null; } }
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: false }); }
  showImg(src) { const ov = this.shadowRoot.getElementById('overlay-img'); const ovc = this.shadowRoot.getElementById('img-overlay'); if(ov && ovc) { ov.src = src; ovc.style.display = 'flex'; } }
  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
