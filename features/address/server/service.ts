import { jsonResponse } from "@/lib/server/files";
import { STATEN_ISLAND_CENTER } from "@/features/map/config";
import type { AddressSearchSource } from "../address.schema";
import { getAddressSearchSources, getGeoSearchSource, saveAddressSearchSources } from "./repository";

export async function listAddressSearchSources() {
  return jsonResponse(await getAddressSearchSources());
}

export async function updateAddressSearchSources(sources: AddressSearchSource[]) {
  await saveAddressSearchSources(sources);
  return jsonResponse({ ok: true });
}

export async function suggestAddressFromGeoSearch(params: URLSearchParams) {
  const text = (params.get("text") || "").trim();
  const size = Math.max(1, Math.min(Number(params.get("size")) || 6, 10));
  const focusLat = Number(params.get("focus.point.lat"));
  const focusLon = Number(params.get("focus.point.lon"));

  if (!text) {
    return jsonResponse({ features: [] });
  }

  const source = await getGeoSearchSource();
  if (!source?.url) {
    return jsonResponse({ error: "NYC GeoSearch source is not configured." }, { status: 500 });
  }

  const url = new URL(source.url);
  url.searchParams.set("text", text);
  url.searchParams.set("focus.point.lat", String(Number.isFinite(focusLat) ? focusLat : STATEN_ISLAND_CENTER[1]));
  url.searchParams.set("focus.point.lon", String(Number.isFinite(focusLon) ? focusLon : STATEN_ISLAND_CENTER[0]));
  url.searchParams.set("size", String(size));

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return jsonResponse({ features: [] }, { status: response.status });
    }
    return jsonResponse(await response.json());
  } catch (error) {
    console.error("[GeoSearch] Autocomplete failed", error);
    return jsonResponse({ features: [] }, { status: 502 });
  }
}
