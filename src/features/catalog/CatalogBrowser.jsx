import { createRoot } from "react-dom/client";
import { DomSlot } from "../editor/DomSlot";
import { PageListView } from "../editor/PageListView";
import { PageMenu } from "../editor/PageMenu";

export function createCatalogController(editorTabController, agentController, getVariables, onAddSource) {
  let hubs = [];
  let hubRegistry = createEmptyHubRegistry();
  let liveSaveTimer = null;
  let liveSaveInFlight = false;
  let liveSaveQueued = false;
  const inlineResultsByBubble = new WeakMap();
  const openHubIds = new Set();

  // ── Catalog registry panel ─────────────────────────────────────────────────

  const resultsPanel = document.createElement("div");
  resultsPanel.className = "catalog-results-panel";

  const saveStatusEl = document.createElement("span");
  saveStatusEl.className = "catalog-save-status";

  const addHubBtn = document.createElement("button");
  addHubBtn.className = "section-tool-button add-source-button";
  addHubBtn.type = "button";
  addHubBtn.setAttribute("aria-label", "Add catalog");
  addHubBtn.title = "Add catalog";
  addHubBtn.addEventListener("click", addHub);

  const pageMenu = document.createElement("div");
  createRoot(pageMenu).render(
    <PageMenu left={<DomSlot nodes={[addHubBtn, saveStatusEl]} />} />
  );

  const hubListEl = document.createElement("div");
  hubListEl.className = "catalog-hub-card-list";

  const pageListView = document.createElement("div");
  createRoot(pageListView).render(
    <PageListView>
      <DomSlot nodes={[hubListEl]} />
    </PageListView>
  );
  resultsPanel.append(pageMenu, pageListView);

  // ── Hub loading ────────────────────────────────────────────────────────────

  async function loadHubs() {
    try {
      const res = await fetch("/api/hubs");
      if (res.ok) {
        hubRegistry = normalizeHubRegistry(await res.json());
        hubs = flattenHubRegistry(hubRegistry);
        renderHubCards();
      }
    } catch (error) {
      console.error("[Catalog] Failed to load hubs", error);
    }
  }

  function queueHubSync() {
    liveSaveQueued = true;
    saveStatusEl.textContent = "Saving...";
    saveStatusEl.classList.remove("is-saved");
    clearTimeout(liveSaveTimer);
    liveSaveTimer = setTimeout(syncHubsNow, 350);
  }

  async function syncHubsNow() {
    if (liveSaveInFlight || !liveSaveQueued) return;
    const serializedRegistry = mergeHubsIntoRegistry(hubRegistry, serializeHubs());
    liveSaveQueued = false;
    liveSaveInFlight = true;

    try {
      const res = await fetch("/api/hubs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializedRegistry)
      });

      if (!res.ok) {
        throw new Error(`Hub save failed with status ${res.status}`);
      }

      hubRegistry = serializedRegistry;
      saveStatusEl.textContent = "Saved";
      saveStatusEl.classList.add("is-saved");
      setTimeout(() => {
        saveStatusEl.textContent = "";
        saveStatusEl.classList.remove("is-saved");
      }, 2000);
    } catch (error) {
      console.error("[Catalog] Live sync failed", error);
      saveStatusEl.textContent = "Save failed";
      saveStatusEl.classList.remove("is-saved");
      liveSaveQueued = true;
    } finally {
      liveSaveInFlight = false;
      if (liveSaveQueued) {
        clearTimeout(liveSaveTimer);
        liveSaveTimer = setTimeout(syncHubsNow, 1000);
      }
    }
  }

  function renderHubCards() {
    hubListEl.replaceChildren();
    hubs.forEach((hub, index) => hubListEl.appendChild(createHubCard(hub, index)));
  }

  function createHubCard(hub, index) {
    const card = document.createElement("details");
    card.className = "catalog-hub-card";
    card.dataset.hubId = hub.id || `hub-${Date.now()}`;

    if (!hub.id) hub.id = card.dataset.hubId;
    card.open = openHubIds.has(hub.id);
    card.addEventListener("toggle", () => {
      if (card.open) {
        openHubIds.add(hub.id);
      } else {
        openHubIds.delete(hub.id);
      }
    });

    const summary = document.createElement("summary");
    summary.className = "catalog-hub-card-summary";

    const summaryText = document.createElement("div");
    summaryText.className = "catalog-hub-card-summary-text";

    const title = document.createElement("strong");
    title.textContent = hub.name || "New catalog";

    const summaryMeta = document.createElement("div");
    summaryMeta.className = "catalog-hub-card-meta";

    const typeLabel = document.createElement("span");
    typeLabel.className = "catalog-hub-type";
    typeLabel.textContent = getHubTypeLabel(hub.type);

    const urlLabel = document.createElement("span");
    urlLabel.className = "catalog-hub-url";
    urlLabel.textContent = hub.url || "No URL";
    urlLabel.title = hub.url || "";

    const removeBtn = document.createElement("button");
    removeBtn.className = "catalog-hub-remove";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", "Remove catalog");
    removeBtn.title = "Remove catalog";
    removeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hubs.splice(index, 1);
      openHubIds.delete(hub.id);
      renderHubCards();
      queueHubSync();
    });

    summaryMeta.append(typeLabel, urlLabel);
    summaryText.append(title, summaryMeta);
    summary.append(summaryText, removeBtn);

    const fields = document.createElement("div");
    fields.className = "catalog-hub-card-fields";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "catalog-hub-name-input";
    nameInput.placeholder = "Name";
    nameInput.value = hub.name || "";

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.className = "catalog-hub-url-input";
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

    nameInput.addEventListener("input", () => {
      hub.name = nameInput.value;
      title.textContent = hub.name.trim() || "New catalog";
      queueHubSync();
    });
    urlInput.addEventListener("input", () => {
      hub.url = urlInput.value;
      urlLabel.textContent = hub.url.trim() || "No URL";
      urlLabel.title = hub.url.trim();
      queueHubSync();
    });
    typeSelect.addEventListener("change", () => {
      hub.type = typeSelect.value;
      typeLabel.textContent = getHubTypeLabel(hub.type);
      queueHubSync();
    });

    fields.append(
      createField("Name", nameInput),
      createField("URL", urlInput),
      createField("Type", typeSelect)
    );
    card.append(summary, fields);
    return card;
  }

  function createField(label, control) {
    const field = document.createElement("label");
    const fieldLabel = document.createElement("span");
    field.className = "catalog-hub-field";
    fieldLabel.textContent = label;
    field.append(fieldLabel, control);
    return field;
  }

  function addHub() {
    const hub = { id: `hub-${Date.now()}`, name: "New catalog", url: "", type: "arcgis" };
    hubs.push(hub);
    openHubIds.add(hub.id);
    renderHubCards();
    hubListEl.lastElementChild?.querySelector(".catalog-hub-name-input")?.focus();
    queueHubSync();
  }

  function getHubTypeLabel(type) {
    return type === "socrata" ? "Socrata" : "ArcGIS";
  }

  function serializeHubs({ onlyValid = false } = {}) {
    const serializedHubs = hubs
      .map((hub) => ({
        ...hub,
        id: hub.id || `hub-${Date.now()}`,
        name: (hub.name || "").trim(),
        url: (hub.url || "").trim().replace(/\/$/, ""),
        type: hub.type === "socrata" ? "socrata" : "arcgis"
      }));

    return onlyValid ? serializedHubs.filter((h) => h.name && h.url) : serializedHubs;
  }

  // ── Search context and agent events ────────────────────────────────────────

  function getCatalogContext() {
    const vars = getVariables?.() || {};
    return {
      hubs: serializeHubs({ onlyValid: true }),
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
