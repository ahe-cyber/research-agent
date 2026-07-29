import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";

const FEATURE_ID = "record";
const recordPath = dataPath("features", "record.json");

export function getRecordData() {
  return readJsonFile(recordPath, []);
}

export function getRecordSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveRecordData(data: unknown[]) {
  return writeJsonFile(recordPath, data);
}

export function saveRecordSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
