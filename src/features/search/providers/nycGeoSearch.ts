import { STATEN_ISLAND_BBOX, STATEN_ISLAND_CENTER } from "../../map/config";
import type { Coordinates, RetrievedFeature, RetrieveHandler, SearchMap } from "../types";

const AUTOCOMPLETE_URL = "https://geosearch.planninglabs.nyc/v2/autocomplete";

interface GeoSearchFeature extends RetrievedFeature {
  geometry: RetrievedFeature["geometry"] & { coordinates: Coordinates };
  properties: Record<string, any>;
}

export async function suggestGeoSearch(
  query: string,
  map: SearchMap | null,
  onRetrieve: RetrieveHandler
): Promise<HTMLElement[]> {
  const url = new URL(AUTOCOMPLETE_URL);
  url.searchParams.set("text", query);
  url.searchParams.set("focus.point.lat", String(STATEN_ISLAND_CENTER[1]));
  url.searchParams.set("focus.point.lon", String(STATEN_ISLAND_CENTER[0]));
  url.searchParams.set("boundary.rect.min_lon", String(STATEN_ISLAND_BBOX[0]));
  url.searchParams.set("boundary.rect.min_lat", String(STATEN_ISLAND_BBOX[1]));
  url.searchParams.set("boundary.rect.max_lon", String(STATEN_ISLAND_BBOX[2]));
  url.searchParams.set("boundary.rect.max_lat", String(STATEN_ISLAND_BBOX[3]));
  url.searchParams.set("size", "6");

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const features: GeoSearchFeature[] = data.features ?? [];

  return features.map((feature) => {
    const label = feature.properties.label || feature.properties.name || "";
    const btn = document.createElement("button");
    btn.className = "search-widget-result";
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectFeature(feature, label, map, onRetrieve);
    });
    return btn;
  });
}

let marker: { remove(): void } | null = null;

function selectFeature(
  feature: GeoSearchFeature,
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
          full_address: label,
          place_formatted: "NYC GeoSearch"
        }
      }
    ]
  });
}
