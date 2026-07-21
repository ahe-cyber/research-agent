import { dataPath } from "@/lib/server/files";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";

const FEATURE_ID = "dataset";
const datasetPath = dataPath("features", "dataset.json");

export function getDatasetSources() {
  return readJsonFile(datasetPath, []);
}

export function saveDatasetSources(sources: unknown[]) {
  return writeJsonFile(datasetPath, sources);
}

export function getDatasetSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveDatasetSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
