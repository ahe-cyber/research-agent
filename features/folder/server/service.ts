import { jsonResponse } from "@/lib/server/files";
import { editorSchemaResponse } from "@/lib/server/editorSchema";
import { folderItemEditorFields, folderSearchSourceEditorFields } from "../folder.schema";
import { getFolderData, getFolderSearchSources, saveFolderData, saveFolderSearchSources } from "./repository";

export async function listFolderStatus() {
  return jsonResponse(await getFolderData());
}

export function getFolderEditorSchema(target: string) {
  return editorSchemaResponse(target, {
    item: folderItemEditorFields,
    searchSource: folderSearchSourceEditorFields
  });
}

export async function listFolderSearchSources() {
  return jsonResponse(await getFolderSearchSources());
}

export async function updateFolderData(data: unknown[]) {
  await saveFolderData(data);
  return jsonResponse({ ok: true });
}

export async function updateFolderSearchSources(sources: unknown[]) {
  await saveFolderSearchSources(sources);
  return jsonResponse({ ok: true });
}
