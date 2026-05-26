import { getMapboxAccessToken, isDevModeEnabled, STATEN_ISLAND_BBOX, STATEN_ISLAND_CENTER } from "./config.js";
import { getSearchResultCoordinates } from "./pluto.js";

let selectedPlace;

export function createPlaceSearchBox(map, onRetrieve) {
  console.log("DEBUG")
  if (isDevModeEnabled()) {
    return createSeedSearchBox(map, onRetrieve);
  }

  if (!map) {
    return createSearchUnavailableMessage("Mapbox map could not be initialized. Check VITE_MAPBOX_ACCESS_TOKEN and restart dev server.");
  }

  const searchBox = new mapboxsearch.MapboxSearchBox();

  searchBox.accessToken = getMapboxAccessToken();
  searchBox.placeholder = "Search address or place";
  searchBox.theme = {
    variables: {
      border: "#c9ced6",
      borderRadius: "4px",
      boxShadow: "none",
      colorBackground: "#ffffff",
      colorBackgroundHover: "#f7f8fa",
      colorPrimary: "#2f6fed",
      colorText: "#1f2933",
      fontFamily: "Arial, Helvetica, sans-serif",
      unit: "14px"
    }
  };
  searchBox.mapboxgl = mapboxgl;
  searchBox.marker = true;
  searchBox.options = {
    bbox: STATEN_ISLAND_BBOX,
    country: "US",
    language: "en",
    limit: 6,
    proximity: STATEN_ISLAND_CENTER
  };
  searchBox.componentOptions = {
    flyTo: {
      zoom: 15,
      speed: 1.2
    }
  };

  searchBox.bindMap(map);
  searchBox.addEventListener("retrieve", (event) => {
    selectedPlace = event.detail;
    onRetrieve(selectedPlace);
  });

  return searchBox;
}

function createSearchUnavailableMessage(text) {
  const message = document.createElement("p");
  message.className = "seed-search-status";
  message.textContent = text;
  return message;
}

function createSeedSearchBox(map, onRetrieve) {
  const container = document.createElement("div");
  const select = document.createElement("select");
  const status = document.createElement("p");
  const fileInput = document.createElement("input");

  container.className = "seed-search";
  select.className = "seed-search-select";
  select.disabled = true;
  fileInput.className = "seed-search-file";
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.hidden = true;
  status.className = "seed-search-status";
  status.textContent = "Loading seed data...";
  select.appendChild(createSeedOption("", "Select seed result"));
  container.append(select, status, fileInput);

  fetch("/resources/seed.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Seed data failed with status ${response.status}`);
      }

      return response.text();
    })
    .then(loadSeedText)
    .catch((error) => {
      console.error(error);
      fileInput.hidden = false;
      status.textContent = `Dev mode is on, but /resources/seed.json could not be loaded: ${error.message}. Select seed.json manually.`;
    });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];

    if (!file) {
      return;
    }

    file.text()
      .then(loadSeedText)
      .catch((error) => {
        console.error(error);
        status.textContent = `Could not read selected seed file: ${error.message}`;
      });
  });

  select.addEventListener("change", () => {
    const result = select.seedResults && select.seedResults[Number(select.value)];

    if (!result) {
      return;
    }

    selectedPlace = result;
    flyToSeedResult(map, result);
    onRetrieve(selectedPlace);
  });

  function loadSeedText(seedText) {
    const seedData = seedText.trim() ? JSON.parse(seedText) : [];
    const results = normalizeSeedResults(seedData);
    select.seedResults = results;
    select.disabled = results.length === 0;
    select.replaceChildren(createSeedOption("", "Select seed result"));
    status.textContent = results.length === 0
      ? "Dev mode is on. Add search results to public/resources/seed.json."
      : "Dev mode is on. Mapbox Search is bypassed.";

    results.forEach((result, index) => {
      select.appendChild(createSeedOption(String(index), getSeedResultLabel(result, index)));
    });
  }

  return container;
}

function normalizeSeedResults(seedData) {
  if (Array.isArray(seedData)) {
    return seedData.map(normalizeSeedResult).filter(Boolean);
  }

  if (seedData && Array.isArray(seedData.searchResults)) {
    return seedData.searchResults.map(normalizeSeedResult).filter(Boolean);
  }

  const result = normalizeSeedResult(seedData);

  if (result) {
    return [result];
  }

  return [];
}

function normalizeSeedResult(seedResult) {
  if (!seedResult) {
    return null;
  }

  if (seedResult.response) {
    return normalizeSeedResult(seedResult.response);
  }

  if (Array.isArray(seedResult.features)) {
    return seedResult;
  }

  return null;
}

function createSeedOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function getSeedResultLabel(searchResult, index) {
  const feature = searchResult.features && searchResult.features[0];
  const properties = feature && feature.properties ? feature.properties : {};

  return properties.full_address || properties.name || properties.address || `Seed result ${index + 1}`;
}

function flyToSeedResult(map, searchResult) {
  if (!map) {
    return;
  }

  const coordinates = getSearchResultCoordinates(searchResult);

  if (coordinates) {
    map.flyTo({
      center: coordinates,
      zoom: 15,
      speed: 1.2
    });
  }
}

function clearSelectedPlace() {
  selectedPlace = null;
}
