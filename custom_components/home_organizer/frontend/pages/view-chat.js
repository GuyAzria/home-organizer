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
// [MODIFIED v10.0.10 | 2026-04-17] Purpose: Stripped ?v= backend timestamps from pending review card renders to prevent caching loops.

import { ICONS } from '../organizer-icon.js?v=10.0.10';
import { escapeHtml, formatAiText } from '../organizer-utils.js?v=2026.8.26';
const UPLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>';
const miniBarcodeSvg = '<svg style="width:12px;height:12px" viewBox="0 0 24 24"><path fill="currentColor" d="M3,6H5V18H3V6M7,6H8V18H7V6M9,6H12V18H9V6M13,6H14V18H13V6M16,6H18V18H16V6M19,6H21V18H19V6Z"/></svg>';

export const ChatMixin = (Base) => class extends Base {
  renderChatAndReviewView(content, attrs) {
      content.style.padding = '0'; content.style.display = 'flex'; content.style.flexDirection = 'column';
      const tabContainer = document.createElement('div'); tabContainer.className = 'shop-tabs'; tabContainer.style.margin = '10px 15px 10px 15px'; tabContainer.style.flexShrink = '0';
      const pendingCount = attrs.pending_list?.length || 0;
      tabContainer.innerHTML = `<div class="shop-tab ${this.isChatMode ? 'active' : ''}" id="ai-tab-chat">${this._t('ai_chat_title', 'AI Chat')}</div><div class="shop-tab ${this.isReviewMode ? 'active' : ''}" id="ai-tab-review">${this._t('review_tab', 'Review')} ${pendingCount > 0 ? `<span class="shop-badge">${pendingCount}</span>` : ''}</div>`;
      content.appendChild(tabContainer);
      tabContainer.querySelector('#ai-tab-chat').onclick = () => { this.isChatMode = true; this.isReviewMode = false; this.render(); };
      tabContainer.querySelector('#ai-tab-review').onclick = () => { this.isReviewMode = true; this.isChatMode = false; this.fetchData(); };

      const tabContent = document.createElement('div'); tabContent.style.flex = '1'; tabContent.style.minHeight = '0'; tabContent.style.display = 'flex'; tabContent.style.flexDirection = 'column'; tabContent.style.overflowY = this.isReviewMode ? 'auto' : 'hidden'; 
      if (this.isChatMode) { this.renderChatUI(tabContent); } 
      else if (this.isReviewMode) {
        tabContent.style.padding = '0 15px 15px 15px'; const listContainer = document.createElement('div'); listContainer.className = 'item-list';
        if (attrs.pending_list?.length > 0) {
          attrs.pending_list.forEach(item => {
            if (!this.locationEditState[item.id]) this.locationEditState[item.id] = { l1: item.level_1||'', l2: item.level_2||'', l3: item.level_3||'' };
            let mainCatOptions = `<option value="">${this._t('select_cat', 'Category')}</option><option value="Clothing">Clothing</option><option value="Food">Food</option><option value="Electronics">Electronics</option>`;
            let subCatOptions = `<option value="">${this._t('select_sub', 'Sub-Category')}</option>`;
            
            let iconHtml = `<div class="item-icon" style="margin-inline-end:10px;">${ICONS.item}</div>`;
            if (item.img) {
              if (item.img.startsWith('ICON_LIB')) {
                iconHtml = `<div class="item-icon" style="margin-inline-end:10px;">${this.getIconByKey(item.img)||ICONS.item}</div>`;
              } else {
                let cleanPath = item.img.split('?')[0]; 
                const ver = this.imageVersions[item.id] || 'ok';
                iconHtml = `<img src="${cleanPath}?v=${ver}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;margin-inline-end:10px;">`;
              }
            }

            const hierarchyHtml = (typeof this.renderHierarchyControl === 'function') ? this.renderHierarchyControl(item, true) : '';

            const card = document.createElement('div'); card.className = 'pending-card';
            card.innerHTML = `
              <div class="pending-top">
                ${iconHtml}
                <div style="display:flex;flex-direction:column;flex:1;margin-inline-end:10px;">
                  <input type="text" id="pending-name-${escapeHtml(item.id)}" class="pending-name-input" value="${escapeHtml(item.name)}" style="width:100%;">
                  ${item.barcode && item.barcode!=='0' ? `<div style="font-size:10px;color:var(--text-sub);margin-top:4px;display:inline-flex;align-items:center;gap:4px;opacity:.8;direction:ltr;align-self:flex-start;">${miniBarcodeSvg} ${escapeHtml(item.barcode)}</div>` : ''}
                </div>
                <input type="number" id="pending-qty-${escapeHtml(item.id)}" class="pending-qty-input" value="${escapeHtml(item.qty)}" min="1">
              </div>
              <div class="pending-mid" style="display:flex;flex-direction:column;gap:8px;">${hierarchyHtml}<div style="display:flex;gap:5px;"><select class="move-select" id="pending-cat-main-${escapeHtml(item.id)}" style="flex:1;" onchange="this.getRootNode().host.updatePendingCategory('${escapeHtml(item.id)}',this.value,'main')">${mainCatOptions}</select><select class="move-select" id="pending-cat-sub-${escapeHtml(item.id)}" style="flex:1;" onchange="this.getRootNode().host.updatePendingCategory('${escapeHtml(item.id)}',this.value,'sub')">${subCatOptions}</select></div></div>
              <div class="pending-actions" style="justify-content:space-between;align-items:center;margin-top:12px;">
                <div style="display:flex;gap:10px;"><button class="action-btn" title="${this._t('take_photo', 'Take Photo')}" onclick="this.getRootNode().host.triggerCameraEdit('${escapeHtml(item.id)}','${escapeHtml(this.escapeJSArg(item.name))}')">${ICONS.camera}</button><button class="action-btn" title="${this._t('upload_file', 'Upload File')}" onclick="this.getRootNode().host.triggerFileUploadEdit('${escapeHtml(item.id)}','${escapeHtml(this.escapeJSArg(item.name))}')">${UPLOAD_SVG}</button><button class="action-btn" title="${this._t('change_img', 'Change Icon')}" onclick="this.getRootNode().host.openIconPicker('${escapeHtml(item.id)}','item')">${ICONS.image}</button></div>
                <div style="display:flex;gap:10px;"><button class="action-btn btn-danger" title="${this._t('reject', 'Reject')}" onclick="this.getRootNode().host.deletePending('${escapeHtml(item.id)}')" style="display:flex;align-items:center;justify-content:center;">${ICONS.delete}</button><button class="action-btn" title="${this._t('confirm', 'Confirm')}" style="background:var(--success);color:white;display:flex;align-items:center;justify-content:center;" onclick="this.getRootNode().host.confirmPending('${escapeHtml(item.id)}')">${ICONS.check}</button></div>
              </div>`;
            listContainer.appendChild(card);
          });
        } else { listContainer.innerHTML = `<div style="text-align:center;padding:20px;color:#888;">All caught up! No pending items to review.</div>`; }
        tabContent.appendChild(listContainer);
      }
      content.appendChild(tabContent);
  }

  renderChatUI(container) {
    const chatContainer = document.createElement('div'); chatContainer.className = 'chat-container';
    const messagesDiv   = document.createElement('div'); messagesDiv.className = 'chat-messages';

    if (!this.chatHistory.length) {
      const welcome = document.createElement('div'); welcome.className = 'message ai';
      welcome.innerHTML = `<b>${this._t('ai_welcome_title', 'AI Assistant')}</b><br>${this._t('ai_welcome_desc', 'I can help you organize.')}<br><br><b>${this._t('ai_caps', 'Capabilities:')}</b><br>• ${this._t('ai_cap_1', 'Scan Receipts')}<br>• ${this._t('ai_cap_2', 'Identify Items')}<br>• ${this._t('ai_cap_3', 'Manage Inventory')}<br>• ${this._t('ai_cap_4', 'Answer Questions')}`;
      messagesDiv.appendChild(welcome);
    }

    this.chatHistory.forEach((msg, idx) => {
      const div = document.createElement('div'); div.className = `message ${msg.role}`;
      if (msg.isBarcodeConfirm) {
        div.innerHTML = `
          <div style="margin-bottom:8px;color:var(--primary);"><b>Barcode Scanned: ${escapeHtml(msg.barcode)}</b></div><div style="margin-bottom:8px;font-size:13px;">Confirm or edit the AI suggested name:</div>
          <input type="text" id="chat-bcode-input-${idx}" style="width:100%;padding:8px;margin-bottom:10px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-input-edit,#333);color:var(--text-main,#fff);font-size:14px;box-sizing:border-box;">
          <button class="action-btn" id="chat-bcode-btn-${idx}" style="width:100%;background:var(--success,#4caf50);color:white;padding:8px;border-radius:6px;">Confirm &amp; Add</button>`;
        setTimeout(() => {
          const btn = this.shadowRoot.getElementById(`chat-bcode-btn-${idx}`); const inp = this.shadowRoot.getElementById(`chat-bcode-input-${idx}`);
          if (btn && inp) {
            inp.value = msg.suggestion?.name || ''; inp.focus();
            const confirmAction = async () => {
              const finalName = inp.value.trim() || msg.suggestion?.name;
              msg.isBarcodeConfirm = false; msg.text = `Categorizing <b>${finalName}</b>...`; this.render();
              try {
                const result = await this._hass.callWS({ type:'home_organizer/ai_chat', message:`RESOLVE_BARCODE: ${escapeHtml(msg.barcode)} - ${finalName}`, image_data:null, mime_type:'image/jpeg', language:this.currentLang });
                if (result) {
                  let debugHTML = "";
                  if (result.debug?.raw_json) debugHTML = `<details class="debug-details"><summary class="debug-summary">📄 Raw Data</summary><div class="debug-content">${result.debug.raw_json.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div></details>`;
                  if (result.error) msg.text = `❌ Error: ${escapeHtml(result.error)}`;
                  else if (result.response) msg.text = formatAiText(result.response) + debugHTML;
                }
              } catch (e) { msg.text = `❌ Failed to categorize: ${escapeHtml(e.message)}`; }
              this.render();
            };
            btn.onclick = confirmAction; inp.onkeydown = e => { if (e.key === 'Enter') confirmAction(); };
          }
        }, 0);
      } else {
        div.innerHTML = msg.text;
        if (msg.image) { const img = document.createElement('img'); img.src = msg.mime_type === 'application/pdf' ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><path fill="gray" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h6v6h6v10H6z"/></svg>' : msg.image; img.style.cssText = "max-width:100%;border-radius:8px;margin-top:5px;"; div.appendChild(img); }
        if (msg.isStatus) div.id = 'chat-status-msg';
        if (msg.isError) {
          const retryBtn = document.createElement('button'); retryBtn.className = 'action-btn'; retryBtn.style.cssText = "margin-top:10px;background:var(--primary);color:white;"; retryBtn.innerHTML = ICONS.refresh + " Send Again";
          retryBtn.onclick = () => {
            this.chatImage = msg.retryImage; this.chatMimeType = msg.retryMime || "image/jpeg";
            const chatInput = this.shadowRoot.querySelector('.chat-input'); if (chatInput) chatInput.value = msg.retryText || "";
            this.chatHistory = this.chatHistory.filter(m => m !== msg); this.render();
            setTimeout(() => { const s = this.shadowRoot.querySelector('.chat-send-btn'); if (s) s.click(); }, 100);
          };
          div.appendChild(retryBtn);
        }
      }
      messagesDiv.appendChild(div);
    });
    chatContainer.appendChild(messagesDiv);

    const previewArea = document.createElement('div'); previewArea.id = "chat-img-preview"; previewArea.style.display = "none"; previewArea.style.cssText = "padding:5px 10px;background:#222;border-top:1px solid #444;";
    previewArea.innerHTML = `<div style="display:inline-block;position:relative;"><img id="chat-preview-img" style="height:50px;border-radius:4px;border:1px solid #666"><div id="chat-remove-img" style="position:absolute;top:-5px;right:-5px;background:red;color:white;border-radius:50%;width:15px;height:15px;font-size:10px;text-align:center;cursor:pointer;line-height:15px;">✕</div></div><span style="color:#aaa;font-size:12px;margin-inline-start:10px">${this._t('file_attached', 'File Attached')}</span>`;
    chatContainer.appendChild(previewArea);

    if (this.chatImage) { previewArea.style.display = 'block'; const preImg = previewArea.querySelector('#chat-preview-img'); preImg.src = this.chatMimeType === 'application/pdf' ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><path fill="gray" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h6v6h6v10H6z"/></svg>' : this.chatImage; }
    previewArea.querySelector('#chat-remove-img').onclick = () => { this.chatImage = null; this.chatMimeType = "image/jpeg"; previewArea.style.display = 'none'; };

    const inputBar = document.createElement('div'); inputBar.className = 'chat-input-bar';
    const camBtn = document.createElement('button'); camBtn.className = 'chat-cam-btn'; camBtn.innerHTML = ICONS.camera; camBtn.type = 'button'; camBtn.style.cssText = "background:none;border:none;color:var(--primary,#03a9f4);cursor:pointer;padding:0 10px;height:40px;width:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
    camBtn.onclick = () => this.handleChatCamera();
    const uploadBtn = document.createElement('button'); uploadBtn.className = 'chat-cam-btn'; uploadBtn.innerHTML = UPLOAD_SVG; uploadBtn.type = 'button'; uploadBtn.style.cssText = camBtn.style.cssText; uploadBtn.onclick = () => this.openFileUpload('chat');
    const input   = document.createElement('input');   input.type = 'text'; input.className = 'chat-input'; input.placeholder = this._t('chat_placeholder', 'Type a message...');
    const sendBtn = document.createElement('button'); sendBtn.className = 'chat-send-btn'; sendBtn.innerHTML = ICONS.send; sendBtn.style.flexShrink = "0";

    const sendMessage = async () => {
      const text = input.value.trim(); const imgData = this.chatImage; const currentMime = this.chatMimeType;
      if (!text && !imgData) return;
      this.chatHistory.push({ role:'user', text: text||this._t('scanned_invoice', 'Scanned Invoice'), image:imgData, mime_type:currentMime });
      this.chatImage = null; this.chatMimeType = "image/jpeg"; input.value = ''; this.render();

      const statusMsg = { role:'system', text:`${this._t('starting_process', 'Starting process...')}<br>${imgData?this._t('scanning_invoice', 'Scanning invoice...'):this._t('analyzing', 'Analyzing...')}`, isStatus:true };
      this.chatHistory.push(statusMsg); this.render();
      setTimeout(() => { const m = this.shadowRoot.querySelector('.chat-messages'); if (m) m.scrollTop = m.scrollHeight; }, 100);

      try {
        const result = await this._hass.callWS({ type:'home_organizer/ai_chat', message:text, image_data:imgData, mime_type:currentMime, language:this.currentLang });
        if (result) {
          let debugHTML = "";
          if (result.debug) {
            const d = result.debug; const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
            if (d.raw_json) debugHTML += `<details class="debug-details"><summary class="debug-summary">📄 Raw Invoice Data</summary><div class="debug-content">${esc(d.raw_json)}</div></details>`;
            if (d.sql_query) debugHTML += `<details class="debug-details"><summary class="debug-summary">🔍 SQL Query</summary><div class="debug-content">${esc(d.sql_query)}</div></details>`;
          }
          statusMsg.text = "✔ " + this._t('complete', 'Complete') + debugHTML;
          if (result.error) this.chatHistory.push({ role:'ai', text:`<b>${this._t('error', 'Error')}:</b> ${escapeHtml(result.error)}`, isError:true, retryText:text, retryImage:imgData, retryMime:currentMime });
          else if (result.response) this.chatHistory.push({ role:'ai', text:formatAiText(result.response) });
        }
      } catch (e) {
        statusMsg.text += "<br>❌ " + this._t('failed', 'Failed');
        this.chatHistory.push({ role:'ai', text:this._t('error', 'Error')+": "+e.message, isError:true, retryText:text, retryImage:imgData, retryMime:currentMime });
      }
      this.render(); setTimeout(() => { const m = this.shadowRoot.querySelector('.chat-messages'); if (m) m.scrollTop = m.scrollHeight; }, 100);
    };
    sendBtn.onclick = sendMessage; input.onkeydown = e => { if (e.key === 'Enter') sendMessage(); };
    inputBar.appendChild(camBtn); inputBar.appendChild(uploadBtn); inputBar.appendChild(input); inputBar.appendChild(sendBtn);
    chatContainer.appendChild(inputBar); container.appendChild(chatContainer);
    setTimeout(() => messagesDiv.scrollTop = messagesDiv.scrollHeight, 0);
  }
};