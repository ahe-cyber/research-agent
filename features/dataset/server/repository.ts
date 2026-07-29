import { dataPath } from "@/lib/server/files";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";

const FEATURE_ID = "dataset";
const datasetPath = dataPath("features", "dataset.json");

export function getDatasetData() {
  return readJsonFile(datasetPath, []);
}

export function saveDatasetData(data: unknown[]) {
  return writeJsonFile(datasetPath, data);
}

export function getDatasetSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export async function getDatasetSearchSource(sourceId: string) {
  const sources = await getDatasetSearchSources();
  return sources.find((source: any) => source?.id === sourceId);
}

export function saveDatasetSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
