import { dataPath, jsonResponse, readJsonFileResponse, writeJsonFile } from "@/lib/server/files";

const datasetPath = dataPath("features", "dataset.json");

export async function getDatasetSources() {
  return readJsonFileResponse(datasetPath, undefined, "Failed to read datasets.");
}

export async function saveDatasetSources(request: Request) {
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Dataset payload must be an array." }, { status: 400 });
  }

  try {
    await writeJsonFile(datasetPath, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write dataset." }, { status: 500 });
  }
}
