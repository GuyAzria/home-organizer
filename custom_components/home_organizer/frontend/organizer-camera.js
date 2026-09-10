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
// [MODIFIED v10.0.11 | 2026-08-02] Purpose: Changed barcode polyfill CDN URL to local static path to satisfy offline HACS requirements.
// [MODIFIED v10.0.10 | 2026-04-17] Purpose: Added robust stream destruction to fix intermittent camera loading blocks. Added toggleWhiteBG implementation to resolve undefined boolean properties breaking canvas extraction. Sanitized canvas width/height integer rounding to prevent NaN rendering loops.

export const CameraMixin = (Base) => class extends Base {

  // [ADDED v10.0.10] Resolves the missing AI button toggle logic
  toggleWhiteBG() {
    if (this.useAiBg === undefined) this.useAiBg = true;
    this.useAiBg = !this.useAiBg;
    const btn = this.shadowRoot.getElementById('btn-cam-wb');
    if (btn) {
        if (this.useAiBg) btn.classList.add('active');
        else btn.classList.remove('active');
    }
  }

  async openCamera(context) {
    this.cameraContext = context;

    let instMain = "", instSub = "", btnText = this._t('cam_btn_capture', 'Capture');
    if (context === 'stylist_avatar')  { instMain = 'Capture Avatar'; instSub = 'Take a full-body photo'; btnText = 'Save Avatar'; }
    else if (context === 'stylist_add') { instMain = 'Scan Garment'; instSub = 'Take a photo of clothing'; btnText = 'Analyze Garment'; }
    else if (context === 'wizard_avatar')   { instMain = this._t('wiz_avatar_title', 'Avatar');  instSub = this._t('wiz_avatar_inst', 'Take Photo'); btnText = this._t('cam_btn_capture_avatar', 'Capture'); }
    else if (context === 'wizard_clothing') { instMain = this._t('wiz_cloth_title', 'Clothing'); instSub = this._t('wiz_cloth_inst', 'Take Photo'); btnText = this._t('cam_btn_capture_cloth', 'Capture'); }
    else if (context === 'barcode')    { instMain = this._t('barcode_scanner', 'Barcode');   instSub = this._t('cam_inst_barcode_sub', 'Scan'); btnText = this._t('cam_btn_scan_auto', 'Scanning...'); }
    else if (context === 'chat' || context === 'invoice') { instMain = this._t('invoice_scanner', 'Receipt'); instSub = this._t('cam_inst_invoice_sub', 'Ensure text readable'); btnText = this._t('cam_btn_capture_invoice', 'Capture'); }
    else if (context === 'search')     { instMain = this._t('search_title', 'Visual Search'); instSub = this._t('search_sub', 'Take a photo'); }
    else if (context === 'update')     { instMain = this._t('update_title', 'Update Item');   instSub = this._t('update_sub', 'Capture new photo'); }
    else { instMain = 'Camera'; instSub = 'Capture photo'; }

    if (this.useExternalCamera) {
      const ts = Date.now();
      setTimeout(() => {
        window.location.href = `hocamera://capture?context=${context}&ts=${ts}&m=${encodeURIComponent(instMain)}&s=${encodeURIComponent(instSub)}&b=${encodeURIComponent(btnText)}`;
      }, 50);
      return;
    }

    const overlay = this.shadowRoot.getElementById('barcode-overlay');
    if (overlay) overlay.style.display = context === 'barcode' ? 'block' : 'none';

    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("Secure context required for Camera API. Switching to native file input.");
      this.openNativeCamera(context);
      return;
    }

    const modal = this.shadowRoot.getElementById('camera-modal');
    const video = this.shadowRoot.getElementById('camera-video');
    modal.style.display = 'flex';

    // [MODIFIED v10.0.10] Aggressive Memory Cleanup to fix intermittent camera lock
    if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
    }

    let constraints = { video: { facingMode: this.facingMode || "environment" } };
    if (context === 'barcode') {
      constraints = { video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = this.stream;
      
      if (context === 'barcode') {
        const track = this.stream.getVideoTracks()[0];
        if (track?.getCapabilities) {
          const caps = track.getCapabilities();
          if (caps.focusMode?.includes('continuous'))
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        }
      }
    } catch (err) {
      alert("Camera Error: " + err.message);
      modal.style.display = 'none';
    }
  }

  openNativeCamera(context) {
    let input = this.shadowRoot.getElementById('native-camera-input');
    if (!input) {
      input = document.createElement('input');
      input.id = 'native-camera-input'; input.type = 'file';
      input.accept = 'image/*'; input.capture = 'environment';
      input.style.display = 'none';
      this.shadowRoot.appendChild(input);
    }
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      this.compressImage(file, async (dataUrl, finalMime) => {
        const isSearch = context === 'search';
        // [FIXED v2026.9.24] 'invoice' is a receipt context as well.
        // openCamera has always mapped chat and invoice to the same
        // receipt labels, but these two capture paths only tested for
        // 'chat', so a capture started as 'invoice' fell through and the
        // photo went nowhere.
        const isChat   = context === 'chat' || context === 'invoice';
        if (context === 'stylist_avatar') { this.saveAvatarImage(dataUrl); return; }
        if (isChat || context === 'stylist_add') { 
            this.chatImage = dataUrl; this.chatMimeType = finalMime; 
            if (context === 'stylist_add') {
                const inputBar = this.shadowRoot.querySelector('.chat-input');
                if (inputBar) inputBar.value = "stylist Add this clothing to my closet";
            }
            this.render(); return; 
        }
        const targetId = this.pendingItemId || this.pendingItem;
        if (!isSearch && targetId) this.setLoading(targetId, true);
        try {
          if (isSearch) await this.callHA('ai_action', { mode: 'search', image_data: dataUrl, mime_type: finalMime, language: this.currentLang });
          else if (this.pendingItemId) { 
              await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl, mime_type: finalMime }); 
              this.refreshImageVersion(this.pendingItemId); 
              this.fetchData(); 
          }
          else if (this.pendingItem) { 
              await this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl, mime_type: finalMime }); 
              this.refreshImageVersion(this.pendingItem); 
              this.fetchData(); 
          }
        } catch (e) { console.error(e); }
        finally {
          if (!isSearch && targetId) this.setLoading(targetId, false);
          this.pendingItemId = null; this.pendingItem = null;
          localStorage.removeItem('ho_pending_item_id');
          localStorage.removeItem('ho_pending_item_name');
        }
      }, this.useAiBg !== false, context); // Defaults to true if undefined
      input.value = '';
    };
    input.click();
  }

  stopCamera() {
    const modal   = this.shadowRoot.getElementById('camera-modal');
    const video   = this.shadowRoot.getElementById('camera-video');
    const overlay = this.shadowRoot.getElementById('barcode-overlay');
    if (overlay) overlay.style.display = 'none';
    if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null; // Aggressive cleanup
    }
    video.srcObject = null;
    modal.style.display = 'none';
  }

  async switchCamera() {
    this.facingMode = (this.facingMode === "user") ? "environment" : "user";
    this.stopCamera();
    setTimeout(() => this.openCamera(this.cameraContext), 200);
  }

  async snapPhoto() {
    const video  = this.shadowRoot.getElementById('camera-video');
    const canvas = this.shadowRoot.getElementById('camera-canvas');
    const ctx    = canvas.getContext('2d');
    
    // [MODIFIED v10.0.10] Protect against 0x0 video dimensions breaking the UI
    let w = video.videoWidth || 512;
    let h = video.videoHeight || 512;
    
    if (this.cameraContext === 'update') {
        const MAX = 512;
        if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } }
    }
    
    // Math.floor required by canvas to avoid sub-pixel blurring/looping issues
    canvas.width = Math.floor(w); 
    canvas.height = Math.floor(h);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let outMime = 'image/jpeg';
    
    // Default useAiBg to true if undefined
    if (this.useAiBg === undefined) this.useAiBg = true;

    if (this.useAiBg && this.cameraContext !== 'barcode' && this.cameraContext !== 'chat' && this.cameraContext !== 'invoice') {
      outMime = 'image/png';
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 190 && data[i+1] > 190 && data[i+2] > 190) { data[i]=255; data[i+1]=255; data[i+2]=255; data[i+3]=0; }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const dataUrl = canvas.toDataURL(outMime, 0.8);
    this.stopCamera();

    if (this.cameraContext === 'stylist_avatar') {
        this.saveAvatarImage(dataUrl);
        return;
    }

    if (this.cameraContext === 'chat' || this.cameraContext === 'invoice' || this.cameraContext === 'stylist_add') { 
        this.chatImage = dataUrl; 
        this.chatMimeType = outMime; 
        if(this.cameraContext === 'stylist_add') {
            const input = this.shadowRoot.querySelector('.chat-input');
            if (input) input.value = "stylist Add this clothing to my closet";
        }
        this.render(); 
        return; 
    }

    const targetId = this.pendingItemId || this.pendingItem;
    const isSearch = this.cameraContext === 'search';
    if (!isSearch && targetId) this.setLoading(targetId, true);
    try {
      if (isSearch) await this.callHA('ai_action', { mode: 'search', image_data: dataUrl, mime_type: outMime, language: this.currentLang });
      else if (this.pendingItemId) { 
          await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl, mime_type: outMime }); 
          this.refreshImageVersion(this.pendingItemId); 
          this.fetchData(); 
      }
      else if (this.pendingItem) { 
          await this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl, mime_type: outMime }); 
          this.refreshImageVersion(this.pendingItem); 
          this.fetchData(); 
      }
    } catch (e) { console.error(e); }
    finally {
      if (!isSearch && targetId) this.setLoading(targetId, false);
      this.pendingItemId = null; this.pendingItem = null;
      localStorage.removeItem('ho_pending_item_id');
      localStorage.removeItem('ho_pending_item_name');
    }
  }

  // [ADDED v2026.9.10] Ask whether the receipt continues onto another photo.
  //
  // The prompt is deliberately shown AFTER each capture rather than as a mode
  // chosen up front: at the moment the user has just photographed the receipt
  // they can see whether the rest of it is still in their hand, which is not
  // something they can answer before starting.
  // [REPLACED v2026.9.25] The confirm() dialog is gone.
  //
  // Three problems with it. It offered only OK and Cancel, so there was no way
  // to drop a blurred page or abandon the scan. It fired before anything was
  // drawn, so the user was asked about a photo they had not seen. And "OK"
  // called openFileUpload, which opened a file picker instead of the camera -
  // the reason pressing OK appeared to do nothing when the external app was
  // in use.
  //
  // The queue is now shown in the review tab with its own buttons, so this
  // just triggers a redraw.
  askForMoreReceiptPages() {
    this.render();
  }

  // Capture another page, using whichever camera strategy is configured.
  //
  // openCamera, not openFileUpload: with the external app enabled the file
  // picker is the wrong tool entirely, and without HTTPS it is the only path
  // that reaches openNativeCamera.
  captureAnotherReceiptPage() {
    this.receiptPageMode = true;
    this.receiptCaptureActive = true;
    this.openCamera('invoice');
  }

  // Abandon the whole capture. Nothing has been sent or written yet, so this
  // only clears local state.
  cancelReceiptCapture() {
    this.receiptPageMode = false;
    this.receiptCaptureActive = false;
    this.receiptPages = [];
    this.chatImage = null;
    this.chatImagePages = null;
    this.chatMimeType = 'image/jpeg';
    this.render();
  }

  // Drop one page that came out unreadable, by position rather than by
  // "the last one" - the bad page is not always the most recent.
  removeReceiptPage(index) {
    if (!this.receiptPages || !this.receiptPages.length) return;
    const i = parseInt(index, 10);
    if (isNaN(i) || i < 0 || i >= this.receiptPages.length) return;
    this.receiptPages.splice(i, 1);
    const last = this.receiptPages[this.receiptPages.length - 1];
    this.chatImage = last ? last.data : null;
    this.chatMimeType = last ? last.mime : 'image/jpeg';
    this.render();
  }

  // Finish collecting and hand the queue to the chat's own send path.
  //
  // The send logic in view-chat.js already writes the history entry, shows the
  // progress message, renders the debug block and handles errors. Duplicating
  // it here would mean two code paths to keep in step - the mistake that once
  // left a second copy of safe_smart_router carrying an unfixed log line - so
  // the queue is placed where that function looks for it and it is called.
  sendCollectedReceipt() {
    const pages = this.receiptPages || [];
    this.receiptPageMode = false;
    this.receiptPages = [];
    if (!pages.length) { this.chatImage = null; this.render(); return; }

    // chatImage stays a single value for the preview thumbnail; chatImagePages
    // is what actually travels, and the websocket schema accepts both.
    this.chatImage = pages[0].data;
    this.chatMimeType = pages[0].mime;
    this.chatImagePages = pages.map(pg => pg.data);

    if (typeof this.sendReceiptScan === 'function') {
      this.sendReceiptScan();
    } else {
      // The chat view has not rendered its input bar yet. Keep the pages so
      // nothing the user photographed is lost, and let them press send.
      this.render();
    }
  }

  // Start collecting, then open the camera for page one.
  startReceiptCapture() {
    this.receiptPageMode = true;
    this.receiptPages = [];
    // [FIXED v2026.9.22] Go through openCamera, not straight to a file picker.
    //
    // openCamera is where the three capture strategies are chosen: the
    // external app when "Enable App Integration" is ticked, the in-browser
    // camera when getUserMedia exists, and a native file input otherwise.
    // Calling openFileUpload directly skipped all of it, so the external app
    // never launched for receipts and users without HTTPS - who have no
    // getUserMedia at all - had no camera on this screen.
    // [FIXED v2026.9.23] Launch the app in the mode it actually implements.
    //
    // The external app was written when the receipt scanner and the barcode
    // scanner lived on one screen, so 'barcode' is the capture mode it knows.
    // Passing 'chat' opened it in a mode it does not handle. This is the same
    // call handleBarcodeScan makes, which is the path that has always worked.
    //
    // The mode only decides how the APP behaves. Where the photo goes when it
    // comes back is decided by receiptCaptureActive below, so a receipt is
    // still treated as a receipt and never sent for a barcode lookup.
    this.receiptCaptureActive = true;
    // The capture mode the external app opens on. It has a dedicated Receipt
    // tab, so this is 'invoice' - the receipt context openCamera has always
    // recognised. 'chat' opened the app in the wrong place and 'barcode'
    // opened its barcode scanner.
    //
    // If the app expects a different string, this is the only line to change:
    // the mode decides how the APP behaves, while receiptCaptureActive decides
    // where the returned photo goes, so the two cannot fall out of step.
    this.openCamera('invoice');
  }

  openFileUpload(context) {
    const input = this.shadowRoot.getElementById('universal-file-upload');
    if (!input) return;
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) { alert("File is too large. Max size is 10MB."); input.value = ''; return; }
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async re => this.processUploadedFile(re.target.result, context, 'application/pdf');
        reader.readAsDataURL(file);
      } else {
        this.compressImage(file, (dataUrl, finalMime) => this.processUploadedFile(dataUrl, context, finalMime), this.useAiBg !== false, context);
      }
      input.value = '';
    };
    input.click();
  }

  async processUploadedFile(dataUrl, context, mimeType) {
    const isSearch = context === 'search';
    // [FIXED v2026.9.24] 'invoice' is a receipt context as well.
        // openCamera has always mapped chat and invoice to the same
        // receipt labels, but these two capture paths only tested for
        // 'chat', so a capture started as 'invoice' fell through and the
        // photo went nowhere.
        const isChat   = context === 'chat' || context === 'invoice';

    if (context === 'stylist_avatar') { this.saveAvatarImage(dataUrl); return; }

    if (isChat || context === 'stylist_add') { 
        // [ADDED v2026.9.10] Multi-page receipts.
        //
        // A long till receipt does not fit in one photograph. When the chat is
        // already collecting pages, or the user is adding a further page, the
        // image joins the queue instead of replacing the single slot.
        //
        // PDFs are excluded on purpose: a PDF from a phone's document scanner
        // is already a complete multi-page document, so asking "any more
        // pages?" would be noise.
        if (isChat && this.receiptPageMode && mimeType !== 'application/pdf') {
            this.receiptPages = this.receiptPages || [];
            this.receiptPages.push({ data: dataUrl, mime: mimeType });
            this.chatImage = dataUrl; this.chatMimeType = mimeType;
            this.askForMoreReceiptPages();
            this.render(); return;
        }
        this.chatImage = dataUrl; this.chatMimeType = mimeType;
        // [MODIFIED v2026.9.14] Send straight away. The send button is gone, so
        // a file that was picked and then left sitting in a preview would never
        // reach the model at all.
        //
        // Only for the receipts screen: 'stylist_add' still stages its image
        // for that screen's own flow.
        if (isChat && typeof this.sendReceiptScan === 'function') {
          this.render();
          this.sendReceiptScan();
          return;
        }
        if (context === 'stylist_add') {
            const inputBar = this.shadowRoot.querySelector('.chat-input');
            if (inputBar) inputBar.value = "stylist Add this clothing to my closet";
        }
        this.render(); return; 
    }

    const targetId = this.pendingItemId || this.pendingItem;
    if (!isSearch && targetId) this.setLoading(targetId, true);

    try {
      if (isSearch) {
        await this.callHA('ai_action', { mode: 'search', image_data: dataUrl, mime_type: mimeType, language: this.currentLang });
      } else if (this.pendingItemId) {
        await this.callHA('update_image', { item_id: this.pendingItemId, image_data: dataUrl, mime_type: mimeType });
        this.refreshImageVersion(this.pendingItemId);
        this.fetchData();
      } else if (this.pendingItem) {
        await this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl, mime_type: mimeType });
        this.refreshImageVersion(this.pendingItem);
        this.fetchData();
      }
    } catch (e) { console.error(e); }
    finally {
      if (!isSearch && targetId) this.setLoading(targetId, false);
      this.pendingItemId = null; this.pendingItem = null;
      localStorage.removeItem('ho_pending_item_id');
      localStorage.removeItem('ho_pending_item_name');
    }
  }

  // [ADDED v2026.9.23] One entry point for a receipt photo from the app.
  //
  // Shared by the two ways a photo can arrive - the flag-based route above and
  // the ctx === 'chat' route - so both behave identically and cannot drift.
  handleReceiptPhotoFromApp(imageData, applyAiBg) {
    const mimeMatch = String(imageData).match(/^data:(image\/\w+);base64,/);
    const incomingMime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = incomingMime === 'image/png' ? 'png' : 'jpg';

    fetch(imageData)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `ext_cam.${ext}`, { type: incomingMime });
        this.compressImage(file, (dataUrl, finalMime) => {
          this.chatImage = dataUrl;
          this.chatMimeType = finalMime;
          // The app may have been launched from any screen; the result belongs
          // on the receipts screen.
          this.isReviewMode = true;
          this.isChatMode = false; this.isReceiptsMode = false;
          this.isShopMode = false; this.isSearch = false;
          this.isEditMode = false; this.isStylistMode = false;

          if (this.receiptPageMode) {
            this.receiptPages = this.receiptPages || [];
            this.receiptPages.push({ data: dataUrl, mime: finalMime });
            this.render();
            this.askForMoreReceiptPages();
            return;
          }
          this.render();
          if (typeof this.sendReceiptScan === 'function') this.sendReceiptScan();
        }, applyAiBg, 'chat');
      })
      .catch(err => alert("Error handling image from app: " + err.message));
  }

  handleExternalCameraEvent(data) {
    if (!data) return;
    const ctx = data.context || 'chat';
    const applyAiBg = data.apply_ai_bg === true;

    if (!this.pendingItemId && localStorage.getItem('ho_pending_item_id')) {
      this.pendingItemId = localStorage.getItem('ho_pending_item_id');
      this.pendingItem   = localStorage.getItem('ho_pending_item_name');
    }

    // [ADDED v2026.9.23] A receipt capture claims the result first.
    //
    // The app is launched in 'barcode' mode because that is the mode it
    // implements, so the context coming back says 'barcode' even though the
    // user pressed "Scan receipt". Without this the photo would be sent for a
    // barcode lookup and the receipt would be lost.
    //
    // Cleared immediately, so a later genuine barcode scan is unaffected even
    // if the user abandons this one.
    if (this.receiptCaptureActive && data.image_data) {
      this.receiptCaptureActive = false;
      this.handleReceiptPhotoFromApp(data.image_data, data.apply_ai_bg === true);
      return;
    }
    if (ctx === 'barcode' && data.barcode_data) {
      this.receiptCaptureActive = false;
      this.executeBarcodeLookup(data.barcode_data);
      localStorage.removeItem('ho_pending_item_id');
      localStorage.removeItem('ho_pending_item_name');
      return;
    }

    if (!data.image_data) return;

    const mimeMatch = data.image_data.match(/^data:(image\/\w+);base64,/);
    const incomingMime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = incomingMime === 'image/png' ? 'png' : 'jpg';

    fetch(data.image_data)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `ext_cam.${ext}`, { type: incomingMime });
        
        if (ctx === 'stylist_avatar') {
          this.compressImage(file, (dataUrl, finalMime) => this.saveAvatarImage(dataUrl), applyAiBg, ctx);
          return;
        }

        if (ctx === 'stylist_add') {
          this.compressImage(file, (dataUrl, finalMime) => {
            this.chatImage = dataUrl; this.chatMimeType = finalMime;
            if (!this.isStylistMode) { this.isStylistMode = true; this.isShopMode = false; this.isSearch = false; this.isEditMode = false; this.isReviewMode = false; this.isChatMode = false;}
            this.render();
            setTimeout(() => {
              const sendBtn = this.shadowRoot.querySelector('.chat-send-btn');
              const input   = this.shadowRoot.querySelector('.chat-input');
              if (input) input.value = "stylist Add this clothing to my closet";
              if (sendBtn) sendBtn.click();
            }, 200);
          }, applyAiBg, ctx);
          return;
        }
        
        if (ctx === 'chat' || ctx === 'invoice') {
          // Same handling as the flag-based route above: one implementation,
          // so the two entry points cannot behave differently.
          this.compressImage(file, (dataUrl, finalMime) => {
            this.chatImage = dataUrl;
            this.chatMimeType = finalMime;
            this.isReviewMode = true;
            this.isChatMode = false; this.isReceiptsMode = false;
            this.isShopMode = false; this.isSearch = false;
            this.isEditMode = false; this.isStylistMode = false;
            if (this.receiptPageMode) {
              this.receiptPages = this.receiptPages || [];
              this.receiptPages.push({ data: dataUrl, mime: finalMime });
              this.render();
              this.askForMoreReceiptPages();
              return;
            }
            this.render();
            if (typeof this.sendReceiptScan === 'function') this.sendReceiptScan();
          }, applyAiBg, ctx);
        } else {
          this.compressImage(file, (dataUrl, finalMime) => this.processUploadedFile(dataUrl, ctx, finalMime), applyAiBg, ctx);
        }
      })
      .catch(err => alert("Error handling image from app: " + err.message));
  }

  async saveAvatarImage(dataUrl) {
      const lbl = this.shadowRoot.getElementById('lbl-loading');
      if (lbl) lbl.innerText = "Saving Avatar...";
      try {
          const res = await this._hass.callWS({ type: 'home_organizer/save_avatar', image_data: dataUrl });
          if(res.error) throw new Error(res.error);
          alert("Avatar saved successfully! The UI will reload to update the picture.");
          window.location.reload();
      } catch(e) {
          alert("Failed to save avatar: " + e.message);
          this.render();
      }
  }

  async executeBarcodeLookup(code) {
    this.isBarcodeMode = false; 

    if (!this.isChatMode) {
      this.isChatMode = true; this.isShopMode = false; this.isSearch = false; this.isEditMode = false; this.isReviewMode = false;
    }
    
    const statusMsg = { role: 'system', text: `Looking up barcode: <b>${code}</b>...`, isStatus: true };
    this.chatHistory.push(statusMsg);
    this.render();

    setTimeout(() => { const m = this.shadowRoot.querySelector('.chat-messages'); if (m) m.scrollTop = m.scrollHeight; }, 50);

    try {
      const res = await this._hass.callWS({ type: 'home_organizer/lookup_barcode', barcode: code, language: this.currentLang });
      statusMsg.isStatus = false;
      if (res.found) {
        const pathArr = res.item.path || [];
        this.callHA('add_item', {
          item_name: res.item.name, category: res.item.category || "",
          sub_category: res.item.sub_category || "", icon_key: res.item.icon_key || null,
          barcode: code, item_type: 'pending', current_path: pathArr.filter(p => p)
        });
        statusMsg.text = `✅ Found in memory! Added <b>${res.item.name}</b> to Review tab.`;
      } else {
        statusMsg.text = "";
        statusMsg.isBarcodeConfirm = true;
        statusMsg.barcode = code;
        statusMsg.suggestion = res.suggestion || { name: `Scanned Product (${code})` };
      }
      this.render();
      setTimeout(() => { const m = this.shadowRoot.querySelector('.chat-messages'); if (m) m.scrollTop = m.scrollHeight; }, 50);
    } catch (err) {
      console.error("Barcode lookup failed", err);
      statusMsg.text = `❌ Barcode lookup failed.`; statusMsg.isStatus = false;
      this.render();
    }
  }

  async ensureBarcodeDetector() {
    if ('BarcodeDetector' in window) return true;
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "/home_organizer_static/barcode-detector.umd.js";
        script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
      });
      if (window.barcodeDetector?.BarcodeDetector) {
        window.BarcodeDetector = window.barcodeDetector.BarcodeDetector;
        return true;
      }
    } catch (e) { console.warn("Failed to load BarcodeDetector polyfill", e); }
    return false;
  }

  async handleBarcodeScan() {
    if (this.useExternalCamera) { this.openCamera('barcode'); return; }

    const isSupported = await this.ensureBarcodeDetector();
    if (!isSupported) { alert("Barcode scanning is completely unsupported on this device/browser."); return; }

    this.openCamera('barcode');

    let detector;
    try { detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }); }
    catch (e) { detector = new BarcodeDetector(); }

    const video     = this.shadowRoot.getElementById('camera-video');
    const rotCanvas = document.createElement('canvas');
    const rotCtx    = rotCanvas.getContext('2d', { willReadFrequently: true });

    let lastCode = null, confidence = 0;
    const REQUIRED_CONFIDENCE = 3;

    const scanFrame = async () => {
      if (this.cameraContext !== 'barcode' || !video.srcObject) return;
      if (video.readyState >= 2) {
        try {
          let barcodes = await detector.detect(video);
          if (barcodes.length === 0 && video.videoWidth > 0) {
            rotCanvas.width = video.videoHeight; rotCanvas.height = video.videoWidth;
            rotCtx.save();
            rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
            rotCtx.rotate(90 * Math.PI / 180);
            rotCtx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
            rotCtx.restore();
            barcodes = await detector.detect(rotCanvas);
          }
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code === lastCode) confidence++; else { lastCode = code; confidence = 1; }
            if (confidence >= REQUIRED_CONFIDENCE) {
              this.playBeep(); this.stopCamera();
              this.executeBarcodeLookup(code); 
              return;
            } else { setTimeout(() => requestAnimationFrame(scanFrame), 100); return; }
          }
        } catch (e) {}
      }
      setTimeout(() => requestAnimationFrame(scanFrame), 150);
    };

    video.onloadeddata = () => { video.play(); requestAnimationFrame(scanFrame); };
  }

  triggerCameraEdit(id, name) {
    this.pendingItemId = id; this.pendingItem = name;
    localStorage.setItem('ho_pending_item_id', id || '');
    localStorage.setItem('ho_pending_item_name', name || '');
    this.openCamera('update');
  }

  triggerFileUploadEdit(id, name) {
    this.pendingItemId = id; this.pendingItem = name;
    this.openFileUpload('update');
  }

  compressImage(file, callback, applyBgFilter = false, context = null) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX = context === 'update' ? 512 : 1024;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } }
        canvas.width = Math.floor(w); canvas.height = Math.floor(h);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        let outMime = file.type;

        if (applyBgFilter) {
          outMime = 'image/png';
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 190 && data[i+1] > 190 && data[i+2] > 190) { data[i]=255; data[i+1]=255; data[i+2]=255; data[i+3]=0; }
          }
          ctx.putImageData(imageData, 0, 0);
        }
        
        if (outMime !== 'image/png' && outMime !== 'image/jpeg') outMime = 'image/jpeg';
        callback(canvas.toDataURL(outMime, 0.8), outMime);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};