import { z } from "zod";
import { editorFieldSchema, type EditorField } from "@/lib/editorSchema";

export const skillItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  path: z.string(),
  description: z.string(),
  content: z.string().optional()
});

export const skillEditorFieldSchema = editorFieldSchema;

export const skillItemEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "source", label: "Source" },
  { key: "path", label: "Data Location", readonly: true },
  { key: "description", label: "Description", multiline: true },
  { key: "content", label: "Content", rich: true }
] as const;

export const skillSearchSourceEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "costly", label: "Costly" }
] satisfies readonly EditorField[];

export const skillSearchSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  costly: z.boolean().optional()
});

export type SkillItem = z.infer<typeof skillItemSchema>;
export type SkillEditorField = z.infer<typeof skillEditorFieldSchema>;
export type SkillSearchSource = z.infer<typeof skillSearchSourceSchema>;
