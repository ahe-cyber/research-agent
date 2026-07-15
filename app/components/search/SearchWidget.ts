import { createSourceDropdown } from "../workspace/SourceDropdown";

export interface SearchWidgetSource {
  id: string;
  label: string;
  costly?: boolean;
}

export interface SearchWidgetInstance {
  element: HTMLDivElement;
  sourceElement: HTMLDivElement;
  shellElement: HTMLDivElement;
  setSources(sources: SearchWidgetSource[], selectedId?: string): void;
  getSelectedSource(): SearchWidgetSource | null;
  getQuery(): string;
  isFocused(): boolean;
  setQuery(query: string): void;
  setResults(results: HTMLElement[]): void;
  setWarning(message: string): void;
  setError(message: string): void;
  clearResults(): void;
}

export function createSearchWidget({
  placeholder = "Search",
  autocomplete = "off",
  inputName = "search-query",
  onQuery,
  onSubmit,
  onSourceChange,
  onEditSources,
  editSourcesLabel = "Edit sources"
}: {
  placeholder?: string;
  autocomplete?: string;
  inputName?: string;
  onQuery?: (query: string, source: SearchWidgetSource | null) => void;
  onSubmit?: (query: string, source: SearchWidgetSource | null) => void;
  onSourceChange?: (source: SearchWidgetSource | null) => void;
  onEditSources?: () => void;
  editSourcesLabel?: string;
} = {}): SearchWidgetInstance {
  let sources: SearchWidgetSource[] = [];
  let currentId = "";
  let focused = false;

  const element = document.createElement("div");
  element.className = "search-widget";

  const selector = createSourceDropdown({
    onChange(source) {
      currentId = source?.id ?? "";
      onSourceChange?.(getSelectedSource());
    },
    onEdit: onEditSources,
    editLabel: editSourcesLabel
  });
  selector.element.classList.add("search-widget-source");

  const shell = document.createElement("div");
  shell.className = "search-box-shell search-widget-shell";

  const input = document.createElement("input");
  input.className = "search-widget-input";
  input.type = "search";
  input.name = inputName;
  input.setAttribute("autocomplete", autocomplete);
  input.autocapitalize = "none";
  input.spellcheck = false;
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("data-lpignore", "true");
  input.setAttribute("data-1p-ignore", "true");
  input.placeholder = placeholder;

  const results = document.createElement("div");
  results.className = "search-widget-results";
  results.hidden = true;

  shell.append(input, results);
  element.append(selector.element, shell);

  input.addEventListener("input", () => {
    onQuery?.(input.value, getSelectedSource());
  });

  input.addEventListener("focus", () => {
    focused = true;
    onQuery?.(input.value, getSelectedSource());
  });

  input.addEventListener("blur", () => {
    focused = false;
    setTimeout(() => {
      if (!focused) clearResults();
    }, 120);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onSubmit?.(input.value.trim(), getSelectedSource());
  });

  function getSelectedSource() {
    return sources.find((source) => source.id === currentId) || null;
  }

  function setSources(nextSources: SearchWidgetSource[], selectedId = currentId) {
    sources = nextSources;
    currentId = sources.some((source) => source.id === selectedId) ? selectedId : (sources[0]?.id ?? "");
    selector.setOptions(sources, currentId);
    onSourceChange?.(getSelectedSource());
  }

  function setResults(items: HTMLElement[]) {
    results.replaceChildren(...items);
    results.hidden = items.length === 0;
  }

  function setStatus(message: string, variant: "warning" | "error") {
    const item = document.createElement("div");
    item.className = `search-widget-result search-widget-result-status search-widget-result-${variant}`;
    item.textContent = message;
    setResults([item]);
  }

  function setWarning(message: string) {
    setStatus(message, "warning");
  }

  function setError(message: string) {
    setStatus(message, "error");
  }

  function clearResults() {
    setResults([]);
  }

  return {
    element,
    sourceElement: selector.element,
    shellElement: shell,
    setSources,
    getSelectedSource,
    isFocused: () => focused,
    getQuery: () => input.value,
    setQuery(query: string) {
      input.value = query;
    },
    setResults,
    setWarning,
    setError,
    clearResults
  };
}
