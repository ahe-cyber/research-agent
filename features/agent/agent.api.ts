import { withBasePath } from "@/lib/basePath";

export function getAgents() {
  return fetch(withBasePath("/api/agent"));
}

export function saveAgents(agents: unknown[]) {
  return fetch(withBasePath("/api/agent"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agents)
  });
}

export function chatWithAgent(body: unknown) {
  return fetch(withBasePath("/api/agent?resource=chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export function getAgentInstruction() {
  return fetch(withBasePath("/api/agent?resource=instruction"));
}

export function saveAgentInstruction(instruction: string) {
  return fetch(withBasePath("/api/agent?resource=instruction"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction })
  });
}
