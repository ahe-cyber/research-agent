import { withBasePath } from "@/lib/basePath";

export function getAgentData() {
  return fetch(withBasePath("/api/agent?resource=sessions"));
}

export function getAgentSessions() {
  return fetch(withBasePath("/api/agent"));
}

export function saveAgentRegistry(registry: unknown) {
  return fetch(withBasePath("/api/agent"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registry)
  });
}

export function getAgentSearchSources() {
  return fetch(withBasePath("/api/agent?resource=sources"));
}

export function saveAgentSessions(sessions: unknown[]) {
  return fetch(withBasePath("/api/agent"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessions })
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
