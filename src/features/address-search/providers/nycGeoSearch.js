import { STATEN_ISLAND_BBOX, STATEN_ISLAND_CENTER } from "../../map/config.js";

const AUTOCOMPLETE_URL = "https://geosearch.planninglabs.nyc/v2/autocomplete";
const DEBOUNCE_MS = 300;

export function createGeoSearchBox(map, onRetrieve, initialValue = "") {
  const container = document.createElement("div");
  container.className = "geosearch";

  const input = document.createElement("input");
  input.className = "geosearch-input";
  input.type = "text";
  input.placeholder = "Search address or place";
  input.autocomplete = "off";
  input.value = initialValue;

  // Attach list to body so it escapes overflow:hidden on .search-box-shell
  // and overflow-y:auto on .workspace-tab — both would clip an in-flow dropdown.
  const list = document.createElement("ul");
  list.className = "geosearch-list";
  list.hidden = true;
  document.body.appendChild(list);

  container.appendChild(input);

  let timer = null;
  let results = [];
  let marker = null;
  let destroyed = false;

  input.addEventListener("input", () => {
    clearTimeout(timer);
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

  const onDocClick = (e) => {
    if (!container.contains(e.target) && !list.contains(e.target)) hide();
  };
  document.addEventListener("click", onDocClick);

  async function fetchSuggestions(text) {
    const url = new URL(AUTOCOMPLETE_URL);
    url.searchParams.set("text", text);
    url.searchParams.set("focus.point.lat", STATEN_ISLAND_CENTER[1]);
    url.searchParams.set("focus.point.lon", STATEN_ISLAND_CENTER[0]);
    url.searchParams.set("boundary.rect.min_lon", STATEN_ISLAND_BBOX[0]);
    url.searchParams.set("boundary.rect.min_lat", STATEN_ISLAND_BBOX[1]);
    url.searchParams.set("boundary.rect.max_lon", STATEN_ISLAND_BBOX[2]);
    url.searchParams.set("boundary.rect.max_lat", STATEN_ISLAND_BBOX[3]);
    url.searchParams.set("size", "6");
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (destroyed || document.activeElement !== input) return;
      results = data.features ?? [];
      render();
    } catch {}
  }

  function render() {
    list.replaceChildren();
    if (results.length === 0) { hide(); return; }

    results.forEach((feature) => {
      const li = document.createElement("li");
      li.className = "geosearch-item";
      li.textContent = feature.properties.label || feature.properties.name;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); select(feature); });
      list.appendChild(li);
    });

    // Position fixed relative to the input element
    const rect = container.getBoundingClientRect();
    list.style.top = `${rect.bottom}px`;
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
    list.hidden = false;
  }

  function hide() { list.hidden = true; results = []; }

  container.destroy = () => {
    destroyed = true;
    clearTimeout(timer);
    document.removeEventListener("click", onDocClick);
    list.remove();
  };

  function select(feature) {
    input.value = feature.properties.label || feature.properties.name;
    hide();

    const normalized = {
      ...feature,
      properties: {
        ...feature.properties,
        full_address: feature.properties.label,
        place_formatted: "NYC GeoSearch"
      }
    };

    if (map && feature.geometry?.coordinates) {
      if (marker) marker.remove();
      marker = new maplibregl.Marker()
        .setLngLat(feature.geometry.coordinates)
        .addTo(map);
      map.flyTo({ center: feature.geometry.coordinates, zoom: 16, speed: 1.2 });
    }

    onRetrieve({ type: "FeatureCollection", features: [normalized] });
  }

  return container;
}
