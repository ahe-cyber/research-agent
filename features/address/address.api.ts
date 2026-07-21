import { withBasePath } from "@/lib/basePath";
import type { AddressSearchSource } from "./address.schema";

export function getAddressSearchSources() {
  return fetch(withBasePath("/api/address"));
}

export function saveAddressSearchSources(sources: AddressSearchSource[]) {
  return fetch(withBasePath("/api/address"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources)
  });
}

export function getAddressGeoSearchSuggestions(params: URLSearchParams) {
  return fetch(withBasePath(`/api/address?resource=geosearch&${params}`));
}
