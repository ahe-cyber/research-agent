import { z } from "zod";

export const skillItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  path: z.string(),
  description: z.string()
});

export const skillSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  costly: z.boolean().optional()
});

export type SkillItem = z.infer<typeof skillItemSchema>;
export type SkillSource = z.infer<typeof skillSourceSchema>;
