import { readFile } from "node:fs/promises";
import { dataPath, jsonResponse, writeJsonFile } from "../_lib/files";
import { isCatalogRegistry, normalizeCatalogRegistry } from "../_lib/searchRegistries";
import { SearchCatalog, searchCatalog } from "../_services/catalogSearch";

const searchPath = dataPath("search.json");
const SUPPORTED_FEATURES = new Set(["address", "dataset"]);

export async function GET(request: Request) {
  const feature = getFeature(request);
  if (!feature) {
    return jsonResponse({ error: "Search feature must be one of: address, dataset." }, { status: 400 });
  }

  try {
    const searchItems = JSON.parse(await readFile(searchPath, "utf8"));
    const featureItems = Array.isArray(searchItems) ? searchItems.filter((item) => getSearchItemFeature(item) === feature) : [];
    return jsonResponse(feature === "dataset" ? normalizeCatalogRegistry(featureItems) : featureItems);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to read search items." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const feature = getFeature(request);
  if (feature !== "dataset") {
    return jsonResponse({ error: "Catalog search is only supported for feature=dataset." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const catalog = body?.catalog as SearchCatalog | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const limit = Math.max(1, Math.min(Number(body?.limit) || 5, 10));

  if (!catalog?.url || !query) {
    return jsonResponse({ results: [] });
  }

  try {
    return jsonResponse({ results: await searchCatalog(catalog, query, limit) });
  } catch (error) {
    console.error("[Catalog search] Failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Catalog search failed." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const feature = getFeature(request);
  if (!feature) {
    return jsonResponse({ error: "Search feature must be one of: address, dataset." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Search sources payload must be an array." }, { status: 400 });
  }

  if (feature === "dataset" && !isCatalogRegistry(body)) {
    return jsonResponse({ error: "Dataset search items must be an array of catalog entries." }, { status: 400 });
  }

  try {
    let searchItems: unknown[] = [];
    try {
      const existing = JSON.parse(await readFile(searchPath, "utf8"));
      searchItems = Array.isArray(existing) ? existing : [];
    } catch {}

    const normalizedItems = feature === "dataset" ? normalizeCatalogRegistry(body) : body;
    await writeJsonFile(searchPath, [
      ...searchItems.filter((item: any) => getSearchItemFeature(item) !== feature),
      ...normalizedItems.map((item: any) => {
        const { activity, ...rest } = item;
        return { ...rest, feature };
      })
    ]);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to write search sources." }, { status: 500 });
  }
}

function getFeature(request: Request) {
  const params = new URL(request.url).searchParams;
  const feature = params.get("feature") || params.get("activity") || "";
  return SUPPORTED_FEATURES.has(feature) ? feature : "";
}

function getSearchItemFeature(item: any) {
  return item?.feature || item?.activity || "";
}
