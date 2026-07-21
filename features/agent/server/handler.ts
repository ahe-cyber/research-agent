import { jsonResponse } from "@/lib/server/files";
import { handleAgentChat } from "./chatService";
import { listAgents, readAgentInstruction, updateAgentInstruction, updateAgents } from "./service";

export function GET(request: Request) {
  return getResource(request) === "instruction" ? readAgentInstruction() : listAgents();
}

export function POST(request: Request) {
  return getResource(request) === "chat"
    ? handleAgentChat(request)
    : jsonResponse({ error: "Unsupported agent operation." }, { status: 400 });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (getResource(request) === "instruction") {
    return typeof body?.instruction === "string"
      ? updateAgentInstruction(body.instruction)
      : jsonResponse({ error: "instruction must be a string." }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Agents payload must be an array." }, { status: 400 });
  }

  return updateAgents(body);
}

function getResource(request: Request) {
  return new URL(request.url).searchParams.get("resource") || "";
}
