import { getMapboxAccessToken, getGoogleMapsApiKey } from "../map/config";
import { createPlaceSearchBox } from "./providers/mapbox";
import { createGeoSearchBox } from "./providers/nycGeoSearch";
import { createGoogleSearchBox } from "./providers/googlePlaces";
import type { DestroyableSearchBox, RetrieveHandler, SearchMap, SearchProvider } from "./types";

type SearchSourceId = "geosearch" | "mapbox" | "google";

interface SearchSource {
  id: SearchSourceId;
  label: string;
  costly?: boolean;
  provider: SearchProvider;
}

function getSources(): SearchSource[] {
  const sources: SearchSource[] = [{ id: "geosearch", label: "NYC GeoSearch", provider: createGeoSearchBox }];
  if (getMapboxAccessToken()) {
    sources.push({ id: "mapbox", label: "Mapbox", costly: true, provider: createPlaceSearchBox });
  }
  if (getGoogleMapsApiKey()) {
    sources.push({ id: "google", label: "Google Places", costly: true, provider: createGoogleSearchBox });
  }
  return sources;
}

function appendLabel(element: HTMLElement, source: SearchSource) {
  if (source.costly) {
    element.classList.add("has-money-icon");
  }
  element.append(source.label);
}

export function createSearchSourceControl(
  map: SearchMap | null,
  onRetrieve: (result: Parameters<RetrieveHandler>[0], sourceId: SearchSourceId) => void,
  searchBoxContainer: HTMLElement
) {
  const sources = getSources();
  let currentId = sources[0].id;
  let currentBox: DestroyableSearchBox | null = null;
  let open = false;

  const el = document.createElement("div");
  el.className = "search-source-ctrl";

  const onDocClick = (e: MouseEvent) => { if (!el.contains(e.target as Node)) close(); };
  document.addEventListener("click", onDocClick);

  function render() {
    const current = sources.find(s => s.id === currentId);
    el.innerHTML = "";

    if (open) {
      const menu = document.createElement("div");
      menu.className = "search-source-menu";
      sources.forEach((source) => {
        const { id } = source;
        const item = document.createElement("button");
        item.className = "search-source-item" + (id === currentId ? " is-active" : "");
        appendLabel(item, source);
        item.addEventListener("click", (e) => { e.stopPropagation(); select(id); });
        menu.appendChild(item);
      });
      el.appendChild(menu);
    }

    const btn = document.createElement("button");
    btn.className = "section-tool-button";
    appendLabel(btn, current!);
    btn.addEventListener("click", (e) => { e.stopPropagation(); open ? close() : openMenu(); });
    el.appendChild(btn);
  }

  function openMenu() { open = true; render(); }
  function close() { open = false; render(); }

  function select(id: SearchSourceId) {
    open = false;
    if (id !== currentId) {
      currentId = id;
      swapBox();
    }
    render();
  }

  function swapBox() {
    const query = getSearchText(currentBox);
    currentBox?.destroy?.();
    searchBoxContainer.replaceChildren();
    // Wrap onRetrieve to pass the active source ID so callers can adapt.
    const wrapped: RetrieveHandler = (result) => onRetrieve(result, currentId);
    const box = sources.find(source => source.id === currentId)!.provider(map, wrapped, query);
    searchBoxContainer.appendChild(box);
    currentBox = box;
  }

  render();
  swapBox();

  return { element: el };
}

function getSearchText(box: DestroyableSearchBox | null) {
  if (!box) return "";
  if (typeof box.value === "string") return box.value;
  return box.querySelector("input")?.value ?? "";
}
