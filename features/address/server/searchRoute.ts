import { getSearchSources, putSearchSources } from "@/lib/server/searchRoute";
import { getAddressGeoSearchSuggestions } from "./geosearchRoute";

export function getAddressRouteData(request: Request) {
  return new URL(request.url).searchParams.get("resource") === "geosearch"
    ? getAddressGeoSearchSuggestions(request)
    : getAddressSearchSources();
}

export function saveAddressRouteData(request: Request) {
  return saveAddressSearchSources(request);
}

export function getAddressSearchSources() {
  return getSearchSources("address");
}

export function saveAddressSearchSources(request: Request) {
  return putSearchSources(request, "address");
}
