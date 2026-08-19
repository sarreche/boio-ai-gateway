import { z } from "zod";

export const embeddingsRequestSchema = z.object({
  model: z.enum(["gateway", "default"]).optional(),
  input: z.union([
    z.string().min(1),
    z.array(z.string().min(1)).min(1),
  ]),
}).strict();

export type EmbeddingsRequest = z.infer<typeof embeddingsRequestSchema>;
