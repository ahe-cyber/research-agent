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

export function createSourceController(recordController, formulaController, editorTabController) {
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
      queryUrl: "",
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
        queryUrl: elements?.queryUrlInput ? elements.queryUrlInput.value.trim() : source.queryUrl,
        defaultParams: elements?.paramsGrid ? collectSourceRowPairs(elements.paramsGrid, "key", "value") : source.defaultParams,
        defaultOutputs: elements?.outputsGrid ? collectSourceRowPairs(elements.outputsGrid, "variable", "path") : source.defaultOutputs
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
        queryUrl: elements?.queryUrlInput ? elements.queryUrlInput.value.trim() : source.queryUrl,
        defaultParams: elements?.paramsGrid ? collectSourceRowPairs(elements.paramsGrid, "key", "value") : source.defaultParams,
        defaultOutputs: elements?.outputsGrid ? collectSourceRowPairs(elements.outputsGrid, "variable", "path") : source.defaultOutputs
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
    };
    let runHeaderButton = null;
    let runButton = null;

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
      summaryMain.appendChild(deleteButton);
    }
    summaryMain.append(summaryText, summaryEdit);

    if (source.type !== "mapbox-search") {
      runHeaderButton = document.createElement("button");
      runHeaderButton.className = "source-run-button";
      runHeaderButton.type = "button";
      runHeaderButton.setAttribute("aria-label", `Run ${source.name} query`);
      runHeaderButton.title = `Run ${source.name} query`;
      runHeaderButton.addEventListener("click", (event) => {
        event.preventDefault();
        runDatasetSource(source);
      });
      summaryMain.appendChild(runHeaderButton);
    }

    summaryMain.appendChild(closeButton);
    summaryContent.append(summaryMain, variableFooter);
    summary.appendChild(summaryContent);

    if (source.note) {
      body.appendChild(createNote(source.note));
    }

    let queryUrlInput = null;
    let paramsGrid = null;

    if (source.type !== "mapbox-search") {
      queryUrlInput = document.createElement("input");
      queryUrlInput.className = "source-url-input";
      queryUrlInput.type = "text";
      queryUrlInput.value = source.queryUrl || "";
      queryUrlInput.addEventListener("input", onSourceChange);

      const label = document.createElement("label");
      label.className = "field-label";
      label.textContent = "Query URL";
      body.append(label, queryUrlInput);

      const actions = document.createElement("div");
      const overviewButton = document.createElement("button");
      actions.className = "source-actions";
      runButton = document.createElement("button");
      runButton.className = "record-action";
      runButton.type = "button";
      runButton.textContent = "Run query";
      runButton.addEventListener("click", () => runDatasetSource(source));
      overviewButton.className = "record-action";
      overviewButton.type = "button";
      overviewButton.textContent = "Overview";
      overviewButton.addEventListener("click", () => {
        window.open(source.overviewUrl, "_blank", "noopener");
      });
      actions.append(runButton, overviewButton);
      body.appendChild(actions);

      paramsGrid = createGrid("Key", "Value");
      appendSection(body, "Input Params", paramsGrid);
      (source.defaultParams || []).forEach((row) => {
        appendSourceRow(paramsGrid.rows, row.key, row.value, onSourceChange);
      });
      body.appendChild(createAddButton("Add parameter", paramsGrid.rows, onSourceChange));
    }

    appendSection(body, "Output Variables", outputGrid);
    (source.defaultOutputs || []).forEach((row) => {
      appendSourceRow(outputGrid.rows, row.variable, row.path, onSourceChange);
    });
    body.appendChild(createAddButton("Add output", outputGrid.rows, onSourceChange));

    card.append(summary, body);

    return {
      card,
      titleInput,
      descriptionInput,
      queryUrlInput,
      runHeaderButton,
      runButton,
      paramsGrid: paramsGrid && paramsGrid.rows,
      outputsGrid: outputGrid.rows
    };
  }

  async function runDatasetSource(source) {
    const elements = sourceElements[source.id];

    if (source.queryType === "pdf") {
      const rawParams = collectSourceRows(elements.paramsGrid, resolveRawVariableValue);
      const pdfUrls = buildPdfUrls(elements.queryUrlInput.value, rawParams);
      updateSourceRunState(elements, "success");
      recordController.add({
        kind: source.name,
        title: `${source.name} manual query`,
        timestamp: new Date().toISOString(),
        payload: {
          source: { id: source.id, type: source.type },
          pdfUrls
        }
      });
      return;
    }

    const params = collectSourceRows(elements.paramsGrid, resolveVariableValue);
    const url = buildUrlWithParams(elements.queryUrlInput.value, params);

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

      recordController.add({
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
    if (Object.prototype.hasOwnProperty.call(variables, value)) {
      return normalizeVariableValue(variables[value]);
    }

    const resolvedPathValue = getValueAtPath(variables, value);

    if (resolvedPathValue !== undefined) {
      return normalizeVariableValue(resolvedPathValue);
    }

    return value;
  }

  function resolveRawVariableValue(value) {
    if (Object.prototype.hasOwnProperty.call(variables, value)) {
      return variables[value];
    }

    const resolvedPathValue = getValueAtPath(variables, value);

    if (resolvedPathValue !== undefined) {
      return resolvedPathValue;
    }

    return value;
  }

  return { setVariable, assignMapboxSearchOutputs };
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
  heading.append(first, second);

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
  const inputNames = paramsGrid ? collectSourceRowPairs(paramsGrid, "key", "value").map((row) => row.value).filter(Boolean) : getInputVariableNames(source);
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
  return (source.defaultParams || [])
    .map((row) => row.value)
    .filter(Boolean);
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

function appendSourceRow(grid, key = "", value = "", onChange = () => {}) {
  const keyInput = document.createElement("input");
  const valueInput = document.createElement("input");

  keyInput.type = "text";
  valueInput.type = "text";
  keyInput.value = key;
  valueInput.value = value;
  keyInput.addEventListener("input", onChange);
  valueInput.addEventListener("input", onChange);

  grid.append(keyInput, valueInput);
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
    const argExpr = formulaMatch[2].trim();
    const argValue = Object.prototype.hasOwnProperty.call(computedVariables, argExpr)
      ? computedVariables[argExpr]
      : queryHtmlObject(response, argExpr);
    return formulaController.applyFormula(formulaMatch[1], argValue);
  }

  if (Object.prototype.hasOwnProperty.call(computedVariables, expression)) {
    return computedVariables[expression];
  }

  return queryHtmlObject(response, expression);
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
    const argExpr = formulaMatch[2].trim();
    const argValue = Object.prototype.hasOwnProperty.call(computedVariables, argExpr)
      ? computedVariables[argExpr]
      : getValueAtPath(response, argExpr);
    return formulaController.applyFormula(formulaMatch[1], argValue);
  }

  if (Object.prototype.hasOwnProperty.call(computedVariables, expression)) {
    return computedVariables[expression];
  }

  return getValueAtPath(response, expression);
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

function buildPdfUrls(baseUrl, rawParams) {
  const arrayEntry = Object.entries(rawParams).find(([, v]) => Array.isArray(v));

  if (!arrayEntry) {
    const scalarParams = Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, String(v ?? "")]));
    const firstValue = String(Object.values(scalarParams)[0] ?? "PDF");
    return [{ url: buildUrlWithParams(baseUrl, scalarParams), label: firstValue }];
  }

  const [arrayKey, arrayValues] = arrayEntry;
  const scalarParams = Object.fromEntries(
    Object.entries(rawParams).filter(([k]) => k !== arrayKey).map(([k, v]) => [k, String(v ?? "")])
  );

  return arrayValues.map((val) => ({
    url: buildUrlWithParams(baseUrl, { ...scalarParams, [arrayKey]: String(val ?? "") }),
    label: String(val ?? "")
  }));
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
