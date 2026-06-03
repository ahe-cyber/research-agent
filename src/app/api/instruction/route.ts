import { readFile } from "node:fs/promises";
import { dataPath, jsonResponse, writeJsonFile } from "../_shared/files";

const instructionPath = dataPath("instruction.json");

interface AgentRegistry {
  globalInstruction?: string;
}

export async function GET() {
  try {
    const data = JSON.parse(await readFile(instructionPath, "utf8")) as AgentRegistry;
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
    let data: AgentRegistry = { globalInstruction: "" };
    try {
      data = JSON.parse(await readFile(instructionPath, "utf8")) as AgentRegistry;
    } catch {}

    data.globalInstruction = instruction;
    await writeJsonFile(instructionPath, data);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write instruction." }, { status: 500 });
  }
}
