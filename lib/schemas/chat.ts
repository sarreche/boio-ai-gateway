import { z } from "zod";

export const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
}).strict();

export const chatRequestSchema = z.object({
  model: z.enum(["gateway", "default"]).optional(),
  messages: z.array(messageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
  stream: z.literal(false).optional(),
}).strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;
