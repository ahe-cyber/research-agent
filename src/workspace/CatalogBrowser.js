export function createCatalogController(editorTabController, agentController, getVariables, onAddSource) {
  let hubs = [];
  let hubRegistry = createEmptyHubRegistry();
  let sessionResults = [];
  const inlineResultsByBubble = new WeakMap();

  // ── Results panel ──────────────────────────────────────────────────────────

  const resultsPanel = document.createElement("div");
  resultsPanel.className = "catalog-results-panel";

  const hubsBar = document.createElement("div");
  hubsBar.className = "catalog-hubs-bar";

  const hubsHeader = document.createElement("div");
  hubsHeader.className = "catalog-hubs-header";

  const hubsTitle = document.createElement("span");
  hubsTitle.className = "catalog-hubs-title";
  hubsTitle.textContent = "Catalogs";

  const saveHubsBtn = document.createElement("button");
  saveHubsBtn.className = "catalog-hubs-save";
  saveHubsBtn.type = "button";
  saveHubsBtn.textContent = "Save";
  saveHubsBtn.addEventListener("click", saveHubs);

  hubsHeader.append(hubsTitle, saveHubsBtn);

  const hubRowsEl = document.createElement("div");
  hubRowsEl.className = "catalog-hub-rows";

  const addHubBtn = document.createElement("button");
  addHubBtn.className = "catalog-add-hub-btn";
  addHubBtn.type = "button";
  addHubBtn.textContent = "+ Add catalog";
  addHubBtn.addEventListener("click", () =>
    addHubRow({ id: `hub-${Date.now()}`, name: "", url: "", type: "arcgis" })
  );

  hubsBar.append(hubsHeader, hubRowsEl, addHubBtn);

  const resultsToolbar = document.createElement("div");
  resultsToolbar.className = "catalog-results-toolbar";

  const resultsCountEl = document.createElement("span");
  resultsCountEl.className = "catalog-results-count";
  resultsCountEl.textContent = "No results yet";

  const clearBtn = document.createElement("button");
  clearBtn.className = "catalog-clear-btn";
  clearBtn.type = "button";
  clearBtn.textContent = "Clear all";
  clearBtn.addEventListener("click", clearResults);

  resultsToolbar.append(resultsCountEl, clearBtn);

  const resultsGrid = document.createElement("div");
  resultsGrid.className = "catalog-results-grid";

  const emptyState = document.createElement("p");
  emptyState.className = "catalog-empty-state";
  emptyState.textContent = "Search results will appear here after a catalog search.";
  resultsGrid.appendChild(emptyState);

  resultsPanel.append(hubsBar, resultsToolbar, resultsGrid);

  // ── Hub loading ────────────────────────────────────────────────────────────

  async function loadHubs() {
    try {
      const res = await fetch("/api/hubs");
      if (res.ok) {
        hubRegistry = normalizeHubRegistry(await res.json());
        hubs = flattenHubRegistry(hubRegistry);
        renderHubRows();
      }
    } catch (error) {
      console.error("[Catalog] Failed to load hubs", error);
    }
  }

  async function saveHubs() {
    hubs = readCurrentHubs();
    hubRegistry = mergeHubsIntoRegistry(hubRegistry, hubs);

    try {
      const res = await fetch("/api/hubs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hubRegistry)
      });
      if (res.ok) {
        saveHubsBtn.textContent = "Saved";
        setTimeout(() => { saveHubsBtn.textContent = "Save"; }, 2000);
      }
    } catch (error) {
      console.error("[Catalog] Failed to save hubs", error);
    }
  }

  function renderHubRows() {
    hubRowsEl.replaceChildren();
    hubs.forEach((hub) => addHubRow(hub));
  }

  function addHubRow(hub) {
    const row = document.createElement("div");
    row.className = "catalog-hub-row";
    row.dataset.hubId = hub.id || `hub-${Date.now()}`;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Name";
    nameInput.value = hub.name || "";

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.placeholder = "https://...";
    urlInput.value = hub.url || "";

    const typeSelect = document.createElement("select");
    for (const [val, label] of [["arcgis", "ArcGIS"], ["socrata", "Socrata"]]) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      opt.selected = (hub.type || "arcgis") === val;
      typeSelect.appendChild(opt);
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "catalog-hub-remove";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", "Remove catalog");
    removeBtn.addEventListener("click", () => row.remove());

    row.append(nameInput, urlInput, typeSelect, removeBtn);
    hubRowsEl.appendChild(row);
  }

  function readCurrentHubs() {
    return Array.from(hubRowsEl.querySelectorAll(".catalog-hub-row"))
      .map((row) => {
        const inputs = row.querySelectorAll("input");
        const select = row.querySelector("select");
        return {
          id: row.dataset.hubId,
          name: inputs[0].value.trim(),
          url: inputs[1].value.trim().replace(/\/$/, ""),
          type: select?.value || "arcgis"
        };
      })
      .filter((h) => h.name && h.url);
  }

  // ── Search context and agent events ────────────────────────────────────────

  function getCatalogContext() {
    const vars = getVariables?.() || {};
    return {
      hubs: readCurrentHubs(),
      supportedInputParams: Object.fromEntries(
        Object.entries(hubRegistry).map(([type, group]) => [type, group.supportedInputParams || []])
      ),
      locationContext: {
        coordinates: vars.selectedCoordinates ?? null,
        address: vars.selectedAddress ?? null
      }
    };
  }

  function handleCatalogEvent(event, bubble, thread) {
    clearThinkingText(bubble);
    if (event.type === "search_start") {
      appendSearchIndicator(thread, bubble, event.query, event.hubName);
    } else if (event.type === "search_error") {
      appendSearchError(bubble, event.query, event.hubName, event.message);
    } else if (event.type === "result") {
      addResult(event.item);
      let inlineResultsEl = inlineResultsByBubble.get(bubble);
      if (!inlineResultsEl) {
        inlineResultsEl = document.createElement("div");
        inlineResultsEl.className = "catalog-inline-results";
        bubble.appendChild(inlineResultsEl);
        inlineResultsByBubble.set(bubble, inlineResultsEl);
      }
      appendInlineResult(thread, inlineResultsEl, event.item);
    }
  }

  // ── Results management ─────────────────────────────────────────────────────

  function addResult(item) {
    if (sessionResults.some((r) => r.id === item.id)) return;
    sessionResults.push(item);
    emptyState.remove();
    resultsGrid.appendChild(buildResultCard(item));
    updateResultsCount();
  }

  function clearResults() {
    sessionResults = [];
    resultsGrid.replaceChildren(emptyState);
    updateResultsCount();
  }

  function buildResultCard(item) {
    const card = document.createElement("div");
    card.className = "catalog-result-card";
    card.dataset.resultId = item.id;

    const header = document.createElement("div");
    header.className = "catalog-result-header";

    const title = document.createElement("strong");
    title.className = "catalog-result-title";
    title.textContent = item.title;

    const viewBtn = document.createElement("button");
    viewBtn.className = "catalog-result-view-btn";
    viewBtn.type = "button";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => openDatasetTab(item));

    header.append(title, viewBtn);

    const meta = document.createElement("div");
    meta.className = "catalog-result-meta";
    const typeTag = document.createElement("span");
    typeTag.className = `catalog-result-type ${item.portalType === "socrata" ? "is-socrata" : "is-arcgis"}`;
    typeTag.textContent = item.type || "Dataset";
    meta.append(document.createTextNode(`${item.hubName || ""} `), typeTag);

    const snippet = document.createElement("p");
    snippet.className = "catalog-result-snippet";
    snippet.textContent = item.snippet || "";

    const urlRow = document.createElement("div");
    urlRow.className = "catalog-result-url";
    if (item.url) {
      const a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = item.url;
      urlRow.appendChild(a);
    }

    card.append(header, meta, snippet, urlRow);
    return card;
  }

  function appendInlineResult(thread, container, item) {
    const row = document.createElement("div");
    row.className = "catalog-inline-result";
    row.dataset.resultId = item.id;

    const titleEl = document.createElement("span");
    titleEl.className = "catalog-inline-result-title";
    titleEl.textContent = item.title;
    titleEl.title = item.title;

    const hubEl = document.createElement("span");
    hubEl.className = "catalog-inline-result-hub";
    hubEl.textContent = item.hubName || "";

    const viewBtn = document.createElement("button");
    viewBtn.className = "catalog-inline-result-view";
    viewBtn.type = "button";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => openDatasetTab(item));

    row.append(titleEl, hubEl, viewBtn);
    container.appendChild(row);
    thread.scrollTop = thread.scrollHeight;
  }

  // ── Dataset detail tabs ────────────────────────────────────────────────────

  function openDatasetTab(item) {
    editorTabController.openCatalogDatasetTab(item, buildDatasetDetailPanel(item));
  }

  function buildDatasetDetailPanel(item) {
    const panel = document.createElement("div");
    panel.className = "catalog-detail-panel";

    const header = document.createElement("div");
    header.className = "catalog-detail-header";

    const titleWrap = document.createElement("div");
    const kicker = document.createElement("span");
    kicker.className = "catalog-detail-kicker";
    kicker.textContent = item.hubName || "Catalog dataset";
    const title = document.createElement("h2");
    title.className = "catalog-detail-title";
    title.textContent = item.title || "Untitled dataset";
    titleWrap.append(kicker, title);

    const actions = document.createElement("div");
    actions.className = "catalog-detail-actions";

    if (item.url) {
      const openLink = document.createElement("a");
      openLink.className = "catalog-detail-link";
      openLink.href = item.url;
      openLink.target = "_blank";
      openLink.rel = "noopener noreferrer";
      openLink.textContent = "Open source";
      actions.appendChild(openLink);
    }

    const addBtn = document.createElement("button");
    addBtn.className = "catalog-detail-add";
    addBtn.type = "button";
    addBtn.textContent = "Add source";
    addBtn.addEventListener("click", () => {
      onAddSource?.(item);
      addBtn.textContent = "Added";
      addBtn.disabled = true;
    });
    actions.appendChild(addBtn);

    header.append(titleWrap, actions);

    const meta = document.createElement("dl");
    meta.className = "catalog-detail-meta";
    appendMeta(meta, "Type", item.type || "Dataset");
    appendMeta(meta, "Portal", item.portalType || "Catalog");
    appendMeta(meta, "Owner", item.owner || "Unknown");
    appendMeta(meta, "Identifier", item.id || "Unknown");
    if (item.url) appendMeta(meta, "URL", item.url);

    const description = document.createElement("section");
    description.className = "catalog-detail-section";
    const descriptionTitle = document.createElement("h3");
    descriptionTitle.textContent = "Description";
    const descriptionText = document.createElement("p");
    descriptionText.textContent = item.snippet || "No description was provided by the catalog.";
    description.append(descriptionTitle, descriptionText);

    panel.append(header, meta, description);
    return panel;
  }

  function appendMeta(list, label, value) {
    const term = document.createElement("dt");
    term.textContent = label;
    const desc = document.createElement("dd");
    desc.textContent = value;
    list.append(term, desc);
  }

  // ── Agent thread helpers ───────────────────────────────────────────────────

  function appendSearchIndicator(thread, bubble, query, hubName) {
    const row = document.createElement("div");
    row.className = "catalog-search-indicator";
    const icon = document.createElement("span");
    icon.className = "catalog-search-indicator-icon";
    const text = document.createTextNode(`Searching "${query}" on ${hubName}...`);
    row.append(icon, text);
    bubble.appendChild(row);
    thread.scrollTop = thread.scrollHeight;
  }

  function appendSearchError(bubble, query, hubName, message) {
    const row = document.createElement("div");
    row.className = "catalog-search-indicator catalog-search-error";
    row.textContent = `Search skipped for "${query}" on ${hubName}: ${message}`;
    bubble.appendChild(row);
  }

  function clearThinkingText(bubble) {
    if (bubble.textContent === "Thinking…") bubble.textContent = "";
  }

  function updateResultsCount() {
    const n = sessionResults.length;
    resultsCountEl.textContent = n === 0
      ? "No results yet"
      : `${n} dataset${n === 1 ? "" : "s"} found`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function open() {
    editorTabController.openCatalogResultsTab(resultsPanel);
    agentController.focusComposer("Ask about this place, records, or datasets");
  }

  loadHubs();
  agentController.setCatalogContextProvider(getCatalogContext);
  agentController.setCatalogEventHandler(handleCatalogEvent);

  return { open };
}

function createEmptyHubRegistry() {
  return {
    arcgis: { supportedInputParams: [], items: [] },
    socrata: { supportedInputParams: [], items: [] }
  };
}

function normalizeHubRegistry(registry) {
  if (!registry || Array.isArray(registry) || typeof registry !== "object") {
    return createEmptyHubRegistry();
  }

  const normalized = createEmptyHubRegistry();
  Object.entries(normalized).forEach(([type, group]) => {
    const incoming = registry?.[type] || {};
    group.supportedInputParams = Array.isArray(incoming.supportedInputParams) ? incoming.supportedInputParams : [];
    group.items = Array.isArray(incoming.items) ? incoming.items.map(stripHubType) : [];
  });

  return normalized;
}

function flattenHubRegistry(registry) {
  return Object.entries(registry).flatMap(([type, group]) =>
    (group.items || []).map((hub) => ({ ...hub, type }))
  );
}

function mergeHubsIntoRegistry(registry, hubs) {
  const next = normalizeHubRegistry(registry);
  Object.keys(next).forEach((type) => {
    next[type].items = [];
  });

  hubs.forEach((hub) => {
    const type = hub.type === "socrata" ? "socrata" : "arcgis";
    next[type].items.push(stripHubType(hub));
  });

  return next;
}

function stripHubType(hub) {
  const { type, ...rest } = hub || {};
  return rest;
}
