import { jsonResponse } from "@/lib/server/files";
import { listSkillSearchSources, listSkills, updateSkillSearchSources } from "./service";

export function GET(request: Request) {
  return isSearchRequest(request) ? listSkillSearchSources() : listSkills();
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Search sources payload must be an array." }, { status: 400 });
  }
  return updateSkillSearchSources(body);
}

function isSearchRequest(request: Request) {
  return new URL(request.url).searchParams.get("resource") === "search";
}
