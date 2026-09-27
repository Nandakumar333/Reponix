import { z } from "zod";

export const HandoffStatusSchema = z.enum([
  "COMPLETED",
  "BLOCKED",
  "FAILED",
  "NEEDS_CLARIFICATION",
]);

export type HandoffStatus = z.infer<typeof HandoffStatusSchema>;

export const StructuredHandoffSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  agent: z.string().min(1, "Agent ID is required"),
  status: HandoffStatusSchema,
  confidence: z.number().min(0).max(1),
  artifacts: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  nextRecommendedAgents: z.array(z.string()).default([]),
  timestamp: z.string().min(1, "Timestamp is required"),
});

export type StructuredHandoff = z.infer<typeof StructuredHandoffSchema>;
