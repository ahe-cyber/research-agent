import { jsonResponse } from "@/lib/server/files";
import { SearchCatalog, searchCatalog } from "@/lib/server/catalogSearch";
import {
  getDatasetSearchSources,
  getDatasetSources,
  saveDatasetSearchSources,
  saveDatasetSources
} from "./repository";

export async function listDatasetSources() {
  return jsonResponse(await getDatasetSources());
}

export async function updateDatasetSources(sources: unknown[]) {
  await saveDatasetSources(sources);
  return jsonResponse({ ok: true });
}

export async function listDatasetSearchSources() {
  return jsonResponse(await getDatasetSearchSources());
}

export async function updateDatasetSearchSources(sources: unknown[]) {
  await saveDatasetSearchSources(sources);
  return jsonResponse({ ok: true });
}

export async function findDatasetCatalogItems(body: any) {
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
