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
// [FIXED v2026.10.7 | 2026-10-07] Purpose: Cache version 10.11.112 - and it is
//   now the ONLY version string in the frontend.
//
//   organizer-icon.js was imported by twelve files under ELEVEN different
//   tags, and organizer-utils.js by eight files under eight. A browser
//   treats each url as its own module, so the same file was downloaded and
//   instantiated many times over and most of those copies were stale: the
//   gear menu imported the icons as ?v=10.3.0 and was therefore drawn from
//   a cache older than several releases. A newly added icon came out as the
//   word `undefined` on screen and an icon that had been redrawn kept
//   appearing in its old form, with nothing wrong in either file.
//
//   Bumping the panel never fixed it, because the panel's tag reaches only
//   the modules the panel imports DIRECTLY. Every import in the frontend
//   now carries this one number, so one bump invalidates everything, and
//   st41 asserts that no module is ever served under two of them again.
//
//   The locations wizard is the eighteenth mixin in the chain.
//
//   109 rather than 108: the wizard gained its first-run banner, and a
//   browser still holding the old files would show neither it nor the
//   menu entry that opens the wizard by hand.
// [FIXED v2026.10.6 | 2026-10-06] Purpose: Cache version 10.11.107. The
//   barcode scanner changed, and a browser still holding the old file would
//   carry on reporting a number that was never on the packet.

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=10.11.112';
import { UtilsMixin }  from './organizer-utils.js?v=10.11.112';
import { StateMixin }  from './organizer-state.js?v=10.11.112';
import { APIMixin }    from './organizer-api.js?v=10.11.112';
import { CameraMixin } from './organizer-camera.js?v=10.11.112';
import { NavMixin }    from './organizer-nav.js?v=10.11.112';
import { IconsMixin }  from './organizer-icons.js?v=10.11.112';
import { UIMixin }     from './organizer-ui.js?v=10.11.112';

import { StylistMixin }   from './pages/view-stylist.js?v=10.11.112';
import { BarcodeMixin }   from './pages/view-barcode.js?v=10.11.112';
import { InventoryMixin } from './pages/view-inventory.js?v=10.11.112';
import { BoxMixin }       from './pages/view-box.js?v=10.11.112';
import { ChatMixin }      from './pages/view-chat.js?v=10.11.112';
// [ADDED v2026.9.22] The home dashboard.
import { DashboardMixin } from './pages/view-dashboard.js?v=10.11.112';
// [ADDED v10.11.45] The cookbook screen.
import { RecipesMixin }   from './pages/view-recipes.js?v=10.11.112';
import { ShoppingMixin }  from './pages/view-shopping.js?v=10.11.112';
import { SearchMixin }    from './pages/view-search.js?v=10.11.112';
import { CategoriesMixin } from './pages/view-categories.js?v=10.11.112';
import { WizardMixin }     from './pages/view-wizard.js?v=10.11.112';

class HomeOrganizerPanel extends APIMixin(WizardMixin(CategoriesMixin(CameraMixin(SearchMixin(ShoppingMixin(RecipesMixin(ChatMixin(DashboardMixin(BoxMixin(InventoryMixin(BarcodeMixin(StylistMixin(UIMixin(NavMixin(IconsMixin(UtilsMixin(StateMixin(HTMLElement)))))))))))))))))) {
  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      console.log("%c Home Organizer v10.4.1 SPA Loaded ", "background: #e91e63; color: #fff; font-weight: bold;");
      this.initState();
      this.initUI();
      // [ADDED v2026.9.20] Put the user back on the screen they left.
      // After initUI, because it needs the search box to exist; before the
      // first fetchData below, so that fetch loads the restored path
      // instead of the root.
      this.restoreNavState();
      
      this.loadTranslations();
      this.fetchAllItems();
    }
    if (this._hass?.connection && !this.subscribed) {
      this.subscribed = true;
      this._hass.connection.subscribeEvents(() => { this.fetchData(); }, 'home_organizer_db_update');
      this._hass.connection.subscribeEvents(e => {
        if (e.data.mode === 'identify') {
          const result = e.data.result || {};
          if (this._aiResolve) { this._aiResolve({ suggestions: result.suggestions || [], pending: result.pending || {} }); this._aiResolve = null; }
        }
      }, 'home_organizer_ai_result');
      this._hass.connection.subscribeEvents(e => { this.handleChatProgress(e.data); }, 'home_organizer_chat_progress');
      this._hass.connection.subscribeEvents(e => { this.handleExternalCameraEvent(e.data); }, 'ho_ext_camera_event');
      this.fetchData();
      this._hass.connection.subscribeEvents(() => { this.fetchAllItems(); }, 'home_organizer_db_update');
      // [ADDED v2026.9.27] The dashboard reads items, receipts and
      // purchase_history, so anything that fires this event can have moved its
      // figures. The stored copy is dropped; nothing is fetched here, because
      // approving fifty lines of one receipt would otherwise run the whole
      // dashboard query fifty times.
      this._hass.connection.subscribeEvents(() => {
        if (typeof this.markDashboardStale === 'function') this.markDashboardStale();
      }, 'home_organizer_db_update');
    }
  }
  setConfig(config) { this._config = config; }
  getCardSize() { return 10; }
}

if (!customElements.get('home-organizer-panel')) { customElements.define('home-organizer-panel', HomeOrganizerPanel); }