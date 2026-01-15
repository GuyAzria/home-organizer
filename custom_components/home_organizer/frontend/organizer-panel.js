// Home Organizer Ultimate - Ver 5.6.6 (Sublocation Fix)
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
      this.expandedSublocs = new Set(); // Tracks which sub-headers are open
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
        
        /* Bars */
        .top-bar { background: #242426; padding: 10px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; height: 60px; }
        .sub-bar { background: #2a2a2c; height: 30px; display: flex; align-items: center; padding: 0 10px; border-bottom: 1px solid var(--border); gap: 15px; flex-shrink: 0; }
        
        .nav-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .sub-bar .nav-btn { padding: 2px; }
        .sub-bar .nav-btn svg { width: 18px; height: 18px; }
        
        .setup-wrapper { position: relative; display: flex; align-items: center; }
        .dropdown-menu { 
            position: absolute; top: 50px; left: 0; background: #2c2c2e; border: 1px solid var(--border); 
            border-radius: 8px; display: none; flex-direction: column; min-width: 150px; z-index: 3000;
            box-shadow: 0 8px 16px rgba(0,0,0,0.5);
        }
        .dropdown-menu.show { display: flex; }
        .dropdown-item { padding: 12px 15px; cursor: pointer; color: white; font-size: 14px; text-align: right; border-bottom: 1px solid #333; }
        .dropdown-item:hover { background: var(--primary); }

        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        /* Sublocation Styles */
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 15px 0 5px 0; 
            border-bottom: 1px solid #444; padding: 8px 4px; 
            font-weight: bold; display: flex; justify-content: space-between; align-items: center;
            cursor: pointer; background: rgba(255,255,255,0.02);
        }
        .group-separator:hover { background: rgba(255,255,255,0.08); }

        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; }
        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; }
        .item-left { display: flex; align-items: center; gap: 10px; }
        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      </style>
      
      <div class="app-container" id="app">
        <div class="top-bar">
            <div class="setup-wrapper">
                <button class="nav-btn" id="btn-setup">
                    <svg viewBox="0 0 24 24"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.35 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.47,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.53,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.35 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.53,18.67 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.47,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" /></svg>
                </button>
                <div class="dropdown-menu" id="setup-dropdown">
                    <div class="dropdown-item" data-lang="he">עברית</div>
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
        
        <div class="content" id="content"></div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const click = (id, fn) => { const el = root.getElementById(id); if(el) el.onclick = fn; };

    click('btn-setup', (e) => {
        e.stopPropagation();
        root.getElementById('setup-dropdown').classList.toggle('show');
    });

    window.addEventListener('click', () => root.getElementById('setup-dropdown')?.classList.remove('show'));

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; this.fetchData(); });
    click('btn-search', () => { this.isSearch = true; this.render(); });
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.render(); });
  }

  toggleSubloc(name) {
    if (this.expandedSublocs.has(name)) {
        this.expandedSublocs.delete(name);
    } else {
        this.expandedSublocs.add(name);
    }
    this.updateUI(); // Re-render to show/hide items
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    const content = root.getElementById('content');
    
    root.getElementById('display-title').innerText = attrs.path_display || "Organizer";
    content.innerHTML = '';

    // If depth is 2 or more, show sublocations with toggle logic
    if (attrs.depth >= 2) {
        const grouped = {};
        if (attrs.folders) attrs.folders.forEach(f => grouped[f.name] = []);
        if (!grouped["General"]) grouped["General"] = [];
        
        if (attrs.items) {
            attrs.items.forEach(item => {
                const sub = item.sub_location || "General";
                if (!grouped[sub]) grouped[sub] = [];
                grouped[sub].push(item);
            });
        }

        Object.keys(grouped).sort().forEach(subName => {
            const isExpanded = this.expandedSublocs.has(subName);
            const icon = isExpanded ? ICONS.chevron_down : ICONS.chevron_right;
            
            const header = document.createElement('div');
            header.className = 'group-separator';
            header.innerHTML = `<span>${icon} ${subName}</span><span>${grouped[subName].length}</span>`;
            
            // THE FIX: Correctly bind the toggle function
            header.onclick = () => this.toggleSubloc(subName);
            
            content.appendChild(header);

            if (isExpanded) {
                grouped[subName].forEach(item => {
                    content.appendChild(this.createItemRow(item));
                });
            }
        });
    } else {
        // Handle normal rooms/folders (depth 0 or 1)
        // ... (Render folders/items as normal)
        if (attrs.items) attrs.items.forEach(item => content.appendChild(this.createItemRow(item)));
    }
  }

  createItemRow(item) {
      const div = document.createElement('div');
      div.className = 'item-row';
      div.innerHTML = `
        <div class="item-main">
            <div class="item-left">
                <div style="width:30px">${ICONS.item}</div>
                <div>${item.name}</div>
            </div>
            <div class="item-qty-ctrl">
                <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">+</button>
                <span>${item.qty}</span>
                <button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">-</button>
            </div>
        </div>
      `;
      return div;
  }

  navigate(dir, name) { 
      if (dir === 'root') this.currentPath = []; 
      else if (dir === 'up') this.currentPath.pop(); 
      else if (dir === 'down') this.currentPath.push(name); 
      this.expandedSublocs.clear();
      this.fetchData(); 
  }

  updateQty(name, d) { this._hass.callService('home_organizer', 'update_qty', { item_name: name, change: d }); }
  render() { this.updateUI(); }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
