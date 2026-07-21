import { findDatasetCatalogItems } from "@/features/dataset/client/api";

export interface SearchCatalog {
  id: string;
  name: string;
  url: string;
  type?: "arcgis" | "socrata";
}

export interface CatalogSearchResult {
  id: string;
  title: string;
  snippet?: string;
  url?: string;
  type?: string;
  portalType?: string;
  owner?: string;
  catalogName?: string;
}

export async function searchCatalog(catalog: SearchCatalog, query: string, limit = 5): Promise<CatalogSearchResult[]> {
  const response = await findDatasetCatalogItems(catalog, query, limit);

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Catalog search returned ${response.status}`);
  }
  return Array.isArray(data.results) ? data.results : [];
}
