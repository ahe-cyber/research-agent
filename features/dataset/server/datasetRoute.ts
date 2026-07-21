import { dataPath, jsonResponse, readJsonFileResponse, writeJsonFile } from "@/lib/server/files";
import { getDatasetSearchSources, saveDatasetSearchSources, findDatasetCatalogItems } from "./searchRoute";

const datasetPath = dataPath("features", "dataset.json");

export { findDatasetCatalogItems };

export function getDatasetRouteData(request: Request) {
  return isSearchRequest(request) ? getDatasetSearchSources() : getDatasetSources();
}

export function saveDatasetRouteData(request: Request) {
  return isSearchRequest(request) ? saveDatasetSearchSources(request) : saveDatasetSources(request);
}

export async function getDatasetSources() {
  return readJsonFileResponse(datasetPath, undefined, "Failed to read datasets.");
}

export async function saveDatasetSources(request: Request) {
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Dataset payload must be an array." }, { status: 400 });
  }

  try {
    await writeJsonFile(datasetPath, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write dataset." }, { status: 500 });
  }
}

function isSearchRequest(request: Request) {
  return new URL(request.url).searchParams.get("resource") === "search";
}
