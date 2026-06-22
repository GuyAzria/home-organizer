// organizer-panel.js — Home Organizer Ultimate v10.4.1
// [MODIFIED v10.4.1 | 2026-04-17] Purpose: Version bump to bypass cache for the new Interactive Unit Select Dropdown in the Inventory View.

import { ICONS, ICON_LIB, ICON_LIB_ROOM, ICON_LIB_LOCATION, ICON_LIB_ITEM } from './organizer-icon.js?v=10.6.7';
import { ITEM_CATEGORIES } from './organizer-data.js?v=10.6.7';
import { UtilsMixin }  from './organizer-utils.js?v=10.6.7';
import { StateMixin }  from './organizer-state.js?v=10.6.7';
import { APIMixin }    from './organizer-api.js?v=10.6.7';
import { CameraMixin } from './organizer-camera.js?v=10.6.7';
import { NavMixin }    from './organizer-nav.js?v=10.6.7';
import { IconsMixin }  from './organizer-icons.js?v=10.6.7';
import { UIMixin }     from './organizer-ui.js?v=10.6.7';

import { StylistMixin }   from './pages/view-stylist.js?v=10.6.7';
import { BarcodeMixin }   from './pages/view-barcode.js?v=10.6.7';
import { InventoryMixin } from './pages/view-inventory.js?v=10.6.7';
import { ChatMixin }      from './pages/view-chat.js?v=10.6.7';
import { ShoppingMixin }  from './pages/view-shopping.js?v=10.6.7';
import { SearchMixin }    from './pages/view-search.js?v=10.6.7';

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