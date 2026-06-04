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
  clearResults(): void;
}

export function createSearchWidget({
  placeholder = "Search",
  onQuery,
  onSubmit,
  onSourceChange
}: {
  placeholder?: string;
  onQuery?: (query: string, source: SearchWidgetSource | null) => void;
  onSubmit?: (query: string, source: SearchWidgetSource | null) => void;
  onSourceChange?: (source: SearchWidgetSource | null) => void;
} = {}): SearchWidgetInstance {
  let sources: SearchWidgetSource[] = [];
  let currentId = "";
  let open = false;
  let focused = false;

  const element = document.createElement("div");
  element.className = "search-widget";

  const selector = document.createElement("div");
  selector.className = "search-source-ctrl search-widget-source";

  const shell = document.createElement("div");
  shell.className = "search-box-shell search-widget-shell";

  const input = document.createElement("input");
  input.className = "search-widget-input";
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = placeholder;

  const results = document.createElement("div");
  results.className = "search-widget-results";
  results.hidden = true;

  shell.append(input, results);
  element.append(selector, shell);

  const onDocClick = (event: MouseEvent) => {
    if (!selector.contains(event.target as Node)) closeMenu();
  };
  document.addEventListener("click", onDocClick);

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
    renderSelector();
    onSourceChange?.(getSelectedSource());
  }

  function renderSelector() {
    const current = getSelectedSource();
    selector.replaceChildren();
    if (!current) return;

    if (open) {
      const menu = document.createElement("div");
      menu.className = "search-source-menu";
      sources.forEach((source) => {
        const item = document.createElement("button");
        item.className = `search-source-item${source.id === currentId ? " is-active" : ""}`;
        appendSourceLabel(item, source);
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          currentId = source.id;
          closeMenu();
          onSourceChange?.(source);
        });
        menu.appendChild(item);
      });
      selector.appendChild(menu);
    }

    const button = document.createElement("button");
    button.className = "section-tool-button";
    button.type = "button";
    appendSourceLabel(button, current);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      open ? closeMenu() : openMenu();
    });
    selector.appendChild(button);
  }

  function openMenu() {
    open = true;
    renderSelector();
  }

  function closeMenu() {
    open = false;
    renderSelector();
  }

  function setResults(items: HTMLElement[]) {
    results.replaceChildren(...items);
    results.hidden = items.length === 0;
  }

  function clearResults() {
    setResults([]);
  }

  return {
    element,
    sourceElement: selector,
    shellElement: shell,
    setSources,
    getSelectedSource,
    isFocused: () => focused,
    getQuery: () => input.value,
    setQuery(query: string) {
      input.value = query;
    },
    setResults,
    clearResults
  };
}

function appendSourceLabel(element: HTMLElement, source: SearchWidgetSource) {
  if (source.costly) element.classList.add("has-money-icon");
  element.append(source.label);
}
