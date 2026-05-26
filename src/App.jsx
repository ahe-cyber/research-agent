import { useEffect, useState } from "react";
import { AgentPanel } from "./agent/AgentPanel.jsx";
import { initializeMapApp } from "./mapApp.js";
import { AddressTab } from "./workspace/AddressTab.jsx";
import { AssetsTab } from "./workspace/AssetsTab.jsx";
import { DetailsTab } from "./workspace/DetailsTab.jsx";
import { SourcesTab } from "./workspace/SourcesTab.jsx";

function ActivityButton({ tab, label, children, active = false, onClick }) {
  return (
    <button
      className={`activity-button${active ? " is-active" : ""}`}
      type="button"
      aria-label={label}
      onClick={() => onClick(tab)}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("address");

  useEffect(() => {
    initializeMapApp();
  }, []);

  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Workspace sections">
        <ActivityButton tab="address" label="Address" active={activeTab === "address"} onClick={setActiveTab}>
          A
        </ActivityButton>
        <ActivityButton tab="details" label="Details" active={activeTab === "details"} onClick={setActiveTab}>
          D
        </ActivityButton>
        <ActivityButton tab="sources" label="Sources" active={activeTab === "sources"} onClick={setActiveTab}>
          ?
        </ActivityButton>
        <ActivityButton tab="assets" label="Assets" active={activeTab === "assets"} onClick={setActiveTab}>
          I
        </ActivityButton>
      </nav>

      <aside className="workspace-sidebar" aria-label="Workspace">
        <header className="panel-header">
          <div>
            <span className="panel-kicker">Workspace</span>
            <strong className="panel-title">Map App</strong>
          </div>
          <button
            className="section-tool-button wrap-text-button"
            type="button"
            id="wrapJsonTextButton"
            aria-pressed="false"
            aria-label="Wrap text"
            title="Wrap text"
          />
        </header>

        <AddressTab active={activeTab === "address"} />
        <DetailsTab active={activeTab === "details"} />
        <SourcesTab active={activeTab === "sources"} />
        <AssetsTab active={activeTab === "assets"} />
      </aside>

      <main className="editor-area">
        <div id="map" />
      </main>

      <AgentPanel />
    </div>
  );
}
