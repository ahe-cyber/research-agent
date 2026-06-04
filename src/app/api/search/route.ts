import { readFile } from "node:fs/promises";
import { dataPath, jsonResponse, writeJsonFile } from "../_lib/files";
import { isCatalogRegistry, normalizeCatalogRegistry } from "../_lib/searchRegistries";
import { SearchCatalog, searchCatalog } from "../_services/catalogSearch";

const searchPath = dataPath("search.json");
const SUPPORTED_ACTIVITIES = new Set(["address", "dataset"]);

export async function GET(request: Request) {
  const activity = getActivity(request);
  if (!activity) {
    return jsonResponse({ error: "Search activity must be one of: address, dataset." }, { status: 400 });
  }

  try {
    const searchItems = JSON.parse(await readFile(searchPath, "utf8"));
    const activityItems = Array.isArray(searchItems) ? searchItems.filter((item) => item.activity === activity) : [];
    return jsonResponse(activity === "dataset" ? normalizeCatalogRegistry(activityItems) : activityItems);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to read search items." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const activity = getActivity(request);
  if (activity !== "dataset") {
    return jsonResponse({ error: "Catalog search is only supported for activity=dataset." }, { status: 400 });
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
  const activity = getActivity(request);
  if (!activity) {
    return jsonResponse({ error: "Search activity must be one of: address, dataset." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Search sources payload must be an array." }, { status: 400 });
  }

  if (activity === "dataset" && !isCatalogRegistry(body)) {
    return jsonResponse({ error: "Dataset search items must be an array of catalog entries." }, { status: 400 });
  }

  try {
    let searchItems: unknown[] = [];
    try {
      const existing = JSON.parse(await readFile(searchPath, "utf8"));
      searchItems = Array.isArray(existing) ? existing : [];
    } catch {}

    const normalizedItems = activity === "dataset" ? normalizeCatalogRegistry(body) : body;
    await writeJsonFile(searchPath, [
      ...searchItems.filter((item: any) => item?.activity !== activity),
      ...normalizedItems.map((item: any) => ({ ...item, activity }))
    ]);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to write search sources." }, { status: 500 });
  }
}

function getActivity(request: Request) {
  const activity = new URL(request.url).searchParams.get("activity") || "";
  return SUPPORTED_ACTIVITIES.has(activity) ? activity : "";
}
