import { jsonResponse } from "@/lib/server/files";
import {
  findDatasetCatalogItems,
  listDatasetSearchSources,
  listDatasetSources,
  updateDatasetSearchSources,
  updateDatasetSources
} from "./service";

export function GET(request: Request) {
  return isSearchRequest(request) ? listDatasetSearchSources() : listDatasetSources();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return isSearchRequest(request)
    ? findDatasetCatalogItems(body)
    : jsonResponse({ error: "Unsupported dataset operation." }, { status: 400 });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Dataset payload must be an array." }, { status: 400 });
  }
  return isSearchRequest(request) ? updateDatasetSearchSources(body) : updateDatasetSources(body);
}

function isSearchRequest(request: Request) {
  return new URL(request.url).searchParams.get("resource") === "search";
}
