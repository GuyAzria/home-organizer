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
// [MODIFIED v2026.9.22 | 2026-09-22] Purpose: Cache version 10.11.81.
//   The dashboard is laid out as a grid and view-dashboard.js builds the
//   hero figure it needs; organizer-state.js learned about isDashboardMode
//   and organizer-ui.js moved the FAB. A browser still holding an older tag
//   would have the old state module - which saves 'home' for the dashboard -
//   beside the new shell, and the refresh this release exists to fix would
//   still drop the user on the locations screen.
//   Before that, 10.11.78: localeTag moved into UtilsMixin, and a class
//   without it throws inside the cook's voice and every figure on the
//   dashboard. A tag is bumped for the MODULE that changed, and every module
//   that imports it under its own tag is bumped with it: an import URL is
//   its own cache entry.
// [MODIFIED v2026.9.22 | 2026-09-22] Purpose: Cache version 10.11.77.
//   organizer-ui.js carries the panel's <style> block inline, so a change
//   to the FAB is a change to that module and nothing else picks it up.

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=10.11.81';
import { UtilsMixin }  from './organizer-utils.js?v=10.11.81';
import { StateMixin }  from './organizer-state.js?v=10.11.81';
import { APIMixin }    from './organizer-api.js?v=10.11.81';
import { CameraMixin } from './organizer-camera.js?v=10.11.81';
import { NavMixin }    from './organizer-nav.js?v=10.11.81';
import { IconsMixin }  from './organizer-icons.js?v=10.11.81';
import { UIMixin }     from './organizer-ui.js?v=10.11.81';

import { StylistMixin }   from './pages/view-stylist.js?v=10.11.81';
import { BarcodeMixin }   from './pages/view-barcode.js?v=10.11.81';
import { InventoryMixin } from './pages/view-inventory.js?v=10.11.81';
import { ChatMixin }      from './pages/view-chat.js?v=10.11.81';
// [ADDED v2026.9.22] The home dashboard.
import { DashboardMixin } from './pages/view-dashboard.js?v=10.11.81';
// [ADDED v10.11.45] The cookbook screen.
import { RecipesMixin }   from './pages/view-recipes.js?v=10.11.81';
import { ShoppingMixin }  from './pages/view-shopping.js?v=10.11.81';
import { SearchMixin }    from './pages/view-search.js?v=10.11.81';

class HomeOrganizerPanel extends APIMixin(CameraMixin(SearchMixin(ShoppingMixin(RecipesMixin(ChatMixin(DashboardMixin(InventoryMixin(BarcodeMixin(StylistMixin(UIMixin(NavMixin(IconsMixin(UtilsMixin(StateMixin(HTMLElement))))))))))))))) {
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
    }
  }
  setConfig(config) { this._config = config; }
  getCardSize() { return 10; }
}

if (!customElements.get('home-organizer-panel')) { customElements.define('home-organizer-panel', HomeOrganizerPanel); }