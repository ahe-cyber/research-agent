import { jsonResponse } from "@/lib/server/files";
import {
  listAddressSearchSources,
  suggestAddressFromGeoSearch,
  updateAddressSearchSources
} from "./service";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return params.get("resource") === "geosearch"
    ? suggestAddressFromGeoSearch(params)
    : listAddressSearchSources();
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Search sources payload must be an array." }, { status: 400 });
  }
  return updateAddressSearchSources(body);
}
