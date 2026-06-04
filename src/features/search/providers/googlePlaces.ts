import { STATEN_ISLAND_BBOX, getGoogleMapsApiKey } from "../../map/config";
import type { Coordinates, RetrievedFeature, RetrieveHandler, SearchMap } from "../types";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

interface PlacePrediction {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
}

export async function suggestGooglePlaces(
  query: string,
  map: SearchMap | null,
  onRetrieve: RetrieveHandler
): Promise<HTMLElement[]> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return [];

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
    body: JSON.stringify({
      input: query,
      locationBias: {
        rectangle: {
          low: { latitude: STATEN_ISLAND_BBOX[1], longitude: STATEN_ISLAND_BBOX[0] },
          high: { latitude: STATEN_ISLAND_BBOX[3], longitude: STATEN_ISLAND_BBOX[2] }
        }
      },
      includedRegionCodes: ["us"]
    })
  });
  if (!res.ok) return [];

  const data = await res.json();
  const predictions: PlacePrediction[] = (data.suggestions ?? [])
    .map((s: { placePrediction?: PlacePrediction }) => s.placePrediction)
    .filter(Boolean);

  return predictions.map((pred) => {
    const label =
      pred.text?.text ??
      pred.structuredFormat?.mainText?.text ??
      "";
    const btn = document.createElement("button");
    btn.className = "search-widget-result";
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectPrediction(pred, label, map, onRetrieve, btn);
    });
    return btn;
  });
}

let marker: { remove(): void } | null = null;

async function selectPrediction(
  pred: PlacePrediction,
  label: string,
  map: SearchMap | null,
  onRetrieve: RetrieveHandler,
  btn: HTMLButtonElement
) {
  const apiKey = getGoogleMapsApiKey();
  btn.disabled = true;

  let coords: Coordinates | null = null;
  try {
    if (pred.placeId && apiKey) {
      const res = await fetch(
        `${PLACE_DETAILS_URL}/${pred.placeId}?fields=location,displayName,formattedAddress&key=${apiKey}`
      );
      if (res.ok) {
        const details = await res.json();
        if (details.location) {
          coords = [details.location.longitude, details.location.latitude];
        }
      }
    }
  } catch {}

  if (map && coords) {
    marker?.remove();
    marker = new maplibregl.Marker().setLngLat(coords).addTo(map);
    map.flyTo({ center: coords, zoom: 16, speed: 1.2 });
  }

  const normalized: RetrievedFeature = {
    type: "Feature",
    geometry: coords ? { type: "Point", coordinates: coords } : null,
    properties: {
      full_address: label,
      place_formatted:
        pred.structuredFormat?.secondaryText?.text ?? "Google Places",
      name: pred.structuredFormat?.mainText?.text ?? label
    }
  };

  onRetrieve({ type: "FeatureCollection", features: [normalized] });
}
