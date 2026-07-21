import { withBasePath } from "@/lib/basePath";

export function getToolDeclarations() {
  return fetch(withBasePath("/api/tool"));
}
