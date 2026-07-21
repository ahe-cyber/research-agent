import { dataPath, readJsonFileResponse } from "@/lib/server/files";
import { getSkillSearchSources, saveSkillSearchSources } from "./searchRoute";

const skillPath = dataPath("features", "skill.json");

export function getSkillRouteData(request: Request) {
  return isSearchRequest(request) ? getSkillSearchSources() : getSkills();
}

export function saveSkillRouteData(request: Request) {
  return saveSkillSearchSources(request);
}

export async function getSkills() {
  return readJsonFileResponse(skillPath, [], "Failed to read skills.");
}

function isSearchRequest(request: Request) {
  return new URL(request.url).searchParams.get("resource") === "search";
}
