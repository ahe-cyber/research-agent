import { getMapboxAccessToken, STATEN_ISLAND_BOUNDS } from "./config";
import { BasemapControl, getBasemaps, getSceneLayers, getStyle, getTerrain } from "./basemaps";
import { SceneLayersControl } from "./sceneLayers";
import { TerrainControl } from "./terrain";

export async function createMap() {
  const accessToken = getMapboxAccessToken();
  const basemaps = await getBasemaps();
  const sceneLayers = await getSceneLayers();
  const terrain = await getTerrain();
  const defaultBasemap = basemaps[0];
  const initialStyle = await getStyle(defaultBasemap);

  const map = new maplibregl.Map({
    container: "map",
    style: initialStyle,
    bounds: STATEN_ISLAND_BOUNDS,
    fitBoundsOptions: { padding: 36 },
    maxZoom: defaultBasemap.maxZoom,
    ...(accessToken && { transformRequest: buildMapboxTransform(accessToken) })
  });

  map.addControl(new maplibregl.NavigationControl());
  const basemapOptions = document.getElementById("mapBasemapOptions");
  if (basemapOptions) {
    basemapOptions.appendChild(new BasemapControl(basemaps).onAdd(map));
  }
  if (sceneLayers[0]) {
    const detailOptions = document.getElementById("mapDetailOptions");
    if (detailOptions) {
      detailOptions.appendChild(new SceneLayersControl(sceneLayers[0]).onAdd(map));
    }
  }
  map.on("error", (event: any) => {
    console.error("[Map App] MapLibre error", event.error || event);
  });
  if (terrain) {
    const detailOptions = document.getElementById("mapDetailOptions");
    if (detailOptions) {
      detailOptions.prepend(new TerrainControl(terrain).onAdd(map));
    }
  }

  return map;
}

// Converts mapbox:// protocol URLs to Mapbox REST API HTTPS URLs and appends
// the access token to all api.mapbox.com requests.
function buildMapboxTransform(accessToken: string) {
  return (url: string) => {
    if (url.startsWith("mapbox://")) {
      return { url: resolveMapboxUrl(url, accessToken) };
    }
    if (/api\.mapbox\.com|events\.mapbox\.com/.test(url)) {
      if (url.includes("access_token=")) return;
      const sep = url.includes("?") ? "&" : "?";
      return { url: `${url}${sep}access_token=${accessToken}` };
    }
  };
}

function resolveMapboxUrl(url: string, accessToken: string) {
  const path = url.slice(9); // strip 'mapbox://'
  let apiUrl;
  if (path.startsWith("fonts/")) {
    apiUrl = `https://api.mapbox.com/fonts/v1/${path.slice(6)}`;
  } else if (path.startsWith("sprites/")) {
    const spritePath = path.slice(8);
    const match = spritePath.match(/^(.+?)(@2x)?\.(json|png)$/);
    if (match) {
      apiUrl = `https://api.mapbox.com/styles/v1/${match[1]}/sprite${match[2] || ""}.${match[3]}`;
    } else {
      apiUrl = `https://api.mapbox.com/styles/v1/${spritePath}/sprite`;
    }
  } else {
    apiUrl = `https://api.mapbox.com/v4/${path}.json`;
  }
  return `${apiUrl}?access_token=${accessToken}`;
}
