import { jsonResponse } from "@/lib/server/files";
import {
  createPdfOverlay,
  getMapEditorSchema,
  listGeometryLayers,
  listMapSearchSources,
  listMapSources,
  listPdfOverlays,
  queryConfiguredMapSource,
  renderTerrainTile,
  updateGeometryLayers,
  updateMapSearchSources,
  updateMapSources,
  updatePdfOverlays
} from "./service";

export function GET(request: Request) {
  switch (getResource(request)) {
    case "schema":
      return getMapEditorSchema(new URL(request.url).searchParams.get("target") || "item");
    case "geometry":
      return listGeometryLayers();
    case "overlay":
      return listPdfOverlays();
    case "suggest":
    case "retrieve":
      return jsonResponse({ error: `${getResource(request)} is not implemented for map.` }, { status: 501 });
    case "sources":
      return listMapSearchSources();
    case "terrain":
      return renderTerrainTile(request);
    default:
      return listMapSources();
  }
}

export function POST(request: Request) {
  switch (getResource(request)) {
    case "overlay":
      return createPdfOverlay(request);
    case "query":
      return queryConfiguredMapSource(request);
    default:
      return jsonResponse({ error: "Unsupported map operation." }, { status: 400 });
  }
}

export function PUT(request: Request) {
  switch (getResource(request)) {
    case "geometry":
      return updateGeometryLayers(request);
    case "overlay":
      return updatePdfOverlays(request);
    case "sources":
      return request.json().then((body) => Array.isArray(body) ? updateMapSearchSources(body) : jsonResponse({ error: "Map search sources payload must be an array." }, { status: 400 }));
    default:
      return request.json().then((body) => Array.isArray(body) ? updateMapSources(body) : jsonResponse({ error: "Map payload must be an array." }, { status: 400 }));
  }
}

function getResource(request: Request) {
  return new URL(request.url).searchParams.get("resource") || "";
}
