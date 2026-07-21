import { getSearchSources, putSearchSources } from "@/lib/server/searchRoute";

export function getAddressSearchSources() {
  return getSearchSources("address");
}

export function saveAddressSearchSources(request: Request) {
  return putSearchSources(request, "address");
}
