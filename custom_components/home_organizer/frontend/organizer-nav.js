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
// [MODIFIED v2026.9.30 | 2026-09-30] Purpose: subGroupsOnPage, lifted out of
//   moveSubLoc, which built the list of groups on the page only to reorder it.
//   The box create sheet needs the same list to offer a location, and a second
//   copy would have drifted the first time the marker format or the sort
//   changed (RULE 33d). addQuickItem takes an optional box as well, so the box
//   page adds items through the one manual add rather than a second one.
//   seedLocationEditState came out of toggleRow the same way: it worked out
//   where a row is only as a side effect of expanding a card, and the box
//   page needs that answer without toggling anything. The correction inside
//   it is not optional - at depth 2 a row carries sub_location, which lands
//   in l2 where a LOCATION belongs, so the hierarchy is asked which location
//   contains that name and the two are shifted down.
// [ADDED v2026.9.27 | 2026-09-27] Purpose: A box is a drop target, and
//   putItemInBox is the one call behind all three ways of filling one - drag,
//   the row menu and a multi selection. setupDragSource now carries the item id
//   alongside the name: text/plain is untouched, so every existing drop target
//   behaves exactly as before. This file had no history block; first entry.

export const NavMixin = (Base) => class extends Base {

  navigate(dir, name, catalogId) {
    if      (dir === 'root') { this.currentPath = []; this.catalogPath = []; }
    else if (dir === 'up')   { this.currentPath.pop(); this.catalogPath.pop(); }
    else if (dir === 'down') { this.currentPath.push(name); this.catalogPath.push(catalogId); }
    this.expandedSublocs.clear();
    this.fetchData();
  }

  // [ADDED v2026.9.30] Where a row currently is, as the three destination
  // selects want it.
  //
  // Lifted out of toggleRow, which computed this only as a side effect of
  // expanding a card. The box page needs the same answer and must not toggle
  // a row to get it (RULE 33d).
  //
  // The correction in the middle is not optional. At depth 2 a row carries
  // sub_location, which lands in l2 - where a LOCATION belongs - so the
  // hierarchy is asked which location actually contains that name and the two
  // are shifted down. Without it the second select would hold a value the
  // third one should have, and saving would file the row one level too high.
  seedLocationEditState(item) {
    if (!item) return null;
    const hierarchy = this.localData?.hierarchy || {};
    let path = [];
    if (item.location) path = item.location.replace(/&gt;/g, '>').split('>').map(s => s.trim());
    let l1 = path[0] || item.main_location || this.currentPath[0] || "";
    let l2 = path[1] || item.sub_location  || this.currentPath[1] || "";
    let l3 = path[2] || this.currentPath[2] || "";

    if (l1 && l2 && hierarchy[l1]) {
      if (!Array.isArray(hierarchy[l1][l2])) {
        let foundParent = null;
        for (const key of Object.keys(hierarchy[l1])) {
          if (hierarchy[l1][key].includes(l2)) { foundParent = key; break; }
        }
        if (foundParent) { l3 = l2; l2 = foundParent; }
      }
    }
    this.locationEditState[item.id] = { l1, l2, l3 };
    return this.locationEditState[item.id];
  }

  toggleRow(id) {
    const nId = Number(id);
    this.expandedIdx = (this.expandedIdx === nId) ? null : nId;
    if (this.expandedIdx === nId) {
      const item = (this.localData?.items || []).find(i => i.id == id)
                || (this.localData?.shopping_list || []).find(i => i.id == id)
                || (this.localData?.pending_list || []).find(i => i.id == id);
      if (item) this.seedLocationEditState(item);
    }
    this.render();
  }

  toggleSubloc(name) {
    if (this.expandedSublocs.has(name)) this.expandedSublocs.delete(name);
    else this.expandedSublocs.add(name);
    this.render();
  }

  // ── Folder management ──────────────────────────────────────────────────────

  saveNewFolder(name) {
    if (!name) return;
    this._hass.callService('home_organizer', 'add_item', {
      item_name: name, item_type: 'folder', item_date: '', image_data: null, current_path: this.currentPath
    });
  }

  enableFolderInput(cardEl) {
    const iconContainer = cardEl.querySelector('.android-folder-icon');
    const label = cardEl.querySelector('.folder-label');
    if (iconContainer.querySelector('input')) return;
    iconContainer.innerHTML = `<input type="text" class="add-folder-input" placeholder="${this.t('name_placeholder')}">`;
    const input = iconContainer.querySelector('input');
    label.innerText = this.t('saving');
    input.focus();
    input.onkeydown = (e) => { if (e.key === 'Enter') this.saveNewFolder(input.value); };
    input.onblur = () => { if (input.value.trim()) this.saveNewFolder(input.value); else this.render(); };
  }

  enableFolderRename(labelEl, oldName) {
    if (!labelEl || labelEl.querySelector('input')) return;
    const input = document.createElement('input');
    input.value = oldName;
    Object.assign(input.style, { width:'100%', background:'var(--bg-input-edit)', color:'var(--text-main)', border:'1px solid var(--primary)', borderRadius:'4px', textAlign:'center', fontSize:'12px' });
    input.onclick = e => e.stopPropagation();
    labelEl.innerHTML = '';
    labelEl.appendChild(input);
    input.focus();
    let isSaving = false;
    const save = () => {
      if (isSaving) return; isSaving = true;
      const newVal = input.value.trim();
      if (newVal && newVal !== oldName)
        this.callHA('update_item_details', { original_name: oldName, new_name: newVal, new_date: "", current_path: this.currentPath, is_folder: true });
      else this.render();
    };
    input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
    input.onblur = () => save();
  }

  // [MODIFIED v2026.9.30] The box page adds through here too.
  //
  // There is ONE manual add and not two (RULE 33d). When boxId is given the
  // back end takes the levels from the box itself, so usePath is ignored in
  // that case by design - the box is where the thing physically is.
  addQuickItem(targetSubloc, boxId) {
    const tempName = this.t('new_item') + " " + new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
    const today = new Date().toISOString().split('T')[0];
    let usePath = [...this.currentPath];
    if (targetSubloc && targetSubloc !== "General") usePath.push(targetSubloc);
    const payload = { item_name: tempName, item_type: 'item', item_date: today, image_data: null, current_path: usePath };
    if (boxId) payload.box_id = String(boxId);
    this._hass.callService('home_organizer', 'add_item', payload);
  }

  // ── Sub-location management ────────────────────────────────────────────────

  enableSublocRename(btn, oldName) {
    const header = btn.closest('.group-separator');
    if (header.querySelector('input')) return;
    const titleSpan = header.querySelector('.subloc-title');
    if (!titleSpan) return;
    const input = document.createElement('input');
    input.value = this.stripMarkerForDisplay(oldName);
    input.className = 'add-folder-input';
    input.style.width = '200px'; input.style.textAlign = 'start';
    input.onclick = e => e.stopPropagation();
    titleSpan.replaceWith(input);
    input.focus();
    let isSaving = false;
    const save = () => {
      if (isSaving) return; isSaving = true;
      const newVal = input.value.trim();
      if (newVal && newVal !== this.stripMarkerForDisplay(oldName)) this.batchUpdateSubloc(oldName, newVal);
      else this.render();
    };
    input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
    input.onblur = () => save();
  }

  batchUpdateSubloc(oldName, newNameOnly) {
    const match = oldName.match(/^ORDER_MARKER_(\d+)_(.*)$/);
    const finalNewName = match ? `ORDER_MARKER_${match[1]}_${newNameOnly}` : newNameOnly;
    this.callHA('update_item_details', {
      original_name: oldName, new_name: finalNewName, current_path: this.currentPath, is_folder: true
    }).then(() => this.fetchData());
  }

  // [ADDED v2026.9.30] The groups on the page, in the order they are drawn.
  //
  // Lifted out of moveSubLoc, which built this list only to reorder it. The
  // box create sheet needs the same list to offer a location, and a second
  // copy would drift away from this one the first time the marker format or
  // the sort changed (RULE 33d).
  //
  // Returns the DISPLAY names, with the ORDER_MARKER_<n>_ prefix stripped,
  // plus the stored marker each one came from - moveSubLoc renames those and
  // a caller that only wants to show the list can ignore them. "General" is
  // in the list like any other group, and means the absence of a level: see
  // handleDropAction, which does not push it onto a path.
  subGroupsOnPage() {
    const subGroups = [];
    const markerRegex = /^ORDER_MARKER_(\d+)_(.*)$/;
    const seen = new Set();
    const currentMarkers = {};

    const processEntry = (name, defaultOrder) => {
      if (name.startsWith("ORDER_MARKER_")) {
        const m = name.match(markerRegex);
        if (m) {
          const realName = m[2];
          if (!seen.has(realName)) { subGroups.push({ name: realName, order: parseInt(m[1]) }); seen.add(realName); currentMarkers[realName] = name; }
        }
      } else {
        if (!seen.has(name)) { subGroups.push({ name, order: defaultOrder }); seen.add(name); }
      }
    };

    this.localData?.folders?.forEach(f => processEntry(f.name, 9999));
    this.localData?.items?.forEach(i => processEntry(i.sub_location || "General", i.sub_location === "General" ? -1 : 9999));

    subGroups.sort((a,b) => a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name));
    return { groups: subGroups, markers: currentMarkers };
  }

  async moveSubLoc(subName, direction) {
    const { groups: subGroups, markers: currentMarkers } = this.subGroupsOnPage();

    const idx = subGroups.findIndex(g => g.name === subName);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= subGroups.length) return;
    [subGroups[idx], subGroups[newIdx]] = [subGroups[newIdx], subGroups[idx]];

    for (let i = 0; i < subGroups.length; i++) {
      const g = subGroups[i];
      if (g.name === "General") continue;
      const newOrder = (i + 1) * 10;
      const padded = String(newOrder).padStart(3, '0');
      const newMarkerName = `ORDER_MARKER_${padded}_${g.name}`;
      const oldMarkerName = currentMarkers[g.name];
      if (oldMarkerName && oldMarkerName !== newMarkerName) {
        await this.callHA('update_item_details', { original_name: oldMarkerName, new_name: newMarkerName, current_path: this.currentPath, is_folder: true });
      } else if (!oldMarkerName) {
        await this.callHA('add_item', { item_name: newMarkerName, item_type: 'folder', current_path: this.currentPath });
      }
    }
    this.fetchData();
  }

  // ── Zone management ────────────────────────────────────────────────────────

  createNewZone() {
    let base = this.t('new_zone'), name = base, count = 1;
    const existing = new Set();
    this.localData?.folders?.forEach(f => {
      if (f.zone) existing.add(f.zone);
      if (f.name.startsWith("ZONE_MARKER_")) existing.add(f.name.replace(/^ZONE_MARKER_\d+_/, "").trim());
    });
    while (existing.has(name)) name = `${base} ${count++}`;
    this.callHA('add_item', { item_name: `ZONE_MARKER_999_${name}`, item_type: 'folder', zone: name, current_path: [] });
  }

  enableZoneRoomInput(cardEl, zoneName) {
    const iconContainer = cardEl.querySelector('.android-folder-icon');
    const label = cardEl.querySelector('.folder-label');
    if (iconContainer.querySelector('input')) return;
    iconContainer.innerHTML = `<input type="text" class="add-folder-input" placeholder="${this.t('name_placeholder')}">`;
    const input = iconContainer.querySelector('input');
    const translated = this.t('zone_' + zoneName.replace(/ /g, '_'));
    const finalZone  = translated === 'zone_' + zoneName.replace(/ /g, '_') ? zoneName : translated;
    label.innerText = this.t('save_to') + " " + finalZone;
    input.focus();
    input.onkeydown = e => { if (e.key === 'Enter') this.saveNewRoomInZone(input.value, zoneName); };
    input.onblur = () => { if (input.value.trim()) this.saveNewRoomInZone(input.value, zoneName); else this.render(); };
  }

  saveNewRoomInZone(name, zoneName) {
    if (!name) return;
    const finalName = zoneName !== "General Rooms" ? `[${zoneName}] ${name}` : name;
    this.callHA('add_item', { item_name: finalName, item_type: 'folder', current_path: [] });
  }

  enableZoneRename(btn, oldName) {
    const header = btn.closest('.group-separator');
    if (header.querySelector('input')) return;
    const titleSpan = header.querySelector('.subloc-title') || header.querySelector('span');
    if (!titleSpan) return;
    const input = document.createElement('input');
    input.value = oldName;
    Object.assign(input.style, { background:'var(--bg-input-edit)', color:'var(--text-main)', border:'1px solid var(--primary)', borderRadius:'4px', padding:'4px', fontSize:'14px', width:'200px' });
    input.onclick = e => e.stopPropagation();
    titleSpan.replaceWith(input);
    input.focus();
    let isSaving = false;
    const save = () => {
      if (isSaving) return; isSaving = true;
      const newVal = input.value.trim();
      if (newVal && newVal !== oldName) { const span = document.createElement('span'); span.className = 'subloc-title'; span.innerText = newVal; input.replaceWith(span); this.batchUpdateZone(oldName, newVal); }
      else { const span = document.createElement('span'); span.className = 'subloc-title'; span.innerText = oldName; input.replaceWith(span); }
    };
    input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
    input.onblur = () => save();
  }

  batchUpdateZone(oldZone, newZone) {
    if (!this.localData?.folders) return;
    this.localData.folders.forEach(f => {
      if (f.name.startsWith("ZONE_MARKER_") && f.name.endsWith(`_${oldZone}`)) {
        const prefix = f.name.substring(0, f.name.lastIndexOf(`_${oldZone}`));
        this.callHA('update_item_details', { original_name: f.name, new_name: `${prefix}_${newZone}`, current_path: [], is_folder: true });
      } else if (f.name.startsWith(`[${oldZone}] `)) {
        const cleanName = f.name.replace(`[${oldZone}] `, "");
        this.callHA('update_item_details', { original_name: f.name, new_name: `[${newZone}] ${cleanName}`, current_path: [], is_folder: true });
      }
    });
    setTimeout(() => this.fetchData(), 800);
  }

  moveZone(zoneName, direction) {
    const zones = [];
    const markerRegex = /^ZONE_MARKER_(\d+)_(.*)$/;
    const seen = new Set();
    this.localData?.folders?.forEach(f => {
      if (f.name.startsWith("ZONE_MARKER_")) {
        const m = f.name.match(markerRegex);
        const zName = m ? m[2] : f.name.replace("ZONE_MARKER_", "").trim();
        const zOrder = m ? parseInt(m[1]) : 9999;
        if (!seen.has(zName)) { zones.push({ name: zName, order: zOrder, markerName: f.name }); seen.add(zName); }
      }
    });
    zones.sort((a,b) => a.order - b.order);
    const idx = zones.findIndex(z => z.name === zoneName);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= zones.length) return;
    [zones[idx], zones[newIdx]] = [zones[newIdx], zones[idx]];
    zones.forEach((z, i) => {
      const newMarkerName = `ZONE_MARKER_${String((i+1)*10).padStart(3,'0')}_${z.name}`;
      if (z.markerName !== newMarkerName)
        this.callHA('update_item_details', { original_name: z.markerName, new_name: newMarkerName, current_path: [], is_folder: true });
    });
    setTimeout(() => this.fetchData(), 600);
  }

  deleteZone(zoneName) {
    if (confirm(this.t('confirm_del_zone', zoneName)) && this.localData?.folders) {
      this.localData.folders.forEach(f => {
        if (f.name.startsWith("ZONE_MARKER_") && f.name.endsWith(`_${zoneName}`))
          this.callHA('delete_item', { item_name: f.name, current_path: [], is_folder: true });
        else if (f.name.startsWith(`[${zoneName}] `))
          this.callHA('update_item_details', { original_name: f.name, new_name: f.name.replace(`[${zoneName}] `, ""), current_path: [], is_folder: true });
      });
      setTimeout(() => this.fetchData(), 800);
    }
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────

  // [MODIFIED v2026.9.27] The id travels with the name.
  //
  // text/plain still carries the name alone, so every existing drop target is
  // untouched. A box needs the id, because putting an item in a box addresses
  // the row rather than rewriting a path by name.
  setupDragSource(el, itemName, itemId) {
    el.draggable = true;
    el.ondragstart = e => {
      e.dataTransfer.setData("text/plain", itemName);
      if (itemId !== undefined && itemId !== null) {
        try { e.dataTransfer.setData("application/x-ho-item-id", String(itemId)); }
        catch (err) { /* a provider that refuses a custom type still has the name */ }
      }
      e.dataTransfer.effectAllowed = "move";
      el.classList.add('dragging');
    };
    el.ondragend = () => el.classList.remove('dragging');
  }

  setupDropTarget(el, subName) {
    el.dataset.subloc = subName;
    el.ondragover  = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); };
    el.ondragleave = () => el.classList.remove('drag-over');
    el.ondrop      = e => { e.preventDefault(); el.classList.remove('drag-over'); const itemName = e.dataTransfer.getData("text/plain"); this.handleDropAction(subName, itemName); };
  }

  async handleDropAction(targetSubloc, itemName) {
    if (!itemName) return;
    const targetPath = [...this.currentPath];
    const realSub = this.resolveRealName(targetSubloc);
    if (realSub !== "General") targetPath.push(realSub);
    try {
      await this.callHA('clipboard_action', { action: 'cut', item_name: itemName });
      await this.callHA('paste_item', { target_path: targetPath });
    } catch (err) { console.error("Drop failed:", err); }
  }

  // [ADDED v2026.9.27] A box as a drop target.
  //
  // Separate from setupDropTarget, which moves an item to a sub-location by
  // cutting and pasting a path. Dropping into a box is not a path change at
  // all: it is set_item_box, which brings the levels with it.
  setupBoxDropTarget(el, boxId) {
    el.ondragover = e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drag-over');
    };
    el.ondragleave = () => el.classList.remove('drag-over');
    el.ondrop = e => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over');
      const id = e.dataTransfer.getData("application/x-ho-item-id");
      if (id) this.putItemInBox(id, boxId);
    };
  }

  // The one call behind all three ways in: drag, the row menu and a multi
  // selection. boxId of null takes the item out (RULE 33d).
  async putItemInBox(itemId, boxId) {
    if (!itemId) return;
    try {
      await this.callHA('set_item_box', {
        item_id: String(itemId),
        box_id: boxId ? String(boxId) : null,
      });
    } catch (err) { console.error("Box move failed:", err); }
  }

  setupRoomDragSource(el, roomName) {
    el.draggable = true;
    el.ondragstart = e => { e.dataTransfer.setData("text/plain", roomName); e.dataTransfer.effectAllowed = "move"; el.classList.add('dragging'); };
    el.ondragend = () => el.classList.remove('dragging');
  }

  setupZoneDropTarget(el, zoneName) {
    el.ondragover  = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); };
    el.ondragleave = () => el.classList.remove('drag-over');
    el.ondrop      = e => { e.preventDefault(); el.classList.remove('drag-over'); const roomName = e.dataTransfer.getData("text/plain"); if (roomName) this.moveRoomToZone(roomName, zoneName); };
  }

  async moveRoomToZone(roomName, zoneName) {
    try {
      const cleanName = roomName.replace(/^\[(.*?)\]\s*/, "");
      const newName   = zoneName !== "General Rooms" ? `[${zoneName}] ${cleanName}` : cleanName;
      if (newName !== roomName) {
        await this.callHA('update_item_details', { original_name: roomName, new_name: newName, current_path: [], is_folder: true });
        this.fetchData();
      }
    } catch (err) { console.error("Zone move failed", err); }
  }

};
