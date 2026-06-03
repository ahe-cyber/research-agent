import { readFile } from "node:fs/promises";
import { dataPath, jsonResponse, writeJsonFile } from "../_shared/files";

const agentsPath = dataPath("agents.json");

interface AgentRegistry {
  globalInstruction?: string;
  agents?: unknown[];
  connections?: unknown[];
}

export async function GET() {
  try {
    const data = JSON.parse(await readFile(agentsPath, "utf8")) as AgentRegistry;
    return jsonResponse({ instruction: data.globalInstruction || "" });
  } catch {
    return jsonResponse({ instruction: "" });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const instruction = body?.instruction;

  if (typeof instruction !== "string") {
    return jsonResponse({ error: "instruction must be a string." }, { status: 400 });
  }

  try {
    let data: AgentRegistry = { globalInstruction: "", agents: [], connections: [] };
    try {
      data = JSON.parse(await readFile(agentsPath, "utf8")) as AgentRegistry;
    } catch {}

    data.globalInstruction = instruction;
    await writeJsonFile(agentsPath, data);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write instruction." }, { status: 500 });
  }
}
