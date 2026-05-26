function createRecordStore() {
  let nextId = 1;
  const records = [];

  function add(record) {
    if (record.kind === "Search") {
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (records[index].kind === "Search") {
          records.splice(index, 1);
        }
      }
    }

    const storedRecord = {
      id: String(nextId),
      isVisibleOnMap: false,
      ...record
    };

    nextId += 1;
    records.unshift(storedRecord);
    return storedRecord;
  }

  function all() {
    return [...records];
  }

  function find(recordId) {
    return records.find((record) => record.id === recordId);
  }

  return { add, all, find };
}

function createRecordController(recordStore, assetController, map) {
  const recordList = document.getElementById("recordList");
  const expandedRecordIds = new Set();
  const expandedJsonPaths = new Set();

  function render() {
    recordList.replaceChildren();

    if (recordStore.all().length === 0) {
      const empty = document.createElement("div");
      empty.className = "agent-message agent-message-system";
      empty.textContent = "Query records will appear here.";
      recordList.appendChild(empty);
      return;
    }

    recordStore.all().forEach((record) => {
      recordList.appendChild(renderRecord(record));
    });
  }

  function renderRecord(record) {
    const wrapper = document.createElement("details");
    wrapper.className = "record-card";
    wrapper.open = expandedRecordIds.has(record.id);
    wrapper.addEventListener("toggle", () => {
      if (wrapper.open) {
        expandedRecordIds.add(record.id);
      } else {
        expandedRecordIds.delete(record.id);
      }
    });

    const summary = document.createElement("summary");
    summary.className = "record-summary";

    const summaryText = document.createElement("div");
    summaryText.className = "record-summary-text";
    summaryText.append(createText("strong", record.title));
    summaryText.append(createText("span", `${record.kind} - ${record.timestamp || "No timestamp"}${record.durationMs ? ` - ${record.durationMs} ms` : ""}`));
    summary.appendChild(summaryText);

    const body = document.createElement("div");
    body.className = "record-body";

    const actions = document.createElement("div");
    actions.className = "record-actions";

    const assetButton = document.createElement("button");
    assetButton.className = "record-action";
    assetButton.type = "button";
    assetButton.textContent = "Find assets";
    assetButton.addEventListener("click", () => {
      assetController.addFromRecord(record);
    });
    actions.appendChild(assetButton);

    body.appendChild(actions);
    body.appendChild(renderJsonTree(record.payload, record, assetController, toggleRecordGeoJson, expandedJsonPaths));
    wrapper.append(summary, body);

    return wrapper;
  }

  function toggleRecordGeoJson(record) {
    record.isVisibleOnMap = !record.isVisibleOnMap;

    if (record.isVisibleOnMap) {
      showGeoJsonRecord(map, record.id, record.geojson);
    } else {
      hideGeoJsonRecord(map, record.id);
    }

    updateGeoJsonButtons(record);
  }

  function add(record) {
    const storedRecord = recordStore.add({
      ...record,
      geojson: normalizeGeoJson(record.response)
    });

    render();
    return storedRecord;
  }

  render();

  return { add, render };
}

function updateGeoJsonButtons(record) {
  document.querySelectorAll(`[data-record-id="${record.id}"].json-geo-action`).forEach((button) => {
    button.classList.toggle("is-visible", record.isVisibleOnMap);
    button.setAttribute("aria-label", record.isVisibleOnMap ? "Hide polygon from map" : "Show polygon on map");
  });
}

function renderJsonTree(value, record, assetController, onToggleGeoJson, expandedJsonPaths, label = "record") {
  const container = document.createElement("div");
  container.className = "json-tree";
  container.appendChild(renderJsonNode(label, value, record, assetController, onToggleGeoJson, expandedJsonPaths, `${record.id}.${label}`));
  return container;
}

function renderJsonNode(key, value, record, assetController, onToggleGeoJson, expandedJsonPaths, path) {
  if (value && typeof value === "object") {
    const details = document.createElement("details");
    details.className = "json-node";
    details.open = key === "record" || expandedJsonPaths.has(path);
    details.addEventListener("toggle", () => {
      if (details.open) {
        expandedJsonPaths.add(path);
      } else {
        expandedJsonPaths.delete(path);
      }
    });

    const summary = document.createElement("summary");
    summary.appendChild(renderJsonLabel(key, Array.isArray(value) ? "Array" : "Object", toDisplayPath(path), value));
    appendGeoJsonAction(summary, value, record, onToggleGeoJson);
    appendAssetAction(summary, value, record, assetController);
    details.appendChild(summary);

    Object.entries(value).forEach(([childKey, childValue]) => {
      details.appendChild(renderJsonNode(childKey, childValue, record, assetController, onToggleGeoJson, expandedJsonPaths, `${path}.${childKey}`));
    });

    return details;
  }

  const row = document.createElement("div");
  row.className = "json-leaf";
  row.appendChild(renderJsonLabel(key, String(value), toDisplayPath(path), value));
  appendAssetAction(row, value, record, assetController);
  return row;
}

function renderJsonLabel(key, value, path, rawValue) {
  const label = document.createElement("span");
  const keyElement = document.createElement("button");
  const separator = document.createTextNode(": ");
  const valueElement = document.createElement("button");

  label.className = "json-label";
  keyElement.className = "json-copy-target json-key";
  keyElement.type = "button";
  keyElement.title = "Right-click to copy path";
  keyElement.textContent = key;
  keyElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyJsonNodeText(keyElement, path, path, rawValue, "path");
  });

  valueElement.className = "json-copy-target json-value";
  valueElement.type = "button";
  valueElement.title = "Right-click to copy JSON";
  valueElement.textContent = value;
  valueElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyJsonNodeText(valueElement, stringifyJsonValue(rawValue), path, rawValue, "content");
  });

  label.append(keyElement, separator, valueElement);
  return label;
}

function appendAssetAction(parent, value, record, assetController) {
  if (!hasAssetUrls(value)) {
    return;
  }

  const button = document.createElement("button");
  button.className = "json-file-action";
  button.type = "button";
  button.setAttribute("aria-label", "Add file asset");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    assetController.addFromValue(value, record.id);
  });

  parent.appendChild(button);
}

function appendGeoJsonAction(parent, value, record, onToggleGeoJson) {
  const geojson = normalizeGeoJson(value);

  if (!geojson) {
    return;
  }

  const button = document.createElement("button");
  button.className = `json-geo-action ${record.isVisibleOnMap ? "is-visible" : ""}`;
  button.type = "button";
  button.dataset.recordId = record.id;
  button.setAttribute("aria-label", record.isVisibleOnMap ? "Hide polygon from map" : "Show polygon on map");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    record.geojson = geojson;
    onToggleGeoJson(record);
  });

  parent.appendChild(button);
}

function toDisplayPath(path) {
  return path.split(".").slice(2).join(".");
}

async function copyJsonNodeText(element, text, path, value, copyKind) {
  console.info(`[Map App] Copying JSON ${copyKind}`, { path, value, text });

  try {
    await copyTextToClipboard(text);
    console.info(`[Map App] Copied JSON ${copyKind}`, { path, text });
    showCopyStatus(element.parentElement, copyKind === "path" ? `Copied ${path || "root"}` : "Copied JSON", true);
  } catch (error) {
    console.error(`[Map App] Failed to copy JSON ${copyKind}`, { path, value, text, error });
    console.info("[Map App] Copy failed object", value);
    showCopyStatus(element.parentElement, "Copy failed", false);
  }
}

function stringifyJsonValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return JSON.stringify(value, null, 2);
}

function copyTextToClipboard(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("document.execCommand copy returned false");
  }

  return Promise.resolve();
}

function showCopyStatus(element, text, isSuccess) {
  element.querySelector(".json-copy-status")?.remove();

  const status = document.createElement("span");
  status.className = `json-copy-status ${isSuccess ? "is-success" : "is-error"}`;
  status.textContent = text;
  element.appendChild(status);

  window.setTimeout(() => {
    status.remove();
  }, 1600);
}

function createText(tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
