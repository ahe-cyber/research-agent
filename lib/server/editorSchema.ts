import { jsonResponse } from "@/lib/server/files";
import type { EditorField } from "@/lib/editorSchema";

export function editorSchemaResponse(target: string, schemas: Record<string, readonly EditorField[]>) {
  const fields = schemas[target];
  if (!fields) {
    return jsonResponse({ error: `Unknown editor schema target: ${target}` }, { status: 404 });
  }

  return jsonResponse({ target, fields });
}
