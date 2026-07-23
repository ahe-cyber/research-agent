import { withBasePath } from "@/lib/basePath";

export function getSkills() {
  return fetch(withBasePath("/api/skill"));
}

export function getSkillSearchSources() {
  return fetch(withBasePath("/api/skill?resource=search"));
}

export function saveSkillSearchSources(sources: unknown[]) {
  return fetch(withBasePath("/api/skill?resource=search"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources)
  });
}

export function saveSkill(skill: unknown) {
  return fetch(withBasePath("/api/skill"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skill)
  });
}
