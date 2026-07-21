export interface SearchCatalog {
  id?: string;
  name?: string;
  url?: string;
  type?: "arcgis" | "socrata";
}

export async function searchCatalog(catalog: SearchCatalog, query: string, limit: number) {
  const type = catalog.type === "socrata" ? "socrata" : "arcgis";
  const results = type === "socrata"
    ? await searchSocrata(catalog, query, limit)
    : await searchArcGIS(catalog, query, limit);
  return results.map((item) => ({ ...item, catalogName: catalog.name || "Catalog" }));
}

async function searchArcGIS(catalog: SearchCatalog, query: string, limit: number) {
  const base = String(catalog.url).replace(/\/$/, "");
  const host = new URL(base).hostname;
  const isHubSite = /(^|\.)hub\.arcgis\.com$/i.test(host) || /data\.gis\.ny\.gov$/i.test(host);
  return isHubSite
    ? searchArcGISHub(base, query, limit)
    : searchArcGISPortal(base, query, limit);
}

async function searchArcGISHub(base: string, query: string, limit: number) {
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

async function searchArcGISPortal(base: string, query: string, limit: number) {
  const url = new URL(`${base}/sharing/rest/search`);
  url.searchParams.set("f", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("filter", `type:"Feature Service"`);
  url.searchParams.set("num", String(limit));
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

async function searchSocrata(catalog: SearchCatalog, query: string, limit: number) {
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
