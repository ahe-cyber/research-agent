import { getMapboxAccessToken, STATEN_ISLAND_BOUNDS } from "./config.js";
import { BasemapControl, DEFAULT_BASEMAP, getStyle } from "./basemap.js";

export async function createMap() {
  const accessToken = getMapboxAccessToken();
  const initialStyle = await getStyle(DEFAULT_BASEMAP);

  const map = new maplibregl.Map({
    container: "map",
    style: initialStyle,
    bounds: STATEN_ISLAND_BOUNDS,
    fitBoundsOptions: { padding: 36 },
    maxZoom: DEFAULT_BASEMAP.maxZoom,
    ...(accessToken && { transformRequest: buildMapboxTransform(accessToken) })
  });

  map.addControl(new maplibregl.NavigationControl());
  map.addControl(new BasemapControl(), "bottom-left");
  map.on("error", (event) => {
    console.error("[Map App] MapLibre error", event.error || event);
  });

  return map;
}

// Converts mapbox:// protocol URLs to Mapbox REST API HTTPS URLs and appends
// the access token to all api.mapbox.com requests.
function buildMapboxTransform(accessToken) {
  return (url) => {
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

function resolveMapboxUrl(url, accessToken) {
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
