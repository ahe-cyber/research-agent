import { useEffect, useState } from "react";
import { AgentPanel } from "./agent/AgentPanel.jsx";
import { initializeMapApp } from "./mapApp.js";
import { AddressTab } from "./workspace/AddressTab.jsx";
import { DetailsTab } from "./workspace/DetailsTab.jsx";
import { FormulasTab } from "./workspace/FormulasTab.jsx";
import { SourcesTab } from "./workspace/SourcesTab.jsx";

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
        <ActivityButton tab="formulas" label="Formulas" icon="formula" active={activeTab === "formulas"} onClick={setActiveTab} />
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
            className="section-tool-button wrap-text-button"
            type="button"
            id="wrapJsonTextButton"
            aria-pressed="false"
            aria-label="Wrap text"
            title="Wrap text"
            hidden={activeTab !== "details"}
          />
          <button
            className="section-tool-button edit-sources-button"
            type="button"
            id="editSourcesButton"
            aria-label="Edit sources"
            title="Edit sources"
            hidden={activeTab !== "sources"}
          />
        </div>

        <AddressTab active={activeTab === "address"} />
        <DetailsTab active={activeTab === "details"} />
        <SourcesTab active={activeTab === "sources"} />
        <FormulasTab active={activeTab === "formulas"} />
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
