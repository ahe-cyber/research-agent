import { jsonResponse } from "@/lib/server/files";
import {
  findDatasetCatalogItems,
  getDatasetEditorSchema,
  listDatasetSearchSources,
  listDatasetData,
  suggestDatasetSearch,
  updateDatasetSearchSources,
  updateDatasetData
} from "./service";

export function GET(request: Request) {
  const resource = getResource(request);
  if (resource === "suggest") return suggestDatasetSearch(new URL(request.url).searchParams);
  if (resource === "retrieve") return jsonResponse({ error: "retrieve is not implemented for dataset." }, { status: 501 });
  if (resource === "schema") return getDatasetEditorSchema(new URL(request.url).searchParams.get("target") || "item");
  return resource === "sources" ? listDatasetSearchSources() : listDatasetData();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return getResource(request) === "suggest"
    ? findDatasetCatalogItems(body)
    : jsonResponse({ error: "Unsupported dataset operation." }, { status: 400 });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Dataset payload must be an array." }, { status: 400 });
  }
  return isSearchRequest(request) ? updateDatasetSearchSources(body) : updateDatasetData(body);
}

function isSearchRequest(request: Request) {
  return getResource(request) === "sources";
}

function getResource(request: Request) {
  return new URL(request.url).searchParams.get("resource") || "";
}
