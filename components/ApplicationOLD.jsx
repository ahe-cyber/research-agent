import { useCallback, useEffect, useRef, useState } from "react";
import { AgentPanel } from "@/features/agent/components/AgentPanel.jsx";
import { initializeMapApp } from "@/components/initializeMapAppOLD.js";
import { AddressTab } from "@/features/address/components/AddressTab";
import { AgentTab } from "@/features/agent/components/AgentTab.jsx";
import { FolderTab } from "@/features/folder/components/FolderTab.tsx";
import { RecordTab } from "@/features/record/components/RecordTab.jsx";
import { ToolSidebarPanel } from "@/features/tool/components/ToolSidebarPanel.tsx";
import { DatasetSidebarPanel } from "@/features/dataset/components/DatasetSidebarPanel";
import { SkillSidebarPanel } from "@/features/skill/components/SkillSidebarPanel.tsx";
import { SidebarNavbar } from "@/components/sidebar/SidebarNavbarOLD";
import { SidebarHeader } from "@/components/sidebar/SidebarHeader.jsx";
import { WorkbenchLayout } from "@/components/workspace/WorkbenchLayoutOLD";
import { EditorNavbar } from "@/components/editor/EditorNavbar";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { EditorPanelItem } from "@/components/editor/EditorPanelItem";
import { loadWorkspaceState, saveWorkspaceState } from "@/lib/workspaceStateOLD";
import { APP_VERSION } from "@/lib/appVersionOLD";
import featureRegistry from "@/data/featureOLD.json";
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
const SETTINGS_TAB = {
  id: "settings",
  label: "Settings",
  iconSrc: withBasePath("/assets/settings.svg")
};
const SETTINGS_STORAGE_KEY = "research-agent.settings";
const DEFAULT_APP_SETTINGS = {
  version: 1,
  theme: "system",
  editor: {
    wrapRawJson: false
  },
  agent: {
    attachRecordsByDefault: true
  }
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

function getStoredSettings() {
  const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

  if (rawSettings === null) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
    return DEFAULT_APP_SETTINGS;
  }

  try {
    return JSON.parse(rawSettings);
  } catch {
    return rawSettings;
  }
}

/*
  New File: SidebarArea
  
const SidebarHeader = () => {
  return <div>
    <div>RESEARCH AGENT</div>
    <div>v0.0.7</div>
  </div>
}

const SidebarNavItem = (feature, active, setActiveFeature) => {
  return <Image
    src={getSidebarNavIcon(feature)}
    alt={feature + " Nav Icon"}
    className={active ? "active sidebar-nav-item" : "sidebar-nav-item"}
    onClick={setActiveFeature(feature)}
  />
}

const SidebarNavbar = (activeFeature, featureOrder, setActiveFeature, setFeatureOrder) => {
  return <div>
    <SidebarNavItem feature="Workspace" active={activeFeature == "Workspace"} />
    <hr />
    {featureOrder.map((feature) => <SidebarNavItem feature={feature} active={activeFeature == feature} /> )}
    <hr />
  </div>
}

const SidebarPanel = (feature) => {
  const [featureData, setFeatureData] = useState<Record<string, Object[]>>(getFeatureData);

  useEffect(() => {
    postFeatureData(featureData);
  }, [featureData]);

  return <div>
    <div>{feature.upper()}</div>
    <SearchSourceWidget feature={feature} />
    <SearchBoxWidget feature={feature} />
    {featureData[feature].map(featureRecord => <SidebarCard name={featureRecord.name} description={featureRecord.description} />)}
  </div>
}

const SidebarArea = () => {
  const [activeFeature, setActiveFeature] = useState<string>(getWorkspaceState().activeFeature);
  const [featureOrder, setFeatureOrder] = useState<string[]>(getWorkspaceState().featureOrder);

  useEffect(() => {
    postWorkspaceState(activeFeature, featureOrder);
  }, [activeFeature, featureOrder]);

  return <div>
    <SidebarHeader />
    <SidebarNavbar 
      activeFeature={activeFeature}
      featureOrder={featureOrder}
      setActiveFeature={setActiveFeature}
      setFeatureOrder={setFeatureOrder}
    />
    <SidebarPanel
      feature={activeFeature}
    />
  </div>
}

  EOF: SidebarArea
*/

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const state = loadWorkspaceState();
    return state.activeFeatureTab ?? state.activeActivityTab ?? "address";
  });
  const [workspaceId, setWorkspaceId] = useState("map");
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
  const onOpenRichPage = useCallback((id, label, value, options) => openPageRef.current?.(id, label, value, options), []);
  const onOpenSettings = useCallback(() => {
    openPageRef.current?.("settings", "Settings", getStoredSettings());
  }, []);
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
    <SidebarNavbar
      homeTab={HOME_TAB}
      settingsTab={SETTINGS_TAB}
      tabs={tabs}
      activeTab={activeTab}
      dragOverId={dragOverId}
      onSelectTab={setActiveTab}
      onOpenSettings={onOpenSettings}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    />
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
      />

      <div className="workspace-sidebar-body">
        {featureBar}
        <div className="workspace-sidebar-panel-item">
          <section className="workspace-tab" id="homeTab" aria-label="Home" hidden={activeTab !== "home"} />
          <section className="workspace-tab" id="projectTab" aria-label="Project" hidden={activeTab !== "project"} />
          <FolderTab ref={folderRef} active={activeTab === "folder"} onOpenFile={onOpenFile} />
          <AddressTab active={activeTab === "address"} />
          <RecordTab active={activeTab === "record"} />
          <DatasetSidebarPanel active={activeTab === "dataset"} />
          <ToolSidebarPanel active={activeTab === "tool"} onOpenPage={onOpenPage} />
          <AgentTab active={activeTab === "agent"} />

          <MapTab active={activeTab === "map"} />
          <SkillSidebarPanel active={activeTab === "skill"} onOpenRichPage={onOpenRichPage} />
        </div>
      </div>
    </aside>
  );

  const editor = (
    <EditorPanel navbar={<EditorNavbar />}>
      <EditorPanelItem>
        <div id="map" />
      </EditorPanelItem>
    </EditorPanel>
  );

  return (
    <WorkbenchLayout
      sidebar={sidebar}
      editor={editor}
      agentPanel={<AgentPanel />}
    />
  );
}
