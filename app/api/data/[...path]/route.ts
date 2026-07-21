import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataPath, jsonResponse } from "../../_lib/files";

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const requestedPath = (await params).path || [];
  if (!requestedPath.length || requestedPath.some((segment) => segment === ".." || segment.includes("/") || segment.includes("\\"))) {
    return jsonResponse({ error: "Invalid data path." }, { status: 400 });
  }

  const filePath = dataPath(...requestedPath);
  const root = dataPath();
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return jsonResponse({ error: "Invalid data path." }, { status: 400 });
  }

  try {
    const body = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    return new Response(body, { headers: { "Content-Type": contentType } });
  } catch {
    return jsonResponse({ error: "Data file not found." }, { status: 404 });
  }
}
