import { getMapboxAccessToken, STATEN_ISLAND_BOUNDS } from "./config.js";

export function createMap() {
  const accessToken = getMapboxAccessToken();

  if (!accessToken) {
    throw new Error("Missing VITE_MAPBOX_ACCESS_TOKEN. Update .env and restart npm run dev.");
  }

  mapboxgl.accessToken = accessToken;

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    bounds: STATEN_ISLAND_BOUNDS,
    fitBoundsOptions: {
      padding: 36
    }
  });

  map.addControl(new mapboxgl.NavigationControl());
  map.on("error", (event) => {
    console.error("[Map App] Mapbox error", event.error || event);
  });

  // Future feature: clip the map to Staten Island without blocking zooming back to the fitted view.

  return map;
}
