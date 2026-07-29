import { withBasePath } from "@/lib/basePath";
import type { AddressItem, AddressSearchSource } from "./address.schema";

export function getAddressData() {
  return fetch(withBasePath("/api/address"));
}

export function saveAddressData(addresses: AddressItem[]) {
  return fetch(withBasePath("/api/address"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(addresses)
  });
}

export function getAddressSearchSources() {
  return fetch(withBasePath("/api/address?resource=sources"));
}

export function saveAddressSearchSources(sources: AddressSearchSource[]) {
  return fetch(withBasePath("/api/address?resource=sources"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources)
  });
}

export function getAddressGeoSearchSuggestions(params: URLSearchParams) {
  return fetch(withBasePath(`/api/address?resource=geosearch&${params}`));
}

export function getAddressSuggestions(params: URLSearchParams) {
  return fetch(withBasePath(`/api/address?resource=suggest&${params}`));
}

export function retrieveAddressSuggestion(params: URLSearchParams) {
  return fetch(withBasePath(`/api/address?resource=retrieve&${params}`));
}
