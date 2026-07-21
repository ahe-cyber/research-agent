import { jsonResponse } from "@/lib/server/files";
import {
  createPdfOverlay,
  listGeometryLayers,
  listMapSources,
  listPdfOverlays,
  queryConfiguredMapSource,
  renderTerrainTile,
  updateGeometryLayers,
  updatePdfOverlays
} from "./service";

export function GET(request: Request) {
  switch (getResource(request)) {
    case "geometry":
      return listGeometryLayers();
    case "overlay":
      return listPdfOverlays();
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
    default:
      return jsonResponse({ error: "Unsupported map operation." }, { status: 400 });
  }
}

function getResource(request: Request) {
  return new URL(request.url).searchParams.get("resource") || "";
}
