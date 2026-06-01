import { createAgentController } from "./agent/AgentPanel.jsx";
import { createMap } from "./map/map.js";
import { createPlaceSearchBox } from "./map/search.js";
import { createAddressController } from "./workspace/AddressTab.jsx";
import { createAgentModulesController } from "./workspace/AgentModulesTab.jsx";
import { createCatalogController } from "./workspace/CatalogBrowser.js";
import { createRecordController, createRecordStore } from "./workspace/DetailsTab.jsx";
import { createEditorTabController } from "./workspace/EditorTabs.js";
import { createFormulaController } from "./workspace/FormulasTab.jsx";
import { createPostmanController } from "./workspace/PostmanTab.js";
import { createSourceController } from "./workspace/SourcesTab.jsx";

let sourceController;
let catalogController;
let recordController;
let addressController;
let agentController;

async function handlePlaceRetrieved(searchResult) {
  addressController.add(searchResult);
  const outputVariables = sourceController.assignMapboxSearchOutputs(searchResult);

  const record = recordController.add({
    kind: "Search",
    title: "Mapbox search result",
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
    map = createMap();
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

  const searchBox = createPlaceSearchBox(map, handlePlaceRetrieved);
  searchBoxContainer.appendChild(searchBox);
}
