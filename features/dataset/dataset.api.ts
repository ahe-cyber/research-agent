import { withBasePath } from "@/lib/basePath";
import type { DatasetSearchSource } from "./dataset.schema";

export function getDatasetData() {
  return fetch(withBasePath("/api/dataset"));
}

export function saveDatasetData(data: unknown[]) {
  return fetch(withBasePath("/api/dataset"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function getDatasetSearchSources() {
  return fetch(withBasePath("/api/dataset?resource=sources"));
}

export function saveDatasetSearchSources(sources: unknown[]) {
  return fetch(withBasePath("/api/dataset?resource=sources"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources)
  });
}

export function findDatasetCatalogItems(catalog: DatasetSearchSource, query: string, limit = 5) {
  return fetch(withBasePath("/api/dataset?resource=suggest"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catalog, query, limit })
  });
}

export function getDatasetSuggestions(params: URLSearchParams) {
  return fetch(withBasePath(`/api/dataset?resource=suggest&${params}`));
}
