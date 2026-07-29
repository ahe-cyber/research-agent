import { jsonResponse } from "@/lib/server/files";
import { editorSchemaResponse } from "@/lib/server/editorSchema";
import { addressItemEditorFields, addressSearchSourceEditorFields } from "../address.schema";
import type { AddressItem } from "../address.schema";
import type { AddressSearchSource } from "../address.schema";
import { retrieveGooglePlace, suggestGooglePlaces } from "./providers/googlePlaces";
import { retrieveMapboxSearch, suggestMapboxSearch } from "./providers/mapboxSearch";
import { suggestAddressFromGeoSearch } from "./providers/nycGeoSearch";
import { getAddressData, getAddressSearchSource, getAddressSearchSources, saveAddressData, saveAddressSearchSources } from "./repository";

export async function listAddressData() {
  return jsonResponse(await getAddressData());
}

export async function listAddressSearchSources() {
  return jsonResponse(await getAddressSearchSources());
}

export function getAddressEditorSchema(target: string) {
  return editorSchemaResponse(target, {
    item: addressItemEditorFields,
    searchSource: addressSearchSourceEditorFields
  });
}

export async function updateAddressSearchSources(sources: AddressSearchSource[]) {
  await saveAddressSearchSources(sources);
  return jsonResponse({ ok: true });
}

export async function updateAddressData(addresses: AddressItem[]) {
  await saveAddressData(addresses);
  return jsonResponse({ ok: true });
}

export async function suggestAddressSearch(params: URLSearchParams) {
  const sourceId = (params.get("source") || "").trim();
  const source = await getAddressSearchSource(sourceId);

  if (!source) {
    return jsonResponse({ error: `Unknown address search source: ${sourceId}` }, { status: 404 });
  }

  if (source.type === "geosearch") {
    const nextParams = new URLSearchParams(params);
    nextParams.set("text", params.get("q") || params.get("text") || "");
    const response = await suggestAddressFromGeoSearch(nextParams);
    const data = await response.json().catch(() => ({ features: [] }));
    if (!response.ok) {
      return jsonResponse(data, { status: response.status });
    }
    return jsonResponse({
      suggestions: (Array.isArray(data.features) ? data.features : []).map((feature: any) => ({
        id: feature.properties?.id || feature.properties?.gid || feature.properties?.label || feature.properties?.name || JSON.stringify(feature.geometry),
        name: feature.properties?.label || feature.properties?.name || "GeoSearch result",
        description: [
          feature.properties?.borough,
          feature.properties?.addendum?.pad?.bbl ? `BBL ${feature.properties.addendum.pad.bbl}` : "",
          feature.properties?.addendum?.pad?.bin ? `BIN ${feature.properties.addendum.pad.bin}` : ""
        ].filter(Boolean).join(" · "),
        sourceId,
        raw: feature
      }))
    });
  }

  if (source.type === "mapbox") {
    return suggestMapboxSearch(source, params);
  }

  if (source.type === "google") {
    return suggestGooglePlaces(source, params);
  }

  return jsonResponse({ suggestions: [] });
}

export async function retrieveAddressSearch(params: URLSearchParams) {
  const sourceId = (params.get("source") || "").trim();
  const source = await getAddressSearchSource(sourceId);

  if (!source) {
    return jsonResponse({ error: `Unknown address search source: ${sourceId}` }, { status: 404 });
  }

  if (source.type === "mapbox") {
    return retrieveMapboxSearch(source, params);
  }

  if (source.type === "google") {
    return retrieveGooglePlace(source, params);
  }

  return jsonResponse({ error: `${source.type} does not require retrieve.` }, { status: 400 });
}
