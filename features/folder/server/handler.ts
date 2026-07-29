import { jsonResponse } from "@/lib/server/files";
import { getFolderEditorSchema, listFolderSearchSources, listFolderStatus, updateFolderData, updateFolderSearchSources } from "./service";

export function GET(request: Request) {
  const resource = new URL(request.url).searchParams.get("resource");
  if (resource === "schema") return getFolderEditorSchema(new URL(request.url).searchParams.get("target") || "item");
  if (resource === "suggest" || resource === "retrieve") {
    return jsonResponse({ error: `${resource} is not implemented for folder.` }, { status: 501 });
  }
  return resource === "sources" ? listFolderSearchSources() : listFolderStatus();
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Folder payload must be an array." }, { status: 400 });
  }
  return new URL(request.url).searchParams.get("resource") === "sources"
    ? updateFolderSearchSources(body)
    : updateFolderData(body);
}
