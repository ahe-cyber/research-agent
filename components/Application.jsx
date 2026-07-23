import { useCallback, useEffect, useRef, useState } from "react";
import { AgentPanel } from "@/features/agent/components/AgentPanel.jsx";
import { initializeMapApp } from "@/components/initializeMapApp.js";
import { AddressTab } from "@/features/address/components/AddressTab";
import { AgentTab } from "@/features/agent/components/AgentTab.jsx";
import { FolderTab } from "@/features/folder/components/FolderTab.tsx";
import { RecordTab } from "@/features/record/components/RecordTab.jsx";
import { ToolTab } from "@/features/tool/components/ToolTab.tsx";
import { DatasetTab } from "@/features/dataset/components/DatasetTab";
import { SkillSidebarPanel } from "@/features/skill/components/SkillSidebarPanel.tsx";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem.jsx";
import { SidebarHeader } from "@/components/sidebar/SidebarHeader.jsx";
import { WorkbenchLayout } from "@/components/workspace/WorkbenchLayout.tsx";
import { loadWorkspaceState, saveWorkspaceState } from "@/lib/workspaceState.js";
import { APP_VERSION } from "@/lib/appVersion";
import featureRegistry from "@/data/feature.json";
import { MapTab } from "@/features/map/components/MapTab";
import { withBasePath } from "@/lib/basePath";
import addressIcon from "@/features/address/address.icon.svg";
import agentIcon from "@/features/agent/agent.icon.svg";
import folderIcon from "@/features/folder/folder.icon.svg";
import mapIcon from "@/features/map/map.icon.svg";

const HOME_TAB = {
  id: "home",
  label: "Home",
  iconSrc: withBasePath("/assets/home.svg"),
  workspaceLabel: "Home Workspace",
  emptyEditor: true
};
const EMPTY_EDITOR_ACTIVITY_IDS = new Set(["project", "record", "tool"]);
const DEFAULT_TABS = featureRegistry.map(({ id, label, icon, workspaceLabel }) => ({
  id,
  label,
  iconSrc: getFeatureIconSrc(id, icon),
  workspaceLabel,
  emptyEditor: EMPTY_EDITOR_ACTIVITY_IDS.has(id)
}));

function getStaticAssetSrc(asset) {
  return typeof asset === "string" ? asset : asset?.src || "";
}

function getFeatureIconSrc(id, icon) {
  if (id === "address") return getStaticAssetSrc(addressIcon);
  if (id === "agent") return getStaticAssetSrc(agentIcon);
  if (id === "folder") return getStaticAssetSrc(folderIcon);
  if (id === "map") return getStaticAssetSrc(mapIcon);
  return withBasePath(icon);
}

function getInitialTabs() {
  const state = loadWorkspaceState();
  const featureOrder = Array.isArray(state.featureOrder) ? state.featureOrder : state.activityOrder;
  if (!Array.isArray(featureOrder)) return DEFAULT_TABS;
  const ordered = featureOrder.map((id) => DEFAULT_TABS.find((t) => t.id === id)).filter(Boolean);
  const remaining = DEFAULT_TABS.filter((t) => !featureOrder.includes(t.id));
  return [...ordered, ...remaining];
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const state = loadWorkspaceState();
    return state.activeFeatureTab ?? state.activeActivityTab ?? "address";
  });
  const [workspaceId, setWorkspaceId] = useState("map");
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(true);
  const [tabs, setTabs] = useState(getInitialTabs);
  const [dragOverId, setDragOverId] = useState(null);
  const draggedId = useRef(null);

  const folderRef = useRef(null);
  const suggestToolRef = useRef(null);
  const openFileRef = useRef(null);
  const openPageRef = useRef(null);
  const onSuggestTool = useCallback((name) => suggestToolRef.current?.(name), []);
  const onOpenFile = useCallback((entry) => openFileRef.current?.(entry), []);
  const onOpenPage = useCallback((id, label, value) => openPageRef.current?.(id, label, value), []);
  const activeTabMeta = activeTab === HOME_TAB.id
    ? HOME_TAB
    : tabs.find((tab) => tab.id === activeTab) ?? DEFAULT_TABS.find((tab) => tab.id === activeTab);

  useEffect(() => {
    initializeMapApp({ folderRef, suggestToolRef, openFileRef, openPageRef });
  }, []);

  useEffect(() => {
    saveWorkspaceState({ featureOrder: tabs.map((t) => t.id) });
  }, [tabs]);

  useEffect(() => {
    saveWorkspaceState({ activeFeatureTab: activeTab });
    const detail = {
      id: activeTab,
      label: activeTabMeta?.label ?? activeTab,
      workspaceLabel: activeTabMeta?.workspaceLabel ?? activeTabMeta?.label ?? activeTab
    };
    window.dispatchEvent(new CustomEvent("research-agent:active-feature", { detail }));
  }, [activeTab, activeTabMeta]);

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

  const workspaceOptions = tabs.map(({ id, label, workspaceLabel }) => ({
    id,
    label: workspaceLabel || `${label} Workspace`
  }));

  const featureBar = (
    <nav className="feature-bar" aria-label="Feature Bar">
      <SidebarNavItem
        tab={HOME_TAB.id}
        label={HOME_TAB.label}
        iconSrc={HOME_TAB.iconSrc}
        active={activeTab === HOME_TAB.id}
        draggable={false}
        fixed
        onClick={setActiveTab}
      />
      {tabs.map(({ id, label, iconSrc }) => (
        <SidebarNavItem
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
  );

  const sidebar = (
    <aside className="workspace-sidebar" aria-label="Primary Side Bar">
      <SidebarHeader
        kicker="Research Agent"
        version={APP_VERSION}
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
            className="section-tool-button edit-feature-button"
            type="button"
            id="editFeatureButton"
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
          className="section-tool-button mount-folder-button"
          type="button"
          id="mountFolderButton"
          aria-label="Mount local drive"
          title="Mount local drive"
          hidden={activeTab !== "folder"}
          onClick={() => window.dispatchEvent(new CustomEvent("research-agent:mount-folder"))}
        />
        <button
          className="section-tool-button unmount-folder-button"
          type="button"
          id="unmountFolderButton"
          aria-label="Unmount drive"
          title="Unmount drive"
          hidden={activeTab !== "folder"}
          onClick={() => window.dispatchEvent(new CustomEvent("research-agent:unmount-folder"))}
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

      <section className="workspace-tab" id="homeTab" aria-label="Home" hidden={activeTab !== "home"} />
      <section className="workspace-tab" id="projectTab" aria-label="Project" hidden={activeTab !== "project"} />
      <FolderTab ref={folderRef} active={activeTab === "folder"} onOpenFile={onOpenFile} />
      <AddressTab active={activeTab === "address"} />
      <RecordTab active={activeTab === "record"} />
      <DatasetTab active={activeTab === "dataset"} />
      <ToolTab active={activeTab === "tool"} onOpenPage={onOpenPage} />
      <AgentTab active={activeTab === "agent"} />

      <MapTab active={activeTab === "map"} />
      <SkillSidebarPanel active={activeTab === "skill"} onOpenPage={onOpenPage} />
    </aside>
  );

  const editor = (
    <main className="editor-area" aria-label="Editor">
      <div className="editor-tab-bar" id="editorTabBar" />
      <div className="editor-viewport" id="editorViewport">
        <div id="map" />
      </div>
    </main>
  );

  return (
    <WorkbenchLayout
      featureBar={featureBar}
      sidebar={sidebar}
      editor={editor}
      agentPanel={<AgentPanel />}
    />
  );
}
