import { handleAgentChat } from "./service";

export async function POST(request: Request) {
  return handleAgentChat(request);
}
