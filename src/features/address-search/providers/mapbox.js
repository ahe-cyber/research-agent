import { getMapboxAccessToken, STATEN_ISLAND_BBOX, STATEN_ISLAND_CENTER } from "../../map/config.js";

export function createPlaceSearchBox(map, onRetrieve, initialValue = "") {
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
  searchBox.mapboxgl = maplibregl;
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

  if (map) searchBox.bindMap(map);
  searchBox.addEventListener("retrieve", (event) => {
    onRetrieve(event.detail);
  });
  searchBox.addEventListener("focusin", () => {
    const text = searchBox.value.trim();
    if (text) searchBox.search(text);
  });
  queueMicrotask(() => {
    searchBox.value = initialValue;
  });

  return searchBox;
}
