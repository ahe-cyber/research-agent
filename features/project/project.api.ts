import { withBasePath } from "@/lib/basePath";

export function getProjectData() {
  return fetch(withBasePath("/api/project"));
}

export function getProjectSearchSources() {
  return fetch(withBasePath("/api/project?resource=sources"));
}
