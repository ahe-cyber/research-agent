import { readFile } from "node:fs/promises";
import { dataPath, jsonResponse, writeJsonFile } from "../_shared/files";
import { isHubRegistry, normalizeHubRegistry } from "../_shared/hubs";

const hubsPath = dataPath("hubs.json");

export async function GET() {
  try {
    const registry = JSON.parse(await readFile(hubsPath, "utf8"));
    return jsonResponse(normalizeHubRegistry(registry));
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to read hubs." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isHubRegistry(body)) {
    return jsonResponse({ error: "Hubs must be grouped by type." }, { status: 400 });
  }

  try {
    await writeJsonFile(hubsPath, normalizeHubRegistry(body));
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write hubs." }, { status: 500 });
  }
}
