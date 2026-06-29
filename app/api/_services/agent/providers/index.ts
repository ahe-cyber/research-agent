import { claudeProvider } from "./claude";
import { geminiProvider } from "./gemini";
import { openAiProvider } from "./openai";
import type { AgentModelProvider } from "./types";

export type { AgentModelProvider } from "./types";

export const agentModelProviders: AgentModelProvider[] = [
  geminiProvider,
  openAiProvider,
  claudeProvider
];

export function getAgentModelProvider(providerId: string | null | undefined): AgentModelProvider {
  const normalized = String(providerId || "").trim().toLowerCase();
  return agentModelProviders.find((provider) => provider.id === normalized) || geminiProvider;
}
