import { STATEN_ISLAND_CENTER } from "@/features/map/config";
import { jsonResponse } from "@/lib/server/files";
import type { AddressSearchSource } from "../../address.schema";

const SUGGEST_URL = "https://api.mapbox.com/search/searchbox/v1/suggest";
const RETRIEVE_URL = "https://api.mapbox.com/search/searchbox/v1/retrieve";

export async function suggestMapboxSearch(source: AddressSearchSource, params: URLSearchParams) {
  const query = (params.get("q") || "").trim();
  const accessToken = (params.get("access_token") || source.apiKey || "").trim();
  const sessionToken = (params.get("session_token") || "").trim();
  const limit = Math.max(1, Math.min(Number(params.get("limit")) || 6, 10));

  if (!query) return jsonResponse({ suggestions: [] });
  if (!accessToken) return jsonResponse({ error: "Mapbox access token is required." }, { status: 400 });
  if (!sessionToken) return jsonResponse({ error: "Mapbox session_token is required." }, { status: 400 });

  const url = new URL(SUGGEST_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("proximity", STATEN_ISLAND_CENTER.join(","));
  url.searchParams.set("country", "US");

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) {
      return jsonResponse({ error: `Mapbox Search Box returned ${response.status}.` }, { status: response.status });
    }

    const data = await response.json();
    const suggestions = (Array.isArray(data.suggestions) ? data.suggestions : [])
      .map((suggestion: any) => ({
        id: suggestion.mapbox_id || suggestion.id || suggestion.name,
        name: suggestion.name || suggestion.full_address || "Mapbox result",
        description: suggestion.full_address || suggestion.place_formatted || suggestion.address || "Mapbox Search",
        sourceId: source.id,
        raw: suggestion
      }));

    return jsonResponse({ suggestions });
  } catch (error) {
    console.error("[Mapbox Search] Suggest failed", error);
    return jsonResponse({ error: "Mapbox suggestion failed." }, { status: 502 });
  }
}

export async function retrieveMapboxSearch(source: AddressSearchSource, params: URLSearchParams) {
  const id = (params.get("id") || "").trim();
  const accessToken = (params.get("access_token") || source.apiKey || "").trim();
  const sessionToken = (params.get("session_token") || "").trim();

  if (!id) return jsonResponse({ error: "Mapbox suggestion id is required." }, { status: 400 });
  if (!accessToken) return jsonResponse({ error: "Mapbox access token is required." }, { status: 400 });
  if (!sessionToken) return jsonResponse({ error: "Mapbox session_token is required." }, { status: 400 });

  const url = new URL(`${RETRIEVE_URL}/${encodeURIComponent(id)}`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("session_token", sessionToken);

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) {
      return jsonResponse({ error: `Mapbox retrieve returned ${response.status}.` }, { status: response.status });
    }

    const data = await response.json();
    return jsonResponse({
      item: {
        id,
        name: data.features?.[0]?.properties?.name || data.features?.[0]?.properties?.full_address || "Mapbox result",
        description: data.features?.[0]?.properties?.full_address || data.features?.[0]?.properties?.place_formatted || "Mapbox Search",
        sourceId: source.id,
        raw: data
      }
    });
  } catch (error) {
    console.error("[Mapbox Search] Retrieve failed", error);
    return jsonResponse({ error: "Mapbox retrieve failed." }, { status: 502 });
  }
}
