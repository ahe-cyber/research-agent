import { buildUrlWithParams, queryUrl } from "../map/pluto.js";

const DATASET_DRAFT_STORAGE_KEY = "research-agent.datasetSourcesDraft";
const NEW_SOURCE_NAME = "New Source";
const NEW_SOURCE_DESCRIPTION = "New source description";

const BUILT_IN_SOURCES = [
  {
    id: "mapbox-search",
    name: "Mapbox Search",
    description: "Selected address or place from the Search Box component.",
    type: "mapbox-search",
    note: "The component owns suggestion requests. This source records the selected result response.",
    defaultOutputs: [
      {
        path: "features.0.geometry.coordinates",
        variable: "selectedCoordinates"
      },
      {
        path: "features.0.properties.full_address",
        variable: "selectedAddress"
      }
    ]
  }
];

export function SourcesTab({ active }) {
  return (
    <section className={`workspace-tab${active ? " is-active" : ""}`} id="sourcesTab" data-tab-panel hidden={!active}>
      <h2 className="section-title">Sources</h2>
      <div id="sourcesCompact" />
    </section>
  );
}

export function createSourceController(recordController, formulaController, editorTabController, agentController) {
  const variables = {};
  const sourceElements = {};
  const compactSourceList = document.getElementById("sourcesCompact");
  const editSourcesButton = document.getElementById("editSourcesButton");

  const sourceList = document.createElement("div");
  sourceList.id = "sourceList";

  const editorPanel = document.createElement("div");
  editorPanel.className = "editor-sources-panel";

  const editorToolbar = document.createElement("div");
  editorToolbar.className = "editor-sources-toolbar";

  const addDatasetSourceButton = document.createElement("button");
  addDatasetSourceButton.className = "section-tool-button add-source-button";
  addDatasetSourceButton.type = "button";
  addDatasetSourceButton.setAttribute("aria-label", "Add source");
  addDatasetSourceButton.title = "Add source";

  const saveDatasetsButton = document.createElement("button");
  saveDatasetsButton.className = "section-tool-button";
  saveDatasetsButton.type = "button";
  saveDatasetsButton.setAttribute("aria-label", "Save sources");
  saveDatasetsButton.title = "Save sources";
  saveDatasetsButton.textContent = "Save";

  const discardDatasetsButton = document.createElement("button");
  discardDatasetsButton.className = "section-tool-button";
  discardDatasetsButton.type = "button";
  discardDatasetsButton.setAttribute("aria-label", "Discard changes");
  discardDatasetsButton.title = "Discard changes";
  discardDatasetsButton.textContent = "Discard";

  editorToolbar.append(addDatasetSourceButton, saveDatasetsButton, discardDatasetsButton);
  editorPanel.append(editorToolbar, sourceList);

  let datasetSources = [];
  let sourceIdToOpen = "";

  renderSources(BUILT_IN_SOURCES);
  renderCompactSources(BUILT_IN_SOURCES);
  loadDatasetSources();
  addDatasetSourceButton.addEventListener("click", addDatasetSource);
  saveDatasetsButton.addEventListener("click", saveDatasetSources);
  discardDatasetsButton.addEventListener("click", discardDatasetSourceChanges);
  editSourcesButton.addEventListener("click", () => editorTabController.openSourcesTab(editorPanel));

  function renderSources(sources) {
    sources.forEach((source) => {
      if (source.isDeleted) {
        sourceList.appendChild(createDeletedSourceRow(source));
        return;
      }

      const elements = createSourceCard(source);
      sourceElements[source.id] = elements;
      sourceList.appendChild(elements.card);
    });
  }

  function renderCompactSources(sources) {
    sources.forEach((source) => {
      if (source.isDeleted) {
        compactSourceList.appendChild(createDeletedSourceRow(source));
        return;
      }
      compactSourceList.appendChild(createCompactSourceCard(source));
    });
  }

  function createCompactSourceCard(source) {
    const card = document.createElement("details");
    const summaryEl = document.createElement("summary");
    const summaryContent = document.createElement("div");
    const text = document.createElement("div");
    const title = document.createElement("strong");
    const description = document.createElement("span");
    const varFooter = createSourceVariableFooter(source);

    card.className = "source-compact-card";
    summaryEl.className = "source-compact-summary";
    summaryContent.className = "source-compact-summary-content";
    text.className = "source-compact-text";
    title.textContent = getSourceDisplayName(source);
    description.textContent = getSourceDisplayDescription(source);
    text.append(title, description);
    summaryContent.appendChild(text);

    if (source.type !== "mapbox-search") {
      const overviewButton = document.createElement("button");
      overviewButton.className = "source-overview-button";
      overviewButton.type = "button";
      overviewButton.setAttribute("aria-label", `Overview of ${source.name}`);
      overviewButton.title = `Overview of ${source.name}`;
      overviewButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const url = sourceElements[source.id]?.overviewUrlInput?.value?.trim() || source.overviewUrl;
        if (url) window.open(url, "_blank", "noopener");
      });
      summaryContent.appendChild(overviewButton);

      const runButton = document.createElement("button");
      runButton.className = "source-run-button";
      runButton.type = "button";
      runButton.setAttribute("aria-label", `Run ${source.name} query`);
      runButton.title = `Run ${source.name} query`;
      runButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        runDatasetSource(source);
      });
      summaryContent.appendChild(runButton);

      const els = sourceElements[source.id];
      if (els) {
        els.runCompactButton = runButton;
      }
    }

    summaryEl.appendChild(summaryContent);
    card.append(summaryEl, varFooter);
    return card;
  }

  async function loadDatasetSources() {
    try {
      const response = await fetch("/api/datasets");

      if (!response.ok) {
        throw new Error(`Dataset registry failed with status ${response.status}`);
      }

      datasetSources = applyDatasetDraft(await response.json());
      renderSources(datasetSources);
      renderCompactSources(datasetSources);
      refreshAllParamColors();
    } catch (error) {
      console.error(error);
      await loadStaticDatasetSources();
    }
  }

  async function loadStaticDatasetSources() {
    try {
      const response = await fetch("/resources/datasets.json");

      if (!response.ok) {
        throw new Error(`Static dataset registry failed with status ${response.status}`);
      }

      datasetSources = applyDatasetDraft(await response.json());
      renderSources(datasetSources);
      renderCompactSources(datasetSources);
      refreshAllParamColors();
    } catch (error) {
      console.error(error);
    }
  }

  async function saveDatasetSources() {
    const serializedSources = serializeDatasetSources();
    saveDatasetsButton.disabled = true;
    discardDatasetsButton.disabled = true;

    try {
      const response = await fetch("/api/datasets", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(serializedSources)
      });

      if (!response.ok) {
        throw new Error(`Dataset save failed with status ${response.status}`);
      }

      datasetSources = serializedSources;
      localStorage.removeItem(DATASET_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error(error);
    } finally {
      saveDatasetsButton.disabled = false;
      discardDatasetsButton.disabled = false;
    }
  }

  async function discardDatasetSourceChanges() {
    localStorage.removeItem(DATASET_DRAFT_STORAGE_KEY);
    await reloadDatasetSources();
  }

  async function reloadDatasetSources() {
    sourceList.replaceChildren();
    compactSourceList.replaceChildren();
    Object.keys(sourceElements).forEach((key) => {
      delete sourceElements[key];
    });
    renderSources(BUILT_IN_SOURCES);
    renderCompactSources(BUILT_IN_SOURCES);
    await loadDatasetSources();
  }

  function applyDatasetDraft(sources) {
    const draft = readDatasetDraft();
    return draft || sources;
  }

  function readDatasetDraft() {
    try {
      const rawDraft = localStorage.getItem(DATASET_DRAFT_STORAGE_KEY);
      const draft = rawDraft ? JSON.parse(rawDraft) : null;
      return Array.isArray(draft) ? draft : null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function saveDatasetDraft() {
    localStorage.setItem(DATASET_DRAFT_STORAGE_KEY, JSON.stringify(serializeDatasetDraftSources()));
  }

  function addDatasetSource() {
    const source = createEmptyDatasetSource();
    datasetSources.push(source);
    sourceIdToOpen = source.id;
    saveDatasetDraft();
    redrawDatasetSources();
  }

  function createEmptyDatasetSource() {
    const id = `source-${Date.now().toString(36)}`;

    return {
      id,
      name: "",
      description: "",
      type: "arcgis-feature-layer",
      method: "GET",
      overviewUrl: "",
      defaultParams: [],
      defaultOutputs: []
    };
  }

  function serializeDatasetSources() {
    return datasetSources.filter((source) => !source.isDeleted).map((source) => {
      const elements = sourceElements[source.id];

      return {
        ...source,
        name: elements?.titleInput ? elements.titleInput.value.trim() : source.name,
        description: elements?.descriptionInput ? elements.descriptionInput.value.trim() : source.description,
        overviewUrl: elements?.overviewUrlInput ? elements.overviewUrlInput.value.trim() : source.overviewUrl,
        defaultParams: elements?.paramsGrid ? collectSourceRowPairs(elements.paramsGrid, "key", "value") : source.defaultParams,
        defaultOutputs: elements?.outputsGrid ? collectSourceRowPairs(elements.outputsGrid, "variable", "path") : source.defaultOutputs,
        layerFields: source.layerFields || []
      };
    });
  }

  function serializeDatasetDraftSources() {
    return datasetSources.map((source) => {
      if (source.isDeleted) {
        return source;
      }

      const elements = sourceElements[source.id];

      return {
        ...source,
        name: elements?.titleInput ? elements.titleInput.value.trim() : source.name,
        description: elements?.descriptionInput ? elements.descriptionInput.value.trim() : source.description,
        overviewUrl: elements?.overviewUrlInput ? elements.overviewUrlInput.value.trim() : source.overviewUrl,
        defaultParams: elements?.paramsGrid ? collectSourceRowPairs(elements.paramsGrid, "key", "value") : source.defaultParams,
        defaultOutputs: elements?.outputsGrid ? collectSourceRowPairs(elements.outputsGrid, "variable", "path") : source.defaultOutputs,
        layerFields: source.layerFields || []
      };
    });
  }

  function createDeletedSourceRow(source) {
    const row = document.createElement("div");
    const line = document.createElement("div");
    const label = document.createElement("span");
    const revertButton = document.createElement("button");

    row.className = "source-deleted-row";
    line.className = "source-deleted-line";
    label.className = "source-deleted-label";
    label.textContent = `Deleted: ${source.name}`;
    line.appendChild(label);
    revertButton.className = "circle-icon-button revert-source-button";
    revertButton.type = "button";
    revertButton.setAttribute("aria-label", `Restore ${source.name}`);
    revertButton.title = `Restore ${source.name}`;
    revertButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      revertSourceDelete(source.id);
    });

    row.append(line, revertButton);
    return row;
  }

  function markSourceDeleted(source) {
    source.isDeleted = true;
    saveDatasetDraft();
    redrawDatasetSources();
  }

  function revertSourceDelete(sourceId) {
    const source = datasetSources.find((candidate) => candidate.id === sourceId);

    if (!source) {
      return;
    }

    delete source.isDeleted;
    saveDatasetDraft();
    redrawDatasetSources();
  }

  function redrawDatasetSources() {
    sourceList.replaceChildren();
    compactSourceList.replaceChildren();
    Object.keys(sourceElements).forEach((key) => {
      delete sourceElements[key];
    });
    renderSources(BUILT_IN_SOURCES);
    renderSources(datasetSources);
    renderCompactSources(BUILT_IN_SOURCES);
    renderCompactSources(datasetSources);
    refreshAllParamColors();
  }

  function createSourceCard(source) {
    const card = document.createElement("details");
    const summary = document.createElement("summary");
    const summaryContent = document.createElement("div");
    const summaryMain = document.createElement("div");
    const summaryText = document.createElement("div");
    const summaryEdit = document.createElement("div");
    const deleteButton = document.createElement("button");
    const title = document.createElement("strong");
    const description = document.createElement("span");
    const titleInput = document.createElement("input");
    const descriptionInput = document.createElement("textarea");
    const body = document.createElement("div");
    const outputGrid = createGrid("Variable", "Path");
    const variableFooter = createSourceVariableFooter(source);
    const saveSourceDraft = source.type === "mapbox-search" ? () => {} : saveDatasetDraft;
    const refreshSourceFooter = () => updateSourceVariableFooter(variableFooter, source, paramsGrid && paramsGrid.rows, outputGrid.rows);
    const onSourceChange = () => {
      saveSourceDraft();
      refreshSourceFooter();
      refreshAllParamColors();
    };

    card.className = "source-editor";
    card.open = source.id === sourceIdToOpen;
    if (card.open) {
      sourceIdToOpen = "";
    }
    summary.className = "source-editor-summary";
    summaryContent.className = "source-editor-summary-content";
    summaryMain.className = "source-editor-summary-main";
    summaryText.className = "source-editor-summary-text";
    body.className = "source-editor-body";
    title.textContent = getSourceDisplayName(source);
    description.textContent = getSourceDisplayDescription(source);
    titleInput.className = "source-title-input";
    titleInput.type = "text";
    titleInput.value = source.name;
    descriptionInput.className = "source-description-input";
    descriptionInput.rows = 3;
    descriptionInput.value = source.description;
    deleteButton.className = "circle-icon-button delete-source-button source-editor-delete-button";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Delete ${source.name}`);
    deleteButton.title = `Delete ${source.name}`;
    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markSourceDeleted(source);
    });

    const closeButton = document.createElement("button");
    closeButton.className = "circle-icon-button source-editor-close-button";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close");
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      card.open = false;
    });

    summary.addEventListener("click", (event) => {
      if (card.open) {
        event.preventDefault();
      }
    });

    summaryText.append(title, description);
    summaryEdit.className = "source-summary-edit";
    summaryEdit.append(titleInput, descriptionInput);
    [titleInput, descriptionInput].forEach((input) => {
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();

        if (event.key === " ") {
          event.preventDefault();
          insertTextAtCursor(input, " ");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      input.addEventListener("keyup", (event) => {
        event.stopPropagation();

        if (event.key === " ") {
          event.preventDefault();
        }
      });
      input.addEventListener("input", () => {
        source.name = titleInput.value;
        source.description = descriptionInput.value;
        title.textContent = titleInput.value.trim() || NEW_SOURCE_NAME;
        description.textContent = descriptionInput.value.trim() || NEW_SOURCE_DESCRIPTION;
        saveSourceDraft();
      });
    });

    if (source.type !== "mapbox-search") {
      const syncButton = document.createElement("button");
      syncButton.className = "circle-icon-button sync-source-button source-editor-delete-button";
      syncButton.type = "button";
      syncButton.setAttribute("aria-label", `Sync ${source.name} from ArcGIS layer`);
      syncButton.title = "Pull fields from ArcGIS layer (Overview URL)";

      syncButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const url = (overviewUrlInput?.value?.trim() || source.overviewUrl || "").replace(/\/$/, "");
        if (!url) return;

        syncButton.disabled = true;
        syncButton.classList.remove("is-success", "is-error");

        try {
          const result = await queryUrl(`${url}?f=pjson`);

          if (!result.response?.fields) {
            console.warn("[Sync] Unexpected response — no fields array", result);
            syncButton.classList.add("is-error");
            return;
          }

          const layerInfo = result.response;
          const fields = layerInfo.fields;

          // Name
          if (layerInfo.name) {
            titleInput.value = layerInfo.name;
            title.textContent = layerInfo.name;
            source.name = layerInfo.name;
          }

          // Description (strip HTML tags ArcGIS sometimes includes)
          const rawDesc = typeof layerInfo.description === "string" ? layerInfo.description : "";
          const cleanDesc = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (cleanDesc) {
            descriptionInput.value = cleanDesc;
            description.textContent = cleanDesc;
            source.description = cleanDesc;
          }

          // Standard ArcGIS query params
          if (paramsGrid) {
            paramsGrid.rows.replaceChildren();
            [
              ["geometry",       "{{selectedCoordinates}}"],
              ["geometryType",   "esriGeometryPoint"],
              ["inSR",           "4326"],
              ["spatialRel",     "esriSpatialRelIntersects"],
              ["outFields",      "*"],
              ["returnGeometry", "true"],
              ["outSR",          "4326"],
              ["f",              "geojson"],
            ].forEach(([k, v]) => appendParamRow(paramsGrid.rows, k, v, onSourceChange, getLayerFields));
          }

          // Store and display layer fields
          source.layerFields = fields;
          if (layerFieldsContainer) renderLayerFields(layerFieldsContainer, fields, onFieldClick);

          onSourceChange();
          syncButton.classList.add("is-success");
          setTimeout(() => syncButton.classList.remove("is-success"), 2000);
        } catch (error) {
          console.error("[Sync] Failed", error);
          syncButton.classList.add("is-error");
          setTimeout(() => syncButton.classList.remove("is-error"), 2000);
        } finally {
          syncButton.disabled = false;
        }
      });

      const sideButtons = document.createElement("div");
      sideButtons.className = "source-editor-side-buttons";
      sideButtons.append(deleteButton, syncButton);
      summaryMain.appendChild(sideButtons);
    }
    summaryMain.append(summaryText, summaryEdit);

    summaryMain.appendChild(closeButton);
    summaryContent.append(summaryMain, variableFooter);
    summary.appendChild(summaryContent);

    if (source.note) {
      body.appendChild(createNote(source.note));
    }

    let queryUrlInput = null;
    let overviewUrlInput = null;
    let paramsGrid = null;
    let layerFieldsContainer = null;
    const getLayerFields = () => source.layerFields || [];
    const onFieldClick = (field) => {
      appendSourceRow(outputGrid.rows, "", `features.0.properties.${field.name}`, onSourceChange);
      onSourceChange();
    };

    if (source.type !== "mapbox-search") {
      overviewUrlInput = document.createElement("input");
      overviewUrlInput.className = "source-url-input";
      overviewUrlInput.type = "text";
      overviewUrlInput.value = source.overviewUrl || "";
      overviewUrlInput.addEventListener("input", onSourceChange);

      body.append(createFieldGroup("Source URL", overviewUrlInput));

      paramsGrid = createGrid("Key", "Value");
      appendSection(body, "Input Settings", paramsGrid);
      (source.defaultParams || []).forEach((row) => {
        appendParamRow(paramsGrid.rows, row.key, row.value, onSourceChange, getLayerFields);
      });

      const addParamBtn = document.createElement("button");
      addParamBtn.className = "record-action";
      addParamBtn.type = "button";
      addParamBtn.textContent = "Add parameter";
      addParamBtn.addEventListener("click", () => {
        appendParamRow(paramsGrid.rows, "", "", onSourceChange, getLayerFields);
        onSourceChange();
      });
      body.appendChild(addParamBtn);

      // Available param tags — click to add a row with the key pre-filled
      const paramTagsContainer = document.createElement("div");
      paramTagsContainer.className = "layer-fields-tags param-hint-tags";

      Object.entries(ARCGIS_QUERY_PARAM_HINTS).forEach(([key, hint]) => {
        const tag = document.createElement("span");
        tag.className = "layer-fields-tag layer-fields-tag--clickable";
        tag.textContent = key;

        const lines = [hint.label, hint.description];
        if (hint.values) lines.push("Options: " + hint.values.join(", "));
        else if (hint.example) lines.push("e.g. " + hint.example);
        tag.title = lines.join("\n");

        tag.addEventListener("click", () => {
          appendParamRow(paramsGrid.rows, key, "", onSourceChange, getLayerFields);
          onSourceChange();
        });
        paramTagsContainer.appendChild(tag);
      });

      body.appendChild(paramTagsContainer);
    }

    appendSection(body, "Output Settings", outputGrid);
    (source.defaultOutputs || []).forEach((row) => {
      appendSourceRow(outputGrid.rows, row.variable, row.path, onSourceChange);
    });
    body.appendChild(createAddButton("Add output", outputGrid.rows, onSourceChange));

    if (source.type !== "mapbox-search") {
      layerFieldsContainer = document.createElement("div");
      body.appendChild(layerFieldsContainer);
      renderLayerFields(layerFieldsContainer, source.layerFields, onFieldClick);
    }

    card.append(summary, body);

    return {
      card,
      titleInput,
      descriptionInput,
      overviewUrlInput,
      paramsGrid: paramsGrid && paramsGrid.rows,
      outputsGrid: outputGrid.rows
    };
  }

  async function runDatasetSource(source) {
    const elements = sourceElements[source.id];

    const params = collectSourceRows(elements.paramsGrid, resolveVariableValue);
    const baseUrl = (elements.overviewUrlInput?.value?.trim() || source.overviewUrl || "").replace(/\/$/, "");
    const url = buildUrlWithParams(`${baseUrl}/query`, params);

    try {
      updateSourceRunState(elements, "");
      const result = await queryUrl(url);
      const outputVariables = result.responseType === "html"
        ? collectHtmlOutputVariables(elements.outputsGrid, result.response, formulaController)
        : collectOutputVariables(elements.outputsGrid, result.response, formulaController);

      Object.entries(outputVariables).forEach(([name, value]) => {
        setVariable(name, value);
      });

      const { responseText, ...resultForPayload } = result;

      const storedRecord = recordController.add({
        kind: source.name,
        title: `${source.name} manual query`,
        request: result.request,
        response: result.response,
        durationMs: result.durationMs,
        timestamp: result.timestamp,
        payload: {
          ...resultForPayload,
          source: {
            id: source.id,
            type: source.type,
            mapDisplay: source.mapDisplay
          },
          outputVariables
        }
      });
      agentController?.attachRecord(storedRecord);
      updateSourceRunState(elements, result.responseType !== "html" && hasResponseError(result.response) ? "error" : "success");
    } catch (error) {
      updateSourceRunState(elements, "error");
      console.error("[Sources] Query failed", error.details || error);
    }
  }

  function updateSourceRunState(elements, state) {
    [elements.runHeaderButton, elements.runButton, elements.runCompactButton].forEach((button) => {
      if (!button) {
        return;
      }

      button.classList.toggle("is-success", state === "success");
      button.classList.toggle("is-error", state === "error");
    });
  }

  function hasResponseError(response) {
    return Boolean(response && typeof response === "object" && response.error);
  }

  function setVariable(name, value) {
    variables[name] = value;
  }

  function assignMapboxSearchOutputs(searchResult) {
    const mapboxSource = sourceElements["mapbox-search"];
    const outputVariables = collectOutputVariables(mapboxSource.outputsGrid, searchResult, formulaController);
    const normalizedOutputVariables = {};

    Object.entries(outputVariables).forEach(([name, value]) => {
      normalizedOutputVariables[name] = normalizeVariableValue(value);
      setVariable(name, value);
    });

    return normalizedOutputVariables;
  }

  function resolveVariableValue(value) {
    // Replace all {{varName}} tokens with their resolved values.
    // Plain text (no braces) is returned as-is.
    return value.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmed = varName.trim();

      if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
        return normalizeVariableValue(variables[trimmed]);
      }

      const resolvedPathValue = getValueAtPath(variables, trimmed);

      if (resolvedPathValue !== undefined) {
        return normalizeVariableValue(resolvedPathValue);
      }

      return match; // unresolved — keep token text so the URL shows something meaningful
    });
  }

  // ── Variable color helpers ────────────────────────────────────────────────

  // Returns Map<varName, sourceName> for all output variables defined by sources
  // other than excludeSourceId.
  function getAvailableOutputVarsFor(excludeSourceId) {
    const map = new Map();
    const allSources = [...BUILT_IN_SOURCES, ...datasetSources];

    for (const source of allSources) {
      if (source.id === excludeSourceId || source.isDeleted) continue;
      const sourceName = getSourceDisplayName(source);
      const els = sourceElements[source.id];

      if (els?.outputsGrid) {
        collectSourceRowPairs(els.outputsGrid, "variable", "path").forEach((p) => {
          if (p.variable && !map.has(p.variable)) map.set(p.variable, sourceName);
        });
      } else {
        (source.defaultOutputs || []).forEach((o) => {
          if (o.variable && !map.has(o.variable)) map.set(o.variable, sourceName);
        });
      }
    }

    return map;
  }

  function refreshAllParamColors() {
    const allSources = [...BUILT_IN_SOURCES, ...datasetSources];

    for (const source of allSources) {
      if (source.isDeleted) continue;
      const els = sourceElements[source.id];
      if (!els?.paramsGrid) continue;

      const availVars = getAvailableOutputVarsFor(source.id);
      const inputs = Array.from(els.paramsGrid.querySelectorAll("input"));

      // Grid alternates key/value — value inputs are at odd indices (1, 3, 5, …)
      for (let i = 1; i < inputs.length; i += 2) {
        applyParamValueColor(inputs[i], availVars);
      }
    }
  }

  return { setVariable, assignMapboxSearchOutputs };
}

// availableVars: Map<varName, sourceName>
// ── ArcGIS query param hints ──────────────────────────────────────────────────

const ARCGIS_QUERY_PARAM_HINTS = {
  where:                { label: "Where Clause",            description: "SQL WHERE clause for attribute filtering.",                                           example: "1=1" },
  geometry:             { label: "Geometry",                description: "Geometry to apply as spatial filter. For a point, provide coordinates as lng,lat.",   example: "{{selectedCoordinates}}" },
  geometryType:         { label: "Geometry Type",           description: "Type of geometry specified by the geometry parameter.",                                values: ["esriGeometryPoint", "esriGeometryMultipoint", "esriGeometryPolyline", "esriGeometryPolygon", "esriGeometryEnvelope"] },
  inSR:                 { label: "Input Spatial Reference", description: "WKID of the input geometry's spatial reference.",                                     example: "4326" },
  spatialRel:           { label: "Spatial Relationship",    description: "Spatial relationship to apply between the geometry filter and each feature.",          values: ["esriSpatialRelIntersects", "esriSpatialRelContains", "esriSpatialRelWithin", "esriSpatialRelEnvelopeIntersects", "esriSpatialRelTouches", "esriSpatialRelOverlaps", "esriSpatialRelCrosses"] },
  outFields:            { label: "Output Fields",           description: "Comma-separated field names to return. Use * for all. Layer fields listed below.",     example: "*" },
  returnGeometry:       { label: "Return Geometry",         description: "Whether to include geometry shapes in the response.",                                  values: ["true", "false"] },
  outSR:                { label: "Output Spatial Reference", description: "WKID for the spatial reference of returned geometries.",                              example: "4326" },
  f:                    { label: "Response Format",         description: "Format of the API response.",                                                          values: ["geojson", "json", "pjson"] },
  resultOffset:         { label: "Result Offset",           description: "Number of records to skip from the start (for pagination).",                           example: "0" },
  resultRecordCount:    { label: "Result Record Count",     description: "Maximum number of features to return per request.",                                    example: "10" },
  orderByFields:        { label: "Order By Fields",         description: "Fields to sort results by. Append ASC or DESC.",                                       example: "OBJECTID ASC" },
  objectIds:            { label: "Object IDs",              description: "Comma-separated list of specific feature object IDs to return.",                       example: "1,2,3" },
  returnDistinctValues: { label: "Return Distinct Values",  description: "Return only distinct values for the specified outFields.",                             values: ["true", "false"] },
  returnCountOnly:      { label: "Return Count Only",       description: "Return only the feature count matching the query, not the features themselves.",       values: ["true", "false"] },
};

// ── Suggestion popover (singleton) ────────────────────────────────────────────

let _suggestionPopover = null;
let _suggestionActiveInput = null;

function getSuggestionPopover() {
  if (!_suggestionPopover) {
    _suggestionPopover = document.createElement("div");
    _suggestionPopover.className = "param-suggestion-popover";
    _suggestionPopover.hidden = true;
    document.body.appendChild(_suggestionPopover);

    document.addEventListener("mousedown", (e) => {
      if (
        _suggestionActiveInput &&
        !_suggestionPopover.contains(e.target) &&
        e.target !== _suggestionActiveInput
      ) {
        hideSuggestionPopover();
      }
    }, true);
  }

  return _suggestionPopover;
}

function showSuggestionPopover(valueInput, keyName, layerFields) {
  const hint = ARCGIS_QUERY_PARAM_HINTS[keyName];
  const isOutFields = keyName === "outFields" && layerFields.length > 0;

  if (!hint && !isOutFields) {
    hideSuggestionPopover();
    return;
  }

  const popover = getSuggestionPopover();
  _suggestionActiveInput = valueInput;
  popover.replaceChildren();

  if (hint) {
    const header = document.createElement("div");
    header.className = "param-suggestion-header";

    const label = document.createElement("strong");
    label.className = "param-suggestion-label";
    label.textContent = hint.label;

    const desc = document.createElement("span");
    desc.className = "param-suggestion-desc";
    desc.textContent = hint.description;

    header.append(label, desc);
    popover.appendChild(header);

    if (hint.values) {
      const opts = document.createElement("div");
      opts.className = "param-suggestion-options";

      hint.values.forEach((v) => {
        const btn = document.createElement("button");
        btn.className = "param-suggestion-item";
        btn.type = "button";
        btn.textContent = v;
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          valueInput.value = v;
          valueInput.dispatchEvent(new Event("input", { bubbles: true }));
          hideSuggestionPopover();
        });
        opts.appendChild(btn);
      });

      popover.appendChild(opts);
    } else if (hint.example) {
      const ex = document.createElement("div");
      ex.className = "param-suggestion-example";
      ex.textContent = `e.g. ${hint.example}`;
      popover.appendChild(ex);
    }
  }

  // For outFields: also show layer field names as clickable toggles
  if (isOutFields) {
    const fieldOpts = document.createElement("div");
    fieldOpts.className = "param-suggestion-options";

    const starBtn = document.createElement("button");
    starBtn.className = "param-suggestion-item";
    starBtn.type = "button";
    starBtn.textContent = "* — all fields";
    starBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      valueInput.value = "*";
      valueInput.dispatchEvent(new Event("input", { bubbles: true }));
      hideSuggestionPopover();
    });
    fieldOpts.appendChild(starBtn);

    layerFields.forEach((field) => {
      const btn = document.createElement("button");
      btn.className = "param-suggestion-item";
      btn.type = "button";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = field.name;

      const aliasSpan = document.createElement("span");
      aliasSpan.className = "param-suggestion-item-sub";
      aliasSpan.textContent = field.alias && field.alias !== field.name ? field.alias : "";

      btn.append(nameSpan, aliasSpan);
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const parts = valueInput.value.split(",").map((s) => s.trim()).filter(Boolean);
        const idx = parts.indexOf(field.name);
        if (idx === -1) parts.push(field.name); else parts.splice(idx, 1);
        valueInput.value = parts.join(", ");
        valueInput.dispatchEvent(new Event("input", { bubbles: true }));
        // keep popover open for multi-select
      });
      fieldOpts.appendChild(btn);
    });

    popover.appendChild(fieldOpts);
  }

  const rect = valueInput.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 4}px`;
  popover.style.left = `${rect.left}px`;
  popover.style.minWidth = `${rect.width}px`;
  popover.hidden = false;
}

function hideSuggestionPopover() {
  if (_suggestionPopover) _suggestionPopover.hidden = true;
  _suggestionActiveInput = null;
}

// ── appendParamRow — like appendSourceRow but with ArcGIS suggestion popover ──

function appendParamRow(grid, key = "", value = "", onChange = () => {}, getLayerFields = () => []) {
  const keyInput = document.createElement("input");
  const valueInput = document.createElement("input");

  keyInput.type = "text";
  valueInput.type = "text";
  keyInput.value = key;
  valueInput.value = value;

  function refreshHint() {
    showSuggestionPopover(valueInput, keyInput.value.trim(), getLayerFields());
  }

  keyInput.addEventListener("input", () => {
    if (document.activeElement === valueInput) refreshHint();
    onChange();
  });

  valueInput.addEventListener("focus", refreshHint);
  valueInput.addEventListener("input", onChange);
  valueInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (!_suggestionPopover?.contains(document.activeElement)) hideSuggestionPopover();
    }, 150);
  });

  const deleteBtn = createRowDeleteButton(() => {
    keyInput.remove();
    valueInput.remove();
    deleteBtn.remove();
    onChange();
  });

  grid.append(keyInput, valueInput, deleteBtn);
}

// ── Layer fields renderer ─────────────────────────────────────────────────────

function renderLayerFields(container, fields, onFieldClick = null) {
  container.replaceChildren();

  if (!fields || fields.length === 0) {
    const note = document.createElement("p");
    note.className = "source-note";
    note.textContent = "No fields synced yet — use the sync button with an Overview URL.";
    container.appendChild(note);
    return;
  }

  const tags = document.createElement("div");
  tags.className = "layer-fields-tags";

  fields.forEach((field) => {
    const tag = document.createElement("span");
    tag.className = `layer-fields-tag${onFieldClick ? " layer-fields-tag--clickable" : ""}`;
    tag.textContent = `${field.name} (${formatEsriFieldType(field.type)})`;
    tag.title = field.alias && field.alias !== field.name ? field.alias : field.name;
    if (onFieldClick) tag.addEventListener("click", () => onFieldClick(field));
    tags.appendChild(tag);
  });

  container.appendChild(tags);
}

function formatEsriFieldType(esriType) {
  return (esriType || "").replace("esriFieldType", "");
}

// Converts a field name/alias like "Borough Block Lot" or "BBL_NUM" to camelCase.
function fieldNameToVariable(str) {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9\s_]/g, "")
    .replace(/[\s_]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

function applyParamValueColor(input, availableVars) {
  const tokens = [...input.value.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim());

  if (tokens.length === 0) {
    input.classList.remove("param-value-resolved", "param-value-unresolved");
    input.removeAttribute("title");
    return;
  }

  const allResolved = tokens.every((t) => availableVars.has(t));
  input.classList.toggle("param-value-resolved", allResolved);
  input.classList.toggle("param-value-unresolved", !allResolved);

  input.title = tokens
    .map((t) => {
      const source = availableVars.get(t);
      return source ? `${t} — ${source}` : `${t} — not defined`;
    })
    .join("\n");
}

function createFieldGroup(labelText, input) {
  const group = document.createElement("div");
  group.className = "source-field-group";
  const label = document.createElement("label");
  label.className = "field-label";
  label.textContent = labelText;
  group.append(label, input);
  return group;
}

function appendSection(body, title, grid) {
  const heading = document.createElement("h3");
  heading.className = "subsection-title";
  heading.textContent = title;
  body.append(heading, grid.heading, grid.rows);
}

function createGrid(firstHeading, secondHeading) {
  const heading = document.createElement("div");
  const rows = document.createElement("div");
  const first = document.createElement("span");
  const second = document.createElement("span");

  heading.className = "source-grid source-grid-heading";
  rows.className = "source-grid";
  first.textContent = firstHeading;
  second.textContent = secondHeading;
  heading.append(first, second, document.createElement("span")); // spacer for delete column

  return { heading, rows };
}

function createNote(text) {
  const note = document.createElement("p");
  note.className = "source-note";
  note.textContent = text;
  return note;
}

function insertTextAtCursor(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(text, start, end, "end");
}

function getSourceDisplayName(source) {
  return source.name || NEW_SOURCE_NAME;
}

function getSourceDisplayDescription(source) {
  return source.description || NEW_SOURCE_DESCRIPTION;
}

function createSourceVariableFooter(source) {
  const footer = document.createElement("div");

  footer.className = "source-variable-footer";
  updateSourceVariableFooter(footer, source);
  return footer;
}

function updateSourceVariableFooter(footer, source, paramsGrid = null, outputsGrid = null) {
  const inputNames = paramsGrid
    ? collectSourceRowPairs(paramsGrid, "key", "value").flatMap((row) => extractVariableTokens(row.value))
    : getInputVariableNames(source);
  const outputNames = outputsGrid ? collectSourceRowPairs(outputsGrid, "variable", "path").map((row) => row.variable).filter(Boolean) : getOutputVariableNames(source);

  footer.replaceChildren(
    createVariableList("Inputs", inputNames),
    createVariableList("Outputs", outputNames)
  );
}

function createVariableList(title, names) {
  const section = document.createElement("div");
  const heading = document.createElement("strong");
  const table = document.createElement("table");
  const body = document.createElement("tbody");

  section.className = "source-variable-list";
  heading.textContent = title;

  if (names.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.textContent = "None";
    row.appendChild(cell);
    body.appendChild(row);
  } else {
    names.forEach((name) => {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = name;
      row.appendChild(cell);
      body.appendChild(row);
    });
  }

  table.appendChild(body);
  section.append(heading, table);
  return section;
}

function getInputVariableNames(source) {
  return (source.defaultParams || []).flatMap((row) => extractVariableTokens(row.value));
}

// Returns the inner names of all {{varName}} tokens in a string, stripping the braces.
function extractVariableTokens(value) {
  if (!value) return [];
  return [...value.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim());
}

function getOutputVariableNames(source) {
  return (source.defaultOutputs || [])
    .map((row) => row.variable)
    .filter(Boolean);
}

function createAddButton(label, grid, onChange) {
  const button = document.createElement("button");
  button.className = "record-action";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    appendSourceRow(grid, "", "", onChange);
    onChange();
  });
  return button;
}

function createRowDeleteButton(onClick) {
  const btn = document.createElement("button");
  btn.className = "row-delete-button";
  btn.type = "button";
  btn.setAttribute("aria-label", "Remove row");
  btn.addEventListener("click", onClick);
  return btn;
}

function appendSourceRow(grid, key = "", value = "", onChange = () => {}) {
  const keyInput = document.createElement("input");
  const valueInput = document.createElement("input");
  const deleteBtn = createRowDeleteButton(() => {
    keyInput.remove();
    valueInput.remove();
    deleteBtn.remove();
    onChange();
  });

  keyInput.type = "text";
  valueInput.type = "text";
  keyInput.value = key;
  valueInput.value = value;
  keyInput.addEventListener("input", onChange);
  valueInput.addEventListener("input", onChange);

  grid.append(keyInput, valueInput, deleteBtn);
}

function collectSourceRows(grid, resolveValue) {
  const inputs = Array.from(grid.querySelectorAll("input"));
  const rows = {};

  for (let index = 0; index < inputs.length; index += 2) {
    const key = inputs[index].value.trim();
    const value = inputs[index + 1].value.trim();

    if (key) {
      rows[key] = resolveValue(value);
    }
  }

  return rows;
}

function collectSourceRowPairs(grid, firstKey, secondKey) {
  const inputs = Array.from(grid.querySelectorAll("input"));
  const rows = [];

  for (let index = 0; index < inputs.length; index += 2) {
    const firstValue = inputs[index].value.trim();
    const secondValue = inputs[index + 1].value.trim();

    if (firstValue || secondValue) {
      rows.push({
        [firstKey]: firstValue,
        [secondKey]: secondValue
      });
    }
  }

  return rows;
}

function collectHtmlOutputVariables(grid, parsedResponse, formulaController) {
  const inputs = Array.from(grid.querySelectorAll("input"));
  const outputVariables = {};

  for (let index = 0; index < inputs.length; index += 2) {
    const variableName = inputs[index].value.trim();
    const expression = inputs[index + 1].value.trim();

    if (expression && variableName) {
      outputVariables[variableName] = evaluateHtmlOutputExpression(parsedResponse, expression, formulaController, outputVariables);
    }
  }

  return outputVariables;
}

function evaluateHtmlOutputExpression(response, expression, formulaController, computedVariables = {}) {
  const formulaMatch = expression.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);

  if (formulaMatch && formulaController?.hasFormula(formulaMatch[1])) {
    const argExprs = parseFormulaArgs(formulaMatch[2]);
    const argValues = argExprs.map((arg) => resolveFormulaHtmlArg(arg, response, computedVariables));
    return formulaController.applyFormula(formulaMatch[1], argValues);
  }

  if (Object.prototype.hasOwnProperty.call(computedVariables, expression)) {
    return computedVariables[expression];
  }

  return queryHtmlObject(response, expression);
}

function resolveFormulaHtmlArg(arg, response, computedVariables) {
  if (arg.startsWith('"') && arg.endsWith('"') && arg.length >= 2) {
    return arg.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(arg)) {
    return Number(arg);
  }
  if (Object.prototype.hasOwnProperty.call(computedVariables, arg)) {
    return computedVariables[arg];
  }
  const fromComputed = getValueAtPath(computedVariables, arg);
  if (fromComputed !== undefined) return fromComputed;
  return queryHtmlObject(response, arg);
}

function queryHtmlObject(root, selector) {
  const colIndexMatch = selector.match(/^(.*?)\.\*(\d+)$/);
  if (colIndexMatch) {
    const el = resolveHtmlSelector(root, colIndexMatch[1].trim());
    return el?.tag === "table" ? extractTableColumn(el, parseInt(colIndexMatch[2], 10)) : null;
  }

  const colHeaderMatch = selector.match(/^(.*?)\."([^"]+)"$/);
  if (colHeaderMatch) {
    const el = resolveHtmlSelector(root, colHeaderMatch[1].trim());
    return el?.tag === "table" ? extractTableColumnByHeader(el, colHeaderMatch[2]) : null;
  }

  const rowMatch = selector.match(/^(.*?)\.(\d+)$/);
  if (rowMatch) {
    const el = resolveHtmlSelector(root, rowMatch[1].trim());
    return el?.tag === "table" ? extractTableRow(el, parseInt(rowMatch[2], 10)) : null;
  }

  return resolveHtmlSelector(root, selector);
}

function resolveHtmlSelector(root, selector) {
  const s = selector.trim().toLowerCase();
  const dotAt = s.indexOf(".");

  if (dotAt === 0) {
    const cls = s.slice(1);
    return findHtmlNode(root, (el) => el.attributes?.class?.split(/\s+/).includes(cls));
  }

  if (s.startsWith("#")) {
    const id = s.slice(1);
    return findHtmlNode(root, (el) => el.attributes?.id === id);
  }

  if (dotAt > 0) {
    const tag = s.slice(0, dotAt);
    const cls = s.slice(dotAt + 1);
    return findHtmlNode(root, (el) => el.tag === tag && el.attributes?.class?.split(/\s+/).includes(cls));
  }

  return findHtmlNode(root, (el) => el.tag === s);
}

function getTableRows(tableElement) {
  const rows = [];
  for (const child of (tableElement.children || [])) {
    if (child.tag === "tr") {
      rows.push(child);
    } else if (child.tag === "thead" || child.tag === "tbody" || child.tag === "tfoot") {
      for (const grandchild of (child.children || [])) {
        if (grandchild.tag === "tr") rows.push(grandchild);
      }
    }
  }
  return rows;
}

function getRowCells(trElement) {
  return (trElement.children || [])
    .filter((c) => c.tag === "td" || c.tag === "th")
    .map((c) => c.text || "");
}

function extractTableRow(tableElement, index) {
  const row = getTableRows(tableElement)[index];
  return row ? getRowCells(row) : null;
}

function extractTableColumn(tableElement, colIndex) {
  return getTableRows(tableElement).map((row) => getRowCells(row)[colIndex] ?? "");
}

function extractTableColumnByHeader(tableElement, header) {
  const rows = getTableRows(tableElement);
  if (!rows.length) return null;
  const colIndex = getRowCells(rows[0]).findIndex((h) => h.toLowerCase() === header.toLowerCase());
  if (colIndex === -1) return null;
  return rows.slice(1).map((row) => getRowCells(row)[colIndex] ?? "");
}

function findHtmlNode(value, predicate) {
  if (!value || typeof value !== "object") return null;

  if (value.tag !== undefined) {
    if (predicate(value)) return value;
    for (const child of (value.children || [])) {
      const found = findHtmlNode(child, predicate);
      if (found) return found;
    }
    return null;
  }

  const items = Array.isArray(value) ? value : Object.values(value);
  for (const item of items) {
    const found = findHtmlNode(item, predicate);
    if (found) return found;
  }
  return null;
}

function collectOutputVariables(grid, response, formulaController) {
  const inputs = Array.from(grid.querySelectorAll("input"));
  const outputVariables = {};

  for (let index = 0; index < inputs.length; index += 2) {
    const variableName = inputs[index].value.trim();
    const expression = inputs[index + 1].value.trim();

    if (expression && variableName) {
      outputVariables[variableName] = evaluateOutputExpression(response, expression, formulaController, outputVariables);
    }
  }

  return outputVariables;
}

function evaluateOutputExpression(response, expression, formulaController, computedVariables = {}) {
  const formulaMatch = expression.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);

  if (formulaMatch && formulaController?.hasFormula(formulaMatch[1])) {
    const argExprs = parseFormulaArgs(formulaMatch[2]);
    const argValues = argExprs.map((arg) => resolveFormulaArg(arg, response, computedVariables));
    return formulaController.applyFormula(formulaMatch[1], argValues);
  }

  if (Object.prototype.hasOwnProperty.call(computedVariables, expression)) {
    return computedVariables[expression];
  }

  return getValueAtPath(response, expression);
}

function parseFormulaArgs(argsStr) {
  const args = [];
  let current = "";
  let inString = false;
  let depth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (inString) {
      if (ch === '"') inString = false;
      current += ch;
    } else if (ch === '"') {
      inString = true;
      current += ch;
    } else if (ch === "(" || ch === "[") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "]") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  const last = current.trim();
  if (last) args.push(last);
  return args;
}

function resolveFormulaArg(arg, response, computedVariables) {
  if (arg.startsWith('"') && arg.endsWith('"') && arg.length >= 2) {
    return arg.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(arg)) {
    return Number(arg);
  }
  if (Object.prototype.hasOwnProperty.call(computedVariables, arg)) {
    return computedVariables[arg];
  }
  const fromComputed = getValueAtPath(computedVariables, arg);
  if (fromComputed !== undefined) return fromComputed;
  const fromResponse = getValueAtPath(response, arg);
  if (fromResponse !== undefined) return fromResponse;
  return arg;
}

function getValueAtPath(value, path) {
  const parts = path.split(".");
  let current = value;

  for (let i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) {
      return undefined;
    }

    const part = parts[i];

    if (part === "*") {
      if (!Array.isArray(current)) return undefined;
      const remainingPath = parts.slice(i + 1).join(".");
      if (!remainingPath) return current;
      return current.map((item) => getValueAtPath(item, remainingPath));
    }

    if (/^-\d+$/.test(part) && Array.isArray(current)) {
      current = current[current.length + parseInt(part, 10)];
      continue;
    }

    current = current[part];
  }

  return current;
}


function normalizeVariableValue(value) {
  if (Array.isArray(value)) {
    return value.join(",");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}
