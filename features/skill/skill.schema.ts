import { z } from "zod";

export const skillItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  path: z.string(),
  description: z.string()
});

export const skillSearchSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  costly: z.boolean().optional()
});

export type SkillItem = z.infer<typeof skillItemSchema>;
export type SkillSearchSource = z.infer<typeof skillSearchSourceSchema>;
