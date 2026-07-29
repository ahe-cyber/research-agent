import { jsonResponse } from "@/lib/server/files";
import type { AddressSearchSource } from "../../address.schema";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

export async function suggestGooglePlaces(source: AddressSearchSource, params: URLSearchParams) {
  const query = (params.get("q") || "").trim();
  const accessToken = (params.get("access_token") || source.apiKey || "").trim();
  const limit = Math.max(1, Math.min(Number(params.get("limit")) || 6, 10));

  if (!query) return jsonResponse({ suggestions: [] });
  if (!accessToken) return jsonResponse({ error: "Google Places access token is required." }, { status: 400 });

  try {
    const response = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": accessToken
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ["us"]
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      return jsonResponse({ error: `Google Places returned ${response.status}.` }, { status: response.status });
    }

    const data = await response.json();
    const suggestions = (Array.isArray(data.suggestions) ? data.suggestions : [])
      .map((item: any) => item.placePrediction)
      .filter(Boolean)
      .slice(0, limit)
      .map((prediction: any) => ({
        id: prediction.placeId || prediction.text?.text,
        name: prediction.text?.text || prediction.structuredFormat?.mainText?.text || "Google result",
        description: prediction.structuredFormat?.secondaryText?.text || "Google Places",
        sourceId: source.id,
        raw: prediction
      }));

    return jsonResponse({ suggestions });
  } catch (error) {
    console.error("[Google Places] Suggest failed", error);
    return jsonResponse({ error: "Google Places suggestion failed." }, { status: 502 });
  }
}

export async function retrieveGooglePlace(source: AddressSearchSource, params: URLSearchParams) {
  const id = (params.get("id") || "").trim();
  const accessToken = (params.get("access_token") || source.apiKey || "").trim();

  if (!id) return jsonResponse({ error: "Google place id is required." }, { status: 400 });
  if (!accessToken) return jsonResponse({ error: "Google Places access token is required." }, { status: 400 });

  const url = new URL(`${PLACE_DETAILS_URL}/${encodeURIComponent(id)}`);
  url.searchParams.set("fields", "id,location,displayName,formattedAddress,shortFormattedAddress");
  url.searchParams.set("key", accessToken);

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) {
      return jsonResponse({ error: `Google place details returned ${response.status}.` }, { status: response.status });
    }

    const data = await response.json();
    return jsonResponse({
      item: {
        id,
        name: data.displayName?.text || data.formattedAddress || "Google result",
        description: data.formattedAddress || data.shortFormattedAddress || "Google Places",
        sourceId: source.id,
        raw: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: data.location
                ? { type: "Point", coordinates: [data.location.longitude, data.location.latitude] }
                : null,
              properties: {
                full_address: data.formattedAddress || data.shortFormattedAddress || data.displayName?.text || "",
                name: data.displayName?.text || "",
                place_formatted: "Google Places",
                place_id: id
              }
            }
          ]
        }
      }
    });
  } catch (error) {
    console.error("[Google Places] Retrieve failed", error);
    return jsonResponse({ error: "Google Places retrieve failed." }, { status: 502 });
  }
}
