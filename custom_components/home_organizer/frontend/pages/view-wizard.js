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
// [ADDED v2026.10.7 | 2026-10-07] Purpose: the locations wizard - define a
//   whole house in a few taps instead of one folder at a time.
//
//   WHY A WIZARD AT ALL. A new installation has nowhere to put anything, and
//   the three levels are not self-explanatory. Creating fifty locations by
//   hand, each with its own rename and icon, is what people stop doing
//   halfway through - and a half-defined house is worse than none, because
//   items land in the wrong place and stay there.
//
//   THE HIERARCHY IT PRODUCES is the one this house already uses, verified
//   against a real database before a line of this was written:
//
//       level_1 = '[Floor 1] Kitchen'   the room, with the floor as a prefix
//       level_2 = 'Fridge'              the furniture
//       level_3 = '[ORDER_MARKER_020] Top shelf'
//
//   The floor is NOT a level. It is a prefix on the room name, which is what
//   lets four navigation steps fit in the three level columns the inventory
//   view actually displays - async_get_view_data produces folders for depth
//   0 and 1 and sub-location headings for level_3, and nothing reads deeper.
//
//   location_seed.py used to put one worked example in on a fresh install,
//   in a different shape: the fridge shelves went to level_4, where the
//   panel never looks, so those five shelves were invisible. The wizard
//   replaced what that was for and the seed was removed in v2026.10.7.
//
//   NOTHING IS WRITTEN UNTIL THE LAST SCREEN. Every answer lives in
//   this.wizProfile, which is saved to app_settings as a draft so closing the
//   panel does not lose it. Apply is additive and idempotent: a path that
//   exists is skipped, and no location is ever deleted, because items may be
//   living in it (RULE 5, RULE 6).
//
//   THE CATALOGUE IS DATA. WIZ_ROOMS and WIZ_UNITS below are tables, not
//   code: a new option is a row. Every entry names an icon that is already
//   drawn in ICON_LIB_ROOM or ICON_LIB_LOCATION, so the catalogue costs no
//   new artwork. The label is a translation key; the icon key is an
//   identifier and is never translated (RULE 20).
//
//   THE FIRST-RUN BANNER is here too, because it belongs to the
//   wizard; renderRoomsView only places it. It shows when the root has
//   NO folders and has not been dismissed - one condition that answers
//   every case without a flag to keep in step: run the wizard and
//   folders exist, make one by hand with the pencil and folders exist,
//   or dismiss it. The dismissal is per browser, in localStorage
//   beside the language and the theme, and writes nothing to the home.

import { ICONS, ICON_LIB_ROOM, ICON_LIB_LOCATION } from '../organizer-icon.js?v=10.11.112';

// How many of a thing the wizard offers to make at once. Six kitchen
// cabinets is a normal kitchen; sixty is a typo.
const WIZ_MAX_COUNT = 20;

// Spots inside a fridge, by door count. The ONLY place the wizard proposes a
// shelf life: everywhere else the expiry date comes from the assistant when
// the item is created, which is what the user asked for.
const WIZ_FRIDGE_SPOTS = {
  1: [
    ['loc_shelf_top', 'Shelf', 5], ['loc_shelf_middle', 'Shelf', 5],
    ['loc_shelf_bottom', 'Shelf', 5], ['loc_drawer_veg', 'Drawer', 7],
    ['loc_door_shelf', 'Shelf', 5],
  ],
  2: [
    ['loc_shelf_top', 'Shelf', 5], ['loc_shelf_middle', 'Shelf', 5],
    ['loc_shelf_bottom', 'Shelf', 5], ['loc_drawer_veg', 'Drawer', 7],
    ['loc_drawer_fruit', 'Drawer', 7], ['loc_door_shelf', 'Shelf', 5],
  ],
  3: [
    ['loc_shelf_top', 'Shelf', 5], ['loc_shelf_middle', 'Shelf', 5],
    ['loc_shelf_bottom', 'Shelf', 5], ['loc_drawer_veg', 'Drawer', 7],
    ['loc_drawer_fruit', 'Drawer', 7], ['loc_drawer_deli', 'Drawer', 3],
    ['loc_door_shelf_l', 'Shelf', 5], ['loc_door_shelf_r', 'Shelf', 5],
  ],
};
WIZ_FRIDGE_SPOTS[4] = WIZ_FRIDGE_SPOTS[3];

// Added when a freezer is part of the same appliance. 180 days, not 5.
const WIZ_FREEZER_SPOTS = [
  ['loc_freezer_upper', 'Freezer', 180],
  ['loc_freezer_lower', 'Freezer', 180],
];

// The storage a room can hold. [label_key, ICON_LIB_LOCATION key, default
// count] - a count of 0 means offered but not ticked.
const WIZ_UNITS = {
  Kitchen: [
    ['loc_kitchen_cabinet', 'Kitchen Cabinet', 6],
    ['loc_fridge', 'Fridge', 1], ['loc_pantry_shelf', 'Pantry Shelf', 1],
    ['loc_freezer', 'Freezer', 0], ['loc_spice_rack', 'Spice Rack', 0],
    ['loc_countertop', 'Countertop', 0], ['loc_under_sink', 'Sink', 0],
    ['loc_display_case', 'Display Case', 0], ['loc_upper_cabinet', 'Cabinet', 0],
    ['loc_drawer', 'Drawer', 0], ['loc_island', 'Countertop', 0],
    ['loc_fruit_basket', 'Basket', 0], ['loc_cutlery_drawer', 'Drawer', 0],
    ['loc_bakeware', 'Cabinet', 0], ['loc_cleaning_cabinet', 'Cabinet', 0],
    ['loc_recycling', 'Bin', 0],
  ],
  'Living Room': [
    ['loc_tv_unit', 'Wall Unit', 1], ['loc_bookcase', 'Bookcase', 1],
    ['loc_display_case', 'Display Case', 0], ['loc_sideboard', 'Drawer', 0],
    ['loc_coffee_table', 'Table', 0], ['loc_floating_shelf', 'Shelf', 0],
    ['loc_storage_box', 'Trunk', 0], ['loc_remote_basket', 'Basket', 0],
    ['loc_games_cabinet', 'Cabinet', 0],
  ],
  Bedroom: [
    ['loc_wardrobe', 'Wardrobe', 1], ['loc_nightstand', 'Drawer', 2],
    ['loc_walk_in', 'Wardrobe', 0], ['loc_under_bed', 'Under Bed', 0],
    ['loc_chest_drawers', 'Drawer', 0], ['loc_jewellery', 'Jewelry Box', 0],
    ['loc_makeup', 'Makeup Organizer', 0], ['loc_vanity', 'Vanity', 0],
    ['loc_safe', 'Safe', 0], ['loc_suitcases', 'Suitcase', 0],
    ['loc_linen_cabinet', 'Cabinet', 0], ['loc_wardrobe_top', 'Shelf', 0],
    ['loc_coat_rack', 'Storage Unit', 0],
  ],
  'Kids Room': [
    ['loc_wardrobe', 'Wardrobe', 1], ['loc_computer_desk', 'Desk', 1],
    ['loc_bookcase', 'Bookcase', 1], ['loc_shelf', 'Shelf', 0],
    ['loc_chest_drawers', 'Drawer', 0], ['loc_toy_box', 'Trunk', 0],
    ['loc_under_bed', 'Under Bed', 0], ['loc_game_bins', 'Container', 0],
    ['loc_schoolbook_shelf', 'Shelf', 0], ['loc_nightstand', 'Drawer', 0],
    ['loc_baskets', 'Basket', 0], ['loc_costume_cabinet', 'Cabinet', 0],
  ],
  Nursery: [
    ['loc_wardrobe', 'Wardrobe', 1], ['loc_changing_unit', 'Drawer', 1],
    ['loc_shelf', 'Shelf', 0], ['loc_toy_box', 'Trunk', 0],
    ['loc_nappy_basket', 'Basket', 0], ['loc_linen_cabinet', 'Cabinet', 0],
    ['loc_under_bed', 'Under Bed', 0],
  ],
  Bathroom: [
    ['loc_sink_cabinet', 'Vanity', 1], ['loc_medicine_cabinet', 'Medicine Cabinet', 1],
    ['loc_service_cupboard', 'Cabinet', 0], ['loc_shelf', 'Shelf', 0],
    ['loc_makeup', 'Makeup Organizer', 0], ['loc_laundry_basket', 'Basket', 0],
    ['loc_towel_cabinet', 'Cabinet', 0], ['loc_shower_shelf', 'Shelf', 0],
    ['loc_drawer', 'Drawer', 0], ['loc_cleaning_cabinet', 'Cabinet', 0],
    ['loc_bin', 'Bin', 0],
  ],
  Laundry: [
    ['loc_service_cupboard', 'Cabinet', 1], ['loc_shelf', 'Shelf', 1],
    ['loc_above_machine', 'Cabinet', 0], ['loc_laundry_basket', 'Basket', 0],
    ['loc_detergent_shelf', 'Pantry Shelf', 0],
    ['loc_linen_cabinet', 'Cabinet', 0], ['loc_folding_counter', 'Countertop', 0],
  ],
  Pantry: [
    ['loc_pantry_shelf', 'Pantry Shelf', 3], ['loc_shelf', 'Shelf', 0],
    ['loc_baskets', 'Basket', 0], ['loc_storage_box', 'Box', 0],
    ['loc_spice_rack', 'Spice Rack', 0],
  ],
  'Working Room': [
    ['loc_desk', 'Desk', 1], ['loc_bookcase', 'Bookcase', 1],
    ['loc_filing_cabinet', 'Filing Cabinet', 0], ['loc_desk_drawer', 'Drawer', 0],
    ['loc_shelf', 'Shelf', 0], ['loc_supply_cabinet', 'Cabinet', 0],
    ['loc_cable_box', 'Box', 0], ['loc_document_safe', 'Safe', 0],
  ],
  Attic: [
    ['loc_shelf', 'Shelf', 3], ['loc_storage_box', 'Box', 1],
    ['loc_suitcases', 'Suitcase', 0], ['loc_cartons', 'Container', 0],
    ['loc_cabinet', 'Cabinet', 0], ['loc_seasonal_box', 'Trunk', 0],
    ['loc_storage_unit', 'Storage Unit', 0],
  ],
  Basement: [
    ['loc_shelf', 'Shelf', 3], ['loc_storage_box', 'Box', 1],
    ['loc_freezer', 'Freezer', 0], ['loc_workbench', 'Workbench', 0],
    ['loc_tool_box', 'Tool Box', 0], ['loc_cabinet', 'Cabinet', 0],
    ['loc_wine_shelf', 'Shelf', 0], ['loc_storage_unit', 'Storage Unit', 0],
  ],
  Garage: [
    ['loc_shelf', 'Shelf', 2], ['loc_tool_box', 'Tool Box', 1],
    ['loc_workbench', 'Workbench', 0], ['loc_cabinet', 'Cabinet', 0],
    ['loc_tyre_shelf', 'Shelf', 0], ['loc_storage_box', 'Box', 0],
    ['loc_freezer', 'Freezer', 0], ['loc_garden_cabinet', 'Cabinet', 0],
    ['loc_bike_rack', 'Storage Unit', 0],
  ],
  Garden: [
    ['loc_shelf', 'Shelf', 2], ['loc_tool_box', 'Tool Box', 1],
    ['loc_workbench', 'Workbench', 0], ['loc_garden_cabinet', 'Cabinet', 0],
    ['loc_baskets', 'Basket', 0], ['loc_storage_box', 'Box', 0],
    ['loc_plant_shelf', 'Shelf', 0],
  ],
  Workshop: [
    ['loc_workbench', 'Workbench', 1], ['loc_tool_box', 'Tool Box', 1],
    ['loc_shelf', 'Shelf', 2], ['loc_parts_unit', 'Storage Unit', 0],
    ['loc_drawer', 'Drawer', 0],
  ],
  Hallway: [
    ['loc_cabinet', 'Cabinet', 1], ['loc_sideboard', 'Drawer', 0],
    ['loc_coat_rack', 'Storage Unit', 0], ['loc_key_basket', 'Basket', 0],
    ['loc_shoe_shelf', 'Shelf', 0], ['loc_coat_wardrobe', 'Wardrobe', 0],
    ['loc_storage_box', 'Box', 0],
  ],
  Balcony: [
    ['loc_cabinet', 'Cabinet', 0], ['loc_shelf', 'Shelf', 0],
    ['loc_baskets', 'Basket', 0], ['loc_storage_box', 'Trunk', 0],
    ['loc_plant_shelf', 'Shelf', 0],
  ],
  'Guest Room': [
    ['loc_wardrobe', 'Wardrobe', 1], ['loc_nightstand', 'Drawer', 0],
    ['loc_shelf', 'Shelf', 0], ['loc_under_bed', 'Under Bed', 0],
    ['loc_linen_cabinet', 'Cabinet', 0],
  ],
  Gym: [
    ['loc_shelf', 'Shelf', 1], ['loc_equipment_box', 'Trunk', 0],
    ['loc_baskets', 'Basket', 0], ['loc_cabinet', 'Cabinet', 0],
  ],
  'Media Room': [
    ['loc_tv_unit', 'Wall Unit', 1], ['loc_shelf', 'Shelf', 0],
    ['loc_cable_box', 'Box', 0], ['loc_bookcase', 'Bookcase', 0],
  ],
  Playroom: [
    ['loc_toy_box', 'Trunk', 1], ['loc_bookcase', 'Bookcase', 1],
    ['loc_game_bins', 'Container', 0], ['loc_baskets', 'Basket', 0],
    ['loc_shelf', 'Shelf', 0],
  ],
  Library: [
    ['loc_bookcase', 'Bookcase', 3], ['loc_shelf', 'Shelf', 0],
    ['loc_display_case', 'Display Case', 0], ['loc_desk', 'Desk', 0],
  ],
};

// Rooms the wizard offers, in the order they are drawn. Each names its icon
// in ICON_LIB_ROOM and the WIZ_UNITS entry it borrows its storage list from.
// `ensuite` adds the tick that creates an adjoining room: an en-suite is
// physically inside the bedroom, but as its own room its cabinet and that
// cabinet's shelves both fit in the three levels the view displays.
const WIZ_ROOMS = [
  { key: 'Kitchen', units: 'Kitchen', ensuite: ['Pantry', 'Laundry'] },
  { key: 'Living Room', units: 'Living Room' },
  { key: 'Dining', units: 'Living Room' },
  { key: 'Bedroom', units: 'Bedroom', ensuite: ['Bathroom'] },
  // ICON_LIB_ROOM holds five differently drawn children's rooms and no
  // plain one, so the Nth kids room takes the Nth drawing. `icon` is
  // how any archetype names a picture that is not called after it.
  { key: 'Kids Room', units: 'Kids Room', icon: 'Kids Room 1',
    iconSeries: 'Kids Room', iconSeriesMax: 5 },
  { key: 'Nursery', units: 'Nursery' },
  { key: 'Bathroom', units: 'Bathroom' },
  { key: 'Toilet', units: 'Bathroom' },
  { key: 'Laundry', units: 'Laundry' },
  { key: 'Pantry', units: 'Pantry' },
  { key: 'Working Room', units: 'Working Room' },
  { key: 'Guest Room', units: 'Guest Room' },
  { key: 'Hallway', units: 'Hallway' },
  { key: 'Entrance', units: 'Hallway' },
  { key: 'Balcony', units: 'Balcony' },
  { key: 'Playroom', units: 'Playroom' },
  { key: 'Media Room', units: 'Media Room' },
  { key: 'Gym', units: 'Gym' },
  { key: 'Library', units: 'Library' },
  { key: 'Workshop', units: 'Workshop' },
  { key: 'Garage', units: 'Garage' },
  { key: 'Garden', units: 'Garden' },
  { key: 'Attic', units: 'Attic' },
  { key: 'Basement', units: 'Basement' },
];

// The whole-house ticks on screen 2. Each becomes a floor of its own, which
// is how 'Attic' ends up as a place rather than a checkbox.
const WIZ_EXTRAS = ['Attic', 'Basement', 'Garden', 'Garage', 'Balcony', 'Roof'];

const WIZ_STEPS = ['lang', 'theme', 'home', 'rooms', 'units', 'fridge',
                   'cleanup', 'review'];

export const WizardMixin = (Base) => class extends Base {

  // ---------------------------------------------------------------- banner

  // [ADDED v2026.10.7] The nudge on an empty house.
  //
  // location_seed.py used to put one worked example in so that a new
  // installation was not an empty screen with no clue what the levels are
  // for. That seed is gone - it wrote its fridge shelves into level_4, where
  // the panel never looks - and this is what replaces it: an offer, rather
  // than eight rows of somebody else's kitchen.
  //
  // Shown when the root has NO folders and it has not been dismissed. That
  // single condition is deliberate: it needs no flag to keep in step and no
  // extra round trip, and it answers every case on its own. Run the wizard
  // and folders exist, so it goes. Make one location by hand with the pencil
  // and folders exist, so it goes. Dismiss it and it goes.
  wizBannerShouldShow(attrs) {
    if (this.wizBannerHidden) return false;
    return !((attrs && attrs.folders) || []).length;
  }

  renderWizardBanner(content) {
    const card = document.createElement('div');
    card.id = 'wiz-banner';
    card.style.cssText = 'margin:0 0 16px 0;padding:16px;border-radius:12px;'
      + 'background:var(--bg-input-edit);border:1px solid '
      + 'var(--primary,#4fc3f7);display:flex;flex-direction:column;gap:10px;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const wand = document.createElement('span');
    wand.style.cssText = 'width:24px;height:24px;flex-shrink:0;display:flex;'
      + 'color:var(--primary,#4fc3f7);';
    wand.innerHTML = ICONS.wand;
    head.appendChild(wand);
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;font-size:15px;flex:1;min-width:0;';
    title.textContent = this._t('wiz_banner_title',
                                'Set up your home in 2 minutes');
    head.appendChild(title);
    card.appendChild(head);

    const body = document.createElement('div');
    body.style.cssText = 'font-size:13px;line-height:1.5;'
      + 'color:var(--text-sub,#9e9e9e);';
    body.textContent = this._t(
      'wiz_banner_body',
      'Answer a few questions and the rooms, cupboards and fridge shelves '
      + 'are created for you. You can also add them one at a time with the '
      + 'pencil, whenever you like.');
    card.appendChild(body);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';
    const go = document.createElement('button');
    go.className = 'action-btn';
    go.type = 'button';
    go.style.cssText = 'flex:1;min-width:140px;min-height:44px;'
      + 'font-weight:bold;';
    go.textContent = this._t('wiz_banner_cta', 'Set up my home');
    go.onclick = () => this.openLocationsWizard();
    row.appendChild(go);

    const no = document.createElement('button');
    no.className = 'action-btn';
    no.type = 'button';
    no.style.cssText = 'min-height:44px;padding-inline:18px;'
      + 'background:transparent;border:1px solid var(--border-light,#333);';
    no.textContent = this._t('wiz_banner_skip', 'Not now');
    no.onclick = () => this.dismissWizardBanner();
    row.appendChild(no);
    card.appendChild(row);

    content.appendChild(card);
  }

  // Dismissed for good on this device. Nothing is written to the house, and
  // the wizard stays in the gear menu for whenever it is wanted.
  dismissWizardBanner() {
    this.wizBannerHidden = true;
    try {
      localStorage.setItem('ho_wizard_banner_hidden', 'true');
    } catch (e) {
      // A private window with storage blocked still gets the banner gone for
      // this session, which is the part that matters right now.
      console.warn('Home Organizer: the banner choice could not be stored.', e);
    }
    const old = this.shadowRoot.getElementById('wiz-banner');
    if (old) old.remove();
  }

  // ---------------------------------------------------------------- opening

  async openLocationsWizard() {
    this.wizBusy = false;
    this.wizResult = null;
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/locations_wizard', action: 'get' });
      this.wizProfile = this._wizNormalise(res?.profile);
      this.wizTree = res?.tree || {};
      this.wizAppliedBefore = !!res?.applied_before;
    } catch (e) {
      console.error('The wizard could not read the house profile', e);
      this.wizProfile = this._wizNormalise(null);
      this.wizTree = {};
      this.wizAppliedBefore = false;
    }
    // The catalogue's own translations are fetched here rather than at boot:
    // ~250 rows the main panel would otherwise load and never use.
    await this.loadWizardTranslations();
    this.wizIssues = [];
    this.wizStep = 0;
    const menu = this.shadowRoot.getElementById('setup-dropdown-menu');
    if (menu) menu.classList.remove('show');
    this.renderWizardScreen();
  }

  closeLocationsWizard() {
    this.wizStep = 0;
    const old = this.shadowRoot.getElementById('wiz-page');
    if (old) old.remove();
  }

  // Leaving the wizard changes nothing in the house. The ANSWERS are kept,
  // because a form that throws away ten minutes of ticking when the phone
  // rings is a form nobody finishes.
  async exitLocationsWizard() {
    try {
      await this._hass.callWS({
        type: 'home_organizer/locations_wizard', action: 'save',
        profile: this.wizProfile });
    } catch (e) { console.error(e); }
    this.closeLocationsWizard();
  }

  _wizNormalise(profile) {
    const p = (profile && typeof profile === 'object') ? profile : {};
    return {
      version: 1,
      home_type: p.home_type || '',
      floors: Array.isArray(p.floors) ? p.floors : [],
      extras: (p.extras && typeof p.extras === 'object') ? p.extras : {},
      applied_at: p.applied_at || '',
      applied_paths: (p.applied_paths && typeof p.applied_paths === 'object')
        ? p.applied_paths : {},
    };
  }

  // The label for a catalogue key. The key is an identifier and the English
  // fallback is the icon's own name, so a missing translation degrades to a
  // readable word rather than to 'loc_kitchen_cabinet'.
  _wizLabel(key, fallback) {
    return this._t(key, fallback || key.replace(/^loc_|^wiz_/, '')
      .replace(/_/g, ' '));
  }

  // ------------------------------------------------------------- the screens

  // Drawn fresh each time, like the categories screen. Replacing the whole
  // element is what keeps the step, the ticks and the theme in agreement
  // without a diffing framework.
  renderWizardScreen() {
    const old = this.shadowRoot.getElementById('wiz-page');
    if (old) old.remove();

    const step = WIZ_STEPS[this.wizStep] || 'lang';
    const page = document.createElement('div');
    page.id = 'wiz-page';
    // --bg-body and --text-main, not --bg-main: there is no such variable,
    // so the fallback was used and the page was painted a fixed dark grey
    // whatever the theme said. And the colour has to be set here: the panel
    // declares `color` on .app-container, and nothing outside that inherits
    // it, so every label in this screen was drawn in the browser's default
    // black on a dark background.
    page.style.cssText = 'position:fixed;inset:0;z-index:4000;display:flex;'
      + 'flex-direction:column;background:var(--bg-body);'
      + 'color:var(--text-main);';

    page.appendChild(this._wizHeader(step));

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 16px 16px;'
      + '-webkit-overflow-scrolling:touch;';
    body.appendChild(this._wizIntro(step));
    const content = document.createElement('div');
    body.appendChild(content);
    page.appendChild(body);
    page.appendChild(this._wizFooter(step));

    if (step === 'lang') this._wizStepLang(content);
    else if (step === 'theme') this._wizStepTheme(content);
    else if (step === 'home') this._wizStepHome(content);
    else if (step === 'rooms') this._wizStepRooms(content);
    else if (step === 'units') this._wizStepUnits(content);
    else if (step === 'fridge') this._wizStepFridge(content);
    else if (step === 'cleanup') this._wizStepCleanup(content);
    else this._wizStepReview(content);

    // Inside #app, not beside it.
    //
    // setTheme puts .light-mode on #app and the light values are declared on
    // that class, so anything appended to the shadow root directly keeps the
    // dark variables for ever - choosing Light did nothing to this screen.
    // A position:fixed child is out of flow, so #app's flex layout is
    // unaffected.
    this.mountOverlay(page);
  }

  _wizHeader(step) {
    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 16px 6px 16px;flex-shrink:0;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const wand = document.createElement('span');
    wand.style.cssText = 'width:26px;height:26px;color:var(--primary,#4fc3f7);'
      + 'flex-shrink:0;display:flex;';
    wand.innerHTML = ICONS.wand;
    row.appendChild(wand);

    const title = document.createElement('div');
    title.style.cssText = 'font-size:17px;font-weight:bold;flex:1;min-width:0;'
      + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    title.textContent = this._t('wiz_title', 'Set up your home');
    row.appendChild(title);
    head.appendChild(row);

    // A dotted progress strip. The cleanup step is skipped on a first run,
    // so the strip counts the steps that will actually be shown.
    const dots = document.createElement('div');
    dots.style.cssText = 'display:flex;gap:6px;margin-top:10px;';
    WIZ_STEPS.forEach((name, i) => {
      if (name === 'cleanup' && !this.wizAppliedBefore) return;
      const d = document.createElement('div');
      d.style.cssText = 'height:4px;flex:1;border-radius:2px;background:'
        + (i <= this.wizStep ? 'var(--primary,#4fc3f7)'
                             : 'var(--border-light,#333)') + ';';
      dots.appendChild(d);
    });
    head.appendChild(dots);
    return head;
  }

  // Every screen says what it is for. A wizard that shows a grid of icons
  // with no sentence above it is a quiz.
  _wizIntro(step) {
    const box = document.createElement('div');
    box.style.cssText = 'padding:14px 0 10px 0;';
    const h = document.createElement('div');
    h.style.cssText = 'font-size:15px;font-weight:bold;margin-bottom:6px;';
    h.textContent = this._t('wiz_' + step + '_title', step);
    box.appendChild(h);
    const why = document.createElement('div');
    why.style.cssText = 'font-size:13px;line-height:1.5;'
      + 'color:var(--text-sub,#9e9e9e);';
    why.textContent = this._t('wiz_' + step + '_why', '');
    box.appendChild(why);
    return box;
  }

  _wizFooter(step) {
    const bar = document.createElement('div');
    bar.style.cssText = 'flex-shrink:0;display:flex;gap:10px;padding:12px 16px;'
      + 'border-top:1px solid var(--border-light,#333);'
      + 'background:var(--bg-body);';

    const exit = document.createElement('button');
    exit.className = 'action-btn';
    exit.type = 'button';
    exit.style.cssText = 'min-height:48px;padding-inline:18px;'
      + 'background:transparent;border:1px solid var(--border-light,#333);';
    exit.textContent = this._t('wiz_exit', 'Exit');
    exit.onclick = () => this.exitLocationsWizard();
    bar.appendChild(exit);

    if (this.wizStep > 0) {
      const back = document.createElement('button');
      back.className = 'action-btn';
      back.type = 'button';
      back.style.cssText = 'min-height:48px;padding-inline:18px;'
        + 'background:transparent;border:1px solid var(--border-light,#333);';
      back.textContent = this._t('wiz_back', 'Back');
      back.onclick = () => this.wizGo(-1);
      bar.appendChild(back);
    }

    const next = document.createElement('button');
    next.className = 'action-btn';
    next.type = 'button';
    next.style.cssText = 'flex:1;min-height:48px;font-weight:bold;';
    next.disabled = !!this.wizBusy;
    next.textContent = step === 'review'
      ? this._t('wiz_apply', 'Create these locations')
      : this._t('wiz_next', 'Next');
    next.onclick = () => (step === 'review' ? this.wizApply() : this.wizGo(1));
    bar.appendChild(next);
    return bar;
  }

  wizGo(delta) {
    let i = this.wizStep + delta;
    // The cleanup screen only exists once there is something to tidy.
    while (WIZ_STEPS[i] === 'cleanup' && !this.wizAppliedBefore) i += delta;
    // Nor does the fridge screen, unless a fridge was actually chosen.
    while (WIZ_STEPS[i] === 'fridge' && !this._wizFridges().length) i += delta;
    this.wizStep = Math.max(0, Math.min(WIZ_STEPS.length - 1, i));
    if (WIZ_STEPS[this.wizStep] === 'cleanup') this.wizScanCleanup();
    this.renderWizardScreen();
  }

  // ---------------------------------------------------- 0: language, 1: theme

  _wizStepLang(root) {
    const grid = this._wizGrid(root);
    (this.availableLangs || ['en']).forEach((code) => {
      const on = this.currentLang === code;
      const tile = this._wizTile(code.toUpperCase(), '', on, () => {
        // The same call the gear menu makes, so this IS the system language.
        // The gear menu's own call: this IS the system language.
        this.changeLanguage(code);
        // changeLanguage redraws the panel; the wizard is a sibling of it
        // and has to be rebuilt in the new language and direction.
        this.renderWizardScreen();
      });
      grid.appendChild(tile);
    });
  }

  _wizStepTheme(root) {
    const grid = this._wizGrid(root);
    [['light', 'wiz_theme_light'], ['dark', 'wiz_theme_dark']]
      .forEach(([mode, key]) => {
        const app = this.shadowRoot.getElementById('app');
        const on = mode === 'light'
          ? !!app?.classList.contains('light-mode')
          : !app?.classList.contains('light-mode');
        grid.appendChild(this._wizTile(
          this._t(key, mode), ICONS.theme, on, () => {
            this.setTheme(mode);   // the gear menu's own call
            this.renderWizardScreen();  // redraw in the new theme
          }));
      });
  }

  // --------------------------------------------------------- 2: the building

  _wizStepHome(root) {
    const p = this.wizProfile;
    const grid = this._wizGrid(root);
    ['apartment', 'house', 'house_units'].forEach((kind) => {
      grid.appendChild(this._wizTile(
        this._t('wiz_home_' + kind, kind), ICONS.home,
        p.home_type === kind, () => {
          p.home_type = kind;
          if (kind === 'apartment') this._wizSetFloors(1);
          else if (!p.floors.length) this._wizSetFloors(1);
          this.renderWizardScreen();
        }));
    });

    if (p.home_type && p.home_type !== 'apartment') {
      const label = document.createElement('div');
      label.style.cssText = 'margin-top:18px;font-size:13px;'
        + 'color:var(--text-sub,#9e9e9e);';
      label.textContent = this._t('wiz_floor_count', 'How many floors?');
      root.appendChild(label);

      const sel = document.createElement('select');
      sel.style.cssText = 'margin-top:8px;width:100%;min-height:48px;'
        + 'padding:10px;border-radius:8px;background:var(--bg-input);'
        + 'color:var(--text-main);border:1px solid var(--border-light);';
      [1, 2, 3, 4].forEach((n) => {
        const o = document.createElement('option');
        o.value = String(n);
        o.textContent = String(n);
        o.selected = this._wizRealFloors().length === n;
        sel.appendChild(o);
      });
      sel.onchange = () => { this._wizSetFloors(Number(sel.value)); this.renderWizardScreen(); };
      root.appendChild(sel);
    }

    if (p.home_type) {
      const extras = document.createElement('div');
      extras.style.cssText = 'margin-top:22px;';
      const h = document.createElement('div');
      h.style.cssText = 'font-size:13px;color:var(--text-sub,#9e9e9e);'
        + 'margin-bottom:8px;';
      h.textContent = this._t('wiz_extras', 'What else does the home have?');
      extras.appendChild(h);
      WIZ_EXTRAS.forEach((key) => {
        extras.appendChild(this._wizCheckRow(
          this._wizLabel('loc_room_' + this._wizSlug(key), key),
          ICON_LIB_ROOM[this._wizRoomIcon(key, 0)] || '',
          !!p.extras[key], (on) => {
            p.extras[key] = on;
            this._wizSyncExtras();
            this.renderWizardScreen();
          }));
      });
      root.appendChild(extras);
    }
  }

  // The drawing for a room, which is not always named after it.
  //
  // A series - Kids Room 1..5 - gives the Nth room its own picture, so three
  // children's rooms do not come out looking identical. Capped at what the
  // library actually holds: naming a drawing that does not exist is how a
  // room ends up with no icon at all.
  _wizRoomIcon(archetype, index) {
    const def = WIZ_ROOMS.find((r) => r.key === archetype) || {};
    if (def.iconSeries) {
      const n = Math.min((index || 0) + 1, def.iconSeriesMax || 1);
      const key = def.iconSeries + ' ' + n;
      if (ICON_LIB_ROOM[key]) return key;
    }
    if (def.icon && ICON_LIB_ROOM[def.icon]) return def.icon;
    return ICON_LIB_ROOM[archetype] ? archetype : '';
  }

  _wizSlug(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  // Floors the user lives on, as opposed to the attic and the garden, which
  // are floors in the data but are chosen as ticks.
  _wizRealFloors() {
    return (this.wizProfile.floors || []).filter((f) => !f.extra);
  }

  _wizSetFloors(n) {
    const p = this.wizProfile;
    const real = this._wizRealFloors();
    const rest = (p.floors || []).filter((f) => f.extra);
    const kept = real.slice(0, n);
    for (let i = kept.length; i < n; i++) {
      kept.push({
        id: 'f' + (i + 1),
        label: this._t('wiz_floor_n', 'Floor {0}').replace('{0}', i + 1),
        rooms: [],
      });
    }
    p.floors = kept.concat(rest);
  }

  // An extra is a floor of its own with one room in it, which is how the
  // attic becomes somewhere you can put a box rather than a yes/no answer.
  _wizSyncExtras() {
    const p = this.wizProfile;
    p.floors = (p.floors || []).filter((f) => !f.extra || p.extras[f.key]);
    WIZ_EXTRAS.forEach((key) => {
      if (!p.extras[key]) return;
      if ((p.floors || []).some((f) => f.extra && f.key === key)) return;
      const label = this._wizLabel('loc_room_' + this._wizSlug(key), key);
      p.floors.push({
        id: 'x_' + this._wizSlug(key), label, extra: true, key,
        rooms: [{ id: 'x_' + this._wizSlug(key) + '_r', name: label,
                  archetype: key,
                  icon_key: 'ICON_LIB_ROOM_' + this._wizRoomIcon(key, 0),
                  furniture: this._wizDefaultUnits(key) }],
      });
    });
  }

  _wizDefaultUnits(archetype) {
    const list = WIZ_UNITS[archetype] || WIZ_UNITS[
      (WIZ_ROOMS.find((r) => r.key === archetype) || {}).units] || [];
    const out = [];
    list.forEach(([labelKey, iconKey, count]) => {
      for (let i = 0; i < count; i++) {
        out.push(this._wizUnit(labelKey, iconKey, count > 1 ? i + 1 : 0));
      }
    });
    return out;
  }

  _wizUnit(labelKey, iconKey, n) {
    const base = this._wizLabel(labelKey, iconKey);
    return {
      id: labelKey + '_' + (n || 0) + '_' + Math.random().toString(36).slice(2, 7),
      label_key: labelKey,
      name: n ? base + ' ' + n : base,
      icon_key: 'ICON_LIB_LOCATION_' + iconKey,
      children: [],
    };
  }

  // ------------------------------------------------------------- 3: rooms

  _wizStepRooms(root) {
    this._wizRealFloors().forEach((floor) => {
      const card = document.createElement('div');
      card.className = 'pending-card';
      card.style.cssText = 'margin-bottom:16px;';
      const h = document.createElement('div');
      h.style.cssText = 'font-weight:bold;margin-bottom:10px;';
      h.textContent = floor.label;
      card.appendChild(h);

      const grid = this._wizGrid(card);
      WIZ_ROOMS.forEach((room) => {
        const have = (floor.rooms || []).filter(
          (r) => r.archetype === room.key).length;
        const iconKey = this._wizRoomIcon(room.key, 0);
        grid.appendChild(this._wizCountTile(
          this._wizLabel('loc_room_' + this._wizSlug(room.key), room.key),
          ICON_LIB_ROOM[iconKey] || '', have,
          (n) => { this._wizSetRoomCount(floor, room, n); this.renderWizardScreen(); }));
      });
      root.appendChild(card);
    });
  }

  _wizSetRoomCount(floor, room, n) {
    n = Math.max(0, Math.min(WIZ_MAX_COUNT, n));
    const mine = (floor.rooms || []).filter((r) => r.archetype === room.key);
    const others = (floor.rooms || []).filter((r) => r.archetype !== room.key);
    const kept = mine.slice(0, n);
    const label = this._wizLabel('loc_room_' + this._wizSlug(room.key), room.key);
    for (let i = kept.length; i < n; i++) {
      kept.push({
        id: 'r_' + this._wizSlug(room.key) + '_' + i + '_'
            + Math.random().toString(36).slice(2, 7),
        archetype: room.key,
        name: n > 1 ? label + ' ' + (i + 1) : label,
        icon_key: 'ICON_LIB_ROOM_' + this._wizRoomIcon(room.key, i),
        furniture: this._wizDefaultUnits(room.key),
      });
    }
    // Renumber what is left, so deleting "Bedroom 1" does not leave a lone
    // "Bedroom 2" behind.
    kept.forEach((r, i) => {
      if (!r.renamed) r.name = n > 1 ? label + ' ' + (i + 1) : label;
    });
    floor.rooms = others.concat(kept);
  }

  // ----------------------------------------------------------- 4: furniture

  _wizStepUnits(root) {
    this.wizProfile.floors.forEach((floor) => {
      (floor.rooms || []).forEach((room) => {
        const card = document.createElement('div');
        card.className = 'pending-card';
        card.style.cssText = 'margin-bottom:16px;';

        const head = document.createElement('div');
        head.style.cssText = 'display:flex;align-items:center;gap:10px;'
          + 'margin-bottom:10px;';
        const icon = document.createElement('span');
        icon.style.cssText = 'width:30px;height:30px;flex-shrink:0;'
          + 'cursor:pointer;display:flex;';
        icon.innerHTML = ICON_LIB_ROOM[
          (room.icon_key || '').replace('ICON_LIB_ROOM_', '')]
          || ICON_LIB_ROOM[this._wizRoomIcon(room.archetype, 0)]
          || ICONS.folder;
        icon.title = this._t('wiz_change_icon', 'Change the icon');
        icon.onclick = () => this.wizPickIcon(room, 'room');
        head.appendChild(icon);

        const nameIn = document.createElement('input');
        nameIn.value = room.name;
        nameIn.style.cssText = 'flex:1;min-width:0;min-height:44px;'
          + 'padding:8px;border-radius:8px;background:var(--bg-input);'
          + 'color:var(--text-main);border:1px solid var(--border-light);'
          + 'font-weight:bold;';
        nameIn.onchange = () => {
          room.name = nameIn.value.trim() || room.name;
          room.renamed = true;
        };
        head.appendChild(nameIn);
        card.appendChild(head);

        const archetype = (WIZ_ROOMS.find((r) => r.key === room.archetype)
                           || {}).units || room.archetype;
        (WIZ_UNITS[archetype] || []).forEach(([labelKey, iconKey]) => {
          const have = (room.furniture || []).filter(
            (u) => u.label_key === labelKey).length;
          card.appendChild(this._wizCountRow(
            this._wizLabel(labelKey, iconKey),
            ICON_LIB_LOCATION[iconKey] || '', have,
            (n) => {
              this._wizSetUnitCount(room, labelKey, iconKey, n);
              this.renderWizardScreen();
            }));
        });

        const ensuite = (WIZ_ROOMS.find((r) => r.key === room.archetype)
                         || {}).ensuite || [];
        ensuite.forEach((key) => {
          const floorOf = this.wizProfile.floors.find((f) => f === floor);
          const exists = (floorOf.rooms || []).some(
            (r) => r.ensuite_of === room.id && r.archetype === key);
          card.appendChild(this._wizCheckRow(
            this._t('wiz_ensuite', 'Adjoining {0}')
              .replace('{0}', this._wizLabel(
                'loc_room_' + this._wizSlug(key), key)),
            ICON_LIB_ROOM[this._wizRoomIcon(key, 0)] || '', exists, (on) => {
              this._wizSetEnsuite(floorOf, room, key, on);
              this.renderWizardScreen();
            }));
        });
        root.appendChild(card);
      });
    });
  }

  _wizSetUnitCount(room, labelKey, iconKey, n) {
    n = Math.max(0, Math.min(WIZ_MAX_COUNT, n));
    const mine = (room.furniture || []).filter((u) => u.label_key === labelKey);
    const others = (room.furniture || []).filter((u) => u.label_key !== labelKey);
    const kept = mine.slice(0, n);
    for (let i = kept.length; i < n; i++) {
      kept.push(this._wizUnit(labelKey, iconKey, n > 1 ? i + 1 : 0));
    }
    const base = this._wizLabel(labelKey, iconKey);
    kept.forEach((u, i) => {
      if (!u.renamed) u.name = n > 1 ? base + ' ' + (i + 1) : base;
    });
    room.furniture = others.concat(kept);
  }

  // The en-suite is created as a SIBLING room, not as furniture inside the
  // bedroom. Physically it is inside; in the data a room of its own means its
  // cabinet and that cabinet's shelves both fit in the three levels the
  // inventory view displays.
  _wizSetEnsuite(floor, room, key, on) {
    floor.rooms = (floor.rooms || []).filter(
      (r) => !(r.ensuite_of === room.id && r.archetype === key));
    if (!on) return;
    const label = this._wizLabel('loc_room_' + this._wizSlug(key), key);
    floor.rooms.push({
      id: room.id + '_en_' + this._wizSlug(key),
      ensuite_of: room.id,
      archetype: key,
      name: label + ' - ' + room.name,
      icon_key: 'ICON_LIB_ROOM_' + this._wizRoomIcon(key, 0),
      furniture: this._wizDefaultUnits(key),
    });
  }

  // The existing picker, in its own 'room' / 'location' context. The wizard
  // adds no second way to choose an icon, and the AI drawing path comes with
  // it for free (RULE 33d).
  wizPickIcon(target, context) {
    this.wizIconTarget = target;
    this.openIconPicker(target.name, context);
  }

  // ------------------------------------------------------------- 5: fridge

  _wizFridges() {
    const out = [];
    (this.wizProfile.floors || []).forEach((f) => {
      (f.rooms || []).forEach((r) => {
        (r.furniture || []).forEach((u) => {
          if (u.label_key === 'loc_fridge') out.push({ room: r, unit: u });
        });
      });
    });
    return out;
  }

  _wizStepFridge(root) {
    this._wizFridges().forEach(({ room, unit }) => {
      const card = document.createElement('div');
      card.className = 'pending-card';
      card.style.cssText = 'margin-bottom:16px;';

      const h = document.createElement('div');
      h.style.cssText = 'font-weight:bold;margin-bottom:10px;';
      h.textContent = room.name + ' - ' + unit.name;
      card.appendChild(h);

      const doorsRow = document.createElement('div');
      doorsRow.style.cssText = 'display:flex;align-items:center;gap:8px;'
        + 'margin-bottom:10px;flex-wrap:wrap;';
      const dl = document.createElement('span');
      dl.style.cssText = 'font-size:13px;color:var(--text-sub);flex:1;'
        + 'min-width:120px;';
      dl.textContent = this._t('wiz_fridge_doors', 'How many doors?');
      doorsRow.appendChild(dl);
      [1, 2, 3, 4].forEach((n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'action-btn';
        b.style.cssText = 'min-width:48px;min-height:44px;'
          + (unit.doors === n ? '' : 'background:transparent;border:1px solid var(--border-light);');
        b.textContent = String(n);
        b.onclick = () => { unit.doors = n; this._wizFridgeSpots(unit); this.renderWizardScreen(); };
        doorsRow.appendChild(b);
      });
      card.appendChild(doorsRow);

      const frRow = document.createElement('div');
      frRow.style.cssText = 'display:flex;align-items:center;gap:8px;'
        + 'margin-bottom:12px;flex-wrap:wrap;';
      const fl = document.createElement('span');
      fl.style.cssText = 'font-size:13px;color:var(--text-sub);flex:1;'
        + 'min-width:120px;';
      fl.textContent = this._t('wiz_fridge_freezer', 'Freezer?');
      frRow.appendChild(fl);
      ['none', 'top', 'bottom', 'side'].forEach((k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'action-btn';
        b.style.cssText = 'min-height:44px;padding-inline:12px;'
          + ((unit.freezer || 'none') === k ? ''
             : 'background:transparent;border:1px solid var(--border-light);');
        b.textContent = this._t('wiz_freezer_' + k, k);
        b.onclick = () => { unit.freezer = k; this._wizFridgeSpots(unit); this.renderWizardScreen(); };
        frRow.appendChild(b);
      });
      card.appendChild(frRow);

      if (!unit.doors) unit.doors = 1;
      if (!(unit.children || []).length) this._wizFridgeSpots(unit);

      (unit.children || []).forEach((spot, i) => {
        card.appendChild(this._wizSpotRow(unit, spot, i));
      });

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'action-btn';
      add.style.cssText = 'width:100%;min-height:44px;margin-top:8px;'
        + 'background:transparent;border:1px dashed var(--border-light);';
      add.textContent = this._t('wiz_add_spot', '+ Add a place');
      add.onclick = () => {
        unit.children.push({ name: this._t('wiz_new_spot', 'New place'),
                             icon: 'Shelf', shelf_life: 0 });
        this.renderWizardScreen();
      };
      card.appendChild(add);
      root.appendChild(card);
    });
  }

  _wizFridgeSpots(unit) {
    const doors = Math.max(1, Math.min(4, Number(unit.doors) || 1));
    const base = (WIZ_FRIDGE_SPOTS[doors] || WIZ_FRIDGE_SPOTS[1]).slice();
    if ((unit.freezer || 'none') !== 'none') base.push(...WIZ_FREEZER_SPOTS);
    unit.children = base.map(([labelKey, icon, days]) => ({
      name: this._wizLabel(labelKey, icon),
      label_key: labelKey, icon, shelf_life: days,
    }));
  }

  _wizSpotRow(unit, spot, idx) {
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;align-items:center;gap:8px;'
      + 'padding:6px 0;';

    const icon = document.createElement('span');
    icon.style.cssText = 'width:24px;height:24px;flex-shrink:0;display:flex;'
      + 'opacity:.8;';
    icon.innerHTML = ICON_LIB_LOCATION[spot.icon] || ICONS.folder;
    line.appendChild(icon);

    const nameIn = document.createElement('input');
    nameIn.value = spot.name;
    nameIn.style.cssText = 'flex:1;min-width:0;min-height:40px;padding:6px;'
      + 'border-radius:6px;background:var(--bg-input);color:var(--text-main);'
      + 'border:1px solid var(--border-light);font-size:13px;';
    nameIn.onchange = () => { spot.name = nameIn.value.trim() || spot.name; };
    line.appendChild(nameIn);

    const days = document.createElement('input');
    days.type = 'number';
    days.min = '0';
    days.max = '365';
    days.value = String(spot.shelf_life || 0);
    days.title = this._t('wiz_shelf_life', 'Shelf life in days');
    days.style.cssText = 'width:58px;min-height:40px;text-align:center;'
      + 'padding:6px;border-radius:6px;background:var(--bg-input);'
      + 'color:var(--text-main);border:1px solid var(--border-light);'
      + 'font-size:13px;';
    days.onchange = () => { spot.shelf_life = Number(days.value) || 0; };
    line.appendChild(days);

    const del = document.createElement('button');
    del.type = 'button';
    del.style.cssText = 'min-width:40px;min-height:40px;background:none;'
      + 'border:none;color:var(--danger,#F44336);cursor:pointer;display:flex;'
      + 'align-items:center;justify-content:center;';
    del.innerHTML = ICONS.close;
    del.onclick = () => { unit.children.splice(idx, 1); this.renderWizardScreen(); };
    line.appendChild(del);
    return line;
  }

  // ------------------------------------------------------------ 6: cleanup

  async wizScanCleanup() {
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/locations_wizard', action: 'scan_cleanup' });
      this.wizIssues = res?.issues || [];
    } catch (e) {
      console.error(e);
      this.wizIssues = [];
    }
    this.renderWizardScreen();
  }

  _wizStepCleanup(root) {
    if (!this.wizIssues.length) {
      const ok = document.createElement('div');
      ok.style.cssText = 'padding:20px 0;color:var(--text-sub);font-size:13px;';
      ok.textContent = this._t('wiz_cleanup_none',
        'Nothing to tidy. Your locations look consistent.');
      root.appendChild(ok);
      return;
    }
    this.wizIssues.forEach((issue) => {
      const card = document.createElement('div');
      card.className = 'pending-card';
      card.style.cssText = 'margin-bottom:12px;';
      card.appendChild(this._wizCheckRow(
        this._t('wiz_fix_' + issue.kind, issue.kind) + '  (' + issue.count + ')',
        '', !!issue.chosen, (on) => { issue.chosen = on; }));
      const ex = document.createElement('div');
      ex.style.cssText = 'font-size:12px;color:var(--text-sub);'
        + 'margin-top:6px;padding-inline-start:52px;word-break:break-word;';
      ex.textContent = (issue.examples || []).join('  ·  ');
      card.appendChild(ex);
      root.appendChild(card);
    });
  }

  // ------------------------------------------------------------- 7: review

  _wizStepReview(root) {
    const plan = this._wizPlanPreview();
    const sum = document.createElement('div');
    sum.style.cssText = 'padding:10px 12px;margin-bottom:14px;'
      + 'border-radius:8px;background:var(--bg-input-edit);font-size:13px;';
    sum.textContent = this._t('wiz_summary',
      '{0} new, {1} already there')
      .replace('{0}', plan.filter((p) => p.isNew).length)
      .replace('{1}', plan.filter((p) => !p.isNew).length);
    root.appendChild(sum);

    plan.forEach((entry) => {
      const line = document.createElement('div');
      line.style.cssText = 'display:flex;align-items:center;gap:8px;'
        + 'padding:5px 0;font-size:13px;'
        + 'padding-inline-start:' + (entry.depth * 16) + 'px;';
      const tag = document.createElement('span');
      tag.style.cssText = 'font-size:10px;padding:2px 6px;border-radius:4px;'
        + 'flex-shrink:0;background:'
        + (entry.isNew ? 'var(--primary,#4fc3f7);color:#000'
                       : 'var(--border-light,#333);color:var(--text-sub)');
      tag.textContent = entry.isNew ? this._t('wiz_tag_new', 'NEW')
                                    : this._t('wiz_tag_have', 'EXISTS');
      line.appendChild(tag);
      const nm = document.createElement('span');
      nm.style.cssText = 'flex:1;min-width:0;overflow:hidden;'
        + 'text-overflow:ellipsis;white-space:nowrap;';
      nm.textContent = entry.name;
      line.appendChild(nm);
      root.appendChild(line);
    });

    if (this.wizResult) {
      const res = document.createElement('div');
      res.style.cssText = 'margin-top:16px;padding:10px 12px;border-radius:8px;'
        + 'font-size:13px;background:var(--bg-input-edit);';
      res.textContent = this._t('wiz_done', 'Created {0} locations.')
        .replace('{0}', (this.wizResult.created || []).length);
      root.appendChild(res);
    }
  }

  // The same shape the backend plans, so the review shows what will happen
  // rather than something close to it. Existence is judged with the order
  // marker stripped, which is how the backend judges it too.
  _wizPlanPreview() {
    const out = [];
    const clean = (s) => String(s || '')
      .replace(/\[?\s*(?:ORDER_MARKER|ZONE_MARKER)_\d+\s*\]?[_\s]*/g, '')
      .trim();
    const tree = this.wizTree || {};
    const l1s = Object.keys(tree);

    (this.wizProfile.floors || []).forEach((floor) => {
      const label = (floor.label || '').trim();
      if (label) {
        out.push({
          name: label, depth: 0,
          isNew: !l1s.some((k) => k.startsWith('ZONE_MARKER')
                                  && clean(k) === clean(label)),
        });
      }
      (floor.rooms || []).forEach((room) => {
        const l1 = label ? '[' + label + '] ' + room.name : room.name;
        const roomKey = l1s.find((k) => clean(k) === clean(l1));
        out.push({ name: l1, depth: 1, isNew: !roomKey });
        (room.furniture || []).forEach((unit) => {
          const units = roomKey ? (tree[roomKey] || {}) : {};
          const unitKey = Object.keys(units).find(
            (k) => clean(k) === clean(unit.name));
          out.push({ name: unit.name, depth: 2, isNew: !unitKey });
          (unit.children || []).forEach((spot) => {
            const spots = unitKey ? (units[unitKey] || []) : [];
            const name = typeof spot === 'string' ? spot : spot.name;
            out.push({
              name, depth: 3,
              isNew: !spots.some((s) => clean(s) === clean(name)),
            });
          });
        });
      });
    });
    return out;
  }

  async wizApply() {
    if (this.wizBusy) return;
    this.wizBusy = true;
    this.renderWizardScreen();
    try {
      const res = await this._hass.callWS({
        type: 'home_organizer/locations_wizard', action: 'apply',
        profile: this.wizProfile });
      this.wizResult = res || null;
      if (res && (res.failed || []).length) {
        console.warn('Home Organizer: some locations were not created',
                     res.failed);
      }
      this.wizAppliedBefore = true;
      await this.fetchData();
    } catch (e) {
      console.error('The wizard could not create the locations', e);
      this.wizResult = null;
    }
    this.wizBusy = false;
    if (this.wizResult) {
      // Applied: leave the wizard and show the house it just built.
      this.closeLocationsWizard();
      this.navigate('root');
    } else {
      this.renderWizardScreen();
    }
  }

  // ------------------------------------------------------------- the pieces

  _wizGrid(parent) {
    const grid = document.createElement('div');
    // Two across on a phone, more as the screen allows. auto-fill rather
    // than a media query, so there is no fourth set of breakpoints.
    grid.style.cssText = 'display:grid;gap:10px;'
      + 'grid-template-columns:repeat(auto-fill,minmax(104px,1fr));';
    parent.appendChild(grid);
    return grid;
  }

  _wizTile(label, svg, on, onPick) {
    const tile = document.createElement('div');
    tile.style.cssText = 'position:relative;min-height:88px;border-radius:10px;'
      + 'display:flex;flex-direction:column;align-items:center;'
      + 'justify-content:center;gap:6px;cursor:pointer;padding:8px;'
      + 'background:var(--bg-input-edit);border:2px solid '
      + (on ? 'var(--primary,#4fc3f7)' : 'transparent') + ';';
    if (svg) {
      const ic = document.createElement('span');
      ic.style.cssText = 'width:32px;height:32px;display:flex;';
      ic.innerHTML = svg;
      tile.appendChild(ic);
    }
    const tx = document.createElement('div');
    tx.style.cssText = 'font-size:12px;text-align:center;line-height:1.3;'
      + 'word-break:break-word;';
    tx.textContent = label;
    tile.appendChild(tx);
    if (on) {
      const v = document.createElement('span');
      v.style.cssText = 'position:absolute;top:4px;inset-inline-end:4px;'
        + 'width:16px;height:16px;color:var(--primary,#4fc3f7);display:flex;';
      v.innerHTML = ICONS.check;
      tile.appendChild(v);
    }
    tile.onclick = onPick;
    return tile;
  }

  _wizCountTile(label, svg, count, onChange) {
    const tile = this._wizTile(label, svg, count > 0, () => {
      onChange(count > 0 ? 0 : 1);
    });
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;'
      + 'margin-top:2px;';
    [['-', -1], ['+', 1]].forEach(([sign, delta], i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.cssText = 'width:30px;height:30px;border-radius:6px;'
        + 'background:var(--bg-input);color:var(--text-main);'
        + 'border:1px solid var(--border-light);cursor:pointer;'
        + 'font-size:16px;line-height:1;';
      b.textContent = sign;
      b.onclick = (e) => { e.stopPropagation(); onChange(count + delta); };
      if (i === 1) {
        const n = document.createElement('span');
        n.style.cssText = 'min-width:18px;text-align:center;font-size:13px;';
        n.textContent = String(count);
        row.appendChild(n);
      }
      row.appendChild(b);
    });
    tile.appendChild(row);
    return tile;
  }

  // A row, for the lists that are too long to read as a grid.
  _wizCheckRow(label, svg, on, onToggle) {
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;align-items:center;gap:10px;'
      + 'padding:4px 0;';
    // A label WRAPPING the input toggles it natively on tap, so the hit area
    // is 44px while the drawn box stays small (RULE 36).
    const hit = document.createElement('label');
    hit.style.cssText = 'display:flex;align-items:center;justify-content:center;'
      + 'min-width:44px;min-height:44px;flex-shrink:0;cursor:pointer;margin:0;';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!on;
    box.style.cssText = 'width:22px;height:22px;cursor:pointer;';
    box.onchange = () => onToggle(box.checked);
    hit.appendChild(box);
    line.appendChild(hit);
    if (svg) {
      const ic = document.createElement('span');
      ic.style.cssText = 'width:24px;height:24px;flex-shrink:0;display:flex;'
        + 'opacity:.85;';
      ic.innerHTML = svg;
      line.appendChild(ic);
    }
    const tx = document.createElement('span');
    tx.style.cssText = 'flex:1;min-width:0;font-size:13px;overflow:hidden;'
      + 'text-overflow:ellipsis;white-space:nowrap;';
    tx.textContent = label;
    line.appendChild(tx);
    return line;
  }

  _wizCountRow(label, svg, count, onChange) {
    const line = this._wizCheckRow(label, svg, count > 0, (on) => {
      onChange(on ? 1 : 0);
    });
    const minus = document.createElement('button');
    const plus = document.createElement('button');
    const n = document.createElement('span');
    n.style.cssText = 'min-width:20px;text-align:center;font-size:13px;';
    n.textContent = String(count);
    [[minus, '-', -1], [plus, '+', 1]].forEach(([b, sign, delta]) => {
      b.type = 'button';
      b.style.cssText = 'width:36px;height:36px;border-radius:6px;'
        + 'background:var(--bg-input);color:var(--text-main);flex-shrink:0;'
        + 'border:1px solid var(--border-light);cursor:pointer;font-size:16px;'
        + 'line-height:1;';
      b.textContent = sign;
      b.onclick = () => onChange(count + delta);
    });
    line.appendChild(minus);
    line.appendChild(n);
    line.appendChild(plus);
    return line;
  }
};
