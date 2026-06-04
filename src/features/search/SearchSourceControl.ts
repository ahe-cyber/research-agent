import { getGoogleMapsApiKey } from "../map/config";
import { suggestGeoSearch } from "./providers/nycGeoSearch";
import { suggestGooglePlaces } from "./providers/googlePlaces";
import { createSearchWidget } from "./SearchWidget";
import type { RetrieveHandler, SearchMap } from "./types";

export type AddressSourceType = "geosearch" | "google";

export interface SearchSourceConfig {
  id: string;
  label: string;
  type: AddressSourceType;
  costly?: boolean;
}

type SuggestFn = (
  query: string,
  map: SearchMap | null,
  onRetrieve: RetrieveHandler
) => Promise<HTMLElement[]>;

const SUGGEST_MAP: Record<AddressSourceType, { suggest: SuggestFn; hasKey(): boolean }> = {
  geosearch: { suggest: suggestGeoSearch, hasKey: () => true },
  google: { suggest: suggestGooglePlaces, hasKey: () => !!getGoogleMapsApiKey() }
};

async function loadSources(): Promise<SearchSourceConfig[]> {
  try {
    const res = await fetch("/api/search?activity=address");
    if (!res.ok) throw new Error("Failed to load");
    const all = (await res.json()) as SearchSourceConfig[];
    return all.filter(
      (s): s is SearchSourceConfig =>
        s.type in SUGGEST_MAP && SUGGEST_MAP[s.type].hasKey()
    );
  } catch {
    return [{ id: "src-geosearch", label: "NYC GeoSearch", type: "geosearch" }];
  }
}

export function createSearchSourceControl(
  map: SearchMap | null,
  onRetrieve: (
    result: Parameters<RetrieveHandler>[0],
    sourceId: string,
    sourceLabel: string
  ) => void,
  container: HTMLElement
) {
  let sources: SearchSourceConfig[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let requestId = 0;

  const widget = createSearchWidget({
    placeholder: "Search address or place",
    onQuery(query, source) {
      scheduleSearch(query, source?.id ?? "");
    },
    onSubmit(query, source) {
      scheduleSearch(query, source?.id ?? "", 0);
    },
    onSourceChange() {
      cancelSearch();
      widget.clearResults();
    }
  });

  container.replaceChildren(widget.shellElement);

  function cancelSearch() {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
  }

  function scheduleSearch(query: string, sourceId: string, delay = 250) {
    cancelSearch();
    if (!query.trim() || !sourceId) {
      widget.clearResults();
      return;
    }
    const id = ++requestId;
    debounceTimer = setTimeout(async () => {
      const src = sources.find((s) => s.id === sourceId);
      if (!src) return;
      const suggest = SUGGEST_MAP[src.type]?.suggest;
      if (!suggest) return;
      try {
        const items = await suggest(query.trim(), map, (result) => {
          onRetrieve(result, src.id, src.label);
          widget.clearResults();
        });
        if (id !== requestId) return;
        widget.setResults(items);
      } catch {}
    }, delay);
  }

  async function reload() {
    sources = await loadSources();
    widget.setSources(
      sources.map((s) => ({ id: s.id, label: s.label, costly: s.costly }))
    );
  }

  reload();

  return { element: widget.sourceElement, reload };
}
