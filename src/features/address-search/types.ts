export type Coordinates = [number, number];

export interface SearchSuggestion {
  label?: string;
  name?: string;
  placeId?: string;
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
  text?: { text?: string };
}

export interface RetrievedFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: Coordinates;
  } | null;
  properties: Record<string, any>;
}

export interface RetrievedFeatureCollection {
  type: "FeatureCollection";
  features: RetrievedFeature[];
}

export interface SearchMap {
  flyTo(options: { center: Coordinates; zoom: number; speed: number }): void;
}

export interface DestroyableSearchBox extends HTMLElement {
  destroy?: () => void;
  value?: string;
}

export type RetrieveHandler = (result: RetrievedFeatureCollection) => void;

export interface SearchProvider {
  (map: SearchMap | null, onRetrieve: RetrieveHandler, initialValue?: string): DestroyableSearchBox;
}
