import { Fragment, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { withBasePath } from "../../lib/basePath";
import { PageListView } from "../../components/editor/PageListView";
import { PageMenu } from "../../components/editor/PageMenu";
import { PageTableView } from "../../components/editor/PageTableView";

interface EditorTabController {
  openLayerSourcesTab(panel: HTMLElement): void;
}

interface LayerSource {
  [key: string]: unknown;
  kind: string;
  label: string;
  metadata?: Record<string, unknown>;
}

type BasemapCatalog = LayerSource[];

interface LayerSourceGroup {
  label: string;
  sources: LayerSource[];
}

interface LayerSourceRow {
  details: Record<string, unknown>;
  group: string;
  source: LayerSource;
}

export function createLayerSourcesController(editorTabController: EditorTabController) {
  const button = document.getElementById("layerSourcesButton");
  let panel: HTMLElement | null = null;

  const openLayerSources = async () => {
    panel ??= await buildLayerSourcesPanel();
    editorTabController.openLayerSourcesTab(panel);
  };

  button?.addEventListener("click", openLayerSources);
  window.addEventListener("research-agent:edit-map-sources", openLayerSources);
}

async function buildLayerSourcesPanel() {
  const response = await fetch(withBasePath("/api/map"));
  if (!response.ok) throw new Error(`Failed to load layer sources: ${response.status}`);
  const catalog = await response.json() as BasemapCatalog;
  const panel = document.createElement("div");

  panel.className = "editor-layer-sources-panel";
  panel.hidden = true;
  createRoot(panel).render(<LayerSourcesPage catalog={catalog} />);
  return panel;
}

function LayerSourcesPage({ catalog }: { catalog: BasemapCatalog }) {
  const [view, setView] = useState<"list" | "table">("list");
  const groups: LayerSourceGroup[] = [
    { label: "Basemaps", sources: catalog.filter((source) => source.kind === "basemap") },
    { label: "Terrain", sources: catalog.filter((source) => source.kind === "terrain") },
    { label: "3D Layers", sources: catalog.filter((source) => source.kind === "sceneLayer") }
  ];

  return (
    <>
      <PageMenu
        right={(
          <>
            <ViewButton active={view === "list"} label="List view" view="list" onClick={() => setView("list")} />
            <ViewButton active={view === "table"} label="Table view" view="table" onClick={() => setView("table")} />
          </>
        )}
      />
      <div className="layer-sources-page">
        <header>
          <h1>Map Setup</h1>
          <p>Configured map backgrounds and overlays.</p>
        </header>
        <div className="layer-sources-content">
          {view === "table" ? <LayerSourcesTableView groups={groups} /> : <LayerSourcesListView groups={groups} />}
        </div>
      </div>
    </>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  view
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  view: "list" | "table";
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`layer-sources-view-button layer-sources-${view}-button${active ? " is-active" : ""}`}
      data-view={view}
      title={label}
      type="button"
      onClick={onClick}
    />
  );
}

function LayerSourcesListView({ groups }: { groups: LayerSourceGroup[] }) {
  return (
    <PageListView>
      {groups.map(({ label, sources }) => sources.length > 0 && (
        <section key={label}>
          <h2>{label}</h2>
          {sources.map((source) => <LayerSourceCard key={`${label}-${source.label}`} source={source} />)}
        </section>
      ))}
    </PageListView>
  );
}

function LayerSourceCard({ source }: { source: LayerSource }) {
  const [category, setCategory] = useState(getInitialCategory(source));

  return (
    <article className="layer-source-card">
      <div className="layer-source-card-header">
        <h3>{source.label}</h3>
        <select
          className="map-card-category-select"
          aria-label="Layer category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="basemap">Basemap</option>
          <option value="global">Global Overlay</option>
          <option value="local">Local Overlay</option>
          <option value="manual">Manual Overlay</option>
        </select>
      </div>
      <dl>
        {Object.entries(getDetails(source)).map(([key, value]) => (
          <Fragment key={key}>
            <dt>{formatLabel(key)}</dt>
            <dd>{renderValue(value)}</dd>
          </Fragment>
        ))}
      </dl>
    </article>
  );
}

function getInitialCategory(source: LayerSource) {
  if (source.kind === "basemap") return "basemap";
  if (source.kind === "terrain" || source.kind === "sceneLayer") return "global";
  return "manual";
}

function LayerSourcesTableView({ groups }: { groups: LayerSourceGroup[] }) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);
  const rows: LayerSourceRow[] = groups.flatMap(({ label, sources }) => sources.map((source) => ({
    group: label,
    source,
    details: getDetails(source)
  })));
  const fields = Array.from(new Set(rows.flatMap(({ details }) => Object.keys(details))));

  async function copyTable() {
    if (!tableRef.current) return;
    await navigator.clipboard.writeText(tableToTsv(tableRef.current));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <PageTableView actions={(
      <button className="layer-sources-copy-button" type="button" onClick={copyTable}>
        {copied ? "Copied" : "Copy as TSV"}
      </button>
    )}>
      <table className="layer-sources-table" ref={tableRef}>
        <thead>
          <tr>
            {["Group", "Layer", ...fields.map(formatLabel)].map((label) => <th key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ group, source, details }) => (
            <tr key={`${group}-${source.label}`}>
              {[group, source.label, ...fields.map((field) => details[field])].map((value, index) => (
                <td key={`${source.label}-${index}`}>{renderValue(value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </PageTableView>
  );
}

function tableToTsv(table: HTMLTableElement) {
  return Array.from(table.rows)
    .map((row) => Array.from(row.cells).map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() ?? "").join("\t"))
    .join("\n");
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

function renderValue(value: unknown): ReactNode {
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    return <a href={value} rel="noopener noreferrer" target="_blank">{value}</a>;
  }
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

function formatLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}
