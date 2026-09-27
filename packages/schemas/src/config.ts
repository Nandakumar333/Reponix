import { z } from "zod";

export const PlatformIdSchema = z.enum([
  "codex",
  "claude",
  "opencode",
  "copilot",
  "cursor",
  "gemini",
]);

export type PlatformId = z.infer<typeof PlatformIdSchema>;

export const SuiteTypeSchema = z.enum([
  "full",
  "minimal",
  "reconstruction-only",
  "architecture-only",
]);

export type SuiteType = z.infer<typeof SuiteTypeSchema>;

export const ReponixConfigSchema = z.object({
  version: z.string().default("1.0"),
  platform: PlatformIdSchema,
  scope: z.enum(["project", "global"]).default("project"),
  suite: SuiteTypeSchema.default("full"),
  model: z.string().optional(),
  project: z.object({
    name: z.string().min(1, "Project name is required"),
    language: z.array(z.string()).default([]),
    framework: z.array(z.string()).default([]),
    infrastructure: z.string().optional(),
    cicd: z.string().optional(),
  }),
  graphify: z.object({
    enabled: z.boolean().default(true),
    autoInstall: z.boolean().default(true),
  }).default({ enabled: true, autoInstall: true }),
  agents: z.object({
    installed: z.array(z.string()).default([]),
    disabled: z.array(z.string()).default([]),
  }).default({ installed: [], disabled: [] }),
  skills: z.object({
    installed: z.array(z.string()).default([]),
  }).default({ installed: [] }),
  outputDirectory: z.string().default(".reponix"),
});

export type ReponixConfig = z.infer<typeof ReponixConfigSchema>;
