import { jsonResponse } from "@/lib/server/files";
import { getSkillEditorSchema, listSkillData, listSkillSearchSources, suggestSkillSearch, updateSkillData, updateSkillItem, updateSkillSearchSources } from "./service";

export function GET(request: Request) {
  const resource = getResource(request);
  if (resource === "suggest") return suggestSkillSearch(new URL(request.url).searchParams);
  if (resource === "retrieve") return jsonResponse({ error: "retrieve is not implemented for skill." }, { status: 501 });
  if (resource === "schema") return getSkillEditorSchema(new URL(request.url).searchParams.get("target") || "item");
  return resource === "sources" ? listSkillSearchSources() : listSkillData();
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (Array.isArray(body)) {
    return isSearchRequest(request) ? updateSkillSearchSources(body) : updateSkillData(body);
  }
  if (!isSearchRequest(request)) {
    return updateSkillItem(body);
  }
  return jsonResponse({ error: "Search sources payload must be an array." }, { status: 400 });
}

function isSearchRequest(request: Request) {
  return getResource(request) === "sources";
}

function getResource(request: Request) {
  return new URL(request.url).searchParams.get("resource") || "";
}
