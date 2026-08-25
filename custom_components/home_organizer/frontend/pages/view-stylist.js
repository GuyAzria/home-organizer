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
// [MODIFIED v10.2.5 | 2026-04-17] Purpose: Replaced generic shoe icon with a highly detailed, clear Sneaker SVG. Connected all Wizard UI elements to the dynamic translation dictionary for all languages based on the new CSV structure.

import { ICONS } from '../organizer-icon.js?v=10.2.5';
import { formatAiText } from '../organizer-utils.js?v=2026.8.26';

export const StylistMixin = (Base) => class extends Base {

  appendWizardModal(container) {
      if (this.shadowRoot.getElementById('body-profile-modal')) return;

      const UPLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>';

      container.insertAdjacentHTML('beforeend', `
        <div id="body-profile-modal" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:3500;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;">
          <div class="modal-content" onclick="event.stopPropagation()" style="text-align:start;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;">
            <div id="lbl-wiz-title" style="margin-bottom:15px;font-size:20px;font-weight:bold;color:var(--primary);text-align:center;">📏 Body Profile Wizard</div>
            
            <div id="lbl-wiz-desc" style="font-size:13px;color:var(--text-sub);line-height:1.6;margin-bottom:20px;text-align:center;">
              Enter your exact measurements to allow the AI to mathematically check if garments will fit you before recommending them!
            </div>

            <!-- 1. Basic Info -->
            <div style="background:var(--bg-input-edit);padding:15px;border-radius:8px;margin-bottom:15px;border:1px solid var(--border-light);">
              <div id="lbl-wiz-basic" style="font-weight:bold;font-size:14px;color:var(--accent);margin-bottom:10px;">1. Basic Info</div>
              <div style="display:flex;gap:10px;">
                <input type="text" id="wiz-name" style="flex:1;padding:8px;border-radius:6px;border:1px solid #444;background:#111;color:white;box-sizing:border-box;" placeholder="Name">
                <input type="number" id="wiz-weight" style="flex:1;padding:8px;border-radius:6px;border:1px solid #444;background:#111;color:white;box-sizing:border-box;" placeholder="Weight">
              </div>
            </div>

            <!-- 2. Top -->
            <div style="background:var(--bg-input-edit);padding:15px;border-radius:8px;margin-bottom:15px;border:1px solid var(--border-light);display:flex;gap:15px;align-items:center;">
              <div style="flex:1;">
                <div id="lbl-wiz-top" style="font-weight:bold;font-size:14px;color:var(--primary);margin-bottom:10px;">2. Top Measurements (cm)</div>
                <input type="number" id="wiz-chest" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#111;color:white;margin-bottom:10px;box-sizing:border-box;" placeholder="Chest">
                <input type="number" id="wiz-shoulders" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#111;color:white;box-sizing:border-box;" placeholder="Shoulders">
              </div>
              <svg viewBox="0 0 100 100" style="width:100px;height:100px;flex-shrink:0;">
                <path d="M 20 40 Q 50 20 80 40" fill="none" stroke="#888" stroke-width="2"/>
                <path d="M 20 40 L 25 90 M 80 40 L 75 90" fill="none" stroke="#888" stroke-width="2"/>
                <line x1="22" y1="50" x2="78" y2="50" stroke="#03a9f4" stroke-width="3" stroke-dasharray="4"/>
                <text id="svg-txt-chest" x="50" y="46" fill="#03a9f4" font-size="12" font-weight="bold" text-anchor="middle">Chest</text>
                <line x1="20" y1="33" x2="80" y2="33" stroke="#4caf50" stroke-width="3" stroke-dasharray="4"/>
                <text id="svg-txt-shoulders" x="50" y="29" fill="#4caf50" font-size="12" font-weight="bold" text-anchor="middle">Shoulders</text>
              </svg>
            </div>

            <!-- 3. Bottom -->
            <div style="background:var(--bg-input-edit);padding:15px;border-radius:8px;margin-bottom:15px;border:1px solid var(--border-light);display:flex;gap:15px;align-items:center;">
              <div style="flex:1;">
                <div id="lbl-wiz-bottom" style="font-weight:bold;font-size:14px;color:var(--warning);margin-bottom:10px;">3. Bottom Measurements (cm)</div>
                <input type="number" id="wiz-waist" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#111;color:white;margin-bottom:10px;box-sizing:border-box;" placeholder="Waist">
                <input type="number" id="wiz-inseam" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#111;color:white;box-sizing:border-box;" placeholder="Inseam">
              </div>
              <svg viewBox="0 0 100 100" style="width:100px;height:100px;flex-shrink:0;">
                <path d="M 25 20 L 75 20" fill="none" stroke="#888" stroke-width="2"/>
                <path d="M 25 20 L 20 90 M 75 20 L 80 90 M 50 45 L 45 90 M 50 45 L 55 90" fill="none" stroke="#888" stroke-width="2"/>
                <line x1="25" y1="20" x2="75" y2="20" stroke="#ffeb3b" stroke-width="3" stroke-dasharray="4"/>
                <text id="svg-txt-waist" x="50" y="16" fill="#ffeb3b" font-size="12" font-weight="bold" text-anchor="middle">Waist</text>
                <line x1="50" y1="45" x2="45" y2="90" stroke="#F44336" stroke-width="3" stroke-dasharray="4"/>
                <text id="svg-txt-inseam" x="35" y="70" fill="#F44336" font-size="12" font-weight="bold" text-anchor="middle">Inseam</text>
              </svg>
            </div>
            
            <!-- 4. Shoe Size [MODIFIED v10.2.5: Brand New Realistic Sneaker SVG] -->
            <div style="background:var(--bg-input-edit);padding:15px;border-radius:8px;margin-bottom:20px;border:1px solid var(--border-light);display:flex;gap:15px;align-items:center;">
              <div style="flex:1;">
                <div id="lbl-wiz-shoes" style="font-weight:bold;font-size:14px;color:#9c27b0;margin-bottom:10px;">4. Shoe Size</div>
                <input type="number" id="wiz-shoes" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#111;color:white;box-sizing:border-box;" placeholder="e.g. 42">
              </div>
              <div style="width:100px;height:100px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#9c27b0;">
                <svg viewBox="0 0 100 100" style="width:75px;height:75px;fill:none;stroke:currentColor;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;">
                    <!-- Sole -->
                    <path d="M 10 80 L 90 80 Q 95 80 95 70 L 15 70 Q 10 70 10 80 Z" fill="#9c27b0" opacity="0.2"/>
                    <!-- Shoe body -->
                    <path d="M 15 70 L 15 40 Q 15 30 25 30 L 40 30 Q 50 30 55 45 L 65 50 Q 80 50 95 60 L 95 70 Z" />
                    <!-- Laces -->
                    <line x1="25" y1="30" x2="35" y2="40" />
                    <line x1="25" y1="40" x2="40" y2="45" />
                    <!-- Detail lines -->
                    <path d="M 50 70 Q 60 55 75 55" />
                </svg>
              </div>
            </div>

            <!-- 5. Avatar Image -->
            <div style="background:var(--bg-input-edit);padding:15px;border-radius:8px;margin-bottom:20px;border:1px solid var(--border-light);display:flex;flex-direction:column;gap:10px;">
              <div id="lbl-wiz-avatar" style="font-weight:bold;font-size:14px;color:var(--primary);">5. Avatar Image</div>
              <div id="lbl-wiz-avatar-desc" style="font-size:12px;color:var(--text-sub);">Upload or capture a full-body photo for Virtual Try-On.</div>
              <div style="display:flex; gap:10px; width:100%; margin-top:5px;">
                  <button class="action-btn" style="flex:1;height:45px;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="const host=this.getRootNode().host; if(host.useExternalCamera) window.location.href='hocamera://capture?context=stylist_avatar&m=Capture%20Avatar&s=Take%20a%20full-body%20photo&b=Save%20Avatar'; else host.openCamera('stylist_avatar');">
                    ${ICONS.camera} <span id="btn-wiz-cam-txt">Take Photo</span>
                  </button>
                  <button class="action-btn" style="flex:1;height:45px;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="this.getRootNode().host.openFileUpload('stylist_avatar')">
                    ${UPLOAD_SVG} <span id="btn-wiz-upload-txt">Upload Image</span>
                  </button>
              </div>
            </div>

            <button id="btn-wiz-save" class="action-btn" style="width:100%;margin-bottom:10px;background:var(--success);color:white;font-weight:bold;height:45px;" onclick="if(typeof this.getRootNode().host.saveBodyProfile === 'function') this.getRootNode().host.saveBodyProfile()">
              💾 Save Body Profile
            </button>
            <button id="btn-wiz-cancel" class="action-btn" style="width:100%;height:45px;" onclick="this.closest('#body-profile-modal').style.display='none'">Cancel</button>
          </div>
        </div>
      `);
  }

  applyWizardTranslations() {
      const root = this.shadowRoot;
      const el = id => root.getElementById(id);
      const set = (id, key, def) => { const e = el(id); if (e) { e.innerHTML = this._t(key, def); } };
      const setPh = (id, key, def) => { const e = el(id); if (e) { e.placeholder = this._t(key, def); } };

      set('lbl-wiz-title',   'wiz_profile_title', '📏 Body Profile Wizard');
      set('lbl-wiz-desc',    'wiz_profile_desc', 'Enter your exact measurements to allow the AI to mathematically check if garments will fit you before recommending them!');
      set('lbl-wiz-basic',   'wiz_basic_info', '1. Basic Info');
      set('lbl-wiz-top',     'wiz_top_meas', '2. Top Measurements (cm)');
      set('lbl-wiz-bottom',  'wiz_bottom_meas', '3. Bottom Measurements (cm)');
      set('lbl-wiz-shoes',   'wiz_shoes_title', '4. Shoe Size');
      set('lbl-wiz-avatar',  'wiz_avatar_title', '5. Avatar Image');
      set('lbl-wiz-avatar-desc', 'wiz_avatar_desc', 'Upload or capture a full-body photo for Virtual Try-On.');
      
      set('svg-txt-chest',   'wiz_chest', 'Chest');
      set('svg-txt-shoulders','wiz_shoulders', 'Shoulders');
      set('svg-txt-waist',   'wiz_waist', 'Waist');
      set('svg-txt-inseam',  'wiz_inseam', 'Inseam');
      set('btn-wiz-save',    'wiz_save_profile', '💾 Save Body Profile');
      set('btn-wiz-cancel',  'cancel', 'Cancel');

      set('btn-wiz-cam-txt', 'take_photo', 'Take Photo');
      set('btn-wiz-upload-txt', 'upload_image', 'Upload Image');

      setPh('wiz-name',      'wiz_name_placeholder', 'Name (e.g. Guy)');
      setPh('wiz-weight',    'wiz_weight_placeholder', 'Weight (kg)');
      setPh('wiz-chest',     'wiz_chest', 'Chest');
      setPh('wiz-shoulders', 'wiz_shoulders', 'Shoulders');
      setPh('wiz-waist',     'wiz_waist', 'Waist');
      setPh('wiz-inseam',    'wiz_inseam', 'Inseam');
      setPh('wiz-shoes',     'wiz_shoes_placeholder', 'Shoe Size');
  }

  executeStylistChat(text, imgData, currentMime) {
    if (!text && !imgData) return;

    this.stylistHistory.push({ role:'user', text: text, image:imgData, mime_type:currentMime });
    this.chatImage = null; this.chatMimeType = "image/jpeg";
    
    const chatInput = this.shadowRoot.querySelector('.chat-input');
    if (chatInput) chatInput.value = '';
    
    this.render();

    const statusIdx = this.stylistHistory.length;
    this.stylistHistory.push({ role: 'system', text: this._t('stylist_analyzing', 'Analyzing your wardrobe and the weather...') });
    this.render();

    const routeText = "stylist " + text;
    this._hass.callWS({
        type: 'home_organizer/ai_chat',
        message: routeText,
        image_data: imgData,
        mime_type: currentMime,
        language: this.currentLang
    }).then(result => {
        this.stylistHistory.splice(statusIdx, 1);
        if (result && result.response) {
            this.stylistHistory.push({ role: 'ai', text: formatAiText(result.response) });
        } else if (result && result.error) {
            this.stylistHistory.push({ role: 'ai', text: "❌ Error: " + result.error });
        }
        this.render();
    }).catch(e => {
        this.stylistHistory.splice(statusIdx, 1);
        this.stylistHistory.push({ role: 'ai', text: "❌ Request failed: " + e.message });
        this.render();
    });
  }

  getBodyProfile() {
      const pStr = localStorage.getItem('ho_body_profile');
      if(pStr) {
          try { return JSON.parse(pStr); } catch(e){}
      }
      return { name: '', weight: '', chest: '', shoulders: '', waist: '', inseam: '', shoes: '' };
  }

  saveBodyProfile() {
      const root = this.shadowRoot;
      const profile = {
          name: root.getElementById('wiz-name')?.value || '',
          weight: root.getElementById('wiz-weight')?.value || '',
          chest: root.getElementById('wiz-chest')?.value || '',
          shoulders: root.getElementById('wiz-shoulders')?.value || '',
          waist: root.getElementById('wiz-waist')?.value || '',
          inseam: root.getElementById('wiz-inseam')?.value || '',
          shoes: root.getElementById('wiz-shoes')?.value || ''
      };
      localStorage.setItem('ho_body_profile', JSON.stringify(profile));
      root.getElementById('body-profile-modal').style.display = 'none';
      this.render(); 
  }

  checkFitWarning(itemMeasStr) {
      if(!itemMeasStr) return null;
      const p = this.getBodyProfile();
      if(!p.chest && !p.waist && !p.shoes) return null; 
      
      const warnings = [];
      const itemM = itemMeasStr.toLowerCase();
      
      const uChest = parseFloat(p.chest);
      if(uChest) {
          const itemChestMatch = itemM.match(/(chest|חזה)\D*(\d+(\.\d+)?)/i);
          if(itemChestMatch && parseFloat(itemChestMatch[2]) < uChest) warnings.push(this._t('wiz_chest', "Chest"));
      }
      
      const uWaist = parseFloat(p.waist);
      if(uWaist) {
          const itemWaistMatch = itemM.match(/(waist|מותניים)\D*(\d+(\.\d+)?)/i);
          if(itemWaistMatch && parseFloat(itemWaistMatch[2]) < uWaist) warnings.push(this._t('wiz_waist', "Waist"));
      }

      const uShoes = parseFloat(p.shoes);
      if(uShoes) {
          const itemShoeMatch = itemM.match(/(size|מידה|shoes|נעליים)\D*(\d+(\.\d+)?)/i);
          if(itemShoeMatch) {
              const shoeSize = parseFloat(itemShoeMatch[2]);
              if (shoeSize !== uShoes) {
                  warnings.push(`${this._t('wiz_shoes_title', 'Shoe Size')} (${shoeSize} != ${uShoes})`);
              }
          }
      }
      
      if(warnings.length > 0) return `${this._t('item_too_small', '⚠️ Bad Fit')} (${warnings.join(', ')})`;
      return null;
  }

  toggleChip(itemId, field, value) {
      const root = this.shadowRoot;
      const hiddenInput = root.getElementById(`${field}-${itemId}`);
      if(!hiddenInput) return;
      
      let currentVals = hiddenInput.value.split(',').map(s=>s.trim()).filter(Boolean);
      if(currentVals.includes(value)) {
          currentVals = currentVals.filter(v => v !== value);
      } else {
          currentVals.push(value);
      }
      
      hiddenInput.value = currentVals.join(', ');
      
      const chipContainer = root.getElementById(`${field}-chips-${itemId}`);
      if(chipContainer) {
          const chips = chipContainer.querySelectorAll('.chip');
          chips.forEach(chip => {
              if(chip.innerText.trim() === this._t('filter_'+value.toLowerCase(), value)) {
                  chip.classList.toggle('active');
              }
          });
      }
      
      const itemNode = root.getElementById(`name-${itemId}`);
      if(itemNode) this.saveStylistFields(itemId, itemNode.value);
  }

  saveStylistFields(itemId, origName) {
      const root = this.shadowRoot;
      const owner = root.getElementById(`owner-${itemId}`)?.value || '';
      const status = root.getElementById(`clothing_status-${itemId}`)?.value || 'Clean';
      const season = root.getElementById(`season-${itemId}`)?.value || '';
      const dressCode = root.getElementById(`dress_code-${itemId}`)?.value || '';
      const meas = root.getElementById(`measurements-${itemId}`)?.value || '';

      if (typeof this.callHA === 'function') {
          this.callHA('update_item_details', {
              item_id: itemId, original_name: origName, new_name: origName,
              owner: owner, season: season, dress_code: dressCode, clothing_status: status, measurements: meas
          });
      }
  }

  renderStylistView(content, attrs) {
      content.style.padding = '0';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';

      if (!this.stylistHistory) this.stylistHistory = [];
      if (!this.stylistSelectedItems) this.stylistSelectedItems = new Set();
      if (!this.stylistCategory) this.stylistCategory = 'All';
      if (!this.stylistSeasonFilter) this.stylistSeasonFilter = '';
      if (!this.stylistOccasionFilter) this.stylistOccasionFilter = '';

      const allItemsArray = this.allItems || (this.localData ? this.localData.items : []) || [];
      const wardrobe = allItemsArray.filter(i => 
          ['Clothing', 'Footwear', 'Bags', 'Accessories'].includes(i.category) &&
          i.qty > 0 &&
          i.clothing_status !== 'In Laundry' &&
          i.clothing_status !== 'Archived'
      );
      const subCats = [...new Set(wardrobe.map(i => i.sub_category).filter(Boolean))].sort();

      const header = document.createElement('div');
      header.style.cssText = "padding: 15px; background: var(--bg-card, #2a2a2a); border-bottom: 1px solid var(--border-light); display:flex; align-items:center; gap: 15px; flex-shrink: 0;";
      
      const ts = new Date().getTime();
      const userId = this._hass.user ? this._hass.user.id : "default";
      const personalAvatarFile = "user_avatar_" + userId + ".jpg";
      const personalAvatarUrl = "/local/home_organizer_images/" + personalAvatarFile + "?v=" + ts;

      const profile = this.getBodyProfile();
      let basicStatsStr = this._t('stylist_no_meas', "No measurements set");
      if(profile.weight || profile.chest || profile.waist || profile.shoes) {
          const arr = [];
          if(profile.weight) arr.push(`${profile.weight}kg`);
          if(profile.chest) arr.push(`C:${profile.chest}`);
          if(profile.waist) arr.push(`W:${profile.waist}`);
          if(profile.shoes) arr.push(`S:${profile.shoes}`);
          basicStatsStr = arr.join(' • ');
      }
      
      const profileName = profile.name || this._t('stylist_anon_user', 'Anonymous User');

      header.innerHTML = `
        <div style="position:relative; width: 60px; height: 60px; border-radius: 50%; background: var(--bg-input); border: 2px solid var(--primary); display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:pointer; flex-shrink:0;" id="btn-stylist-avatar" title="Edit Body Profile & Avatar">
            <img src="${personalAvatarUrl}" 
                 onerror="this.onerror=null; this.src=''; this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                 style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; z-index:2;">
            
            <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center; position:absolute; top:0; left:0; z-index:1;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="width: 80%; height: 80%; transform: translateY(4px);">
                    <circle cx="50" cy="20" r="12" fill="#FFB74D" />
                    <path d="M32 35 Q 50 30 68 35 Q 75 40 75 48 L 65 48 L 65 63 L 35 63 L 35 48 L 25 48 Q 25 40 32 35 Z" fill="#03A9F4" />
                    <path d="M28 48 L 22 68 M 72 48 L 78 68" stroke="#FFB74D" stroke-width="7" stroke-linecap="round" fill="none" />
                    <path d="M35 63 L 65 63 L 60 88 L 53 88 L 50 72 L 47 88 L 40 88 Z" fill="#4CAF50" />
                    <ellipse cx="38" cy="92" rx="7" ry="4" fill="#FF5722" />
                    <ellipse cx="62" cy="92" rx="7" ry="4" fill="#FF5722" />
                </svg>
            </div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; gap:4px; justify-content:center; cursor:pointer;" onclick="document.getElementById('btn-stylist-avatar').click()">
            <div style="font-weight:bold; font-size:16px; color:var(--text-main);">${this.escapeJSArg(profileName)}</div>
            <div style="font-size:12px; color:var(--text-sub);">${this.escapeJSArg(basicStatsStr)}</div>
        </div>
      `;
      
      header.querySelector('#btn-stylist-avatar').onclick = () => {
          const r = this.shadowRoot;
          const p = this.getBodyProfile();
          r.getElementById('wiz-name').value = p.name;
          r.getElementById('wiz-weight').value = p.weight;
          r.getElementById('wiz-chest').value = p.chest;
          r.getElementById('wiz-shoulders').value = p.shoulders;
          r.getElementById('wiz-waist').value = p.waist;
          r.getElementById('wiz-inseam').value = p.inseam;
          r.getElementById('wiz-shoes').value = p.shoes || '';
          r.getElementById('body-profile-modal').style.display='flex';
      };
      
      content.appendChild(header);

      const splitContainer = document.createElement('div');
      splitContainer.className = 'stylist-split-container';
      
      const chatArea = document.createElement('div');
      chatArea.className = 'stylist-chat-area';
      
      const messagesDiv = document.createElement('div');
      messagesDiv.className = 'chat-messages';
      messagesDiv.style.flex = '1';
      messagesDiv.style.overflowY = 'auto';
      messagesDiv.style.padding = '15px';

      const renderStylistMessages = () => {
         messagesDiv.innerHTML = '';
         if (this.stylistHistory.length === 0) {
            messagesDiv.innerHTML = `
              <div class="message ai">
                <b>${this._t('stylist_welcome', '👗 Welcome to your Personal Stylist!')}</b><br><br>
                ${this._t('stylist_welcome_desc', 'I can analyze the weather outside and the actual clothes in your closet.')}<br><br>
                <i>${this._t('stylist_welcome_hint', 'Try asking: "What should I wear for a date night?" or use the visual wardrobe to manually Try-On your favorite pieces!')}</i>
              </div>`;
         }
         this.stylistHistory.forEach(msg => {
            const div = document.createElement('div');
            div.className = "message " + msg.role;
            div.innerHTML = msg.text;
            if (msg.image) {
                div.innerHTML += '<br><img src="' + msg.image + '" style="max-width:100%; border-radius:8px; margin-top:8px;">';
            }
            messagesDiv.appendChild(div);
         });
         setTimeout(() => messagesDiv.scrollTop = messagesDiv.scrollHeight, 50);
      };

      renderStylistMessages();
      chatArea.appendChild(messagesDiv);

      const inputBar = document.createElement('div');
      inputBar.className = 'chat-input-bar';
      inputBar.style.flexShrink = '0';

      const camBtn = document.createElement('button');
      camBtn.className = 'chat-cam-btn';
      camBtn.innerHTML = ICONS.camera;
      camBtn.type = 'button';
      camBtn.style.cssText = "background:none;border:none;color:var(--primary,#03a9f4);cursor:pointer;padding:0 10px;height:40px;width:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
      camBtn.onclick = () => {
          if (this.useExternalCamera) window.location.href = "hocamera://capture?context=stylist_add&m=Scan%20Garment&s=Take%20a%20photo%20of%20clothing&b=Analyze";
          else this.openCamera('stylist_add');
      };
      inputBar.appendChild(camBtn);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'chat-input';
      input.placeholder = this._t('stylist_chat_placeholder', 'Ask for an outfit...');

      const sendBtn = document.createElement('button');
      sendBtn.className = 'chat-send-btn';
      sendBtn.innerHTML = ICONS.send;
      sendBtn.onclick = () => this.executeStylistChat(input.value.trim(), this.chatImage, this.chatMimeType);
      input.onkeydown = e => { if (e.key === 'Enter') this.executeStylistChat(input.value.trim(), this.chatImage, this.chatMimeType); };

      inputBar.appendChild(input);
      inputBar.appendChild(sendBtn);
      chatArea.appendChild(inputBar);
      
      const wardrobeArea = document.createElement('div');
      wardrobeArea.className = 'stylist-wardrobe-area';
      
      const filterBar = document.createElement('div');
      filterBar.className = 'stylist-filter-bar';
      filterBar.innerHTML = `
        <select id="stylist-filter-season" class="stylist-filter-select">
           <option value="">${this._t('filter_all_seasons', '🌍 All Seasons')}</option>
           <option value="Summer" ${this.stylistSeasonFilter==='Summer'?'selected':''}>${this._t('filter_summer', '☀️ Summer')}</option>
           <option value="Winter" ${this.stylistSeasonFilter==='Winter'?'selected':''}>${this._t('filter_winter', '❄️ Winter')}</option>
           <option value="Spring" ${this.stylistSeasonFilter==='Spring'?'selected':''}>${this._t('filter_spring', '🌸 Spring')}</option>
           <option value="Fall" ${this.stylistSeasonFilter==='Fall'?'selected':''}>${this._t('filter_fall', '🍂 Fall')}</option>
        </select>
        <select id="stylist-filter-occ" class="stylist-filter-select">
           <option value="">${this._t('filter_all_occ', '👔 All Occasions')}</option>
           <option value="Casual" ${this.stylistOccasionFilter==='Casual'?'selected':''}>${this._t('filter_casual', '👕 Casual')}</option>
           <option value="Work" ${this.stylistOccasionFilter==='Work'?'selected':''}>${this._t('filter_work', '💼 Work')}</option>
           <option value="Wedding/Formal" ${this.stylistOccasionFilter==='Wedding/Formal'?'selected':''}>${this._t('filter_wedding', '👔 Wedding')}</option>
           <option value="Gym" ${this.stylistOccasionFilter==='Gym'?'selected':''}>${this._t('filter_gym', '🏋️ Gym')}</option>
        </select>
      `;
      
      const gridContainer = document.createElement('div');
      gridContainer.style.cssText = "flex:1; position:relative; display:flex; flex-direction:column; overflow:hidden;";
      gridContainer.appendChild(filterBar);

      const itemGrid = document.createElement('div');
      itemGrid.className = 'stylist-grid';
      
      let filteredWardrobe = wardrobe;
      if (this.stylistCategory && this.stylistCategory !== 'All') {
          filteredWardrobe = filteredWardrobe.filter(i => i.sub_category === this.stylistCategory);
      }
      
      if (this.stylistSeasonFilter) {
          filteredWardrobe = filteredWardrobe.filter(i => (i.season || '').includes(this.stylistSeasonFilter));
      }
      if (this.stylistOccasionFilter) {
          filteredWardrobe = filteredWardrobe.filter(i => (i.dress_code || '').includes(this.stylistOccasionFilter));
      }

      if (filteredWardrobe.length === 0) {
          itemGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:30px; color:var(--text-sub);">${this._t('stylist_no_clothes', 'No clean clothes found matching this filter.<br>Ensure you have added clothing to your inventory!')}</div>`;
      } else {
          filteredWardrobe.forEach(item => {
              const card = document.createElement('div');
              const isSelected = this.stylistSelectedItems.has(item.id);
              card.className = `stylist-item-card ${isSelected ? 'selected' : ''}`;

              let imgHtml = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--primary);">${ICONS.item}</div>`;
              let src = '';
              if (item.img) {
                  if (item.img.startsWith('ICON_LIB')) {
                      imgHtml = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--primary);">${this.getIconByKey(item.img)||ICONS.item}</div>`;
                  } else {
                      let cleanPath = item.img.split('?')[0]; 
                      const ver = this.imageVersions[item.id] || 'ok';
                      src = `${cleanPath}?v=${ver}`;
                      imgHtml = `<img src="${src}">`;
                  }
              }

              const fitAlert = (typeof this.checkFitWarning === 'function') ? this.checkFitWarning(item.measurements) : null;
              const badgeHtml = fitAlert ? `<div class="grid-fit-badge">${this._t('item_too_small_badge', '⚠️ Small')}</div>` : '';

              card.innerHTML = `
                  ${badgeHtml}
                  ${imgHtml}
                  <div class="stylist-item-check">${ICONS.check}</div>
                  <div class="stylist-item-zoom" title="Fullscreen">${ICONS.search}</div>
              `;
              
              card.onclick = () => {
                  if (this.stylistSelectedItems.has(item.id)) this.stylistSelectedItems.delete(item.id);
                  else this.stylistSelectedItems.add(item.id);
                  this.render();
              };
              
              card.querySelector('.stylist-item-zoom').onclick = (e) => {
                  e.stopPropagation();
                  this.showImg(src || item.img);
              };
              
              itemGrid.appendChild(card);
          });
      }
      gridContainer.appendChild(itemGrid);

      if (this.stylistSelectedItems.size > 0) {
          const tryOnWrap = document.createElement('div');
          tryOnWrap.style.cssText = "position:absolute; bottom:15px; left:50%; transform:translateX(-50%); z-index:20;";
          tryOnWrap.innerHTML = `<button style="background:var(--primary); color:white; border:none; padding:12px 24px; border-radius:30px; font-weight:bold; font-size:14px; box-shadow:0 4px 15px rgba(0,0,0,0.5); cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:8px;">✨ ${this._t('stylist_try_on_btn', 'Try On Selected')} (${this.stylistSelectedItems.size})</button>`;
          
          tryOnWrap.querySelector('button').onclick = () => {
              const names = Array.from(this.stylistSelectedItems).map(id => {
                  const it = wardrobe.find(i => i.id === id);
                  return it ? `[${it.name}] (Location: ${it.location})` : '';
              }).filter(Boolean);

              const prompt = `I want to wear these exact items: ${names.join(', ')}. Please render a Virtual Try-On image of this outfit on my avatar.`;
              this.stylistSelectedItems.clear();
              this.executeStylistChat(prompt, null, "image/jpeg");
          };
          gridContainer.appendChild(tryOnWrap);
      }
      wardrobeArea.appendChild(gridContainer);

      const catSidebar = document.createElement('div');
      catSidebar.className = 'stylist-sidebar';
      
      const getCatIcon = (name) => {
         if(name.includes('Shirt') || name.includes('Top')) return '👕';
         if(name.includes('Pant') || name.includes('Jeans') || name.includes('Bottom')) return '👖';
         if(name.includes('Dress') || name.includes('Suit')) return '👗';
         if(name.includes('Coat') || name.includes('Jacket') || name.includes('Outerwear')) return '🧥';
         if(name.includes('Shoe') || name.includes('Footwear') || name.includes('Sneaker')) return '👟';
         if(name.includes('Bag') || name.includes('Purse') || name.includes('Backpack')) return '👜';
         if(name.includes('Accessory') || name.includes('Hat') || name.includes('Glasses')) return '🕶️';
         if(name.includes('Shorts')) return '🩳';
         return '👕'; 
      };

      const createCatBtn = (name, label, icon) => {
          const btn = document.createElement('div');
          btn.className = `stylist-cat-btn ${this.stylistCategory === name ? 'active' : ''}`;
          btn.innerHTML = `<span style="font-size:24px;">${icon}</span><span style="font-size:10px;word-break:break-all;">${label}</span>`;
          btn.onclick = () => { this.stylistCategory = name; this.render(); };
          return btn;
      };

      catSidebar.appendChild(createCatBtn('All', this._t('stylist_all_items', '✨ All Items'), '✨'));
      subCats.forEach(cat => {
          const translatedCat = this._t('sub_' + cat.replace(/[^a-zA-Z0-9]+/g,'_'), cat);
          catSidebar.appendChild(createCatBtn(cat, translatedCat, getCatIcon(cat)));
      });
      
      wardrobeArea.appendChild(catSidebar);
      
      splitContainer.appendChild(wardrobeArea);
      splitContainer.appendChild(chatArea);

      content.appendChild(splitContainer);

      this.appendWizardModal(content);
      this.applyWizardTranslations();
      
      setTimeout(() => {
          const sFilter = content.querySelector('#stylist-filter-season');
          const oFilter = content.querySelector('#stylist-filter-occ');
          if(sFilter) sFilter.onchange = (e) => { this.stylistSeasonFilter = e.target.value; this.render(); };
          if(oFilter) oFilter.onchange = (e) => { this.stylistOccasionFilter = e.target.value; this.render(); };
      }, 0);
  }
};