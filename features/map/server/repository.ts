import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";

const FEATURE_ID = "map";
const mapPath = dataPath("features", "map.json");

export function getMapSources() {
  return readJsonFile(mapPath, []);
}

export function getMapSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveMapSources(sources: unknown[]) {
  return writeJsonFile(mapPath, sources);
}

export function saveMapSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
