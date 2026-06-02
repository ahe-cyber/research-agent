import { getMapboxAccessToken, getGoogleMapsApiKey } from "../map/config";
import { createPlaceSearchBox } from "./providers/mapbox";
import { createGeoSearchBox } from "./providers/nycGeoSearch";
import { createGoogleSearchBox } from "./providers/googlePlaces";
import type { DestroyableSearchBox, RetrieveHandler, SearchMap, SearchProvider } from "./types";

export type SearchSourceType = "geosearch" | "mapbox" | "google";

export interface SearchSourceConfig {
  id: string;
  label: string;
  type: SearchSourceType;
  costly?: boolean;
  description?: string;
  outputs?: Array<{ variable: string; path: string }>;
}

interface SearchSource extends SearchSourceConfig {
  provider: SearchProvider;
}

const PROVIDER_MAP: Record<SearchSourceType, { provider: SearchProvider; hasKey: () => boolean }> = {
  geosearch: { provider: createGeoSearchBox, hasKey: () => true },
  mapbox:    { provider: createPlaceSearchBox, hasKey: () => !!getMapboxAccessToken() },
  google:    { provider: createGoogleSearchBox, hasKey: () => !!getGoogleMapsApiKey() }
};

async function loadSources(): Promise<SearchSource[]> {
  try {
    const res = await fetch("/api/searchsources");
    if (!res.ok) throw new Error("Failed to load");
    const { sources }: { sources: SearchSourceConfig[] } = await res.json();
    return sources
      .filter(s => PROVIDER_MAP[s.type]?.hasKey())
      .map(s => ({ ...s, provider: PROVIDER_MAP[s.type].provider }));
  } catch {
    return [{ id: "src-geosearch", label: "NYC GeoSearch", type: "geosearch", provider: createGeoSearchBox }];
  }
}

function appendLabel(element: HTMLElement, source: SearchSourceConfig) {
  if (source.costly) element.classList.add("has-money-icon");
  element.append(source.label);
}

export function createSearchSourceControl(
  map: SearchMap | null,
  onRetrieve: (result: Parameters<RetrieveHandler>[0], sourceId: string, sourceLabel: string) => void,
  searchBoxContainer: HTMLElement
) {
  let sources: SearchSource[] = [];
  let currentId = "";
  let currentBox: DestroyableSearchBox | null = null;
  let open = false;

  const el = document.createElement("div");
  el.className = "search-source-ctrl";

  const onDocClick = (e: MouseEvent) => { if (!el.contains(e.target as Node)) close(); };
  document.addEventListener("click", onDocClick);

  function render() {
    const current = sources.find(s => s.id === currentId);
    el.innerHTML = "";
    if (!current) return;

    if (open) {
      const menu = document.createElement("div");
      menu.className = "search-source-menu";
      sources.forEach((source) => {
        const item = document.createElement("button");
        item.className = "search-source-item" + (source.id === currentId ? " is-active" : "");
        appendLabel(item, source);
        item.addEventListener("click", (e) => { e.stopPropagation(); select(source.id); });
        menu.appendChild(item);
      });
      el.appendChild(menu);
    }

    const btn = document.createElement("button");
    btn.className = "section-tool-button";
    appendLabel(btn, current);
    btn.addEventListener("click", (e) => { e.stopPropagation(); open ? close() : openMenu(); });
    el.appendChild(btn);
  }

  function openMenu() { open = true; render(); }
  function close() { open = false; render(); }

  function select(id: string) {
    open = false;
    if (id !== currentId) { currentId = id; swapBox(); }
    render();
  }

  function swapBox() {
    const query = getSearchText(currentBox);
    currentBox?.destroy?.();
    searchBoxContainer.replaceChildren();
    const source = sources.find(s => s.id === currentId);
    if (!source) return;
    const wrapped: RetrieveHandler = (result) => onRetrieve(result, currentId, source.label);
    const box = source.provider(map, wrapped, query);
    searchBoxContainer.appendChild(box);
    currentBox = box;
  }

  async function reload() {
    const prev = currentId;
    sources = await loadSources();
    currentId = sources.some(s => s.id === prev) ? prev : (sources[0]?.id ?? "");
    swapBox();
    render();
  }

  reload();

  return { element: el, reload };
}

function getSearchText(box: DestroyableSearchBox | null) {
  if (!box) return "";
  if (typeof box.value === "string") return box.value;
  return box.querySelector("input")?.value ?? "";
}
