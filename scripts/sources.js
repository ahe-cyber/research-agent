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

function createSourceController(recordController) {
  const variables = {};
  const sourceElements = {};
  const sourceList = document.getElementById("sourceList");

  renderSources(BUILT_IN_SOURCES);
  loadDatasetSources();

  function renderSources(sources) {
    sources.forEach((source) => {
      const elements = createSourceCard(source);
      sourceElements[source.id] = elements;
      sourceList.appendChild(elements.card);
    });
  }

  async function loadDatasetSources() {
    try {
      const response = await fetch("resources/datasets.json");

      if (!response.ok) {
        throw new Error(`Dataset registry failed with status ${response.status}`);
      }

      renderSources(await response.json());
    } catch (error) {
      console.error(error);
    }
  }

  function createSourceCard(source) {
    const card = document.createElement("details");
    const summary = document.createElement("summary");
    const summaryText = document.createElement("div");
    const title = document.createElement("strong");
    const description = document.createElement("span");
    const body = document.createElement("div");
    const outputGrid = createGrid("Path", "Variable");

    card.className = "source-editor";
    card.open = source.type !== "mapbox-search";
    summary.className = "source-editor-summary";
    body.className = "source-editor-body";
    title.textContent = source.name;
    description.textContent = source.description;

    summaryText.append(title, description);
    summary.appendChild(summaryText);

    if (source.type !== "mapbox-search") {
      const runHeaderButton = document.createElement("button");
      runHeaderButton.className = "source-run-button";
      runHeaderButton.type = "button";
      runHeaderButton.setAttribute("aria-label", `Run ${source.name} query`);
      runHeaderButton.textContent = ">";
      runHeaderButton.addEventListener("click", (event) => {
        event.preventDefault();
        runDatasetSource(source);
      });
      summary.appendChild(runHeaderButton);
    }

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
      queryUrlInput.readOnly = true;

      const label = document.createElement("label");
      label.className = "field-label";
      label.textContent = "Query URL";
      body.append(label, queryUrlInput);

      const actions = document.createElement("div");
      const runButton = document.createElement("button");
      const overviewButton = document.createElement("button");
      actions.className = "source-actions";
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

      if (source.mapDisplay) {
        body.appendChild(createMapDisplayNote(source.mapDisplay));
      }

      paramsGrid = createGrid("Key", "Value");
      appendSection(body, "Input Params", "Use variable names like selectedCoordinates in values.", paramsGrid);
      (source.defaultParams || []).forEach((row) => {
        appendSourceRow(paramsGrid.rows, row.key, row.value);
      });
      body.appendChild(createAddButton("Add parameter", paramsGrid.rows));
    }

    appendSection(body, "Output Variables", "Map a response path to a variable name for later queries.", outputGrid);
    (source.defaultOutputs || []).forEach((row) => {
      appendSourceRow(outputGrid.rows, row.path, row.variable);
    });
    body.appendChild(createAddButton("Add output", outputGrid.rows));

    card.append(summary, body);

    return {
      card,
      queryUrlInput,
      paramsGrid: paramsGrid && paramsGrid.rows,
      outputsGrid: outputGrid.rows
    };
  }

  async function runDatasetSource(source) {
    const elements = sourceElements[source.id];
    const params = collectSourceRows(elements.paramsGrid, resolveVariableValue);
    const url = buildUrlWithParams(elements.queryUrlInput.value, params);

    try {
      const result = await queryUrl(url);
      const outputVariables = collectOutputVariables(elements.outputsGrid, result.response);

      Object.entries(outputVariables).forEach(([name, value]) => {
        setVariable(name, normalizeVariableValue(value));
      });

      recordController.add({
        kind: source.name,
        title: `${source.name} manual query`,
        request: result.request,
        response: result.response,
        durationMs: result.durationMs,
        timestamp: result.timestamp,
        payload: {
          ...result,
          source: {
            id: source.id,
            type: source.type,
            mapDisplay: source.mapDisplay
          },
          outputVariables
        }
      });
    } catch (error) {
      console.error(error);
    }
  }

  function setVariable(name, value) {
    variables[name] = value;
  }

  function assignMapboxSearchOutputs(searchResult) {
    const mapboxSource = sourceElements["mapbox-search"];
    const outputVariables = collectOutputVariables(mapboxSource.outputsGrid, searchResult);
    const normalizedOutputVariables = {};

    Object.entries(outputVariables).forEach(([name, value]) => {
      normalizedOutputVariables[name] = normalizeVariableValue(value);
      setVariable(name, normalizedOutputVariables[name]);
    });

    return normalizedOutputVariables;
  }

  function resolveVariableValue(value) {
    if (Object.prototype.hasOwnProperty.call(variables, value)) {
      return variables[value];
    }

    return value;
  }

  return { setVariable, assignMapboxSearchOutputs };
}

function appendSection(body, title, note, grid) {
  const heading = document.createElement("h3");
  heading.className = "subsection-title";
  heading.textContent = title;
  body.append(heading, createNote(note), grid.heading, grid.rows);
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

function createMapDisplayNote(mapDisplay) {
  const geometryTypes = mapDisplay.geometryTypes || [];
  const text = mapDisplay.supportsGeoJsonToggle && geometryTypes.length > 0
    ? `Map display supports ${geometryTypes.join(", ")} GeoJSON.`
    : "Map display is configured for this source.";

  return createNote(text);
}

function createAddButton(label, grid) {
  const button = document.createElement("button");
  button.className = "record-action";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    appendSourceRow(grid, "", "");
  });
  return button;
}

function appendSourceRow(grid, key = "", value = "") {
  const keyInput = document.createElement("input");
  const valueInput = document.createElement("input");

  keyInput.type = "text";
  valueInput.type = "text";
  keyInput.value = key;
  valueInput.value = value;

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

function collectOutputVariables(grid, response) {
  const inputs = Array.from(grid.querySelectorAll("input"));
  const outputVariables = {};

  for (let index = 0; index < inputs.length; index += 2) {
    const path = inputs[index].value.trim();
    const variableName = inputs[index + 1].value.trim();

    if (path && variableName) {
      outputVariables[variableName] = getValueAtPath(response, path);
    }
  }

  return outputVariables;
}

function getValueAtPath(value, path) {
  return path.split(".").reduce((currentValue, pathPart) => {
    if (currentValue === null || currentValue === undefined) {
      return undefined;
    }

    return currentValue[pathPart];
  }, value);
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
