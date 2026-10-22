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
// [MODIFIED v2026.10.9 | 2026-10-09] Purpose: the year is ONE wave, not
//   twelve bars.
//
//   This is the change the file header warned about - "THE CHART IS DIVS,
//   NOT AN SVG ... nothing is positioned by coordinate, so it resizes
//   without arithmetic". A smooth curve through twelve points IS
//   coordinates. Asked for twice, with a reference image the second time.
//
//   IT STILL RESIZES WITHOUT ARITHMETIC. The viewBox is 0..100 in both
//   axes and preserveAspectRatio is none, so the browser stretches it and
//   nothing is measured or recomputed - no resize handler, no observer.
//   vector-effect exempts the stroke, which would otherwise come out thick
//   on a wide screen and a hairline on a narrow one.
//
//   MONOTONE CUBIC, AND FLAT AT EVERY TURNING POINT. A spline through
//   data is a claim about the values BETWEEN the points, and a careless
//   one overshoots: measured on the real year, 0, 355, 96, 0, 0, 0, 0,
//   1688, 1857, 642, 0, 0, the September peak was drawn 1.58% above the
//   top of the chart and a 0, 900, 0 run dipped 0.28% BELOW the baseline -
//   money that was never spent. Fritsch-Carlson limits each tangent, and
//   zeroing it at every change of direction is the half that the limiter
//   cannot do on its own. st51 samples the curve and measures this.
//
//   Every month keeps its hit area, its printed value and its label: the
//   columns are still there, they have simply stopped drawing a bar. That
//   is what keeps tap-to-reveal working where there is no hover (RULE 36).
//   The marker is an HTML element and not an SVG circle, because the
//   stretch would make a circle an ellipse whose shape changed with the
//   window - and it is placed from the SAME two numbers the curve is drawn
//   from, so it sits ON the line rather than near it.
//
//   The SVG is assembled with createElementNS. Nothing in it is user text,
//   and a markup string is how that stops being true (RULE 15).
// [ADDED v2026.10.8 | 2026-10-08] Purpose: a breakdown row opens the items
//   behind it.
//
//   "Where the money went" named a category and stopped there. The row is
//   now a button, and openCategoryItems fills localData.items with
//   everything filed under that category so renderSearchView draws it -
//   which means the rows are the real createItemRow and a tap opens the
//   real item editor, not a copy of either (RULE 33a.6, RULE 33d).
//
//   NO NEW MODE FLAG. isFooMode has shipped broken three times here
//   (RULE 33a.1) and isSearch alone is set or cleared in eighteen places.
//   The marker is localData.category_view, and localData is replaced
//   wholesale by fetchData on every navigation, so it cannot outlive the
//   screen and there is nothing to remember to clear.
//
//   THE CATEGORY IS MATCHED AS STORED, never as the translated label. The
//   chart groups purchase_history.category and an item carries
//   items.category; they are the same string. Matching the label would
//   empty the screen the moment a category is renamed (RULE 20).
//
//   Only a row with something behind it is a button: the remainder is an
//   arithmetic residue, the no-receipt row is not a category, and a service
//   bucket is a different vocabulary entirely (see topicName).
//
//   FIXED IN THE SAME RELEASE: the first cut replaced localData with four
//   keys. localData is not just a list of items - `categories` is what the
//   category dropdown reads through its getter, `hierarchy` is what the room
//   and location pickers read - so the editor opened from this screen had an
//   empty dropdown and empty pickers. It now keeps what it was given and
//   replaces only the view, spread rather than copied key by key, because a
//   list of keys is what goes stale when the payload grows a field.

import { ICONS } from '../organizer-icon.js?v=10.11.122';

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
  // [ADDED v2026.9.27] The last answer, kept so opening the tab is instant.
  //
  // Fifteen queries across three tables is not something to wait for when the
  // numbers have not moved, and they only move when a receipt line is
  // approved, an item is added or removed, or a stock or date is edited - all
  // of which fire home_organizer_db_update, which is what clears this.
  //
  // localStorage, not a field, because entering the panel from Home Assistant
  // builds this element again and a field starts empty. Every access is
  // wrapped: storage throws in a private window and can come back empty at
  // any time, and the dashboard has to draw either way.
  dashCacheKey(year) { return `ho_dash_v1_${Number(year) || 0}`; }

  readDashboardCache(year) {
    try {
      const raw = localStorage.getItem(this.dashCacheKey(year));
      if (!raw) return null;
      const data = JSON.parse(raw);
      // An object with no keys is not a dashboard. [] and {} are both truthy,
      // so the shape is checked rather than the value (RULE 33a.4).
      return (data && typeof data === "object" && Object.keys(data).length)
        ? data : null;
    } catch (e) { return null; }
  }

  writeDashboardCache(year, data) {
    try {
      if (!data || typeof data !== "object") return;
      localStorage.setItem(this.dashCacheKey(year), JSON.stringify(data));
    } catch (e) { /* quota or blocked storage - the screen still works */ }
  }

  // Called when the database changes. The stored copy goes, and the check
  // flag is lowered so a dashboard already on screen refreshes behind itself
  // instead of blanking while it waits.
  markDashboardStale() {
    this.dashboardChecked = false;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("ho_dash_v1_")) localStorage.removeItem(k);
      }
    } catch (e) { }
  }

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
      if (this.dashboardData) {
        this.writeDashboardCache(
          Number(this.dashboardData.year) || want, this.dashboardData);
      }
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
    // [MODIFIED v2026.9.27] Draw the stored copy first, check afterwards.
    //
    // Reaching the panel from Home Assistant used to mean waiting for the
    // whole dashboard query before anything appeared. Now the last answer is
    // on screen at once, and one quiet request confirms it - which matters
    // because the database can change while this panel is shut, so the event
    // that clears the cache is not always heard. A differing answer replaces
    // what is drawn; an identical one changes nothing visible.
    if (!this.dashboardData) {
      const cached = this.readDashboardCache(this.dashboardYear);
      if (cached) {
        this.dashboardData = cached;
        if (cached.year) this.dashboardYear = Number(cached.year);
      }
    }
    if (!this.dashboardData && !this.dashboardBusy) {
      this.loadDashboard();
    } else if (this.dashboardData && !this.dashboardChecked && !this.dashboardBusy) {
      // Set BEFORE the call: loadDashboard renders, which returns here.
      this.dashboardChecked = true;
      this.loadDashboard(true);
    }

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
    // [ADDED v2026.10.9] One layer for the markers, given the gridlines'
    // inset so a dot's `bottom` percentage means the same thing as the
    // curve's y. Appended to it inside the loop, so a month can place its
    // own dot while it builds its own column.
    const dots = document.createElement('div');
    dots.className = 'dash-dots';
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
      // [MODIFIED v2026.10.9] No bar. The whole year is one curve now,
      // drawn once across the plot by buildWave; the column survives as
      // the hit area, the printed value and the month label, which is
      // what keeps tap-to-reveal working where there is no hover.
      track.classList.add('is-wave');
      // [ADDED v2026.10.9] The marker, for the months worth finding - the
      // current one and whichever is being read. Positioned from the SAME
      // two numbers the curve is drawn from, so it sits ON the line and
      // not near it: x is the column centre, y is the share of the peak.
      //
      // A month with nothing in it gets no dot. A dot on the baseline
      // would read as a reading taken, and zero spending is the absence
      // of one.
      if (c.v > 0 && (c.now || c.v === peak)) {
        const dot = document.createElement('span');
        dot.className = 'dash-dot' + (c.now ? ' now' : '');
        dot.style.insetInlineStart = ((c.m + 0.5) * (100 / 12)) + '%';
        dot.style.bottom = ((c.v / peak) * 100) + '%';
        dots.appendChild(dot);
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
    // [ADDED v2026.10.9] The curve itself, behind the columns and over
    // the gridlines. Inserted first so the invisible column hit areas stay
    // on top of it and a tap still finds the month and not the path.
    plot.insertBefore(this.buildWave(cells, peak), plot.firstChild);
    plot.appendChild(dots);

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
      // [MODIFIED v2026.10.8] A category row is a way in, like the tiles.
      //
      // A button only for the rows that HAVE something behind them: the
      // remainder is an arithmetic residue and the no-receipt row is not a
      // category, so neither opens anything and neither pretends it can.
      // A service bucket is not an item category either - it is the kind
      // of a whole receipt, a different vocabulary (see topicName) - so it
      // stays a plain row too.
      const canOpen = !isTail && r.kind !== 'service' && !!r.cat;
      const row = document.createElement(canOpen ? 'button' : 'div');
      if (canOpen) {
        row.type = 'button';
        row.title = this._t('dash_topic_open', 'Show the items');
        row.onclick = () => this.openCategoryItems(r.cat);
      }
      row.className = 'dash-topic' + (isTail ? ' ' + r.kind : '')
        + (canOpen ? ' dash-topic-link' : '');
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

  // [ADDED v2026.10.8] Open everything filed under one category.
  //
  // The items come from allDbItems, which the panel already holds and
  // already refreshes on home_organizer_db_update - so this costs no new
  // websocket command, no new query and no seventh row builder.
  //
  // THE CATEGORY IS MATCHED AS IT IS STORED. The chart groups
  // purchase_history.category, and an item carries items.category; they are
  // the same string, so the match is a plain case-insensitive compare and
  // never the translated label. Translating first and matching on that
  // would break the moment the user renames a category, which is the whole
  // family of defects this release is about (RULE 20).
  openCategoryItems(rawCategory, sub) {
    const cat = String(rawCategory || '').trim();
    if (!cat) return;
    const fold = (x) => String(x || '').trim().toLowerCase();
    const mine = (this.allDbItems || []).filter(
      (it) => fold(it.category) === fold(cat));

    // Every sub-category actually present, with its count, in the order
    // they are met. An item with none is collected under its own chip
    // rather than dropped: "no sub-category" is where the awkward ones are,
    // and a filter that cannot reach them hides exactly the rows the user
    // is looking for.
    const subs = [];
    const seen = {};
    mine.forEach((it) => {
      const k = String(it.sub_category || '').trim();
      const key = k.toLowerCase();
      if (!(key in seen)) { seen[key] = { name: k, n: 0 }; subs.push(seen[key]); }
      seen[key].n += 1;
    });

    const want = (sub === undefined || sub === null) ? null : String(sub);
    const items = (want === null) ? mine
      : mine.filter((it) => fold(it.sub_category) === fold(want));

    // One mode, and it is an existing one. See the header of this patch:
    // a flag of its own would have to be cleared in eighteen places.
    this.openBoxId = null;
    this.isDashboardMode = false;
    this.isShopMode = false;
    this.isChatMode = false;
    this.isReviewMode = false;
    this.isReceiptsMode = false;
    this.isStylistMode = false;
    this.isBarcodeMode = false;
    this.isRecipesMode = false;
    this.isEditMode = false;
    this.isSearch = true;

    // Nothing is expanded on the way in: the list is the point, and an
    // editor already open on arrival hides the rows under it.
    this.expandedIdx = null;

    // [FIXED v2026.10.8] KEEP what localData already carries.
    //
    // It is not just a list of items: `categories` is what the category
    // dropdown reads through the getter, `hierarchy` is what the room and
    // location pickers read, `category_counts` is what the categories
    // screen reads. Building a fresh object with four keys emptied every
    // one of them, and the editor opened from this screen had a dropdown
    // with nothing in it.
    //
    // Spread rather than a list of keys to copy: a list is what goes stale
    // the next time the payload grows a field, which is RULE 33a.6 wearing
    // a different coat. `folders` is cleared on purpose - this screen has
    // none, and a stale set from the last shelf is not better than none.
    const prev = this.localData || {};
    this.localData = {
      ...prev,
      path_display: this.topicName({ cat: cat, kind: 'item' }),
      category_view: { category: cat, sub: want, subs: subs,
                       total: mine.length },
      items: items,
      folders: [],
      depth: 0,
    };
    this.updateUI();
  }

  // A chip was pressed. Re-filtering goes back through openCategoryItems so
  // the counts, the title and the list are built once, in one place.
  setCategorySubFilter(sub) {
    const view = this.localData && this.localData.category_view;
    if (!view) return;
    this.openCategoryItems(view.category, sub);
  }

  // [ADDED v2026.10.9] Tangents that cannot overshoot (Fritsch-Carlson).
  //
  // A plain Catmull-Rom spline through these points dips below the line
  // joining them whenever a tall month sits beside a short one - and this
  // user's year is 0, 355, 96, 0, 0, 0, 0, 1688, 1857, 642, 0, 0. Below
  // the baseline means money that was never spent. This limits each
  // tangent to the interval its two endpoints define, so the curve stays
  // inside the data: a month with nothing in it reads as nothing.
  //
  // Returns one slope per point, in the same order.
  waveSlopes(ys) {
    const n = ys.length;
    if (n < 2) return [0];
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push(ys[i + 1] - ys[i]);
    const m = [d[0]];
    for (let i = 1; i < n - 1; i++) m.push((d[i - 1] + d[i]) / 2);
    m.push(d[n - 2]);
    // [FIXED v2026.10.9] Flat at every turning point.
    //
    // The averaged tangent is wrong wherever the data changes direction:
    // at a peak it still leans uphill, and the curve sails ABOVE the
    // highest month before coming down. Measured on the real year -
    // ...1688, 1857, 642... - the September peak overshot the top of the
    // chart by 1.58% of its height, and a run of 0, 900, 0, 900 dipped
    // 0.28% BELOW the baseline, which is money that was never spent.
    //
    // The limiter underneath cannot fix this on its own: it only scales a
    // tangent that is already pointing the right way. A turning point has
    // to be told it is one.
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
    }
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
    return m;
  }

  // The curve, as an SVG path in a 0..100 box.
  //
  // The box is unitless and preserveAspectRatio is none, so the browser
  // stretches it to whatever the plot is: no resize handler, no measuring,
  // and the chart still "resizes without arithmetic" the way the column
  // version did. y is inverted because SVG counts downward.
  //
  // The curve runs edge to edge rather than centre to centre - it is
  // flat-extended past the first and last month - so the fill reaches the
  // sides of the plot instead of leaving two wedges of background.
  buildWavePath(cells, peak) {
    const n = cells.length;
    const xs = [];
    const ys = [];
    for (let i = 0; i < n; i++) {
      xs.push((i + 0.5) * (100 / n));
      ys.push(100 - (Math.max(0, cells[i].v) / peak) * 100);
    }
    const m = this.waveSlopes(ys);
    // dx is the same for every segment here, so the Hermite-to-Bezier
    // conversion is a third of it either side.
    const dx = 100 / n;
    const k = dx / 3;
    let dPath = 'M 0,' + ys[0].toFixed(3) + ' L ' + xs[0].toFixed(3)
      + ',' + ys[0].toFixed(3);
    for (let i = 0; i < n - 1; i++) {
      dPath += ' C ' + (xs[i] + k).toFixed(3) + ','
        + (ys[i] + m[i] / 3).toFixed(3) + ' '
        + (xs[i + 1] - k).toFixed(3) + ','
        + (ys[i + 1] - m[i + 1] / 3).toFixed(3) + ' '
        + xs[i + 1].toFixed(3) + ',' + ys[i + 1].toFixed(3);
    }
    dPath += ' L 100,' + ys[n - 1].toFixed(3);
    return dPath;
  }

  // The two paths and the gradient, built with createElementNS rather than
  // an innerHTML string: nothing here is user text, and a markup string is
  // how one stops being true (RULE 15).
  buildWave(cells, peak) {
    const NS = 'http://www.w3.org/2000/svg';
    // [FIXED v2026.10.9] A div takes the inset and the svg fills it.
    //
    // The inset used to be on the svg, which is a REPLACED element: there
    // `width: auto` means the intrinsic size and not the box the insets
    // describe, so the browser sized it from its own fallback rules and
    // the curve was drawn down the whole page. A div sizes from insets,
    // which is why the dots beside it were always in the right place.
    const holder = document.createElement('div');
    holder.className = 'dash-wave';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    // The id is scoped to this shadow root, and the whole chart is rebuilt
    // from scratch on every render, so there is never a second one.
    const defs = document.createElementNS(NS, 'defs');
    const grad = document.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id', 'dash-wave-fill');
    // Vertical, and in objectBoundingBox units, so it spans the whole plot
    // whatever the curve does - the strong end is at the TOP of the chart
    // and not at the top of each hump.
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
    [['0%', 'dash-wave-stop-hi'], ['55%', 'dash-wave-stop-mid'],
     ['100%', 'dash-wave-stop-lo']].forEach(pair => {
      const st = document.createElementNS(NS, 'stop');
      st.setAttribute('offset', pair[0]);
      // Classed, not coloured here: the stops are theme tokens and the
      // stylesheet is where their contrast was measured.
      st.setAttribute('class', pair[1]);
      grad.appendChild(st);
    });
    defs.appendChild(grad);
    svg.appendChild(defs);

    const line = this.buildWavePath(cells, peak);

    const area = document.createElementNS(NS, 'path');
    area.setAttribute('class', 'dash-wave-area');
    area.setAttribute('d', line + ' L 100,100 L 0,100 Z');
    area.setAttribute('fill', 'url(#dash-wave-fill)');
    svg.appendChild(area);

    const stroke = document.createElementNS(NS, 'path');
    stroke.setAttribute('class', 'dash-wave-line');
    stroke.setAttribute('d', line);
    stroke.setAttribute('fill', 'none');
    // Without this the stroke is stretched with the box and comes out
    // thick on a wide screen and hairline on a narrow one.
    stroke.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(stroke);
    holder.appendChild(svg);
    return holder;
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
