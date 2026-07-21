import { dataPath, jsonResponse, readJsonFileResponse } from "@/lib/server/files";
import { getGeometryLayers, saveGeometryLayers } from "./geometryRoute";
import { getPdfOverlays, savePdfOverlays, uploadPdfOverlay } from "./overlayRoute";
import { queryMapSource } from "./queryRoute";
import { getTerrainTile } from "./terrainRoute";

const mapPath = dataPath("features", "map.json");

export function getMapRouteData(request: Request) {
  switch (getResource(request)) {
    case "geometry":
      return getGeometryLayers();
    case "overlay":
      return getPdfOverlays();
    case "terrain":
      return getTerrainTile(request);
    default:
      return getMapSources();
  }
}

export function postMapRouteData(request: Request) {
  switch (getResource(request)) {
    case "overlay":
      return uploadPdfOverlay(request);
    case "query":
      return queryMapSource(request);
    default:
      return jsonResponse({ error: "Unsupported map operation." }, { status: 400 });
  }
}

export function putMapRouteData(request: Request) {
  switch (getResource(request)) {
    case "geometry":
      return saveGeometryLayers(request);
    case "overlay":
      return savePdfOverlays(request);
    default:
      return jsonResponse({ error: "Unsupported map operation." }, { status: 400 });
  }
}

export async function getMapSources() {
  return readJsonFileResponse(mapPath, [], "Failed to read map sources.");
}

function getResource(request: Request) {
  return new URL(request.url).searchParams.get("resource") || "";
}
