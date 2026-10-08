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
// [ADDED v2026.10.7 | 2026-10-07] Purpose: a "+" to add a category, and one
//   inside every category to add a sub-category.
//
//   The window could delete and rename and not create, so the one thing a user
//   reaches this screen wanting to do after seeing a gap had to be done
//   somewhere else. The top-level "+" is at the TOP because a control for the
//   whole window belongs there and because the bottom of a long list is a
//   scroll away on a phone; the per-category one sits directly under the
//   sub-categories it will join.
//
//   NEITHER CREATES ANYTHING ITSELF. Both call addCategoryNamed, which was
//   split out of promptAddCategory so the creation stays in one place: the
//   payload shape is not obvious - a sub-category goes in sub_category with
//   its parent in category, and a new top-level goes in category with
//   sub_category null, which is what makes the service supply the "General"
//   bucket the two-step picker needs - and two copies of that would drift
//   (RULE 22, RULE 33d).
// [ADDED v2026.10.2 | 2026-10-02] Purpose: The categories screen. There was no
//   way to remove a category or sub-category at all - only to add or rename
//   one - so an inventory accumulated whatever the scanner had registered and
//   the list could only grow.
//
//   It is a module of its own, like the box page, because it shares nothing
//   with the views: no path, no selection, no edit mode. It builds its overlay
//   on demand and removes it on close, so it holds no state between openings
//   beyond which row is mid-delete.
//
//   It reuses .modal-content from organizer-panel.css rather than bringing a
//   stylesheet. That class is the panel's generic modal shell - scrollable,
//   capped at 90vh, 450px wide - not another feature's styling, so this is
//   reuse and not the borrowing RULE 33a.7 warns about.

import { ICONS } from '../organizer-icon.js?v=10.11.112';
import { escapeHtml, categorySelectOptions } from '../organizer-utils.js?v=10.11.112';

export const CategoriesMixin = (Base) => class extends Base {

  // ------------------------------------------------------------------
  // Opening and closing.
  //
  // The overlay is built fresh each time rather than kept hidden in the shell.
  // A list of categories is small, the data is already in memory, and a
  // screen that is rebuilt cannot show a category the user deleted two
  // openings ago.
  // ------------------------------------------------------------------
  openCategoriesScreen() {
    const menu = this.shadowRoot.getElementById('setup-dropdown-menu');
    if (menu) menu.classList.remove('show');
    this.catDeleteFor = null;
    this.renderCategoriesScreen();
  }

  closeCategoriesScreen() {
    this.catDeleteFor = null;
    const old = this.shadowRoot.getElementById('categories-modal');
    if (old) old.remove();
  }

  // ------------------------------------------------------------------
  // The screen.
  //
  // Rebuilt in place on every change, which is why it is one method: a delete
  // changes the list, the counts AND which destinations are offerable, and
  // patching three of those by hand is how they end up disagreeing.
  // ------------------------------------------------------------------
  renderCategoriesScreen() {
    const prev = this.shadowRoot.getElementById('categories-modal');
    if (prev) prev.remove();

    const cats = this.categories || {};
    const counts = this.categoryCounts || { by_category: {}, by_sub: {} };

    const ov = document.createElement('div');
    ov.id = 'categories-modal';
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;'
      + 'background:rgba(0,0,0,.85);z-index:3500;display:flex;'
      + 'align-items:center;justify-content:center;padding:15px;'
      + 'box-sizing:border-box;';
    // Click outside to close, and only outside: e.target === ov means the
    // backdrop itself, never a control inside the card.
    ov.onclick = (e) => { if (e.target === ov) this.closeCategoriesScreen(); };

    const card = document.createElement('div');
    card.className = 'modal-content';
    card.style.cssText = 'text-align:start;max-width:520px;width:100%;';

    const head = document.createElement('div');
    head.style.cssText = 'font-size:16px;font-weight:bold;color:var(--primary);'
      + 'text-align:center;';
    head.textContent = this._t('cats_title', 'Manage categories');
    card.appendChild(head);

    // [ADDED v2026.10.7] Add a category, before the list of them.
    //
    // At the top because that is where a thing that applies to the whole
    // window belongs, and because on a phone the bottom of a long category
    // list is a scroll away.
    card.appendChild(this.buildCategoryAddRow(null));

    const names = Object.keys(cats);
    if (!names.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:13px;color:var(--text-sub);text-align:center;';
      empty.textContent = this._t('cats_empty', 'No categories yet.');
      card.appendChild(empty);
    }

    names.forEach(cat => {
      card.appendChild(this.buildCategoryBlock(cat, cats, counts));
    });

    const close = document.createElement('button');
    close.className = 'action-btn';
    close.type = 'button';
    close.style.cssText = 'width:100%;';
    close.textContent = this._t('close', 'Close');
    close.onclick = () => this.closeCategoriesScreen();
    card.appendChild(close);

    ov.appendChild(card);
    this.mountOverlay(ov);
  }

  // [ADDED v2026.10.7] "+" - a new category, or a new sub-category inside
  // one. `cat` is null for a top-level category and the category name for a
  // sub-category of it.
  //
  // Nothing here writes to the database. add_category is the service the
  // dropdowns and the scanner already call, and it is what creates the
  // "General" sub-category a brand new top-level category needs - without
  // it the two-step picker would have a category with nothing under it
  // (RULE 22, RULE 33d).
  buildCategoryAddRow(cat) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;'
      + (cat ? 'padding-top:4px;' : 'padding-bottom:4px;');

    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.type = 'button';
    btn.style.cssText = 'flex:1;min-height:44px;display:flex;'
      + 'align-items:center;justify-content:center;gap:8px;'
      + 'background:transparent;border:1px dashed var(--border-light);'
      + 'font-size:13px;';
    const plus = document.createElement('span');
    plus.style.cssText = 'width:18px;height:18px;display:flex;flex-shrink:0;';
    plus.innerHTML = ICONS.plus;
    btn.appendChild(plus);
    const label = document.createElement('span');
    label.textContent = cat
      ? this._t('cats_add_sub', 'Add a sub-category')
      : this._t('cats_add_cat', 'Add a category');
    btn.appendChild(label);
    btn.onclick = () => this.startCategoryAdd(wrap, cat);
    wrap.appendChild(btn);
    return wrap;
  }

  // The same inline edit the rename rows use: Enter or blur saves, Escape
  // abandons. One shape to learn on this screen, not two.
  startCategoryAdd(wrap, cat) {
    // The children are REMOVED, not cleared with innerHTML. The
    // wrap holds a button this code appended, and assigning
    // innerHTML to a container that already holds appended
    // children is the defect RULE 33a.5 is named after - st32
    // caught this one as the fifth such assignment in the file.
    while (wrap.firstChild) wrap.firstChild.remove();
    const input = document.createElement('input');
    input.placeholder = cat
      ? this._t('cats_new_sub', 'New sub-category name')
      : this._t('cats_new_cat', 'New category name');
    input.style.cssText = 'flex:1;min-width:0;min-height:44px;padding:8px;'
      + 'border-radius:8px;background:var(--bg-input);color:var(--text-main);'
      + 'border:1px solid var(--primary);font-size:13px;';
    wrap.appendChild(input);

    let settled = false;
    const finish = async (save) => {
      if (settled) return;
      settled = true;
      const name = input.value.trim();
      if (!save || !name) {
        this.renderCategoriesScreen();
        return;
      }
      try {
        // The same creation the dropdowns use. addCategoryNamed refreshes,
        // which is what brings the new row and its item count back - the
        // counts are a getter over the main payload, not a separate fetch.
        await this.addCategoryNamed(cat, name);
      } catch (e) {
        console.error('The category could not be added', e);
      }
      this.renderCategoriesScreen();
    };

    input.onblur = () => finish(true);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    };
    input.focus();
  }

  // One top-level category and its sub-categories.
  buildCategoryBlock(cat, cats, counts) {
    const block = document.createElement('div');
    block.style.cssText = 'border:1px solid var(--border-light);border-radius:8px;'
      + 'padding:10px;display:flex;flex-direction:column;gap:6px;';

    const subs = Object.keys(cats[cat] || {});
    const catCount = Number(counts.by_category?.[cat] || 0);

    block.appendChild(this.buildCategoryRow({
      label: this._t('cat_' + cat.replace(/[^a-zA-Z0-9]+/g, '_'), cat),
      count: catCount,
      bold: true,
      note: subs.length
        ? this._t('cats_all_subs', 'and all its sub-categories') : '',
      key: cat + '\u0000',
      category: cat,
      sub: '',
      cats,
    }));

    subs.forEach(sub => {
      const row = this.buildCategoryRow({
        label: this._t('sub_' + sub.replace(/[^a-zA-Z0-9]+/g, '_'), sub),
        count: Number(counts.by_sub?.[cat]?.[sub] || 0),
        bold: false,
        note: '',
        key: cat + '\u0000' + sub,
        category: cat,
        sub,
        cats,
      });
      row.style.paddingInlineStart = '14px';
      block.appendChild(row);
    });

    // [ADDED v2026.10.7] And one per category, after its own list - so the
    // "+" is always directly under the sub-categories it will join.
    const add = this.buildCategoryAddRow(cat);
    add.style.paddingInlineStart = '14px';
    block.appendChild(add);

    return block;
  }

  // ------------------------------------------------------------------
  // One row: what it is, how many items it holds, and a bin.
  //
  // Pressing the bin does not delete. It opens the destination picker on that
  // row, because the user has to say where the items go first - which is also
  // the confirmation step (RULE 33). A window.confirm() could not ask the
  // question that actually matters here.
  // ------------------------------------------------------------------
  buildCategoryRow(spec) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const name = document.createElement('span');
    name.style.cssText = 'flex:1;min-width:0;overflow:hidden;'
      + 'text-overflow:ellipsis;white-space:nowrap;font-size:13px;'
      + (spec.bold ? 'font-weight:bold;' : 'color:var(--text-sub);');
    name.textContent = spec.label;
    row.appendChild(name);

    const tally = document.createElement('span');
    tally.style.cssText = 'font-size:11px;color:var(--text-sub);white-space:nowrap;';
    tally.textContent = this._t('cats_count', '{n} items')
      .replace('{n}', String(spec.count));
    row.appendChild(tally);

    const bin = document.createElement('button');
    bin.className = 'action-btn btn-danger';
    bin.type = 'button';
    // Always visible: this panel is used on phones and tablets where there is
    // no hover to reveal anything (RULE 36).
    bin.style.cssText = 'flex-shrink:0;display:flex;align-items:center;'
      + 'justify-content:center;min-width:40px;min-height:40px;';
    bin.title = this._t('delete', 'Delete');
    bin.innerHTML = ICONS.delete;
    bin.onclick = () => {
      this.catDeleteFor = this.catDeleteFor === spec.key ? null : spec.key;
      this.renderCategoriesScreen();
    };
    row.appendChild(bin);
    wrap.appendChild(row);

    if (this.catDeleteFor === spec.key) {
      wrap.appendChild(this.buildCategoryDeletePanel(spec));
    }
    return wrap;
  }

  // ------------------------------------------------------------------
  // Where the items go, and the confirmation.
  //
  // A panel rather than a popup, which is what the box page settled on: a
  // popup over a scrollable list on a phone covers the thing it is asking
  // about.
  //
  // The row being deleted is removed from its own destination list. Offering
  // it would produce the "same" refusal from the backend, and a control whose
  // only effect is an error should not be drawn.
  // ------------------------------------------------------------------
  buildCategoryDeletePanel(spec) {
    const panel = document.createElement('div');
    panel.style.cssText = 'display:flex;flex-direction:column;gap:6px;'
      + 'padding:8px;border-radius:8px;background:var(--bg-input-edit);';

    const warn = document.createElement('div');
    warn.style.cssText = 'font-size:11px;color:var(--text-sub);';
    warn.textContent = this._t(
      'cats_warn', '{n} item(s) will be re-filed. No item is deleted.')
      .replace('{n}', String(spec.count));
    panel.appendChild(warn);

    const label = document.createElement('div');
    label.style.cssText = 'font-size:11px;color:var(--text-sub);';
    label.textContent = this._t('cats_move_to', 'Move its items to');
    panel.appendChild(label);

    const pickers = document.createElement('div');
    pickers.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

    // A top-level delete takes the whole category away, so it cannot be the
    // destination of itself; a sub-category delete can stay inside its own
    // category.
    const destCats = Object.keys(spec.cats).filter(
      c => spec.sub ? true : c !== spec.category);

    const mainSel = document.createElement('select');
    mainSel.className = 'move-select';
    mainSel.style.cssText = 'flex:1;min-width:0;';
    mainSel.innerHTML = categorySelectOptions({
      names: destCats,
      current: '',
      placeholder: this._t('cats_leave', 'Leave uncategorised'),
      translate: (k, d) => this._t(k, d),
      keyPrefix: 'cat_',
    });
    pickers.appendChild(mainSel);

    const subSel = document.createElement('select');
    subSel.className = 'move-select';
    subSel.style.cssText = 'flex:1;min-width:0;';
    pickers.appendChild(subSel);

    // The sub list follows the category, and leaves out the row being deleted
    // for the same reason as above.
    const fillSubs = () => {
      const chosen = mainSel.value;
      const subs = Object.keys((spec.cats[chosen] || {})).filter(
        s => !(spec.sub && chosen === spec.category && s === spec.sub));
      subSel.innerHTML = categorySelectOptions({
        names: subs,
        current: '',
        placeholder: this._t('select_sub', 'Sub-Category'),
        translate: (k, d) => this._t(k, d),
        keyPrefix: 'sub_',
      });
      subSel.disabled = !chosen;
    };
    mainSel.onchange = fillSubs;
    fillSubs();

    panel.appendChild(pickers);

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:6px;';
    const cancel = document.createElement('button');
    cancel.className = 'action-btn';
    cancel.type = 'button';
    cancel.style.cssText = 'flex:1;min-height:40px;';
    cancel.textContent = this._t('cancel', 'Cancel');
    cancel.onclick = () => {
      this.catDeleteFor = null;
      this.renderCategoriesScreen();
    };
    const go = document.createElement('button');
    go.className = 'action-btn btn-danger';
    go.type = 'button';
    go.style.cssText = 'flex:1;min-height:40px;';
    go.textContent = this._t('delete', 'Delete');
    go.onclick = () => this.deleteCategory(
      spec.category, spec.sub, mainSel.value, subSel.value, spec.count);
    bar.appendChild(cancel);
    bar.appendChild(go);
    panel.appendChild(bar);

    return panel;
  }

  // ------------------------------------------------------------------
  // The call.
  //
  // Success is read from the DATA, not from the reply. callHA wraps
  // hass.callService, which resolves without the handler's return value, so
  // the dict delete_category returns never reaches this side - it is there for
  // the log and for the suites that call the handler directly. If the label is
  // gone after the refetch then it is gone; anything else is reported as "
  // nothing was changed", which is honest either way (RULE 2, RULE 10).
  //
  // The count comes from the screen's own figure for that row - the same
  // number the confirmation showed - rather than from the reply it cannot
  // read.
  // ------------------------------------------------------------------
  async deleteCategory(category, sub, toCategory, toSub, count) {
    const payload = { category };
    if (sub) payload.sub_category = sub;
    if (toCategory) payload.to_category = toCategory;
    if (toCategory && toSub) payload.to_sub_category = toSub;

    try {
      await this.callHA('delete_category', payload);
    } catch (e) {
      console.error(e);
    }
    this.catDeleteFor = null;

    await this.fetchData();
    const stillThere = sub
      ? !!(this.categories || {})[category]?.[sub]
      : !!(this.categories || {})[category];
    this.toastCategories(stillThere
      ? this._t('cats_refused', 'Nothing was changed.')
      : this._t('cats_done', 'Removed. {n} item(s) re-filed.')
          .replace('{n}', String(Number(count) || 0)));
    this.renderCategoriesScreen();
  }

  // A line at the top of the card. Deliberately not an alert(): the screen
  // stays open so the next junk category can be dealt with straight away.
  toastCategories(text) {
    this.catToast = String(text || '');
    const card = this.shadowRoot.querySelector('#categories-modal .modal-content');
    if (!card) return;
    let line = card.querySelector('.cats-toast');
    if (!line) {
      line = document.createElement('div');
      line.className = 'cats-toast';
      line.style.cssText = 'font-size:12px;color:var(--primary);text-align:center;';
      card.insertBefore(line, card.children[1] || null);
    }
    line.textContent = this.catToast;
  }
};
