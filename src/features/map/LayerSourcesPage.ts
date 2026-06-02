interface EditorTabController {
  openLayerSourcesTab(panel: HTMLElement): void;
}

interface LayerSource {
  [key: string]: unknown;
  label: string;
  metadata?: Record<string, unknown>;
}

interface BasemapCatalog {
  basemaps?: LayerSource[];
  terrain?: LayerSource;
  sceneLayers?: LayerSource[];
}

export function createLayerSourcesController(editorTabController: EditorTabController) {
  const button = document.getElementById("layerSourcesButton");
  let panel: HTMLElement | null = null;

  button?.addEventListener("click", async () => {
    panel ??= await buildLayerSourcesPanel();
    editorTabController.openLayerSourcesTab(panel);
  });
}

async function buildLayerSourcesPanel() {
  const response = await fetch("/data/basemaps.json");
  if (!response.ok) throw new Error(`Failed to load layer sources: ${response.status}`);
  const catalog = await response.json() as BasemapCatalog;
  const panel = document.createElement("div");
  panel.className = "editor-layer-sources-panel";
  panel.hidden = true;

  const header = document.createElement("header");
  const headerText = document.createElement("div");
  const title = document.createElement("h1");
  const intro = document.createElement("p");
  const toolbar = document.createElement("div");
  const copyButton = document.createElement("button");
  const content = document.createElement("div");
  const groups = [
    { label: "Basemaps", sources: catalog.basemaps ?? [] },
    { label: "Terrain", sources: catalog.terrain ? [catalog.terrain] : [] },
    { label: "3D Layers", sources: catalog.sceneLayers ?? [] }
  ];
  title.textContent = "Layer Sources";
  intro.textContent = "Configured map backgrounds and optional scene details.";
  headerText.append(title, intro);
  toolbar.className = "layer-sources-view-toolbar";
  copyButton.className = "layer-sources-copy-button";
  copyButton.type = "button";
  copyButton.textContent = "Copy as TSV";
  copyButton.hidden = true;
  content.className = "layer-sources-content";
  header.append(headerText, toolbar);
  panel.append(header, content);

  const render = (view: "list" | "table") => {
    content.replaceChildren();
    toolbar.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    copyButton.hidden = view !== "table";
    if (view === "table") {
      content.appendChild(renderTable(groups));
      return;
    }
    groups.forEach(({ label, sources }) => appendGroup(content, label, sources));
  };

  toolbar.append(
    createViewButton("list", "List view", () => render("list")),
    createViewButton("table", "Table view", () => render("table")),
    copyButton
  );
  copyButton.addEventListener("click", async () => {
    const table = content.querySelector("table");
    if (!table) return;
    await navigator.clipboard.writeText(tableToTsv(table));
    copyButton.textContent = "Copied";
    window.setTimeout(() => { copyButton.textContent = "Copy as TSV"; }, 1200);
  });
  render("list");
  return panel;
}

function tableToTsv(table: HTMLTableElement) {
  return Array.from(table.rows)
    .map((row) => Array.from(row.cells).map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() ?? "").join("\t"))
    .join("\n");
}

function createViewButton(view: "list" | "table", label: string, onClick: () => void) {
  const button = document.createElement("button");
  button.className = `layer-sources-view-button layer-sources-${view}-button`;
  button.type = "button";
  button.dataset.view = view;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function appendGroup(container: HTMLElement, label: string, sources: LayerSource[]) {
  if (sources.length === 0) return;
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = label;
  section.appendChild(heading);
  sources.forEach((source) => section.appendChild(renderSource(source)));
  container.appendChild(section);
}

function renderSource(source: LayerSource) {
  const card = document.createElement("article");
  const heading = document.createElement("h3");
  const details = document.createElement("dl");
  heading.textContent = source.label;
  card.className = "layer-source-card";
  card.append(heading, details);

  Object.entries(getDetails(source)).forEach(([key, value]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = formatLabel(key);
    appendValue(description, value);
    details.append(term, description);
  });
  return card;
}

function renderTable(groups: { label: string; sources: LayerSource[] }[]) {
  const rows = groups.flatMap(({ label, sources }) => sources.map((source) => ({
    group: label,
    source,
    details: getDetails(source)
  })));
  const fields = Array.from(new Set(rows.flatMap(({ details }) => Object.keys(details))));
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  const headingRow = document.createElement("tr");

  ["Group", "Layer", ...fields.map(formatLabel)].forEach((label) => {
    const heading = document.createElement("th");
    heading.textContent = label;
    headingRow.appendChild(heading);
  });
  head.appendChild(headingRow);

  rows.forEach(({ group, source, details }) => {
    const row = document.createElement("tr");
    [group, source.label, ...fields.map((field) => details[field])].forEach((value) => {
      const cell = document.createElement("td");
      appendValue(cell, value);
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.className = "layer-sources-table";
  table.append(head, body);
  return table;
}

function getDetails(source: LayerSource) {
  return { ...getConfiguration(source), ...source.metadata };
}

function getConfiguration(source: LayerSource) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => ![
    "id",
    "label",
    "metadata",
    "style"
  ].includes(key)));
}

function appendValue(container: HTMLElement, value: unknown) {
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    const link = document.createElement("a");
    link.href = value;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = value;
    container.appendChild(link);
    return;
  }
  container.textContent = Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

function formatLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}
