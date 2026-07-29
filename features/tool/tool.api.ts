import { withBasePath } from "@/lib/basePath";

export function getToolData() {
  return fetch(withBasePath("/api/tool"));
}

export function getToolSearchSources() {
  return fetch(withBasePath("/api/tool?resource=sources"));
}
