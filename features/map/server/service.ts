import { jsonResponse } from "@/lib/server/files";
import { editorSchemaResponse } from "@/lib/server/editorSchema";
import { mapItemEditorFields, mapSearchSourceEditorFields } from "../map.schema";
import { getGeometryLayers, saveGeometryLayers } from "./providers/drawnGeometries";
import { getMapSearchSources, getMapSources, saveMapSearchSources, saveMapSources } from "./repository";
import { queryMapSource } from "./providers/geojson";
import { getPdfOverlays, savePdfOverlays, uploadPdfOverlay } from "./providers/pdfOverlay";
import { getTerrainTile } from "./providers/terrainTile";

export async function listMapSources() {
  return jsonResponse(await getMapSources());
}

export function getMapEditorSchema(target: string) {
  return editorSchemaResponse(target, {
    item: mapItemEditorFields,
    searchSource: mapSearchSourceEditorFields
  });
}

export async function listMapSearchSources() {
  return jsonResponse(await getMapSearchSources());
}

export async function updateMapSources(sources: unknown[]) {
  await saveMapSources(sources);
  return jsonResponse({ ok: true });
}

export async function updateMapSearchSources(sources: unknown[]) {
  await saveMapSearchSources(sources);
  return jsonResponse({ ok: true });
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
