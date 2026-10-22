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
// [FIXED v2026.10.14 | 2026-10-14] Purpose: Cache version 10.11.122. The
//   receipts tab changed - an undated receipt is labelled, and dated on its
//   row from a field that starts at the day it was scanned - and a browser
//   holding an older view-chat.js would go on showing the old row.
//   10.11.121 carried the first half of the same change.
// [FIXED v2026.10.13 | 2026-10-13] Purpose: Cache version 10.11.120. The
//   Stylist page builds its photo address from the backend's prefix now,
//   and a browser still holding the old file would go on asking /local/
//   for a photo that is kept in /media.
//
//   RECORDED LATE: 10.11.114 to 10.11.118 had no entry here. Each was for a
//   changed module - the dashboard's clickable categories and wave chart,
//   the recipe versions, the parse error that left the panel blank - and
//   st56 now refuses a module whose content changes under a tag it has
//   already recorded. 10.11.119 was this change's first build.

// ONE version tag for every import in the frontend. A browser treats each url
// as its own module, so a file imported under two tags is loaded twice and one
// copy goes stale - a new icon then shows as the word `undefined`. Bump this
// number in every file whenever any module changes; st41 and st56 enforce it.
import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=10.11.122';
import { UtilsMixin }  from './organizer-utils.js?v=10.11.122';
import { StateMixin }  from './organizer-state.js?v=10.11.122';
import { APIMixin }    from './organizer-api.js?v=10.11.122';
import { CameraMixin } from './organizer-camera.js?v=10.11.122';
import { NavMixin }    from './organizer-nav.js?v=10.11.122';
import { IconsMixin }  from './organizer-icons.js?v=10.11.122';
import { UIMixin }     from './organizer-ui.js?v=10.11.122';

import { StylistMixin }   from './pages/view-stylist.js?v=10.11.122';
import { BarcodeMixin }   from './pages/view-barcode.js?v=10.11.122';
import { InventoryMixin } from './pages/view-inventory.js?v=10.11.122';
import { BoxMixin }       from './pages/view-box.js?v=10.11.122';
import { ChatMixin }      from './pages/view-chat.js?v=10.11.122';
// [ADDED v2026.9.22] The home dashboard.
import { DashboardMixin } from './pages/view-dashboard.js?v=10.11.122';
// [ADDED v10.11.45] The cookbook screen.
import { RecipesMixin }   from './pages/view-recipes.js?v=10.11.122';
import { ShoppingMixin }  from './pages/view-shopping.js?v=10.11.122';
import { SearchMixin }    from './pages/view-search.js?v=10.11.122';
import { CategoriesMixin } from './pages/view-categories.js?v=10.11.122';
import { WizardMixin }     from './pages/view-wizard.js?v=10.11.122';

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