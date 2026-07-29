import { jsonResponse } from "@/lib/server/files";
import { editorSchemaResponse } from "@/lib/server/editorSchema";
import { projectItemEditorFields, projectSearchSourceEditorFields } from "../project.schema";
import { getProjectData, getProjectSearchSources, saveProjectData, saveProjectSearchSources } from "./repository";

export async function listProjectData() {
  return jsonResponse(await getProjectData());
}

export function getProjectEditorSchema(target: string) {
  return editorSchemaResponse(target, {
    item: projectItemEditorFields,
    searchSource: projectSearchSourceEditorFields
  });
}

export async function listProjectSearchSources() {
  return jsonResponse(await getProjectSearchSources());
}

export async function updateProjectData(data: unknown[]) {
  await saveProjectData(data);
  return jsonResponse({ ok: true });
}

export async function updateProjectSearchSources(sources: unknown[]) {
  await saveProjectSearchSources(sources);
  return jsonResponse({ ok: true });
}
