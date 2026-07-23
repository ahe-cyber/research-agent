import { z } from "zod";

export const skillItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  path: z.string(),
  description: z.string(),
  content: z.string().optional()
});

export const skillEditorFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  rich: z.boolean().optional(),
  multiline: z.boolean().optional(),
  readonly: z.boolean().optional()
});

export const skillEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "source", label: "Source" },
  { key: "path", label: "Data Location", readonly: true },
  { key: "description", label: "Description", multiline: true },
  { key: "content", label: "Content", rich: true }
] as const;

export const skillSearchSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  costly: z.boolean().optional()
});

export type SkillItem = z.infer<typeof skillItemSchema>;
export type SkillEditorField = z.infer<typeof skillEditorFieldSchema>;
export type SkillSearchSource = z.infer<typeof skillSearchSourceSchema>;
