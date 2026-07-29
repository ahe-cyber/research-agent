import { jsonResponse } from "@/lib/server/files";
import { getToolEditorSchema, listToolData, listToolSearchSources, updateToolData, updateToolSearchSources } from "./service";

export function GET(request: Request) {
  const resource = new URL(request.url).searchParams.get("resource");
  if (resource === "suggest" || resource === "retrieve") {
    return jsonResponse({ error: `${resource} is not implemented for tool.` }, { status: 501 });
  }
  if (resource === "schema") return getToolEditorSchema(new URL(request.url).searchParams.get("target") || "item");
  return resource === "sources" ? listToolSearchSources() : listToolData();
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Tool payload must be an array." }, { status: 400 });
  }
  return new URL(request.url).searchParams.get("resource") === "sources"
    ? updateToolSearchSources(body)
    : updateToolData(body);
}
