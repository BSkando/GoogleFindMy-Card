// Google Find My Device Card for Home Assistant
// Version: 1.0.6 - Bug fixes: editor entity selection, config persistence, UI positioning, zoom control placement, responsive map resize

import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.5.1/lit-element.js?module";

// Load Leaflet.js for interactive maps
const loadLeaflet = () => {
  if (window.L) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

class GoogleFindMyCard extends LitElement {
  static get properties() {
    return {
      config: { type: Object },
      _selectedDevice: { type: String },
      _showDeviceList: { type: Boolean },
      _leafletLoaded: { type: Boolean },
      _locationHistory: { type: Array },
      _historyDays: { type: Number },
      _accuracyFilter: { type: Number },
      _showFilters: { type: Boolean },
      _markerOpacity: { type: Number },
    };
  }

  constructor() {
    super();
    this._selectedDevice = null;
    this._showDeviceList = false;
    this._mapInstance = null;
    this._mapContainer = null;
    this._leafletLoaded = false;
    this._locationHistory = [];

    // Load filter settings from localStorage with defaults
    const savedSettings = this._loadFilterSettings();
    this._historyDays = savedSettings.historyDays;
    this._accuracyFilter = savedSettings.accuracyFilter;
    this._markerOpacity = savedSettings.markerOpacity;
    this._showFilters = false;
    this._hass = null;

    // Bind resize handler
    this._handleResize = this._handleResize.bind(this);

    // Load Leaflet library
    console.log('[GoogleFindMy] Loading Leaflet.js...');
    loadLeaflet().then(() => {
      this._leafletLoaded = true;
      console.log('[GoogleFindMy] Leaflet loaded successfully:', !!window.L);
      this.requestUpdate();
    }).catch(err => {
      console.error('[GoogleFindMy] Failed to load Leaflet:', err);
    });
  }

  _loadFilterSettings() {
    try {
      const saved = localStorage.getItem('googlefindmy-filter-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        return {
          historyDays: settings.historyDays || 3,
          accuracyFilter: settings.accuracyFilter || 0,
          markerOpacity: settings.markerOpacity || 100
        };
      }
    } catch (err) {
      console.warn('[GoogleFindMy] Failed to load filter settings:', err);
    }
    // Return defaults
    return {
      historyDays: 3,
      accuracyFilter: 0,
      markerOpacity: 100
    };
  }

  _saveFilterSettings() {
    try {
      const settings = {
        historyDays: this._historyDays,
        accuracyFilter: this._accuracyFilter,
        markerOpacity: this._markerOpacity
      };
      localStorage.setItem('googlefindmy-filter-settings', JSON.stringify(settings));
    } catch (err) {
      console.warn('[GoogleFindMy] Failed to save filter settings:', err);
    }
  }

  set hass(value) {
    const oldHass = this._hass;
    this._hass = value;

    // Only update map if coordinates changed
    if (oldHass && this._leafletLoaded && this._selectedDevice) {
      const devices = this._getDevices();
      const selectedDevice = devices.find(d => d.entity_id === this._selectedDevice) || devices[0];
      if (selectedDevice) {
        const oldEntity = oldHass.states[selectedDevice.entity_id];
        const newEntity = value.states[selectedDevice.entity_id];

        if (oldEntity && newEntity &&
            (oldEntity.attributes.latitude !== newEntity.attributes.latitude ||
             oldEntity.attributes.longitude !== newEntity.attributes.longitude)) {
          this._updateMap();
        }
      }
    }
  }

  get hass() {
    return this._hass;
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has('config') && this.config) {
      // Set initial device list state based on config
      if (this.config.keep_device_list_pinned) {
        this._showDeviceList = true;
      }
    }

    // Initialize or update map when Leaflet loads or selected device changes
    if ((changedProperties.has('_leafletLoaded') || changedProperties.has('_selectedDevice')) && this._leafletLoaded) {
      // Fetch new history when device changes
      if (changedProperties.has('_selectedDevice') && this._selectedDevice) {
        this._fetchLocationHistory();
      }
      this._updateMap();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    // Add resize listener
    window.addEventListener('resize', this._handleResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Remove resize listener
    window.removeEventListener('resize', this._handleResize);
    // Clean up map instance
    if (this._mapInstance) {
      this._mapInstance.remove();
      this._mapInstance = null;
    }
  }

  _handleResize() {
    // Invalidate map size when window resizes
    if (this._mapInstance) {
      setTimeout(() => {
        if (this._mapInstance) {
          this._mapInstance.invalidateSize();
        }
      }, 100);
    }
  }


  static get styles() {
    return css`
      :host {
        display: flex;
        flex-direction: column;
        font-family: 'Google Sans', 'Roboto', sans-serif;
        height: 100%;
        overflow: hidden;
      }

      /* Lower z-index for edit mode compatibility */
      .card-header,
      .device-sidebar {
        z-index: 1 !important;
      }

      ha-card {
        height: 100%;
        max-height: 100vh;
        display: flex;
        width: 100%;
        flex-direction: column;
        overflow: hidden;
        padding: 0;
        box-sizing: border-box;
        background: #ffffff;
        border: none;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .card-header {
        position: absolute;
        top: 10px;
        left: 12px;
        right: 12px;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        padding: 8px 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        height: 60px;
        box-sizing: border-box;
      }

      .card-title {
        font-size: 18px;
        font-weight: 500;
        color: #202124;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Google Sans', sans-serif;
      }

      .card-icon {
        width: 24px;
        height: 24px;
        color: #1a73e8;
        margin-right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .control-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .control-button {
        width: 36px;
        height: 36px;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid #dadce0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        color: #5f6368;
        position: relative;
      }

      .control-button:hover {
        background: #f8f9fa;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .control-button.active {
        background: #1a73e8;
        color: white;
        border-color: #1a73e8;
      }

      .control-button ha-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        --mdc-icon-size: 20px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .map-container {
        flex: 1 1 0;
        width: 100%;
        min-height: 0;
        position: relative;
        background: #f8f9fa;
        overflow: hidden;
      }

      .map-iframe {
        width: 100%;
        height: 100%;
        border: none;
      }

      /* Leaflet map container */
      #leaflet-map {
        width: 100%;
        height: 100%;
        z-index: 0;
      }

      /* Critical Leaflet CSS - required for proper tile positioning */
      #leaflet-map .leaflet-pane,
      #leaflet-map .leaflet-tile,
      #leaflet-map .leaflet-marker-icon,
      #leaflet-map .leaflet-marker-shadow,
      #leaflet-map .leaflet-tile-container,
      #leaflet-map .leaflet-pane > svg,
      #leaflet-map .leaflet-pane > canvas,
      #leaflet-map .leaflet-zoom-box,
      #leaflet-map .leaflet-image-layer,
      #leaflet-map .leaflet-layer {
        position: absolute;
        left: 0;
        top: 0;
      }

      .leaflet-container {
        overflow: hidden;
        font-family: 'Google Sans', 'Roboto', sans-serif;
      }

      .leaflet-tile,
      .leaflet-marker-icon,
      .leaflet-marker-shadow {
        user-select: none;
        -webkit-user-drag: none;
      }

      .leaflet-tile {
        filter: inherit;
        visibility: hidden;
      }

      .leaflet-tile-loaded {
        visibility: inherit;
      }

      .leaflet-container .leaflet-overlay-pane svg {
        max-width: none !important;
        max-height: none !important;
      }

      .leaflet-container .leaflet-marker-pane img,
      .leaflet-container .leaflet-shadow-pane img,
      .leaflet-container .leaflet-tile-pane img,
      .leaflet-container img.leaflet-image-layer,
      .leaflet-container .leaflet-tile {
        max-width: none !important;
        max-height: none !important;
        width: auto;
        padding: 0;
      }

      .leaflet-overlay-pane svg {
        user-select: none;
      }

      .leaflet-pane {
        z-index: 400;
      }

      .leaflet-tile-pane {
        z-index: 200;
      }

      .leaflet-overlay-pane {
        z-index: 400;
      }

      .leaflet-shadow-pane {
        z-index: 500;
      }

      .leaflet-marker-pane {
        z-index: 600;
      }

      .leaflet-tooltip-pane {
        z-index: 650;
      }

      .leaflet-pane > svg path,
      .leaflet-tile-container {
        pointer-events: none;
      }

      .leaflet-pane > svg path.leaflet-interactive,
      svg.leaflet-image-layer.leaflet-interactive path {
        pointer-events: auto;
      }

      .leaflet-container.leaflet-touch-zoom {
        touch-action: pan-x pan-y;
      }

      .leaflet-container.leaflet-touch-drag {
        touch-action: pinch-zoom;
      }

      .leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {
        touch-action: none;
      }

      /* Leaflet controls */
      .leaflet-control {
        position: relative;
        z-index: 800;
        pointer-events: visiblePainted;
        pointer-events: auto;
      }

      .leaflet-top,
      .leaflet-bottom {
        position: absolute;
        z-index: 1000;
        pointer-events: none;
      }

      .leaflet-top {
        top: 0;
      }

      .leaflet-right {
        right: 0;
      }

      .leaflet-bottom {
        bottom: 0;
      }

      .leaflet-left {
        left: 0;
      }

      .leaflet-control {
        float: left;
        clear: both;
      }

      .leaflet-right .leaflet-control {
        float: right;
      }

      .leaflet-top .leaflet-control {
        margin-top: 10px;
      }

      .leaflet-bottom .leaflet-control {
        margin-bottom: 10px;
      }

      .leaflet-left .leaflet-control {
        margin-left: 10px;
      }

      .leaflet-right .leaflet-control {
        margin-right: 10px;
      }

      /* Move zoom control to bottom-right */
      .leaflet-top.leaflet-left {
        top: auto;
        bottom: 12px;
        left: auto;
        right: 12px;
      }

      /* Move attribution to bottom-center */
      .leaflet-control-attribution {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.8);
        padding: 0 8px;
        font-size: 11px;
        text-align: center;
        margin: 0 !important;
      }

      .leaflet-bottom.leaflet-right {
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        pointer-events: none;
      }

      .leaflet-bottom.leaflet-right .leaflet-control {
        float: none;
        display: inline-block;
        pointer-events: auto;
      }

      /* Zoom control */
      .leaflet-bar {
        box-shadow: 0 1px 5px rgba(0,0,0,0.65);
        border-radius: 4px;
      }

      .leaflet-bar a {
        background-color: #fff;
        border-bottom: 1px solid #ccc;
        width: 26px;
        height: 26px;
        line-height: 26px;
        display: block;
        text-align: center;
        text-decoration: none;
        color: black;
      }

      .leaflet-bar a:hover {
        background-color: #f4f4f4;
      }

      .leaflet-bar a:first-child {
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
      }

      .leaflet-bar a:last-child {
        border-bottom-left-radius: 4px;
        border-bottom-right-radius: 4px;
        border-bottom: none;
      }

      .leaflet-bar a.leaflet-disabled {
        cursor: default;
        background-color: #f4f4f4;
        color: #bbb;
      }

      .leaflet-touch .leaflet-bar a {
        width: 30px;
        height: 30px;
        line-height: 30px;
      }

      .leaflet-control-zoom-in,
      .leaflet-control-zoom-out {
        font: bold 18px 'Lucida Console', Monaco, monospace;
        text-indent: 1px;
      }

      .leaflet-touch .leaflet-control-zoom-in,
      .leaflet-touch .leaflet-control-zoom-out {
        font-size: 22px;
      }

      .leaflet-popup-content-wrapper {
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        border: 1px solid #e8eaed;
      }

      .leaflet-popup-content {
        margin: 12px;
        font-size: 13px;
        font-family: 'Google Sans', 'Roboto', sans-serif;
        color: #202124;
      }

      .leaflet-popup-tip {
        background: #ffffff;
        border: 1px solid #e8eaed;
      }

      /* Filter panel for map controls */
      .filter-panel {
        position: absolute;
        top: 80px;
        right: 12px;
        z-index: 1000;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        padding: 12px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        max-width: 300px;
        font-size: 13px;
      }

      .filter-panel.collapsed {
        padding: 8px;
      }

      .filter-panel.collapsed .filter-content {
        display: none;
      }

      .filter-toggle {
        background: #1a73e8;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        width: 100%;
      }

      .filter-toggle:hover {
        background: #1557b0;
      }

      .filter-content {
        margin-top: 12px;
      }

      .filter-section {
        margin: 12px 0;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;
      }

      .filter-section:last-child {
        border-bottom: none;
      }

      .filter-label {
        font-weight: 500;
        margin-bottom: 8px;
        display: block;
      }

      .time-range-buttons {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }

      .time-range-btn {
        background: #f1f3f4;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        flex: 1;
        min-width: 50px;
      }

      .time-range-btn.active {
        background: #1a73e8;
        color: white;
      }

      .time-range-btn:hover {
        background: #e8eaed;
      }

      .time-range-btn.active:hover {
        background: #1557b0;
      }

      .accuracy-slider-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .accuracy-slider {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        outline: none;
        cursor: pointer;
      }

      .accuracy-value {
        min-width: 60px;
        font-weight: 500;
        color: #1a73e8;
        font-size: 12px;
      }

      .device-sidebar {
        position: absolute;
        left: 12px;
        top: 80px;
        bottom: 12px;
        width: 200px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 1;
        overflow-y: auto;
        transform: translateX(-340px);
        transition: transform 0.3s ease;
      }

      .device-sidebar.open {
        transform: translateX(0);
      }

      .device-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .device-card {
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e8eaed;
        padding: 12px 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-height: 44px;
        -webkit-tap-highlight-color: rgba(0,0,0,0.1);
      }

      .device-card:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .device-card.selected {
        border-color: #1a73e8;
        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
      }

      .device-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 6px;
      }

      .device-icon {
        width: 28px;
        height: 28px;
        color: #1a73e8;
        flex-shrink: 0;
      }

      .device-info {
        flex: 1;
        min-width: 0;
      }

      .device-name {
        font-size: 16px;
        font-weight: 500;
        color: #202124;
        margin-bottom: 2px;
        font-family: 'Google Sans', sans-serif;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }


      .location-icon {
        width: 16px;
        height: 16px;
      }

      .device-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #5f6368;
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .status-dot.online {
        background: #34a853;
      }

      .status-dot.offline {
        background: #ea4335;
      }

      .status-dot.unknown {
        background: #fbbc04;
      }

      .device-location {
        font-size: 12px;
        color: #5f6368;
        margin-top: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .last-seen {
        font-size: 11px;
        color: #9aa0a6;
        margin-top: 2px;
      }

      .device-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
      }

      .action-button {
        width: auto;
        height: 20px;
        padding: 0 6px;
        background: #1a73e8;
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 9px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-family: 'Google Sans', sans-serif;
      }

      .action-button:hover {
        background: #1557b0;
      }

      .action-button.secondary {
        background: #ffffff;
        color: #1a73e8;
        border: 1px solid #dadce0;
      }

      .action-button.secondary:hover {
        background: #f8f9fa;
      }

      .no-devices {
        text-align: center;
        padding: 48px 24px;
        color: #5f6368;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        margin: 80px 16px 16px 16px;
      }

      /* Mobile responsive adjustments */
      @media (max-width: 768px) {
        .card-header {
          top: 8px;
          left: 8px;
          right: 8px;
          padding: 8px;
        }

        .card-title {
          font-size: 16px;
        }

        .control-button {
          width: 32px;
          height: 32px;
        }

        .device-sidebar {
          width: 180px;
          top: 80px;
          padding: 12px;
          transform: translateX(-220px);
        }

        .filter-panel {
          top: 80px;
          right: 8px;
          max-width: 250px;
          font-size: 12px;
        }

        .device-card {
          padding: 10px 12px;
        }

        .device-name {
          font-size: 14px;
        }
      }

      @media (max-width: 768px) {
        .card-header {
          top: 8px !important;
          left: 8px !important;
          right: 8px !important;
          padding: 6px !important;
          height: 60px !important;
        }

        .card-title {
          font-size: 14px !important;
        }

        .device-sidebar {
          width: 150px !important;
          max-width: 150px !important;
          left: 8px !important;
          right: auto !important;
          top: 80px !important;
          padding: 8px !important;
          transform: translateX(-166px) !important;
        }

        .device-sidebar.open {
          transform: translateX(0) !important;
          width: 150px !important;
          max-width: 150px !important;
          right: auto !important;
        }

        .device-list {
          gap: 8px !important;
        }

        .device-card {
          padding: 8px 12px !important;
          min-height: auto !important;
          border-radius: 8px !important;
        }

        .device-header {
          display: block !important;
          margin-bottom: 0 !important;
        }

        .device-icon {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
        }

        .device-info {
          width: 100% !important;
        }

        .device-name {
          font-size: 13px !important;
          font-weight: 500 !important;
          line-height: 1.3 !important;
          margin-bottom: 4px !important;
        }

        .device-status {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          font-size: 11px !important;
          color: #5f6368 !important;
        }

        .status-dot {
          width: 6px !important;
          height: 6px !important;
        }

        .device-location {
          display: none !important;
        }

        .filter-panel {
          top: 80px !important;
          right: 8px !important;
          max-width: 200px !important;
        }

        .filter-panel.collapsed {
          top: 80px !important;
        }
      }
    `;
  }

  setConfig(config) {
    // Accept empty entities array to allow configuration in editor
    if (!config.entities) {
      config.entities = [];
    }
    if (!Array.isArray(config.entities)) {
      throw new Error("Entities must be an array");
    }
    this.config = {
      title: "Find My Devices",
      show_last_seen: true,
      show_location_name: true,
      show_coordinates: false,
      enable_actions: true,
      compact_mode: false,
      keep_device_list_pinned: false,
      ...config,
    };
  }

  render() {
    if (!this.hass || !this.config) {
      return html``;
    }

    const devices = this._getDevices();

    return html`
      <ha-card>
        <div class="card-header">
          <div class="card-title">
            <ha-icon class="card-icon" icon="mdi:google-maps"></ha-icon>
            ${this.config.title || "Find My Devices"}
          </div>
          <div class="control-buttons">
            <div class="control-button ${this._showDeviceList ? 'active' : ''}"
                 @click=${this._toggleDeviceList}
                 title="${this.config.keep_device_list_pinned ? 'Device list pinned' : 'Toggle device list'}">
              <ha-icon icon="${this.config.keep_device_list_pinned ? 'mdi:pin' : 'mdi:format-list-bulleted'}"></ha-icon>
            </div>
            <div class="control-button" @click=${this._refreshAll} title="Refresh all devices">
              <ha-icon icon="mdi:refresh"></ha-icon>
            </div>
          </div>
        </div>

        ${this._renderMap(devices)}

        ${devices.length > 0 ? html`
          <div class="device-sidebar ${this._showDeviceList ? 'open' : ''}">
            <div class="device-list">
              ${devices.map(device => this._renderDeviceCard(device))}
            </div>
          </div>
        ` : html`
          <div class="no-devices">
            <ha-icon icon="mdi:devices" style="width: 48px; height: 48px;"></ha-icon>
            <p>No Google Find My Device trackers found</p>
          </div>
        `}
      </ha-card>
    `;
  }

  _renderMap(devices) {
    // Create a unified map view showing all devices
    if (devices.length === 0) return html``;

    const selectedDevice = this._selectedDevice ?
      devices.find(d => d.entity_id === this._selectedDevice) :
      devices[0];

    if (!selectedDevice) return html``;

    const entity = this.hass.states[selectedDevice.entity_id];
    if (!entity || !entity.attributes.latitude) {
      return html`
        <div class="map-container">
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #5f6368;">
            <div style="text-align: center;">
              <ha-icon icon="mdi:map-marker-off" style="width: 48px; height: 48px; opacity: 0.5;"></ha-icon>
              <p>Location not available</p>
            </div>
          </div>
        </div>
      `;
    }

    // Use Leaflet map if loaded, otherwise fall back to iframe
    console.log('[GoogleFindMy] Map render - Leaflet loaded:', this._leafletLoaded, 'Config:', this.config.use_leaflet_map);
    if (this._leafletLoaded && this.config.use_leaflet_map !== false) {
      console.log('[GoogleFindMy] Rendering Leaflet map');
      return html`
        <div class="map-container">
          <div id="leaflet-map"></div>
          ${this._renderFilterPanel()}
        </div>
      `;
    }

    // Fallback to iframe map
    const mapUrl = this._getMapUrl(entity);
    return html`
      <div class="map-container">
        ${mapUrl ? html`
          <iframe
            class="map-iframe"
            src="${mapUrl}"
            title="Device locations map"
            @error=${() => this._handleMapError(entity.entity_id)}>
          </iframe>
        ` : html`
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #5f6368;">
            <div style="text-align: center;">
              <ha-icon icon="mdi:map-marker-off" style="width: 48px; height: 48px; opacity: 0.5;"></ha-icon>
              <p>Map unavailable</p>
            </div>
          </div>
        `}

      </div>
    `;
  }

  _renderDeviceCard(device) {
    const entity = this.hass.states[device.entity_id];
    if (!entity) return html``;

    const isHome = entity.state === 'home';
    const isAway = entity.state === 'not_home';
    const lastSeen = entity.attributes.last_seen;
    const isSelected = this._selectedDevice === device.entity_id;

    // Get location display text
    const getLocationStatus = () => {
      // Check for coordinates first - GoogleFindMy devices often have state="unknown" but valid coordinates
      if (entity.attributes.latitude !== undefined && entity.attributes.longitude !== undefined) {
        // If we're in a zone, show that
        if (isHome) return 'At home';
        if (entity.state && entity.state !== 'unknown' && entity.state !== 'unavailable' && entity.state !== 'not_home') {
          // State is a zone name
          return entity.state.charAt(0).toUpperCase() + entity.state.slice(1);
        }
        // If we have location_name, use it
        if (entity.attributes.location_name) {
          return entity.attributes.location_name;
        }
        // We have coordinates but not in a known zone
        return 'Away';
      }

      // No coordinates - use state
      if (isHome) return 'At home';
      if (isAway) return 'Away';
      if (entity.state && entity.state !== 'unknown' && entity.state !== 'unavailable') {
        return entity.state.charAt(0).toUpperCase() + entity.state.slice(1);
      }

      return 'No location';
    };

    return html`
      <div class="device-card ${isSelected ? 'selected' : ''}"
           @click=${() => this._selectDevice(device.entity_id)}>
        <div class="device-header">
          <ha-icon class="device-icon" icon="${device.icon || 'mdi:map-marker-radius'}"></ha-icon>
          <div class="device-info">
            <div class="device-name">${device.name || entity.attributes.friendly_name}</div>
            <div class="device-status">
              <div class="status-dot ${isHome ? 'online' : isAway ? 'offline' : 'unknown'}"></div>
              ${getLocationStatus()}
            </div>
            ${entity.attributes.location_name ? html`
              <div class="device-location">${entity.attributes.location_name}</div>
            ` : ''}
            ${this.config.show_last_seen && lastSeen ? html`
              <div class="last-seen">${this._formatTime(lastSeen)}</div>
            ` : ''}
          </div>
        </div>

        ${isSelected && this.config.enable_actions ? html`
          <div class="device-actions">
            <button class="action-button" @click=${(e) => this._playSound(e, device.entity_id)}>
              <ha-icon icon="mdi:volume-high" style="width: 14px; height: 14px;"></ha-icon>
              Play sound
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  _getDevices() {
    if (!this.config.entities) return [];

    return this.config.entities.map(entity => {
      if (typeof entity === 'string') {
        return { entity_id: entity };
      }
      return entity;
    });
  }

  _toggleDeviceList() {
    // If pinned and currently open, don't allow closing
    if (this.config.keep_device_list_pinned && this._showDeviceList) {
      return;
    }
    this._showDeviceList = !this._showDeviceList;
    this.requestUpdate();
  }

  _selectDevice(entityId) {
    this._selectedDevice = entityId;
    this.requestUpdate();
  }


  _formatTime(timestamp) {
    if (!timestamp) return 'Unknown';

    let date;
    // Handle different timestamp formats
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // If timestamp is less than a recent date in milliseconds, assume it's in seconds
      date = timestamp < 1000000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
    } else {
      return 'Unknown';
    }

    // Check if date is valid
    if (isNaN(date.getTime())) return 'Unknown';

    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  _renderFilterPanel() {
    return html`
      <div class="filter-panel ${this._showFilters ? '' : 'collapsed'}">
        <button class="filter-toggle" @click=${() => { this._showFilters = !this._showFilters; }}>
          ${this._showFilters ? '✕ Close' : '📅 Filters'}
        </button>

        ${this._showFilters ? html`
          <div class="filter-content">
            <!-- Time Range Section -->
            <div class="filter-section">
              <span class="filter-label">Time Range</span>
              <div class="time-range-buttons">
                <button class="time-range-btn ${this._historyDays === 1 ? 'active' : ''}"
                        @click=${() => this._setHistoryDays(1)}>1d</button>
                <button class="time-range-btn ${this._historyDays === 3 ? 'active' : ''}"
                        @click=${() => this._setHistoryDays(3)}>3d</button>
                <button class="time-range-btn ${this._historyDays === 7 ? 'active' : ''}"
                        @click=${() => this._setHistoryDays(7)}>7d</button>
              </div>
            </div>

            <!-- Accuracy Filter Section -->
            <div class="filter-section">
              <span class="filter-label">Accuracy Filter</span>
              <div class="accuracy-slider-container">
                <input type="range" class="accuracy-slider"
                       min="0" max="300" step="10"
                       .value=${this._accuracyFilter}
                       @input=${(e) => this._setAccuracyFilter(e.target.value)}>
                <span class="accuracy-value">
                  ${this._accuracyFilter === 0 ? 'Off' : `${this._accuracyFilter}m`}
                </span>
              </div>
            </div>

            <!-- Marker Opacity Section -->
            <div class="filter-section">
              <span class="filter-label">Marker Transparency</span>
              <div class="accuracy-slider-container">
                <input type="range" class="accuracy-slider"
                       min="0" max="100" step="5"
                       .value=${this._markerOpacity}
                       @input=${(e) => this._setMarkerOpacity(e.target.value)}>
                <span class="accuracy-value">${this._markerOpacity}%</span>
              </div>
            </div>

            <div style="font-size: 11px; color: #666; margin-top: 8px;">
              ${this._locationHistory.length} location${this._locationHistory.length !== 1 ? 's' : ''} shown
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _setHistoryDays(days) {
    this._historyDays = days;
    this._saveFilterSettings();
    this._fetchLocationHistory();
  }

  _setAccuracyFilter(value) {
    this._accuracyFilter = parseInt(value);
    this._saveFilterSettings();
    this._updateMap();
  }

  _setMarkerOpacity(value) {
    this._markerOpacity = parseInt(value);
    this._saveFilterSettings();
    this._updateMap();
  }

  async _fetchLocationHistory() {
    const devices = this._getDevices();
    const selectedDevice = this._selectedDevice ?
      devices.find(d => d.entity_id === this._selectedDevice) :
      devices[0];

    if (!selectedDevice) {
      console.warn('[GoogleFindMy] No device selected for history fetch');
      return;
    }

    const entity = this.hass.states[selectedDevice.entity_id];
    if (!entity) {
      console.warn('[GoogleFindMy] Entity not found:', selectedDevice.entity_id);
      return;
    }

    const entityId = entity.entity_id;
    const endTime = new Date();
    const startTime = new Date(endTime - this._historyDays * 24 * 60 * 60 * 1000);

    console.log(`[GoogleFindMy] Fetching ${this._historyDays} days of history for ${entityId}`);

    try {
      // Fetch history from Home Assistant
      const history = await this.hass.callWS({
        type: 'history/history_during_period',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        entity_ids: [entityId],
        minimal_response: false,
        significant_changes_only: false
      });

      console.log('[GoogleFindMy] History response:', history);

      // Process history data - response format is {entity_id: [...states]}
      const locations = [];
      let lastSeen = null;

      // Get the array of states from the response object
      const stateArray = history && history[entityId] ? history[entityId] : null;

      if (stateArray && stateArray.length > 0) {
        console.log(`[GoogleFindMy] Processing ${stateArray.length} state records`);

        for (const state of stateArray) {
          // Handle both full object format and compact format
          const attrs = state.a || state.attributes;
          const lat = attrs?.latitude;
          const lon = attrs?.longitude;
          const currentLastSeen = attrs?.last_seen;

          if (lat !== undefined && lon !== undefined) {
            // Skip duplicates based on last_seen
            if (currentLastSeen && currentLastSeen === lastSeen) {
              continue;
            }
            lastSeen = currentLastSeen;

            locations.push({
              lat,
              lon,
              accuracy: attrs?.gps_accuracy || 0,
              timestamp: state.last_changed || state.lu,
              lastSeen: currentLastSeen,
              isOwnReport: attrs?.is_own_report,
              semanticLocation: attrs?.semantic_location,
              state: state.s || state.state
            });
          }
        }
      } else {
        console.warn('[GoogleFindMy] No state data found in history response');
      }

      console.log(`[GoogleFindMy] Processed ${locations.length} location points`);
      this._locationHistory = locations;
      this._updateMap();
    } catch (err) {
      console.error('[GoogleFindMy] Failed to fetch location history:', err);
      this._locationHistory = [];
    }
  }

  _getMapUrl(entity) {
    // Get the device configuration URL if available
    if (entity.attributes.configuration_url) {
      // Add a unique parameter to prevent caching issues
      const separator = entity.attributes.configuration_url.includes('?') ? '&' : '?';
      return `${entity.attributes.configuration_url}${separator}_t=${Date.now()}`;
    }

    // Fallback to OpenStreetMap if coordinates are available
    const lat = entity.attributes.latitude;
    const lon = entity.attributes.longitude;
    if (lat && lon) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lon}`;
    }

    // No coordinates available
    return null;
  }

  _updateMap() {
    if (!this._leafletLoaded || !window.L) return;

    // Wait for the map container to be in the DOM and have dimensions
    setTimeout(() => {
      const mapContainer = this.shadowRoot.querySelector('#leaflet-map');
      if (!mapContainer) return;

      // Check if container has dimensions
      const rect = mapContainer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn('[GoogleFindMy] Map container has no dimensions, retrying...');
        setTimeout(() => this._updateMap(), 200);
        return;
      }

      // Get current device
      const devices = this._getDevices();
      const selectedDevice = this._selectedDevice ?
        devices.find(d => d.entity_id === this._selectedDevice) :
        devices[0];

      if (!selectedDevice) return;

      const entity = this.hass.states[selectedDevice.entity_id];
      if (!entity || !entity.attributes.latitude) return;

      const lat = entity.attributes.latitude;
      const lon = entity.attributes.longitude;
      const accuracy = entity.attributes.gps_accuracy || 0;

      // Only create map once - never recreate
      if (!this._mapInstance) {
        console.log('[GoogleFindMy] Creating new map instance');

        // Fix Leaflet marker icon paths (point to CDN)
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
        });

        // Create new map instance
        this._mapInstance = L.map(mapContainer, {
          preferCanvas: true,
          zoomControl: true
        }).setView([lat, lon], 13);

        // Add OpenStreetMap tiles with error handling
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        }).addTo(this._mapInstance);

        // Wait for tiles to render before invalidating size
        this._mapInstance.whenReady(() => {
          console.log('[GoogleFindMy] Map ready, invalidating size');
          setTimeout(() => {
            if (this._mapInstance) {
              this._mapInstance.invalidateSize(true);
            }
          }, 50);
        });

        // Fetch history when map is first created
        this._fetchLocationHistory();
      } else {
        // Map already exists, zoom to current device location
        this._mapInstance.setView([lat, lon], 15);
      }

      // Clear existing markers and lines
      this._mapInstance.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polyline) {
          this._mapInstance.removeLayer(layer);
        }
      });

      const deviceName = selectedDevice.name || entity.attributes.friendly_name || 'Device';
      const allMarkers = [];

      // Filter and plot historical locations
      const filteredHistory = this._locationHistory.filter(loc =>
        this._accuracyFilter === 0 || loc.accuracy <= this._accuracyFilter
      );

      if (filteredHistory.length > 0) {
        // Draw path line connecting historical points (if enabled in config)
        if (this.config.show_path_lines !== false) {
          const pathCoords = filteredHistory.map(loc => [loc.lat, loc.lon]);
          L.polyline(pathCoords, {
            color: '#1a73e8',
            weight: 2,
            opacity: 0.6,
            smoothFactor: 1
          }).addTo(this._mapInstance);
        }

        // Add markers for historical locations with standard Leaflet pins
        filteredHistory.forEach((loc, index) => {
          const isLast = index === filteredHistory.length - 1;

          // Calculate opacity as decimal (0-1) from percentage (0-100)
          const markerOpacity = this._markerOpacity / 100;

          // Use standard Leaflet marker (default blue pin icon) at 75% size
          const smallBlueIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [18.75, 30.75],  // 75% of default 25x41
            iconAnchor: [9.375, 30.75],
            popupAnchor: [0.75, -25.5],
            shadowSize: [30.75, 30.75]
          });

          const marker = L.marker([loc.lat, loc.lon], {
            icon: smallBlueIcon,
            opacity: markerOpacity,
            zIndexOffset: -1000  // Place historical markers below current marker
          }).addTo(this._mapInstance);

          allMarkers.push(marker);

          // Add accuracy circle matching Map View style
          if (loc.accuracy > 0) {
            const circle = L.circle([loc.lat, loc.lon], {
              radius: loc.accuracy,
              color: '#1a73e8',
              fillColor: '#1a73e8',
              fillOpacity: 0.1 * markerOpacity,
              weight: 2,
              opacity: 0.5 * markerOpacity
            }).addTo(this._mapInstance);
          }

          // Determine report source like Map View
          let reportSource = '❓ Unknown';
          let reportColor = '#6c757d';
          if (loc.isOwnReport === true) {
            reportSource = '📱 Own Device';
            reportColor = '#28a745';
          } else if (loc.isOwnReport === false) {
            reportSource = '🌐 Network/Crowd-sourced';
            reportColor = '#007cba';
          }

          // Create popup matching Map View
          const timestamp = new Date(loc.timestamp).toLocaleString();
          const popupContent = `
            <div style="min-width: 200px;">
              <b>Location ${index + 1}</b><br>
              <b>Coordinates:</b> ${loc.lat.toFixed(6)}, ${loc.lon.toFixed(6)}<br>
              <b>GPS Accuracy:</b> ${loc.accuracy.toFixed(1)} meters<br>
              <b>Timestamp:</b> ${timestamp}<br>
              <b style="color: ${reportColor}">Report Source:</b> <span style="color: ${reportColor}">${reportSource}</span><br>
              ${loc.semanticLocation ? `<b>Location Name:</b> ${loc.semanticLocation}<br>` : ''}
              <b>Entity State:</b> ${loc.state || 'Unknown'}<br>
            </div>
          `;
          marker.bindPopup(popupContent);
        });

        // Add current device location marker in RED with full opacity
        const redIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        const currentMarker = L.marker([lat, lon], {
          icon: redIcon,
          opacity: 1.0,
          zIndexOffset: 1000  // Place current marker on top of all historical markers
        }).addTo(this._mapInstance);
        allMarkers.push(currentMarker);

        const lastSeen = entity.attributes.last_seen || 'Unknown';
        const battery = entity.attributes.battery_level !== undefined ?
          `${entity.attributes.battery_level}%` : 'Unknown';
        const locationName = entity.attributes.location_name || 'Unknown location';

        const currentTimestamp = new Date(lastSeen).toLocaleString();
        const currentPopupContent = `
          <div style="min-width: 200px;">
            <b style="color: #dc3545;">📍 Current Location</b><br>
            <b>Coordinates:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}<br>
            <b>GPS Accuracy:</b> ${accuracy.toFixed(1)} meters<br>
            <b>Timestamp:</b> ${currentTimestamp}<br>
            <b style="color: #28a745;">Report Source:</b> <span style="color: #28a745;">📱 Own Device</span><br>
            <b>Entity State:</b> ${entity.state || 'Unknown'}<br>
          </div>
        `;
        currentMarker.bindPopup(currentPopupContent);

        // Add current location accuracy circle in red
        if (accuracy > 0) {
          L.circle([lat, lon], {
            radius: accuracy,
            color: '#dc3545',
            fillColor: '#dc3545',
            fillOpacity: 0.1,
            weight: 2,
            opacity: 0.8
          }).addTo(this._mapInstance);
        }
      } else {
        // No history - just show current location with RED marker
        const redIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        const marker = L.marker([lat, lon], {
          icon: redIcon,
          zIndexOffset: 1000
        }).addTo(this._mapInstance);
        allMarkers.push(marker);

        const lastSeen = entity.attributes.last_seen || 'Unknown';
        const locationName = entity.attributes.location_name || 'Unknown location';

        const noHistoryTimestamp = new Date(lastSeen).toLocaleString();
        const popupContent = `
          <div style="min-width: 200px;">
            <b style="color: #dc3545;">📍 Current Location</b><br>
            <b>Coordinates:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}<br>
            <b>GPS Accuracy:</b> ${accuracy.toFixed(1)} meters<br>
            <b>Timestamp:</b> ${noHistoryTimestamp}<br>
            <b style="color: #28a745;">Report Source:</b> <span style="color: #28a745;">📱 Own Device</span><br>
            <b>Entity State:</b> ${entity.state || 'Unknown'}<br>
          </div>
        `;

        marker.bindPopup(popupContent).openPopup();

        // Add accuracy circle in red
        if (accuracy > 0) {
          L.circle([lat, lon], {
            radius: accuracy,
            color: '#dc3545',
            fillColor: '#dc3545',
            fillOpacity: 0.1,
            weight: 2,
            opacity: 0.8
          }).addTo(this._mapInstance);
        }
      }

      // Always zoom to current device location at zoom level 15
      this._mapInstance.setView([lat, lon], 15);
    }, 100);
  }

  async _locateDevice(e, entityId) {
    e.stopPropagation();
    const deviceId = entityId.split('.')[1];
    await this.hass.callService('googlefindmy', 'locate_device', {
      device_id: deviceId
    });
  }

  async _playSound(e, entityId) {
    e.stopPropagation();
    const deviceId = entityId.split('.')[1];
    await this.hass.callService('googlefindmy', 'play_sound', {
      device_id: deviceId
    });
  }

  _openMap(e, entityId) {
    e.stopPropagation();
    const entity = this.hass.states[entityId];
    if (entity && entity.attributes.configuration_url) {
      window.open(entity.attributes.configuration_url, '_blank');
    }
  }

  _handleMapError(entityId) {
    console.warn(`Map failed to load for entity: ${entityId}`);
    // Could show a toast notification or update the UI
  }



  async _refreshAll() {
    // Trigger a coordinator update
    await this.hass.callService('homeassistant', 'update_entity', {
      entity_id: this.config.entities
    });
  }

  static getConfigElement() {
    return document.createElement("googlefindmy-card-editor");
  }

  static getStubConfig() {
    return {
      entities: [],
      title: "Find My Devices",
      show_last_seen: true,
      show_location_name: true,
      enable_actions: true,
      keep_device_list_pinned: false,
      show_path_lines: true,
      use_leaflet_map: true,
      filter_keywords: ""
    };
  }

  static getLayoutOptions() {
    return {
      grid_columns: 4,
      grid_rows: 4,
      grid_min_columns: 2,
      grid_min_rows: 3
    };
  }

  getCardSize() {
    // Return height based on configuration
    return this.config?.card_size || 15;
  }
}

customElements.define("googlefindmy-card", GoogleFindMyCard);

// Card Editor
class GoogleFindMyCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      _helpers: { type: Object },
    };
  }

  setConfig(config) {
    this._config = config;
    this.loadCardHelpers();
  }

  async loadCardHelpers() {
    this._helpers = await window.loadCardHelpers();
  }

  static get styles() {
    return css`
      .option {
        padding: 4px 0px;
        cursor: pointer;
      }
      .row {
        display: flex;
        margin-bottom: -14px;
        pointer-events: none;
      }
      .title {
        padding-left: 16px;
        margin-top: -6px;
        pointer-events: none;
      }
      .secondary {
        padding-left: 40px;
        color: var(--secondary-text-color);
        pointer-events: none;
      }
      .values {
        padding-left: 16px;
        background: var(--secondary-background-color);
        display: grid;
      }
      ha-formfield {
        padding: 8px 16px;
      }
    `;
  }

  render() {
    if (!this.hass || !this._helpers) {
      return html``;
    }

    const entities = this._getEntities();

    return html`
      <div class="card-config">
        <div class="option">
          <ha-textfield
            label="Title (Optional)"
            .value=${this._config.title || ""}
            .configValue=${"title"}
            @input=${this._valueChanged}
          ></ha-textfield>
        </div>

        <div class="option">
          <ha-textfield
            label="Filter Keywords (comma separated)"
            .value=${this._config.filter_keywords || ""}
            .configValue=${"filter_keywords"}
            @input=${this._valueChanged}
          ></ha-textfield>
          <div class="secondary">Keywords to filter device trackers (e.g. android,iphone,googlefindmy)</div>
        </div>

        <div class="option">
          <div class="title">Device Entities</div>
          <div class="secondary">Select Google Find My Device trackers to display</div>
          <div class="values">
            ${entities.map(entity => html`
              <ha-formfield label=${entity.name}>
                <ha-checkbox
                  .checked=${this._config.entities?.includes(entity.entity_id)}
                  .entityId=${entity.entity_id}
                  @change=${this._entityToggled}
                ></ha-checkbox>
              </ha-formfield>
            `)}
          </div>
        </div>

        <div class="option">
          <div class="title">Display Options</div>
          <div class="values">


            <ha-formfield label="Show Last Seen">
              <ha-switch
                .checked=${this._config.show_last_seen !== false}
                .configValue=${"show_last_seen"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>

            <ha-formfield label="Show Location Name">
              <ha-switch
                .checked=${this._config.show_location_name !== false}
                .configValue=${"show_location_name"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>

            <ha-formfield label="Show Coordinates">
              <ha-switch
                .checked=${this._config.show_coordinates === true}
                .configValue=${"show_coordinates"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>

            <ha-formfield label="Enable Actions">
              <ha-switch
                .checked=${this._config.enable_actions !== false}
                .configValue=${"enable_actions"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>

            <ha-formfield label="Keep Device List Pinned">
              <ha-switch
                .checked=${this._config.keep_device_list_pinned === true}
                .configValue=${"keep_device_list_pinned"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>

            <ha-formfield label="Show Path Lines (History)">
              <ha-switch
                .checked=${this._config.show_path_lines !== false}
                .configValue=${"show_path_lines"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>
          </div>
        </div>
      </div>
    `;
  }

  _getEntities() {
    const entities = [];
    Object.keys(this.hass.states).forEach(key => {
      if (key.startsWith("device_tracker.")) {
        const entity = this.hass.states[key];
        const attributes = entity.attributes;

        // Filter for GPS-based device trackers
        const filterKeywords = (this._config?.filter_keywords || "")
          .split(",")
          .map(k => k.trim().toLowerCase())
          .filter(k => k.length > 0);

        const matchesKeyword = filterKeywords.length === 0 || filterKeywords.some(keyword =>
          key.toLowerCase().includes(keyword)
        );

        const isGpsDevice = attributes.source_type === "gps" || attributes.latitude !== undefined;

        // Include GPS devices that match the filter keywords (or all GPS if filter is blank)
        if (isGpsDevice && matchesKeyword) {
          entities.push({
            entity_id: key,
            name: attributes.friendly_name || key
          });
        }
      }
    });
    return entities;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const configValue = target.configValue;

    if (configValue) {
      if (target.checked !== undefined) {
        this._config = {
          ...this._config,
          [configValue]: target.checked,
        };
      } else {
        this._config = {
          ...this._config,
          [configValue]: target.value,
        };
      }
    }

    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);

    // Force re-render when filter keywords change to update entity list
    if (configValue === "filter_keywords") {
      this.requestUpdate();
    }
  }

  _entityToggled(ev) {
    ev.stopPropagation();
    const entityId = ev.target.entityId;
    const checked = ev.target.checked;
    let entities = [...(this._config.entities || [])];

    if (checked && !entities.includes(entityId)) {
      entities.push(entityId);
    } else if (!checked) {
      entities = entities.filter(e => e !== entityId);
    }

    // Create new config object
    const newConfig = {
      ...this._config,
      entities,
    };

    // Update internal config
    this._config = newConfig;

    // Fire config-changed event
    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);

    // Force re-render of editor
    this.requestUpdate();
  }
}

customElements.define("googlefindmy-card-editor", GoogleFindMyCardEditor);

// Register the card
window.customCards = window.customCards || [];
window.customCards.push({
  type: "googlefindmy-card",
  name: "Google Find My Device Card",
  description: "A custom card for Google Find My Device integration with map support and device actions"
});

console.info(
  `%c GOOGLE-FINDMY-CARD %c Version 1.0.6 `,
  'color: white; font-weight: bold; background: #1a73e8',
  'color: #1a73e8; font-weight: bold; background: #f0f0f0'
);