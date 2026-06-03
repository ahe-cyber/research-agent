import { dataPath, jsonResponse, readJsonFileResponse, writeJsonFile } from "../_shared/files";

const agentsPath = dataPath("agents.json");

export async function GET() {
  return readJsonFileResponse(agentsPath, { agents: [] });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.agents)) {
    return jsonResponse({ error: "Agents payload must have an agents array." }, { status: 400 });
  }

  try {
    await writeJsonFile(agentsPath, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write agents." }, { status: 500 });
  }
}
