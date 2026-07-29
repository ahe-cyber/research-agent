import { jsonResponse } from "@/lib/server/files";
import { getAgentEditorSchema, handleAgentChat, listAgentSearchSources, listAgentSessionItems, listAgentSessions, readAgentInstruction, updateAgentData, updateAgentInstruction, updateAgentSearchSources, updateAgentSessions } from "./service";

export function GET(request: Request) {
  switch (getResource(request)) {
    case "schema":
      return getAgentEditorSchema(new URL(request.url).searchParams.get("target") || "item");
    case "instruction":
      return readAgentInstruction();
    case "suggest":
    case "retrieve":
      return jsonResponse({ error: `${getResource(request)} is not implemented for agent.` }, { status: 501 });
    case "sources":
      return listAgentSearchSources();
    case "sessions":
      return listAgentSessionItems();
    default:
      return listAgentSessions();
  }
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

  const sessions = Array.isArray(body) ? body : body?.sessions;
  if (getResource(request) === "sources") {
    return Array.isArray(body)
      ? updateAgentSearchSources(body)
      : jsonResponse({ error: "Agent search sources payload must be an array." }, { status: 400 });
  }

  if (Array.isArray(sessions)) {
    return updateAgentSessions(sessions);
  }

  return updateAgentData(body);
}

function getResource(request: Request) {
  return new URL(request.url).searchParams.get("resource") || "";
}
