import { claudeProviderOption } from "./claude";
import { geminiProviderOption } from "./gemini";
import { openAiProviderOption } from "./openai";

export type { AgentProviderOption } from "./types";

export const AGENT_PROVIDER_OPTIONS = [
  geminiProviderOption,
  openAiProviderOption,
  claudeProviderOption
];
