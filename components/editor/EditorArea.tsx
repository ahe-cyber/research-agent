"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { EditorNavbar } from "@/components/editor/EditorNavbar";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { EditorPanelItem } from "@/components/editor/EditorPanelItem";
import { createAgentController } from "@/features/agent/components/AgentPanel.jsx";
import { createAgentTabController } from "@/features/agent/components/AgentTab.jsx";
import { createAddressController, createSearchSourceEditorPanel } from "@/features/address/components/AddressTab";
import { createSearchSourceControl } from "@/features/address/components/SearchSourceControl";
import { createCatalogController } from "@/features/dataset/components/CatalogPanel.jsx";
import { createDatasetController } from "@/features/dataset/components/DatasetSidebarPanel";
import { createFolderProviderEditorPanel } from "@/features/folder/components/FolderTab";
import { createLayerSourcesController } from "@/features/map/components/LayerSourcesPage";
import { initCustomLayersDraw } from "@/features/map/components/providers/drawnGeometries";
import { createMap } from "@/features/map/components/providers/mapRenderer";
import { initPdfOverlayRenderer, registerMapDropZone } from "@/features/map/components/providers/pdfOverlay";
import { createRecordController, createRecordStore } from "@/features/record/components/RecordTab.jsx";
import { createSkillSourceEditorPanel } from "@/features/skill/components/SkillSourceEditor";
import { applyBuiltin, hasBuiltin } from "@/features/tool/components/providers/sharedTools";
import { createEditorTabController } from "./EditorTabs.js";

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

function maplibreReady() {
  return typeof window !== "undefined" && typeof (window as any).maplibregl !== "undefined";
}

async function handlePlaceRetrieved(searchResult: unknown, sourceId: string, sourceLabel: string) {
  addressRuntime.add(searchResult);
  const outputVariables = await sourceRuntime.assignSearchSourceOutputs(searchResult, sourceId);

  const title = sourceLabel ? `${sourceLabel} result` : "Search result";
  const record = recordRuntime.add({
    kind: "Search",
    title,
    response: searchResult,
    timestamp: new Date().toISOString(),
    payload: {
      response: searchResult,
      outputVariables
    }
  });

  agentRuntime.attachRecord(record);
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
    if (value === undefined) {
      return editorRuntime.openEmptyPageTab(id, label);
    }
    if ((options as { rich?: boolean }).rich) {
      return editorRuntime.openRichJsonTab(id, label, value, options);
    }
    return editorRuntime.openRawJsonTab(id, label, value);
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
  const agentTabRuntime = createAgentTabController(editorRuntime, agentRuntime);
  agentRuntime.setAttachmentTargetProvider(() => agentTabRuntime.getAttachmentTarget());
  agentRuntime.setModulesRefresher(() => agentTabRuntime.reload());

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
    if (featureId === "agent") {
      window.dispatchEvent(new CustomEvent("research-agent:edit-agent"));
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

function connectAddressSearch(map: any, editorRuntime: any) {
  const searchBoxContainer = document.getElementById("placeSearchBox");
  let reloadSources: (() => void) | undefined;
  const { panel: searchSourcesPanel } = createSearchSourceEditorPanel(() => reloadSources?.());
  const { element: selectorElement, reload } = createSearchSourceControl(
    map,
    handlePlaceRetrieved,
    searchBoxContainer,
    () => editorRuntime.openAddressSearchTab(searchSourcesPanel)
  );
  const searchSourceSelector = document.getElementById("searchSourceSelector");

  reloadSources = reload;
  searchSourceSelector?.appendChild(selectorElement);

  return searchSourcesPanel;
}

async function initializeEditorRuntime({
  openFileRef,
  openPageRef,
  suggestToolRef
}: Pick<EditorAreaProps, "openFileRef" | "openPageRef" | "suggestToolRef">) {
  if (initialized) return;
  initialized = true;

  const mapElement = document.getElementById("map");
  const map = await loadMapRuntime();
  const refreshMapView = createMapViewRefresher(map, mapElement);
  const editorRuntime = createEditorTabController({
    onMapActivated: () => refreshMapView({ mask: true })
  });

  connectPageOpeners(editorRuntime, openPageRef);
  window.addEventListener("focus", refreshMapView);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshMapView();
  });

  connectMapProviders(map, editorRuntime);
  connectRecordsAddressAndAgent(map, editorRuntime);
  connectFileOpeners(editorRuntime, openFileRef);
  connectDatasetAndCatalog(editorRuntime);
  connectAgentEditorRuntime(editorRuntime, suggestToolRef);

  const searchSourcesPanel = connectAddressSearch(map, editorRuntime);
  connectFeatureEditorEvents(editorRuntime, searchSourcesPanel);
}

type EditorAreaProps = {
  openFileRef?: RefObject<((entry: unknown) => void) | null>;
  openPageRef?: RefObject<((id: string, label: string, value: unknown, options?: unknown) => void) | null>;
  suggestToolRef?: RefObject<((name: string) => void) | null>;
};

export function EditorArea({
  openFileRef: providedOpenFileRef,
  openPageRef: providedOpenPageRef,
  suggestToolRef: providedSuggestToolRef
}: EditorAreaProps = {}) {
  const [mapReady, setMapReady] = useState(false);
  const localSuggestToolRef = useRef<((name: string) => void) | null>(null);
  const localOpenFileRef = useRef<((entry: unknown) => void) | null>(null);
  const localOpenPageRef = useRef<((id: string, label: string, value: unknown, options?: unknown) => void) | null>(null);
  const suggestToolRef = providedSuggestToolRef ?? localSuggestToolRef;
  const openFileRef = providedOpenFileRef ?? localOpenFileRef;
  const openPageRef = providedOpenPageRef ?? localOpenPageRef;

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
    initializeEditorRuntime({ suggestToolRef, openFileRef, openPageRef });
  }, [mapReady]);

  return (
    <>
      <Script src={MAPLIBRE_SCRIPT} strategy="afterInteractive" />
      <main aria-label="Editor">
        <EditorPanel navbar={<EditorNavbar />}>
          <EditorPanelItem>
            <div id="map" />
          </EditorPanelItem>
        </EditorPanel>
      </main>
    </>
  );
}
