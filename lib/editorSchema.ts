import { z } from "zod";

export const editorFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  control: z.enum(["text", "textarea", "checkbox", "secretValue", "secretDropdown"]).optional(),
  rich: z.boolean().optional(),
  multiline: z.boolean().optional(),
  readonly: z.boolean().optional()
});

export const editorTargetSchema = z.object({
  target: z.string(),
  fields: z.array(editorFieldSchema)
});

export type EditorField = z.infer<typeof editorFieldSchema>;
export type EditorTarget = z.infer<typeof editorTargetSchema>;
