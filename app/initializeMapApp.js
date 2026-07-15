import { createAgentController } from "./features/agent/AgentPanel.jsx";
import { createMap } from "./features/map/createMap";
import { createSearchSourceControl } from "./components/search/SearchSourceControl";
import { createAddressController, createSearchSourceEditorPanel } from "./components/search/AddressTab.jsx";
import { createAgentTabController } from "./features/agent/AgentTab.jsx";
import { createCatalogController } from "./components/search/CatalogPanel.jsx";
import { createRecordController, createRecordStore } from "./features/record/RecordTab.jsx";
import { createEditorTabController } from "./components/editor/EditorTabs.js";
import { applyBuiltin, hasBuiltin } from "./features/tool/builtins.ts";
import { createPostmanController } from "./components/postman/PostmanTab.jsx";
import { createDatasetController } from "./features/dataset/DatasetTab.jsx";
import { createFolderProviderEditorPanel } from "./features/folder/FolderTab.tsx";
import { createLayerSourcesController } from "./features/map/LayerSourcesPage";
import { registerMapDropZone } from "./features/map/pdfDrop";
import { initPdfOverlayRenderer } from "./features/map/pdfOverlayRenderer";
import { initCustomLayersDraw } from "./features/map/customLayersDraw";

let initialized = false;
let sourceController;
let catalogController;
let recordController;
let addressController;
let agentController;

async function handlePlaceRetrieved(searchResult, _sourceId, sourceLabel) {
  addressController.add(searchResult);
  const outputVariables = await sourceController.assignSearchSourceOutputs(searchResult, _sourceId);

  const title = sourceLabel ? `${sourceLabel} result` : "Search result";
  const record = recordController.add({
    kind: "Search",
    title,
    response: searchResult,
    timestamp: new Date().toISOString(),
    payload: {
      response: searchResult,
      outputVariables
    }
  });

  agentController.attachRecord(record);
}

export async function initializeMapApp({ folderRef = null, suggestToolRef = null, openFileRef = null } = {}) {
  if (initialized) return;
  initialized = true;
  const searchBoxContainer = document.getElementById("placeSearchBox");
  const mapElement = document.getElementById("map");
  let map = null;
  let mapRefreshTimeout = null;
  let mapRestoreToken = 0;

  function refreshMapView({ mask = false } = {}) {
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
    clearTimeout(mapRefreshTimeout);
    mapRefreshTimeout = setTimeout(() => {
      refresh();
      if (token === mapRestoreToken) {
        mapElement?.classList.remove("is-restoring");
      }
    }, mask ? 180 : 250);
  }

  try {
    map = await createMap();
  } catch (error) {
    console.error("[Map App] Map initialization failed; continuing without map-backed features.", error);
  }

  const recordStore = createRecordStore();
  const builtinController = { apply: applyBuiltin, has: hasBuiltin };
  const editorTabController = createEditorTabController({
    onMapActivated: () => refreshMapView({ mask: true })
  });

  window.addEventListener("focus", refreshMapView);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshMapView();
  });
  createLayerSourcesController(editorTabController);
  if (map) registerMapDropZone(map);
  if (map) initPdfOverlayRenderer(map);
  if (map) initCustomLayersDraw(map);
  recordController = createRecordController(recordStore, map, editorTabController, () => agentController);
  addressController = createAddressController({
    onAddressClick: (address) => {
      const reportController = editorTabController.openReportTab(address);
      agentController.setReportController(reportController);
    }
  });
  agentController = createAgentController();
  agentController.setRecordController(recordController);
  agentController.setPageStatusProvider(() => editorTabController.getPageStatus());
  agentController.setReportOpener(() => {
    const address = addressController.getCurrentAddress() || { title: "Research Report", subtitle: "" };
    return editorTabController.openReportTab(address);
  });
  if (suggestToolRef) suggestToolRef.current = (name) => agentController.suggestTool(name);
  if (openFileRef) openFileRef.current = (entry) => editorTabController.openFileViewerTab(entry);
  sourceController = createDatasetController(recordController, builtinController, editorTabController, agentController);
  catalogController = createCatalogController(
    editorTabController,
    agentController,
    () => sourceController.getVariables(),
    (item) => sourceController.addSourceFromCatalog(item),
    (catalogs) => sourceController.setSearchCatalogs(catalogs)
  );
  sourceController.setSearchSourcesEditorOpener(() => catalogController.open({ focusAgent: false }));
  createPostmanController(editorTabController);
  const agentTabController = createAgentTabController(editorTabController, agentController);
  agentController.setAttachmentTargetProvider(() => agentTabController.getAttachmentTarget());
  agentController.setModulesRefresher(() => agentTabController.reload());
  window.addEventListener("research-agent:edit-folder-providers", () => {
    editorTabController.openFolderProviderTab(createFolderProviderEditorPanel());
  });

  let reloadSources;
  const { panel: searchSourcesPanel } = createSearchSourceEditorPanel(() => reloadSources?.());
  const { element: selectorElement, reload } = createSearchSourceControl(
    map,
    handlePlaceRetrieved,
    searchBoxContainer,
    () => editorTabController.openAddressSearchTab(searchSourcesPanel)
  );
  reloadSources = reload;
  document.getElementById("searchSourceSelector").appendChild(selectorElement);
  document.getElementById("editSearchSourcesButton")?.addEventListener("click", () => editorTabController.openAddressSearchTab(searchSourcesPanel));
  document.getElementById("editFeatureButton")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const tabId = button.dataset.activeTab || "project";
    const label = button.dataset.activeLabel || tabId;
    editorTabController.openEmptyPageTab(`feature-${tabId}-editor`, label);
  });
}
