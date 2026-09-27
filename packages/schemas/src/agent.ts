import { z } from "zod";

export const AgentDefinitionSchema = z.object({
  id: z.string().min(1, "Agent ID is required"),
  name: z.string().min(1, "Agent name is required"),
  description: z.string().min(1, "Agent description is required"),
  role: z.string().min(1, "Agent role is required"),
  mission: z.string().min(1, "Agent mission is required"),
  responsibilities: z.array(z.string()).min(1, "At least one responsibility is required"),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  workflow: z.array(z.string()).min(1, "Workflow steps are required"),
  optional: z.boolean().default(false),
  dependencies: z.array(z.string()).default([]),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
