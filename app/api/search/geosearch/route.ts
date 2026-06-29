import { jsonResponse } from "../../_lib/files";
import { STATEN_ISLAND_CENTER } from "../../../../features/map/config";

const AUTOCOMPLETE_URL = "https://geosearch.planninglabs.nyc/v2/autocomplete";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const text = (requestUrl.searchParams.get("text") || "").trim();
  const size = Math.max(1, Math.min(Number(requestUrl.searchParams.get("size")) || 6, 10));
  const focusLat = Number(requestUrl.searchParams.get("focus.point.lat"));
  const focusLon = Number(requestUrl.searchParams.get("focus.point.lon"));

  if (!text) {
    return jsonResponse({ features: [] });
  }

  const url = new URL(AUTOCOMPLETE_URL);
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
