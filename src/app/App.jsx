import { useCallback, useEffect, useRef, useState } from "react";
import { AgentPanel } from "../features/agent/AgentPanel.jsx";
import { initializeMapApp } from "./initializeMapApp.js";
import { AddressTab } from "../features/search/AddressTab.jsx";
import { AgentTab } from "../features/agent/AgentTab.jsx";
import { FolderTab } from "../features/folder/FolderTab.tsx";
import { RecordTab } from "../features/record/RecordTab.jsx";
import { ToolTab } from "../features/tool/ToolTab.tsx";
import { DatasetTab } from "../features/dataset/DatasetTab.jsx";
import { ActivityTab } from "../features/workspace/ActivityTab.jsx";
import { SidebarHeader } from "../features/workspace/SidebarHeader.jsx";
import { loadWorkspaceState, saveWorkspaceState } from "../lib/workspaceState.js";
import activityRegistry from "../../public/data/activity.json";

const EMPTY_EDITOR_ACTIVITY_IDS = new Set(["project", "record", "tool"]);
const DEFAULT_TABS = activityRegistry.map(({ id, label, icon, workspaceLabel }) => ({
  id,
  label,
  iconSrc: icon,
  workspaceLabel,
  emptyEditor: EMPTY_EDITOR_ACTIVITY_IDS.has(id)
}));

function getInitialTabs() {
  const { activityOrder } = loadWorkspaceState();
  if (!Array.isArray(activityOrder)) return DEFAULT_TABS;
  const ordered = activityOrder.map((id) => DEFAULT_TABS.find((t) => t.id === id)).filter(Boolean);
  const remaining = DEFAULT_TABS.filter((t) => !activityOrder.includes(t.id));
  return [...ordered, ...remaining];
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => loadWorkspaceState().activeActivityTab ?? "address");
  const [workspaceId, setWorkspaceId] = useState("map");
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(true);
  const [tabs, setTabs] = useState(getInitialTabs);
  const [dragOverId, setDragOverId] = useState(null);
  const draggedId = useRef(null);

  const folderRef = useRef(null);
  const suggestToolRef = useRef(null);
  const onSuggestTool = useCallback((name) => suggestToolRef.current?.(name), []);

  useEffect(() => {
    initializeMapApp({ folderRef, suggestToolRef });
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

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? DEFAULT_TABS.find((tab) => tab.id === activeTab);
  const workspaceOptions = tabs.map(({ id, label, workspaceLabel }) => ({
    id,
    label: workspaceLabel || `${label} Workspace`
  }));

  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Activity Bar">
        {tabs.map(({ id, label, iconSrc }) => (
          <ActivityTab
            key={id}
            tab={id}
            label={label}
            iconSrc={iconSrc}
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
        <SidebarHeader
          kicker="Research Agent"
          dropdown={
            <select
              aria-label="Workspace"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
            >
              {workspaceOptions.map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          }
          action={
            <button
              className={`section-tool-button view-menu-button${isViewMenuOpen ? " is-active" : ""}`}
              type="button"
              aria-pressed={isViewMenuOpen}
              aria-label="View menu"
              title="View menu"
              onClick={() => setIsViewMenuOpen((open) => !open)}
            />
          }
        />

        <div className="view-menu-toolbar" hidden={!isViewMenuOpen}>
          <button
            className="section-tool-button edit-activity-button"
            type="button"
            id="editActivityButton"
            aria-label={`Edit ${activeTabMeta?.label ?? activeTab}`}
            title={`Edit ${activeTabMeta?.label ?? activeTab}`}
            data-active-tab={activeTab}
            data-active-label={activeTabMeta?.label ?? activeTab}
            hidden={!activeTabMeta?.emptyEditor}
          />
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
            hidden={activeTab !== "record"}
          />
          <button
            className="section-tool-button cloud-collections-button"
            type="button"
            id="postmanCollectionsButton"
            aria-label="Postman collections"
            title="Postman collections"
            hidden={activeTab !== "dataset"}
          />
          <button
            className="section-tool-button edit-dataset-button"
            type="button"
            id="editDatasetButton"
            aria-label="Edit dataset"
            title="Edit dataset"
            hidden={activeTab !== "dataset"}
          />
          <button
            className="section-tool-button edit-search-sources-button"
            type="button"
            id="editSearchSourcesButton"
            aria-label="Edit search"
            title="Edit search"
            hidden={activeTab !== "address"}
          />
          <button
            className="section-tool-button edit-agent-button"
            type="button"
            id="editAgentButton"
            aria-label="Edit agent"
            title="Edit agent"
            hidden={activeTab !== "agent"}
          />
        </div>

        <section className="workspace-tab" id="projectTab" aria-label="Project" hidden={activeTab !== "project"} />
        <FolderTab ref={folderRef} active={activeTab === "folder"} />
        <AddressTab active={activeTab === "address"} />
        <RecordTab active={activeTab === "record"} />
        <DatasetTab active={activeTab === "dataset"} />
        <ToolTab active={activeTab === "tool"} onSuggestTool={onSuggestTool} />
        <AgentTab active={activeTab === "agent"} />

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
