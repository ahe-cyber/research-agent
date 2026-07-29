import { findDatasetCatalogItems } from "./dataset.api";
import type { DatasetCatalogSearchResult, DatasetSearchSource } from "./dataset.schema";

export type SearchCatalog = DatasetSearchSource;
export type CatalogSearchResult = DatasetCatalogSearchResult;

export async function searchCatalog(catalog: SearchCatalog, query: string, limit = 5): Promise<CatalogSearchResult[]> {
  const response = await findDatasetCatalogItems(catalog, query, limit);

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Catalog search returned ${response.status}`);
  }
  return Array.isArray(data.results) ? data.results : [];
}
