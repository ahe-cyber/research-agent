import { dataPath } from "@/lib/server/files";
import { readJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";

const FEATURE_ID = "skill";
const skillPath = dataPath("features", "skill.json");

export function getSkills() {
  return readJsonFile(skillPath, []);
}

export function getSkillSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveSkillSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
