import { jsonResponse } from "@/lib/server/files";
import { editorSchemaResponse } from "@/lib/server/editorSchema";
import { datasetItemEditorFields, datasetSearchSourceEditorFields } from "../dataset.schema";
import type {
  DatasetCatalogSearchOptions,
  DatasetCatalogSearchResult,
  DatasetCatalogSearchTarget
} from "../dataset.schema";
import { searchArcGisCatalog } from "./providers/arcgis";
import { searchSocrataCatalog } from "./providers/socrata";
import {
  getDatasetData,
  getDatasetSearchSource,
  getDatasetSearchSources,
  saveDatasetData,
  saveDatasetSearchSources,
} from "./repository";

export async function listDatasetData() {
  return jsonResponse(await getDatasetData());
}

export function getDatasetEditorSchema(target: string) {
  return editorSchemaResponse(target, {
    item: datasetItemEditorFields,
    searchSource: datasetSearchSourceEditorFields
  });
}

export async function updateDatasetData(data: unknown[]) {
  await saveDatasetData(data);
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
  const catalog = body?.catalog as DatasetCatalogSearchTarget | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const limit = Math.max(1, Math.min(Number(body?.limit) || 5, 10));

  if (!catalog?.url || !query) {
    return jsonResponse({ results: [] });
  }

  try {
    return jsonResponse({ results: await searchDatasetCatalog(catalog, query, limit) });
  } catch (error) {
    console.error("[Catalog search] Failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Catalog search failed." }, { status: 502 });
  }
}

export async function suggestDatasetSearch(params: URLSearchParams) {
  const sourceId = (params.get("source") || "").trim();
  const query = (params.get("q") || "").trim();
  const limit = Math.max(1, Math.min(Number(params.get("limit")) || 6, 10));
  const source = await getDatasetSearchSource(sourceId);

  if (!source) {
    return jsonResponse({ error: `Unknown dataset search source: ${sourceId}` }, { status: 404 });
  }

  if (!query) {
    return jsonResponse({ suggestions: [] });
  }

  try {
    const results = await searchDatasetCatalog(source, query, limit);
    return jsonResponse({
      suggestions: results.map((result) => ({
        id: result.id,
        name: result.title,
        description: result.snippet || result.owner || result.portalType || "",
        sourceId,
        raw: result
      }))
    });
  } catch (error) {
    console.error("[Dataset suggest] Failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Dataset suggestion failed." }, { status: 502 });
  }
}

export async function searchDatasetCatalog(
  catalog: DatasetCatalogSearchTarget,
  query: string,
  limit: number,
  options: DatasetCatalogSearchOptions = {}
): Promise<DatasetCatalogSearchResult[]> {
  const type = catalog.type === "socrata" ? "socrata" : "arcgis";
  const results = type === "socrata"
    ? await searchSocrataCatalog(catalog, query, limit)
    : await searchArcGisCatalog(catalog, query, limit, options);
  return results.map((item) => ({ ...item, catalogName: catalog.name || "Catalog" }));
}
