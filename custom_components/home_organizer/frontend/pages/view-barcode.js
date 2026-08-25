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
// [ADDED v10.0.4] Barcode View

import { ICONS } from '../organizer-icon.js?v=10.0.4';

export const BarcodeMixin = (Base) => class extends Base {
  renderBarcodeView(content) {
    content.innerHTML = `
      <div style="text-align:center;padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
        <div style="font-size:80px;margin-bottom:20px;color:var(--primary);">${ICONS.barcode}</div>
        <h2 style="color:var(--primary);margin-bottom:15px;">${this._t('barcode_scanner', 'Barcode Scanner')}</h2>
        <p style="color:var(--text-sub);line-height:1.5;margin-bottom:40px;max-width:300px;margin-left:auto;margin-right:auto;">
          Scan grocery products and items to instantly identify and add them to your inventory or shopping list.
        </p>
        <button class="action-btn" style="width:220px;height:55px;background:var(--primary);color:white;font-size:16px;border-radius:28px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 15px rgba(3,169,244,0.4);" onclick="this.getRootNode().host.handleBarcodeScan()">
          ${ICONS.camera} Start Scanning
        </button>
      </div>`;
  }
};