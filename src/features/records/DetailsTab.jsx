import { hideGeoJsonRecord, normalizeGeoJson, showGeoJsonRecord } from "../map/geojson";

export function DetailsTab({ active }) {
  return (
    <section className={`workspace-tab${active ? " is-active" : ""}`} id="recordTab" data-tab-panel hidden={!active}>
      <h2 className="section-title">Record</h2>
      <div className="record-list" id="recordList" />
    </section>
  );
}

export function createRecordStore() {
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
      visibleGeoJsonSelections: [],
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

export function createRecordController(recordStore, map, editorTabController, getAgentController = () => null) {
  const recordList = document.getElementById("recordList");
  const wrapJsonTextButton = document.getElementById("wrapJsonTextButton");
  const expandedRecordIds = new Set();
  const expandedJsonPaths = new Set();
  let isJsonTextWrapped = false;

  function updateWrapJsonText() {
    recordList.classList.toggle("is-json-text-wrapped", isJsonTextWrapped);
    wrapJsonTextButton.setAttribute("aria-pressed", String(isJsonTextWrapped));
    wrapJsonTextButton.classList.toggle("is-active", isJsonTextWrapped);
  }

  wrapJsonTextButton.addEventListener("click", () => {
    isJsonTextWrapped = !isJsonTextWrapped;
    updateWrapJsonText();
  });

  function render() {
    recordList.replaceChildren();

    if (recordStore.all().length === 0) {
      const empty = document.createElement("div");
      empty.className = "agent-message agent-message-system";
      empty.textContent = "Query record will appear here.";
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

    const attachButton = createAttachButton(`Attach ${record.title || record.kind} to chat`, () => {
      getAgentController()?.attachRecord(record);
    });

    const summaryText = document.createElement("div");
    summaryText.className = "record-summary-text";
    summaryText.append(createText("strong", record.title));
    summaryText.append(createText("span", `${record.kind} - ${record.timestamp || "No timestamp"}${record.durationMs ? ` - ${record.durationMs} ms` : ""}`));
    summary.append(attachButton, summaryText, createRecordActionFooter(record, toggleRecordGeoJson, editorTabController));

    const body = document.createElement("div");
    body.className = "record-body";
    body.appendChild(renderJsonTree(record.payload, record, toggleRecordGeoJson, editorTabController, expandedJsonPaths));
    wrapper.append(summary, body);

    return wrapper;
  }

  function toggleRecordGeoJson(record) {
    if (!map) {
      console.warn("[Map App] Map is unavailable; cannot toggle GeoJSON record.");
      return;
    }

    const actions = getGeoJsonActions(record);
    const state = getGeoJsonButtonState(record, record.geojsonPath, getGeoJsonSignature(record.geojson), actions);

    if (state === "visible") {
      removeGeoJsonSelection(record, record.geojsonPath, getGeoJsonSignature(record.geojson));
    } else {
      addGeoJsonSelection(record, record.geojsonPath, record.geojson);
    }

    const visibleGeoJson = mergeGeoJsonSelections(record.visibleGeoJsonSelections || []);
    record.isVisibleOnMap = Boolean(visibleGeoJson);

    if (visibleGeoJson) {
      showGeoJsonRecord(map, record.id, visibleGeoJson);
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
  updateWrapJsonText();

  return { add, render };
}

function createAttachButton(label, onClick) {
  const button = document.createElement("button");
  button.className = "card-attach-button";
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function updateGeoJsonButtons(record) {
  const actions = getGeoJsonActions(record);

  actions.forEach(({ button, path, signature }) => {
    const state = getGeoJsonButtonState(record, button.dataset.geoJsonPath, button.dataset.geoJsonSignature, actions);

    button.classList.toggle("is-visible", state === "visible");
    button.classList.toggle("is-partially-visible", state === "partial");
    button.setAttribute("aria-label", state === "visible" ? "Hide geometry from map" : "Show geometry on map");
  });
}

function getGeoJsonActions(record) {
  return Array.from(document.querySelectorAll(`[data-record-id="${record.id}"].json-geo-action`)).map((button) => ({
    button,
    path: button.dataset.geoJsonPath,
    signature: button.dataset.geoJsonSignature,
    geojson: record.geoJsonActions && record.geoJsonActions[button.dataset.geoJsonPath]
  }));
}

function getGeoJsonButtonState(record, path, signature, actions) {
  const selections = record.visibleGeoJsonSelections || [];

  if (selections.length === 0) {
    return "";
  }

  if (selections.some((selection) => selection.signature === signature || path.startsWith(`${selection.path}.`))) {
    return "visible";
  }

  const descendants = actions.filter((action) => action.path.startsWith(`${path}.`));

  if (descendants.length > 0 && descendants.every((action) => getGeoJsonButtonState(record, action.path, action.signature, actions) === "visible")) {
    return "visible";
  }

  return selections.some((selection) => selection.path.startsWith(`${path}.`)) ? "partial" : "";
}

function addGeoJsonSelection(record, path, geojson) {
  const signature = getGeoJsonSignature(geojson);
  const selections = record.visibleGeoJsonSelections || [];

  record.visibleGeoJsonSelections = selections
    .filter((selection) => selection.path !== path)
    .filter((selection) => !selection.path.startsWith(`${path}.`))
    .filter((selection) => selection.signature !== signature);

  record.visibleGeoJsonSelections.push({ path, signature, geojson });
}

function removeGeoJsonSelection(record, path, signature) {
  const selections = record.visibleGeoJsonSelections || [];
  const hasExactSelection = selections.some((selection) => selection.path === path || selection.signature === signature);
  const splitSelections = [];

  record.visibleGeoJsonSelections = selections.filter((selection) => {
    if (hasExactSelection) {
      return selection.path !== path && selection.signature !== signature;
    }

    if (path.startsWith(`${selection.path}.`)) {
      splitSelections.push(selection);
      return false;
    }

    return !selection.path.startsWith(`${path}.`);
  });

  splitSelections.forEach((selection) => {
    getLeafGeoJsonActions(record, selection.path)
      .filter((action) => action.path !== path)
      .filter((action) => !action.path.startsWith(`${path}.`))
      .filter((action) => action.signature !== signature)
      .forEach((action) => {
        addGeoJsonSelection(record, action.path, action.geojson);
      });
  });
}

function getLeafGeoJsonActions(record, rootPath) {
  const actions = getGeoJsonActions(record).filter((action) => action.geojson && action.path.startsWith(`${rootPath}.`));

  return actions.filter((action) => {
    return !actions.some((candidate) => candidate.path.startsWith(`${action.path}.`));
  });
}

function mergeGeoJsonSelections(selections) {
  const features = [];

  selections.forEach((selection) => {
    features.push(...toGeoJsonFeatures(selection.geojson));
  });

  if (features.length === 0) {
    return null;
  }

  return {
    type: "FeatureCollection",
    features
  };
}

function toGeoJsonFeatures(geojson) {
  if (!geojson) {
    return [];
  }

  if (geojson.type === "FeatureCollection") {
    return geojson.features || [];
  }

  if (geojson.type === "Feature") {
    return [geojson];
  }

  return [
    {
      type: "Feature",
      properties: {},
      geometry: geojson
    }
  ];
}

function createRecordActionFooter(record, onToggleGeoJson, editorTabController) {
  const footer = document.createElement("div");
  const geoJsonAction = findFirstGeoJsonAction(record.payload, `${record.id}.record`);

  footer.className = "record-action-footer";

  if (geoJsonAction) {
    const geoButton = createGeoJsonActionButton(record, geoJsonAction.geojson, geoJsonAction.path, onToggleGeoJson);
    footer.appendChild(geoButton);
  }

  if (editorTabController) {
    findTableOutputs(record).forEach(([variableName, element]) => {
      const tabId = `table-${record.id}-${variableName}`;
      const tableButton = createTableActionButton(variableName, tabId, (event) => {
        event.preventDefault();
        event.stopPropagation();
        editorTabController.openTableTab(record, variableName, element);
      });
      footer.appendChild(tableButton);
    });

    (record.payload?.pdfUrls || []).forEach(({ url, label }) => {
      const tabId = `pdf::${url}`;
      footer.appendChild(createFileActionButton(label, tabId, (event) => {
        event.preventDefault();
        event.stopPropagation();
        editorTabController.openPdfTab(url, label);
      }));
    });
  }

  footer.hidden = footer.childElementCount === 0;
  return footer;
}

function findTableOutputs(record) {
  const outputVariables = record.payload?.outputVariables || {};
  return Object.entries(outputVariables).filter(([, value]) => value && typeof value === "object" && value.tag === "table");
}

function createTableActionButton(label, tabId, onClick) {
  const button = document.createElement("button");
  button.className = "json-table-action";
  button.type = "button";
  button.dataset.tabId = tabId;
  button.setAttribute("aria-label", `Open ${label}`);
  button.title = label;
  button.addEventListener("click", onClick);
  return button;
}

function findFirstGeoJsonAction(value, path) {
  const geojson = normalizeGeoJson(value);

  if (geojson) {
    return { geojson, path };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    const match = findFirstGeoJsonAction(childValue, `${path}.${childKey}`);

    if (match) {
      return match;
    }
  }

  return null;
}

function renderJsonTree(value, record, onToggleGeoJson, editorTabController, expandedJsonPaths, label = "record") {
  const container = document.createElement("div");
  container.className = "json-tree";
  container.appendChild(renderJsonNode(label, value, record, onToggleGeoJson, editorTabController, expandedJsonPaths, `${record.id}.${label}`));
  return container;
}

function renderJsonNode(key, value, record, onToggleGeoJson, editorTabController, expandedJsonPaths, path) {
  if (value && typeof value === "object") {
    if (value.tag !== undefined) {
      return renderHtmlElementNode(key, value, record, onToggleGeoJson, editorTabController, expandedJsonPaths, path);
    }

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
    appendGeoJsonAction(summary, value, record, onToggleGeoJson, path);
    appendTableAction(summary, value, record, editorTabController);
    appendDocumentAction(summary, value, editorTabController);
    details.appendChild(summary);

    Object.entries(value).forEach(([childKey, childValue]) => {
      details.appendChild(renderJsonNode(childKey, childValue, record, onToggleGeoJson, editorTabController, expandedJsonPaths, `${path}.${childKey}`));
    });

    return details;
  }

  const row = document.createElement("div");
  row.className = "json-leaf";
  row.appendChild(renderJsonLabel(key, String(value), toDisplayPath(path), value));
  return row;
}

function renderHtmlElementNode(key, element, record, onToggleGeoJson, editorTabController, expandedJsonPaths, path) {
  const children = element.children || [];

  if (children.length === 0) {
    const row = document.createElement("div");
    row.className = "json-leaf";
    row.appendChild(renderHtmlElementLabel(key, element, path));
    appendGeoJsonAction(row, element, record, onToggleGeoJson, path);
    appendTableAction(row, element, record, editorTabController);
    return row;
  }

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
  summary.appendChild(renderHtmlElementLabel(key, element, path));
  appendGeoJsonAction(summary, element, record, onToggleGeoJson, path);
  appendTableAction(summary, element, record, editorTabController);
  details.appendChild(summary);

  children.forEach((child, index) => {
    details.appendChild(renderJsonNode(String(index), child, record, onToggleGeoJson, editorTabController, expandedJsonPaths, `${path}.${index}`));
  });

  return details;
}

function renderHtmlElementLabel(key, element, path) {
  const label = document.createElement("span");
  label.className = "json-label";

  const keyElement = document.createElement("span");
  keyElement.className = "json-copy-target json-key";
  keyElement.title = "Right-click to copy path";
  keyElement.textContent = key;
  keyElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyJsonNodeText(keyElement, toDisplayPath(path), path, element, "path");
  });

  const id = element.attributes?.id;
  const tagDisplay = id ? `<${element.tag} id="${id}">` : `<${element.tag}>`;

  const tagElement = document.createElement("span");
  tagElement.className = "json-copy-target html-tag-value";
  tagElement.title = "Right-click to copy element";
  tagElement.textContent = tagDisplay;
  tagElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyJsonNodeText(tagElement, serializeHtmlElement(element), path, element, "elem");
  });

  label.append(keyElement, document.createTextNode(": "), tagElement);

  if (element.text) {
    const textElement = document.createElement("span");
    textElement.className = "json-copy-target html-text-value";
    textElement.title = "Right-click to copy text";
    textElement.textContent = element.text;
    textElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyJsonNodeText(textElement, element.text, path, element, "text");
    });
    label.append(document.createTextNode(": "), textElement);
  }

  return label;
}

function serializeHtmlElement(element) {
  if (!element || !element.tag) return "";
  const attrs = Object.entries(element.attributes || {})
    .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
    .join("");
  const inner = (element.text ? escapeHtml(element.text) : "") +
    (element.children || []).map(serializeHtmlElement).join("");
  return `<${element.tag}${attrs}>${inner}</${element.tag}>`;
}

function renderJsonLabel(key, value, path, rawValue) {
  const label = document.createElement("span");
  const keyElement = document.createElement("span");
  const separator = document.createTextNode(": ");
  const valueElement = document.createElement("span");

  label.className = "json-label";
  keyElement.className = "json-copy-target json-key";
  keyElement.title = "Right-click to copy path";
  keyElement.textContent = key;
  keyElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyJsonNodeText(keyElement, path, path, rawValue, "path");
  });

  valueElement.className = "json-copy-target json-value";
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

function appendTableAction(parent, value, record, editorTabController) {
  if (!editorTabController) return;

  const tableElement = normalizeTableElement(value);
  if (!tableElement) return;

  const variableName = findTableVariableName(record, tableElement);
  if (!variableName) return;

  const tabId = `table-${record.id}-${variableName}`;
  parent.appendChild(createTableActionButton(variableName, tabId, (event) => {
    event.preventDefault();
    event.stopPropagation();
    editorTabController.openTableTab(record, variableName, tableElement);
  }));
}

function appendDocumentAction(parent, value, editorTabController) {
  if (!editorTabController) return;

  const docElement = normalizeDocumentElement(value);
  if (!docElement) return;

  const tabId = `pdf::${docElement.url}`;
  parent.appendChild(createFileActionButton(docElement.label, tabId, (event) => {
    event.preventDefault();
    event.stopPropagation();
    editorTabController.openPdfTab(docElement.url, docElement.label);
  }));
}

function normalizeDocumentElement(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.url === "string") return { url: value.url, label: value.label ?? value.url };
  return null;
}

function normalizeTableElement(value) {
  if (!value || typeof value !== "object") return null;
  if (value.tag === "table") return value;

  const items = Array.isArray(value) ? value :
    (value.tag !== undefined ? (value.children || []) : Object.values(value));

  for (const item of items) {
    const found = normalizeTableElement(item);
    if (found) return found;
  }

  return null;
}

function findTableVariableName(record, tableElement) {
  const outputVariables = record.payload?.outputVariables || {};
  return Object.entries(outputVariables).find(([, val]) => val === tableElement)?.[0];
}

function appendGeoJsonAction(parent, value, record, onToggleGeoJson, path) {
  const geojson = normalizeGeoJson(value);

  if (!geojson) {
    return;
  }

  parent.appendChild(createGeoJsonActionButton(record, geojson, path, onToggleGeoJson));
}

function createGeoJsonActionButton(record, geojson, path, onToggleGeoJson) {
  const button = document.createElement("button");
  const signature = getGeoJsonSignature(geojson);
  const isVisible = (record.visibleGeoJsonSelections || []).some((selection) => selection.signature === signature || path.startsWith(`${selection.path}.`));
  record.geoJsonActions = {
    ...(record.geoJsonActions || {}),
    [path]: geojson
  };
  button.className = `json-geo-action ${isVisible ? "is-visible" : ""}`;
  button.type = "button";
  button.dataset.recordId = record.id;
  button.dataset.geoJsonPath = path;
  button.dataset.geoJsonSignature = signature;
  button.setAttribute("aria-label", isVisible ? "Hide geometry from map" : "Show geometry on map");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    record.geojson = geojson;
    record.geojsonPath = path;
    onToggleGeoJson(record);
  });

  return button;
}

function getGeoJsonSignature(geojson) {
  if (!geojson) {
    return "";
  }

  if (geojson.type === "FeatureCollection") {
    return JSON.stringify(geojson.features.map((feature) => feature.geometry));
  }

  if (geojson.type === "Feature") {
    return JSON.stringify(geojson.geometry);
  }

  return JSON.stringify(geojson);
}

function createFileActionButton(label, tabId, onClick) {
  const button = document.createElement("button");
  button.className = "json-file-action";
  button.type = "button";
  if (tabId) button.dataset.tabId = tabId;
  button.setAttribute("aria-label", `Open ${label}`);
  button.title = label;
  button.addEventListener("click", onClick);
  return button;
}

function toDisplayPath(path) {
  return path.split(".").slice(2).join(".");
}

async function copyJsonNodeText(element, text, path, value, copyKind) {
  console.info(`[Map App] Copying JSON ${copyKind}`, { path, value, text });

  try {
    await copyTextToClipboard(text);
    console.info(`[Map App] Copied JSON ${copyKind}`, { path, text });
    const label = { path: "Copied Path", content: "Copied Obj", elem: "Copied Elem", text: "Copied Text" }[copyKind] ?? "Copied";
    showCopyStatus(element.parentElement, label, true);
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
