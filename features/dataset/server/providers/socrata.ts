import type { DatasetCatalogSearchResult, DatasetCatalogSearchTarget } from "../../dataset.schema";

export async function searchSocrataCatalog(
  catalog: DatasetCatalogSearchTarget,
  query: string,
  limit: number
): Promise<DatasetCatalogSearchResult[]> {
  const base = String(catalog.url).replace(/\/$/, "");
  const url = new URL(`${base}/api/catalog/v1`);
  url.searchParams.set("domains", new URL(base).hostname);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Socrata search returned ${response.status}`);
  const data = await response.json();
  const items = Array.isArray(data.results) ? data.results : [];
  return items.map((entry: any) => {
    const resource = entry.resource || {};
    const link = entry.permalink || entry.link || "";
    return {
      id: resource.id || link,
      title: resource.name || "Untitled dataset",
      snippet: stripHtml(resource.description || ""),
      url: link || `${base}/resource/${resource.id}`,
      type: resource.type || "Dataset",
      portalType: "Socrata",
      owner: resource.attribution || resource.owner?.display_name || ""
    };
  });
}

function stripHtml(value: string) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
