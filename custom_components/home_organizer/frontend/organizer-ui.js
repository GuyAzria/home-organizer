// Home Organizer for Home Assistant
// Copyright (C) 2026 Guy Azria
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details. <https://www.gnu.org/licenses/>.
//
// [MODIFIED v2026.9.22 | 2026-09-22] Purpose: The FAB starts in the TOP
//   bar instead of floating over the content near the bottom. Only the
//   anchor moved: column-reverse already lays the stack out as
//   button-then-menu, so pinning the container by its top puts the button
//   in the bar and the menu falls below it, and the button still does not
//   shift when the menu opens. 66px in from the edge rather than 30,
//   because both corners of that bar are already taken - the settings
//   button in Hebrew, the sidebar toggle in English. The menu's entrance
//   flips with it, arriving from above rather than rising from below. It
//   is still draggable: this is a starting point, not a cage.
// [MODIFIED v2026.9.22 | 2026-09-22] Purpose: The Home button opens the
//   DASHBOARD. The room list is untouched and is the dashboard's first
//   button, so nothing that worked before moved - it is only no longer the
//   first thing seen. isDashboardMode is a new view mode, which means every
//   other entry point had to learn to clear it: 13 sites, found by the
//   audit in CLAUDE.md rather than by eye (RULE 33a.1).

import { ICONS } from './organizer-icon.js?v=10.3.0';
import { escapeHtml } from './organizer-utils.js?v=2026.8.26';

const UPLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>';
const MENU_SVG   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"/></svg>';
const INFO_SVG   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';
const SHARE_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>';

export const UIMixin = (Base) => class extends Base {

  _t(key, defaultText) {
    let res = this.t(key);
    if (typeof res === 'string') {
        res = res.replace(/^"|"$/g, '').trim();
    }
    if (res && res !== key) return res;
    return defaultText;
  }

  // [ADDED v10.3.4] Centralized sharing function identical to AI logic
  async shareShoppingList() {
    const list = this.localData?.shopping_list || [];
    if (list.length === 0) {
      alert(this._t('no_items_list', 'The list is empty.'));
      return;
    }

    const CAT_EMOJI = {
      "Food & Groceries": "🍎", "Personal Care & Pharmacy": "💊", "Cleaning Supplies": "🧽", "Home Maintenance": "🔧", "Textiles & Bedding": "🛏️", "Clothing": "👕", "Footwear": "👟", "Bags & Accessories": "👜", "Electronics & Tech": "📱", "Baby & Kids": "👶", "Pet Supplies": "🐾", "Outdoor & Garden": "🌳", "Sports & Hobbies": "⚽", "Office & Stationery": "✏️",
      "Food": "🍎", "Cleaning": "🧽", "Tools": "🔧", "Electronics": "📱", "Kitchenware": "🍳", "Home Textiles": "🛏️", "Baby Supplies": "👶", "Toys": "🧸", "Outdoor": "🌳", "Fitness Gear": "⚽", "Toiletries": "🧴", "Pharmacy": "💊", "General Supplies": "📦", "Home Office Supplies": "✏️", "Entertainment": "🎮", "First Aid": "🩹"
    };
    const SUB_EMOJI = {
      "Dairy & Eggs": "🥛", "Meat & Poultry": "🍗", "Fish & Seafood": "🐟", "Vegetables": "🥦", "Fruits": "🍓", "Pantry & Dry Goods": "🍚", "Carbs & Pasta": "🍝", "Legumes": "🫘", "Spices & Herbs": "🌿", "Baking Goods": "🧁", "Sauces & Condiments": "🍯", "Spreads": "🥜", "Canned Goods": "🥫", "Bread & Bakery": "🍞", "Beverages": "🥤", "Snacks & Sweets": "🍪"
    };

    const getCatEmoji = c => CAT_EMOJI[c] || "📦";
    const getSubEmoji = s => SUB_EMOJI[s] ? `${SUB_EMOJI[s]} ` : "";

    let text = `🛒 *${this._t('shopping_list', 'Shopping List')}* 🛒\n\n`;
    const grouped = {};
    let total = 0;

    list.forEach(item => {
      const catRaw = (item.category || "Other").trim() || "Other";
      const scatRaw = (item.sub_category || "General").trim() || "General";
      const catDisp = this._t('cat_' + catRaw.replace(/[^a-zA-Z0-9]+/g,'_'), catRaw);
      const scatDisp = this._t('sub_' + scatRaw.replace(/[^a-zA-Z0-9]+/g,'_'), scatRaw);
      
      if (!grouped[catRaw]) grouped[catRaw] = { display: catDisp, subs: {} };
      if (!grouped[catRaw].subs[scatRaw]) grouped[catRaw].subs[scatRaw] = { display: scatDisp, items: [] };
      
      grouped[catRaw].subs[scatRaw].items.push(item);
      total++;
    });

    Object.keys(grouped).sort((a,b) => grouped[a].display.localeCompare(grouped[b].display)).forEach(catRaw => {
      const catObj = grouped[catRaw];
      text += `${getCatEmoji(catRaw)} *${catObj.display}*\n`;
      
      const subKeys = Object.keys(catObj.subs).sort((a,b) => catObj.subs[a].display.localeCompare(catObj.subs[b].display));
      const onlyGeneral = subKeys.length === 1 && subKeys[0] === "General";
      
      subKeys.forEach(scatRaw => {
        const subObj = catObj.subs[scatRaw];
        if (!onlyGeneral) {
           text += `  ${getSubEmoji(scatRaw)}_${subObj.display}_\n`;
        }
        subObj.items.forEach(item => {
          const qty = item.order_qty || 1;
          const uval = item.unit_value || '';
          const unit = item.unit && item.unit !== 'Units' ? this._t('unit_'+item.unit, item.unit) : '';
          const valPart = (uval && unit) ? ` (${uval} ${unit})` : (uval ? ` (${uval})` : '');
          text += `  • ${item.name} ×${qty}${valPart}\n`;
        });
      });
      text += `\n`;
    });
    text += `— ${this._t('total_items', 'Total items')}: ${total}`;

    const encoded = encodeURIComponent(text);
    const waUrl = `https://wa.me/?text=${encoded}`;
    const tgUrl = `https://t.me/share/url?url=&text=${encoded}`;
    const emUrl = `mailto:?subject=${encodeURIComponent(this._t('shopping_list', 'Shopping List'))}&body=${encoded}`;

    const modal = this.shadowRoot.getElementById('share-modal');
    
    const btnWa = this.shadowRoot.getElementById('btn-share-wa');
    const btnTg = this.shadowRoot.getElementById('btn-share-tg');
    const btnEm = this.shadowRoot.getElementById('btn-share-em');
    const btnCopy = this.shadowRoot.getElementById('btn-share-copy');

    btnWa.onclick = () => { window.open(waUrl, '_blank'); modal.style.display='none'; };
    btnTg.onclick = () => { window.open(tgUrl, '_blank'); modal.style.display='none'; };
    btnEm.onclick = () => { window.open(emUrl, '_self'); modal.style.display='none'; };
    btnCopy.onclick = () => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try { document.execCommand('copy'); alert(this._t('copied_to_clipboard', 'Copied to clipboard!')); } catch (e) {}
      document.body.removeChild(textArea);
      modal.style.display='none';
    };

    modal.style.display = 'flex';
  }

  initUI() {
    this.content = true;
    this.attachShadow({ mode: 'open' });
    const timestamp = new Date().getTime();

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/home_organizer_static/organizer-panel.css?v=${timestamp}">
      <link rel="stylesheet" href="/home_organizer_static/pages/stylist.css?v=${timestamp}">
      <link rel="stylesheet" href="/home_organizer_static/pages/barcode.css?v=${timestamp}">
      <link rel="stylesheet" href="/home_organizer_static/pages/inventory.css?v=${timestamp}">
      <link rel="stylesheet" href="/home_organizer_static/pages/chat.css?v=${timestamp}">
      <link rel="stylesheet" href="/home_organizer_static/pages/dashboard.css?v=${timestamp}">
      <link rel="stylesheet" href="/home_organizer_static/pages/shopping.css?v=${timestamp}">
      <link rel="stylesheet" href="/home_organizer_static/pages/search.css?v=${timestamp}">
      <!-- [ADDED v2026.10.9] The cookbook has its own stylesheet: it is the
           one screen that deliberately does not follow the HA theme, because
           a recipe book should read as paper in dark mode too. -->
      <link rel="stylesheet" href="/home_organizer_static/pages/recipes.css?v=${timestamp}">
      <style>
        /* [FIXED v2026.9.22] absolute, not fixed - see .app-container in
           organizer-panel.css. fixed is measured against the window, and the
           window's left edge is Home Assistant's sidebar, so left:30px put
           the button behind it. #app does not scroll, so this pins to the
           screen exactly as fixed did, but inside the panel. */
        /* [MODIFIED v2026.9.22] The button's default place is the TOP bar.

           Only the ANCHOR changed. column-reverse already lays this stack
           out as button-then-menu, so pinning the container by its top
           instead of its bottom puts the button in the bar and lets the
           menu fall below it - the flex direction and the DOM order are
           untouched, and the button still does not move when the menu
           opens, which is what column-reverse was for.

           top:6px centres a 48px button in the 60px bar.

           66px in from the edge, not 30: at 30 it would sit on the settings
           button in Hebrew and on the sidebar toggle in English, since both
           corners are already occupied. 66 leaves 16px of clear space
           beside a 40px corner button on a 320px screen, which is the
           narrowest this panel is used at (RULE 36).

           It is still draggable from here - makeFabDraggable applies a
           translate on top of whatever this rule sets, so this is a
           starting point and not a cage. */
        .fab-container { position:absolute; top:6px; right:66px; z-index:1000; display:flex; flex-direction:column-reverse; align-items:flex-start; gap:15px; pointer-events:none; }
        /* [ADDED v2026.9.22] The button sits on the GLYPH side, and the whole
           stack is flush to that one edge.

           align-items:flex-start above does the alignment for both languages
           at once - the cross axis of a column follows the inherited
           direction, so it is the left in English and the right in Hebrew,
           which is the side the glyph is on in each.

           The ANCHOR cannot follow direction, because left and right are
           physical. Hebrew keeps right:30px from the base rule; English gets
           this one. #app.ltr and not :not(.ltr) on purpose: a positive match
           on a class that is definitely added (initUI and changeLanguage
           both set it for English). If it somehow failed to match, the
           button stays bottom-right and visible - the safe direction to
           fail, which the previous attempt at this rule was not.

           .rtl and [dir=rtl] select nothing in this panel - direction is
           signalled by .ltr on #app, added for English and removed for
           Hebrew (RULE 33b). Any rule written against them is dead. */
        #app.ltr .fab-container { right:auto; left:66px; }
        /* [MODIFIED v2026.9.22] A ring, not a disc. 48px is the 60px it was
           less twenty per cent; the icon is scaled with it so it keeps the
           same share of the button.

           position:relative + the ::after below keep the TOUCH target at the
           old size while the drawn button shrinks. The ring is drawn inside
           those 48px, so nothing moves on screen, but the thumb still gets
           the 60px it had. It matters more here than on a fixed control:
           makeFabDraggable wires touch and mouse dragging onto this element,
           so those 48px are a grab handle as well as a button (RULE 36).

           The open state used to be a red FILL. There is no fill any more, so
           it moved to the BORDER, and to the glyph with it. */
        .fab-main { position:relative; width:48px; height:48px; border-radius:50%; background:transparent; color:var(--fab-ring,#5ddf8a); border:2px solid var(--fab-ring,#5ddf8a); font-size:22px; box-shadow:0 2px 10px rgba(0,0,0,0.25),0 0 0 1px var(--fab-ring-soft,rgba(93,223,138,0.28)); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:transform .3s cubic-bezier(.175,.885,.32,1.275),border-color .3s,color .3s,box-shadow .3s,opacity .4s; outline:none; pointer-events:auto; }
        .fab-main::after { content:''; position:absolute; inset:-6px; border-radius:50%; }
        /* The glyph is an SVG, not an emoji, so its size and colour are ours
           to set - an emoji is a colour font and ignores both. Yellow, which
           is what the emoji looked like, and 26px inside the 44px the ring
           leaves. The RING carries the open and busy states; the glyph stays
           the same colour throughout, exactly as the emoji did. */
        .fab-main svg { width:26px; height:26px; fill:var(--warning,#ffeb3b); display:block; pointer-events:none; }
        .fab-main:hover { box-shadow:0 2px 10px rgba(0,0,0,0.25),0 0 0 1px var(--fab-ring-soft,rgba(93,223,138,0.28)),0 0 14px var(--fab-ring-soft,rgba(93,223,138,0.28)); }
        .fab-container.open .fab-main { transform:rotate(45deg); border-color:var(--danger,#F44336); color:var(--danger,#F44336); }

        /* The ring fades when nothing has been touched for a few seconds, so
           the button stops competing with the content under it. Any pointer
           or scroll brings it straight back; see bindEvents. */
        .fab-container.idle .fab-main { opacity:.45; }

        /* A receipt scan turns the ring into the progress indicator, so the
           wait costs no extra space on the screen. A rotating BORDER ARC
           rather than a masked conic gradient: mask on a pseudo-element is
           the kind of thing that fails to a filled disc where it is not
           supported, while a border arc simply stops spinning.

           Listed AFTER the open rule on purpose - same specificity, so this
           one wins if the menu happens to be open while a scan is running. */
        .fab-main.busy { border-color:var(--fab-ring-soft,rgba(93,223,138,0.28)); }
        .fab-main.busy::before { content:''; position:absolute; inset:-2px; border-radius:50%; border:2px solid transparent; border-top-color:var(--fab-ring,#5ddf8a); animation:ho-fab-spin .9s linear infinite; }
        @keyframes ho-fab-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .fab-main.busy::before { animation:none; } }
        /* [FIXED v2026.9.22] The GLYPH side is the flush edge, not the text.

           Each entry is only as wide as its own label, so one edge lines up
           and the other is ragged. It was the text edge, which put the icons
           in a staircase - and the icons are the part the eye scans.

           flex-start, once, for both directions: the cross axis of a column
           follows the inherited direction, so it is the left in English and
           the right in Hebrew - which is the side the glyph is on in each,
           since the glyph leads in reading order. */
        /* [MODIFIED v2026.9.22] The menu drops DOWN from the button now that
           the button is in the top bar, so it grows from its own top edge
           and arrives from above. Reversing the sign and the origin is the
           whole change: a menu that still rose from below would appear to
           come from behind the thing it belongs to. */
        .fab-menu { display:flex; flex-direction:column; align-items:flex-start; gap:6px; opacity:0; visibility:hidden; transform:translateY(-20px) scale(.8); transition:all .3s cubic-bezier(.175,.885,.32,1.275); transform-origin:top center; pointer-events:none; }
        /* The menu's own RTL rule is gone with it, and not replaced: it only
           set align-items, which direction already handles. */
        .fab-container.open .fab-menu { opacity:1; visibility:visible; transform:translateY(0) scale(1); pointer-events:auto; }
        .fab-item-wrapper { display:flex; }

        /* [MODIFIED v2026.9.22] One rectangle per entry, and the whole
           rectangle is the button.

           It used to be a 50px circle with the label floating beside it as an
           absolutely positioned tooltip - so the text was decoration and only
           the circle could be pressed. Merging them makes the label part of
           the target, which is the difference between a 50px hit area and a
           160px one on a phone (RULE 36).

           DOM order is GLYPH then label, with no direction rule of its own.
           The glyph leads in reading order, which is how every icon+text
           control is read: left in English, right in Hebrew. flex-direction
           row does that by itself because flex follows the inherited
           direction - the one thing RULE 33b says IS reliable here, unlike
           the physical properties and the [dir] selectors around it. */
        .fab-item { display:flex; align-items:center; gap:10px; height:44px; padding:0 12px; border-radius:10px; background:var(--bg-card,#2a2a2a); color:var(--text-main,#fff); border:1px solid var(--border-light,#444); box-shadow:0 3px 10px rgba(0,0,0,.2); font-size:14px; font-weight:500; white-space:nowrap; max-width:calc(100vw - 80px); overflow:hidden; cursor:pointer; transition:transform .2s,background .2s,color .2s,border-color .2s; outline:none; pointer-events:auto; }
        .fab-item:hover { transform:scale(1.04); background:var(--primary,#03a9f4); color:white; border-color:var(--primary,#03a9f4); }
        /* A long translation truncates instead of pushing the rectangle
           off the screen - the stack is anchored by one edge, so the other
           end has nothing to stop it (RULE 36). */
        .fab-label { pointer-events:none; overflow:hidden; text-overflow:ellipsis; }
        /* font-size is here as well as width/height: one entry is still an
           emoji, and an emoji is sized by font-size, not by the svg rule. */
        .fab-glyph { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; flex:0 0 auto; font-size:20px; line-height:1; pointer-events:none; }
        .fab-glyph svg { width:100%; height:100%; fill:currentColor; }
        
        .mockup-panel { background:#222; border: 2px solid #555; border-radius: 15px; padding: 20px; margin: 15px 0; font-family: sans-serif; direction:ltr; }
        :host-context(.light-mode) .mockup-panel { background:#fff; border-color:#ccc; box-shadow:0 4px 10px rgba(0,0,0,0.1); }
        .mockup-input { background:#111; border:1px solid #333; padding:12px; border-radius:6px; color:#fff; font-size:15px; text-align:center; }
        :host-context(.light-mode) .mockup-input { background:#f5f5f5; border-color:#ddd; color:#333; }
        .mockup-hint { color:#4CAF50; font-size:15px; font-weight:bold; margin-top:6px; margin-bottom:25px; padding: 0 5px; line-height:1.5; }
        .mockup-label { color:#aaa; font-size:13px; margin-bottom:4px; }
        :host-context(.light-mode) .mockup-label { color:#666; }
        .mockup-text { color:white; font-size:15px; }
        :host-context(.light-mode) .mockup-text { color:#333; }
      </style>

      <div class="app-container" id="app">
        <div class="top-bar" style="direction:ltr;">
          <button class="nav-btn" id="btn-ha-menu" title="Toggle Sidebar">${MENU_SVG}</button>
          <div class="title-box">
            <div class="main-title" id="display-title"></div>
            <div class="sub-title" id="display-path"></div>
          </div>
          <div style="display:flex;gap:5px;align-items:center;">
            <div class="setup-wrapper">
              <button class="nav-btn" id="btn-user-setup">${ICONS.settings}</button>
              <div class="setup-dropdown" id="setup-dropdown-menu">
                <div id="menu-main">
                  <div class="dropdown-item" onclick="event.stopPropagation();this.getRootNode().host.showMenu('lang')">${ICONS.language} <span id="lbl-lang">Language</span></div>
                  <div class="dropdown-item" onclick="event.stopPropagation();this.getRootNode().host.showMenu('theme')">${ICONS.theme} <span id="lbl-theme">Theme</span></div>
                  <div class="dropdown-item" onclick="event.stopPropagation();this.getRootNode().host.showAbout()">${INFO_SVG} <span id="lbl-about">About</span></div>
                  <div style="height:1px;background:var(--border-light);margin:8px 0;width:100%;"></div>
                  <div class="dropdown-item" id="btn-setup-ext-app"><span id="lbl-ext-menu">📱 HO_Mind_AI</span></div>
                </div>
                <div id="menu-lang" style="display:none">
                  <div class="dropdown-item back-btn" onclick="event.stopPropagation();this.getRootNode().host.showMenu('main')">${ICONS.back} <span id="lbl-back1">Back</span></div>
                </div>
                <div id="menu-theme" style="display:none">
                  <div class="dropdown-item back-btn" onclick="event.stopPropagation();this.getRootNode().host.showMenu('main')">${ICONS.back} <span id="lbl-back2">Back</span></div>
                  <div class="dropdown-item" onclick="this.getRootNode().host.setTheme('light')" id="lbl-light">Light</div>
                  <div class="dropdown-item" onclick="this.getRootNode().host.setTheme('dark')" id="lbl-dark">Dark</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="sub-bar">
          <div class="sub-bar-left">
            <button class="nav-btn" id="btn-home">${ICONS.home}</button>
            <button class="nav-btn" id="btn-up" style="display:none;">${ICONS.arrow_up}</button>
            <button class="nav-btn" id="btn-bulk-delete" style="display:none;color:var(--danger,#F44336);align-items:center;gap:5px;" title="Delete Selected"></button>
          </div>
          <div class="sub-bar-right">
            <button class="nav-btn" id="btn-share-shopping" style="display:none;" title="Share Shopping List">${SHARE_SVG}</button>
            <button class="nav-btn" id="btn-view-toggle" style="display:none;">
              <span id="icon-view-grid" style="display:block">${ICONS.view_grid}</span>
              <span id="icon-view-list" style="display:none">${ICONS.view_list}</span>
            </button>
            <button class="nav-btn" id="btn-toggle-ids" title="Toggle IDs">${ICONS.id_card}</button>
            <button class="nav-btn" id="btn-edit">${ICONS.edit}</button>
          </div>
        </div>

        <div class="search-box" id="search-box">
          <div style="position:relative;flex:1;">
            <input type="text" id="search-input" style="width:100%;padding:8px;padding-inline-start:65px;border-radius:8px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border-input)">
            <button class="nav-btn ai-btn" id="btn-ai-search" style="position:absolute;inset-inline-start:0;top:0;height:100%;background:none;border:none;">${ICONS.camera}</button>
            <button class="nav-btn ai-btn" id="btn-ai-upload"  style="position:absolute;inset-inline-start:30px;top:0;height:100%;background:none;border:none;" title="Upload File">${UPLOAD_SVG}</button>
          </div>
          <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>

        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,.2);color:#ffeb3b;align-items:center;justify-content:space-between">
          <div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div>
          <button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button>
        </div>

        <div class="content" id="content"><div style="text-align:center;padding:20px;color:#888;" id="lbl-loading">Loading...</div></div>

        <div class="fab-container" id="fab-container">
          <div class="fab-menu" id="fab-menu">
            <div class="fab-item-wrapper">
              <button class="fab-item" id="btn-fab-shop">
                <span class="fab-glyph">${ICONS.cart}</span>
                <span class="fab-label" id="lbl-fab-shop">Shopping</span>
              </button>
            </div>
            <div class="fab-item-wrapper">
              <button class="fab-item" id="btn-fab-search">
                <span class="fab-glyph">${ICONS.search}</span>
                <span class="fab-label" id="lbl-fab-search">Search</span>
              </button>
            </div>
            <div class="fab-item-wrapper">
              <button class="fab-item" id="btn-fab-locations">
                <span class="fab-glyph">${ICONS.home}</span>
                <span class="fab-label" id="lbl-fab-locations">Locations</span>
              </button>
            </div>
            <div class="fab-item-wrapper" id="wrap-fab-chat">
              <button class="fab-item" id="btn-fab-chat">
                <span class="fab-glyph">${ICONS.robot}</span>
                <span class="fab-label" id="lbl-fab-chat">Receipts AI</span>
              </button>
            </div>
            <!-- [ADDED v2026.10.9] Cookbook. -->
            <div class="fab-item-wrapper" id="wrap-fab-recipes">
              <button class="fab-item" id="btn-fab-recipes">
                <span class="fab-glyph">${ICONS.chef || ICONS.cooking || ICONS.item}</span>
                <span class="fab-label" id="lbl-fab-recipes">My Recipes</span>
              </button>
            </div>
            <div class="fab-item-wrapper" id="wrap-fab-barcode">
              <button class="fab-item" id="btn-fab-barcode">
                <span class="fab-glyph">${ICONS.barcode}</span>
                <span class="fab-label" id="lbl-fab-barcode">Barcode Scanner</span>
              </button>
            </div>
            <div class="fab-item-wrapper" id="wrap-fab-stylist" >
              <button class="fab-item" id="btn-fab-stylist">
                <span class="fab-glyph">👗</span>
                <span class="fab-label" id="lbl-fab-stylist">Stylist</span>
              </button>
            </div>
          </div>
          <button class="fab-main" id="btn-fab-main">${ICONS.sparkles}</button>
        </div>
      </div>

      <div id="share-modal" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:3500;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;">
        <div class="modal-content" onclick="event.stopPropagation()" style="text-align:center;max-width:400px;width:100%;">
          <div style="margin-bottom:15px;font-size:20px;font-weight:bold;color:var(--primary);">${this._t('share', 'Share Shopping List')}</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="action-btn" id="btn-share-wa" style="background:#25D366;color:white;font-weight:bold;height:45px;display:flex;align-items:center;justify-content:center;gap:10px;">📲 WhatsApp</button>
            <button class="action-btn" id="btn-share-tg" style="background:#0088cc;color:white;font-weight:bold;height:45px;display:flex;align-items:center;justify-content:center;gap:10px;">✈️ Telegram</button>
            <button class="action-btn" id="btn-share-em" style="background:#ea4335;color:white;font-weight:bold;height:45px;display:flex;align-items:center;justify-content:center;gap:10px;">📧 Email</button>
            <button class="action-btn" id="btn-share-copy" style="background:var(--bg-input-edit);color:var(--text-main);font-weight:bold;height:45px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid var(--border-light);">📋 ${this._t('copy', 'Copy to Clipboard')}</button>
          </div>
          <button class="action-btn" style="width:100%;margin-top:15px;height:45px;" onclick="this.closest('#share-modal').style.display='none'">✕ ${this._t('close', 'Close')}</button>
        </div>
      </div>

      <div id="about-modal" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:3500;align-items:center;justify-content:center;">
        <div class="modal-content" onclick="event.stopPropagation()" style="text-align:center;">
          <div style="margin-bottom:20px;font-size:20px;font-weight:bold;color:var(--primary);">Home Organizer Ultimate</div>
          <div style="margin-bottom:20px;font-style:italic;font-size:16px;color:#e91e63;">"Written by Guy Azria for my dear Yulia"</div>
          <div style="margin-bottom:20px;font-size:14px;color:var(--text-sub);line-height:1.5;">A comprehensive inventory management system for Home Assistant.<br>Organize, track, and manage your home with ease.</div>
          <div style="margin-top:20px;font-size:12px;color:#666;border-top:1px solid var(--border-light);padding-top:10px;">Licensed under GPL-3.0 License.<br></div>
          <button class="action-btn" style="width:100%;margin-top:20px;" onclick="this.closest('#about-modal').style.display='none'" id="lbl-close">Close</button>
        </div>
      </div>

      <div id="ext-app-modal" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:3500;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;">
        <div class="modal-content" onclick="event.stopPropagation()" style="text-align:start;max-width:500px;width:100%;max-height:90vh;display:flex;flex-direction:column;">
          <div style="margin-bottom:15px;font-size:20px;font-weight:bold;color:var(--primary);text-align:center;flex-shrink:0;" id="lbl-ext-title">📱 HO_Mind_AI</div>
          
          <div style="overflow-y:auto;flex-grow:1;padding-right:10px;" id="ext-app-scroll-area">
              <div style="background:var(--bg-input-edit);padding:15px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border-light);">
                <span style="font-weight:bold;font-size:16px;" id="lbl-ext-enable">Enable Android App Integration</span>
                <input type="checkbox" id="ext-cam-checkbox" style="transform:scale(1.5);cursor:pointer;margin:0 10px;">
              </div>

              <div style="font-size:15px;color:var(--text-main);line-height:1.6;margin-bottom:10px;">
                <b style="color:var(--warning);font-size:18px;margin-bottom:10px;display:block;" id="lbl-ext-guide-title">🚀 Setup Guide (Easy enough for a 12-year-old!)</b>
                <div style="margin-bottom:15px; font-size:15px; line-height:1.6;" id="lbl-ext-guide-intro">
                    To access the settings in the Android app:<br>Click the camera button (📸) on the main chat screen.<br>Then click the gear icon (⚙️).<br><b>This is exactly what you will see there, and what to fill out:</b>
                </div>

                <div class="mockup-panel">
                    <div style="text-align:center; color:#03a9f4; font-size:20px; font-weight:bold; margin-bottom:20px;" id="lbl-ext-settings-title">HO Settings</div>
                    
                    <div style="margin-bottom:15px;">
                        <div class="mockup-input">http://192.168.31.111:8123</div>
                        <div class="mockup-hint" id="lbl-ext-url-hint">☝️ <b>URL:</b> Enter the exact internal IP of your home server.<br>For example:<br><span dir="ltr">http://192.168.1.100:8123</span></div>
                    </div>

                    <div style="margin-bottom:20px;">
                        <div class="mockup-input" style="letter-spacing:3px;">••••••••••••••••••••••••••</div>
                        <div class="mockup-hint" id="lbl-ext-token-hint">☝️ <b>Security Token:</b><br>In Home Assistant, click your profile (bottom corner).<br>Select the tab:<br><b>Security</b><br>Scroll down until you find:<br><b>Long-Lived Access Tokens</b><br>Generate a new token and paste it here.</div>
                    </div>

                    <div class="mockup-label" id="lbl-ext-device">HA Notify Device ID:</div>
                    <div class="mockup-input" style="margin-bottom:4px; overflow-wrap:break-word; text-align:left;">adbb9e6436d8e5c273ebb69</div>
                    <div class="mockup-hint" id="lbl-ext-device-hint">☝️ <b>Device ID:</b><br>Careful, this is NOT the phone's name!<br>In Home Assistant go to:<br><b>Settings ➔ Devices</b><br>Find your phone under Mobile App.<br>Look at the web browser's address bar (at the top),<br>and copy the long string of letters and numbers at the very end of the URL.</div>

                    <div style="background:rgba(37, 211, 102, 0.15); border-inline-start:4px solid #25D366; padding:15px; border-radius:6px; margin-bottom:25px; font-size:14px; color:var(--text-main); box-shadow: 0 2px 5px rgba(0,0,0,0.2); line-height:1.6;" id="lbl-ext-whatsapp">
                        💡 <b>Pro Tip:</b><br>The easiest way is to generate the Token and ID on your PC,<br>send them to yourself via <b>WhatsApp</b>,<br>and then simply copy and paste them on your phone!
                    </div>

                    <div class="mockup-label" id="lbl-ext-agent">Conversation Agent ID:</div>
                    <div class="mockup-input" style="margin-bottom:4px; text-align:left;">conversation.ho_ai_agent</div>
                    <div class="mockup-hint" id="lbl-ext-agent-hint">☝️ <b>Agent:</b><br>This is the default value - no need to touch or change it!</div>

                    <div class="mockup-label" style="margin-bottom:8px;" id="lbl-ext-mic">Microphone Source:</div>
                    <div style="display:flex; align-items:center; margin-bottom:10px;">
                        <div style="width:36px; height:20px; background:#444; border-radius:10px; position:relative; margin-right:10px;"><div style="width:16px; height:16px; background:#888; border-radius:50%; position:absolute; top:2px; left:2px;"></div></div>
                        <div class="mockup-text" id="lbl-ext-mic-bt">Use Bluetooth/External Mic</div>
                    </div>
                    <div class="mockup-hint" style="padding-inline-start:15px;" id="lbl-ext-mic-bt-hint">👈 Leave this OFF (gray).</div>

                    <div style="display:flex; align-items:center; margin-bottom:4px;">
                        <div style="width:36px; height:20px; background:#673AB7; border-radius:10px; position:relative; margin-right:10px;"><div style="width:16px; height:16px; background:#FFF; border-radius:50%; position:absolute; top:2px; right:2px;"></div></div>
                        <div class="mockup-text" id="lbl-ext-shake">Enable Shake to Speak</div>
                    </div>
                    <div class="mockup-hint" id="lbl-ext-shake-hint">☝️ <b>"Ghost Screen" Magic:</b><br>MUST be turned ON (purple)!<br>This allows the app to listen in the background,<br>and use Google's speech-to-text engine<br>to understand you with incredible accuracy!</div>

                    <div class="mockup-label" id="lbl-ext-lang">Voice Assistant Language:</div>
                    <div class="mockup-input" style="margin-bottom:4px;">English (US) ▼</div>
                    <div class="mockup-hint" id="lbl-ext-lang-hint">☝️ <b>Language:</b> Select the language you will speak to the system.</div>

                    <div class="mockup-label" style="margin-bottom:8px;" id="lbl-ext-vol">Assistant Volume Override (Works on Silent):</div>
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                        <div class="mockup-text" style="font-size:13px;">39%</div>
                        <div style="flex:1; height:4px; background:#444; border-radius:2px; position:relative;">
                            <div style="width:39%; height:4px; background:#03a9f4; border-radius:2px;"></div>
                            <div style="width:12px; height:12px; background:#03a9f4; border-radius:50%; position:absolute; top:-4px; left:39%;"></div>
                        </div>
                    </div>
                    <div class="mockup-hint" id="lbl-ext-vol-hint">☝️ <b>Volume:</b> Adjust the volume.<br>The system will answer aloud even if the phone is on silent!</div>

                    <div style="border-top:1px solid #444; margin:20px 0;"></div>
                    
                    <div class="mockup-label" style="text-align:center; margin-bottom:8px;" id="lbl-ext-test">Voice Testing Area</div>
                    <div style="display:flex; justify-content:center; gap:10px; margin-bottom:8px;">
                        <div style="background:#E91E63; color:white; padding:10px 15px; border-radius:5px; font-size:14px; font-weight:bold; width:120px; text-align:center;" id="lbl-ext-test-stt">Test STT 🎤</div>
                        <div style="background:#2196F3; color:white; padding:10px 15px; border-radius:5px; font-size:14px; font-weight:bold; width:120px; text-align:center;" id="lbl-ext-test-tts">Test TTS 📢</div>
                    </div>
                    <div class="mockup-hint" style="text-align:center;" id="lbl-ext-test-hint">☝️ <b>Testing:</b><br>Click to see that it hears you and speaks back.<br>(Leave logs turned off).</div>

                    <div style="background:#4CAF50; color:white; padding:15px; border-radius:5px; text-align:center; font-weight:bold; font-size:16px; margin-bottom:5px;" id="lbl-ext-save">Save and Close</div>
                    <div class="mockup-hint" style="text-align:center; margin-bottom:0;" id="lbl-ext-save-hint">☝️ <b>All Done:</b><br>Click here to save everything, and you're ready to go!</div>
                </div>
                </div>
              <div style="flex-shrink:0;margin-top:15px;direction:ltr;">
                  <button class="action-btn" id="btn-ext-download" style="width:100%;margin-bottom:10px;background:var(--accent);color:white;font-weight:bold;display:flex;align-items:center;justify-content:center;gap:10px;height:45px;" onclick="window.open('https://github.com/GuyAzria/HO_Mind_AI/releases/latest', '_blank');">
                    📥 Download HO_Mind_AI App
                  </button>
                  <button class="action-btn" id="btn-ext-close" style="width:100%;height:45px;" onclick="this.closest('#ext-app-modal').style.display='none'">Close</button>
              </div>
          </div>
        </div>
      </div>

      <div id="icon-modal" onclick="this.style.display='none'">
        <div class="modal-content" onclick="event.stopPropagation()" style="position:relative;padding-top:40px;">
          <button class="nav-btn" style="position:absolute;top:10px;right:10px!important;left:auto!important;padding:0;background:transparent;border-radius:4px;color:var(--danger);font-size:18px;font-weight:bold;border:2px outset #666;width:30px;height:30px;display:flex;align-items:center;justify-content:center;z-index:10;cursor:pointer;" onclick="this.closest('#icon-modal').style.display='none'">✕</button>
          <div class="modal-title" id="lbl-change-icon" style="margin-top:-15px;margin-bottom:15px;">Change Icon</div>
          <div id="picker-main-categories" style="display:none;overflow-x:auto;overflow-y:hidden;gap:10px;padding:5px 5px 15px 5px;margin-bottom:10px;align-items:center;"></div>
          <div id="picker-sub-categories"  style="display:none;overflow-x:auto;overflow-y:hidden;gap:10px;padding:10px 10px 15px 10px;background:#222;border-radius:8px;margin-bottom:10px;align-items:center;"></div>
          <div class="icon-grid" id="icon-lib-grid"></div>
          <!-- [ADDED v2026.9.20] Ask the assistant to DRAW this item.
               Shown for items only: a room or a location is a place, not a
               thing, and there is nothing to picture. The sentence is a
               hint - the name comes from the database, not from here. -->
          <div class="ai-icon-row" id="ai-icon-row" style="display:none;">
            <input type="text" id="ai-icon-desc" maxlength="200">
            <!-- [MODIFIED v2026.9.20] The label is the two letters and
                 nothing more. "Draw with AI" translates to a phrase longer
                 than the button in every language this panel ships, and on
                 a phone it overflowed its own chip. The full sentence moved
                 to title=, where it costs no width. -->
            <button class="action-btn" id="btn-ai-icon" title="Draw with AI">
              <span class="ai-icon-glyph">${ICONS.wand}</span>
              <span id="lbl-ai-icon">AI</span>
            </button>
          </div>
          <div class="url-input-row">
            <input type="text" id="icon-url-input" style="flex:1;padding:8px;background:#111;color:white;border:1px solid #444;border-radius:4px">
            <button class="action-btn" id="btn-load-url">${ICONS.check}</button>
          </div>
          <div style="text-align:center;margin-top:10px;">
            <label class="action-btn" style="width:100%;display:flex;gap:10px;justify-content:center;">
              ${ICONS.image} <span id="lbl-upload-file">Upload File</span>
              <input type="file" id="icon-file-upload" accept="image/*" style="display:none">
            </label>
          </div>
        </div>
      </div>

      <div id="camera-modal">
        <video id="camera-video" autoplay playsinline muted></video>
        <div id="barcode-overlay" class="barcode-overlay"></div>
        <div class="camera-controls">
          <button class="close-cam-btn" id="btn-cam-switch">${ICONS.refresh}</button>
          <button class="snap-btn"      id="btn-cam-snap"></button>
          <button class="wb-btn active" id="btn-cam-wb" title="Toggle AI Background Removal">${ICONS.wand}<span>AI BG</span></button>
          <button class="close-cam-btn" id="btn-cam-close" style="position:absolute;top:-50px;right:20px;background:rgba(0,0,0,.5);border-radius:50%;width:40px;height:40px">✕</button>
        </div>
        <canvas id="camera-canvas"></canvas>
      </div>

      <!-- [ADDED v2026.9.22] The dashboard's expiry list. Its own overlay
           rather than the image one: this is rows of text, and it is
           dismissed by its own button so a stray tap cannot lose the list
           while the user is reading a shelf name off it. -->
      <div id="dash-list-overlay" onclick="if(event.target===this)this.style.display='none'">
        <div class="dash-list-box">
          <div class="dash-list-head">
            <span id="dash-list-title">Expiring soon</span>
            <button class="action-btn" style="min-height:36px;padding:0 12px;" onclick="this.closest('#dash-list-overlay').style.display='none'">${ICONS.close}</button>
          </div>
          <div class="dash-list-body" id="dash-list-body"></div>
        </div>
      </div>

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'">
        <div style="display:flex;flex-direction:column;align-items:center;max-width:90%;max-height:90%;width:100%">
          <img id="overlay-img">
          <div id="overlay-icon-big">${ICONS.item}</div>
          <div id="overlay-details" style="color:white;text-align:center;background:#2a2a2a;padding:20px;border-radius:12px;width:100%;max-width:300px;box-shadow:0 4px 15px rgba(0,0,0,.7);display:none;border:1px solid #444"></div>
          <!-- [ADDED v2026.9.20] Take the photograph off, from the place the
               user is already looking at it. Shown only when there IS one:
               there is nothing to delete about a drawn icon, which is not a
               file and comes back by itself. -->
          <div id="overlay-photo-tools" style="display:none;margin-top:14px">
            <button id="overlay-photo-delete" class="ho-overlay-btn"></button>
          </div>
        </div>
      </div>

      <input type="file" id="universal-file-upload" accept="image/*,application/pdf" style="display:none">
    `;

    let currentLang = localStorage.getItem('home_organizer_lang');
    if (!currentLang && this._hass) {
      currentLang = this._hass.language === 'he' ? 'he' : 'en';
      localStorage.setItem('home_organizer_lang', currentLang);
    }
    if (currentLang === 'en') this.shadowRoot.getElementById('app').classList.add('ltr');

    let currentTheme = localStorage.getItem('home_organizer_theme');
    if (!currentTheme && this._hass) {
      currentTheme = (this._hass.themes?.darkMode) ? 'dark' : 'light';
      localStorage.setItem('home_organizer_theme', currentTheme);
    }
    if (currentTheme === 'light') this.shadowRoot.getElementById('app').classList.add('light-mode');

    if (!this.showIds) this.shadowRoot.getElementById('app').classList.add('hide-catalog-ids');

    const cb = this.shadowRoot.getElementById('ext-cam-checkbox');
    if (cb) cb.checked = this.useExternalCamera;

    this.bindEvents();
    this.makeFabDraggable();
  }

  applyStaticTranslations() {
    const el = id => this.shadowRoot.getElementById(id);
    const set = (id, key, def) => { 
        const e = el(id); 
        if (e) { 
            e.innerHTML = this._t(key, def); 
        } 
    };
    const setPh = (id, key, def) => { 
        const e = el(id); 
        if (e) { 
            e.placeholder = this._t(key, def); 
        } 
    };
    // [ADDED v2026.9.20] A translated tooltip. Some controls are too narrow
    // to carry their own sentence - the AI button is two letters wide - and
    // title= is where the full wording lives for them. textContent, not
    // innerHTML: a title attribute is plain text and never markup.
    const setTitle = (id, key, def) => {
        const e = el(id);
        if (e) {
            e.title = this._t(key, def);
        }
    };

    set('lbl-lang',        'language', 'Language');
    set('lbl-theme',       'theme', 'Theme');
    set('lbl-about',       'about', 'About');
    set('lbl-back1',       'back', 'Back');
    set('lbl-back2',       'back', 'Back');
    set('lbl-light',       'light', 'Light');
    set('lbl-dark',        'dark', 'Dark');
    set('lbl-change-icon', 'change_icon', 'Change Icon');
    set('lbl-upload-file', 'upload_file', 'Upload File');
    set('lbl-ai-icon',     'ai_short', 'AI');
    setTitle('btn-ai-icon', 'ai_draw_icon', 'Draw with AI');
    set('lbl-close',       'back', 'Back');
    set('lbl-loading',     'loading', 'Loading...');
    set('lbl-fab-stylist', 'stylist', 'Stylist');
    set('lbl-fab-chat',    'ai_chat_title', 'Receipts AI');
    set('lbl-fab-recipes', 'recipes_title', 'My Recipes');
    set('lbl-fab-shop',    'shopping_list', 'Shopping List');
    set('lbl-fab-search',  'search_placeholder', 'Search...');
    set('lbl-fab-locations', 'locations', 'Locations');
    set('lbl-fab-barcode', 'barcode_scanner', 'Barcode Scanner');
    
    setPh('search-input',  'search_placeholder', 'Search...');
    setPh('icon-url-input','paste_url', 'Paste URL...');
    setPh('ai-icon-desc',  'ai_icon_hint', 'Describe the item...');

    // Camera App Setup Translations
    set('lbl-ext-menu',         'ext_app_title', '📱 HO_Mind_AI');
    set('lbl-ext-title',        'ext_app_title', '📱 HO_Mind_AI');
    set('lbl-ext-enable',       'ext_app_enable', 'Enable Android App Integration');
    set('lbl-ext-guide-title',  'ext_app_guide_title', '🚀 Setup Guide (Easy enough for a 12-year-old!)');
    set('lbl-ext-guide-intro',  'ext_app_guide_intro', 'To access the settings in the Android app:<br>Click the camera button (📸) on the main chat screen.<br>Then click the gear icon (⚙️).<br><b>This is exactly what you will see there, and what to fill out:</b>');
    set('lbl-ext-settings-title','ext_app_settings_title', 'HO Settings');
    set('lbl-ext-url-hint',     'ext_app_url_hint', '☝️ <b>URL:</b> Enter the exact internal IP of your home server.<br>For example:<br><span dir="ltr">http://192.168.1.100:8123</span>');
    set('lbl-ext-token-hint',   'ext_app_token_hint', '☝️ <b>Security Token:</b><br>In Home Assistant, click your profile (bottom corner).<br>Select the tab:<br><b>Security</b><br>Scroll down until you find:<br><b>Long-Lived Access Tokens</b><br>Generate a new token and paste it here.');
    set('lbl-ext-agent',        'ext_app_agent_id_label', 'Conversation Agent ID:');
    set('lbl-ext-agent-hint',   'ext_app_agent_id_hint', '☝️ <b>Agent:</b><br>This is the default value - no need to touch or change it!');
    set('lbl-ext-device',       'ext_app_device_id_label', 'HA Notify Device ID:');
    set('lbl-ext-device-hint',  'ext_app_device_id_hint', '☝️ <b>Device ID:</b><br>Careful, this is NOT the phone\'s name!<br>In Home Assistant go to:<br><b>Settings ➔ Devices</b><br>Find your phone under Mobile App.<br>Look at the web browser\'s address bar (at the top),<br>and copy the long string of letters and numbers at the very end of the URL.');
    set('lbl-ext-whatsapp',     'ext_app_whatsapp_tip', '💡 <b>Pro Tip:</b><br>The easiest way is to generate the Token and ID on your PC,<br>send them to yourself via <b>WhatsApp</b>,<br>and then simply copy and paste them on your phone!');
    set('lbl-ext-mic',          'ext_app_mic_source_label', 'Microphone Source:');
    set('lbl-ext-mic-bt',       'ext_app_mic_bt_label', 'Use Bluetooth/External Mic');
    set('lbl-ext-mic-bt-hint',  'ext_app_mic_bt_hint', '👈 Leave this OFF (gray).');
    set('lbl-ext-shake',        'ext_app_shake_label', 'Enable Shake to Speak');
    set('lbl-ext-shake-hint',   'ext_app_shake_hint', '☝️ <b>"Ghost Screen" Magic:</b><br>MUST be turned ON (purple)!<br>This allows the app to listen in the background,<br>and use Google\'s speech-to-text engine<br>to understand you with incredible accuracy!');
    set('lbl-ext-lang',         'ext_app_lang_label', 'Voice Assistant Language:');
    set('lbl-ext-lang-hint',    'ext_app_lang_hint', '☝️ <b>Language:</b> Select the language you will speak to the system.');
    set('lbl-ext-vol',          'ext_app_vol_label', 'Assistant Volume Override (Works on Silent):');
    set('lbl-ext-vol-hint',     'ext_app_vol_hint', '☝️ <b>Volume:</b> Adjust the volume.<br>The system will answer aloud even if the phone is on silent!');
    set('lbl-ext-test',         'ext_app_test_area', 'Voice Testing Area');
    set('lbl-ext-test-stt',     'ext_app_test_stt', 'Test STT 🎤');
    set('lbl-ext-test-tts',     'ext_app_test_tts', 'Test TTS 📢');
    set('lbl-ext-test-hint',    'ext_app_test_hint', '☝️ <b>Testing:</b><br>Click to see that it hears you and speaks back.<br>(Leave logs turned off).');
    set('lbl-ext-save',         'ext_app_save_btn', 'Save and Close');
    set('lbl-ext-save-hint',    'ext_app_save_hint', '☝️ <b>All Done:</b><br>Click here to save everything, and you\'re ready to go!');
    set('btn-ext-download',     'ext_app_download_btn', '📥 Download HO_Mind_AI App');
    set('btn-ext-close',        'ext_app_close_btn', 'Close');

    const extScrollArea = el('ext-app-scroll-area');
    if(extScrollArea) {
      const isRtl = this._t('_direction', 'ltr') === 'rtl';
      extScrollArea.style.direction = isRtl ? 'rtl' : 'ltr';
      
      // Ensure the inner mockup stays LTR but text aligns correctly based on main direction
      const hintElements = extScrollArea.querySelectorAll('.mockup-hint');
      hintElements.forEach(h => {
          h.style.direction = isRtl ? 'rtl' : 'ltr';
          h.style.textAlign = isRtl ? 'right' : 'left';
      });
    }
  }

  bindEvents() {
    const root = this.shadowRoot;
    const click = (id, fn) => { const e = root.getElementById(id); if (e) e.onclick = fn; };

    click('btn-user-setup', (e) => {
      e.stopPropagation();
      this.renderMenu();
      const menu = root.getElementById('setup-dropdown-menu');
      this.showMenu('main');
      menu.classList.toggle('show');
    });

    click('btn-setup-ext-app', (e) => {
      e.stopPropagation();
      this.showExternalAppSetup();
    });

    const extCb = root.getElementById('ext-cam-checkbox');
    if (extCb) {
      extCb.onchange = (e) => {
        e.stopPropagation();
        this.toggleExternalCamera();
      };
    }

    window.addEventListener('click', (e) => {
      root.getElementById('setup-dropdown-menu')?.classList.remove('show');
      const fab = root.getElementById('fab-container');
      if (fab && !e.composedPath().includes(fab)) fab.classList.remove('open');
    });

    root.getElementById('setup-dropdown-menu').onclick = e => e.stopPropagation();

    click('btn-ha-menu', () => this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true })));
    click('btn-up',   () => this.navigate('up'));
    // [MODIFIED v2026.9.22] Home opens the dashboard, not the room list.
    //
    // The rooms screen is untouched and is the dashboard's first button.
    // navigate('root') is still called, so the path underneath is reset -
    // leaving Home on a dashboard while the breadcrumb still says
    // Kitchen > Fridge would show the wrong place on the way back.
    click('btn-home', () => {
      this.isShopMode = false; this.isSearch = false; this.isChatMode = false;
      this.isStylistMode = false; this.isReviewMode = false;
      this.isBarcodeMode = false; this.isReceiptsMode = false; this.isDashboardMode = false;
      this.isRecipesMode = false; this.isEditMode = false;
      this.isDashboardMode = true;
      this.clearSearchInput();
      this.navigate('root');
      if (typeof this.loadDashboard === 'function') this.loadDashboard(true);
    });

    click('btn-fab-main', () => root.getElementById('fab-container')?.classList.toggle('open'));

    // [ADDED v2026.9.22] The FAB fades out of the way when it is not wanted.
    //
    // Three seconds of no pointer and no scroll and the ring drops to 45%,
    // so it stops sitting on top of the content; anything the user does
    // brings it back before they can reach for it.
    //
    // pointerdown and scroll, both in the CAPTURE phase - scroll does not
    // bubble, and a capture listener on the root sees it wherever it starts.
    // pointermove is deliberately NOT listened for: on a desktop it fires
    // hundreds of times a second and would rearm the timer on every one.
    //
    // One timer at a time, always cleared before it is re-armed, and never
    // armed while the menu is open - a half-transparent button over an open
    // menu reads as broken rather than as quiet.
    const fabBox = root.getElementById('fab-container');
    if (fabBox) {
      const wakeFab = () => {
        fabBox.classList.remove('idle');
        clearTimeout(this._fabIdleTimer);
        this._fabIdleTimer = setTimeout(() => {
          if (!fabBox.classList.contains('open')) fabBox.classList.add('idle');
        }, 3000);
      };
      root.addEventListener('pointerdown', wakeFab, true);
      root.addEventListener('scroll', wakeFab, true);
      wakeFab();
    }
    const closeFab = () => root.getElementById('fab-container')?.classList.remove('open');

    click('btn-fab-shop',   () => { this.isReceiptsMode=false; this.isDashboardMode = false; this.isShopMode=true;  this.isSearch=false; this.isEditMode=false; this.isChatMode=false; this.isStylistMode=false; this.isReviewMode=false; this.isBarcodeMode=false; this.isRecipesMode=false; closeFab(); this.fetchData(); });
    click('btn-fab-search', () => { this.isReceiptsMode=false; this.isDashboardMode = false; this.isSearch=true;    this.isShopMode=false; this.isChatMode=false; this.isStylistMode=false; this.isReviewMode=false; this.isBarcodeMode=false; this.isRecipesMode=false; closeFab(); this.render(); });
    // [ADDED v2026.9.22] Locations, from the speed dial.
    //
    // This is btn-home's destination, so it clears what btn-home clears -
    // ALL of them. A view mode left on here would win the next render and
    // the user would land somewhere else entirely; that has shipped three
    // times in this panel already (RULE 33a.1).
    click('btn-fab-locations', () => {
      this.isShopMode = false; this.isSearch = false; this.isChatMode = false;
      this.isStylistMode = false; this.isReviewMode = false;
      this.isBarcodeMode = false; this.isReceiptsMode = false; this.isDashboardMode = false;
      this.isRecipesMode = false; this.isEditMode = false;
      this.clearSearchInput(); closeFab(); this.navigate('root');
    });
    click('btn-fab-recipes', () => { this.isChatMode=false; this.isReviewMode=false; this.isReceiptsMode=false; this.isDashboardMode = false; this.isShopMode=false; this.isSearch=false; this.isEditMode=false; this.isStylistMode=false; this.isBarcodeMode=false; this.isRecipesMode=true; closeFab(); this.render(); });
    click('btn-fab-chat',   () => { this.isChatMode=false; this.isReceiptsMode=false; this.isDashboardMode = false; this.isShopMode=false; this.isSearch=false; this.isEditMode=false; this.isStylistMode=false; this.isBarcodeMode=false; this.isRecipesMode=false; this.isReviewMode=true; closeFab(); this.fetchData(); });
    click('btn-fab-stylist',() => { this.isReceiptsMode=false; this.isDashboardMode = false; this.isStylistMode=true; this.isChatMode=false; this.isShopMode=false; this.isSearch=false; this.isEditMode=false; this.isReviewMode=false; this.isBarcodeMode=false; this.isRecipesMode=false; closeFab(); this.render(); });
    click('btn-fab-review', () => { this.isReceiptsMode=false; this.isDashboardMode = false; this.isReviewMode=true; this.isChatMode=false; this.isShopMode=false; this.isSearch=false; this.isEditMode=false; this.isStylistMode=false; this.isBarcodeMode=false; this.isRecipesMode=false; closeFab(); this.fetchData(); });
    
    click('btn-fab-barcode', () => { 
      this.isShopMode=false; this.isSearch=false; this.isChatMode=false; this.isStylistMode=false; this.isReviewMode=false; this.isEditMode=false; this.isReceiptsMode=false; this.isDashboardMode = false;
      this.isRecipesMode=false;
      this.isBarcodeMode=true;
      
      localStorage.removeItem('ho_pending_item_id');
      localStorage.removeItem('ho_pending_item_name');
      this.pendingItemId = null;
      this.pendingItem = null;

      closeFab(); 
      this.render(); 
      
      if (this.useExternalCamera) {
          this.handleBarcodeScan(); 
      }
    });

    click('search-close', () => { this.isSearch=false; this.clearSearchInput(); this.fetchData(); });
    root.getElementById('search-input').oninput = () => this.fetchData();

    // [FIXED v2026.9.17] The pencil edits the screen you are ON.
    //
    // It used to clear every view flag, including isRecipesMode - so pressing
    // it inside the cookbook threw you out to the home screen with the
    // inventory in edit mode. That is not an edit of anything the user was
    // looking at.
    //
    // The cookbook has its own edit affordances (rename and remove a
    // chapter), so there the pencil only flips isEditMode and the screen
    // stays put. Everywhere else it behaves exactly as before.
    //
    // isEditMode is a MODIFIER, not one of the view modes in the RULE 33a.1
    // list, which is why it is correct for it to survive here while the view
    // flags do not move.
    click('btn-edit', () => {
      this.isEditMode = !this.isEditMode;
      if (!this.isRecipesMode) {
        this.isShopMode=false; this.isChatMode=false; this.isStylistMode=false;
        this.isReviewMode=false; this.isBarcodeMode=false; this.isReceiptsMode=false; this.isDashboardMode = false;
      }
      if (!this.isEditMode) this.selectedItems.clear();
      this.render();
    });

    click('btn-view-toggle', () => {
      this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
      root.getElementById('icon-view-grid').style.display = this.viewMode === 'grid' ? 'none' : 'block';
      root.getElementById('icon-view-list').style.display = this.viewMode === 'grid' ? 'block' : 'none';
      this.render();
    });

    click('btn-toggle-ids', () => this.toggleIds());
    
    // Bind the share button to the newly unified method
    click('btn-share-shopping', () => { if(typeof this.shareShoppingList === 'function') this.shareShoppingList(); });
    
    click('btn-paste',      () => this.pasteItem());
    click('btn-load-url',   () => { const url = root.getElementById('icon-url-input').value; if (url) this.handleUrlIcon(url); });
    click('btn-ai-icon',    () => this.drawIconWithAi());
    click('btn-bulk-delete',() => this.bulkDeleteItems());
    click('btn-ai-search',  () => this.openCamera('search'));
    click('btn-ai-upload',  () => this.openFileUpload('search'));
    click('btn-cam-close',  () => this.stopCamera());
    click('btn-cam-snap',   () => this.snapPhoto());
    click('btn-cam-switch', () => this.switchCamera());
    click('btn-cam-wb',     () => { if(typeof this.toggleWhiteBG === 'function') this.toggleWhiteBG(); });

    root.getElementById('icon-file-upload').onchange = e => this.handleIconUpload(e.target);
  }

  renderMenu() {
    const langMenu = this.shadowRoot.getElementById('menu-lang');
    if (!langMenu) return;

    const backBtn = langMenu.querySelector('.back-btn');
    langMenu.innerHTML = '';
    if (backBtn) langMenu.appendChild(backBtn);

    const langNames = {
      en: 'English', he: 'עברית', it: 'Italiano', 
      es: 'Español', fr: 'Français', ar: 'العربية',
      ru: 'Русский'
    };

    (this.availableLangs || []).forEach(lang => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.innerText = langNames[lang] || lang.toUpperCase();
      
      if (this.currentLang === lang) {
        item.style.fontWeight = 'bold';
        item.style.color = 'var(--primary)';
      }

      item.onclick = (e) => {
        e.stopPropagation();
        this.changeLanguage(lang);
        this.shadowRoot.getElementById('setup-dropdown-menu').classList.remove('show');
      };
      
      langMenu.appendChild(item);
    });
  }

  // [MODIFIED v2026.9.20] Every change of screen passes through here, so
  // this is where the position is recorded. saveNavState writes only when
  // something actually moved, and swallows a storage failure.
  render() { this.saveNavState(); this.updateUI(); }

  updateUI() {
    if (!this.localData) return;
    const attrs = this.localData;
    const root  = this.shadowRoot;

    this.applyStaticTranslations();

    root.getElementById('display-title').innerText = this._t('app_title', 'HO-AI');

    let pathDisplay = this._t('default_path', 'Main');
    if      (this.isStylistMode)  pathDisplay = "👗 " + this._t('stylist', 'Stylist');
    else if (this.isChatMode)     pathDisplay = this._t('ai_chat_title', 'Receipts AI');
    else if (this.isRecipesMode)  pathDisplay = this._t('recipes_title', 'My Recipes');
    else if (this.isReceiptsMode) pathDisplay = this._t('receipts_tab', 'Receipts');
    else if (this.isReviewMode)   pathDisplay = this._t('review_tab', 'AI Receipts Exports');
    else if (this.isShopMode)     pathDisplay = this._t('shopping_list', 'Shopping List');
    else if (this.isSearch)       pathDisplay = this._t('search_results', 'Search Results');
    else if (this.isBarcodeMode)  pathDisplay = this._t('barcode_scanner', 'Barcode Scanner'); 
    else if (attrs.path_display && attrs.path_display !== "Main") pathDisplay = attrs.path_display;
    root.getElementById('display-path').innerText = pathDisplay;

    root.getElementById('search-box').style.display  = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display   = attrs.clipboard ? 'flex' : 'none';
    if (attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;

    // [ADDED v2026.9.22] The ring doubles as the scan's progress indicator.
    //
    // Synced HERE rather than toggled at the call site: view-chat.js already
    // sets scanInProgress and re-renders on every way out of a scan - the
    // success, the duplicate, the error and the throw - so reading the flag
    // once per render covers all four, and no future exit path can forget to
    // turn the spinner off.
    // [ADDED v2026.9.22] #content becomes the frame the cookbook docks into.
    //
    // The Sous-Chef column is position:fixed, and fixed is measured against
    // the WINDOW - which on a desktop starts behind Home Assistant's own
    // sidebar, so the column covered it. An ancestor carrying a transform
    // becomes the containing block for fixed descendants instead, and
    // #content is exactly the right box: it begins where the panel's own
    // bars end and where the sidebar stops.
    //
    // A class rather than :has(.cookbook-wrap) on purpose - this has to be
    // deterministic and checkable without a browser, and :has is silently
    // absent on older webviews. Toggled on every render, so leaving the
    // cookbook takes it off again and no other screen inherits a transform
    // it never asked for (RULE 33a.1).
    const contentBox = root.getElementById('content');
    if (contentBox) contentBox.classList.toggle('dock-host', !!this.isRecipesMode);

    const fabMain = root.getElementById('btn-fab-main');
    if (fabMain) fabMain.classList.toggle('busy', !!this.scanInProgress);

    const wrapChat    = root.getElementById('wrap-fab-chat');
    const wrapStylist = root.getElementById('wrap-fab-stylist');
    if (wrapChat)    wrapChat.style.display    = attrs.enable_ai ? 'flex' : 'none';
    if (wrapStylist) wrapStylist.style.display = 'flex';

    const app = root.getElementById('app');
    if (this.isEditMode) app.classList.add('edit-mode'); else app.classList.remove('edit-mode');

    const editBtn = root.getElementById('btn-edit');
    if (editBtn) { if (this.isEditMode) editBtn.classList.add('edit-active'); else editBtn.classList.remove('edit-active'); }

    const bulkDelBtn = root.getElementById('btn-bulk-delete');
    if (bulkDelBtn) {
      if (this.isEditMode && this.selectedItems.size > 0) {
        bulkDelBtn.style.display = 'flex';
        bulkDelBtn.innerHTML = `${ICONS.delete} <span style="font-size:12px;font-weight:bold;margin-inline-start:5px;">(${this.selectedItems.size})</span>`;
      } else bulkDelBtn.style.display = 'none';
    }

    const shareBtn = root.getElementById('btn-share-shopping');
    if (shareBtn) shareBtn.style.display = this.isShopMode ? 'flex' : 'none';

    const upBtn = root.getElementById('btn-up');
    if (upBtn) upBtn.style.display = attrs.depth === 0 ? 'none' : 'flex';

    const viewBtn   = root.getElementById('btn-view-toggle');
    const toggleBtn = root.getElementById('btn-toggle-ids');

    if (viewBtn)   viewBtn.style.display   = attrs.depth >= 2 ? 'block' : 'none';
    if (toggleBtn) {
      toggleBtn.style.display = attrs.depth >= 2 ? 'none' : 'flex';
      toggleBtn.style.color   = this.showIds ? 'var(--catalog-bg)' : 'var(--primary)';
    }

    const content = root.getElementById('content');
    content.innerHTML = '';
    // [FIXED v2026.9.20] Clear the WHOLE inline style, not three properties.
    //
    // Views style this element inline on their way in, and this is the one
    // place that undoes it. It listed padding, display and flexDirection -
    // but the cookbook also sets overflow: hidden, which was never cleared.
    // .content carries overflow-y: auto from the stylesheet, so one visit to
    // the cookbook left every later screen unable to scroll: the rooms, the
    // locations and the sub-locations all looked frozen once the list was
    // taller than the window.
    //
    // Naming properties means this breaks again the next time a view sets a
    // fourth one. Removing the attribute cannot: whatever a view wrote on
    // the way in is gone on the way out, and the stylesheet decides again.
    content.removeAttribute('style');

    if (this.isBarcodeMode && typeof this.renderBarcodeView === 'function') return this.renderBarcodeView(content);
    if (this.isStylistMode && typeof this.renderStylistView === 'function') return this.renderStylistView(content, attrs);
    // [FIXED v2026.9.15] isReceiptsMode was missing from this condition, so
    // opening the Receipts tab cleared the other two flags, matched nothing
    // here, and fell through to the home screen.
    // [ADDED v2026.10.9] Cookbook. Checked before the receipts branch so
    // the two cannot both claim a render.
    if (this.isRecipesMode && typeof this.renderRecipesView === 'function') return this.renderRecipesView(content, attrs);
    // [ADDED v2026.9.22] The dashboard is checked first. It is the screen
    // the Home button now opens, and its flag is cleared by every other
    // entry point, so reaching here with it on means it is the one wanted.
    if (this.isDashboardMode && typeof this.renderDashboardView === 'function') {
      return this.renderDashboardView(content);
    }
    if ((this.isChatMode || this.isReviewMode || this.isReceiptsMode) && typeof this.renderChatAndReviewView === 'function') return this.renderChatAndReviewView(content, attrs);
    if (this.isShopMode && typeof this.renderShoppingView === 'function') return this.renderShoppingView(content, attrs);
    if ((this.isSearch || attrs.path_display?.startsWith('Search')) && attrs.items && typeof this.renderSearchView === 'function') return this.renderSearchView(content, attrs);

    if (attrs.depth === 0 && typeof this.renderRoomsView === 'function') return this.renderRoomsView(content, attrs);
    if (attrs.depth < 2 && typeof this.renderLocationsView === 'function') return this.renderLocationsView(content, attrs);
    if (typeof this.renderItemsView === 'function') return this.renderItemsView(content, attrs);
  }

  showItemDetails(item) {
    const ov     = this.shadowRoot.getElementById('img-overlay');
    const img    = this.shadowRoot.getElementById('overlay-img');
    const det    = this.shadowRoot.getElementById('overlay-details');
    const iconBig = this.shadowRoot.getElementById('overlay-icon-big');
    ov.style.display = 'flex'; det.style.display = 'block';
    // [MODIFIED v2026.9.20] Three possibilities, not two.
    //
    // This branched on "library key, or else a photograph", with a third
    // copy of the icon case for an item that had neither. An icon the
    // assistant DREW is a fourth thing, and getItemIcon is what knows the
    // order - photograph, drawn icon, library, default - so the branch here
    // is now only "is it a photograph".
    //
    // The icon is sized to 140px, which is why a drawn one has to be
    // designed for the large view: it is a vector, so enlarging costs no
    // quality, but a drawing with too little in it looks empty at this size.
    if (this.itemHasPhoto(item)) {
      const cleanPath = String(item.img).split('?')[0];
      const ver = this.imageVersions[item.id] || 'ok';
      img.src = `${cleanPath}?v=${ver}`;
      img.style.display = 'block'; iconBig.style.display = 'none';
      this.showOverlayPhotoTools(item);
    } else {
      img.style.display = 'none';
      this.showOverlayPhotoTools(null);
      iconBig.innerHTML = this.getItemIcon(item);
      const svgEl = iconBig.querySelector('svg');
      if (svgEl) { svgEl.style.width = '140px'; svgEl.style.height = '140px'; }
      iconBig.style.display = 'block';
    }
    det.innerHTML = `<div style="font-size:20px;font-weight:bold;margin-bottom:8px">${escapeHtml(item.name)}</div><div style="font-size:16px;color:#aaa;margin-bottom:15px">${escapeHtml(item.date||this.t('no_date'))}</div><div style="font-size:18px;font-weight:bold;color:var(--accent);background:#333;padding:8px 20px;border-radius:20px;display:inline-block">${escapeHtml(this.t('quantity'))}: ${escapeHtml(item.qty)}</div>`;
  }

  // [ADDED v2026.9.20] The delete control under an enlarged photograph.
  //
  // Wired here rather than in the template, because a handler cannot be
  // attached from an innerHTML string. Passing null hides it, which is what
  // an item showing a drawn icon or the default gets - neither is a file and
  // neither has anything to delete.
  showOverlayPhotoTools(item) {
    const tools = this.shadowRoot.getElementById('overlay-photo-tools');
    const btn = this.shadowRoot.getElementById('overlay-photo-delete');
    if (!tools || !btn) return;
    if (!item) { tools.style.display = 'none'; btn.onclick = null; return; }
    tools.style.display = 'block';
    btn.textContent = this._t('delete_photo', 'Delete photo');
    btn.onclick = (e) => {
      e.stopPropagation();
      if (!window.confirm(this._t('delete_photo_confirm', 'Delete this photo?'))) return;
      this.shadowRoot.getElementById('img-overlay').style.display = 'none';
      this.deleteItemPhoto(item.id);
    };
  }

  // Clear an item's photograph. What it falls back to is whatever it had
  // underneath - a drawn icon, a library icon, or the default.
  async deleteItemPhoto(itemId) {
    try {
      await this.callHA('update_image', { item_id: itemId, image_data: '' });
      this.refreshImageVersion(itemId);
      this.fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  showItemDetailsProxy(itemId) {
    if (!this.localData) return;
    const item = (this.localData.items||[]).find(i=>i.id==itemId) || (this.localData.shopping_list||[]).find(i=>i.id==itemId) || (this.localData.pending_list||[]).find(i=>i.id==itemId);
    if (item) this.showItemDetails(item);
  }

  showImg(src) {
    const ov = this.shadowRoot.getElementById('img-overlay');
    const img = this.shadowRoot.getElementById('overlay-img');
    const det = this.shadowRoot.getElementById('overlay-details');
    const iconBig = this.shadowRoot.getElementById('overlay-icon-big');
    if (!ov || !img || !iconBig) return;
    if (src?.startsWith('ICON_LIB')) {
      iconBig.innerHTML = this.getIconByKey(src) || ICONS.item;
      const svgEl = iconBig.querySelector('svg'); if (svgEl) { svgEl.style.width='140px'; svgEl.style.height='140px'; }
      img.style.display = 'none'; iconBig.style.display = 'block';
    } else { 
      img.src = src; img.style.display = 'block'; iconBig.style.display = 'none'; 
    }
    if (det) det.style.display = 'none';
    ov.style.display = 'flex';
  }

  makeFabDraggable() {
    const fabElement = this.shadowRoot?.querySelector('.fab-container') || document.querySelector('.fab-container');
    if (!fabElement || fabElement.dataset.draggableAttached) return;
    fabElement.dataset.draggableAttached = "true";
    let isDragging=false, currentX=0, currentY=0, initialX=0, initialY=0, xOffset=0, yOffset=0;

    const dragStart = e => {
      if (e.target.closest('.fab-menu-item')) return;
      const clientX = e.type==='touchstart' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type==='touchstart' ? e.touches[0].clientY : e.clientY;
      initialX = clientX - xOffset; initialY = clientY - yOffset; isDragging = true;
    };
    const dragEnd  = () => { initialX=currentX; initialY=currentY; isDragging=false; };
    const drag     = e => {
      if (!isDragging) return;
      e.preventDefault();
      const clientX = e.type==='touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type==='touchmove' ? e.touches[0].clientY : e.clientY;
      currentX = clientX - initialX; currentY = clientY - initialY;
      xOffset = currentX; yOffset = currentY;
      fabElement.style.transform = `translate3d(${currentX}px,${currentY}px,0)`;
    };
    fabElement.addEventListener('touchstart', dragStart, { passive:false });
    fabElement.addEventListener('touchend',   dragEnd,   false);
    fabElement.addEventListener('touchmove',  drag,      { passive:false });
    fabElement.addEventListener('mousedown',  dragStart, false);
    window.addEventListener('mouseup',        dragEnd,   false);
    window.addEventListener('mousemove',      drag,      false);
  }
};