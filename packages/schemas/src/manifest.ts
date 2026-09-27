import { z } from "zod";
import { PlatformIdSchema } from "./config.js";

export const ManifestSchema = z.object({
  version: z.string().default("1.0"),
  generatedAt: z.string(),
  platform: PlatformIdSchema,
  scope: z.enum(["project", "global"]).default("project"),
  suite: z.string(),
  model: z.string().optional(),
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      path: z.string(),
      optional: z.boolean().default(false),
    })
  ).default([]),
  skills: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      path: z.string(),
    })
  ).default([]),
  rootFiles: z.array(
    z.object({
      path: z.string(),
      purpose: z.string(),
    })
  ).default([]),
});

export type ReponixManifest = z.infer<typeof ManifestSchema>;
