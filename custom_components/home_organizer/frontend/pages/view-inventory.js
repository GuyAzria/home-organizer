// pages/view-inventory.js
// [MODIFIED v10.0.24 | 2026-06-22] Purpose: Version bump to match restored CSS grid layout explicitly protecting the square shape and 15px gap.
// [MODIFIED v10.0.22 | 2026-06-22] Purpose: Moved the qtyControlsHtml inside the xl-info container so it sits precisely 1mm above the product name, structurally detached from the image area.
// [MODIFIED v10.0.20 | 2026-06-22] Purpose: Fixed grid quantity controls not rendering. Injected the plus/minus HTML natively inside buildGridSection, matching the RTL logic from createItemRow, and adding explicit stopPropagation so the card doesn't expand when adjusting quantity.
// [MODIFIED v10.0.18 | 2026-05-03] Purpose: Replaced explicit save buttons (name edit & hierarchy edit) with a standard action-btn style and a floppy disk icon for better UI consistency.
// [MODIFIED v10.0.17 | 2026-05-03] Purpose: Added an explicit 'Save' button (check icon) right next to the item name input. This provides a bulletproof way to save name edits directly from mobile devices where soft-keyboard 'blur'/'next' events are unreliable.
// [MODIFIED v10.0.16 | 2026-04-20] Purpose: unit_value input now calls the dedicated updateUnitValue (not updateItemCategory) so typing a unit value works on the Shopping List and on legacy items. Added onblur as a safety trigger alongside onchange.
// [MODIFIED v10.0.15 | 2026-04-20] Purpose: Fixed item edit card showing empty category/sub-category dropdowns when the stored value is not in the current ITEM_CATEGORIES tree (happens after the v10.4.0 category refactor for pre-existing items). Dropdowns now preserve legacy values as fallback selected options, and currentUnit falls back to item.unit so the unit badge shows the stored DB value when the tree lookup fails.
// [MODIFIED v10.0.14 | 2026-04-20] Purpose: Shopping List qty controls now read from and persist to the DB order_qty field. Plus/minus buttons call updateOrderQty (saves to DB), display reads item.order_qty, so values survive refresh. submitShopStock now reads the persisted qty from the item row.
// [MODIFIED v10.0.13 | 2026-04-17] Purpose: Refined mobile grid layout for expanded item edit. Moved units under the item name. Placed categories on a new full-width row under the date. Tweaked hierarchy padding and font-size to ensure it fits perfectly on one single line on small mobile screens without wrapping.

import { ICONS } from '../organizer-icon.js?v=10.0.13';
import { ITEM_CATEGORIES } from '../organizer-data.js?v=10.0.13';

const UPLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>';
const miniBarcodeSvg = '<svg style="width:12px;height:12px" viewBox="0 0 24 24"><path fill="currentColor" d="M3,6H5V18H3V6M7,6H8V18H7V6M9,6H12V18H9V6M13,6H14V18H13V6M16,6H18V18H16V6M19,6H21V18H19V6Z"/></svg>';
const FLOPPY_SVG = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z" /></svg>';

export const InventoryMixin = (Base) => class extends Base {

  enableSubLocationInput(el) {
      const label = el.querySelector('.folder-label');
      const originalText = label.innerText;
      label.innerHTML = `<input type="text" class="folder-input" style="width:90%;padding:4px;background:var(--bg-input-edit);color:var(--text-main);border:1px solid var(--primary);border-radius:4px;text-align:center;">`;
      const input = label.querySelector('input');
      input.focus();

      let isFinished = false;
      const finish = async (save) => {
          if (isFinished) return;
          isFinished = true;
          const val = input.value.trim();
          if (save && val && val !== originalText) {
              label.innerText = '...';
              try {
                  if (typeof this.addFolder === 'function') {
                      await this.addFolder(val);
                  } else {
                      await this.callHA('add_item', {
                          item_name: `[Folder] ${val}`,
                          item_type: 'folder_marker',
                          current_path: [...this.currentPath, val],
                          category: '',
                          sub_category: ''
                      });
                      this.fetchData();
                  }
              } catch (e) {
                  console.error(e);
                  label.innerText = originalText;
              }
          } else {
              label.innerText = originalText;
          }
      };

      input.onblur = () => finish(true);
      input.onkeydown = (e) => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); } 
          else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      };
  }

  renderRoomsView(content, attrs) {
    const zoneContainer = document.createElement('div');
    zoneContainer.className = 'item-list';
    const groupedRooms = {};
    const knownZones   = new Set();
    const zonesList    = [];
    const markerRegex  = /^ZONE_MARKER_(\d+)_+(.*)$/;
    const zoneRegex    = /^\[(.*?)\] (.*)$/;

    if (attrs.folders) {
      attrs.folders.forEach(f => {
        if (f.name.startsWith("ZONE_MARKER_")) {
          const m = f.name.match(markerRegex);
          const zOrder = m ? parseInt(m[1]) : 9999;
          const zName  = m ? m[2] : f.name.replace("ZONE_MARKER_","").trim();
          if (zName) { knownZones.add(zName); zonesList.push({ name:zName, order:zOrder, markerName:f.name }); }
          return;
        }
        let zone = "General Rooms", displayName = f.name;
        const m = f.name.match(zoneRegex);
        if (m) { zone = m[1]; displayName = m[2]; }
        else if (f.zone) zone = f.zone;
        if (!groupedRooms[zone]) groupedRooms[zone] = [];
        groupedRooms[zone].push({ originalName: f.name, displayName, img: f.img });
      });
    }

    knownZones.forEach(z => { if (!groupedRooms[z]) groupedRooms[z] = []; });
    if (!groupedRooms["General Rooms"]) groupedRooms["General Rooms"] = [];
    if (!zonesList.find(z => z.name==="General Rooms") && groupedRooms["General Rooms"].length > 0)
      zonesList.push({ name:"General Rooms", order:-1, markerName:null });
    Object.keys(groupedRooms).forEach(z => { if (!zonesList.find(i => i.name===z)) zonesList.push({ name:z, order:9999, markerName:null }); });
    zonesList.sort((a,b) => a.order - b.order);

    zonesList.forEach(zoneObj => {
      const zoneName = zoneObj.name;
      const rooms    = groupedRooms[zoneName] || [];
      if (zoneName === "General Rooms" && rooms.length === 0 && !this.isEditMode) return;

      const header = document.createElement('div');
      header.className = 'group-separator';
      let translatedZone = this._t('zone_' + zoneName.replace(/ /g,'_'), zoneName);

      if (this.isEditMode && zoneName !== "General Rooms") {
        header.innerHTML = `
          <div style="display:flex;align-items:center;"><span class="subloc-title">${translatedZone}</span></div>
          <div style="display:flex;gap:5px;align-items:center">
            <button class="arrow-btn" onclick="event.stopPropagation();this.getRootNode().host.moveZone('${this.escapeJSArg(zoneName)}',-1)">${ICONS.arrow_up}</button>
            <button class="arrow-btn" onclick="event.stopPropagation();this.getRootNode().host.moveZone('${this.escapeJSArg(zoneName)}',1)" style="transform:rotate(180deg)">${ICONS.arrow_up}</button>
            <div style="width:1px;height:15px;background:#444;margin:0 5px"></div>
            <button class="edit-subloc-btn"   onclick="event.stopPropagation();this.getRootNode().host.enableZoneRename(this,'${this.escapeJSArg(zoneName)}')">${ICONS.edit}</button>
            <button class="delete-subloc-btn" onclick="event.stopPropagation();this.getRootNode().host.deleteZone('${this.escapeJSArg(zoneName)}')">${ICONS.delete}</button>
          </div>`;
      } else {
        header.innerHTML = `<span>${translatedZone}</span>`;
      }
      if (typeof this.setupZoneDropTarget === 'function') this.setupZoneDropTarget(header, zoneName);
      zoneContainer.appendChild(header);

      const grid = document.createElement('div'); grid.className = 'folder-grid';
      rooms.forEach(folder => {
        const rawID    = this.getPersistentID('root', folder.originalName);
        const catalogID = this.toAlphaId(rawID);
        const el = document.createElement('div'); el.className = 'folder-item';
        if (typeof this.setupRoomDragSource === 'function') this.setupRoomDragSource(el, folder.originalName);
        el.onclick = () => { if (!this.isEditMode) this.navigate('down', folder.originalName, catalogID); };

        let folderContent = ICONS.folder;
        if (folder.img) {
          if (folder.img.startsWith('ICON_LIB')) folderContent = this.getIconByKey(folder.img);
          else {
            let cleanPath = folder.img.split('?')[0]; 
            const ver = this.imageVersions[folder.originalName] || 'ok';
            const src = `${cleanPath}?v=${ver}`;
            const loader = this.loadingSet.has(folder.originalName) ? `<div class="loader-container"><span class="loader"></span></div>` : '';
            folderContent = `<div style="position:relative;width:100%;height:100%"><img src="${src}" style="width:100%;height:100%;object-fit:contain;border-radius:4px">${loader}</div>`;
          }
        }
        const deleteBtnHtml = this.isEditMode ? `<div class="folder-delete-btn" onclick="event.stopPropagation();this.getRootNode().host.deleteFolder('${this.escapeJSArg(folder.originalName)}')">✕</div>` : '';
        const editBtnHtml   = this.isEditMode ? `<div class="folder-edit-btn"   onclick="event.stopPropagation();this.getRootNode().host.enableFolderRename(this.closest('.folder-item').querySelector('.folder-label'),'${this.escapeJSArg(folder.originalName)}')">${ICONS.edit}</div>` : '';
        const imgBtnHtml    = this.isEditMode ? `<div class="folder-img-btn"    onclick="event.stopPropagation();this.getRootNode().host.openIconPicker('${this.escapeJSArg(folder.originalName)}','room')">${ICONS.image}</div>` : '';
        el.innerHTML = `<div class="android-folder-icon">${folderContent}<div class="catalog-badge">${catalogID}</div>${editBtnHtml}${deleteBtnHtml}${imgBtnHtml}</div><div class="folder-label">${folder.displayName}</div>`;
        grid.appendChild(el);
      });

      if (this.isEditMode) {
        const addBtn = document.createElement('div');
        addBtn.className = 'folder-item add-folder-card';
        addBtn.innerHTML = `<div class="android-folder-icon">${ICONS.plus}</div><div class="folder-label">${this._t('add_room', 'Add Room')}</div>`;
        addBtn.onclick = e => { if(typeof this.enableZoneRoomInput === 'function') this.enableZoneRoomInput(e.currentTarget, zoneName); };
        grid.appendChild(addBtn);
      }
      zoneContainer.appendChild(grid);
    });

    if (this.isEditMode) {
      const addZoneBtn = document.createElement('button');
      addZoneBtn.className = 'add-item-btn'; addZoneBtn.style.marginTop = '20px';
      addZoneBtn.innerHTML = this._t('add_zone_btn', 'Add Zone');
      addZoneBtn.onclick = () => { if(typeof this.createNewZone === 'function') this.createNewZone(); };
      zoneContainer.appendChild(addZoneBtn);
    }
    content.appendChild(zoneContainer);
  }

  renderLocationsView(content, attrs) {
    if (attrs.folders?.length > 0 || this.isEditMode) {
      const grid = document.createElement('div'); grid.className = 'folder-grid';
      const parentID = this.catalogPath[0] || "";
      if (attrs.folders) {
        attrs.folders.forEach(folder => {
          const rawID     = this.getPersistentID(this.currentPath[0], folder.name);
          const catalogID = parentID + rawID;
          const el = document.createElement('div'); el.className = 'folder-item';
          el.onclick = () => this.navigate('down', folder.name, catalogID);
          let folderContent = ICONS.folder;
          if (folder.img) {
            if (folder.img.startsWith('ICON_LIB')) folderContent = this.getIconByKey(folder.img);
            else {
              let cleanPath = folder.img.split('?')[0]; 
              const ver = this.imageVersions[folder.name] || 'ok';
              const src = `${cleanPath}?v=${ver}`;
              const loader = this.loadingSet.has(folder.name) ? `<div class="loader-container"><span class="loader"></span></div>` : '';
              folderContent = `<div style="position:relative;width:100%;height:100%"><img src="${src}" style="width:100%;height:100%;object-fit:contain;border-radius:4px">${loader}</div>`;
            }
          }
          const ctx = attrs.depth === 0 ? 'room' : 'location';
          const del = this.isEditMode ? `<div class="folder-delete-btn" onclick="event.stopPropagation();this.getRootNode().host.deleteFolder('${this.escapeJSArg(folder.name)}')">✕</div>` : '';
          const edt = this.isEditMode ? `<div class="folder-edit-btn"   onclick="event.stopPropagation();this.getRootNode().host.enableFolderRename(this.closest('.folder-item').querySelector('.folder-label'),'${this.escapeJSArg(folder.name)}')">${ICONS.edit}</div>` : '';
          const img = this.isEditMode ? `<div class="folder-img-btn"    onclick="event.stopPropagation();this.getRootNode().host.openIconPicker('${this.escapeJSArg(folder.name)}','${ctx}')">${ICONS.image}</div>` : '';
          el.innerHTML = `<div class="android-folder-icon">${folderContent}<div class="catalog-badge">${catalogID}</div>${edt}${del}${img}</div><div class="folder-label">${folder.name}</div>`;
          grid.appendChild(el);
        });
      }
      if (this.isEditMode) {
        const addBtn = document.createElement('div'); addBtn.className = 'folder-item add-folder-card';
        addBtn.innerHTML = `<div class="android-folder-icon">${ICONS.plus}</div><div class="folder-label">${this._t('add', 'Add')}</div>`;
        addBtn.onclick = e => { if(typeof this.enableFolderInput === 'function') this.enableFolderInput(e.currentTarget); };
        grid.appendChild(addBtn);
      }
      content.appendChild(grid);
    }
    if (attrs.items?.length > 0) {
      const list = document.createElement('div'); list.className = 'item-list';
      attrs.items.forEach(item => {
          if (typeof this.createItemRow === 'function') list.appendChild(this.createItemRow(item, false));
      });
      content.appendChild(list);
    }
    if (this.isEditMode && attrs.depth === 1) {
      const addBtn = document.createElement('div'); addBtn.className = 'add-item-btn-row';
      addBtn.innerHTML = `<button class="add-item-btn" onclick="this.getRootNode().host.addQuickItem()">+ ${this._t('add', 'Add')}</button>`;
      content.appendChild(addBtn);
    }
  }

  renderItemsView(content, attrs) {
    const listContainer = document.createElement('div'); listContainer.className = 'item-list';
    const inStock = [], outOfStock = [];
    if (attrs.items) attrs.items.forEach(item => (item.qty === 0 ? outOfStock : inStock).push(item));

    const markerRegex  = /^ORDER_MARKER_(\d+)_(.*)$/;
    const orderedGroups = [], foundMarkers = new Set(), rawGroups = new Set();
    const grouped = {};

    if (attrs.folders) attrs.folders.forEach(f => {
      if (f.name.startsWith("ORDER_MARKER_")) {
        const m = f.name.match(markerRegex);
        if (m) { orderedGroups.push({ name:m[2], order:parseInt(m[1]), markerKey:f.name }); foundMarkers.add(m[2]); }
      } else rawGroups.add(f.name);
    });

    inStock.forEach(item => {
      const sub = item.sub_location || "General";
      if (sub.startsWith("ORDER_MARKER_")) {
        const m = sub.match(markerRegex);
        if (m && !orderedGroups.find(g => g.markerKey===sub)) { orderedGroups.push({ name:m[2], order:parseInt(m[1]), markerKey:sub }); foundMarkers.add(m[2]); }
      } else rawGroups.add(sub);
    });

    rawGroups.forEach(g => {
      if (!foundMarkers.has(g)) orderedGroups.push({ name:g, order:g==="General"?-1:9999, markerKey:null });
    });

    orderedGroups.sort((a,b) => a.order!==b.order ? a.order-b.order : a.name.localeCompare(b.name));
    orderedGroups.forEach(g => grouped[g.name] = []);
    inStock.forEach(item => {
      const sub = item.sub_location || "General";
      if (!sub.startsWith("ORDER_MARKER_")) { if (!grouped[sub]) grouped[sub]=[]; grouped[sub].push(item); }
    });

    const parentID = this.catalogPath[1] || "";

    orderedGroups.forEach(groupObj => {
      const subName = groupObj.name;
      const items   = grouped[subName] || [];
      const rawID   = this.getPersistentID(this.currentPath.join('_'), subName);
      const catalogID = parentID ? `${parentID}.${rawID}` : "";
      if (subName === "General" && items.length === 0 && !this.isEditMode) return;
      
      if (this.viewMode === 'grid' && items.length === 0 && !this.isEditMode) return;

      const isExpanded = this.viewMode === 'grid' ? true : this.expandedSublocs.has(subName);
      const icon = isExpanded ? ICONS.chevron_down : ICONS.chevron_right;
      const countBadge = `<span style="font-size:12px;background:var(--bg-badge);color:var(--text-badge);padding:2px 6px;border-radius:10px;margin-inline-start:8px;">${items.length}</span>`;
      const cleanSubName = this.stripMarkerForDisplay(subName);
      const idHtml = catalogID ? `<span class="catalog-id-text">${catalogID}</span>` : '';

      const header = document.createElement('div');
      header.className = 'group-separator';
      if (typeof this.setupDropTarget === 'function') this.setupDropTarget(header, subName);
      if (this.viewMode === 'list') header.onclick = () => this.toggleSubloc(subName);
      else header.style.cursor = 'default';

      if (this.isEditMode && subName !== "General") {
        header.innerHTML = `
          <div style="display:flex;align-items:center;"><span style="margin-inline-end:5px;display:flex;align-items:center;">${icon}</span><span class="subloc-title">${cleanSubName}</span>${countBadge}</div>
          <div style="display:flex;align-items:center;gap:10px;">${idHtml}
            <div style="display:flex;gap:5px;align-items:center;">
              <button class="arrow-btn" onclick="event.stopPropagation();this.getRootNode().host.moveSubLoc('${this.escapeJSArg(subName)}',-1)">${ICONS.arrow_up}</button>
              <button class="arrow-btn" onclick="event.stopPropagation();this.getRootNode().host.moveSubLoc('${this.escapeJSArg(subName)}',1)" style="transform:rotate(180deg)">${ICONS.arrow_up}</button>
              <div style="width:1px;height:15px;background:#444;margin:0 5px"></div>
              <button class="edit-subloc-btn"   onclick="event.stopPropagation();this.getRootNode().host.enableSublocRename(this,'${this.escapeJSArg(subName)}')">${ICONS.edit}</button>
              <button class="delete-subloc-btn" onclick="event.stopPropagation();this.getRootNode().host.deleteSubloc('${this.escapeJSArg(subName)}')">${ICONS.delete}</button>
            </div>
          </div>`;
      } else {
        header.innerHTML = `<div style="display:flex;align-items:center;"><span style="margin-inline-end:5px;display:flex;align-items:center;">${icon}</span><span>${cleanSubName}</span>${countBadge}</div>${idHtml}`;
      }
      listContainer.appendChild(header);

      if (isExpanded) {
        if (this.viewMode === 'grid' && items.length > 0) {
          listContainer.appendChild(this.buildGridSection(items, false));
        } else {
          items.forEach(item => {
              if (typeof this.createItemRow === 'function') listContainer.appendChild(this.createItemRow(item, false));
          });
        }
        if (this.isEditMode) {
          const addRow = document.createElement('div'); addRow.className = "group-add-row";
          addRow.innerHTML = `<button class="text-add-btn" onclick="this.getRootNode().host.addQuickItem('${this.escapeJSArg(subName)}')">${ICONS.plus} ${this._t('add', 'Add')}</button>`;
          listContainer.appendChild(addRow);
        }
      }
    });

    if (outOfStock.length > 0) {
      const isExpandedOOS = this.viewMode === 'grid' ? true : this.expandedSublocs.has('__OOS__');
      const iconOOS = isExpandedOOS ? ICONS.chevron_down : ICONS.chevron_right;
      const oosHeader = document.createElement('div');
      oosHeader.className = 'group-separator oos-separator';
      if (this.viewMode === 'list') { oosHeader.onclick = () => this.toggleSubloc('__OOS__'); oosHeader.style.cursor = 'pointer'; } else oosHeader.style.cursor = 'default';
      oosHeader.innerHTML = `<div style="display:flex;align-items:center;color:var(--danger,#F44336);"><span style="margin-inline-end:5px;display:flex;align-items:center;fill:currentColor;">${iconOOS}</span><span style="font-weight:bold;">${this._t('out_of_stock', 'Out of Stock')}</span><span style="font-size:12px;background:var(--danger,#F44336);color:white;padding:2px 6px;border-radius:10px;margin-inline-start:8px;">${outOfStock.length}</span></div>`;
      listContainer.appendChild(oosHeader);
      if (isExpandedOOS) {
        if (this.viewMode === 'grid') listContainer.appendChild(this.buildGridSection(outOfStock, true));
        else outOfStock.forEach(item => {
            if (typeof this.createItemRow === 'function') listContainer.appendChild(this.createItemRow(item, false));
        });
      }
    }

    if (this.isEditMode) {
      const gridContainer = document.createElement('div'); gridContainer.className = 'folder-grid'; gridContainer.style.marginTop = '20px';
      const addBtn = document.createElement('div'); addBtn.className = 'folder-item add-folder-card';
      addBtn.innerHTML = `<div class="android-folder-icon">${ICONS.plus}</div><div class="folder-label">${this._t('add_sub', 'Add Sub-Location')}</div>`;
      
      addBtn.onclick = e => this.enableSubLocationInput(e.currentTarget);
      
      gridContainer.appendChild(addBtn);
      listContainer.appendChild(gridContainer);
    }
    content.appendChild(listContainer);
  }

  buildGridSection(items, isOOS) {
    const gridDiv = document.createElement('div'); gridDiv.className = 'xl-grid-container';
    
    // Check if the app is in RTL mode (Hebrew layout) to align plus/minus buttons accordingly
    const app = this.shadowRoot ? this.shadowRoot.getElementById('app') : null;
    const isRTL = app && !app.classList.contains('ltr');

    items.forEach(item => {
      const card = document.createElement('div'); card.className = 'xl-card';
      let checkboxHtml = '';
      if (this.isEditMode) checkboxHtml = `<input type="checkbox" class="item-select-cb" style="position:absolute;top:8px;inset-inline-start:8px;z-index:20;transform:scale(1.3);cursor:pointer;" ${this.selectedItems.has(Number(item.id))?'checked':''} onclick="event.stopPropagation();this.getRootNode().host.toggleItemSelection('${item.id}',this.checked)">`;
      
      let iconHtml = ICONS.item;
      if (item.img) {
        if (item.img.startsWith('ICON_LIB')) {
          iconHtml = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${this.getIconByKey(item.img)||ICONS.item}</div>`;
        } else {
          let cleanPath = item.img.split('?')[0]; 
          const ver = this.imageVersions[item.id] || 'ok';
          const src = `${cleanPath}?v=${ver}`;
          const loader = this.loadingSet.has(item.id) ? `<div class="loader-container"><span class="loader"></span></div>` : '';
          iconHtml = `<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px">${loader}`;
        }
      }
      
      const fitAlert = (typeof this.checkFitWarning === 'function') ? this.checkFitWarning(item.measurements) : null;
      const fitBadge = fitAlert ? `<div class="grid-fit-badge">${this._t('item_too_small_badge', '⚠️ Small')}</div>` : '';

      const badgeStyle = isOOS ? 'background:var(--danger,#F44336); color:white;' : 'background:var(--bg-input-edit, #f0f0f0); color:var(--text-main, #333);';
      
      const plusBtn  = `<button class="grid-qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.id}',1)">${ICONS.plus}</button>`;
      const minusBtn = `<button class="grid-qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.id}',-1)">${ICONS.minus}</button>`;
      const qtyVal   = `<div class="grid-qty-val">${item.qty}</div>`;
      
      // Mirror the button layout exactly as you did in createItemRow depending on language
      const ctrlContent = isRTL ? `${plusBtn}${qtyVal}${minusBtn}` : `${minusBtn}${qtyVal}${plusBtn}`;
      const qtyControlsHtml = `<div class="grid-qty-ctrl" style="${badgeStyle}" onclick="event.stopPropagation()">${ctrlContent}</div>`;

      card.innerHTML = `
        ${checkboxHtml}${fitBadge}
        <div class="xl-icon-area">${iconHtml}</div>
        <div class="xl-info">
          ${qtyControlsHtml}
          <div class="xl-name">${item.name}</div>
          <div class="xl-date">${item.date||''}</div>
        </div>
      `;
      
      const iconArea = card.querySelector('.xl-icon-area');
      if (iconArea) iconArea.onclick = e => { e.stopPropagation(); this.showItemDetails(item); };
      card.onclick = () => { this.viewMode = 'list'; this.expandedIdx = item.id; this.render(); };
      gridDiv.appendChild(card);
    });
    return gridDiv;
  }

  renderHierarchyControl(item, isPending = false) {
    const hierarchy = this.localData?.hierarchy || {};
    const state = this.locationEditState[item.id] || {};
    const l1 = state.l1 !== undefined ? state.l1 : (item.level_1 || item.main_location || '');
    const l2 = state.l2 !== undefined ? state.l2 : (item.level_2 || item.sub_location  || '');
    const l3 = state.l3 !== undefined ? state.l3 : (item.level_3 || '');

    const buildOpts = (keys, current, placeholder) => {
      let opts = `<option value="" disabled ${!current?'selected':''}>${placeholder}</option>`;
      let found = false;
      keys.forEach(k => { if (k.startsWith('ZONE_MARKER_') || k.startsWith('ORDER_MARKER_')) return; const sel = current===k; if(sel) found=true; opts += `<option value="${k}" ${sel?'selected':''}>${k}</option>`; });
      if (current && !found) opts += `<option value="${current}" selected>${this.stripMarkerForDisplay(current)}</option>`;
      return opts;
    };

    const l1Opts = buildOpts(Object.keys(hierarchy).sort(), l1, this._t('select_room', 'Room'));
    const l2Keys = l1 && !Array.isArray(hierarchy[l1]) ? Object.keys(hierarchy[l1]||{}).sort() : [];
    const l2Opts = buildOpts(l2Keys, l2, this._t('select_loc', 'Location'));
    const l3Keys = l1 && l2 && hierarchy[l1] && !Array.isArray(hierarchy[l1]) && Array.isArray(hierarchy[l1][l2]) ? hierarchy[l1][l2].sort() : [];
    const l3Opts = buildOpts(l3Keys, l3, this._t('select_subloc', 'Sub-location'));

    const sep     = `<span class="hierarchy-sep" style="font-size:10px; color:var(--text-sub); margin:0 1px;">▶</span>`;
    const btnHtml = isPending ? '' : `<button class="hierarchy-update-btn action-btn" style="border-radius:6px;width:36px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0;" onclick="if(typeof this.getRootNode().host.saveHierarchy === 'function') this.getRootNode().host.saveHierarchy('${item.id}')">${FLOPPY_SVG}</button>`;

    return `
      <div class="hierarchy-container" style="display:flex; flex-direction:row; align-items:center; gap:3px; width:100%; overflow:hidden;">
        <select class="hierarchy-select" style="flex:1; min-width:0; padding:6px 2px; border-radius:6px; border:1px solid var(--border-light); background:var(--bg-input-edit); color:var(--text-main); font-size:11px; text-overflow:ellipsis;" onchange="if(typeof this.getRootNode().host.updateHierarchyState === 'function') this.getRootNode().host.updateHierarchyState('${item.id}',1,this.value)">${l1Opts}</select>
        ${sep}
        <select class="hierarchy-select" ${!l1?'disabled':''} style="flex:1; min-width:0; padding:6px 2px; border-radius:6px; border:1px solid var(--border-light); background:var(--bg-input-edit); color:var(--text-main); font-size:11px; text-overflow:ellipsis;" onchange="if(typeof this.getRootNode().host.updateHierarchyState === 'function') this.getRootNode().host.updateHierarchyState('${item.id}',2,this.value)">${l2Opts}</select>
        ${sep}
        <select class="hierarchy-select" ${!(l1&&l2)?'disabled':''} style="flex:1; min-width:0; padding:6px 2px; border-radius:6px; border:1px solid var(--border-light); background:var(--bg-input-edit); color:var(--text-main); font-size:11px; text-overflow:ellipsis;" onchange="if(typeof this.getRootNode().host.updateHierarchyState === 'function') this.getRootNode().host.updateHierarchyState('${item.id}',3,this.value)">${l3Opts}</select>
        ${btnHtml}
      </div>`;
  }

  renderLocationControl(item, isShopMode) {
    if (!isShopMode) return `<div class="sub-title">${item.date || ''}</div>`;
    let displayLoc = item.location || '';
    displayLoc = displayLoc.split('>').map(p => this.stripMarkerForDisplay(p)).join(' > ');
    return `<div class="sub-title">${displayLoc}</div>`;
  }

  createItemRow(item, isShopMode) {
    const div = document.createElement('div');
    const oosClass = (item.qty === 0 && !isShopMode) ? 'out-of-stock-frame' : '';
    div.className = `item-row ${this.expandedIdx === item.id ? 'expanded' : ''} ${oosClass}`;
    if (typeof this.setupDragSource === 'function') this.setupDragSource(div, item.name);

    const app   = this.shadowRoot.getElementById('app');
    const isRTL = app && !app.classList.contains('ltr');

    let controls = '';
    if (isShopMode) {
      const displayQty = item.order_qty ?? 1;
      const checkStyle = "background:var(--accent);width:40px;height:40px;margin-inline-start:8px;";
      const minus = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateOrderQty('${item.id}',-1)">${ICONS.minus}</button>`;
      const plus  = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateOrderQty('${item.id}',1)">${ICONS.plus}</button>`;
      const qty   = `<span class="qty-val" style="margin:0 8px">${displayQty}</span>`;
      const check = `<button class="qty-btn" style="${checkStyle}" onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.id}')">${ICONS.check}</button>`;
      controls = isRTL ? `${plus}${qty}${minus}${check}` : `${minus}${qty}${plus}${check}`;
    } else {
      controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.id}',1)">${ICONS.plus}</button><span class="qty-val">${item.qty}</span><button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.id}',-1)">${ICONS.minus}</button>`;
    }

    const subText = this.renderLocationControl(item, isShopMode);
    let checkboxHtml = '';
    if (this.isEditMode && !isShopMode) {
      checkboxHtml = `<input type="checkbox" class="item-select-cb" style="margin-inline-end:10px;transform:scale(1.3);cursor:pointer;" ${this.selectedItems.has(Number(item.id))?'checked':''} onclick="event.stopPropagation();this.getRootNode().host.toggleItemSelection('${item.id}',this.checked)">`;
    }

    let iconHtml = `<span class="item-icon">${ICONS.item}</span>`;
    if (item.img) {
      if (item.img.startsWith('ICON_LIB')) {
        iconHtml = `<div class="item-icon" style="cursor:zoom-in;" onclick="event.stopPropagation();this.getRootNode().host.showItemDetailsProxy('${item.id}')">${this.getIconByKey(item.img)||ICONS.item}</div>`;
      } else {
        let cleanPath = item.img.split('?')[0]; 
        const ver = this.imageVersions[item.id] || 'ok';
        const src = `${cleanPath}?v=${ver}`;
        const loader = this.loadingSet.has(item.id) ? `<div class="loader-container"><span class="loader"></span></div>` : '';
        iconHtml = `<div style="position:relative;width:40px;height:40px"><img src="${src}" class="item-thumbnail" alt="${item.name}" onclick="event.stopPropagation();this.getRootNode().host.showImg('${cleanPath}?v=${ver}')">${loader}</div>`;
      }
    }

    const barcodeHtml = (item.barcode && item.barcode !== '0')
      ? `<div style="font-size:10px;color:var(--text-sub);margin-top:2px;display:inline-flex;align-items:center;gap:4px;opacity:.8;direction:ltr;">${miniBarcodeSvg} ${item.barcode}</div>` : '';

    div.innerHTML = `
      <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.id}')">
        <div class="item-left">
          ${checkboxHtml}${iconHtml}
          <div style="display:flex;flex-direction:column;justify-content:center;">
            <div>${item.name}</div>
            ${barcodeHtml}
            ${typeof subText==='string'&&subText.startsWith('<') ? subText : `<div class="sub-title">${subText}</div>`}
          </div>
        </div>
        <div class="item-qty-ctrl">${controls}</div>
      </div>`;

    if (this.expandedIdx === item.id) {
      const details = document.createElement('div');
      details.className = 'expanded-details';

      let expandedIconHtml = ICONS.item;
      if (item.img) {
        if (item.img.startsWith('ICON_LIB')) {
          expandedIconHtml = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--primary);">${this.getIconByKey(item.img)||ICONS.item}</div>`;
        } else {
          let cleanPath = item.img.split('?')[0]; 
          const ver = this.imageVersions[item.id] || 'ok';
          const src = `${cleanPath}?v=${ver}`;
          expandedIconHtml = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
        }
      }

      let mainCatOptions = `<option value="">${this._t('select_cat', 'Category')}</option>`;
      const mainKeys = Object.keys(ITEM_CATEGORIES);
      let mainFound = false;
      mainKeys.forEach(cat => {
        const isSel = item.category === cat;
        if (isSel) mainFound = true;
        mainCatOptions += `<option value="${cat}" ${isSel?'selected':''}>${this._t('cat_'+cat.replace(/[^a-zA-Z0-9]+/g,'_'), cat)}</option>`;
      });
      if (item.category && !mainFound) {
        mainCatOptions += `<option value="${item.category}" selected>${item.category}</option>`;
      }

      let subCatOptions = `<option value="">${this._t('select_sub', 'Sub-Category')}</option>`;
      let currentUnit = item.unit || "";
      if (item.category && ITEM_CATEGORIES[item.category]) {
        let subFound = false;
        Object.keys(ITEM_CATEGORIES[item.category]).forEach(sub => {
          const selected = item.sub_category === sub;
          if (selected) { subFound = true; currentUnit = ITEM_CATEGORIES[item.category][sub]; }
          subCatOptions += `<option value="${sub}" ${selected?'selected':''}>${this._t('sub_'+sub.replace(/[^a-zA-Z0-9]+/g,'_'), sub)}</option>`;
        });
        if (item.sub_category && !subFound) {
          subCatOptions += `<option value="${item.sub_category}" selected>${item.sub_category}</option>`;
        }
      } else if (item.sub_category) {
        subCatOptions += `<option value="${item.sub_category}" selected>${item.sub_category}</option>`;
      }

      let stylistHtml = '';
      if (item.category === 'Clothing') {
          const defaultOwner = localStorage.getItem('ho_avatar_name') || '';
          const ownerVal = item.owner || defaultOwner;
          const sStat = item.clothing_status || 'Clean';
          const sMeas = item.measurements || '';
          const sSea = item.season || '';
          const sDC = item.dress_code || '';

          const seasons = ['Summer', 'Winter', 'Spring', 'Fall'];
          const selSeasons = sSea.split(',').map(s=>s.trim());
          const seasonChips = seasons.map(s => `<div class="chip ${selSeasons.includes(s)?'active':''}" onclick="if(typeof this.getRootNode().host.toggleChip === 'function') this.getRootNode().host.toggleChip('${item.id}', 'season', '${s}')">${this._t('filter_'+s.toLowerCase(), s)}</div>`).join('');

          const occs = ['Casual', 'Work', 'Wedding', 'Gym'];
          const selOccs = sDC.split(',').map(s=>s.trim());
          const occChips = occs.map(s => `<div class="chip ${selOccs.includes(s)?'active':''}" onclick="if(typeof this.getRootNode().host.toggleChip === 'function') this.getRootNode().host.toggleChip('${item.id}', 'dress_code', '${s}')">${this._t('filter_'+s.toLowerCase(), s)}</div>`).join('');

          const fitAlert = (typeof this.checkFitWarning === 'function') ? this.checkFitWarning(sMeas) : null;
          const fitBanner = fitAlert ? `<div class="fit-warning-banner">${fitAlert}</div>` : '';

          const sOwnerPh = this.escapeJSArg(this._t('item_owner_placeholder', 'Owner'));
          const sClean = this._t('status_clean', '✨ Clean');
          const sLaundry = this._t('status_laundry', '🧺 In Laundry');
          const sArchived = this._t('status_archived', '📦 Archived');
          
          stylistHtml = `
          <div style="background:rgba(3,169,244,0.05); padding:15px; border-radius:8px; margin-top:15px; border:1px solid rgba(3,169,244,0.3);">
              <div style="font-size:14px; font-weight:bold; color:var(--primary); margin-bottom:12px; display:flex; align-items:center; gap:5px;">${this._t('item_stylist_details', '👗 Stylist & Fit Details')}</div>
              
              <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                  <input type="text" id="owner-${item.id}" placeholder="${sOwnerPh}" value="${this.escapeJSArg(ownerVal)}" style="flex:1; min-width:120px; padding:10px; background:var(--bg-input-edit); color:var(--text-main); border:1px solid var(--border-light); border-radius:6px; font-size:14px; box-sizing:border-box;" onblur="if(typeof this.getRootNode().host.saveStylistFields === 'function') this.getRootNode().host.saveStylistFields('${item.id}', '${this.escapeJSArg(item.name)}')">
                  <select id="clothing_status-${item.id}" style="flex:1; min-width:120px; padding:10px; background:var(--bg-input-edit); color:var(--text-main); border:1px solid var(--border-light); border-radius:6px; font-size:14px; box-sizing:border-box;" onchange="if(typeof this.getRootNode().host.saveStylistFields === 'function') this.getRootNode().host.saveStylistFields('${item.id}', '${this.escapeJSArg(item.name)}')">
                      <option value="Clean" ${sStat==='Clean'?'selected':''}>${sClean}</option>
                      <option value="In Laundry" ${sStat==='In Laundry'?'selected':''}>${sLaundry}</option>
                      <option value="Archived" ${sStat==='Archived'?'selected':''}>${sArchived}</option>
                  </select>
              </div>

              <div style="margin-bottom:12px;">
                  <div style="font-size:12px; color:var(--text-sub);">${this._t('item_seasons_multi', 'Seasons (Multi-Select)')}</div>
                  <div class="chip-group" id="season-chips-${item.id}">${seasonChips}</div>
                  <input type="hidden" id="season-${item.id}" value="${this.escapeJSArg(sSea)}">
              </div>

              <div style="margin-bottom:12px;">
                  <div style="font-size:12px; color:var(--text-sub);">${this._t('item_occ_multi', 'Occasions (Multi-Select)')}</div>
                  <div class="chip-group" id="dress_code-chips-${item.id}">${occChips}</div>
                  <input type="hidden" id="dress_code-${item.id}" value="${this.escapeJSArg(sDC)}">
              </div>

              <div style="margin-top:12px;">
                  <div style="font-size:12px; color:var(--text-sub);">${this._t('item_meas_label', 'Garment Measurements (cm)')}</div>
                  <input type="text" id="measurements-${item.id}" placeholder="${this.escapeJSArg(this._t('item_meas_placeholder', 'e.g. Chest: 40, Waist: 32'))}" value="${this.escapeJSArg(sMeas)}" style="width:100%; margin-top:4px; padding:10px; background:var(--bg-input-edit); color:var(--text-main); border:1px solid var(--border-light); border-radius:6px; font-size:14px; box-sizing:border-box;" onblur="if(typeof this.getRootNode().host.saveStylistFields === 'function') this.getRootNode().host.saveStylistFields('${item.id}', '${this.escapeJSArg(item.name)}')">
                  ${fitBanner}
              </div>
          </div>
          `;
      }

      details.innerHTML = `
        <div style="display:flex; gap:12px; margin-bottom:12px; align-items:flex-start;">
            
            <div style="display:flex; flex-direction:column; gap:8px; width:100px; flex-shrink:0;">
                <div style="width:100px; height:100px; border-radius:10px; border:1px solid var(--border-light); background:var(--bg-input); box-shadow:inset 0 2px 4px rgba(0,0,0,0.2); position:relative;">
                    ${expandedIconHtml}
                </div>
                <div style="position:relative; width:100px; height:34px;">
                    <button class="action-btn" style="width:100%; height:100%; text-align:center; padding:0; display:flex; align-items:center; justify-content:center; background:var(--bg-input-edit); color:var(--text-main); border:1px solid var(--border-light); border-radius:6px; font-size:11px; box-sizing:border-box;" onclick="this.nextElementSibling.showPicker()">
                        ${ICONS.calendar || '📅'} ${item.date || this._t('set_date', 'Set Date')}
                    </button>
                    <input type="date" id="date-${item.id}" value="${item.date}"
                        style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;"
                        onchange="this.previousElementSibling.innerHTML='${ICONS.calendar || '📅'} '+(this.value||'${this._t('set_date', 'Set Date')}');if(typeof this.getRootNode().host.autoSaveItem === 'function') this.getRootNode().host.autoSaveItem('${item.id}','date','${this.escapeJSArg(item.name)}')">
                </div>
            </div>
            
            <div style="flex:1; display:flex; flex-direction:column; gap:8px; min-width:0;">
                <div style="position:relative; display:flex; gap:8px; align-items:center; width:100%;">
                    <input type="text" id="name-${item.id}" value="${item.name}"
                        style="flex:1; width:100%; min-width:0; padding:10px; background:var(--bg-input-edit); color:var(--text-main); border:1px solid var(--border-light); border-radius:8px; box-sizing:border-box; font-weight:bold; font-size:15px;"
                        autocomplete="off"
                        oninput="if(typeof this.getRootNode().host.handleNameInput === 'function') this.getRootNode().host.handleNameInput(this,'${item.id}')"
                        onblur="setTimeout(()=>{this.parentElement.querySelector('.suggestions-box')?.remove()},200)"
                        onkeydown="if(event.key==='Enter'){this.blur();if(typeof this.getRootNode().host.autoSaveItem === 'function') this.getRootNode().host.autoSaveItem('${item.id}','name','${this.escapeJSArg(item.name)}')}">
                    
                    <button class="action-btn" style="height:42px; width:42px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:8px; cursor:pointer; flex-shrink:0;" title="${this._t('save', 'Save')}" onclick="if(typeof this.getRootNode().host.autoSaveItem === 'function') this.getRootNode().host.autoSaveItem('${item.id}','name','${this.escapeJSArg(item.name)}')">${FLOPPY_SVG}</button>
                </div>
                
                <div style="display:flex; gap:8px; align-items:center; justify-content:flex-start;">
                    <input type="text" id="unit-val-${item.id}" value="${item.unit_value||''}" placeholder="Val"
                        style="width:60px; padding:8px 4px; background:var(--bg-input-edit); color:var(--text-main); border:1px solid var(--border-light); border-radius:6px; text-align:center; box-sizing:border-box; font-size:13px;"
                        onchange="if(typeof this.getRootNode().host.updateUnitValue === 'function') this.getRootNode().host.updateUnitValue('${item.id}','${this.escapeJSArg(item.name)}')"
                        onblur="if(typeof this.getRootNode().host.updateUnitValue === 'function') this.getRootNode().host.updateUnitValue('${item.id}','${this.escapeJSArg(item.name)}')">
                    
                    <div id="unit-disp-${item.id}" style="background:var(--bg-badge); color:var(--text-badge); padding:8px 6px; border-radius:6px; font-size:12px; min-width:40px; text-align:center; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-sizing:border-box;">
                        ${this._t('unit_'+currentUnit, currentUnit)||'-'}
                    </div>
                </div>
            </div>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:12px; width:100%;">
            <select class="move-select" id="cat-main-${item.id}" style="flex:1; min-width:0; padding:8px; border-radius:6px; border:1px solid var(--border-light); background:var(--bg-input-edit); color:var(--text-main); font-size:13px;" onchange="if(typeof this.getRootNode().host.updateItemCategory === 'function') this.getRootNode().host.updateItemCategory('${item.id}',this.value,'main','${this.escapeJSArg(item.name)}')">${mainCatOptions}</select>
            
            <select class="move-select" id="cat-sub-${item.id}" style="flex:1; min-width:0; padding:8px; border-radius:6px; border:1px solid var(--border-light); background:var(--bg-input-edit); color:var(--text-main); font-size:13px;" onchange="if(typeof this.getRootNode().host.updateItemCategory === 'function') this.getRootNode().host.updateItemCategory('${item.id}',this.value,'sub','${this.escapeJSArg(item.name)}')">${subCatOptions}</select>
        </div>

        ${stylistHtml}

        <div style="display:flex; flex-direction:column; gap:15px; margin-top:15px; padding-top:15px; border-top:1px solid var(--border-light);">
            ${this.renderHierarchyControl(item)}
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; gap:8px;">
                    <button class="action-btn" style="height:44px; width:44px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:8px;" title="${this._t('take_photo', 'Take Photo')}" onclick="if(typeof this.getRootNode().host.triggerCameraEdit === 'function') this.getRootNode().host.triggerCameraEdit('${item.id}','${this.escapeJSArg(item.name)}')">${ICONS.camera}</button>
                    <button class="action-btn" style="height:44px; width:44px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:8px;" title="${this._t('upload_file', 'Upload File')}" onclick="if(typeof this.getRootNode().host.triggerFileUploadEdit === 'function') this.getRootNode().host.triggerFileUploadEdit('${item.id}','${this.escapeJSArg(item.name)}')">${UPLOAD_SVG}</button>
                    <button class="action-btn" style="height:44px; width:44px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:8px;" title="${this._t('change_img', 'Change Icon')}" onclick="if(typeof this.getRootNode().host.openIconPicker === 'function') this.getRootNode().host.openIconPicker('${item.id}','item')">${ICONS.image}</button>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="action-btn" style="height:44px; width:44px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:8px;" title="${this._t('duplicate', 'Duplicate')}" onclick="if(typeof this.getRootNode().host.duplicateItem === 'function') this.getRootNode().host.duplicateItem('${item.id}')">${ICONS.copy||ICONS.paste}</button>
                    <button class="action-btn btn-danger" style="height:44px; width:44px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:8px;" title="${this._t('delete', 'Delete')}" onclick="if(typeof this.getRootNode().host.del === 'function') this.getRootNode().host.del('${item.id}')">${ICONS.delete}</button>
                </div>
            </div>
        </div>
      `;
      div.appendChild(details);
    }
    return div;
  }
};