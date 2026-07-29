import { jsonResponse } from "@/lib/server/files";
import { editorSchemaResponse } from "@/lib/server/editorSchema";
import { recordItemEditorFields, recordSearchSourceEditorFields } from "../record.schema";
import { getRecordData, getRecordSearchSources, saveRecordData, saveRecordSearchSources } from "./repository";

export async function listRecordData() {
  return jsonResponse(await getRecordData());
}

export function getRecordEditorSchema(target: string) {
  return editorSchemaResponse(target, {
    item: recordItemEditorFields,
    searchSource: recordSearchSourceEditorFields
  });
}

export async function listRecordSearchSources() {
  return jsonResponse(await getRecordSearchSources());
}

export async function updateRecordData(data: unknown[]) {
  await saveRecordData(data);
  return jsonResponse({ ok: true });
}

export async function updateRecordSearchSources(sources: unknown[]) {
  await saveRecordSearchSources(sources);
  return jsonResponse({ ok: true });
}
