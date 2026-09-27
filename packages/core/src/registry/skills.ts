import type { SkillDefinition } from "@reponix/schemas";

export const graphifySkill: SkillDefinition = {
  id: "graphify",
  name: "Graphify Integration",
  description: "Extract structural code property graphs using Graphify CLI.",
  instructions: "Execute Graphify to extract syntax AST, relationships, and call graphs into .reponix/graph/source/.",
  references: ["https://github.com/graphify/graphify"],
  scripts: ["npx graphify . --output .reponix/graph/source/"],
};

export const repositoryAnalysisSkill: SkillDefinition = {
  id: "repository-analysis",
  name: "Repository Analysis",
  description: "Inspection of directories, file trees, dependencies, and build configurations.",
  instructions: "Scan repository root, identify build system manifests, catalog source hierarchy, and record inventory.",
  references: [],
  scripts: [],
};

export const reconstructionSkill: SkillDefinition = {
  id: "reconstruction",
  name: "Reconstruction Specification",
  description: "Target-neutral system blueprint generation.",
  instructions: "Synthesize semantic facts into target-neutral system blueprints, entity models, and API contracts.",
  references: [],
  scripts: [],
};

export const allSkills: SkillDefinition[] = [
  graphifySkill,
  repositoryAnalysisSkill,
  reconstructionSkill,
];
