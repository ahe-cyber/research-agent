import { getSearchSources, putSearchSources } from "@/lib/server/searchRoute";

export function getSkillSearchSources() {
  return getSearchSources("skill");
}

export function saveSkillSearchSources(request: Request) {
  return putSearchSources(request, "skill");
}
