import { STATEN_ISLAND_CENTER, getMapboxAccessToken } from "@/features/map/config";
import type { RetrievedFeature, RetrieveHandler, SearchMap } from "../types";

const GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward";

interface MapboxFeature extends RetrievedFeature {
  properties: Record<string, any> & {
    full_address?: string;
    name?: string;
    place_formatted?: string;
  };
}

// Client
export async function suggestMapboxSearch(
  query: string,
  map: SearchMap | null,
  onRetrieve: RetrieveHandler,
  apiKey?: string
): Promise<HTMLElement[]> {
  const token = apiKey || getMapboxAccessToken();
  if (!token) return [];

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", token);
  const center = map?.getCenter?.();
  url.searchParams.set("proximity", center ? `${center.lng},${center.lat}` : STATEN_ISLAND_CENTER.join(","));
  url.searchParams.set("limit", "6");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox Search failed (${res.status}). Check the API key or try again shortly.`);
  }

  const data = await res.json();
  const features: MapboxFeature[] = data.features ?? [];

  return features.map((feature) => {
    const label = getFeatureLabel(feature);
    const btn = document.createElement("button");
    btn.className = "search-widget-result";
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectFeature(feature, label, map, onRetrieve);
    });
    return btn;
  });
}


let marker: { remove(): void } | null = null;

function selectFeature(
  feature: MapboxFeature,
  label: string,
  map: SearchMap | null,
  onRetrieve: RetrieveHandler
) {
  const coords = feature.geometry?.coordinates ?? null;

  if (map && coords) {
    marker?.remove();
    marker = new maplibregl.Marker().setLngLat(coords).addTo(map);
    map.flyTo({ center: coords, zoom: 16, speed: 1.2 });
  }

  onRetrieve({
    type: "FeatureCollection",
    features: [
      {
        ...feature,
        properties: {
          ...feature.properties,
          full_address: feature.properties.full_address || label,
          place_formatted: feature.properties.place_formatted || "Mapbox Search"
        }
      }
    ]
  });
}

function getFeatureLabel(feature: MapboxFeature) {
  return feature.properties.full_address || feature.properties.name || "Mapbox result";
}
