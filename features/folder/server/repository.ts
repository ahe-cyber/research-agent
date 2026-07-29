import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";

const FEATURE_ID = "folder";
const folderPath = dataPath("features", "folder.json");

export function getFolderData() {
  return readJsonFile(folderPath, []);
}

export function getFolderSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveFolderData(data: unknown[]) {
  return writeJsonFile(folderPath, data);
}

export function saveFolderSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
