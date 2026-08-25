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
// [MODIFIED v10.4.4 | 2026-08-02] Purpose: Changed the Android App download button to point to the GitHub Releases page. Updated labels and UI strings from HOCameraApp to HO_Mind_AI to reflect the new repository and application name.
// [MODIFIED v10.4.3 | 2026-05-13] Purpose: Enhanced translation strings for the Android setup modal. Replaced long paragraphs with bulleted, multi-line instructions, specifically isolating English LTR terms (URLs, IDs, Navigation paths) into their own lines using <br> and <span dir="ltr"> to prevent RTL layout breakage in Hebrew. Clarified the precise method for extracting the HA Notify Device ID from the browser URL bar.

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
      <link rel="stylesheet" href="/home_organizer_static/pages/shopping.css?v=${timestamp}">
      <link rel="stylesheet" href="/home_organizer_static/pages/search.css?v=${timestamp}">
      <style>
        .fab-container { position:fixed; bottom:30px; right:30px; z-index:1000; display:flex; flex-direction:column-reverse; align-items:flex-end; gap:15px; pointer-events:none; }
        :host-context(.rtl) .fab-container, .rtl .fab-container, [dir="rtl"] .fab-container { right:auto; left:30px; align-items:flex-start; }
        .fab-main { width:60px; height:60px; border-radius:50%; background:var(--primary,#03a9f4); color:white; border:none; font-size:28px; box-shadow:0 4px 15px rgba(0,0,0,0.4); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:transform .3s cubic-bezier(.175,.885,.32,1.275),background .3s; outline:none; pointer-events:auto; }
        .fab-container.open .fab-main { transform:rotate(45deg); background:var(--danger,#F44336); }
        .fab-menu { display:flex; flex-direction:column; align-items:flex-end; gap:12px; opacity:0; visibility:hidden; transform:translateY(20px) scale(.8); transition:all .3s cubic-bezier(.175,.885,.32,1.275); transform-origin:bottom center; pointer-events:none; }
        :host-context(.rtl) .fab-menu, .rtl .fab-menu, [dir="rtl"] .fab-menu { align-items:flex-start; }
        .fab-container.open .fab-menu { opacity:1; visibility:visible; transform:translateY(0) scale(1); pointer-events:auto; }
        .fab-item-wrapper { display:flex; align-items:center; gap:10px; }
        :host-context(.rtl) .fab-item-wrapper, .rtl .fab-item-wrapper, [dir="rtl"] .fab-item-wrapper { flex-direction:row-reverse; }
        .fab-tooltip { background:var(--bg-card,#333); color:var(--text-main,#fff); padding:6px 12px; border-radius:6px; font-size:14px; font-weight:500; box-shadow:0 2px 8px rgba(0,0,0,.2); white-space:nowrap; border:1px solid var(--border-light,#444); }
        .fab-item { width:50px; height:50px; border-radius:50%; background:var(--bg-card,#2a2a2a); color:var(--text-main,#fff); border:1px solid var(--border-light,#444); font-size:20px; box-shadow:0 3px 10px rgba(0,0,0,.2); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:transform .2s,background .2s,color .2s; outline:none; pointer-events:auto; }
        .fab-item:hover { transform:scale(1.1); background:var(--primary,#03a9f4); color:white; border-color:var(--primary,#03a9f4); }
        .fab-item svg { width:24px; height:24px; fill:currentColor; }
        
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
              <span class="fab-tooltip" id="lbl-fab-shop">Shopping</span>
              <button class="fab-item" id="btn-fab-shop">${ICONS.cart}</button>
            </div>
            <div class="fab-item-wrapper">
              <span class="fab-tooltip" id="lbl-fab-search">Search</span>
              <button class="fab-item" id="btn-fab-search">${ICONS.search}</button>
            </div>
            <div class="fab-item-wrapper" id="wrap-fab-chat">
              <span class="fab-tooltip" id="lbl-fab-chat">AI Chat</span>
              <button class="fab-item" id="btn-fab-chat">${ICONS.robot}</button>
            </div>
            <div class="fab-item-wrapper" id="wrap-fab-barcode">
              <span class="fab-tooltip" id="lbl-fab-barcode">Barcode Scanner</span>
              <button class="fab-item" id="btn-fab-barcode">${ICONS.barcode}</button>
            </div>
            <div class="fab-item-wrapper" id="wrap-fab-stylist" >
              <span class="fab-tooltip" id="lbl-fab-stylist">Stylist</span>
              <button class="fab-item" id="btn-fab-stylist">👗</button>
            </div>
          </div>
          <button class="fab-main" id="btn-fab-main">✨</button>
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

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'">
        <div style="display:flex;flex-direction:column;align-items:center;max-width:90%;max-height:90%;width:100%">
          <img id="overlay-img">
          <div id="overlay-icon-big">${ICONS.item}</div>
          <div id="overlay-details" style="color:white;text-align:center;background:#2a2a2a;padding:20px;border-radius:12px;width:100%;max-width:300px;box-shadow:0 4px 15px rgba(0,0,0,.7);display:none;border:1px solid #444"></div>
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

    set('lbl-lang',        'language', 'Language');
    set('lbl-theme',       'theme', 'Theme');
    set('lbl-about',       'about', 'About');
    set('lbl-back1',       'back', 'Back');
    set('lbl-back2',       'back', 'Back');
    set('lbl-light',       'light', 'Light');
    set('lbl-dark',        'dark', 'Dark');
    set('lbl-change-icon', 'change_icon', 'Change Icon');
    set('lbl-upload-file', 'upload_file', 'Upload File');
    set('lbl-close',       'back', 'Back');
    set('lbl-loading',     'loading', 'Loading...');
    set('lbl-fab-stylist', 'stylist', 'Stylist');
    set('lbl-fab-chat',    'ai_chat_title', 'AI Chat');
    set('lbl-fab-shop',    'shopping_list', 'Shopping List');
    set('lbl-fab-search',  'search_placeholder', 'Search...');
    set('lbl-fab-barcode', 'barcode_scanner', 'Barcode Scanner');
    
    setPh('search-input',  'search_placeholder', 'Search...');
    setPh('icon-url-input','paste_url', 'Paste URL...');

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
    click('btn-home', () => {
      this.isShopMode = false; this.isSearch = false; this.isChatMode = false; this.isStylistMode = false; this.isReviewMode = false; this.isBarcodeMode = false;
      this.clearSearchInput(); this.navigate('root');
    });

    click('btn-fab-main', () => root.getElementById('fab-container')?.classList.toggle('open'));
    const closeFab = () => root.getElementById('fab-container')?.classList.remove('open');

    click('btn-fab-shop',   () => { this.isShopMode=true;  this.isSearch=false; this.isEditMode=false; this.isChatMode=false; this.isStylistMode=false; this.isReviewMode=false; this.isBarcodeMode=false; closeFab(); this.fetchData(); });
    click('btn-fab-search', () => { this.isSearch=true;    this.isShopMode=false; this.isChatMode=false; this.isStylistMode=false; this.isReviewMode=false; this.isBarcodeMode=false; closeFab(); this.render(); });
    click('btn-fab-chat',   () => { this.isChatMode=true;  this.isShopMode=false; this.isSearch=false; this.isEditMode=false; this.isStylistMode=false; this.isReviewMode=false; this.isBarcodeMode=false; closeFab(); this.render(); });
    click('btn-fab-stylist',() => { this.isStylistMode=true; this.isChatMode=false; this.isShopMode=false; this.isSearch=false; this.isEditMode=false; this.isReviewMode=false; this.isBarcodeMode=false; closeFab(); this.render(); });
    click('btn-fab-review', () => { this.isReviewMode=true; this.isChatMode=false; this.isShopMode=false; this.isSearch=false; this.isEditMode=false; this.isStylistMode=false; this.isBarcodeMode=false; closeFab(); this.fetchData(); });
    
    click('btn-fab-barcode', () => { 
      this.isShopMode=false; this.isSearch=false; this.isChatMode=false; this.isStylistMode=false; this.isReviewMode=false; this.isEditMode=false; 
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

    click('btn-edit', () => {
      this.isEditMode = !this.isEditMode; this.isShopMode=false; this.isChatMode=false; this.isStylistMode=false; this.isReviewMode=false; this.isBarcodeMode=false;
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

  render() { this.updateUI(); }

  updateUI() {
    if (!this.localData) return;
    const attrs = this.localData;
    const root  = this.shadowRoot;

    this.applyStaticTranslations();

    root.getElementById('display-title').innerText = this._t('app_title', 'HO-AI');

    let pathDisplay = this._t('default_path', 'Main');
    if      (this.isStylistMode)  pathDisplay = "👗 " + this._t('stylist', 'Stylist');
    else if (this.isChatMode)     pathDisplay = this._t('ai_chat_title', 'AI Chat');
    else if (this.isReviewMode)   pathDisplay = this._t('review_tab', 'Review');
    else if (this.isShopMode)     pathDisplay = this._t('shopping_list', 'Shopping List');
    else if (this.isSearch)       pathDisplay = this._t('search_results', 'Search Results');
    else if (this.isBarcodeMode)  pathDisplay = this._t('barcode_scanner', 'Barcode Scanner'); 
    else if (attrs.path_display && attrs.path_display !== "Main") pathDisplay = attrs.path_display;
    root.getElementById('display-path').innerText = pathDisplay;

    root.getElementById('search-box').style.display  = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display   = attrs.clipboard ? 'flex' : 'none';
    if (attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;

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
    content.style.padding = '';
    content.style.display = '';
    content.style.flexDirection = '';

    if (this.isBarcodeMode && typeof this.renderBarcodeView === 'function') return this.renderBarcodeView(content);
    if (this.isStylistMode && typeof this.renderStylistView === 'function') return this.renderStylistView(content, attrs);
    if ((this.isChatMode || this.isReviewMode) && typeof this.renderChatAndReviewView === 'function') return this.renderChatAndReviewView(content, attrs);
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
    if (item.img) {
      if (item.img.startsWith('ICON_LIB')) {
        img.style.display = 'none'; iconBig.innerHTML = this.getIconByKey(item.img) || ICONS.item;
        const svgEl = iconBig.querySelector('svg'); if (svgEl) { svgEl.style.width='140px'; svgEl.style.height='140px'; }
        iconBig.style.display = 'block';
      } else { 
        let cleanPath = item.img.split('?')[0]; 
        const ver = this.imageVersions[item.id] || 'ok';
        img.src = `${cleanPath}?v=${ver}`; 
        img.style.display = 'block'; iconBig.style.display = 'none'; 
      }
    } else {
      img.style.display = 'none'; iconBig.innerHTML = ICONS.item;
      const svgEl = iconBig.querySelector('svg'); if (svgEl) { svgEl.style.width='140px'; svgEl.style.height='140px'; }
      iconBig.style.display = 'block';
    }
    det.innerHTML = `<div style="font-size:20px;font-weight:bold;margin-bottom:8px">${escapeHtml(item.name)}</div><div style="font-size:16px;color:#aaa;margin-bottom:15px">${escapeHtml(item.date||this.t('no_date'))}</div><div style="font-size:18px;font-weight:bold;color:var(--accent);background:#333;padding:8px 20px;border-radius:20px;display:inline-block">${escapeHtml(this.t('quantity'))}: ${escapeHtml(item.qty)}</div>`;
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