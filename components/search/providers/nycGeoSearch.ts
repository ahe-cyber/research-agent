import { getAddressGeoSearchSuggestions } from "@/features/address/client/api";
import type { Coordinates, RetrievedFeature, RetrieveHandler, SearchMap } from "../types";

interface GeoSearchFeature extends RetrievedFeature {
  geometry: RetrievedFeature["geometry"] & { coordinates: Coordinates };
  properties: Record<string, any>;
}

export async function suggestGeoSearch(
  query: string,
  map: SearchMap | null,
  onRetrieve: RetrieveHandler
): Promise<HTMLElement[]> {
  const params = new URLSearchParams({ text: query, size: "6" });
  const center = map?.getCenter?.();
  if (center) {
    params.set("focus.point.lat", String(center.lat));
    params.set("focus.point.lon", String(center.lng));
  }

  const res = await getAddressGeoSearchSuggestions(params);
  if (!res.ok) {
    throw new Error(`NYC GeoSearch is unavailable (${res.status}). Try another search source or search again shortly.`);
  }

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
