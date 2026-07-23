import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";
import type { SkillItem } from "../skill.schema";

const FEATURE_ID = "skill";
const skillPath = dataPath("features", "skill.json");

export function getSkills() {
  return readJsonFile(skillPath, []);
}

export async function saveSkill(skill: SkillItem) {
  const skills = await getSkills();
  const index = skills.findIndex((item: SkillItem) => item.id === skill.id);
  const nextSkills = index >= 0
    ? skills.map((item: SkillItem) => (item.id === skill.id ? skill : item))
    : [...skills, skill];
  await writeJsonFile(skillPath, nextSkills);
  return skill;
}

export function getSkillSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveSkillSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}
