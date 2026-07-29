import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";
import type { SkillItem } from "../skill.schema";

const FEATURE_ID = "skill";
const skillPath = dataPath("features", "skill.json");

export function getSkillData() {
  return readJsonFile(skillPath, []);
}

export function saveSkillData(skillItems: unknown[]) {
  return writeJsonFile(skillPath, skillItems);
}

export async function saveSkillItem(skill: SkillItem) {
  const skillItems = await getSkillData();
  const index = skillItems.findIndex((item: SkillItem) => item.id === skill.id);
  const nextSkillItems = index >= 0
    ? skillItems.map((item: SkillItem) => (item.id === skill.id ? skill : item))
    : [...skillItems, skill];
  await writeJsonFile(skillPath, nextSkillItems);
  return skill;
}

export function getSkillSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveSkillSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
