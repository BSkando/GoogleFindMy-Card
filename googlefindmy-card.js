// Google Find My Device Card for Home Assistant
// Version: 1.1.0 - Stable release: Fixed preview display, card rendering, and map initialization

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

const getConfiguredEntityId = (entry) => {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    if (typeof entry.entity_id === 'string') return entry.entity_id;
    if (typeof entry.entity === 'string') return entry.entity;
  }
  return null;
};

const normalizeConfiguredEntities = (entities) => {
  if (!Array.isArray(entities)) return [];

  return entities.reduce((normalized, entry) => {
    const entityId = getConfiguredEntityId(entry);
    if (!entityId) return normalized;

    normalized.push(typeof entry === 'string' ? { entity_id: entityId } : { ...entry, entity_id: entityId });
    return normalized;
  }, []);
};

const normalizeEntityIds = (entityIds) => Array.isArray(entityIds)
  ? entityIds.filter(entityId => typeof entityId === 'string')
  : [];

const getFilterKeywords = (filterKeywords) => String(filterKeywords || '')
  .split(',')
  .map(keyword => keyword.trim().toLowerCase())
  .filter(Boolean);

const discoverEligibleDevices = (hass, filterKeywords) => {
  const states = hass?.states;
  if (!states) return [];

  const keywords = getFilterKeywords(filterKeywords);
  return Object.entries(states).reduce((devices, [entityId, entity]) => {
    const attributes = entity?.attributes || {};
    const matchesKeyword = keywords.length === 0 || keywords.some(keyword =>
      entityId.toLowerCase().includes(keyword)
    );
    const isGpsDevice = entityId.startsWith('device_tracker.') &&
      (attributes.source_type === 'gps' || attributes.latitude !== undefined);

    if (isGpsDevice && matchesKeyword) {
      devices.push({ entity_id: entityId, name: attributes.friendly_name || entityId });
    }
    return devices;
  }, []);
};

const hasUsableCoordinates = (entity) => {
  const { latitude, longitude } = entity?.attributes || {};
  return Number.isFinite(latitude) && Number.isFinite(longitude);
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
    this._historyRequestGeneration = 0;

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
    const devices = this._getDevices();
    const selectionChanged = this._syncSelectedDevice(devices);

    // Home Assistant state updates are the source for automatic discovery.
    this.requestUpdate();

    if (devices.length === 0) {
      this._clearMap();
      return;
    }

    // Only update map if coordinates changed
    if (oldHass && this._leafletLoaded && this._selectedDevice && !selectionChanged) {
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

      const devices = this._getDevices();
      this._syncSelectedDevice(devices);
      if (devices.length === 0) {
        this._clearMap();
      } else if (this._leafletLoaded) {
        this._fetchLocationHistory();
        this._updateMap();
      }
    }

    // Initialize or update map when Leaflet loads or selected device changes
    if (!changedProperties.has('config') &&
        (changedProperties.has('_leafletLoaded') || changedProperties.has('_selectedDevice')) && this._leafletLoaded) {
      // Only update map if we have hass and devices
      const devices = this.hass ? this._getDevices() : [];
      const selectedDevice = this._selectedDevice ?
        devices.find(d => d.entity_id === this._selectedDevice) :
        devices[0];

      if (this.hass && selectedDevice && this.hass.states[selectedDevice.entity_id]) {
        // Fetch new history when device changes
        if (changedProperties.has('_selectedDevice') && this._selectedDevice) {
          this._fetchLocationHistory();
        }
        this._updateMap();
      }
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
    this._clearMap();
  }

  _clearMap() {
    this._historyRequestGeneration++;
    if (this._mapInstance) {
      this._mapInstance.remove();
      this._mapInstance = null;
    }
    this._locationHistory = [];
  }

  _syncSelectedDevice(devices = this._getDevices()) {
    const selectedDevice = devices.find(device => device.entity_id === this._selectedDevice);
    const nextDeviceId = selectedDevice ? selectedDevice.entity_id : (devices[0]?.entity_id || null);

    if (this._selectedDevice === nextDeviceId) return false;

    this._historyRequestGeneration++;
    this._selectedDevice = nextDeviceId;
    this._locationHistory = [];
    return true;
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
        --gfmc-bg: #ffffff;
        --gfmc-bg-overlay: rgba(255, 255, 255, 0.95);
        --gfmc-bg-overlay-light: rgba(255, 255, 255, 0.8);
        --gfmc-bg-surface: #ffffff;
        --gfmc-bg-hover: #f8f9fa;
        --gfmc-bg-control: #f1f3f4;
        --gfmc-bg-control-hover: #e8eaed;
        --gfmc-bg-map: #f8f9fa;
        --gfmc-text: #202124;
        --gfmc-text-secondary: #5f6368;
        --gfmc-text-link: #1a73e8;
        --gfmc-border: #e8eaed;
        --gfmc-border-control: #dadce0;
        --gfmc-border-light: #e0e0e0;
        --gfmc-shadow: rgba(0,0,0,0.1);
        --gfmc-shadow-strong: rgba(0,0,0,0.15);
        --gfmc-divider: #ccc;
        --gfmc-disabled-bg: #f4f4f4;
        --gfmc-disabled-text: #bbb;
      }

      :host(.dark) {
        --gfmc-bg: #1e1e1e;
        --gfmc-bg-overlay: rgba(30, 30, 30, 0.95);
        --gfmc-bg-overlay-light: rgba(30, 30, 30, 0.85);
        --gfmc-bg-surface: #2a2a2a;
        --gfmc-bg-hover: #3c4043;
        --gfmc-bg-control: #3c4043;
        --gfmc-bg-control-hover: #555;
        --gfmc-bg-map: #1a1a1a;
        --gfmc-text: #e8eaed;
        --gfmc-text-secondary: #9aa0a6;
        --gfmc-text-link: #8ab4f8;
        --gfmc-border: #444;
        --gfmc-border-control: #444;
        --gfmc-border-light: #444;
        --gfmc-shadow: rgba(0,0,0,0.3);
        --gfmc-shadow-strong: rgba(0,0,0,0.3);
        --gfmc-divider: #444;
        --gfmc-disabled-bg: #2a2a2a;
        --gfmc-disabled-text: #666;
      }

      /* Lower z-index for edit mode compatibility */
      .card-header,
      .device-sidebar {
        z-index: 1 !important;
      }

      ha-card {
        min-height: 400px;
        height: 100%;
        max-height: 100vh;
        display: flex;
        width: 100%;
        flex-direction: column;
        overflow: hidden;
        padding: 0;
        box-sizing: border-box;
        background: var(--gfmc-bg);
        border: none;
        border-radius: 16px;
        box-shadow: 0 2px 8px var(--gfmc-shadow);
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
        background: var(--gfmc-bg-overlay);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        padding: 8px 12px;
        box-shadow: 0 2px 8px var(--gfmc-shadow);
        height: 60px;
        box-sizing: border-box;
      }

      .card-title {
        font-size: 18px;
        font-weight: 500;
        color: var(--gfmc-text);
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
        background: var(--gfmc-bg-surface);
        border: 1px solid var(--gfmc-border-control);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        color: var(--gfmc-text-secondary);
        position: relative;
      }

      .control-button:hover {
        background: var(--gfmc-bg-hover);
        box-shadow: 0 2px 4px var(--gfmc-shadow);
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
        background: var(--gfmc-bg-map);
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
        position: relative;
        z-index: 0;
        filter: none;
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
        background: var(--gfmc-bg-overlay-light) !important;
        color: var(--gfmc-text-secondary) !important;
        padding: 0 8px;
        font-size: 11px;
        text-align: center;
        margin: 0 !important;
      }

      .leaflet-control-attribution a {
        color: var(--gfmc-text-link) !important;
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
        box-shadow: 0 1px 5px var(--gfmc-shadow) !important;
        border-radius: 4px;
        border-color: var(--gfmc-border) !important;
      }

      .leaflet-bar a {
        background-color: var(--gfmc-bg-surface) !important;
        border-bottom: 1px solid var(--gfmc-border) !important;
        width: 26px;
        height: 26px;
        line-height: 26px;
        display: block;
        text-align: center;
        text-decoration: none;
        color: var(--gfmc-text) !important;
      }

      .leaflet-bar a:hover {
        background-color: var(--gfmc-bg-hover) !important;
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
        background-color: var(--gfmc-disabled-bg) !important;
        color: var(--gfmc-disabled-text) !important;
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
        background: var(--gfmc-bg-surface);
        box-shadow: 0 2px 8px var(--gfmc-shadow-strong);
        border: 1px solid var(--gfmc-border);
      }

      .leaflet-popup-content {
        margin: 12px;
        font-size: 13px;
        font-family: 'Google Sans', 'Roboto', sans-serif;
        color: var(--gfmc-text);
      }

      .leaflet-popup-tip {
        background: var(--gfmc-bg-surface);
        border: 1px solid var(--gfmc-border);
      }

      /* Filter panel for map controls */
      .filter-panel {
        position: absolute;
        top: 80px;
        right: 12px;
        z-index: 1000;
        background: var(--gfmc-bg-overlay);
        backdrop-filter: blur(10px);
        padding: 12px;
        border-radius: 12px;
        box-shadow: 0 2px 8px var(--gfmc-shadow);
        max-width: 300px;
        font-size: 13px;
        color: var(--gfmc-text);
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
        border-bottom: 1px solid var(--gfmc-border-light);
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
        background: var(--gfmc-bg-control);
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        color: var(--gfmc-text);
        flex: 1;
        min-width: 50px;
      }

      .time-range-btn.active {
        background: #1a73e8;
        color: white;
      }

      .time-range-btn:hover {
        background: var(--gfmc-bg-control-hover);
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
        background: var(--gfmc-bg-overlay);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 2px 8px var(--gfmc-shadow);
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
        background: var(--gfmc-bg-surface);
        border-radius: 12px;
        border: 1px solid var(--gfmc-border);
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
        color: var(--gfmc-text);
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
        color: var(--gfmc-text-secondary);
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
        color: var(--gfmc-text-secondary);
        margin-top: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .last-seen {
        font-size: 11px;
        color: var(--gfmc-text-secondary);
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
        background: var(--gfmc-bg-surface);
        color: var(--gfmc-text-link);
        border: 1px solid var(--gfmc-border-control);
      }

      .action-button.secondary:hover {
        background: var(--gfmc-bg-hover);
      }

      .no-devices {
        text-align: center;
        padding: 48px 24px;
        color: var(--gfmc-text-secondary);
        background: var(--gfmc-bg-overlay);
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
          color: var(--gfmc-text-secondary) !important;
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
    // Accept empty or missing entities array
    const entities = Array.isArray(config?.entities) ? config.entities : [];
    const hiddenEntities = normalizeEntityIds(config?.hidden_entities);
    const historyWasEnabled = this.config?.show_history !== false;
    const historyWillBeEnabled = config?.show_history !== false;

    // Invalidate immediately so a pending response cannot restore history after disable/re-enable.
    if (historyWasEnabled && !historyWillBeEnabled) {
      this._historyRequestGeneration++;
      this._locationHistory = [];
    }

    this.config = {
      title: "Find My Devices",
      show_last_seen: true,
      show_location_name: true,
      show_coordinates: true,
      enable_actions: false,
      compact_mode: false,
      keep_device_list_pinned: false,
      show_history: true,
      show_path_lines: false,
      use_leaflet_map: true,
      dark_mode: true,
      carto_key: '',
      auto_discover: false,
      ...config,
      entities, // Override with validated entities array
      hidden_entities: hiddenEntities,
    };

    this.classList.toggle('dark', this.config.dark_mode !== false);
  }

  render() {
    try {
      if (!this.config) {
        return html`<ha-card><p>Loading configuration...</p></ha-card>`;
      }

      const devices = this.hass ? this._getDevices() : [];

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
    } catch (error) {
      console.error('[GoogleFindMy] Render error:', error);
      return html`<ha-card><p style="padding: 16px; color: red;">Error rendering card. Check console.</p></ha-card>`;
    }
  }

  _renderMap(devices) {
    // Create a unified map view showing all devices
    if (devices.length === 0) return html``;

    const selectedDevice = this._selectedDevice ?
      devices.find(d => d.entity_id === this._selectedDevice) :
      devices[0];

    if (!selectedDevice) return html``;

    const entity = this.hass.states[selectedDevice.entity_id];
    if (!hasUsableCoordinates(entity)) {
      return html`
        <div class="map-container">
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--gfmc-text-secondary);">
            <div style="text-align: center;">
              <ha-icon icon="mdi:map-marker-off" style="width: 48px; height: 48px; opacity: 0.5;"></ha-icon>
              <p>Location not available</p>
            </div>
          </div>
        </div>
      `;
    }

    // Use Leaflet map if loaded, otherwise fall back to iframe
    if (this._leafletLoaded && this.config.use_leaflet_map !== false) {
      return html`
        <div class="map-container">
          <div id="leaflet-map"></div>
          ${this.config.show_history !== false ? this._renderFilterPanel() : ''}
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
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--gfmc-text-secondary);">
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
      if (hasUsableCoordinates(entity)) {
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
    if (!this.config) return [];

    const configuredDevices = normalizeConfiguredEntities(this.config.entities);
    let devices;

    if (this.config.auto_discover === true) {
      const metadataByEntityId = new Map(configuredDevices.map(device => [device.entity_id, device]));
      const hiddenEntityIds = new Set(normalizeEntityIds(this.config.hidden_entities));
      devices = discoverEligibleDevices(this.hass, this.config.filter_keywords)
        .filter(device => !hiddenEntityIds.has(device.entity_id))
        .map(device => ({ ...device, ...metadataByEntityId.get(device.entity_id), entity_id: device.entity_id }));
    } else {
      devices = configuredDevices;
    }

    devices = devices.filter((device, index, allDevices) =>
      allDevices.findIndex(candidate => candidate.entity_id === device.entity_id) === index
    );

    // Keep legacy/manual cards in their saved order so existing selections do not change.
    if (this.config.auto_discover !== true) return devices;

    return devices.sort((first, second) => {
      const firstName = first.name || this.hass?.states?.[first.entity_id]?.attributes?.friendly_name || first.entity_id;
      const secondName = second.name || this.hass?.states?.[second.entity_id]?.attributes?.friendly_name || second.entity_id;
      return firstName.localeCompare(secondName) || first.entity_id.localeCompare(second.entity_id);
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
    if (this._selectedDevice === entityId) return;

    this._historyRequestGeneration++;
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
    const requestGeneration = ++this._historyRequestGeneration;
    if (this.config.show_history === false) {
      this._locationHistory = [];
      this._updateMap();
      return;
    }

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


      // Process history data - response format is {entity_id: [...states]}
      const locations = [];
      let lastSeen = null;

      // Get the array of states from the response object
      const stateArray = history && history[entityId] ? history[entityId] : null;

      if (stateArray && stateArray.length > 0) {

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

      const currentDeviceId = this._selectedDevice || this._getDevices()[0]?.entity_id;
      if (requestGeneration !== this._historyRequestGeneration ||
          this.config.show_history === false ||
          currentDeviceId !== entityId) return;

      this._locationHistory = locations;
      this._updateMap();
    } catch (err) {
      console.error('[GoogleFindMy] Failed to fetch location history:', err);
      const currentDeviceId = this._selectedDevice || this._getDevices()[0]?.entity_id;
      if (requestGeneration === this._historyRequestGeneration &&
          this.config.show_history !== false &&
          currentDeviceId === entityId) {
        this._locationHistory = [];
        this._updateMap();
      }
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

    // Initialize retry counter if not exists
    if (!this._mapRetryCount) this._mapRetryCount = 0;

    // Wait for the map container to be in the DOM and have dimensions
    setTimeout(() => {
      const mapContainer = this.shadowRoot.querySelector('#leaflet-map');
      // Get current device
      const devices = this._getDevices();
      const selectedDevice = this._selectedDevice ?
        devices.find(d => d.entity_id === this._selectedDevice) :
        devices[0];

      if (!selectedDevice) return;

      const entity = this.hass.states[selectedDevice.entity_id];
      if (!hasUsableCoordinates(entity)) {
        this._mapRetryCount = 0;
        this._clearMap();
        return;
      }

      if (!mapContainer) {
        this._mapRetryCount = 0;
        if (this._mapInstance) this._clearMap();
        return;
      }

      // Check if container has dimensions
      const rect = mapContainer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Limit retries to prevent infinite loop (max 5 attempts = 1 second)
        if (this._mapRetryCount < 5) {
          this._mapRetryCount++;
          console.warn(`[GoogleFindMy] Map container has no dimensions, retry ${this._mapRetryCount}/5...`);
          setTimeout(() => this._updateMap(), 200);
        } else {
          console.warn('[GoogleFindMy] Map container never got dimensions, giving up (likely in preview/hidden state)');
          this._mapRetryCount = 0;
        }
        return;
      }

      // Reset retry counter on success
      this._mapRetryCount = 0;

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

        // Add map tiles - CARTO dark if key provided, else OSM light
        const isDark = this.config?.dark_mode !== false;
        const cartoKey = this.config?.carto_key || '';
        let tileUrl, tileAttribution;
        if (isDark && cartoKey) {
          tileUrl = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`;
          tileAttribution = '© OpenStreetMap contributors © CARTO';
        } else {
          tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
          tileAttribution = '© OpenStreetMap contributors';
        }
        L.tileLayer(tileUrl, {
          attribution: tileAttribution,
          maxZoom: 19,
          errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          referrerPolicy: 'origin'
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
          const timestamp = new Date(loc.timestamp * 1000).toLocaleString();
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
    const entityIds = this._getDevices().map(device => device.entity_id);
    if (entityIds.length === 0) return;

    // Trigger a coordinator update
    await this.hass.callService('homeassistant', 'update_entity', {
      entity_id: entityIds
    });
  }

  static getConfigElement() {
    return document.createElement("googlefindmy-card-editor");
  }

  static getStubConfig() {
    return {
      entities: [],
      auto_discover: true,
      hidden_entities: [],
      title: "Find My Devices",
      show_last_seen: true,
      show_location_name: true,
      show_coordinates: true,
      enable_actions: false,
      keep_device_list_pinned: false,
      show_history: true,
      show_path_lines: false,
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

// Only define if not already defined
if (!customElements.get("googlefindmy-card")) {
  customElements.define("googlefindmy-card", GoogleFindMyCard);
}

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
    this._config = config || {};
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
      ha-textfield {
        width: 100%;
        display: block;
      }
    `;
  }

  render() {
    if (!this.hass) {
      return html`<div>Loading...</div>`;
    }

    const entities = this._getEntities();
    const autoDiscover = this._config.auto_discover === true;
    const configuredEntityIds = normalizeConfiguredEntities(this._config.entities)
      .map(entity => entity.entity_id);
    const hiddenEntityIds = new Set(normalizeEntityIds(this._config.hidden_entities));

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
          <div class="secondary">Keywords limit GPS devices discovered automatically (e.g. android,iphone,googlefindmy)</div>
        </div>

        <div class="option">
          <ha-formfield label="Automatically add new GPS devices">
            <ha-switch
              .checked=${autoDiscover}
              .configValue=${"auto_discover"}
              @change=${this._valueChanged}
            ></ha-switch>
          </ha-formfield>
        </div>

        <div class="option">
          <div class="title">Device Entities</div>
          <div class="secondary">${autoDiscover
            ? 'All eligible GPS devices are shown. Uncheck a device to hide it; hidden devices stay excluded when unavailable.'
            : 'Select Google Find My Device trackers to display.'}</div>
          <div class="values">
            ${entities.map(entity => html`
              <ha-formfield label=${entity.name}>
                <ha-checkbox
                   .checked=${autoDiscover ? !hiddenEntityIds.has(entity.entity_id) : configuredEntityIds.includes(entity.entity_id)}
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

            <ha-formfield label="Show Historical Points">
              <ha-switch
                .checked=${this._config.show_history !== false}
                .configValue=${"show_history"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>

            <ha-formfield label="Dark Mode">
              <ha-switch
                .checked=${this._config.dark_mode !== false}
                .configValue=${"dark_mode"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>

        <div class="option">
          <label style="display:block;margin-bottom:4px;color:var(--primary-text-color)">CARTO API Key (for dark map tiles)</label>
          <input
            type="text"
            .value=${this._config.carto_key || ''}
            placeholder="Optional - free at carto.com/basemaps/apikey"
            @input=${this._cartoKeyChanged}
            style="width:100%;padding:8px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box"
          />
          <div class="secondary">Get a free key at carto.com/basemaps/apikey — enables dark map tiles</div>
        </div>
          </div>
        </div>
      </div>
    `;
  }

  _getEntities() {
    return discoverEligibleDevices(this.hass, this._config?.filter_keywords)
      .sort((first, second) => first.name.localeCompare(second.name) || first.entity_id.localeCompare(second.entity_id));
  }

  _cartoKeyChanged(ev) {
    if (!this._config) return;
    this._config = { ...this._config, carto_key: ev.target.value };
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  _valueChanged(ev) {
    if (!this._config) return;
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

    // These fields change the meaning or contents of the device checklist.
    if (configValue === "filter_keywords" || configValue === "auto_discover") {
      this.requestUpdate();
    }
  }

  _entityToggled(ev) {
    ev.stopPropagation();
    const entityId = ev.target.entityId;
    const checked = ev.target.checked;
    let newConfig;

    if (this._config.auto_discover === true) {
      let hiddenEntities = normalizeEntityIds(this._config.hidden_entities);
      if (checked) {
        hiddenEntities = hiddenEntities.filter(id => id !== entityId);
      } else if (!hiddenEntities.includes(entityId)) {
        hiddenEntities = [...hiddenEntities, entityId];
      }
      newConfig = { ...this._config, hidden_entities: hiddenEntities };
    } else {
      let entities = Array.isArray(this._config.entities) ? [...this._config.entities] : [];
      const isConfigured = entities.some(entry => getConfiguredEntityId(entry) === entityId);
      if (checked && !isConfigured) {
        entities.push(entityId);
      } else if (!checked) {
        // Preserve object-form metadata for every device that remains selected.
        entities = entities.filter(entry => getConfiguredEntityId(entry) !== entityId);
      }
      newConfig = { ...this._config, entities };
    }

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

// Only define if not already defined
if (!customElements.get("googlefindmy-card-editor")) {
  customElements.define("googlefindmy-card-editor", GoogleFindMyCardEditor);
}

// Register the card (only once)
window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === "googlefindmy-card")) {
  window.customCards.push({
    type: "googlefindmy-card",
    name: "Google Find My Device Card",
    description: "A custom card for Google Find My Device integration with map support and device actions",
    preview: true,
    documentationURL: "https://github.com/BSkando/GoogleFindMy-Card"
  });
}

console.info(
  `%c GOOGLE-FINDMY-CARD %c Version 1.1.0 `,
  'color: white; font-weight: bold; background: #1a73e8',
  'color: #1a73e8; font-weight: bold; background: #f0f0f0'
);
