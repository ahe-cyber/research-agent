import { z } from "zod";
import type { EditorField } from "@/lib/editorSchema";

export const toolParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean()
});

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  params: z.array(toolParameterSchema).optional()
});

export const toolItemSchema = toolSchema;

export const toolItemEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "params", label: "Params", multiline: true }
] satisfies readonly EditorField[];

export const toolSearchSourceEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "costly", label: "Costly" }
] satisfies readonly EditorField[];

export type ToolParameter = z.infer<typeof toolParameterSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ToolItem = z.infer<typeof toolItemSchema>;
