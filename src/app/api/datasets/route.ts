import { dataPath, jsonResponse, readJsonFileResponse, writeJsonFile } from "../_shared/files";

const datasetsPath = dataPath("datasets.json");

export async function GET() {
  return readJsonFileResponse(datasetsPath, undefined, "Failed to read datasets.");
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Datasets payload must be an array." }, { status: 400 });
  }

  try {
    await writeJsonFile(datasetsPath, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write datasets." }, { status: 500 });
  }
}
