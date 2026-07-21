import { getSearchSources, putSearchSources, searchDatasetCatalog } from "@/lib/server/searchRoute";

export function getDatasetSearchSources() {
  return getSearchSources("dataset");
}

export function findDatasetCatalogItems(request: Request) {
  return searchDatasetCatalog(request);
}

export function saveDatasetSearchSources(request: Request) {
  return putSearchSources(request, "dataset");
}
