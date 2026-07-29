import { z } from "zod";
import type { EditorField } from "@/lib/editorSchema";

export const AgentProviderOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  apiKeyLabel: z.string(),
  placeholder: z.string(),
  implemented: z.boolean()
});

export type AgentProviderOption = z.infer<typeof AgentProviderOptionSchema>;

export const agentItemEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "title", label: "Title" },
  { key: "history", label: "History", multiline: true }
] satisfies readonly EditorField[];

export const agentSearchSourceEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "costly", label: "Costly", control: "checkbox" },
  { key: "apiKey", label: "API Key", control: "secretDropdown" }
] satisfies readonly EditorField[];

export interface AgentModelProvider {
  id: string;
  label: string;
  defaultModel: string;
  apiKeyLabel: string;
  createInteraction(apiKey: string, body: any): Promise<any>;
  emptyResponseMessage: string;
  errorResponseMessage(error: any): string;
}
