import { readFile } from "node:fs/promises";
import { dataPath, jsonResponse, writeJsonFile } from "../_shared/files";
import { isHubRegistry, normalizeHubRegistry } from "../_shared/hubs";

const searchPath = dataPath("search.json");

export async function GET() {
  try {
    const searchItems = JSON.parse(await readFile(searchPath, "utf8"));
    const datasetSearchItems = Array.isArray(searchItems) ? searchItems.filter((item) => item.activity === "dataset") : [];
    return jsonResponse(normalizeHubRegistry(datasetSearchItems));
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to read dataset search items." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isHubRegistry(body)) {
    return jsonResponse({ error: "Dataset search items must be an array." }, { status: 400 });
  }

  try {
    let searchItems: unknown[] = [];
    try {
      const existing = JSON.parse(await readFile(searchPath, "utf8"));
      searchItems = Array.isArray(existing) ? existing : [];
    } catch {}

    await writeJsonFile(searchPath, [
      ...searchItems.filter((item: any) => item?.activity !== "dataset"),
      ...normalizeHubRegistry(body).map((item) => ({ ...item, activity: "dataset" }))
    ]);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write dataset search items." }, { status: 500 });
  }
}
