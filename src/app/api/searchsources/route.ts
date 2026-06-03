import { readFile } from "node:fs/promises";
import { dataPath, jsonResponse, writeJsonFile } from "../_shared/files";

const searchPath = dataPath("search.json");

export async function GET() {
  try {
    const searchItems = JSON.parse(await readFile(searchPath, "utf8"));
    return jsonResponse(Array.isArray(searchItems) ? searchItems.filter((item) => item.activity === "address") : []);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to read search items." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Search sources payload must be an array." }, { status: 400 });
  }

  try {
    let searchItems: unknown[] = [];
    try {
      const existing = JSON.parse(await readFile(searchPath, "utf8"));
      searchItems = Array.isArray(existing) ? existing : [];
    } catch {}

    await writeJsonFile(searchPath, [
      ...searchItems.filter((item: any) => item?.activity !== "address"),
      ...body.map((item: any) => ({ ...item, activity: "address" }))
    ]);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to write search sources." }, { status: 500 });
  }
}
