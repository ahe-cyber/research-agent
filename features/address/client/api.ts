import { withBasePath } from "@/lib/basePath";

export function getAddressSearchSources() {
  return fetch(withBasePath("/api/address"));
}

export function saveAddressSearchSources(sources: unknown[]) {
  return fetch(withBasePath("/api/address"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources)
  });
}

export function getAddressGeoSearchSuggestions(params: URLSearchParams) {
  return fetch(withBasePath(`/api/address?resource=geosearch&${params}`));
}
