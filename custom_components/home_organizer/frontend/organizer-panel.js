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
// [MODIFIED v2026.9.20 | 2026-09-20] Purpose: Cache version 10.11.49.
//   Not cosmetic. Features land in pairs of files that must arrive
//   together: organizer-icons.js gained drawIconWithAi and organizer-ui.js
//   the row that calls it; organizer-api.js gained
//   acceptCategorySuggestion and view-chat.js the banner that calls it;
//   view-inventory.js gained the class names the phone layout in
//   inventory.css is written against. A browser holding one old copy of
//   any pair would render a button with no handler, or a card with no
//   layout.
// [MODIFIED v2026.9.20 | 2026-09-20] Purpose: restoreNavState is called
//   after initUI - it needs the search box to exist - and before the
//   first fetchData, so that fetch loads the screen the user left
//   rather than the root. See organizer-state.js for why the position
//   lives in localStorage. Cache version bumped with it, because a
//   browser holding the old organizer-state.js would have no
//   restoreNavState to call.

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=10.11.49';
import { UtilsMixin }  from './organizer-utils.js?v=10.11.49';
import { StateMixin }  from './organizer-state.js?v=10.11.49';
import { APIMixin }    from './organizer-api.js?v=10.11.49';
import { CameraMixin } from './organizer-camera.js?v=10.11.49';
import { NavMixin }    from './organizer-nav.js?v=10.11.49';
import { IconsMixin }  from './organizer-icons.js?v=10.11.49';
import { UIMixin }     from './organizer-ui.js?v=10.11.49';

import { StylistMixin }   from './pages/view-stylist.js?v=10.11.49';
import { BarcodeMixin }   from './pages/view-barcode.js?v=10.11.49';
import { InventoryMixin } from './pages/view-inventory.js?v=10.11.49';
import { ChatMixin }      from './pages/view-chat.js?v=10.11.49';
// [ADDED v10.11.45] The cookbook screen.
import { RecipesMixin }   from './pages/view-recipes.js?v=10.11.49';
import { ShoppingMixin }  from './pages/view-shopping.js?v=10.11.49';
import { SearchMixin }    from './pages/view-search.js?v=10.11.49';

class HomeOrganizerPanel extends APIMixin(CameraMixin(SearchMixin(ShoppingMixin(RecipesMixin(ChatMixin(InventoryMixin(BarcodeMixin(StylistMixin(UIMixin(NavMixin(IconsMixin(UtilsMixin(StateMixin(HTMLElement)))))))))))))) {
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