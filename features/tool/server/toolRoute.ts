import { jsonResponse } from "@/lib/server/files";
import { TOOL_DECLARATIONS } from "./declarations";

export async function getToolDeclarations() {
  return jsonResponse(TOOL_DECLARATIONS);
}
