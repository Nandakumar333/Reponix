import Handlebars from "handlebars";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentDefinition, SkillDefinition } from "@reponix/schemas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register standard Handlebars helpers
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("neq", (a, b) => a !== b);
Handlebars.registerHelper("join", (arr, sep) => (Array.isArray(arr) ? arr.join(typeof sep === "string" ? sep : ", ") : arr));
Handlebars.registerHelper("upper", (str) => String(str ?? "").toUpperCase());
Handlebars.registerHelper("lower", (str) => String(str ?? "").toLowerCase());
Handlebars.registerHelper("json", (obj) => JSON.stringify(obj, null, 2));
Handlebars.registerHelper("isoTimestamp", () => new Date().toISOString());

export function compileTemplate(source: string, data: Record<string, unknown>): string {
  const template = Handlebars.compile(source);
  return template(data);
}

// Built-in fallback template for any agent
const DEFAULT_AGENT_BASE = `<!-- Agent: {{id}} | Role: {{role}} -->

# {{name}}

## Role
{{role}}

## Mission
{{mission}}

## Responsibilities
{{#each responsibilities}}
- {{this}}
{{/each}}

## Inputs
{{#each inputs}}
- \`{{this}}\`
{{/each}}

## Required Context
1. Project metadata and dependency manifests in \`.reponix/config.yaml\`
2. Structural graph nodes and relationships in \`.reponix/graph/\`
3. Existing semantic findings and evidence in \`.reponix/evidence/\`
4. Never invent facts. Ground every assertion in file paths, line ranges, or explicit code symbols.

## Workflow
{{#each workflow}}
{{@index}}. {{this}}
{{/each}}

## Output Contract
- Record semantic findings to target path
- Record all discovered code evidence in \`.reponix/evidence/evidence.json\`
- Flag unknown or ambiguous items in \`.reponix/evidence/unknowns.json\`

## Handoff Protocol
Validates all findings before issuing structured handoff:
\`\`\`json
{
  "taskId": "{{id}}-task",
  "agent": "{{id}}",
  "status": "COMPLETED",
  "confidence": 0.95,
  "artifacts": [
    ".reponix/semantic/{{id}}.json"
  ],
  "unknowns": [],
  "nextRecommendedAgents": [
    {{#each dependencies}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}
  ],
  "timestamp": "{{isoTimestamp}}"
}
\`\`\`
`;

export function getGenericAgentTemplate(agentId: string): string {
  // Search filesystem relative to this file or package root
  const possiblePaths = [
    path.resolve(__dirname, `../templates/generic/agents/${agentId}.md.hbs`),
    path.resolve(__dirname, `../../templates/templates/generic/agents/${agentId}.md.hbs`),
    path.resolve(process.cwd(), `packages/templates/templates/generic/agents/${agentId}.md.hbs`),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }

  // Fallback to base template
  return DEFAULT_AGENT_BASE;
}

export function getGenericSkillTemplate(skillId: string): string {
  const possiblePaths = [
    path.resolve(__dirname, `../templates/generic/skills/${skillId}.md.hbs`),
    path.resolve(__dirname, `../../templates/templates/generic/skills/${skillId}.md.hbs`),
    path.resolve(process.cwd(), `packages/templates/templates/generic/skills/${skillId}.md.hbs`),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }

  return `<!-- Skill: {{id}} -->
# {{name}}

## Description
{{description}}

## Instructions
{{instructions}}
`;
}

export function renderAgent(agent: AgentDefinition, context: Record<string, unknown> = {}): string {
  const templateSource = getGenericAgentTemplate(agent.id);
  const data = {
    ...agent,
    ...context,
    isoTimestamp: new Date().toISOString(),
  };
  return compileTemplate(templateSource, data);
}

export function renderSkill(skill: SkillDefinition, context: Record<string, unknown> = {}): string {
  const templateSource = getGenericSkillTemplate(skill.id);
  const data = {
    ...skill,
    ...context,
    isoTimestamp: new Date().toISOString(),
  };
  return compileTemplate(templateSource, data);
}

export function renderRootInstructions(
  agents: AgentDefinition[],
  context: { projectName?: string; platformName?: string; [key: string]: unknown } = {}
): string {
  const source = `# {{projectName}} — Reponix AI Software Intelligence System

Welcome to **{{projectName}}** equipped with **Reponix**.

## Active AI Coding Harness
Platform: **{{platformName}}**

## Installed Archaeology Agents
{{#each agents}}
- **{{this.name}}** (\`{{this.id}}\`): {{this.description}}
{{/each}}

## Operating Guidelines
1. Coordinate via \`reponix-orchestrator\`.
2. Do not invent facts or create ungrounded documentation. Every claim must have verifiable evidence.
3. Keep all findings in \`.reponix/\`.
4. Output structured handoffs between subagents.
`;

  return compileTemplate(source, {
    projectName: context.projectName || "Reponix Project",
    platformName: context.platformName || "Generic Platform",
    agents,
    ...context,
  });
}
