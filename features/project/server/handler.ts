import { jsonResponse } from "@/lib/server/files";
import { getProjectEditorSchema, listProjectData, listProjectSearchSources, updateProjectData, updateProjectSearchSources } from "./service";

export function GET(request: Request) {
  const resource = new URL(request.url).searchParams.get("resource");
  if (resource === "schema") return getProjectEditorSchema(new URL(request.url).searchParams.get("target") || "item");
  if (resource === "suggest" || resource === "retrieve") {
    return jsonResponse({ error: `${resource} is not implemented for project.` }, { status: 501 });
  }
  return resource === "sources" ? listProjectSearchSources() : listProjectData();
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Project payload must be an array." }, { status: 400 });
  }
  return new URL(request.url).searchParams.get("resource") === "sources"
    ? updateProjectSearchSources(body)
    : updateProjectData(body);
}
