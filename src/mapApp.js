import { createAgentController } from "./agent/AgentPanel.jsx";
import { createMap } from "./map/map.js";
import { createPlaceSearchBox } from "./map/search.js";
import { createAddressController } from "./workspace/AddressTab.jsx";
import { createRecordController, createRecordStore } from "./workspace/DetailsTab.jsx";
import { createEditorTabController } from "./workspace/EditorTabs.js";
import { createFormulaController } from "./workspace/FormulasTab.jsx";
import { createPostmanController } from "./workspace/PostmanTab.js";
import { createSourceController } from "./workspace/SourcesTab.jsx";

let sourceController;
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
  const formulaController = createFormulaController();
  const editorTabController = createEditorTabController();
  recordController = createRecordController(recordStore, map, editorTabController);
  addressController = createAddressController();
  agentController = createAgentController();
  sourceController = createSourceController(recordController, formulaController, editorTabController, agentController);
  createPostmanController(editorTabController);

  const searchBox = createPlaceSearchBox(map, handlePlaceRetrieved);
  searchBoxContainer.appendChild(searchBox);
}
