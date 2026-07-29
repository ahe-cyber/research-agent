import { jsonResponse } from "@/lib/server/files";
import { editorSchemaResponse } from "@/lib/server/editorSchema";
import { skillItemEditorFields, skillItemSchema, skillSearchSourceEditorFields } from "../skill.schema";
import { getSkillData, getSkillSearchSources, saveSkillData, saveSkillItem, saveSkillSearchSources } from "./repository";

export async function listSkillData() {
  return jsonResponse(await getSkillData());
}

export function getSkillEditorSchema(target: string) {
  return editorSchemaResponse(target, {
    item: skillItemEditorFields,
    searchSource: skillSearchSourceEditorFields
  });
}

export async function listSkillSearchSources() {
  return jsonResponse(await getSkillSearchSources());
}

export async function suggestSkillSearch(params: URLSearchParams) {
  const sourceId = (params.get("source") || "").trim();
  const query = (params.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(Number(params.get("limit")) || 6, 10));
  const searchSources = await getSkillSearchSources();
  const selectedSource = sourceId
    ? searchSources.find((source: any) => source?.id === sourceId)
    : searchSources.find((source: any) => source?.type === "shared") || searchSources[0];

  if (sourceId && !selectedSource) {
    return jsonResponse({ error: `Unknown skill search source: ${sourceId}` }, { status: 404 });
  }

  if (!query) {
    return jsonResponse({ suggestions: [] });
  }

  const skillItems = await getSkillData();
  const suggestions = skillItems
    .filter((skill: any) => [skill.name, skill.source, skill.description, skill.path].some((value) => String(value || "").toLowerCase().includes(query)))
    .slice(0, limit)
    .map((skill: any) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description || skill.source || "",
      sourceId: selectedSource?.id || sourceId || "",
      raw: skill
    }));

  return jsonResponse({ suggestions });
}

export async function updateSkillSearchSources(sources: unknown[]) {
  await saveSkillSearchSources(sources);
  return jsonResponse({ ok: true });
}

export async function updateSkillData(skillItems: unknown[]) {
  await saveSkillData(skillItems);
  return jsonResponse({ ok: true });
}

export async function updateSkillItem(body: unknown) {
  const parsed = skillItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Skill payload is invalid." }, { status: 400 });
  }
  return jsonResponse(await saveSkillItem(parsed.data));
}
