import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { HomeAssistantExtended } from './types/ha';
import { MapComponent } from './components/map';

declare global {
  interface Window {
    customCards: any[];
  }
}

@customElement('googlefindmy-card-enhanced')
export class GoogleFindMyCardEnhanced extends LitElement {
  @property() hass!: HomeAssistantExtended;
  @property() config: any = {};

  mapComponent?: MapComponent;

  static getConfigElement() {
    return document.createElement('googlefindmy-card-enhanced-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:googlefindmy-card-enhanced',
      entity: '',
      title: 'Tracker Map'
    };
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .card {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .card-header {
      padding: 16px;
      font-size: 1.2em;
      font-weight: 500;
    }

    .card-content {
      flex: 1;
      overflow: hidden;
    }

    #map {
      width: 100%;
      height: 100%;
    }
  `;

  firstUpdated() {
    this.mapComponent = new MapComponent(
      this.shadowRoot?.getElementById('map') as HTMLElement
    );
  }

  updated(changedProperties: any) {
    if (changedProperties.has('config') || changedProperties.has('hass')) {
      if (this.mapComponent) {
        this.mapComponent.update({
          hass: this.hass,
          config: this.config
        });
      }
    }
  }

  render() {
    return html`
      <div class="card">
        ${this.config.title ? html`<div class="card-header">${this.config.title}</div>` : ''}
        <div class="card-content">
          <div id="map"></div>
        </div>
      </div>
    `;
  }
}

if (!window.customCards) {
  window.customCards = [];
}

window.customCards.push({
  type: 'googlefindmy-card-enhanced',
  name: 'GoogleFindMy Card Enhanced',
  description: 'Enhanced Tracker Map Card for Home Assistant'
});
