import { getMapboxAccessToken, getGoogleMapsApiKey } from "../map/config";
import { createPlaceSearchBox } from "./providers/mapbox";
import { createGeoSearchBox } from "./providers/nycGeoSearch";
import { createGoogleSearchBox } from "./providers/googlePlaces";
import { createSearchWidget } from "./SearchWidget";
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
    const res = await fetch("/api/search?activity=address");
    if (!res.ok) throw new Error("Failed to load");
    const sources = await res.json() as SearchSourceConfig[];
    return sources
      .filter(s => PROVIDER_MAP[s.type]?.hasKey())
      .map(s => ({ ...s, provider: PROVIDER_MAP[s.type].provider }));
  } catch {
    return [{ id: "src-geosearch", label: "NYC GeoSearch", type: "geosearch", provider: createGeoSearchBox }];
  }
}

export function createSearchSourceControl(
  map: SearchMap | null,
  onRetrieve: (result: Parameters<RetrieveHandler>[0], sourceId: string, sourceLabel: string) => void,
  searchBoxContainer: HTMLElement
) {
  let sources: SearchSource[] = [];
  let currentId = "";
  let currentBox: DestroyableSearchBox | null = null;
  const widget = createSearchWidget({
    onSourceChange(source) {
      if (!source || source.id === currentId) return;
      currentId = source.id;
      swapBox();
    }
  });
  searchBoxContainer.replaceChildren(widget.shellElement);

  function swapBox() {
    const query = getSearchText(currentBox);
    currentBox?.destroy?.();
    searchBoxContainer.replaceChildren();
    const source = sources.find(s => s.id === currentId);
    if (!source) return;
    const wrapped: RetrieveHandler = (result) => onRetrieve(result, currentId, source.label);
    const box = source.provider(map, wrapped, query);
    widget.setSearchElement(box);
    currentBox = box;
  }

  async function reload() {
    const prev = currentId;
    sources = await loadSources();
    currentId = sources.some(s => s.id === prev) ? prev : (sources[0]?.id ?? "");
    widget.setSources(sources, currentId);
    swapBox();
  }

  reload();

  return { element: widget.sourceElement, reload };
}

function getSearchText(box: DestroyableSearchBox | null) {
  if (!box) return "";
  if (typeof box.value === "string") return box.value;
  return box.querySelector("input")?.value ?? "";
}
