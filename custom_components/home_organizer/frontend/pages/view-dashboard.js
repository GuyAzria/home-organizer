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
// [MODIFIED v2026.9.22 | 2026-09-22] Purpose: The sections are grid AREAS
//   rather than a stack, and the year total is built as a hero figure -
//   two elements, so the currency code sits small beside a large number.
//   renderDashboardView names each section so the stylesheet can place it,
//   and gives the attention band the whole row when nothing went up in
//   price, because an empty half reads as a card that failed to load.
// [MODIFIED v2026.9.22 | 2026-09-22] Purpose: The chart is a YEAR, twelve
//   columns, with the month we are living in drawn in a second colour and a
//   legend that says which is which. A month on its own was a single number
//   with nothing to compare it against: the first house to open this screen
//   had ten receipts on file, nine of them in other months, and saw one bar.
//   The year is chosen from a picker built only from years that HAVE
//   receipts, and the topic breakdown under the chart answers to the same
//   picker, because it sits directly beneath that year's total.

import { ICONS } from '../organizer-icon.js?v=10.11.80';

// THE CHART'S TWO COLOURS, AS TOKENS RATHER THAN HEX.
//
// A colour that clears 3:1 against the white card cannot also clear it
// against the near-black one - the two requirements pull in opposite
// directions - so the panel cannot have one value per series. These are
// defined twice in dashboard.css, once under :host and once under
// .light-mode, and each pair was checked against its own surface rather
// than one being a lightened copy of the other.
//
// Blue against orange on purpose: it is the pair that survives both common
// kinds of colour blindness, which matters here because the legend makes
// the colour carry meaning rather than decoration.
const C_BAR = 'var(--dash-bar)';
const C_NOW = 'var(--dash-bar-now)';

export const DashboardMixin = (Base) => class extends Base {

  // Fetched once per visit. The dashboard is about the house, not about the
  // shelf in front of you, so it does not ride on get_data - which fires on
  // every navigation.
  //
  // [MODIFIED v2026.9.22] A year can be asked for. The cache is keyed on
  // the year that came BACK rather than the one that was asked for: the
  // backend clamps, and a picker sitting on a year the data is not from is
  // how a chart ends up labelled with the wrong total.
  async loadDashboard(force, year) {
    if (this.dashboardBusy) return;
    const want = Number(year) || 0;
    if (this.dashboardData && !force && (!want || want === this.dashboardYear))
      return;
    this.dashboardBusy = true;
    // Held while the request is in flight so the picker does not snap back
    // to the old year for the moment before the answer arrives.
    if (want) this.dashboardYear = want;
    try {
      const msg = { type: 'home_organizer/dashboard' };
      if (want) msg.year = want;
      const res = await this._hass.callWS(msg);
      this.dashboardData = (res && !res.error) ? res : null;
      this.dashboardError = (res && res.error) ? String(res.error) : null;
      if (this.dashboardData && this.dashboardData.year)
        this.dashboardYear = Number(this.dashboardData.year);
    } catch (e) {
      console.error(e);
      this.dashboardData = null;
      this.dashboardError = (e && e.message) ? e.message : String(e);
    }
    this.dashboardBusy = false;
    this.render();
  }

  // Money as the user writes it. No conversion anywhere - the currency code
  // is shown beside the number so two of them can never look like one.
  fmtMoney(n) {
    const v = Number(n) || 0;
    return Math.round(v).toLocaleString(this.localeTag());
  }

  // The code after the number, or nothing. A house with no currency set
  // should not get a stray space where the code would have been.
  curSuffix(cur) {
    return cur ? ' ' + cur : '';
  }

  // The currency most of the month's money is in. Everything else is listed
  // separately rather than folded in.
  dominantCurrency(rows) {
    const by = {};
    (rows || []).forEach(r => {
      const c = r.cur || '';
      by[c] = (by[c] || 0) + (Number(r.total) || 0);
    });
    const names = Object.keys(by);
    if (!names.length) return '';
    return names.sort((a, b) => by[b] - by[a])[0];
  }

  renderDashboardView(content) {
    content.style.padding = '0';
    content.style.display = 'block';
    if (!this.dashboardData && !this.dashboardBusy) this.loadDashboard();

    const wrap = document.createElement('div');
    wrap.className = 'dash-wrap';
    if (this.dashboardBusy && !this.dashboardData) {
      const l = document.createElement('div');
      l.className = 'dash-empty';
      l.textContent = this._t('loading', 'Loading...');
      wrap.appendChild(l);
      content.appendChild(wrap);
      return;
    }
    // [FIXED v2026.9.22] A failed load said nothing at all. The error was
    // caught and stored and then never read by anything, so a dashboard
    // that could not be built came up as a blank screen with no way to
    // tell that from a house with no receipts in it.
    if (!this.dashboardData && this.dashboardError) {
      const e = document.createElement('div');
      e.className = 'dash-empty';
      e.textContent = this._t('error', 'Error') + ': ' + this.dashboardError;
      wrap.appendChild(e);
      content.appendChild(wrap);
      return;
    }
    // [MODIFIED v2026.9.22] The sections are grid AREAS, not a stack.
    //
    // This was one column at any width, which is a phone screen shown on a
    // desktop monitor: the chart went very wide and very short and the
    // eight tiles became one thin strip. Each section now claims a named
    // span and the stylesheet decides how many columns exist at this width.
    const d = this.dashboardData || {};
    const spend = this.dashSpendSection(d);
    spend.classList.add('area-spend');
    wrap.appendChild(spend);
    const tiles = this.dashTilesSection(d);
    tiles.classList.add('area-tiles');
    wrap.appendChild(tiles);
    const attention = this.dashAttentionSection(d);
    attention.classList.add('area-attention');
    wrap.appendChild(attention);
    const prices = this.dashPriceSection(d);
    if (prices) {
      prices.classList.add('area-prices');
      wrap.appendChild(prices);
    } else {
      // Nothing went up in price, so the band beside it takes the whole
      // row rather than leaving a hole where a card would have been.
      attention.classList.add('alone');
    }
    const nav = this.dashNavSection();
    nav.classList.add('area-nav');
    wrap.appendChild(nav);
    content.appendChild(wrap);
  }

  // ---- 1. what the house spent, as columns -------------------------------
  //
  // Twelve columns, one calendar year, and the current month in the second
  // colour. The card holds one chart and one breakdown, and BOTH of them
  // answer to the year picker in its header - a topic list that quietly
  // stayed on "this month" would sit directly under a year total and be
  // read as its breakdown.
  dashSpendSection(d) {
    const box = document.createElement('section');
    box.className = 'dash-card';
    const months = d.year_months || [];
    const year = Number(d.year) || new Date().getFullYear();
    const nowYm = String(d.month || '');

    // The currency is decided by the YEAR's receipts, so the chart and the
    // breakdown under it can never end up counting in different money.
    const cur = this.dominantCurrency(months);
    const mainM = months.filter(r => (r.cur || '') === cur);
    const otherM = months.filter(r => (r.cur || '') !== cur);
    const total = mainM.reduce((a, r) => a + (Number(r.total) || 0), 0);

    const head = document.createElement('div');
    head.className = 'dash-head';
    const left = document.createElement('div');
    left.className = 'dash-head-l';
    const t1 = document.createElement('span');
    t1.className = 'dash-title';
    t1.textContent = this._t('dash_spend_year', 'Spending by month');
    left.appendChild(t1);
    // Appended BEFORE the early return below: a year with no receipts is
    // exactly the year the user most needs the picker to get back out of.
    left.appendChild(this.dashYearPicker(d, year));
    // THE hero figure, and the only one on this screen. Two elements, so
    // the currency can be set small beside a large number instead of
    // doubling its width - and so the figure itself can use the font's
    // proportional digits, which tabular-nums would widen into a gappy row
    // of zero-width slots at this size.
    const t2 = document.createElement('span');
    t2.className = 'dash-total';
    const amount = document.createElement('span');
    amount.className = 'dash-total-n';
    amount.textContent = this.fmtMoney(total);
    t2.appendChild(amount);
    if (cur) {
      const code = document.createElement('span');
      code.className = 'dash-total-c';
      code.textContent = cur;
      t2.appendChild(code);
    }
    head.appendChild(left); head.appendChild(t2);
    box.appendChild(head);

    if (!mainM.length) {
      const e = document.createElement('div');
      e.className = 'dash-empty';
      e.textContent = this._t('dash_no_spend_year',
                              'No receipts recorded in this year.');
      box.appendChild(e);
      // Also on the empty branch, and this is where it matters most: a year
      // whose receipts are ALL sitting unconfirmed looks like a year with
      // no receipts at all, which is the most misleading screen this card
      // can draw.
      const emptyGap = this.dashUncountedLine(d, cur);
      if (emptyGap) box.appendChild(emptyGap);
      return box;
    }

    // Twelve cells whatever comes back. A year with three receipts in it
    // still has to LOOK like a year: collapsing to three columns is what
    // made ten receipts read as a single number with no chart at all.
    const byYm = {};
    mainM.forEach(r => {
      byYm[r.ym] = (byYm[r.ym] || 0) + (Number(r.total) || 0);
    });
    const cells = [];
    for (let m = 0; m < 12; m++) {
      const ym = year + '-' + String(m + 1).padStart(2, '0');
      cells.push({ ym: ym, m: m, v: byYm[ym] || 0, now: ym === nowYm });
    }
    const peak = cells.reduce((a, c) => Math.max(a, c.v), 0) || 1;
    const nowCell = cells.filter(c => c.now)[0] || null;

    // The axis on the side carries the scale; the columns worth reading
    // carry their own exact number. Not all twelve: a number over every
    // column is twelve numbers, and then none of them is read.
    const chart = document.createElement('div');
    chart.className = 'dash-chart';
    const axis = document.createElement('div');
    axis.className = 'dash-axis';
    [peak, peak * 0.66, peak * 0.33, 0].forEach(v => {
      const s = document.createElement('span');
      s.textContent = this.fmtMoney(v);
      axis.appendChild(s);
    });
    const plot = document.createElement('div');
    plot.className = 'dash-plot';
    cells.forEach(c => {
      const name = this.monthName(c.m);
      const col = document.createElement('div');
      col.className = 'dash-col'
        + (c.now ? ' now' : '')
        + ((c.now || (c.v > 0 && c.v === peak)) ? ' key' : '');
      // Two ways to the exact number, because one of them is a hover and
      // half this panel's users are on a phone (RULE 36). The title serves
      // a mouse; the tap below reveals the printed value in place.
      col.title = name + '  ' + this.fmtMoney(c.v) + this.curSuffix(cur);
      col.onclick = () => col.classList.toggle('key');
      const val = document.createElement('span');
      val.className = 'dash-col-val';
      val.textContent = this.fmtMoney(c.v);
      const track = document.createElement('div');
      track.className = 'dash-col-track';
      // A month with nothing in it gets no bar at all, not a stub. The
      // minimum height exists so a small month still shows; a month with
      // no receipts is not small, it is absent.
      if (c.v > 0) {
        const bar = document.createElement('div');
        bar.className = 'dash-col-bar';
        bar.style.height = Math.max(2, Math.round(c.v / peak * 100)) + '%';
        bar.style.background = c.now ? C_NOW : C_BAR;
        track.appendChild(bar);
      }
      // Two labels, one hidden by width. Twelve month names do not fit
      // across a phone in any language, and a number does.
      const lab = document.createElement('span');
      lab.className = 'dash-col-label';
      const long = document.createElement('span');
      long.className = 'dash-m-long';
      long.textContent = name;
      const short = document.createElement('span');
      short.className = 'dash-m-short';
      short.textContent = String(c.m + 1);
      lab.appendChild(long); lab.appendChild(short);
      col.appendChild(val); col.appendChild(track); col.appendChild(lab);
      plot.appendChild(col);
    });
    // Plot first, axis second, and the chart forces direction: ltr - so the
    // numbers sit on the RIGHT in both languages. Everything else on this
    // screen follows the reading direction; a scale does not, because it is
    // read against the columns beside it and not as a sentence.
    chart.appendChild(plot); chart.appendChild(axis);
    box.appendChild(chart);

    // The legend. Two colours mean two entries - and the second one is only
    // true when the year on show actually contains the current month, so a
    // past year does not get a key to a colour that is not on its chart.
    const legend = document.createElement('div');
    legend.className = 'dash-legend';
    legend.appendChild(this.dashLegendItem(
      C_BAR, this._t('dash_legend_month', 'Monthly total')));
    if (nowCell) {
      legend.appendChild(this.dashLegendItem(
        C_NOW, this._t('dash_legend_now', 'Current month') + '  '
               + this.fmtMoney(nowCell.v) + this.curSuffix(cur)));
    }
    box.appendChild(legend);

    const topics = this.dashTopicList(d.spend || [], cur);
    if (topics) box.appendChild(topics);

    const gap = this.dashUncountedLine(d, cur);
    if (gap) box.appendChild(gap);

    // Summed per currency before it is printed. Over a year the same
    // foreign currency turns up in several months, and listing one line
    // per month would read as several separate trips.
    if (otherM.length) {
      const agg = {};
      otherM.forEach(r => {
        const k = r.cur || '?';
        agg[k] = (agg[k] || 0) + (Number(r.total) || 0);
      });
      const o = document.createElement('div');
      o.className = 'dash-other-cur';
      o.textContent = Object.keys(agg)
        .map(k => this.fmtMoney(agg[k]) + ' ' + k).join('   ');
      box.appendChild(o);
    }
    return box;
  }

  // [ADDED v2026.9.22] The money this chart is NOT showing.
  //
  // A user added up the receipts in the archive, compared it with the total
  // on this card, found 74.33 missing and had nowhere to look. Both gaps
  // are deliberate - a draft is money nobody has confirmed a line of, and a
  // receipt with no readable date belongs to no year - but a total that
  // silently disagrees with what the user can count teaches them not to
  // trust the screen.
  //
  // It is a button, because the answer to "what is missing" is a list of
  // receipts, and the review queue is where they are.
  dashUncountedLine(d, cur) {
    // On the empty branch there are no active receipts to name a currency,
    // so the unconfirmed ones name it themselves. Without this, a year
    // whose every receipt is a draft reports nothing missing.
    const use = cur || this.dominantCurrency(d.uncounted || []);
    const rows = (d.uncounted || []).filter(r => (r.cur || '') === use);
    const amount = rows.reduce((a, r) => a + (Number(r.total) || 0), 0);
    const n = rows.reduce((a, r) => a + (Number(r.n) || 0), 0);
    const undated = Number(d.undated) || 0;
    if (!n && !undated) return null;

    const line = document.createElement('button');
    line.type = 'button';
    line.className = 'dash-gap';
    const parts = [];
    if (n) {
      parts.push(this.fmtMoney(amount) + this.curSuffix(use) + ' '
        + this._t('dash_gap_review', 'awaiting review') + ' (' + n + ')');
    }
    if (undated) {
      parts.push(undated + ' '
        + this._t('dash_gap_undated', 'with no date'));
    }
    line.textContent = this._t('dash_gap', 'Not counted here') + ': '
      + parts.join('  ·  ');
    // The archive, not the review queue: it is the one screen that lists
    // BOTH an unconfirmed receipt and a receipt with no date, and it is
    // also where either can be put right.
    line.onclick = () => this.dashGoto('receipts');
    return line;
  }

  // A month's short name in the panel's language. Any year would do for the
  // lookup; a fixed one keeps it from depending on today. UTC on both sides
  // so a timezone behind the line cannot roll it back to December.
  monthName(m) {
    try {
      return new Date(Date.UTC(2020, m, 1)).toLocaleDateString(
        this.localeTag(), { month: 'short', timeZone: 'UTC' });
    } catch (e) {
      return String(m + 1);
    }
  }

  // The year picker. A dropdown rather than back/forward arrows: an arrow
  // has to point somewhere, and "earlier" points the other way in Hebrew -
  // a dropdown of years reads the same in both and shows at a glance how
  // far back the receipts go.
  //
  // Built only from years that HAVE receipts, plus the current one, so the
  // list can never strand the user on an empty screen.
  dashYearPicker(d, current) {
    const years = (Array.isArray(d.years) ? d.years.slice() : [])
      .map(Number).filter(y => y > 0);
    if (years.indexOf(Number(current)) === -1) years.push(Number(current));
    years.sort((a, b) => b - a);
    const sel = document.createElement('select');
    sel.className = 'dash-year';
    sel.title = this._t('dash_year', 'Year');
    years.forEach(y => {
      const o = document.createElement('option');
      o.value = String(y);
      o.textContent = String(y);
      if (Number(y) === Number(current)) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => this.loadDashboard(true, Number(sel.value));
    return sel;
  }

  dashLegendItem(colour, text) {
    const w = document.createElement('span');
    w.className = 'dash-legend-item';
    const sw = document.createElement('span');
    sw.className = 'dash-legend-sw';
    sw.style.background = colour;
    const tx = document.createElement('span');
    tx.textContent = text;
    w.appendChild(sw); w.appendChild(tx);
    return w;
  }

  // What the year went ON, under the chart that says WHEN it went.
  //
  // A list and not a second chart: the card already has one scale on it,
  // and a second set of columns beside the first invites the two to be read
  // against each other when they measure different things. The bar in each
  // row is a share of the rows above and below it, which needs no axis.
  //
  // One hue, not one per topic. Length is the measurement here; a colour
  // per topic would be a second code to learn for information the name
  // already carries, and eight of them have to stay apart for a
  // colour-blind reader as well.
  // What to call a row. Three kinds, three vocabularies, and they are NOT
  // interchangeable: an item category is one of the shelves in this house
  // and translates through cat_ keys; a service bucket is a kind of
  // spending and translates through exp_ keys. Borrowing one key for the
  // other context is the mistake RULE 33a.7 is about.
  topicName(r) {
    const key = String(r.cat || '').replace(/[^a-zA-Z0-9]+/g, '_');
    if (r.kind === 'diff') {
      return this._t('dash_topic_diff', 'Discounts and rounding');
    }
    if (r.kind === 'manual') {
      return this._t('dash_topic_manual', 'Items with no receipt');
    }
    if (!key) return this._t('dash_untagged', 'Untagged');
    if (r.kind === 'service') return this._t('exp_' + key, r.cat);
    return this._t('cat_' + key, r.cat);
  }

  dashTopicList(rows, cur) {
    const main = (rows || []).filter(r => (r.cur || '') === cur);
    if (!main.length) return null;
    // Two kinds of row are NOT categories and are kept out of the
    // denominator: the remainder, which is what the shopping did not
    // account for, and the items with no receipt, which are not in the
    // chart's total at all. Counting either in would shrink every genuine
    // category to make room for something that is not shopping.
    //
    // The remainder can also be NEGATIVE, when a line was read without its
    // discount and the products add up to more than was actually paid -
    // the case that started all of this.
    const TAIL = ['diff', 'manual'];
    const spend = main.filter(r => TAIL.indexOf(r.kind) === -1);
    const total = spend.reduce((a, r) => a + (Number(r.total) || 0), 0) || 1;
    const list = document.createElement('div');
    list.className = 'dash-topics';
    const cap = document.createElement('div');
    cap.className = 'dash-topics-cap';
    cap.textContent = this._t('dash_by_topic', 'By topic');
    list.appendChild(cap);
    main.forEach(r => {
      const isDiff = r.kind === 'diff';
      const isTail = TAIL.indexOf(r.kind) !== -1;
      const row = document.createElement('div');
      row.className = 'dash-topic' + (isTail ? ' ' + r.kind : '');
      const nm = document.createElement('span');
      nm.className = 'dash-topic-name';
      nm.textContent = this.topicName(r);
      // The count, on the row it belongs to. "Items with no receipt" is a
      // number the user can go and check; the remainder is not.
      if (r.kind === 'manual' && Number(r.n) > 0) {
        const c = document.createElement('span');
        c.className = 'dash-topic-n';
        c.textContent = '(' + Number(r.n) + ')';
        nm.appendChild(c);
      }
      const track = document.createElement('span');
      track.className = 'dash-topic-track';
      // No bar on either tail row: a share bar claims a proportion of the
      // rows around it, and neither of these is one of them.
      if (!isTail) {
        const fill = document.createElement('span');
        fill.className = 'dash-topic-fill';
        fill.style.width =
          Math.max(2, Math.round((Number(r.total) || 0) / total * 100)) + '%';
        track.appendChild(fill);
      }
      const amt = document.createElement('span');
      amt.className = 'dash-topic-amt';
      const v = Number(r.total) || 0;
      // The sign is printed, not implied. "-74" and "74" on a remainder row
      // mean opposite things: money the receipt saved, or money the product
      // lines invented.
      amt.textContent = (isDiff && v > 0 ? '+' : '')
        + this.fmtMoney(v) + this.curSuffix(cur);
      row.appendChild(nm); row.appendChild(track); row.appendChild(amt);
      list.appendChild(row);
    });
    return list;
  }

  // ---- 2. the tiles ------------------------------------------------------
  //
  // A tile is a way in, not an ornament: every one of them goes somewhere.
  dashTilesSection(d) {
    const grid = document.createElement('section');
    grid.className = 'dash-tiles';
    const c = d.counts || {};
    const byCat = c.by_category || {};
    const rec = d.recipes || {};
    const expiring = (d.expiring || []).length;
    const n = k => Number(byCat[k] || 0);

    [['items', c.items || 0, this._t('dash_items', 'Items'), 'locations'],
     ['food', n('Food'), this._t('cat_Food', 'Food'), 'locations'],
     ['cosm', n('Cosmetics') + n('Toiletries'),
      this._t('dash_cosmetics', 'Cosmetics'), 'locations'],
     ['med', n('First Aid'), this._t('cat_First_Aid', 'First Aid'), 'locations'],
     ['rec', rec.count || 0, this._t('recipes_title', 'Recipes'), 'recipes'],
     ['inv', c.receipts || 0, this._t('receipts_tab', 'Receipts'), 'receipts'],
     ['oos', c.out_of_stock || 0, this._t('dash_out_of_stock', 'Out of stock'), 'shop'],
     ['exp', expiring, this._t('dash_expiring', 'Expiring soon'), 'expiry'],
    ].forEach(entry => {
      const key = entry[0], value = entry[1], label = entry[2], go = entry[3];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'dash-tile' + (key === 'exp' && expiring ? ' warn' : '');
      const a = document.createElement('span');
      a.className = 'dash-tile-n';
      a.textContent = String(value);
      const b = document.createElement('span');
      b.className = 'dash-tile-l';
      b.textContent = label;
      el.appendChild(a); el.appendChild(b);
      el.onclick = () => (go === 'expiry' ? this.showExpiringList()
                                          : this.dashGoto(go));
      grid.appendChild(el);
    });
    return grid;
  }

  // The expiry tile opens its list here rather than navigating: its whole
  // value is the names and the shelves they sit on, and that is two lines of
  // data, not a screen.
  showExpiringList() {
    const rows = (this.dashboardData && this.dashboardData.expiring) || [];
    const ov = this.shadowRoot.getElementById('dash-list-overlay');
    const body = this.shadowRoot.getElementById('dash-list-body');
    const title = this.shadowRoot.getElementById('dash-list-title');
    if (!ov || !body || !title) return;
    title.textContent = this._t('dash_expiring', 'Expiring soon');
    body.innerHTML = '';
    if (!rows.length) {
      const e = document.createElement('div');
      e.className = 'dash-empty';
      e.textContent = this._t('dash_nothing_expiring', 'Nothing expiring soon.');
      body.appendChild(e);
    } else {
      rows.forEach(r => {
        const row = document.createElement('div');
        row.className = 'dash-row';
        const nm = document.createElement('span');
        nm.className = 'dash-row-name';
        nm.textContent = r.name || '';
        const lc = document.createElement('span');
        lc.className = 'dash-row-loc';
        lc.textContent = r.location || '';
        const dt = document.createElement('span');
        dt.className = 'dash-row-date';
        dt.textContent = r.expiry_date || '';
        row.appendChild(nm); row.appendChild(lc); row.appendChild(dt);
        body.appendChild(row);
      });
    }
    ov.style.display = 'flex';
  }

  // ---- 3. what needs doing -----------------------------------------------
  //
  // The only band on this screen that changes every day. Counts and recipes
  // barely move; these four do, and each one is a thing that is wrong right
  // now and can be put right from here.
  //
  // Zeroes are not drawn. A row of noughts trains the eye to skip the band,
  // and then the one that is not a nought gets skipped with it.
  dashAttentionSection(d) {
    const c = d.counts || {};
    const chips = [
      ['expiry', (d.expiring || []).length,
       this._t('dash_expiring', 'Expiring soon'), true],
      ['review', c.pending || 0,
       this._t('dash_awaiting', 'Awaiting review'), true],
      ['shop', c.out_of_stock || 0,
       this._t('dash_out_of_stock', 'Out of stock'), false],
      ['list', c.shopping || 0,
       this._t('shopping_list', 'Shopping List'), false],
    ].filter(x => Number(x[1]) > 0);

    const box = document.createElement('section');
    box.className = 'dash-card';
    const head = document.createElement('div');
    head.className = 'dash-head';
    const t = document.createElement('span');
    t.className = 'dash-title';
    t.textContent = this._t('dash_attention', 'Needs attention');
    head.appendChild(t);
    box.appendChild(head);

    if (!chips.length) {
      const calm = document.createElement('div');
      calm.className = 'dash-empty';
      calm.textContent = this._t('dash_all_clear', 'Nothing needs attention.');
      box.appendChild(calm);
      return box;
    }
    const strip = document.createElement('div');
    strip.className = 'dash-quick';
    chips.forEach(entry => {
      const go = entry[0], n = entry[1], label = entry[2], urgent = entry[3];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dash-chip' + (urgent ? ' urgent' : '');
      const ct = document.createElement('span');
      ct.className = 'dash-chip-n';
      ct.textContent = String(n);
      const nm = document.createElement('span');
      nm.className = 'dash-chip-l';
      nm.textContent = label;
      b.appendChild(ct); b.appendChild(nm);
      b.onclick = () => (go === 'expiry' ? this.showExpiringList()
                                         : this.dashGoto(go === 'review' ? 'review' : 'shop'));
      strip.appendChild(b);
    });
    box.appendChild(strip);
    return box;
  }

  // ---- 4. what got more expensive ----------------------------------------
  //
  // Per PRODUCT, from purchase_history - the same jar of coffee against
  // itself. A holiday cannot appear here: a service receipt writes no
  // product lines, so one trip at 6,000 and another at 9,000 are two
  // purchases and not a price rise, and they are not in the table at all.
  dashPriceSection(d) {
    const rows = d.price_watch || [];
    if (!rows.length) return null;
    const box = document.createElement('section');
    box.className = 'dash-card';
    const head = document.createElement('div');
    head.className = 'dash-head';
    const t = document.createElement('span');
    t.className = 'dash-title';
    t.textContent = this._t('dash_price_up', 'Went up in price');
    head.appendChild(t);
    box.appendChild(head);
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'dash-price';
      const nm = document.createElement('span');
      nm.className = 'dash-price-name';
      nm.textContent = r.name || '';
      const was = document.createElement('span');
      was.className = 'dash-price-was';
      was.textContent = this.fmtMoney(r.was_price) + ' ' + (r.cur || '');
      const now = document.createElement('span');
      now.className = 'dash-price-now';
      now.textContent = this.fmtMoney(r.now_price) + ' ' + (r.cur || '');
      const pct = document.createElement('span');
      pct.className = 'dash-price-pct';
      pct.textContent = '+' + Math.round(Number(r.pct) || 0) + '%';
      row.appendChild(nm); row.appendChild(was); row.appendChild(now);
      row.appendChild(pct);
      box.appendChild(row);
    });
    return box;
  }

  // ---- 4. the way to everywhere else -------------------------------------
  dashNavSection() {
    const box = document.createElement('section');
    box.className = 'dash-nav';
    const first = document.createElement('div');
    first.className = 'dash-nav-first';
    first.appendChild(this.dashNavBtn('locations', ICONS.home,
      this._t('locations', 'Locations'), true));
    box.appendChild(first);
    const rest = document.createElement('div');
    rest.className = 'dash-nav-rest';
    [['receipts', ICONS.paste, this._t('receipts_tab', 'Receipts')],
     ['recipes', ICONS.item, this._t('recipes_title', 'Recipes')],
     ['search', ICONS.search, this._t('search_placeholder', 'Search')],
     ['barcode', ICONS.barcode, this._t('barcode_scanner', 'Barcode Scanner')],
     ['shop', ICONS.cart, this._t('shopping_list', 'Shopping List')],
     ['stylist', ICONS.image, this._t('stylist', 'Stylist')],
    ].forEach(e => rest.appendChild(this.dashNavBtn(e[0], e[1], e[2])));
    box.appendChild(rest);
    return box;
  }

  dashNavBtn(go, icon, label, wide) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dash-nav-btn' + (wide ? ' wide' : '');
    const i = document.createElement('span');
    i.className = 'dash-nav-icon';
    // A shipped icon from organizer-icon.js, never anything from the
    // database - this is the one place markup is assigned here (RULE 15).
    i.innerHTML = icon || '';
    const l = document.createElement('span');
    l.className = 'dash-nav-label';
    l.textContent = label;
    b.appendChild(i); b.appendChild(l);
    b.onclick = () => this.dashGoto(go);
    return b;
  }

  // EVERY destination clears EVERY mode before setting its own. A view flag
  // left on wins the next render and lands the user where they did not ask
  // to be; that has shipped three times in this panel (RULE 33a.1).
  dashGoto(go) {
    this.isDashboardMode = false; this.isShopMode = false; this.isSearch = false;
    this.isChatMode = false; this.isStylistMode = false; this.isReviewMode = false;
    this.isBarcodeMode = false; this.isReceiptsMode = false;
    this.isRecipesMode = false; this.isEditMode = false;
    if (go === 'shop') this.isShopMode = true;
    else if (go === 'search') this.isSearch = true;
    else if (go === 'recipes') this.isRecipesMode = true;
    else if (go === 'receipts') this.isReceiptsMode = true;
    else if (go === 'barcode') this.isBarcodeMode = true;
    else if (go === 'stylist') this.isStylistMode = true;
    // The review queue is the receipts screen with its first tab open. It is
    // where the "awaiting review" chip has to land: those items are the ones
    // that are in no total anywhere until somebody approves them.
    else if (go === 'review') this.isReviewMode = true;
    this.clearSearchInput();
    if (go === 'locations') { this.navigate('root'); return; }
    this.fetchData();
    this.render();
  }

};
