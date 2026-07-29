import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";

const FEATURE_ID = "tool";
const toolPath = dataPath("features", "tool.json");

export function getToolData() {
  return readJsonFile(toolPath, []);
}

export function getToolSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveToolData(data: unknown[]) {
  return writeJsonFile(toolPath, data);
}

export function saveToolSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
