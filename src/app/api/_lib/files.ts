import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dataPath = (...segments: string[]) => path.join(process.cwd(), "public", "data", ...segments);

export function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export async function readJsonFileResponse(filePath: string, fallback?: unknown, errorMessage = "Failed to read data.") {
  try {
    return new Response(await readFile(filePath, "utf8"), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    if (fallback !== undefined) return jsonResponse(fallback);
    console.error(error);
    return jsonResponse({ error: errorMessage }, { status: 500 });
  }
}

export async function writeJsonFile(filePath: string, body: unknown) {
  await writeFile(filePath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}
