import { jsonResponse } from "@/lib/server/files";
import { getSkillSearchSources, getSkills, saveSkillSearchSources } from "./repository";

export async function listSkills() {
  return jsonResponse(await getSkills());
}

export async function listSkillSearchSources() {
  return jsonResponse(await getSkillSearchSources());
}

export async function updateSkillSearchSources(sources: unknown[]) {
  await saveSkillSearchSources(sources);
  return jsonResponse({ ok: true });
}
