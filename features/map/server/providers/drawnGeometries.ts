export async function getGeometryLayers() {
  const { dataPath, readJsonFileResponse } = await import("@/lib/server/files");
  return readJsonFileResponse(dataPath("geometry.json"), { layers: [] }, "Failed to read geometry.");
}

export async function saveGeometryLayers(request: Request) {
  const { dataPath, jsonResponse, writeJsonFile } = await import("@/lib/server/files");
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.layers)) {
    return jsonResponse({ error: "Geometry payload must have a layers array." }, { status: 400 });
  }
  try {
    await writeJsonFile(dataPath("geometry.json"), body);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write geometry." }, { status: 500 });
  }
}
