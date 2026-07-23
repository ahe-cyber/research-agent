import { jsonResponse } from "@/lib/server/files";
import { skillItemSchema } from "../skill.schema";
import { getSkillSearchSources, getSkills, saveSkill, saveSkillSearchSources } from "./repository";

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

export async function updateSkillRecord(body: unknown) {
  const parsed = skillItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Skill payload is invalid." }, { status: 400 });
  }
  return jsonResponse(await saveSkill(parsed.data));
}
