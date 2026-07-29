import { withBasePath } from "@/lib/basePath";

export function getRecordData() {
  return fetch(withBasePath("/api/record"));
}

export function getRecordSearchSources() {
  return fetch(withBasePath("/api/record?resource=sources"));
}
