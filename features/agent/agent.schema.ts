import { z } from "zod";

export const AgentProviderOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  apiKeyLabel: z.string(),
  placeholder: z.string(),
  implemented: z.boolean()
});

export type AgentProviderOption = z.infer<typeof AgentProviderOptionSchema>;

export interface AgentModelProvider {
  id: string;
  label: string;
  defaultModel: string;
  apiKeyLabel: string;
  createInteraction(apiKey: string, body: any): Promise<any>;
  emptyResponseMessage: string;
  errorResponseMessage(error: any): string;
}
