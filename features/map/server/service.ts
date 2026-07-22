import { jsonResponse } from "@/lib/server/files";
import { getGeometryLayers, saveGeometryLayers } from "./providers/drawnGeometries";
import { getMapSources } from "./repository";
import { queryMapSource } from "./providers/geojson";
import { getPdfOverlays, savePdfOverlays, uploadPdfOverlay } from "./providers/pdfOverlay";
import { getTerrainTile } from "./providers/terrainTile";

export async function listMapSources() {
  return jsonResponse(await getMapSources());
}

export function listGeometryLayers() {
  return getGeometryLayers();
}

export function updateGeometryLayers(request: Request) {
  return saveGeometryLayers(request);
}

export function listPdfOverlays() {
  return getPdfOverlays();
}

export function createPdfOverlay(request: Request) {
  return uploadPdfOverlay(request);
}

export function updatePdfOverlays(request: Request) {
  return savePdfOverlays(request);
}

export function queryConfiguredMapSource(request: Request) {
  return queryMapSource(request);
}

export function renderTerrainTile(request: Request) {
  return getTerrainTile(request);
}
