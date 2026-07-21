import { dataPath, jsonResponse, readJsonFileResponse, writeJsonFile } from "../_lib/files";

const agentPath = dataPath("features", "agent.json");

export async function GET() {
  return readJsonFileResponse(agentPath, []);
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Agents payload must be an array." }, { status: 400 });
  }

  try {
    await writeJsonFile(agentPath, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write agents." }, { status: 500 });
  }
}
