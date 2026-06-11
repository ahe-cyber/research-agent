import { dataPath, jsonResponse, readJsonFileResponse, writeJsonFile } from "../_lib/files";

const geometryPath = dataPath("geometry.json");

export async function GET() {
  return readJsonFileResponse(geometryPath, { layers: [] }, "Failed to read geometry.");
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.layers)) {
    return jsonResponse({ error: "Geometry payload must have a layers array." }, { status: 400 });
  }
  try {
    await writeJsonFile(geometryPath, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write geometry." }, { status: 500 });
  }
}
