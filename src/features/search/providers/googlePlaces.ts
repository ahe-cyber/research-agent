import { STATEN_ISLAND_BBOX, STATEN_ISLAND_CENTER } from "../../map/config";
import { getGoogleMapsApiKey } from "../../map/config";
import type { Coordinates, DestroyableSearchBox, RetrievedFeature, RetrieveHandler, SearchMap, SearchSuggestion } from "../types";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";
const DEBOUNCE_MS = 300;

interface GooglePlaceDetails {
  location?: {
    latitude: number;
    longitude: number;
  };
}

export function createGoogleSearchBox(map: SearchMap | null, onRetrieve: RetrieveHandler, initialValue = "") {
  const apiKey = getGoogleMapsApiKey();

  const container = document.createElement("div") as DestroyableSearchBox;
  container.className = "geosearch";

  const input = document.createElement("input");
  input.className = "geosearch-input";
  input.type = "text";
  input.placeholder = "Search address or place";
  input.autocomplete = "off";
  input.value = initialValue;

  const list = document.createElement("ul");
  list.className = "geosearch-list";
  list.hidden = true;
  document.body.appendChild(list);

  container.appendChild(input);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let suggestions: SearchSuggestion[] = [];
  let marker: { remove(): void } | null = null;
  let destroyed = false;

  input.addEventListener("input", () => {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
    const text = input.value.trim();
    if (!text) { hide(); return; }
    timer = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS);
  });

  input.addEventListener("focus", () => {
    const text = input.value.trim();
    if (text) fetchSuggestions(text);
  });

  input.addEventListener("blur", hide);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });

  const onDocClick = (e: MouseEvent) => {
    if (!container.contains(e.target as Node) && !list.contains(e.target as Node)) hide();
  };
  document.addEventListener("click", onDocClick);

  async function fetchSuggestions(text: string) {
    try {
      const res = await fetch(AUTOCOMPLETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey
        },
        body: JSON.stringify({
          input: text,
          locationBias: {
            rectangle: {
              low: { latitude: STATEN_ISLAND_BBOX[1], longitude: STATEN_ISLAND_BBOX[0] },
              high: { latitude: STATEN_ISLAND_BBOX[3], longitude: STATEN_ISLAND_BBOX[2] }
            }
          },
          includedRegionCodes: ["us"]
        })
      });
      if (!res.ok) return;
      const data = await res.json();
      if (destroyed || document.activeElement !== input) return;
      suggestions = (data.suggestions ?? [])
        .map((s: { placePrediction?: SearchSuggestion }) => s.placePrediction)
        .filter(Boolean);
      render();
    } catch {}
  }

  async function fetchPlaceDetails(placeId: string): Promise<GooglePlaceDetails> {
    const res = await fetch(
      `${PLACE_DETAILS_URL}/${placeId}?fields=location,displayName,formattedAddress&key=${apiKey}`
    );
    if (!res.ok) throw new Error("Place details failed");
    return res.json();
  }

  function render() {
    list.replaceChildren();
    if (suggestions.length === 0) { hide(); return; }

    suggestions.forEach((pred) => {
      const li = document.createElement("li");
      li.className = "geosearch-item";
      li.textContent = pred.text?.text ?? pred.structuredFormat?.mainText?.text ?? "";
      li.addEventListener("mousedown", (e) => { e.preventDefault(); select(pred); });
      list.appendChild(li);
    });

    const rect = container.getBoundingClientRect();
    list.style.top = `${rect.bottom}px`;
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
    list.hidden = false;
  }

  function hide() { list.hidden = true; suggestions = []; }

  container.destroy = () => {
    destroyed = true;
    clearTimeout(timer as ReturnType<typeof setTimeout>);
    document.removeEventListener("click", onDocClick);
    list.remove();
  };

  async function select(pred: SearchSuggestion) {
    const label = pred.text?.text ?? pred.structuredFormat?.mainText?.text ?? "";
    input.value = label;
    hide();

    let coords: Coordinates | null = null;
    try {
      const details = await fetchPlaceDetails(pred.placeId!);
      if (details.location) {
        coords = [details.location.longitude, details.location.latitude];
      }
    } catch {}

    const normalized: RetrievedFeature = {
      type: "Feature",
      geometry: coords ? { type: "Point", coordinates: coords } : null,
      properties: {
        full_address: label,
        place_formatted: pred.structuredFormat?.secondaryText?.text ?? "Google Places",
        name: pred.structuredFormat?.mainText?.text ?? label
      }
    };

    if (map && coords) {
      if (marker) marker.remove();
      marker = new maplibregl.Marker()
        .setLngLat(coords)
        .addTo(map);
      map.flyTo({ center: coords, zoom: 16, speed: 1.2 });
    }

    onRetrieve({ type: "FeatureCollection", features: [normalized] });
  }

  return container;
}
