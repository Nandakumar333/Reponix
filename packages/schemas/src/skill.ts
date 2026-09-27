import { z } from "zod";

export const SkillDefinitionSchema = z.object({
  id: z.string().min(1, "Skill ID is required"),
  name: z.string().min(1, "Skill name is required"),
  description: z.string().min(1, "Skill description is required"),
  instructions: z.string().min(1, "Instructions are required"),
  references: z.array(z.string()).default([]),
  scripts: z.array(z.string()).default([]),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;
