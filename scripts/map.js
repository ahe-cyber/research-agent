function createMap() {
  mapboxgl.accessToken = getMapboxAccessToken();

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    bounds: STATEN_ISLAND_BOUNDS,
    fitBoundsOptions: {
      padding: 36
    }
  });

  map.addControl(new mapboxgl.NavigationControl());

  // Future feature: clip the map to Staten Island without blocking zooming back to the fitted view.

  return map;
}
