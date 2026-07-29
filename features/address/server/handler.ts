import { jsonResponse } from "@/lib/server/files";
import { addressItemsSchema, addressSearchSourcesSchema } from "../address.schema";
import { suggestAddressFromGeoSearch } from "./providers/nycGeoSearch";
import {
  listAddressData,
  listAddressSearchSources,
  getAddressEditorSchema,
  retrieveAddressSearch,
  suggestAddressSearch,
  updateAddressData,
  updateAddressSearchSources
} from "./service";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("resource") === "suggest") return suggestAddressSearch(params);
  if (params.get("resource") === "retrieve") return retrieveAddressSearch(params);
  if (params.get("resource") === "schema") return getAddressEditorSchema(params.get("target") || "item");
  if (params.get("resource") === "sources") return listAddressSearchSources();
  if (params.get("resource") === "geosearch") return suggestAddressFromGeoSearch(params);
  return listAddressData();
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (new URL(request.url).searchParams.get("resource") !== "sources") {
    const result = addressItemsSchema.safeParse(body);
    if (!result.success) {
      return jsonResponse({ error: "Invalid address data payload.", issues: result.error.issues }, { status: 400 });
    }
    return updateAddressData(result.data);
  }

  const result = addressSearchSourcesSchema.safeParse(body);
  if (!result.success) {
    return jsonResponse({ error: "Invalid address search sources payload.", issues: result.error.issues }, { status: 400 });
  }
  return updateAddressSearchSources(result.data);
}
