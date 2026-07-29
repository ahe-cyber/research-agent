import { withBasePath } from "@/lib/basePath";

export function getSkillData() {
  return fetch(withBasePath("/api/skill"));
}

export function getSkillSearchSources() {
  return fetch(withBasePath("/api/skill?resource=sources"));
}

export function saveSkillSearchSources(sources: unknown[]) {
  return fetch(withBasePath("/api/skill?resource=sources"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources)
  });
}

export function saveSkillItem(skill: unknown) {
  return fetch(withBasePath("/api/skill"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skill)
  });
}

export function getSkillSuggestions(params: URLSearchParams) {
  return fetch(withBasePath(`/api/skill?resource=suggest&${params}`));
}
