import { jsonResponse } from "@/lib/server/files";
import { editorSchemaResponse } from "@/lib/server/editorSchema";
import { toolItemEditorFields, toolSearchSourceEditorFields } from "../tool.schema";
import { getToolData, getToolSearchSources, saveToolData, saveToolSearchSources } from "./repository";

export async function listToolData() {
  return jsonResponse(await getToolData());
}

export function getToolEditorSchema(target: string) {
  return editorSchemaResponse(target, {
    item: toolItemEditorFields,
    searchSource: toolSearchSourceEditorFields
  });
}

export async function listToolSearchSources() {
  return jsonResponse(await getToolSearchSources());
}

export async function updateToolData(data: unknown[]) {
  await saveToolData(data);
  return jsonResponse({ ok: true });
}

export async function updateToolSearchSources(sources: unknown[]) {
  await saveToolSearchSources(sources);
  return jsonResponse({ ok: true });
}
