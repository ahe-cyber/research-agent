import type {
  DatasetCatalogSearchOptions,
  DatasetCatalogSearchResult,
  DatasetCatalogSearchTarget
} from "../../dataset.schema";

export async function searchArcGisCatalog(
  catalog: DatasetCatalogSearchTarget,
  query: string,
  limit: number,
  options: DatasetCatalogSearchOptions
): Promise<DatasetCatalogSearchResult[]> {
  const base = String(catalog.url).replace(/\/$/, "");
  const host = new URL(base).hostname;
  const isHubSite = /(^|\.)hub\.arcgis\.com$/i.test(host) || /data\.gis\.ny\.gov$/i.test(host);
  return isHubSite
    ? searchArcGisHubCatalog(base, query, limit)
    : searchArcGisPortalCatalog(base, query, limit, options);
}

async function searchArcGisHubCatalog(
  base: string,
  query: string,
  limit: number
): Promise<DatasetCatalogSearchResult[]> {
  const url = new URL(`${base}/api/search/v1/collections/dataset/items`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`ArcGIS Hub search returned ${response.status}`);
  const data = await response.json();
  const features = Array.isArray(data.features) ? data.features : [];
  return features.map((feature: any) => {
    const props = feature.properties || {};
    const links = Array.isArray(feature.links) ? feature.links : [];
    const self = links.find((link: any) => link.rel === "self")?.href;
    return {
      id: feature.id || props.id || props.slug || props.name,
      title: props.name || props.title || "Untitled dataset",
      snippet: stripHtml(props.description || props.summary || ""),
      url: props.url || props.itemUrl || self || "",
      type: props.type || "Dataset",
      portalType: "ArcGIS Hub",
      owner: props.owner || props.source || ""
    };
  });
}

async function searchArcGisPortalCatalog(
  base: string,
  query: string,
  limit: number,
  options: DatasetCatalogSearchOptions
): Promise<DatasetCatalogSearchResult[]> {
  const url = new URL(`${base}/sharing/rest/search`);
  url.searchParams.set("f", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("filter", `type:"Feature Service"`);
  url.searchParams.set("num", String(limit));
  if (options.bbox) url.searchParams.set("bbox", options.bbox);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`ArcGIS search returned ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "ArcGIS search failed");
  const items = Array.isArray(data.results) ? data.results : [];
  return items.map((item: any) => ({
    id: item.id,
    title: item.title || "Untitled dataset",
    snippet: stripHtml(item.snippet || item.description || ""),
    url: item.url || `${base}/home/item.html?id=${item.id}`,
    type: item.type || "Dataset",
    portalType: "ArcGIS",
    owner: item.owner || ""
  }));
}

function stripHtml(value: string) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
