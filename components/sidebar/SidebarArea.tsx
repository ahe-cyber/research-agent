"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { AddressTab } from "@/features/address/components/AddressTab";
import { AgentTab } from "@/features/agent/components/AgentTab.jsx";
import { DatasetSidebarPanel } from "@/features/dataset/components/DatasetSidebarPanel";
import { FolderTab } from "@/features/folder/components/FolderTab";
import { MapTab } from "@/features/map/components/MapTab";
import { RecordTab } from "@/features/record/components/RecordTab.jsx";
import { SkillSidebarPanel } from "@/features/skill/components/SkillSidebarPanel";
import { ToolSidebarPanel } from "@/features/tool/components/ToolSidebarPanel";
import { withBasePath } from "@/lib/basePath";
import { loadWorkspaceFeatureState, saveWorkspaceFeatureState } from "@/lib/workspaceFeatures";

type FeatureName = string;
type SidebarAreaProps = {
  onOpenFile?: (entry: unknown) => void;
  onOpenPage?: (id: string, label: string, value: unknown) => void;
  onOpenRichPage?: (id: string, label: string, value: unknown, options: unknown) => void;
  onOpenSettings?: () => void;
};

const MAPBOX_SEARCH_SCRIPT = "https://api.mapbox.com/search-js/v1.5.0/web.js";
const APP_VERSION = "v0.0.8";

const EMPTY_EDITOR_FEATURE_IDS = new Set(["project", "record", "tool"]);

function mapboxSearchReady() {
  return typeof window !== "undefined" && typeof (window as any).mapboxsearch !== "undefined";
}

function getFeatureLabel(feature: FeatureName) {
  return feature
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getFeatureIconSrc(feature: FeatureName) {
  if (feature === "workspace") return withBasePath("/assets/home.svg");
  if (feature === "settings") return withBasePath("/assets/settings.svg");
  return withBasePath(`/api/feature-icon/${encodeURIComponent(feature)}`);
}

function getFeatureMeta(feature: FeatureName) {
  const label = getFeatureLabel(feature);
  return {
    id: feature,
    label,
    iconSrc: getFeatureIconSrc(feature),
    workspaceLabel: `${label} Workspace`,
    emptyEditor: EMPTY_EDITOR_FEATURE_IDS.has(feature)
  };
}

type FeatureMeta = ReturnType<typeof getFeatureMeta>;

function getSidebarWorkspaceFeatureState() {
  const { activeFeature, featureOrder } = loadWorkspaceFeatureState();

  return {
    activeFeature,
    featureOrder,
    features: featureOrder.map(getFeatureMeta)
  };
}

function broadcastActiveFeature(activeFeature: string, features: FeatureMeta[]) {
  const activeFeatureMeta = features.find((feature) => feature.id === activeFeature) ?? getFeatureMeta(activeFeature);

  window.dispatchEvent(new CustomEvent("research-agent:active-feature", {
    detail: {
      id: activeFeature,
      label: activeFeatureMeta?.label ?? activeFeature,
      workspaceLabel: activeFeatureMeta?.workspaceLabel ?? activeFeatureMeta?.label ?? activeFeature
    }
  }));
}

const SidebarHeader = () => {
  return (
    <header>
      <div>RESEARCH AGENT</div>
      <div>{APP_VERSION}</div>
    </header>
  );
};

const SidebarNavItem = ({
  feature,
  activeFeature,
  setActiveFeature,
  onOpenSettings
}: {
  feature: FeatureName;
  activeFeature: FeatureName;
  setActiveFeature: (feature: FeatureName) => void;
  onOpenSettings?: () => void;
}) => {
  return (
    <button
      type="button"
      aria-pressed={activeFeature === feature}
      onClick={() => {
        setActiveFeature(feature);
        if (feature === "settings") onOpenSettings?.();
      }}
    >
      {feature}
    </button>
  );
};

const SidebarNavbar = ({
  activeFeature,
  featureOrder,
  setActiveFeature,
  onOpenSettings
}: {
  activeFeature: FeatureName;
  featureOrder: FeatureName[];
  setActiveFeature: (feature: FeatureName) => void;
  onOpenSettings?: () => void;
}) => {
  return (
    <nav aria-label="Features">
      {featureOrder.map((feature) => (
        <SidebarNavItem
          key={feature}
          feature={feature}
          activeFeature={activeFeature}
          setActiveFeature={setActiveFeature}
          onOpenSettings={onOpenSettings}
        />
      ))}
    </nav>
  );
};

const SidebarPanel = ({
  feature,
  onOpenFile,
  onOpenPage,
  onOpenRichPage
}: {
  feature: FeatureName;
  onOpenFile?: (entry: unknown) => void;
  onOpenPage?: (id: string, label: string, value: unknown) => void;
  onOpenRichPage?: (id: string, label: string, value: unknown, options: unknown) => void;
}) => {
  return (
    <div className="workspace-sidebar-panel-item">
      <section className="workspace-tab" id="workspaceTab" aria-label="Workspace" hidden={feature !== "workspace"} />
      <section className="workspace-tab" id="projectTab" aria-label="Project" hidden={feature !== "project"} />
      <FolderTab active={feature === "folder"} onOpenFile={onOpenFile} />
      <AddressTab active={feature === "address"} />
      <RecordTab active={feature === "record"} />
      <DatasetSidebarPanel active={feature === "dataset"} />
      <ToolSidebarPanel active={feature === "tool"} onOpenPage={onOpenPage} />
      <AgentTab active={feature === "agent"} />
      <MapTab active={feature === "map"} />
      <SkillSidebarPanel active={feature === "skill"} onOpenRichPage={onOpenRichPage} />
    </div>
  );
};

export const SidebarArea = ({
  onOpenFile,
  onOpenPage,
  onOpenRichPage,
  onOpenSettings
}: SidebarAreaProps = {}) => {
  const [searchReady, setSearchReady] = useState(false);
  const [{ activeFeature, featureOrder, features }, setWorkspaceFeatureState] = useState(getSidebarWorkspaceFeatureState);
  const setActiveFeature = (feature: FeatureName) => {
    setWorkspaceFeatureState((state) => ({ ...state, activeFeature: feature }));
  };

  useEffect(() => {
    if (mapboxSearchReady()) {
      setSearchReady(true);
      return;
    }

    const id = window.setInterval(() => {
      if (mapboxSearchReady()) {
        setSearchReady(true);
        window.clearInterval(id);
      }
    }, 100);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    saveWorkspaceFeatureState({ activeFeature, featureOrder });
    broadcastActiveFeature(activeFeature, features);
  }, [activeFeature, featureOrder, features]);

  void searchReady;
  return (
    <>
      <Script id="search-js" src={MAPBOX_SEARCH_SCRIPT} strategy="afterInteractive" />
      <aside aria-label="Sidebar">
        <SidebarHeader />
        <div>
          <SidebarNavbar
            activeFeature={activeFeature}
            featureOrder={featureOrder}
            setActiveFeature={setActiveFeature}
            onOpenSettings={onOpenSettings}
          />
          <SidebarPanel
            feature={activeFeature}
            onOpenFile={onOpenFile}
            onOpenPage={onOpenPage}
            onOpenRichPage={onOpenRichPage}
          />
        </div>
      </aside>
    </>
  );
};
