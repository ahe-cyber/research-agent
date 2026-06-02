import { getMapboxAccessToken, STATEN_ISLAND_BBOX, STATEN_ISLAND_CENTER } from "../../map/config";
import type { DestroyableSearchBox, RetrieveHandler, SearchMap } from "../types";

interface MapboxSearchBox extends DestroyableSearchBox {
  accessToken: string;
  addEventListener(type: string, listener: (event: any) => void): void;
  bindMap(map: SearchMap): void;
  componentOptions: Record<string, any>;
  mapboxgl: any;
  marker: boolean;
  options: Record<string, any>;
  placeholder: string;
  search(text: string): void;
  theme: Record<string, any>;
  value: string;
}

export function createPlaceSearchBox(map: SearchMap | null, onRetrieve: RetrieveHandler, initialValue = "") {
  const searchBox = new mapboxsearch.MapboxSearchBox() as MapboxSearchBox;

  searchBox.accessToken = getMapboxAccessToken();
  searchBox.placeholder = "Search address or place";
  searchBox.theme = {
    variables: {
      border: "#c9ced6",
      borderRadius: "4px",
      boxShadow: "none",
      colorBackground: "#ffffff",
      colorBackgroundHover: "#f7f8fa",
      colorPrimary: "#2f6fed",
      colorText: "#1f2933",
      fontFamily: "Arial, Helvetica, sans-serif",
      unit: "14px"
    }
  };
  searchBox.mapboxgl = maplibregl;
  searchBox.marker = true;
  searchBox.options = {
    bbox: STATEN_ISLAND_BBOX,
    country: "US",
    language: "en",
    limit: 6,
    proximity: STATEN_ISLAND_CENTER
  };
  searchBox.componentOptions = {
    flyTo: {
      zoom: 15,
      speed: 1.2
    }
  };

  if (map) searchBox.bindMap(map);
  searchBox.addEventListener("retrieve", (event) => {
    onRetrieve(event.detail);
  });
  searchBox.addEventListener("focusin", () => {
    const text = searchBox.value.trim();
    if (text) searchBox.search(text);
  });
  queueMicrotask(() => {
    searchBox.value = initialValue;
  });

  return searchBox;
}
