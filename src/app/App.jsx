import { useEffect, useRef, useState } from "react";
import { AgentPanel } from "../features/agents/AgentPanel.jsx";
import { initializeMapApp } from "./initializeMapApp.js";
import { AddressTab } from "../features/address-search/AddressTab.jsx";
import { AgentModulesTab } from "../features/agents/AgentModulesTab.jsx";
import { DetailsTab } from "../features/records/DetailsTab.jsx";
import { FormulasTab } from "../features/formulas/FormulasTab.jsx";
import { SourcesTab } from "../features/sources/SourcesTab.jsx";
import { loadWorkspaceState, saveWorkspaceState } from "../lib/workspaceState.js";

const DEFAULT_TABS = [
  { id: "address", label: "Address", icon: "address" },
  { id: "details", label: "Records", icon: "record" },
  { id: "sources", label: "Sources", icon: "source" },
  { id: "formulas", label: "Agent Tools", icon: "formula" },
  { id: "agents", label: "Agent Modules", icon: "agents" },
  { id: "map", label: "Map", icon: "map" },
];

function getInitialTabs() {
  const { activityOrder } = loadWorkspaceState();
  if (!Array.isArray(activityOrder)) return DEFAULT_TABS;
  const ordered = activityOrder.map((id) => DEFAULT_TABS.find((t) => t.id === id)).filter(Boolean);
  const remaining = DEFAULT_TABS.filter((t) => !activityOrder.includes(t.id));
  return [...ordered, ...remaining];
}

function ActivityButton({ tab, label, icon, active, dragOver, onDragStart, onDragOver, onDrop, onDragEnd, onClick }) {
  return (
    <button
      className={[
        "activity-button",
        active && "is-active",
        icon && `activity-icon activity-icon-${icon}`,
        dragOver && "is-drag-over",
      ].filter(Boolean).join(" ")}
      type="button"
      aria-label={label}
      draggable
      onClick={() => onClick(tab)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    />
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => loadWorkspaceState().activeActivityTab ?? "address");
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(true);
  const [tabs, setTabs] = useState(getInitialTabs);
  const [dragOverId, setDragOverId] = useState(null);
  const draggedId = useRef(null);

  useEffect(() => {
    initializeMapApp();
  }, []);

  useEffect(() => {
    saveWorkspaceState({ activityOrder: tabs.map((t) => t.id) });
  }, [tabs]);

  useEffect(() => {
    saveWorkspaceState({ activeActivityTab: activeTab });
  }, [activeTab]);

  function handleDragStart(id) {
    draggedId.current = id;
  }

  function handleDragOver(e, id) {
    e.preventDefault();
    if (id !== draggedId.current) setDragOverId(id);
  }

  function handleDrop(e, targetId) {
    e.preventDefault();
    const fromId = draggedId.current;
    draggedId.current = null;
    setDragOverId(null);
    if (!fromId || fromId === targetId) return;
    setTabs((prev) => {
      const next = [...prev];
      const from = next.findIndex((t) => t.id === fromId);
      const to = next.findIndex((t) => t.id === targetId);
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  function handleDragEnd() {
    draggedId.current = null;
    setDragOverId(null);
  }

  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Activity Bar">
        {tabs.map(({ id, label, icon }) => (
          <ActivityButton
            key={id}
            tab={id}
            label={label}
            icon={icon}
            active={activeTab === id}
            dragOver={dragOverId === id}
            onClick={setActiveTab}
            onDragStart={() => handleDragStart(id)}
            onDragOver={(e) => handleDragOver(e, id)}
            onDrop={(e) => handleDrop(e, id)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </nav>

      <aside className="workspace-sidebar" aria-label="Primary Side Bar">
        <header className="panel-header">
          <div>
            <span className="panel-kicker">Research Agent</span>
            <strong className="panel-title">Map Workspace</strong>
          </div>
          <button
            className={`section-tool-button view-menu-button${isViewMenuOpen ? " is-active" : ""}`}
            type="button"
            aria-pressed={isViewMenuOpen}
            aria-label="View menu"
            title="View menu"
            onClick={() => setIsViewMenuOpen((open) => !open)}
          />
        </header>

        <div className="view-menu-toolbar" hidden={!isViewMenuOpen}>
          <button
            className="section-tool-button layer-sources-button"
            type="button"
            id="layerSourcesButton"
            aria-label="Layer sources"
            title="Layer sources"
            hidden={activeTab !== "map"}
          />
          <button
            className="section-tool-button wrap-text-button"
            type="button"
            id="wrapJsonTextButton"
            aria-pressed="false"
            aria-label="Wrap text"
            title="Wrap text"
            hidden={activeTab !== "details"}
          />
          <button
            className="section-tool-button cloud-collections-button"
            type="button"
            id="postmanCollectionsButton"
            aria-label="Postman collections"
            title="Postman collections"
            hidden={activeTab !== "sources"}
          />
          <button
            className="section-tool-button browse-catalogs-button"
            type="button"
            id="browseCatalogsButton"
            aria-label="Browse dataset catalogs"
            title="Browse dataset catalogs"
            hidden={activeTab !== "sources"}
          />
          <button
            className="section-tool-button edit-sources-button"
            type="button"
            id="editSourcesButton"
            aria-label="Edit sources"
            title="Edit sources"
            hidden={activeTab !== "sources"}
          />
          <button
            className="section-tool-button edit-search-sources-button"
            type="button"
            id="editSearchSourcesButton"
            aria-label="Edit search sources"
            title="Edit search sources"
            hidden={activeTab !== "address"}
          />
          <button
            className="section-tool-button edit-agents-button"
            type="button"
            id="editAgentsButton"
            aria-label="Edit agent modules"
            title="Edit agent modules"
            hidden={activeTab !== "agents"}
          />
        </div>

        <AddressTab active={activeTab === "address"} />
        <DetailsTab active={activeTab === "details"} />
        <SourcesTab active={activeTab === "sources"} />
        <FormulasTab active={activeTab === "formulas"} />
        <AgentModulesTab active={activeTab === "agents"} />

        <section className="workspace-tab map-display-settings" aria-label="Map display settings" hidden={activeTab !== "map"}>
          <div className="map-display-group">
            <h3>Basemap</h3>
            <div id="mapBasemapOptions" />
          </div>
          <div className="map-display-group">
            <h3>Details</h3>
            <div id="mapDetailOptions" />
          </div>
        </section>
      </aside>

      <main className="editor-area" aria-label="Editor">
        <div className="editor-tab-bar" id="editorTabBar" />
        <div className="editor-viewport" id="editorViewport">
          <div id="map" />
        </div>
      </main>

      <AgentPanel />
    </div>
  );
}
