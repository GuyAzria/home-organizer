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
// [FIXED v2026.10.5 | 2026-10-05] Purpose: a scanned product appears on the
//   BARCODE page.
//
//   buildPendingCard was lifted out of the review loop so the barcode page can
//   draw the same card - copying 140 lines of category selects and date fields
//   is the shape RULE 33a.6 warns about. The review tab also stops listing and
//   counting barcode scans: a badge for items a tab does not show is a badge
//   that cannot be cleared.
// [FIXED v2026.10.3 | 2026-10-03] Purpose: the scan sends an empty control
//   message, the banner exists on both tabs, and the reply is no longer
//   thrown away.
//
//   The message field is a control signal, not display text: an empty
//   message is what tells get_invoice_prompt there is no user instruction,
//   and HOAppScanView has sent "" for a receipt all along. Sending
//   _t('scanned_invoice') meant every non-English scan had a SPECIAL USER
//   INSTRUCTION appended to its prompt, after which the model asked a
//   clarifying question instead of reading the receipt (RULE 20). That
//   question arrives with no receipt_id and was discarded here, so the
//   screen stayed blank - any reply that saved no receipt and carries text
//   is now shown.
//
//   Two silences. The success branch read result.receipt_id and nothing
//   else, so a scan that stored a header and no product lines - which the
//   backend reports, and which the invoice prompt explicitly asks the
//   model to return for a receipt with no products - showed an empty
//   review queue and no message at all.
//
//   And the banner was built inline in the review branch only, so on the
//   Receipts tab no scan message of any kind could appear - not progress,
//   not an error, not the duplicate notice. That is the tab the user is on
//   when they have just deleted a receipt and are re-scanning it, which is
//   the one moment it matters. renderScanBanner is now one method called
//   from both (RULE 33d).
//

import { ICONS } from '../organizer-icon.js?v=10.11.112';
import { escapeHtml, formatAiText, categorySelectOptions, itemDateField, isBarcodeScanned } from '../organizer-utils.js?v=10.11.112';
const UPLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>';
const miniBarcodeSvg = '<svg style="width:12px;height:12px" viewBox="0 0 24 24"><path fill="currentColor" d="M3,6H5V18H3V6M7,6H8V18H7V6M9,6H12V18H9V6M13,6H14V18H13V6M16,6H18V18H16V6M19,6H21V18H19V6Z"/></svg>';

export const ChatMixin = (Base) => class extends Base {
  renderChatAndReviewView(content, attrs) {
      // [FIXED v2026.9.16] Make the default explicit.
      //
      // The view falls back to the review list when no flag is set, but
      // fetchData sends shopping_mode: isShopMode || isReviewMode - and the
      // backend only returns pending_list when that is true. After a restart
      // every flag is false, so the review list rendered while the fetch
      // asked for data that excluded it, and the tab came up empty even
      // though the scanned items were sitting in the database all along.
      if (!this.isReceiptsMode && !this.isReviewMode) {
        this.isReviewMode = true;
        if (!attrs || !attrs.pending_list) { this.fetchData(); }
      }
      content.style.padding = '0'; content.style.display = 'flex'; content.style.flexDirection = 'column';
      const tabContainer = document.createElement('div'); tabContainer.className = 'shop-tabs'; tabContainer.style.margin = '10px 15px 10px 15px'; tabContainer.style.flexShrink = '0';
      // [MODIFIED v2026.10.5] Barcode scans live on the barcode page now,
      // so they are not counted here either - a badge for items this tab
      // does not show is a badge that cannot be cleared.
      const reviewPending = (attrs.pending_list || [])
        .filter((it) => !isBarcodeScanned(it));
      const pendingCount = reviewPending.length;
      // [MODIFIED v2026.9.14] The chat tab is gone. Item commands moved to the
      // general HA conversation agent, so this screen is now only the review
      // queue and the receipts archive.
      tabContainer.innerHTML = `<div class="shop-tab ${!this.isReceiptsMode ? 'active' : ''}" id="ai-tab-review">${escapeHtml(this._t('review_tab', 'AI Receipts Exports'))} ${pendingCount > 0 ? `<span class="shop-badge">${pendingCount}</span>` : ''}</div><div class="shop-tab ${this.isReceiptsMode ? 'active' : ''}" id="ai-tab-receipts">${escapeHtml(this._t('receipts_tab', 'Receipts'))}</div>`;
      content.appendChild(tabContainer);
      tabContainer.querySelector('#ai-tab-review').onclick = () => { this.isReviewMode = true; this.isChatMode = false; this.isReceiptsMode = false; this.isDashboardMode = false; this.fetchData(); };
      tabContainer.querySelector('#ai-tab-receipts').onclick = () => {
        this.isReceiptsMode = true; this.isChatMode = false; this.isReviewMode = false;
        this.loadReceipts();
      };

      const tabContent = document.createElement('div'); tabContent.style.flex = '1'; tabContent.style.minHeight = '0'; tabContent.style.display = 'flex'; tabContent.style.flexDirection = 'column'; tabContent.style.overflowY = this.isReviewMode ? 'auto' : 'hidden'; 
      // Review is the default: reaching this screen with no tab chosen means
      // the user came to deal with scans.
      if (this.isReceiptsMode) {
        // [FIXED v2026.9.27] Load on arrival, not only on a tab click.
        //
        // loadReceipts() was wired to the tab's onclick and to nothing else,
        // while the panel restores whichever screen it was last on. Opening it
        // straight onto this tab left receiptsData undefined and the table fell
        // back to its empty shape - the archive looked empty until the two tabs
        // were toggled, because toggling is what ran the handler.
        //
        // The flag is set BEFORE the call, not after: loadReceipts() renders
        // twice on its own and would re-enter this branch and ask again.
        if (!this.receiptsRequested) {
          this.receiptsRequested = true;
          this.loadReceipts();
        }
        // [FIXED v2026.10.3] The scan banner belongs on this tab as well.
        //
        // It was built only in the else below, so scanning while on the
        // Receipts tab could not show a message of any kind - not progress,
        // not an error, not the duplicate notice. That is the tab the user
        // is on when they have just deleted a receipt and are re-scanning
        // it, which is the one moment the message matters most.
        this.renderScanBanner(tabContent);
        this.renderReceiptsTable(tabContent);
      }
      else {
        // The list grows and scrolls; margin-top:auto on the bar then pushes
        // it to the bottom even when the list is empty.
        tabContent.style.padding = '0 15px 0 15px';
        tabContent.style.display = 'flex';
        tabContent.style.flexDirection = 'column'; const listContainer = document.createElement('div'); listContainer.className = 'item-list';
        // [ADDED v2026.9.14] The chat window used to carry progress and
        // errors. With it gone they surface here, or they would be invisible.
        // The capture queue sits above everything: it is the thing the user
        // is in the middle of.
        this.renderReceiptQueue(listContainer);
        this.renderScanBanner(listContainer);
        if (reviewPending.length > 0) {
          // [ADDED v2026.9.11] Group the review list by receipt.
          //
          // A single scan can produce forty rows. Ungrouped they read as one
          // undifferentiated wall with no way to tell where one shopping trip
          // ends and the next begins, and no way to act on a whole receipt.
          //
          // Items with no receipt - manual adds, barcode scans, garment photos -
          // keep their own group at the end rather than disappearing.
          const receipts = attrs.pending_receipts || {};
          const groups = new Map();
          // [MODIFIED v2026.10.5] The same filtered list the badge counts.
          // A product scanned by barcode belongs on the barcode page, which
          // is where the user was standing when they scanned it.
          reviewPending.forEach(it => {
            const key = it.receipt_id ? String(it.receipt_id) : '__none__';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(it);
          });
          this.collapsedScans = this.collapsedScans || {};

          groups.forEach((groupItems, key) => {
            const rec = receipts[key] || null;
            // One group only: open it. Forcing a click when there is nothing
            // to choose between is friction for no benefit.
            if (this.collapsedScans[key] === undefined) {
              this.collapsedScans[key] = groups.size > 1;
            }
            const collapsed = this.collapsedScans[key];

            const header = document.createElement('div');
            header.className = 'group-separator';
            header.id = `scan-header-${key}`;
            header.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:8px;';

            // Both are built with escapeHtml below; the Html suffix records
            // that they are already-escaped fragments, not raw text.
            const titleHtml = rec
              ? `${escapeHtml(rec.vendor || this._t('receipt_no_vendor', 'Unnamed receipt'))}`
              : escapeHtml(this._t('receipt_none', 'No receipt'));
            const metaHtml = rec
              ? [rec.purchase_date, rec.receipt_number ? '#' + rec.receipt_number : null,
                 rec.total_amount != null ? `${rec.total_amount} ${rec.currency || ''}`.trim() : null]
                .filter(Boolean).map(x => escapeHtml(String(x))).join(' | ')
              : '';

            // The counter is what tells a user who collapsed a group half way
            // through whether anything is still waiting in it.
            const counter = this._t('receipt_items_left', '{n} to review')
              .replace('{n}', groupItems.length);

            // The bin only appears while the scan is untouched. Once an item is
            // approved the receipt is real spending and the backend refuses to
            // delete it, so offering the button would be a lie.
            const canDelete = rec && (rec.status || 'draft') === 'draft';
            const binHtml = canDelete
              ? `<button class="action-btn btn-danger" title="${escapeHtml(this._t('receipt_delete_scan', 'Delete this entire scan'))}" onclick="event.stopPropagation();this.getRootNode().host.deleteScan('${escapeHtml(this.escapeJSArg(key))}')">${ICONS.delete}</button>`
              : '';

            header.innerHTML = `
              <span style="font-size:14px;">${collapsed ? '&#9656;' : '&#9662;'}</span>
              <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
                <span style="font-weight:bold;">${titleHtml}</span>
                <span style="font-size:11px;color:var(--text-sub);">${metaHtml}</span>
              </div>
              <span style="font-size:11px;color:var(--primary);white-space:nowrap;">${escapeHtml(counter)}</span>
              ${binHtml}`;
            header.onclick = () => {
              this.collapsedScans[key] = !this.collapsedScans[key];
              this.render();
            };
            listContainer.appendChild(header);

            if (collapsed) return;

            if (rec) {
              // [ADDED v2026.10.2] The date printed on the receipt, editable
              // before anything is approved.
              //
              // One control for the whole receipt, not one per item: the date
              // lives on the receipts row because every line was bought on the
              // same day. Rendering it per item would put several controls on
              // screen for one value (RULE 33a.6).
              //
              // Outside the header, because the header's onclick collapses the
              // group - a date input in there would need its own
              // stopPropagation on every interaction to stay usable.
              const dateBar = document.createElement('div');
              dateBar.style.cssText =
                'display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap;';
              dateBar.innerHTML = `
                <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-sub);">
                  ${escapeHtml(this._t('purchase_date', 'Purchase date'))}
                  <input type="date" id="receiptdate-${escapeHtml(key)}"
                         value="${escapeHtml(rec.purchase_date || '')}"
                         onchange="this.getRootNode().host.setReceiptDate('${escapeHtml(this.escapeJSArg(key))}',this.value)"
                         style="padding:6px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-input-edit);color:var(--text-main);font-size:12px;">
                </label>`;
              listContainer.appendChild(dateBar);

              const bulk = document.createElement('div');
              bulk.style.cssText = 'display:flex;gap:8px;margin:8px 0;';
              bulk.innerHTML = `<button class="action-btn" style="flex:1;" onclick="this.getRootNode().host.approveScan('${escapeHtml(this.escapeJSArg(key))}')">${escapeHtml(this._t('receipt_approve_all', 'Approve all'))}</button>`;
              listContainer.appendChild(bulk);
            }

            groupItems.forEach(item => {
              // [MODIFIED v2026.10.5] One card, two screens. The barcode
              // page draws the same one - see buildPendingCard.
              listContainer.appendChild(this.buildPendingCard(item, rec));
            });
          });
        } else {
          // [FIXED v2026.9.26] Append, do not assign.
          //
          // listContainer.innerHTML = ... replaced everything already in the
          // container, which included the capture queue appended a few lines
          // above. With no pending items - the normal state while scanning a
          // first receipt - the thumbnails and their buttons were built and
          // then immediately destroyed, so the screen looked as though nothing
          // had happened at all.
          const empty = document.createElement('div');
          empty.style.cssText = 'text-align:center;padding:20px;color:#888;';
          empty.textContent = this._t('all_caught_up', 'All caught up! No pending items to review.');
          listContainer.appendChild(empty);
        }
        listContainer.style.flex = '1';
        listContainer.style.overflowY = 'auto';
        tabContent.appendChild(listContainer);
        this.renderScanActions(tabContent);
        // Land on the scan that was just taken. Deferred so the nodes
        // exist, and cleared afterwards so it happens once and not on
        // every later render.
        if (this.focusScanId) {
          const target = this.focusScanId; this.focusScanId = null;
          setTimeout(() => {
            const el = this.shadowRoot?.getElementById(`scan-header-${target}`);
            if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 60);
        }
      }
      content.appendChild(tabContent);
      // [ADDED v2026.9.13] Mounted last so it sits above the tabs.
      if (this.receiptViewer) {
        const viewer = this.renderReceiptViewer();
        if (viewer) content.appendChild(viewer);
      }
  }

  // [ADDED v2026.10.5] One pending item, as a card. Used by the review
  // tab and by the barcode page.
  //
  // A barcode scan creates a PENDING item, and this card was the only
  // thing in the panel that draws one - so a scanned product appeared on
  // the receipts screen, which is where it was reported, and the barcode
  // page stayed a button on an empty screen.
  //
  // Lifted out rather than copied: it carries the category selects, the
  // location picker, the price and the dates, and two of those drifting
  // apart is the shape RULE 33a.6 warns about.
  //
  // `rec` is the receipt header when there is one. A barcode scan has no
  // receipt, so it passes null and buildReceiptLineHtml draws nothing.
  buildPendingCard(item, rec) {
            if (!this.locationEditState[item.id]) this.locationEditState[item.id] = { l1: item.level_1||'', l2: item.level_2||'', l3: item.level_3||'' };
            // [FIXED v2026.9.18] Build both lists from this.categories, and mark
            // the current value as selected.
            //
            // Two bugs lived in the two lines this replaces. Only Clothing,
            // Food and Electronics were offered out of 23 real categories, and
            // neither select ever carried a `selected` attribute - so whatever
            // the model or the user chose, the box redrew as "Select category"
            // on the next render and looked as though nothing had saved.
            //
            // [MODIFIED v2026.10.2] categorySelectOptions builds both lists.
            //
            // A value that is not in the list still has to appear, or the
            // select shows a blank and the next save writes that blank over
            // the field. It was appended as an ordinary option though, so a
            // category the model invented read like a real one. It is now
            // marked. The same list is drawn on the item card, and keeping
            // two copies is how the two drifted apart (RULE 33a.6).
            const curCat = item.category || '';
            const curSub = item.sub_category || '';
            const offList = this._t('off_list_hint', '(not in list)');
            const tr = (key, dflt) => this._t(key, dflt);
            // "+ Add" sits last so it never displaces a real choice.
            // updatePendingCategory treats __ADD__ as a sentinel, not a value.
            const addLabel = this._t('add_new', 'Add');
            const mainCatOptions = categorySelectOptions({
              names: Object.keys(this.categories),
              current: curCat,
              placeholder: this._t('select_cat', 'Category'),
              translate: tr, keyPrefix: 'cat_',
              addLabel, offListLabel: offList,
            });
            const subCatOptions = categorySelectOptions({
              names: Object.keys(this.categories[curCat] || {}),
              current: curSub,
              placeholder: this._t('select_sub', 'Sub-Category'),
              translate: tr, keyPrefix: 'sub_',
              // Only once a category is chosen: a sub-category with no
              // parent has nowhere to live.
              addLabel: curCat ? addLabel : '',
              offListLabel: offList,
            });
            
            let iconHtml = `<div class="item-icon" style="margin-inline-end:10px;">${ICONS.item}</div>`;
            // [MODIFIED v2026.9.20] "is it a photograph", not "is there an img":
            // a drawn icon lives in its own field, so an item that has one but no
            // img was falling through to the default.
            if (!this.itemHasPhoto(item)) {
              iconHtml = `<div class="item-icon" style="margin-inline-end:10px;">${this.getItemIcon(item)}</div>`;
            } else {
              let cleanPath = item.img.split('?')[0]; 
              const ver = this.imageVersions[item.id] || 'ok';
              iconHtml = `<img src="${cleanPath}?v=${ver}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;margin-inline-end:10px;">`;
            }

            const hierarchyHtml = (typeof this.renderHierarchyControl === 'function') ? this.renderHierarchyControl(item, true) : '';

            // [ADDED v2026.9.20] The scanner's category proposal, as a note.
            //
            // The scan no longer stops to ask where an odd product belongs -
            // one guitar on a fifty-line receipt used to replace the whole
            // list with a question. The item is filed under the nearest
            // category and what the assistant WOULD have opened is shown
            // here. Pressing Create is the explicit user action that opens a
            // top-level category (RULE 22); nothing was created by the scan.
            //
            // Only the id travels through the handler string. The name is
            // read from the item by the method itself.
            const suggestCat = (item.suggested_category || '').trim();
            const suggestHtml = suggestCat ? `
              <div class="cat-suggest">
                <span class="cat-suggest-text">${escapeHtml(this._t('cat_suggest_msg', 'Nothing here fits this item. Open a new category?'))}</span>
                <b class="cat-suggest-name">${escapeHtml(suggestCat)}</b>
                <button class="action-btn cat-suggest-yes" onclick="this.getRootNode().host.acceptCategorySuggestion('${escapeHtml(item.id)}')">${escapeHtml(this._t('cat_suggest_yes', 'Create'))}</button>
                <button class="action-btn cat-suggest-no" title="${escapeHtml(this._t('cat_suggest_no', 'Not now'))}" onclick="this.getRootNode().host.dismissCategorySuggestion('${escapeHtml(item.id)}')">${ICONS.close}</button>
              </div>` : '';

            // [ADDED v2026.10.2] The item's own expiry or warranty date,
            // before approval.
            //
            // The scan does not extract one - the invoice prompt never asks -
            // so this is usually empty and is the only way to set it while the
            // item is still a draft. It writes through saveItemExtras, the same
            // method the normal item card uses: id `itemdate-<id>` plus a
            // data-field naming the column (RULE 33d). That method also looks
            // for `price-<id>`, which this card does not have, so the price is
            // left alone - correct, because the pending price is committed when
            // the item is confirmed.
            //
            // The value survives approval: handle_confirm_pending updates the
            // row in place and never touches these two columns.
            const itemDate = itemDateField(item, (k, d) => this._t(k, d));
            const itemDateHtml = `
              <label style="display:flex;align-items:center;gap:6px;margin-top:6px;
                            font-size:11px;color:var(--text-sub);">
                ${escapeHtml(itemDate.label)}
                <input type="date" id="itemdate-${escapeHtml(item.id)}"
                       data-field="${escapeHtml(itemDate.field)}"
                       value="${escapeHtml(itemDate.value)}"
                       onchange="if(typeof this.getRootNode().host.saveItemExtras === 'function') this.getRootNode().host.saveItemExtras('${escapeHtml(item.id)}')"
                       style="padding:6px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-input-edit);color:var(--text-main);font-size:12px;">
              </label>`;

            const card = document.createElement('div'); card.className = 'pending-card';
            card.innerHTML = `
              <div class="pending-top">
                ${iconHtml}
                <div class="pending-name-col" style="display:flex;flex-direction:column;flex:1;margin-inline-end:10px;">
                  <input type="text" id="pending-name-${escapeHtml(item.id)}" class="pending-name-input" value="${escapeHtml(item.name)}" style="width:100%;">
                  ${item.barcode && item.barcode!=='0' ? `<div style="font-size:10px;color:var(--text-sub);margin-top:4px;display:inline-flex;align-items:center;gap:4px;opacity:.8;direction:ltr;align-self:flex-start;">${miniBarcodeSvg} ${escapeHtml(item.barcode)}</div>` : ''}
                </div>
                <!-- [MODIFIED v2026.10.2] The quantity and the price are one
                     element now. They were two of five children on this flex
                     row, and the name input - the one that has to shrink - was
                     unusable on a phone. Wrapped, they move to a row of their
                     own under 450px and the name gets the full width, which is
                     the order a normal item in a location already uses.
                     The inline spacing is the same as the three children
                     carried, so nothing moves at tablet or desktop width. -->
                <div class="pending-qty-group" style="display:flex;align-items:center;">
                  <input type="number" id="pending-qty-${escapeHtml(item.id)}" class="pending-qty-input" value="${escapeHtml(item.qty)}" min="1">
                  <!-- [ADDED v2026.9.11] Unit price, editable.
                       Not a convenience: a model that reads 4.90 as 49.0 would
                       otherwise write that figure into purchase_history, which is
                       append-only and never corrected. inputmode="decimal" opens a
                       numeric keypad on a phone. -->
                  <span style="font-size:11px;color:var(--text-sub);align-self:center;margin-inline-start:8px;">${escapeHtml(this._t('price', 'Price'))}</span>
                  <input type="number" step="0.01" min="0" inputmode="decimal"
                         id="pending-price-${escapeHtml(item.id)}" class="pending-qty-input"
                         style="width:70px;margin-inline-start:4px;"
                         placeholder="${escapeHtml(this._t('price', 'Price'))}"
                         value="${item.purchase_price != null ? escapeHtml(item.purchase_price) : ''}"
                         title="${escapeHtml(this._t('unit_price', 'Unit price'))}">
                </div>
              </div>
              ${this.buildReceiptLineHtml(item, rec, true)}
              ${itemDateHtml}
              <div class="pending-mid" style="display:flex;flex-direction:column;gap:8px;">${hierarchyHtml}${suggestHtml}<div style="display:flex;gap:5px;"><select class="move-select" id="pending-cat-main-${escapeHtml(item.id)}" style="flex:1;" onchange="this.getRootNode().host.updatePendingCategory('${escapeHtml(item.id)}',this.value,'main')">${mainCatOptions}</select><select class="move-select" id="pending-cat-sub-${escapeHtml(item.id)}" style="flex:1;" onchange="this.getRootNode().host.updatePendingCategory('${escapeHtml(item.id)}',this.value,'sub')">${subCatOptions}</select></div></div>
              <div class="pending-actions" style="justify-content:space-between;align-items:center;margin-top:12px;">
                <div style="display:flex;gap:10px;"><button class="action-btn" title="${this._t('take_photo', 'Take Photo')}" onclick="this.getRootNode().host.triggerCameraEdit('${escapeHtml(item.id)}','${escapeHtml(this.escapeJSArg(item.name))}')">${ICONS.camera}</button><button class="action-btn" title="${this._t('upload_file', 'Upload File')}" onclick="this.getRootNode().host.triggerFileUploadEdit('${escapeHtml(item.id)}','${escapeHtml(this.escapeJSArg(item.name))}')">${UPLOAD_SVG}</button><button class="action-btn" title="${this._t('change_img', 'Change Icon')}" onclick="this.getRootNode().host.openIconPicker('${escapeHtml(item.id)}','item')">${ICONS.image}</button></div>
                <div style="display:flex;gap:10px;"><button class="action-btn btn-danger" title="${this._t('reject', 'Reject')}" onclick="this.getRootNode().host.deletePending('${escapeHtml(item.id)}')" style="display:flex;align-items:center;justify-content:center;">${ICONS.delete}</button><button class="action-btn" title="${this._t('confirm', 'Confirm')}" style="background:var(--success);color:white;display:flex;align-items:center;justify-content:center;" onclick="this.getRootNode().host.confirmPending('${escapeHtml(item.id)}')">${ICONS.check}</button></div>
              </div>`;
            return card;
  }

  // [ADDED v2026.9.14] The receipt line shown on an item card.
  //
  // Answers "where did this come from and what did it cost" without opening
  // anything: invoice number, store, and the line total with its currency.
  //
  // The total is unit price x quantity, computed here rather than stored,
  // because purchase_price is deliberately the UNIT price. Storing the line
  // total as well would give two numbers that can drift apart.
  //
  // Currency is a select rather than text because it belongs to the receipt,
  // not the item: changing it updates every item on that receipt at once,
  // which is correct since one receipt is always in one currency.
  buildReceiptLineHtml(item, rec, editableCurrency) {
    if (!rec && item.purchase_price == null) return '';
    const qty = Number(item.quantity_purchased ?? item.qty ?? 1) || 1;
    const unit = item.purchase_price != null ? Number(item.purchase_price) : null;
    const total = unit != null ? Math.round(unit * qty * 100) / 100 : null;
    const cur = (rec && rec.currency) || '';

    const bits = [];
    if (rec && rec.receipt_number) bits.push(`<span>#${escapeHtml(rec.receipt_number)}</span>`);
    if (rec && rec.vendor) bits.push(`<span>${escapeHtml(rec.vendor)}</span>`);
    if (total != null) {
      const per = qty > 1
        ? ` <span style="opacity:.7;">(${escapeHtml(String(unit))} x ${escapeHtml(String(qty))})</span>`
        : '';
      bits.push(`<span><b>${escapeHtml(String(total))}</b>${per}</span>`);
    }
    if (!bits.length) return '';

    // [MODIFIED v2026.9.21] Symbol when closed, "USD $" when open.
    //
    // A native <select> shows the selected option's own text when collapsed,
    // so the list entry and the collapsed value cannot differ. The picker is
    // therefore a small button plus a list: the button shows only the symbol,
    // which is what fits in a table row, and the list spells out the code so
    // there is no guessing between the several currencies that use "$".
    //
    // The stored value stays the three-letter ISO code. The symbol is display
    // only, because "$" alone could not be summed correctly later.
    const CURRENCIES = ['ILS','USD','EUR','GBP','JPY','CHF','CAD','AUD','RUB',
                        'INR','KRW','TRY','SAR','CNY','BRL','MXN','ZAR','PLN',
                        'SEK','NOK','DKK','CZK','HUF','THB','UAH','BTC'];
    const list = CURRENCIES.includes(cur) || !cur ? CURRENCIES : [cur, ...CURRENCIES];
    const rid = rec ? String(rec.id) : '';
    const open = this.currencyPickerFor === rid && rid;

    const currencyControl = !(editableCurrency && rec)
      ? (cur ? `<span style="opacity:.8;">${escapeHtml(this.currencySymbol(cur))}</span>` : '')
      : `<span style="position:relative;display:inline-flex;">
           <button type="button" title="${escapeHtml(cur || '')}"
                   style="min-width:26px;height:22px;padding:0 4px;border-radius:6px;cursor:pointer;
                          border:1px solid var(--border-light,#444);background:transparent;
                          color:var(--text-main,#fff);font-size:12px;line-height:1;"
                   onclick="event.stopPropagation();this.getRootNode().host.toggleCurrencyPicker('${escapeHtml(this.escapeJSArg(rid))}')"
           >${escapeHtml(this.currencySymbol(cur) || '\u00A4')}</button>
           ${open ? `<span style="position:absolute;top:24px;inset-inline-start:0;z-index:30;
                        max-height:220px;overflow-y:auto;min-width:110px;
                        background:var(--card-background-color,#1c1c1c);
                        border:1px solid var(--divider-color,#333);border-radius:8px;
                        box-shadow:0 4px 14px rgba(0,0,0,.4);">
               ${list.map(c => `<span style="display:flex;justify-content:space-between;gap:10px;
                        padding:6px 10px;cursor:pointer;font-size:12px;white-space:nowrap;
                        ${c === cur ? 'color:var(--primary-color,#03a9f4);font-weight:bold;' : ''}"
                        onclick="event.stopPropagation();this.getRootNode().host.pickCurrency('${escapeHtml(this.escapeJSArg(rid))}','${escapeHtml(c)}')"
                   ><span>${escapeHtml(c)}</span><span>${escapeHtml(this.currencySymbol(c))}</span></span>`).join('')}
             </span>` : ''}
         </span>`;

    return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--text-sub);margin-top:6px;">${bits.join('<span style="opacity:.4;">|</span>')}${currencyControl}</div>`;
  }

  // Open or close the currency list for one receipt.
  //
  // Keyed by receipt id rather than a boolean, so opening a second picker
  // closes the first instead of leaving two lists on screen.
  toggleCurrencyPicker(receiptId) {
    this.currencyPickerFor = this.currencyPickerFor === receiptId ? null : receiptId;
    this.render();
  }

  pickCurrency(receiptId, code) {
    this.currencyPickerFor = null;
    this.changeReceiptCurrency(receiptId, code);
  }

  // [ADDED v2026.10.2] Correct the date printed on a whole receipt.
  //
  // A blank is not sent. async_update_receipt_date refuses anything that is
  // not YYYY-MM-DD rather than storing NULL, so a cleared input would be a
  // silent no-op - and clearing the date of a real receipt is not something
  // this screen offers.
  async setReceiptDate(receiptId, value) {
    const stamp = String(value || '').trim();
    if (!receiptId || !stamp) return;
    try {
      await this.callHA('set_receipt_date', {
        receipt_id: parseInt(receiptId, 10),
        purchase_date: stamp,
      });
      this.fetchData();
    } catch (e) { console.error(e); }
  }

  // Correct the currency of a whole receipt.
  async changeReceiptCurrency(receiptId, currency) {
    if (!receiptId || !currency) return;
    try {
      await this.callHA('set_receipt_currency', { receipt_id: parseInt(receiptId, 10), currency });
      this.fetchData();
    } catch (e) { console.error(e); }
  }

  // [ADDED v2026.10.3] The scan banner, built in ONE place.
  //
  // It used to be written inline in the review branch and nowhere else, so
  // the Receipts tab had no way to show progress, an error or the duplicate
  // notice. Extracted rather than copied: a second copy is how the two would
  // have drifted (RULE 33d).
  //
  // Appended, never assigned through innerHTML, because both callers pass a
  // container that already holds children (RULE 33a.5).
  renderScanBanner(container) {
    if (!container) return;
    if (!this.scanInProgress && !this.scanError) return;
    const bad = !!this.scanError;
    const banner = document.createElement('div');
    banner.className = 'scan-banner';
    banner.style.cssText = 'margin:0 0 12px 0;padding:10px 12px;'
      + 'border-radius:8px;font-size:13px;color:#fff;'
      + `background:${bad ? 'var(--error-color,#c62828)'
                          : 'var(--primary-color,#03a9f4)'};`;
    // textContent, not innerHTML: this text can carry a shop name read off
    // a photograph by a model (RULE 15).
    banner.textContent = bad
      ? this.scanError
      : this._t('scan_in_progress', 'Reading the receipt...');
    container.appendChild(banner);
  }

  // [ADDED v2026.9.25] The pages captured so far, with their thumbnails.
  //
  // The preview lived in the chat bar, which was deleted, so a photo taken for
  // a receipt was queued but never shown - the user was asked about a page
  // they had no way to look at. This puts the queue on screen and replaces the
  // confirm() with real choices, including the two that dialog could not
  // offer: drop a bad page, or abandon the scan.
  renderReceiptQueue(container) {
    const pages = this.receiptPages || [];
    if (!pages.length) return;

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      margin:0 0 12px 0;padding:10px;border-radius:10px;
      background:var(--card-background-color,#1c1c1c);
      border:1px solid var(--primary-color,#03a9f4);`;

    const strip = pages.map((pg, i) => {
      const isPdf = (pg.mime || '').includes('pdf');
      // The queued page is a data URL the browser just produced, not user
      // text, so it is safe as src; the alt text is escaped all the same.
      const thumb = isPdf
        ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-sub);">PDF</div>`
        : `<img src="${pg.data}" alt="${escapeHtml(this._t('receipt_page', 'Page'))} ${i + 1}" style="width:100%;height:100%;object-fit:cover;">`;
      return `
        <div style="position:relative;width:62px;height:78px;border-radius:6px;overflow:hidden;background:#000;border:1px solid var(--divider-color,#333);flex:0 0 auto;">
          ${thumb}
          <div style="position:absolute;bottom:0;inset-inline-start:0;padding:0 4px;font-size:10px;background:rgba(0,0,0,.6);color:#fff;">${i + 1}</div>
          <div title="${escapeHtml(this._t('receipt_drop_page', 'Remove this page'))}"
               onclick="this.getRootNode().host.removeReceiptPage(${i})"
               style="position:absolute;top:2px;inset-inline-end:2px;width:18px;height:18px;border-radius:50%;background:var(--error-color,#c62828);color:#fff;font-size:11px;line-height:18px;text-align:center;cursor:pointer;">&#10005;</div>
        </div>`;
    }).join('');

    wrap.innerHTML = `
      <div style="font-size:12px;color:var(--text-sub);margin-bottom:8px;">
        ${escapeHtml(this._t('receipt_pages_count', '{n} pages').replace('{n}', pages.length))}
      </div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;">${strip}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button type="button" id="rq-send" style="flex:1;min-height:40px;border-radius:20px;cursor:pointer;font-size:13px;font-weight:500;border:1px solid var(--primary-color,#03a9f4);background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);">${escapeHtml(this._t('receipt_send_pages', 'Scan these pages'))}</button>
        <button type="button" id="rq-more" style="flex:1;min-height:40px;border-radius:20px;cursor:pointer;font-size:13px;border:1px solid var(--primary-color,#03a9f4);background:transparent;color:var(--primary-color,#03a9f4);">${escapeHtml(this._t('receipt_add_page', 'Add another page'))}</button>
        <button type="button" id="rq-cancel" style="min-height:40px;padding:0 14px;border-radius:20px;cursor:pointer;font-size:13px;border:1px solid var(--error-color,#c62828);background:transparent;color:var(--error-color,#c62828);">${escapeHtml(this._t('cancel', 'Cancel'))}</button>
      </div>`;

    container.appendChild(wrap);
    wrap.querySelector('#rq-send').onclick   = () => this.sendCollectedReceipt();
    wrap.querySelector('#rq-more').onclick   = () => this.captureAnotherReceiptPage();
    wrap.querySelector('#rq-cancel').onclick = () => this.cancelReceiptCapture();
  }

  // [ADDED v2026.9.14] Floating action pills over the review list.
  //
  // Styled after Home Assistant's own "Create automation" pill: rounded ends,
  // filled primary, raised. Pinned to the bottom of the list rather than in a
  // bar, so scanning stays one thumb-reach away no matter how far the user has
  // scrolled through a long queue.
  renderScanActions(container) {
    // [FIXED v2026.9.15] Pinned to the bottom of the panel, flat, not raised.
    //
    // It was sticky inside a container that does not scroll, so it settled
    // directly under the last row instead of at the bottom of the screen. The
    // gradient and drop shadow that faked depth are gone too - Home Assistant's
    // own surfaces are flat, and the bar now reads as part of the panel rather
    // than as something floating over it.
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      margin-top:auto;flex-shrink:0;display:flex;gap:10px;
      justify-content:center;padding:12px 8px;
      background:var(--card-background-color,#1c1c1c);
      border-top:1px solid var(--divider-color,#333);`;

    const pill = (filled) => `
      display:inline-flex;align-items:center;gap:8px;
      min-height:44px;padding:0 20px;border-radius:22px;cursor:pointer;
      font-size:14px;font-weight:500;
      border:1px solid var(--primary-color,#03a9f4);
      background:${filled ? 'var(--primary-color,#03a9f4)' : 'transparent'};
      color:${filled ? 'var(--text-primary-color,#fff)' : 'var(--primary-color,#03a9f4)'};`;

    const scan = document.createElement('button');
    scan.type = 'button';
    scan.style.cssText = pill(true);
    scan.innerHTML = `${ICONS.camera}<span>${escapeHtml(this._t('scan_receipt', 'Scan receipt'))}</span>`;
    scan.onclick = () => this.startReceiptCapture();

    const upload = document.createElement('button');
    upload.type = 'button';
    upload.style.cssText = pill(false);
    upload.innerHTML = `${UPLOAD_SVG}<span>${escapeHtml(this._t('upload_receipt', 'Upload image or PDF'))}</span>`;
    upload.onclick = () => this.openFileUpload('chat');

    // Disabled while a scan is in flight, so a second tap cannot start a
    // parallel upload that would create a duplicate receipt.
    if (this.scanInProgress) {
      [scan, upload].forEach(b => { b.disabled = true; b.style.opacity = '.5'; });
    }
    wrap.appendChild(scan); wrap.appendChild(upload);
    container.appendChild(wrap);
  }

  // Send a captured document straight to the model.
  //
  // There is no send button any more, so this is called the moment a file is
  // chosen or the page queue is closed. Everything the removed chat bar used
  // to do - progress, errors, refresh - happens here instead.
  async sendReceiptScan() {
    const pages = (this.chatImagePages && this.chatImagePages.length)
      ? this.chatImagePages
      : (this.chatImage ? [this.chatImage] : null);
    // "if it is not empty": an empty pick is a no-op, not an error dialog.
    if (!pages) return;

    this.scanInProgress = true;
    this.scanError = null;
    this.render();

    const mime = this.chatMimeType || 'image/jpeg';
    try {
      const result = await this._hass.callWS({
        type: 'home_organizer/ai_chat',
        // [FIXED v2026.10.3] Empty, not a translated label.
        //
        // This field is a control signal, not display text: an empty message
        // is what tells get_invoice_prompt there is no user instruction to
        // apply, and HOAppScanView has sent "" for a receipt scan all along.
        // Sending _t('scanned_invoice') instead meant the prompt matched its
        // English check only in English, and every other language had a
        // SPECIAL USER INSTRUCTION appended telling the model to strictly
        // apply the words "scanned invoice" - after which it asked a
        // clarifying question instead of reading the receipt (RULE 20).
        message: '',
        image_data: pages,
        mime_type: mime,
        language: this.currentLang || 'en',
      });
      if (result?.error) {
        // [MODIFIED v2026.10.3] A key when the backend sent one, so the
        // message is in the user's language. The English text travels with
        // it as the fallback and is what older messages still send.
        this.scanError = result.error_key
          ? this._t(result.error_key, String(result.error))
          : String(result.error);
      } else if (result?.duplicate_receipt) {
        this.scanError = String(result.response || '');
      } else {
        // Expand the new scan and scroll to its header, so the user lands on
        // what they just scanned instead of the top of a list of older ones.
        const newId = result?.receipt_id;
        if (newId) {
          this.collapsedScans = this.collapsedScans || {};
          this.collapsedScans[String(newId)] = false;
          this.focusScanId = String(newId);
        }
        // [FIXED v2026.10.3] A scan that stored a header and no product
        // lines said nothing at all.
        //
        // This branch read receipt_id and threw the rest of the reply away.
        // The backend had already reported "added 0 items"; the user saw an
        // empty review queue, no message, and a receipt that existed only in
        // the Receipts tab - indistinguishable from the scan being ignored,
        // which is exactly how it was reported.
        if (result?.no_items) {
          this.scanError = this._t(
            result.notice_key || 'scan_no_items',
            'The receipt header was saved but no product lines could be read. '
            + 'Try a sharper photograph or add the items by hand.');
        } else if (!newId && result?.response) {
          // [FIXED v2026.10.3] A reply that is a QUESTION, not a scan.
          //
          // intent "clarify" comes back as {response: question} with no
          // receipt_id, and this branch ignored response entirely - so the
          // model asked something and the screen stayed blank. That is how a
          // poisoned Hebrew prompt looked from the outside: nothing at all.
          //
          // Shown whatever produced it: any reply that saved no receipt and
          // carries text has something to say, and a scan that saved nothing
          // must never look like one that worked (RULE 2, RULE 10). The text
          // is the model's own and already in the user's language, because
          // target_lang is in the prompt.
          this.scanError = String(result.response);
        }
      }
    } catch (e) {
      this.scanError = e?.message || String(e);
    }
    this.scanInProgress = false;
    this.chatImage = null;
    this.chatImagePages = null;
    this.chatMimeType = 'image/jpeg';
    this.fetchData();
  }

  // [ADDED v2026.9.12] Load the receipts table.
  //
  // Filtering runs in SQL on the server, not here: pulling every receipt over
  // the socket and filtering in JavaScript is fine at fifty rows and stalls at
  // a few thousand.
  async loadReceipts() {
    this.receiptsLoading = true;
    this.render();
    try {
      // [MODIFIED v2026.9.27] The dates come from the chosen period rather
      // than from two boxes, so there is one place that decides what window
      // is being shown.
      const range = this.receiptDateRange();
      const res = await this._hass.callWS({
        type: 'home_organizer/list_receipts',
        vendor:    this.receiptFilters?.vendor || null,
        date_from: range.from,
        date_to:   range.to,
      });
      this.receiptsData = res || { receipts: [], vendors: [], totals: {} };
    } catch (e) {
      console.error(e);
      this.receiptsData = { receipts: [], vendors: [], totals: {} };
    }
    this.receiptsLoading = false;
    this.render();
  }

  setReceiptFilter(key, value) {
    this.receiptFilters = this.receiptFilters || {};
    this.receiptFilters[key] = value || null;
    this.loadReceipts();
  }

  // [ADDED v2026.9.27] The period being shown. Replaces clearReceiptFilters,
  // which existed to empty the two date boxes that are gone.
  //
  // This year is the default, and it is a real filter rather than "no filter":
  // a household accumulates receipts for years and the archive opening on all
  // of them is a list nobody reads.
  receiptPeriodKey() { return this.receiptPeriod || 'this_year'; }

  // Local date parts, never toISOString(): that converts to UTC first, which
  // moves the day across midnight depending on the timezone - so "today"
  // would be yesterday for anyone east of London in the early morning.
  receiptIsoDate(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  receiptDateRange() {
    const key = this.receiptPeriodKey();
    if (key === 'custom') {
      return { from: this.receiptFilters?.date_from || null,
               to:   this.receiptFilters?.date_to   || null };
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const iso = d => this.receiptIsoDate(d);
    switch (key) {
      case 'today':
        return { from: iso(now), to: iso(now) };
      // Day 0 of the next month is the last day of this one, so February and
      // leap years need no special case.
      case 'this_month':
        return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
      // Month -1 in January is December of the year before, handled by Date.
      case 'last_month':
        return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
      case 'last_year':
        return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
      case 'this_year':
      default:
        return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
  }

  setReceiptPeriod(kind) {
    if (kind === 'custom') {
      // The dialog decides. Until it does, the period is unchanged, so the
      // bar never shows a window that is not the one on screen.
      this.openReceiptPeriodPicker();
      return;
    }
    this.receiptPeriod = kind;
    this.loadReceipts();
  }

  // The platform calendar, through two date inputs. No date library: Home
  // Assistant is often run with no internet, and every browser and phone
  // already has a calendar behind input type=date (RULE 16).
  openReceiptPeriodPicker() {
    const previous = this.receiptPeriodKey();
    const range = this.receiptDateRange();
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:#000000aa;z-index:300;'
      + 'display:flex;align-items:center;justify-content:center;padding:16px;';
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--card-background-color,#1c1c1c);'
      + 'border-radius:12px;padding:16px;width:100%;max-width:340px;'
      + 'display:flex;flex-direction:column;gap:12px;';
    card.innerHTML = `
      <div style="font-weight:bold;">${escapeHtml(this._t('receipts_period_title', 'Choose a period'))}</div>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--text-sub);">
        ${escapeHtml(this._t('receipts_filter_from', 'From'))}
        <input type="date" id="rc-cf" value="${escapeHtml(range.from || '')}" style="min-height:40px;">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--text-sub);">
        ${escapeHtml(this._t('receipts_filter_to', 'To'))}
        <input type="date" id="rc-ct" value="${escapeHtml(range.to || '')}" style="min-height:40px;">
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="action-btn" id="rc-cc" style="min-height:40px;">${escapeHtml(this._t('receipts_period_cancel', 'Cancel'))}</button>
        <button class="action-btn" id="rc-ca" style="min-height:40px;">${escapeHtml(this._t('receipts_period_apply', 'Apply'))}</button>
      </div>`;
    ov.appendChild(card);

    const dismiss = () => {
      try { ov.remove(); } catch (e) { }
      // The select in the bar is showing "choose dates"; putting the period
      // back and re-rendering returns it to what is actually displayed.
      this.receiptPeriod = previous;
      this.render();
    };
    card.querySelector('#rc-cc').onclick = dismiss;
    ov.onclick = (e) => { if (e.target === ov) dismiss(); };
    card.querySelector('#rc-ca').onclick = () => {
      const from = card.querySelector('#rc-cf').value || null;
      const to   = card.querySelector('#rc-ct').value || null;
      try { ov.remove(); } catch (e) { }
      this.receiptFilters = this.receiptFilters || {};
      this.receiptFilters.date_from = from;
      this.receiptFilters.date_to = to;
      this.receiptPeriod = 'custom';
      this.loadReceipts();
    };
    this.mountOverlay(ov);
  }

  // [ADDED v2026.9.15] Collapse store-name variants onto one group.
  //
  // A chain prints itself differently on different receipts: "רמי לוי" one
  // week, "רמי לוי שיווק השיקמה" the next; "שופרסל" and "שופרסל דיל רעננה".
  // Grouped literally those are four stores and every per-store total is wrong.
  //
  // The rule is word-prefix containment, not a fixed number of words: one
  // cleaned name must begin with the whole of the other, on a word boundary.
  // A fixed two-word key was tried first and failed on single-word chains -
  // "שופרסל" against "שופרסל דיל" are different two-word keys.
  //
  // Prefix containment is predictable and needs no tuning. It will not merge
  // two shops that merely share a letter, and requiring a word boundary stops
  // "Super" from swallowing "Supermarket".
  normaliseVendor(name) {
    const raw = String(name || '').trim().toLowerCase();
    if (!raw) return '';
    return raw
      .replace(/[.,'"()\-]/g, ' ')
      // Suffixes that appear on some printouts and not others.
      .replace(/\s(בע"מ|בעמ|בע״מ|שיווק|סניף|ltd|inc|llc)\s/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  groupReceiptsByVendor(receipts) {
    const groups = [];
    (receipts || []).forEach(r => {
      const key = this.normaliseVendor(r.vendor);
      let group = key
        ? groups.find(g => g.key && (g.key === key
            || g.key.startsWith(key + ' ')
            || key.startsWith(g.key + ' ')))
        // Receipts with no readable store name share one bucket rather than
        // becoming a separate group each.
        : groups.find(g => g.key === '__none__');
      if (!group) {
        group = { key: key || '__none__', label: r.vendor || '', rows: [], totals: {} };
        groups.push(group);
      }
      // The shorter name becomes the key so a third, longer variant still
      // matches; the longest becomes the label so it reads as the full brand.
      if (key && key.length < group.key.length) group.key = key;
      if ((r.vendor || '').length > group.label.length) group.label = r.vendor || '';
      group.rows.push(r);
      if (r.total_amount != null && (r.status || 'draft') === 'active') {
        const cur = r.currency || '?';
        group.totals[cur] = Math.round(((group.totals[cur] || 0) + r.total_amount) * 100) / 100;
      }
    });
    return groups;
  }

  renderReceiptsTable(container) {
    container.style.padding = '0 15px 15px 15px';
    container.style.overflowY = 'auto';
    // [FIXED v2026.9.22] block, because the caller made this a flex COLUMN.
    //
    // Every child of a column flex container is a flex ITEM, and a flex item
    // shrinks when the column overflows - which this one always does, since
    // it is the scrolling list. So each store header and each receipt row
    // was being squeezed below the height its own text needed, and the text
    // was cut off inside it.
    //
    // It only showed on a phone: that is the width where a chain name wraps
    // onto a second line, so the header needs about 45px, gets squeezed back
    // to the 35px min-height .group-separator sets, and loses the bottom of
    // both lines. On a wider screen the name fits on one line, the natural
    // height is under 35px, and there was nothing to squeeze.
    //
    // Nothing here wants to be a flex item - this is a list of blocks that
    // scrolls. The column belongs to the review tab, which uses margin-top
    // auto to push its bar to the bottom.
    container.style.display = 'block';
    const data = this.receiptsData || { receipts: [], vendors: [], totals: {} };
    const f = this.receiptFilters || {};

    // --- filters ---
    //
    // [MODIFIED v2026.9.27] Two dropdowns, where there were a dropdown, two
    // date boxes and a Clear button.
    //
    // Four controls did not fit a phone: they wrapped onto three lines, the two
    // date boxes were the wrong shape for the question being asked - nobody
    // thinks "from the 1st to the 31st", they think "last month" - and Clear
    // left the archive showing every receipt ever stored.
    //
    // The dates are still there, behind Choose dates, for the one case a
    // preset cannot express.
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;';
    const vendorOptions = ['<option value="">' + escapeHtml(this._t('receipts_filter_vendor', 'Store')) + '</option>']
      .concat((data.vendors || []).map(v =>
        `<option value="${escapeHtml(v)}" ${f.vendor === v ? 'selected' : ''}>${escapeHtml(v)}</option>`))
      .join('');
    const periodKey = this.receiptPeriodKey();
    const periodOptions = [
      ['this_year',  this._t('receipts_period_this_year',  'This year')],
      ['last_year',  this._t('receipts_period_last_year',  'Last year')],
      ['this_month', this._t('receipts_period_this_month', 'This month')],
      ['last_month', this._t('receipts_period_last_month', 'Last month')],
      ['today',      this._t('receipts_period_today',      'Today')],
      ['custom',     this._t('receipts_period_custom',     'Choose dates')],
    ].map(([k, label]) =>
      `<option value="${escapeHtml(k)}" ${periodKey === k ? 'selected' : ''}>${escapeHtml(label)}</option>`
    ).join('');
    // flex-basis 140px with wrap: side by side on anything from a tablet up,
    // one per line on a narrow phone, and never squeezed to unreadable. 40px
    // minimum because these are touched, not clicked.
    bar.innerHTML = `
      <select id="rc-vendor" class="stylist-filter-select" style="flex:1 1 140px;min-width:120px;min-height:40px;">${vendorOptions}</select>
      <select id="rc-period" class="stylist-filter-select" style="flex:1 1 140px;min-width:120px;min-height:40px;" title="${escapeHtml(this._t('receipts_period', 'Period'))}">${periodOptions}</select>`;
    container.appendChild(bar);
    bar.querySelector('#rc-vendor').onchange = e => this.setReceiptFilter('vendor', e.target.value);
    bar.querySelector('#rc-period').onchange = e => this.setReceiptPeriod(e.target.value);

    // The window in figures, under the bar. A preset name alone does not say
    // which dates it resolved to, and the totals below are only true of those.
    const shown = this.receiptDateRange();
    if (shown.from || shown.to) {
      const cap = document.createElement('div');
      cap.style.cssText = 'font-size:11px;color:var(--text-sub);margin-bottom:10px;direction:ltr;text-align:start;';
      cap.textContent = `${shown.from || ''} \u2013 ${shown.to || ''}`;
      container.appendChild(cap);
    }

    // --- totals, one line per currency ---
    // Never summed together: adding shekels to dollars gives a meaningless
    // number, so each currency gets its own figure.
    const totals = data.totals || {};
    if (Object.keys(totals).length) {
      const t = document.createElement('div');
      t.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;font-size:13px;';
      t.innerHTML = Object.entries(totals).map(([cur, amt]) =>
        `<span><b>${escapeHtml(String(amt))}</b> <span style="color:var(--text-sub);" title="${escapeHtml(cur)}">${escapeHtml(this.currencySymbol(cur))}</span></span>`
      ).join('');
      container.appendChild(t);
    }

    if (this.receiptsLoading) {
      const l = document.createElement('div');
      l.style.cssText = 'text-align:center;padding:20px;color:var(--text-sub);';
      l.textContent = this._t('loading', 'Loading...');
      container.appendChild(l);
      return;
    }

    if (!data.receipts || !data.receipts.length) {
      const e = document.createElement('div');
      e.style.cssText = 'text-align:center;padding:30px;color:var(--text-sub);';
      e.textContent = this._t('receipts_none', 'No receipts match these filters.');
      container.appendChild(e);
      return;
    }

    // --- rows, grouped by store ---
    // Cards rather than a real <table>: this panel is used on phones, and a
    // table with five columns forces horizontal scrolling on a narrow screen.
    this.collapsedVendors = this.collapsedVendors || {};
    this.groupReceiptsByVendor(data.receipts).forEach(group => {
      const gkey = group.key;
      if (this.collapsedVendors[gkey] === undefined) this.collapsedVendors[gkey] = false;
      const gCollapsed = this.collapsedVendors[gkey];

      const gHeader = document.createElement('div');
      gHeader.className = 'group-separator';
      gHeader.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:8px;margin-top:8px;';
      const totalsHtml = Object.entries(group.totals)
        .map(([cur, amt]) => `${escapeHtml(String(amt))} ${escapeHtml(this.currencySymbol(cur))}`)
        .join(' · ');
      gHeader.innerHTML = `
        <span style="font-size:14px;flex:0 0 auto;">${gCollapsed ? '&#9656;' : '&#9662;'}</span>
        <!-- min-width:0, or this refuses to shrink below its longest word and
             pushes the count off the end of the row. line-height, because a
             chain name that wraps to two lines on a phone is two lines that
             have to be read, not a squeeze. -->
        <span style="flex:1 1 auto;min-width:0;font-weight:bold;line-height:1.35;">${escapeHtml(group.label || this._t('receipt_no_vendor', 'Unnamed receipt'))}</span>
        <span style="font-size:11px;color:var(--text-sub);white-space:nowrap;flex:0 0 auto;">${escapeHtml(String(group.rows.length))}${totalsHtml ? ' · ' + totalsHtml : ''}</span>`;
      gHeader.onclick = () => {
        this.collapsedVendors[gkey] = !this.collapsedVendors[gkey];
        this.render();
      };
      container.appendChild(gHeader);
      if (gCollapsed) return;

      group.rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.id = `receipt-row-${r.id}`;
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--divider-color,#333);cursor:pointer;';
      const isDraft = (r.status || 'draft') === 'draft';
      const draftTag = isDraft
        ? `<span style="font-size:10px;color:var(--warning-color,#FFA726);border:1px solid var(--warning-color,#FFA726);border-radius:3px;padding:0 4px;margin-inline-start:6px;">${escapeHtml(this._t('receipt_unreviewed', 'unreviewed'))}</span>`
        : '';
      row.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-weight:bold;">${escapeHtml(r.vendor || this._t('receipt_no_vendor', 'Unnamed receipt'))}${draftTag}</div>
          <div style="font-size:11px;color:var(--text-sub);">
            ${escapeHtml(r.purchase_date || '')}${r.receipt_number ? ' | #' + escapeHtml(r.receipt_number) : ''}
          </div>
        </div>
        <div style="text-align:end;white-space:nowrap;">
          <div style="font-weight:bold;">${r.total_amount != null ? escapeHtml(String(r.total_amount)) : '-'} <span style="font-size:11px;color:var(--text-sub);" title="${escapeHtml(r.currency || '')}">${escapeHtml(this.currencySymbol(r.currency))}</span></div>
          <div style="font-size:11px;color:var(--text-sub);">${escapeHtml(String(r.linked_items ?? 0))} ${escapeHtml(this._t('receipts_items_col', 'Items'))}</div>
        </div>`;
      // [ADDED v2026.9.16] Delete this receipt for good.
      //
      // stopPropagation so it never opens the viewer by accident, and it sits
      // after the totals so a thumb reaching for the row does not find it
      // first.
      // A separate control for the document, since the row now expands instead.
      const view = document.createElement('button');
      view.className = 'action-btn';
      view.type = 'button';
      view.title = this._t('receipt_view', 'View receipt');
      view.innerHTML = ICONS.image;
      view.onclick = (e) => { e.stopPropagation(); this.openReceipt(r.id); };
      row.appendChild(view);

      const del = document.createElement('button');
      del.className = 'action-btn btn-danger';
      del.type = 'button';
      del.title = this._t('receipt_delete', 'Delete receipt');
      del.innerHTML = ICONS.delete;
      del.onclick = (e) => { e.stopPropagation(); this.confirmDeleteReceipt(r); };
      row.appendChild(del);

      // [MODIFIED v2026.9.21] The row expands its items; the thumbnail
      // opens the document. Two different questions, two targets.
      row.onclick = () => this.toggleReceiptItems(r.id);
      container.appendChild(row);

      // The item table, when this receipt is the expanded one.
      if (String(this.expandedReceiptId) === String(r.id)) {
        const panel = document.createElement('div');
        panel.style.cssText = 'padding:6px 6px 14px 6px;border-bottom:1px solid var(--divider-color,#333);';
        const items = this.receiptItems?.[String(r.id)];
        if (!items) {
          panel.textContent = this._t('loading', 'Loading...');
          panel.style.cssText += 'color:var(--text-sub);font-size:12px;';
        } else if (!items.length) {
          panel.textContent = this._t('receipt_no_items', 'No items are linked to this receipt.');
          panel.style.cssText += 'color:var(--text-sub);font-size:12px;';
        } else {
          const sym = this.currencySymbol(r.currency) || '';
          // A real table here, not cards: four short numeric-ish columns line
          // up for scanning, and this list is read rather than tapped.
          panel.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="color:var(--text-sub);text-align:start;">
                  <th style="text-align:start;padding:4px 6px;font-weight:normal;">${escapeHtml(this._t('barcode', 'Barcode'))}</th>
                  <th style="text-align:start;padding:4px 6px;font-weight:normal;">${escapeHtml(this._t('name', 'Name'))}</th>
                  <th style="text-align:end;padding:4px 6px;font-weight:normal;">${escapeHtml(this._t('qty', 'Qty'))}</th>
                  <th style="text-align:end;padding:4px 6px;font-weight:normal;">${escapeHtml(this._t('price_paid', 'Paid'))}</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(it => `
                  <tr style="border-top:1px solid var(--divider-color,#2a2a2a);${it.pending ? 'opacity:.6;' : ''}">
                    <td style="padding:4px 6px;direction:ltr;opacity:.75;">${it.barcode && it.barcode !== '0' ? escapeHtml(it.barcode) : ''}</td>
                    <td style="padding:4px 6px;">${escapeHtml(it.name || '')}${it.pending ? ` <span style="font-size:10px;color:var(--warning-color,#FFA726);">${escapeHtml(this._t('receipt_unreviewed', 'unreviewed'))}</span>` : ''}</td>
                    <td style="padding:4px 6px;text-align:end;">${escapeHtml(String(it.quantity_purchased ?? it.quantity ?? ''))}</td>
                    <td style="padding:4px 6px;text-align:end;white-space:nowrap;">${it.line_total != null ? escapeHtml(String(it.line_total)) + ' ' + escapeHtml(sym) : '-'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>`;
        }
        container.appendChild(panel);
      }
      });
    });
  }

  // [ADDED v2026.9.16] Two-step confirmation before erasing a receipt.
  //
  // 1234 is a double confirmation, not a password. It is not secret, is the
  // same for everyone, and grants nothing - it exists so a mis-tap on a phone
  // cannot destroy a receipt and its price history. The message says so, so a
  // user never mistakes it for protection the data does not have.
  //
  // The backend checks it again, because a guard that lives only in the UI is
  // not a guard.
  //
  // The prompt states exactly what disappears. "Are you sure?" without saying
  // what is at stake trains people to click yes.
  async confirmDeleteReceipt(receipt) {
    if (!receipt || !receipt.id) return;
    const label = [receipt.vendor, receipt.purchase_date,
                   receipt.total_amount != null ? `${receipt.total_amount} ${receipt.currency || ''}`.trim() : null]
      .filter(Boolean).join(' | ');
    const warn = this._t('receipt_delete_warning',
      'Delete this receipt permanently?\n\n{r}\n\nIts images and its price history will be removed. Items stay in your inventory.\n\nThis is a double confirmation, not a password: type 1234 so an accidental tap cannot delete a receipt.')
      .replace('{r}', label);
    const answer = window.prompt(warn, '');
    // Cancel returns null; an empty or wrong code is simply not a confirmation.
    if (answer === null) return;
    if (String(answer).trim() !== '1234') {
      alert(this._t('receipt_delete_bad_code', 'The confirmation code did not match. Nothing was deleted.'));
      return;
    }
    try {
      await this.callHA('delete_receipt', {
        receipt_id: parseInt(receipt.id, 10),
        confirm_code: String(answer).trim(),
      });
      if (this.receiptViewer && this.receiptViewer.id === receipt.id) this.receiptViewer = null;
      this.loadReceipts();
    } catch (e) { console.error(e); }
  }

  // [ADDED v2026.9.27] Jump from an item straight to its receipt.
  //
  // Switches to the Receipts tab, clears any filter that would hide the target
  // - a vendor or date filter left over from an earlier search would otherwise
  // make the receipt simply not be there - then expands it and scrolls to it.
  async jumpToReceipt(receiptId) {
    if (!receiptId) return;
    const key = String(receiptId);
    this.isReceiptsMode = true;
    this.isReviewMode = false;
    this.isChatMode = false;
    this.isShopMode = false;
    this.isSearch = false;
    this.isEditMode = false;
    this.isStylistMode = false;
    this.receiptFilters = {};
    this.focusReceiptId = key;
    // Coming from an item card means the data may have changed since this
    // receipt was last looked at, so drop any cached copy of its items.
    if (this.receiptItems) delete this.receiptItems[key];
    await this.loadReceipts();
    // After the list has rendered, open that receipt's item table and bring it
    // into view.
    await this.toggleReceiptItems(receiptId);
    setTimeout(() => {
      const el = this.shadowRoot?.getElementById(`receipt-row-${key}`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  // [ADDED v2026.9.21] Expand a receipt to show what was bought on it.
  //
  // Fetched on first open and then kept, so collapsing and reopening does not
  // hit the socket again. The cache is keyed by receipt id, so opening a
  // second receipt does not discard the first.
  async toggleReceiptItems(receiptId) {
    const key = String(receiptId);
    if (String(this.expandedReceiptId) === key) {
      this.expandedReceiptId = null;
      this.render();
      return;
    }
    this.expandedReceiptId = key;
    this.render();
    // [FIXED v2026.10.1] An empty array is truthy in JavaScript.
    //
    // The old check treated a cached [] as "already loaded", so a receipt
    // fetched once before its items were linked stayed empty forever. That is
    // exactly what happened when arriving from an item card: the list had been
    // touched earlier, cached nothing, and then reported "no items" while the
    // same receipt opened from the Receipts tab showed them.
    //
    // Only a non-empty cache short-circuits; an empty one is re-checked, which
    // costs one query on a genuinely empty receipt and fixes the common case.
    if (Array.isArray(this.receiptItems?.[key]) && this.receiptItems[key].length) return;
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/list_receipts', receipt_id: receiptId
      });
      this.receiptItems = this.receiptItems || {};
      this.receiptItems[key] = (res && res.items) || [];
      // The pages arrive in the same response, so the viewer can open later
      // without a second round trip.
      this.receiptPagesCache = this.receiptPagesCache || {};
      this.receiptPagesCache[key] = (res && res.pages) || [];
    } catch (e) {
      console.error(e);
      this.receiptItems = this.receiptItems || {};
      this.receiptItems[key] = [];
    }
    this.render();
  }

  // Open one receipt and show every archived page of it.
  async openReceipt(receiptId) {
    if (!receiptId) return;
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/list_receipts', receipt_id: receiptId
      });
      const pages = (res && res.pages) || [];
      if (!pages.length) {
        alert(this._t('receipt_no_file', 'No image was stored for this receipt.'));
        return;
      }
      this.receiptViewer = { id: receiptId, pages, index: 0 };
      this.render();
    } catch (e) { console.error(e); }
  }

  // [ADDED v2026.9.13] Receipt viewer overlay.
  //
  // PDFs render in an <iframe> using the browser's own built-in viewer. That
  // is a deliberate choice over pdf.js: Home Assistant is often run with no
  // internet access, so a CDN is out, and vendoring pdf.js means shipping
  // roughly a megabyte to every user for something every current browser
  // already does natively.
  //
  // The trade-off is honest: a page whose file lives outside config/www has no
  // URL at all, and the overlay says so instead of showing a broken frame.
  // [ADDED v2026.10.2] Can this browser draw a PDF inline?
  //
  // Android's WebView has no built-in PDF viewer, so an <iframe> pointed at a
  // PDF renders a blank page and hands the file to the download manager. The
  // Home Assistant companion app on Android is a WebView, which is why the
  // receipt opens correctly in a desktop browser and comes out blank in the
  // app.
  //
  // This is not related to HTTPS. /local/ is same-origin and served over plain
  // HTTP without trouble; the file arrives fine, the WebView simply cannot
  // display that type.
  //
  // Detected rather than assumed-broken everywhere: iOS WKWebView and every
  // desktop browser do render PDFs inline, and they should keep doing so.
  canRenderPdfInline() {
    const ua = String(navigator.userAgent || '');
    const isAndroid = /Android/i.test(ua);
    // "; wv)" is the Android WebView marker; the companion app also identifies
    // itself by name.
    const isWebView = /;\s*wv\)/i.test(ua) || /Home\s?Assistant/i.test(ua);
    return !(isAndroid && isWebView);
  }

  renderReceiptViewer() {
    const v = this.receiptViewer;
    if (!v || !v.pages || !v.pages.length) return;
    const page = v.pages[v.index] || v.pages[0];
    const isPdf = (page.mime_type || '').includes('pdf')
      || (page.url || '').toLowerCase().endsWith('.pdf');

    const overlay = document.createElement('div');
    overlay.id = 'receipt-viewer';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
      background:rgba(0,0,0,.92);`;

    const bar = document.createElement('div');
    bar.style.cssText = `
      display:flex;align-items:center;gap:12px;padding:12px 16px;flex-shrink:0;
      color:#fff;background:rgba(0,0,0,.4);`;
    bar.innerHTML = `
      <span style="flex:1;font-size:14px;">
        ${escapeHtml(this._t('receipt_page', 'Page'))} ${v.index + 1} / ${v.pages.length}
      </span>`;

    // labelHtml is always a literal HTML entity defined below (&#8249; etc),
    // never user or model data. The name records that so the next reader does
    // not have to trace the call sites to find out.
    const mkBtn = (labelHtml, title) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = title;
      b.style.cssText = `
        min-width:44px;min-height:44px;border-radius:10px;cursor:pointer;
        border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;
        font-size:18px;line-height:1;`;
      b.innerHTML = labelHtml;
      return b;
    };

    // Only shown when there is more than one page: dead controls teach people
    // to ignore controls.
    if (v.pages.length > 1) {
      const prev = mkBtn('&#8249;', this._t('previous', 'Previous'));
      const next = mkBtn('&#8250;', this._t('next', 'Next'));
      prev.disabled = v.index === 0;
      next.disabled = v.index === v.pages.length - 1;
      [prev, next].forEach(b => { if (b.disabled) b.style.opacity = '.35'; });
      prev.onclick = () => { if (v.index > 0) { v.index--; this.render(); } };
      next.onclick = () => { if (v.index < v.pages.length - 1) { v.index++; this.render(); } };
      bar.appendChild(prev); bar.appendChild(next);
    }

    const close = mkBtn('&#10005;', this._t('close', 'Close'));
    close.onclick = () => { this.receiptViewer = null; this.render(); };
    bar.appendChild(close);
    overlay.appendChild(bar);

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:12px;';

    if (!page.url) {
      // The file exists on disk but sits outside the one directory Home
      // Assistant serves, so no browser can reach it. Say that plainly rather
      // than rendering a broken image.
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#fff;text-align:center;max-width:420px;line-height:1.6;';
      msg.textContent = this._t('receipt_not_servable',
        'This receipt is stored outside the www folder, so it cannot be displayed in the browser.');
      body.appendChild(msg);
    } else if (isPdf && !this.canRenderPdfInline()) {
      // Rather than a blank frame and a surprise download, say what is going
      // on and give the one control that works here.
      const card = document.createElement('div');
      card.style.cssText = 'color:#fff;text-align:center;max-width:420px;line-height:1.6;';
      card.innerHTML = `
        <div style="font-size:44px;margin-bottom:10px;">&#128196;</div>
        <div style="margin-bottom:14px;">
          ${escapeHtml(this._t('pdf_not_inline',
            'This app cannot display PDF files inside the panel. Open it to view the receipt.'))}
        </div>`;
      const open = document.createElement('a');
      open.href = page.url;
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = this._t('pdf_open', 'Open receipt');
      open.style.cssText = `
        display:inline-flex;align-items:center;justify-content:center;
        min-height:44px;padding:0 22px;border-radius:22px;text-decoration:none;
        background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);
        font-size:14px;font-weight:500;`;
      card.appendChild(open);
      body.appendChild(card);
    } else if (isPdf) {
      const frame = document.createElement('iframe');
      frame.src = page.url;
      frame.style.cssText = 'width:100%;height:100%;border:0;background:#fff;border-radius:8px;';
      body.appendChild(frame);
    } else {
      const img = document.createElement('img');
      img.src = page.url;
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;';
      // A file deleted from disk by hand is a case that will happen.
      img.onerror = () => {
        body.innerHTML = '';
        const msg = document.createElement('div');
        msg.style.cssText = 'color:#fff;text-align:center;';
        msg.textContent = this._t('receipt_file_missing',
          'The image file for this page is no longer on disk.');
        body.appendChild(msg);
      };
      body.appendChild(img);
    }

    overlay.appendChild(body);

    // Escape closes, arrows page. Bound on the overlay and focused so the
    // listener dies with the element instead of leaking onto document.
    overlay.tabIndex = -1;
    overlay.onkeydown = (e) => {
      if (e.key === 'Escape') { this.receiptViewer = null; this.render(); }
      if (e.key === 'ArrowRight' && v.index < v.pages.length - 1) { v.index++; this.render(); }
      if (e.key === 'ArrowLeft'  && v.index > 0) { v.index--; this.render(); }
    };
    setTimeout(() => overlay.focus(), 0);
    return overlay;
  }

};