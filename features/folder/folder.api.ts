import { withBasePath } from "@/lib/basePath";

export function getFolderStatus() {
  return fetch(withBasePath("/api/folder"));
}
