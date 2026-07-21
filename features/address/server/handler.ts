import { jsonResponse } from "@/lib/server/files";
import { addressSearchSourcesSchema } from "../address.schema";
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
  const result = addressSearchSourcesSchema.safeParse(body);
  if (!result.success) {
    return jsonResponse({ error: "Invalid address search sources payload.", issues: result.error.issues }, { status: 400 });
  }
  return updateAddressSearchSources(result.data);
}
