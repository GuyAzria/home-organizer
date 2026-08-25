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
// [MODIFIED v10.4.1 | 2026-04-17] Purpose: Version bump to bypass cache for the new Interactive Unit Select Dropdown in the Inventory View.

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=10.7.1';
import { ITEM_CATEGORIES } from './organizer-data.js?v=10.7.1';
import { UtilsMixin }  from './organizer-utils.js?v=10.7.1';
import { StateMixin }  from './organizer-state.js?v=10.7.1';
import { APIMixin }    from './organizer-api.js?v=10.7.1';
import { CameraMixin } from './organizer-camera.js?v=10.7.1';
import { NavMixin }    from './organizer-nav.js?v=10.7.1';
import { IconsMixin }  from './organizer-icons.js?v=10.7.1';
import { UIMixin }     from './organizer-ui.js?v=10.7.1';

import { StylistMixin }   from './pages/view-stylist.js?v=10.7.1';
import { BarcodeMixin }   from './pages/view-barcode.js?v=10.7.1';
import { InventoryMixin } from './pages/view-inventory.js?v=10.7.1';
import { ChatMixin }      from './pages/view-chat.js?v=10.7.1';
import { ShoppingMixin }  from './pages/view-shopping.js?v=10.7.1';
import { SearchMixin }    from './pages/view-search.js?v=10.7.1';

class HomeOrganizerPanel extends APIMixin(CameraMixin(SearchMixin(ShoppingMixin(ChatMixin(InventoryMixin(BarcodeMixin(StylistMixin(UIMixin(NavMixin(IconsMixin(UtilsMixin(StateMixin(HTMLElement))))))))))))) {
  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      console.log("%c Home Organizer v10.4.1 SPA Loaded ", "background: #e91e63; color: #fff; font-weight: bold;");
      this.initState();
      this.initUI();
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