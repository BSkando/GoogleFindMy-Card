export interface HomeAssistantEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface HomeAssistantExtended {
  states: Record<string, HomeAssistantEntity>;
  config: any;
  language: string;
  selectedLanguage: string;
  locale: any;
  themes: any;
  callService: (domain: string, service: string, serviceData?: any) => Promise<void>;
  callApi: (method: string, path: string, data?: any) => Promise<any>;
}

export interface TrackerLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  bearing?: number;
  speed?: number;
  timestamp: Date;
  source?: string;
}

export interface CardConfig {
  type: string;
  entity?: string;
  title?: string;
  zoom?: number;
  center?: [number, number];
  mapStyle?: string;
  showArrows?: boolean;
  showMarkers?: boolean;
  animationSpeed?: number;
}
