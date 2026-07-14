import L from 'leaflet';
import { HomeAssistantExtended, TrackerLocation, CardConfig } from '../types/ha';

export class MapComponent {
  private map?: L.Map;
  private container: HTMLElement;
  private hass?: HomeAssistantExtended;
  private config?: CardConfig;
  private markers: L.CircleMarker[] = [];
  private polyline?: L.Polyline;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  update(options: { hass?: HomeAssistantExtended; config?: CardConfig }) {
    this.hass = options.hass || this.hass;
    this.config = options.config || this.config;

    if (!this.map && this.container) {
      this.initMap();
    }

    if (this.hass && this.config && this.config.entity) {
      this.loadTrackerData();
    }
  }

  private initMap() {
    if (!this.container) return;

    const center: [number, number] = this.config?.center || [40.4168, -3.7038]; // Madrid
    const zoom = this.config?.zoom || 12;

    this.map = L.map(this.container).setView(center, zoom);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);
  }

  private async loadTrackerData() {
    if (!this.hass || !this.config?.entity || !this.map) return;

    const entity = this.hass.states[this.config.entity];
    if (!entity) return;

    const location = this.extractLocation(entity);
    if (location) {
      this.addMarker(location);
      this.map.setView([location.latitude, location.longitude], 15);
    }
  }

  private extractLocation(entity: any): TrackerLocation | null {
    const attrs = entity.attributes || {};
    const latitude = attrs.latitude;
    const longitude = attrs.longitude;

    if (!latitude || !longitude) {
      return null;
    }

    return {
      latitude,
      longitude,
      accuracy: attrs.accuracy,
      altitude: attrs.altitude,
      bearing: attrs.bearing,
      speed: attrs.speed,
      timestamp: new Date(entity.last_updated),
      source: entity.entity_id
    };
  }

  private addMarker(location: TrackerLocation) {
    if (!this.map) return;

    const marker = L.circleMarker([location.latitude, location.longitude], {
      radius: 8,
      fillColor: '#2196F3',
      color: '#1976D2',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    });

    marker.bindPopup(`
      <div>
        <strong>Current Location</strong><br>
        Lat: ${location.latitude.toFixed(6)}<br>
        Lon: ${location.longitude.toFixed(6)}<br>
        Accuracy: ${location.accuracy ? location.accuracy.toFixed(0) + 'm' : 'N/A'}<br>
        Time: ${location.timestamp.toLocaleString()}
      </div>
    `);

    marker.addTo(this.map);
    this.markers.push(marker);
  }

  destroy() {
    this.map?.remove();
  }
}
