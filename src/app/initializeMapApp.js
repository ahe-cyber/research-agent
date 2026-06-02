import { createAgentController } from "../features/agents/AgentPanel.jsx";
import { createMap } from "../features/map/createMap";
import { createSearchSourceControl } from "../features/address-search/SearchSourceControl";
import { createAddressController } from "../features/address-search/AddressTab.jsx";
import { createAgentModulesController } from "../features/agents/AgentModulesTab.jsx";
import { createCatalogController } from "../features/catalog/CatalogBrowser.js";
import { createRecordController, createRecordStore } from "../features/records/DetailsTab.jsx";
import { createEditorTabController } from "../features/editor/EditorTabs.js";
import { createFormulaController } from "../features/formulas/FormulasTab.jsx";
import { createPostmanController } from "../features/postman/PostmanTab.js";
import { createSourceController } from "../features/sources/SourcesTab.jsx";
import { createLayerSourcesController } from "../features/map/LayerSourcesPage";

let sourceController;
let catalogController;
let recordController;
let addressController;
let agentController;

async function handlePlaceRetrieved(searchResult, searchSourceId) {
  addressController.add(searchResult);
  const outputVariables = sourceController.assignMapboxSearchOutputs(searchResult);

  const titleMap = { geosearch: "NYC GeoSearch result", mapbox: "Mapbox search result", google: "Google Places result" };
  const title = titleMap[searchSourceId] ?? "Search result";
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
  sourceController = createSourceController(
    recordController, formulaController, editorTabController, agentController,
    () => catalogController?.open()
  );
  catalogController = createCatalogController(
    editorTabController,
    agentController,
    () => sourceController.getVariables(),
    (item) => sourceController.addSourceFromCatalog(item)
  );
  createPostmanController(editorTabController);
  const agentModulesController = createAgentModulesController(editorTabController, agentController);
  agentController.setAttachmentTargetProvider(() => agentModulesController.getAttachmentTarget());
  agentController.setModulesRefresher(() => agentModulesController.reload());

  const { element: selectorElement } = createSearchSourceControl(map, handlePlaceRetrieved, searchBoxContainer);
  document.getElementById("searchSourceSelector").appendChild(selectorElement);
}
