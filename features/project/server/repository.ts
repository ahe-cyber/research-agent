import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";

const FEATURE_ID = "project";
const projectPath = dataPath("features", "project.json");

export function getProjectData() {
  return readJsonFile(projectPath, []);
}

export function getProjectSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveProjectData(data: unknown[]) {
  return writeJsonFile(projectPath, data);
}

export function saveProjectSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
