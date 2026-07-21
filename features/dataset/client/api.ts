import { withBasePath } from "@/lib/basePath";

export function getDatasetSources() {
  return fetch(withBasePath("/api/dataset"));
}

export function saveDatasetSources(sources: unknown[]) {
  return fetch(withBasePath("/api/dataset"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources)
  });
}

export function getDatasetSearchSources() {
  return fetch(withBasePath("/api/dataset?resource=search"));
}

export function saveDatasetSearchSources(sources: unknown[]) {
  return fetch(withBasePath("/api/dataset?resource=search"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources)
  });
}

export function findDatasetCatalogItems(catalog: unknown, query: string, limit = 5) {
  return fetch(withBasePath("/api/dataset?resource=search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catalog, query, limit })
  });
}
