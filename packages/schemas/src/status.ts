import { z } from "zod";

export const StageStatusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
]);

export type StageStatus = z.infer<typeof StageStatusSchema>;

export const StageInfoSchema = z.object({
  status: StageStatusSchema.default("NOT_STARTED"),
  updatedAt: z.string().optional(),
  summary: z.string().optional(),
});

export const EntitiesCountSchema = z.object({
  files: z.number().default(0),
  nodes: z.number().default(0),
  edges: z.number().default(0),
  features: z.number().default(0),
  apis: z.number().default(0),
  databaseTables: z.number().default(0),
  evidenceCount: z.number().default(0),
});

export const StatusSchema = z.object({
  version: z.string().default("1.0"),
  lastRun: z.string().optional(),
  overallCompletion: z.number().min(0).max(100).default(0),
  currentStage: z.string().optional(),
  stages: z.record(StageInfoSchema).default({}),
  entitiesCount: EntitiesCountSchema.default({}),
});

export type ReponixStatus = z.infer<typeof StatusSchema>;
