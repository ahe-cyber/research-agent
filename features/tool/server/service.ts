import { jsonResponse } from "@/lib/server/files";
import { getToolDeclarations } from "./repository";

export function listToolDeclarations() {
  return jsonResponse(getToolDeclarations());
}
