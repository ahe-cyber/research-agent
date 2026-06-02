import { useEffect, useState } from "react";
import { AgentPanel } from "../features/agents/AgentPanel.jsx";
import { initializeMapApp } from "./initializeMapApp.js";
import { AddressTab } from "../features/address-search/AddressTab.jsx";
import { AgentModulesTab } from "../features/agents/AgentModulesTab.jsx";
import { DetailsTab } from "../features/records/DetailsTab.jsx";
import { FormulasTab } from "../features/formulas/FormulasTab.jsx";
import { SourcesTab } from "../features/sources/SourcesTab.jsx";

function ActivityButton({ tab, label, icon, children, active = false, onClick }) {
  return (
    <button
      className={`activity-button${active ? " is-active" : ""}${icon ? ` activity-icon activity-icon-${icon}` : ""}`}
      type="button"
      aria-label={label}
      onClick={() => onClick(tab)}
    >
      {!icon && children}
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("address");
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(true);

  useEffect(() => {
    initializeMapApp();
  }, []);

  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Activity Bar">
        <ActivityButton tab="address" label="Address" icon="address" active={activeTab === "address"} onClick={setActiveTab} />
        <ActivityButton tab="details" label="Records" icon="record" active={activeTab === "details"} onClick={setActiveTab} />
        <ActivityButton tab="sources" label="Sources" icon="source" active={activeTab === "sources"} onClick={setActiveTab} />
        <ActivityButton tab="formulas" label="Agent Tools" icon="formula" active={activeTab === "formulas"} onClick={setActiveTab} />
        <ActivityButton tab="agents" label="Agent Modules" icon="agents" active={activeTab === "agents"} onClick={setActiveTab} />
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
            hidden={activeTab !== "address"}
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

        <section className="map-display-settings" aria-label="Map display settings">
          <h2 className="section-title">Map</h2>
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
