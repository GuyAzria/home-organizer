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
// [MODIFIED v2026.10.5 | 2026-10-05] Purpose: a spanner opens the lookup
//   order - which product database is asked first, and which are switched
//   off - and a scanned product appears HERE.
//
//   The three source names stay in English on purpose: they are the
//   services' own names, and a translated "Open Food Facts" would be a
//   different product. Typing a number SWAPS two rows rather than shifting
//   them, because a shift moves rows the user said nothing about.
//
//   This page was a button on an empty screen. A barcode scan creates a
//   PENDING item, and the review tab was the only thing in the panel that
//   draws one - so the product landed on the receipts screen, beside things
//   that came off an invoice, and this page never showed anything at all.
//   executeBarcodeLookup made that explicit: it set isBarcodeMode = false and
//   switched to the review screen before the lookup had even returned.
//
//   Worse, the confirmation step for a barcode the inventory does not know
//   was DEAD. It was written into chatHistory, and the chat list that used to
//   render chatHistory was removed in an earlier release - nothing creates a
//   .chat-messages element any more. Scanning an unknown code did nothing
//   visible whatsoever.
//
//   The page now keeps the scan where it started: the progress line, the
//   question for an unknown code, and the pending cards for everything
//   scanned and not yet filed. The card is buildPendingCard from view-chat.js
//   - the same one the review tab draws, not a second copy (RULE 33d).
//
// [ADDED v10.0.4] Barcode View

import { ICONS } from '../organizer-icon.js?v=10.11.112';
import { escapeHtml, isBarcodeScanned } from '../organizer-utils.js?v=10.11.112';

export const BarcodeMixin = (Base) => class extends Base {

  // Everything scanned by barcode and not yet filed.
  //
  // The split is receipt_id: a receipt scan sets one, a barcode scan never
  // does. It is only reliable because a receipt line with no printed barcode
  // now stores "0" instead of the string "None" - before that every pending
  // item looked like a barcode scan.
  barcodePending(attrs) {
    return (attrs?.pending_list || []).filter(isBarcodeScanned);
  }

  renderBarcodeView(content, attrs) {
    const waiting = this.barcodePending(attrs);

    content.style.padding = '0';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.minHeight = '0';
    content.innerHTML = '';

    // Nothing scanned yet: the whole screen is the invitation to scan.
    if (!waiting.length && !this.barcodeStatus && !this.barcodePrompt) {
      content.appendChild(this.buildBarcodeLanding());
      if (this.barcodeSheet) content.appendChild(this.buildBarcodeSheet());
      return;
    }

    content.appendChild(this.buildBarcodeBar(waiting.length));
    if (this.barcodeSheet) content.appendChild(this.buildBarcodeSheet());

    const list = document.createElement('div');
    list.className = 'item-list';
    list.style.cssText = 'flex:1;min-height:0;overflow-y:auto;'
      + 'padding:0 15px 15px 15px;';

    if (this.barcodeStatus) list.appendChild(this.buildBarcodeStatus());
    if (this.barcodePrompt) list.appendChild(this.buildBarcodePrompt());

    // The same card the review tab draws. rec is null: a barcode scan has no
    // receipt, so the receipt line renders as nothing.
    waiting.forEach((item) => {
      list.appendChild(this.buildPendingCard(item, null));
    });

    content.appendChild(list);
  }

  // The empty screen: an icon, a sentence and the button.
  buildBarcodeLanding() {
    const wrap = document.createElement('div');
    // Logical properties only - this panel marks direction with a class and
    // never sets dir, so a physical margin does not flip (RULE 33b).
    wrap.style.cssText = 'text-align:center;padding:40px;display:flex;'
      + 'flex-direction:column;align-items:center;justify-content:center;'
      + 'height:100%;';
    wrap.innerHTML = `
      <div style="font-size:80px;margin-bottom:20px;color:var(--primary);">${ICONS.barcode}</div>
      <h2 style="color:var(--primary);margin-bottom:15px;">${escapeHtml(this._t('barcode_scanner', 'Barcode Scanner'))}</h2>
      <p style="color:var(--text-sub);line-height:1.5;margin-bottom:40px;max-width:300px;margin-inline:auto;">
        ${escapeHtml(this._t('barcode_intro', 'Scan a product to identify it and add it to your inventory.'))}
      </p>`;
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.type = 'button';
    btn.style.cssText = 'width:220px;min-height:55px;background:var(--primary);'
      + 'color:white;font-size:16px;border-radius:28px;display:flex;'
      + 'align-items:center;justify-content:center;gap:10px;'
      + 'box-shadow:0 4px 15px rgba(3,169,244,0.4);';
    btn.innerHTML = ICONS.camera;
    btn.appendChild(document.createTextNode(
      ' ' + this._t('barcode_start', 'Start Scanning')));
    btn.onclick = () => this.handleBarcodeScan();
    wrap.appendChild(btn);
    wrap.appendChild(this.buildBarcodeSpanner(true));
    return wrap;
  }

  // A compact strip once there is something on the page: scan again, and how
  // many are waiting.
  buildBarcodeBar(count) {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;'
      + 'padding:12px 15px;flex-shrink:0;';

    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.type = 'button';
    // Thumb-sized: this screen is used on a phone with a camera in the other
    // hand, and there is no hover anywhere on it (RULE 36).
    btn.style.cssText = 'flex:1;min-height:44px;background:var(--primary);'
      + 'color:white;border-radius:22px;display:flex;align-items:center;'
      + 'justify-content:center;gap:8px;';
    btn.innerHTML = ICONS.camera;
    btn.appendChild(document.createTextNode(
      ' ' + this._t('barcode_start', 'Start Scanning')));
    btn.onclick = () => this.handleBarcodeScan();
    bar.appendChild(btn);

    bar.appendChild(this.buildBarcodeSpanner(false));

    if (count > 0) {
      const tally = document.createElement('span');
      tally.style.cssText = 'font-size:11px;color:var(--primary);'
        + 'white-space:nowrap;';
      tally.textContent = this._t('barcode_waiting', '{n} to review')
        .replace('{n}', String(count));
      bar.appendChild(tally);
    }
    return bar;
  }

  // [ADDED v2026.10.5] The spanner. On both the empty screen and the bar,
  // because the order is worth setting before the first scan as much as
  // after it.
  buildBarcodeSpanner(roomy) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.type = 'button';
    btn.title = this._t('barcode_order_title', 'Lookup order');
    // Always visible: there is no hover on a phone (RULE 36).
    btn.style.cssText = 'flex-shrink:0;min-width:44px;min-height:44px;'
      + 'display:flex;align-items:center;justify-content:center;'
      + (roomy ? 'margin-top:18px;' : '');
    btn.innerHTML = ICONS.wrench;
    btn.onclick = () => this.openBarcodeSources();
    return btn;
  }

  // [ADDED v2026.10.5] The lookup order, behind the spanner.
  //
  // Three rows, one per source, in the order they will be asked. The names are
  // in English on purpose: they are the services' own names, and a translated
  // "Open Food Facts" would be a different product.
  async openBarcodeSources() {
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/barcode_sources' });
      this.barcodeSources = res?.sources || [];
    } catch (e) {
      console.error(e);
      this.barcodeSources = [];
    }
    this.barcodeSheet = true;
    this.render();
  }

  closeBarcodeSources() {
    this.barcodeSheet = false;
    this.render();
  }

  // Typing a number SWAPS the two rows.
  //
  // "If I set the one at 1 to 3, then 1 goes to 3 and 3 goes to 1." Not a
  // shift: a shift moves the other two as well, and the user only said
  // anything about one of them.
  swapBarcodeSource(fromIdx, raw) {
    const rows = (this.barcodeSources || []).slice();
    const want = parseInt(raw, 10);
    if (!Number.isFinite(want)) { this.render(); return; }
    const toIdx = Math.min(rows.length, Math.max(1, want)) - 1;
    if (toIdx === fromIdx || !rows[toIdx] || !rows[fromIdx]) {
      // Out of range or no move: redraw, so the box shows the real position
      // again rather than whatever was typed into it.
      this.render();
      return;
    }
    const tmp = rows[fromIdx];
    rows[fromIdx] = rows[toIdx];
    rows[toIdx] = tmp;
    this.barcodeSources = rows;
    this.saveBarcodeSources();
  }

  toggleBarcodeSource(idx, on) {
    const rows = (this.barcodeSources || []).slice();
    if (!rows[idx]) return;
    rows[idx] = { name: rows[idx].name, enabled: !!on };
    this.barcodeSources = rows;
    this.saveBarcodeSources();
  }

  // Saved as it is changed. The local list is always every source exactly
  // once - a swap cannot break that - so the write cannot be refused and
  // there is no half-saved state to explain.
  //
  // What comes back is what is STORED, not what was sent: the backend repairs
  // the list on read, so the sheet draws the order that will really be asked
  // (RULE 2).
  async saveBarcodeSources() {
    this.render();
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/barcode_sources',
        sources: this.barcodeSources,
      });
      this.barcodeSources = res?.sources || this.barcodeSources;
      if (res && res.saved === false) {
        console.warn('Home Organizer: the lookup order was not saved.');
      }
    } catch (e) {
      console.error(e);
    }
    this.render();
  }

  buildBarcodeSheet() {
    const ov = document.createElement('div');
    ov.id = 'barcode-sources-sheet';
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;'
      + 'background:rgba(0,0,0,.85);z-index:3500;display:flex;'
      + 'align-items:center;justify-content:center;padding:15px;'
      + 'box-sizing:border-box;';
    ov.onclick = (e) => { if (e.target === ov) this.closeBarcodeSources(); };

    const card = document.createElement('div');
    card.className = 'modal-content';
    card.style.cssText = 'text-align:start;max-width:420px;width:100%;';

    const head = document.createElement('div');
    head.style.cssText = 'font-size:16px;font-weight:bold;color:var(--primary);'
      + 'text-align:center;';
    head.textContent = this._t('barcode_order_title', 'Lookup order');
    card.appendChild(head);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-sub);';
    hint.textContent = this._t(
      'barcode_order_hint',
      'The first source that answers is used. Change a number to move a row. '
      + 'Untick one to skip it.');
    card.appendChild(hint);

    (this.barcodeSources || []).forEach((row, idx) => {
      card.appendChild(this.buildBarcodeSourceRow(row, idx));
    });

    const close = document.createElement('button');
    close.className = 'action-btn';
    close.type = 'button';
    close.style.cssText = 'width:100%;min-height:44px;';
    close.textContent = this._t('close', 'Close');
    close.onclick = () => this.closeBarcodeSources();
    card.appendChild(close);

    ov.appendChild(card);
    return ov;
  }

  buildBarcodeSourceRow(row, idx) {
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;align-items:center;gap:10px;'
      + 'padding:8px;border-radius:8px;background:var(--bg-input-edit);';

    // The box is 22px because a bigger one looks wrong, but 22px is half a
    // thumb. A label WRAPPING the input toggles it natively on tap, so the
    // hit area is the label's 44px while the drawn box stays small (RULE 36).
    const tickHit = document.createElement('label');
    tickHit.style.cssText = 'display:flex;align-items:center;'
      + 'justify-content:center;min-width:44px;min-height:44px;'
      + 'flex-shrink:0;cursor:pointer;margin:0;';

    const tick = document.createElement('input');
    tick.type = 'checkbox';
    tick.checked = !!row.enabled;
    tick.style.cssText = 'width:22px;height:22px;cursor:pointer;';
    tick.onchange = () => this.toggleBarcodeSource(idx, tick.checked);
    tickHit.appendChild(tick);
    line.appendChild(tickHit);

    const name = document.createElement('span');
    name.style.cssText = 'flex:1;min-width:0;overflow:hidden;'
      + 'text-overflow:ellipsis;white-space:nowrap;font-size:13px;'
      + (row.enabled ? '' : 'opacity:.5;');
    // textContent, and the service's own English name - not translated.
    name.textContent = row.name;
    line.appendChild(name);

    const pos = document.createElement('input');
    pos.type = 'number';
    pos.min = '1';
    pos.max = String((this.barcodeSources || []).length || 1);
    pos.value = String(idx + 1);
    pos.style.cssText = 'width:52px;min-height:40px;text-align:center;'
      + 'padding:6px;border-radius:6px;border:1px solid var(--border-light);'
      + 'background:var(--bg-input);color:var(--text-main);font-size:14px;';
    pos.onchange = () => this.swapBarcodeSource(idx, pos.value);
    line.appendChild(pos);

    return line;
  }

  // Progress, or what went wrong. Appended, never assigned over the list.
  buildBarcodeStatus() {
    const bad = this.barcodeStatus?.bad;
    const line = document.createElement('div');
    line.style.cssText = 'margin:0 0 12px 0;padding:10px 12px;'
      + 'border-radius:8px;font-size:13px;color:#fff;'
      + `background:${bad ? 'var(--error-color,#c62828)'
                          : 'var(--primary-color,#03a9f4)'};`;
    // textContent: this line carries a product name a model read off a packet
    // (RULE 15).
    line.textContent = this.barcodeStatus?.text || '';
    return line;
  }

  // A code the inventory does not know yet.
  //
  // This step existed before and could not be seen: it was pushed into
  // chatHistory, which nothing renders any more. The user scanned an unknown
  // product and the screen did not change.
  buildBarcodePrompt() {
    const { barcode, name } = this.barcodePrompt;
    const card = document.createElement('div');
    card.className = 'pending-card';
    card.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    const ask = document.createElement('div');
    ask.style.cssText = 'font-size:13px;color:var(--text-sub);';
    ask.textContent = this._t(
      'barcode_unknown',
      'This barcode is new. Check the name and I will add it.');
    card.appendChild(ask);

    const code = document.createElement('div');
    code.style.cssText = 'font-size:11px;color:var(--text-sub);'
      + 'display:flex;align-items:center;gap:6px;direction:ltr;'
      + 'align-self:flex-start;opacity:.8;';
    code.textContent = barcode;
    card.appendChild(code);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pending-name-input';
    input.style.width = '100%';
    input.value = name || '';
    card.appendChild(input);

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;';
    const cancel = document.createElement('button');
    cancel.className = 'action-btn';
    cancel.type = 'button';
    cancel.style.cssText = 'flex:1;min-height:44px;';
    cancel.textContent = this._t('cancel', 'Cancel');
    cancel.onclick = () => { this.barcodePrompt = null; this.render(); };
    const go = document.createElement('button');
    go.className = 'action-btn';
    go.type = 'button';
    go.style.cssText = 'flex:1;min-height:44px;background:var(--success);'
      + 'color:white;';
    go.textContent = this._t('barcode_add', 'Add it');
    go.onclick = () => this.resolveScannedBarcode(barcode, input.value);
    bar.appendChild(cancel);
    bar.appendChild(go);
    card.appendChild(bar);
    return card;
  }

  // Name a code the inventory did not recognise, and let the backend file it.
  //
  // RESOLVE_BARCODE: is a protocol token the panel builds, never a translated
  // word, so it means the same thing in every language (RULE 20).
  async resolveScannedBarcode(barcode, name) {
    const clean = String(name || '').trim();
    if (!barcode || !clean) return;
    this.barcodePrompt = null;
    this.barcodeStatus = {
      text: this._t('barcode_adding', 'Adding...'), bad: false };
    this.render();
    try {
      await this._hass.callWS({
        type: 'home_organizer/ai_chat',
        message: `RESOLVE_BARCODE:${barcode}-${clean}`,
        language: this.currentLang || 'en',
      });
      this.barcodeStatus = null;
    } catch (e) {
      console.error(e);
      this.barcodeStatus = {
        text: this._t('barcode_failed', 'The lookup failed.'), bad: true };
    }
    // The item arrives as a pending row, so the list has to be refetched
    // before it can be drawn.
    await this.fetchData();
  }
};
