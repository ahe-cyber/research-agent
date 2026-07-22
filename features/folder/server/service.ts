import { jsonResponse } from "@/lib/server/files";

export async function listFolderStatus() {
  return jsonResponse({ ok: true });
}
