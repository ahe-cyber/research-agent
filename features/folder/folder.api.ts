import { withBasePath } from "@/lib/basePath";

export function getFolderData() {
  return fetch(withBasePath("/api/folder"));
}

export function getFolderStatus() {
  return fetch(withBasePath("/api/folder"));
}

export function getFolderSearchSources() {
  return fetch(withBasePath("/api/folder?resource=sources"));
}
