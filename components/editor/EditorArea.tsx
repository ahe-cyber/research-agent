"use client";

import { Fragment, type RefObject, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { EditorNavbar } from "@/components/editor/EditorNavbar";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { EditorPanelItem } from "@/components/editor/EditorPanelItem";
import { createAgentController } from "@/components/agent/AgentArea";
import { createAddressController, createSearchSourceEditorPanel } from "@/features/address/components/AddressEditorRuntime";
import { createCatalogController } from "@/features/dataset/components/CatalogPanel";
import { createDatasetController } from "@/features/dataset/components/DatasetEditorRuntime";
import { createFolderProviderEditorPanel } from "@/features/folder/components/FolderEditorRuntime";
import { createLayerSourcesController } from "@/features/map/components/LayerSourcesPage";
import { initCustomLayersDraw } from "@/features/map/components/providers/drawnGeometries";
import { createMap } from "@/features/map/components/providers/mapRenderer";
import { initPdfOverlayRenderer, registerMapDropZone } from "@/features/map/components/providers/pdfOverlay";
import { createRecordController, createRecordStore } from "@/features/record/components/RecordEditorRuntime";
import { createSkillSourceEditorPanel } from "@/features/skill/components/SkillSourceEditor";
import { applyBuiltin, hasBuiltin } from "@/features/tool/components/providers/sharedTools";
import { createEditorTabController } from "./EditorTabs.js";
import type { WorkspaceInvalidationState } from "@/lib/workspaceInvalidation";

/*
  - Where the current EditorTabs.js imperative controller should move.
  - The copied app runtime still calls create*Controller compatibility functions.
    Those should be dissolved into feature-owned functions/hooks next.
*/

const MAPLIBRE_SCRIPT = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";

let initialized = false;
let sourceRuntime: any;
let recordRuntime: any;
let addressRuntime: any;
let agentRuntime: any;
let editorRuntimeInstance: any;
let currentWorkspaceInvalidation: WorkspaceInvalidationState = {};

function maplibreReady() {
  return typeof window !== "undefined" && typeof (window as any).maplibregl !== "undefined";
}

function createMapViewRefresher(map: any, mapElement: HTMLElement | null) {
  let mapRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
  let mapRestoreToken = 0;

  return ({ mask = false }: { mask?: boolean } = {}) => {
    if (!map) return;
    const token = ++mapRestoreToken;

    if (mask) {
      mapElement?.classList.add("is-restoring");
    }

    const refresh = () => {
      map?.resize?.();
      map?.triggerRepaint?.();
    };

    refresh();
    requestAnimationFrame(() => {
      refresh();
      requestAnimationFrame(refresh);
    });

    if (mapRefreshTimeout) clearTimeout(mapRefreshTimeout);
    mapRefreshTimeout = setTimeout(() => {
      refresh();
      if (token === mapRestoreToken) {
        mapElement?.classList.remove("is-restoring");
      }
    }, mask ? 180 : 250);
  };
}

async function loadMapRuntime() {
  try {
    return await createMap();
  } catch (error) {
    console.error("[Map App] Map initialization failed; continuing without map-backed features.", error);
    return null;
  }
}

function connectPageOpeners(editorRuntime: any, openPageRef: EditorAreaProps["openPageRef"]) {
  if (!openPageRef) return;

  openPageRef.current = (id, label, value, options = {}) => {
    const pageOptions = { ...(options as Record<string, unknown>), workspaceInvalidation: currentWorkspaceInvalidation };
    if (value === undefined) {
      return editorRuntime.openEmptyPageTab(id, label);
    }
    if ((pageOptions as { rich?: boolean }).rich) {
      return editorRuntime.openRichJsonTab(id, label, value, pageOptions);
    }
    return editorRuntime.openRawJsonTab(id, label, value, pageOptions);
  };
}

function connectMapProviders(map: any, editorRuntime: any) {
  createLayerSourcesController(editorRuntime);
  if (map) registerMapDropZone(map);
  if (map) initPdfOverlayRenderer(map);
  if (map) initCustomLayersDraw(map);
}

function connectRecordsAddressAndAgent(map: any, editorRuntime: any) {
  const recordStore = createRecordStore();

  recordRuntime = createRecordController(recordStore, map, editorRuntime, () => agentRuntime);
  addressRuntime = createAddressController({
    onAddressClick: (address: unknown) => {
      const reportRuntime = editorRuntime.openReportTab(address);
      agentRuntime.setReportController(reportRuntime);
    }
  });
  agentRuntime = createAgentController();
  agentRuntime.setRecordController(recordRuntime);
  agentRuntime.setPageStatusProvider(() => editorRuntime.getPageStatus());
  agentRuntime.setReportOpener(() => {
    const address = addressRuntime.getCurrentAddress() || { title: "Research Report", subtitle: "" };
    return editorRuntime.openReportTab(address);
  });
}

function connectDatasetAndCatalog(editorRuntime: any) {
  const builtinRuntime = { apply: applyBuiltin, has: hasBuiltin };
  sourceRuntime = createDatasetController(builtinRuntime, editorRuntime, agentRuntime);

  createCatalogController(
    editorRuntime,
    agentRuntime,
    () => sourceRuntime.getVariables(),
    (item: unknown) => sourceRuntime.addSourceFromCatalog(item),
    (catalogs: unknown) => sourceRuntime.setSearchCatalogs(catalogs)
  );
}

function connectAgentEditorRuntime(editorRuntime: any, suggestToolRef: EditorAreaProps["suggestToolRef"]) {
  if (suggestToolRef) {
    suggestToolRef.current = (name) => agentRuntime.suggestTool(name);
  }
}

function connectFileOpeners(editorRuntime: any, openFileRef: EditorAreaProps["openFileRef"]) {
  if (openFileRef) {
    openFileRef.current = (entry) => editorRuntime.openFileViewerTab(entry);
  }
}

function connectFeatureEditorEvents(editorRuntime: any, searchSourcesPanel: unknown) {
  window.addEventListener("research-agent:edit-folder-providers", () => {
    editorRuntime.openFolderProviderTab(createFolderProviderEditorPanel());
  });
  window.addEventListener("research-agent:edit-skill-sources", () => {
    editorRuntime.openSkillSearchTab(createSkillSourceEditorPanel());
  });
  window.addEventListener("research-agent:edit-feature", (event) => {
    const customEvent = event as CustomEvent<{ featureId?: string; featureLabel?: string }>;
    const featureId = customEvent.detail?.featureId || "project";
    const label = customEvent.detail?.featureLabel || featureId;

    if (featureId === "address") {
      editorRuntime.openAddressSearchTab(searchSourcesPanel);
      return;
    }
    if (featureId === "map") {
      window.dispatchEvent(new CustomEvent("research-agent:edit-map-sources"));
      return;
    }
    if (featureId === "dataset") {
      window.dispatchEvent(new CustomEvent("research-agent:edit-dataset-sources"));
      return;
    }
    if (featureId === "folder") {
      window.dispatchEvent(new CustomEvent("research-agent:edit-folder-providers"));
      return;
    }
    if (featureId === "skill") {
      window.dispatchEvent(new CustomEvent("research-agent:edit-skill-sources"));
      return;
    }

    editorRuntime.openEmptyPageTab(`feature-${featureId}-editor`, label);
  });
}

function createAddressSearchSourcesPanel() {
  const { panel: searchSourcesPanel } = createSearchSourceEditorPanel();
  return searchSourcesPanel;
}

async function initializeEditorRuntime({ openFileRef, openPageRef, suggestToolRef, workspaceInvalidation }: Pick<EditorAreaProps, "openFileRef" | "openPageRef" | "suggestToolRef" | "workspaceInvalidation">) {
  currentWorkspaceInvalidation = workspaceInvalidation || {};
  if (initialized) return editorRuntimeInstance;
  initialized = true;

  const mapElement = document.getElementById("map");
  const map = await loadMapRuntime();
  const refreshMapView = createMapViewRefresher(map, mapElement);
  const editorRuntime = createEditorTabController({
    onMapActivated: () => refreshMapView({ mask: true })
  });
  editorRuntimeInstance = editorRuntime;
  editorRuntime.refreshJsonInvalidation?.(workspaceInvalidation || {});

  connectPageOpeners(editorRuntime, openPageRef);
  window.addEventListener("focus", () => refreshMapView());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshMapView();
  });

  connectMapProviders(map, editorRuntime);
  connectRecordsAddressAndAgent(map, editorRuntime);
  connectFileOpeners(editorRuntime, openFileRef);
  connectDatasetAndCatalog(editorRuntime);
  connectAgentEditorRuntime(editorRuntime, suggestToolRef);

  const searchSourcesPanel = createAddressSearchSourcesPanel();
  connectFeatureEditorEvents(editorRuntime, searchSourcesPanel);
  return editorRuntime;
}

type EditorAreaProps = {
  openFileRef?: RefObject<((entry: unknown) => void) | null>;
  openPageRef?: RefObject<((id: string, label: string, value: unknown, options?: unknown) => void) | null>;
  suggestToolRef?: RefObject<((name: string) => void) | null>;
  workspaceInvalidation?: WorkspaceInvalidationState;
};

const EditorRuntime = ({ openFileRef, openPageRef, suggestToolRef, workspaceInvalidation }: Required<EditorAreaProps>) => {
  const editorRuntimeRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (maplibreReady()) {
      setMapReady(true);
      return;
    }

    const id = window.setInterval(() => {
      if (maplibreReady()) {
        setMapReady(true);
        window.clearInterval(id);
      }
    }, 100);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    void initializeEditorRuntime({ suggestToolRef, openFileRef, openPageRef, workspaceInvalidation }).then((editorRuntime) => {
      editorRuntimeRef.current = editorRuntime;
    });
  }, [mapReady, suggestToolRef, openFileRef, openPageRef, workspaceInvalidation]);

  useEffect(() => {
    currentWorkspaceInvalidation = workspaceInvalidation;
    editorRuntimeRef.current?.refreshJsonInvalidation?.(workspaceInvalidation);
  }, [workspaceInvalidation]);

  return <Script src={MAPLIBRE_SCRIPT} strategy="afterInteractive" />;
};

const EditorSurface = () => {
  return (
    <EditorPanel navbar={<EditorNavbar />}>
      <EditorPanelItem>
        <div id="map" />
      </EditorPanelItem>
    </EditorPanel>
  );
};

const useEditorRuntimeRefs = ({ openFileRef, openPageRef, suggestToolRef }: EditorAreaProps) => {
  const localSuggestToolRef = useRef<((name: string) => void) | null>(null);
  const localOpenFileRef = useRef<((entry: unknown) => void) | null>(null);
  const localOpenPageRef = useRef<((id: string, label: string, value: unknown, options?: unknown) => void) | null>(null);

  return {
    suggestToolRef: suggestToolRef ?? localSuggestToolRef,
    openFileRef: openFileRef ?? localOpenFileRef,
    openPageRef: openPageRef ?? localOpenPageRef
  };
};

export const EditorArea = (props: EditorAreaProps = {}) => {
  const { openFileRef, openPageRef, suggestToolRef } = useEditorRuntimeRefs(props);

  return (
    <Fragment>
      <EditorRuntime openFileRef={openFileRef} openPageRef={openPageRef} suggestToolRef={suggestToolRef} workspaceInvalidation={props.workspaceInvalidation ?? {}} />
      <EditorSurface />
    </Fragment>
  );
};
