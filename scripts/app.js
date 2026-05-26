let sourceController;
let recordController;
let addressController;

async function handlePlaceRetrieved(searchResult) {
  addressController.add(searchResult);
  const outputVariables = sourceController.assignMapboxSearchOutputs(searchResult);

  recordController.add({
    kind: "Search",
    title: "Mapbox search result",
    response: searchResult,
    timestamp: new Date().toISOString(),
    payload: {
      response: searchResult,
      outputVariables
    }
  });
}

async function initializeApp() {
  await loadMapAppEnv();

  const map = createMap();
  const searchBoxContainer = document.getElementById("placeSearchBox");
  const recordStore = createRecordStore();
  const assetController = createAssetController();
  recordController = createRecordController(recordStore, assetController, map);
  addressController = createAddressController();
  sourceController = createSourceController(recordController);
  createAgentController(recordStore);
  setupWorkspaceTabs();

  const searchBox = createPlaceSearchBox(map, handlePlaceRetrieved);

  searchBoxContainer.appendChild(searchBox);
}

initializeApp();
