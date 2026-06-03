import { dataPath, jsonResponse, readJsonFileResponse, writeJsonFile } from "../_shared/files";

const searchSourcesPath = dataPath("searchsource.json");

export async function GET() {
  return readJsonFileResponse(searchSourcesPath, { sources: [] });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.sources)) {
    return jsonResponse({ error: "sources must be an array." }, { status: 400 });
  }

  try {
    await writeJsonFile(searchSourcesPath, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to write search sources." }, { status: 500 });
  }
}
