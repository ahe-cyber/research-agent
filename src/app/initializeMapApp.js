import { createAgentController } from "../features/agent/AgentPanel.jsx";
import { createMap } from "../features/map/createMap";
import { createSearchSourceControl } from "../features/search/SearchSourceControl";
import { createAddressController, createSearchSourceEditorPanel } from "../features/search/AddressTab.jsx";
import { createAgentTabController } from "../features/agent/AgentTab.jsx";
import { createCatalogController } from "../features/search/CatalogPanel.jsx";
import { createRecordController, createRecordStore } from "../features/record/RecordTab.jsx";
import { createEditorTabController } from "../features/editor/EditorTabs.js";
import { createToolController } from "../features/tool/ToolTab.jsx";
import { createPostmanController } from "../features/postman/PostmanTab.jsx";
import { createDatasetController } from "../features/dataset/DatasetTab.jsx";
import { createLayerSourcesController } from "../features/map/LayerSourcesPage";

let initialized = false;
let sourceController;
let catalogController;
let recordController;
let addressController;
let agentController;

async function handlePlaceRetrieved(searchResult, _sourceId, sourceLabel) {
  addressController.add(searchResult);
  const outputVariables = sourceController.assignMapboxSearchOutputs(searchResult);

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

export async function initializeMapApp() {
  if (initialized) return;
  initialized = true;
  const searchBoxContainer = document.getElementById("placeSearchBox");
  let map = null;

  try {
    map = await createMap();
  } catch (error) {
    console.error("[Map App] Map initialization failed; continuing without map-backed features.", error);
  }

  const recordStore = createRecordStore();
  const toolController = createToolController(() => agentController);
  const editorTabController = createEditorTabController({
    onMapActivated: () => {
      requestAnimationFrame(() => map?.resize?.());
    }
  });
  createLayerSourcesController(editorTabController);
  recordController = createRecordController(recordStore, map, editorTabController, () => agentController);
  addressController = createAddressController({
    onAddressClick: (address) => {
      const reportController = editorTabController.openReportTab(address);
      agentController.setReportController(reportController);
    }
  });
  agentController = createAgentController();
  agentController.setReportOpener(() => {
    const address = addressController.getCurrentAddress() || { title: "Research Report", subtitle: "" };
    return editorTabController.openReportTab(address);
  });
  sourceController = createDatasetController(recordController, toolController, editorTabController, agentController);
  catalogController = createCatalogController(
    editorTabController,
    agentController,
    () => sourceController.getVariables(),
    (item) => sourceController.addSourceFromCatalog(item)
  );
  createPostmanController(editorTabController);
  const agentTabController = createAgentTabController(editorTabController, agentController);
  agentController.setAttachmentTargetProvider(() => agentTabController.getAttachmentTarget());
  agentController.setModulesRefresher(() => agentTabController.reload());

  let reloadSources;
  const { panel: searchSourcesPanel } = createSearchSourceEditorPanel(() => reloadSources?.());
  const { element: selectorElement, reload } = createSearchSourceControl(map, handlePlaceRetrieved, searchBoxContainer);
  reloadSources = reload;
  document.getElementById("searchSourceSelector").appendChild(selectorElement);
  document.getElementById("editSearchSourcesButton")?.addEventListener("click", () => editorTabController.openAddressSearchTab(searchSourcesPanel));
  document.getElementById("editActivityButton")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const tabId = button.dataset.activeTab || "project";
    const label = button.dataset.activeLabel || tabId;
    editorTabController.openEmptyPageTab(`activity-${tabId}-editor`, label);
  });
}
