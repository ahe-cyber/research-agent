import { z } from "zod";

export const toolParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string()
});

export const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  params: z.array(toolParameterSchema)
});

export const toolDeclarationSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    properties: z.record(z.string(), z.object({
      type: z.string().optional(),
      description: z.string().optional()
    })),
    required: z.array(z.string()).optional()
  }).optional()
});

export type ToolParameter = z.infer<typeof toolParameterSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ToolDeclaration = z.infer<typeof toolDeclarationSchema>;
