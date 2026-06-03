import { createAgentController } from "../features/agents/AgentPanel.jsx";
import { createMap } from "../features/map/createMap";
import { createSearchSourceControl } from "../features/address-search/SearchSourceControl";
import { createAddressController, createSearchSourceEditorPanel } from "../features/address-search/AddressTab.jsx";
import { createAgentModulesController } from "../features/agents/AgentModulesTab.jsx";
import { createCatalogController } from "../features/catalog/CatalogBrowser.jsx";
import { createRecordController, createRecordStore } from "../features/records/DetailsTab.jsx";
import { createEditorTabController } from "../features/editor/EditorTabs.js";
import { createFormulaController } from "../features/formulas/FormulasTab.jsx";
import { createPostmanController } from "../features/postman/PostmanTab.jsx";
import { createSourceController } from "../features/sources/SourcesTab.jsx";
import { createLayerSourcesController } from "../features/map/LayerSourcesPage";
import { loadWorkspaceState } from "../lib/workspaceState.js";

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
  const formulaController = createFormulaController(() => agentController);
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
  sourceController = createSourceController(recordController, formulaController, editorTabController, agentController);
  catalogController = createCatalogController(
    editorTabController,
    agentController,
    () => sourceController.getVariables(),
    (item) => sourceController.addSourceFromCatalog(item)
  );
  window.addEventListener("research-agent:open-browser", () => catalogController?.open());
  if (loadWorkspaceState().activeActivityTab === "browser") {
    catalogController.open();
  }
  createPostmanController(editorTabController);
  const agentModulesController = createAgentModulesController(editorTabController, agentController);
  agentController.setAttachmentTargetProvider(() => agentModulesController.getAttachmentTarget());
  agentController.setModulesRefresher(() => agentModulesController.reload());

  let reloadSources;
  const { panel: searchSourcesPanel } = createSearchSourceEditorPanel(() => reloadSources?.());
  const { element: selectorElement, reload } = createSearchSourceControl(map, handlePlaceRetrieved, searchBoxContainer);
  reloadSources = reload;
  document.getElementById("searchSourceSelector").appendChild(selectorElement);
  document.getElementById("editSearchSourcesButton")?.addEventListener("click", () => editorTabController.openSearchSourcesTab(searchSourcesPanel));
  document.getElementById("editActivityButton")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const tabId = button.dataset.activeTab || "project";
    const label = button.dataset.activeLabel || tabId;
    editorTabController.openEmptyPageTab(`activity-${tabId}-editor`, label);
  });
}
