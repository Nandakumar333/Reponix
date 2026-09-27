import type { SuiteType, AgentDefinition, SkillDefinition } from "@reponix/schemas";
import { allAgents } from "./agents.js";
import { allSkills } from "./skills.js";

const SUITE_AGENT_IDS: Record<SuiteType, string[]> = {
  full: allAgents.map((a) => a.id),
  minimal: [
    "reponix-orchestrator",
    "repository-analyst",
    "architecture-agent",
    "code-agent",
    "validator-agent",
  ],
  "architecture-only": [
    "reponix-orchestrator",
    "repository-analyst",
    "architecture-agent",
    "code-agent",
    "api-agent",
    "database-agent",
    "validator-agent",
  ],
  "reconstruction-only": [
    "reponix-orchestrator",
    "repository-analyst",
    "architecture-agent",
    "code-agent",
    "api-agent",
    "database-agent",
    "feature-agent",
    "business-rule-agent",
    "workflow-agent",
    "reconstruction-agent",
    "validator-agent",
  ],
};

export interface ResolvedSuite {
  agents: AgentDefinition[];
  skills: SkillDefinition[];
}

export function resolveSuite(suite: SuiteType = "full"): ResolvedSuite {
  const allowedIds = new Set(SUITE_AGENT_IDS[suite] || SUITE_AGENT_IDS.full);

  // Dependency resolution loop: ensure any dependency is included
  let added = true;
  while (added) {
    added = false;
    for (const agent of allAgents) {
      if (allowedIds.has(agent.id)) {
        for (const depId of agent.dependencies) {
          if (!allowedIds.has(depId)) {
            allowedIds.add(depId);
            added = true;
          }
        }
      }
    }
  }

  const selectedAgents = allAgents.filter((a) => allowedIds.has(a.id));

  // Collect required skills from selected agents
  const requiredSkillIds = new Set<string>();
  for (const agent of selectedAgents) {
    for (const s of agent.skills) {
      requiredSkillIds.add(s);
    }
  }

  const selectedSkills = allSkills.filter((s) => requiredSkillIds.has(s.id));

  return {
    agents: selectedAgents,
    skills: selectedSkills,
  };
}
