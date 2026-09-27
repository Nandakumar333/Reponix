import fs from "node:fs";
import path from "node:path";
import type { AgentDefinition, SkillDefinition, PlatformId } from "@reponix/schemas";
import { renderAgent, renderSkill, renderRootInstructions } from "@reponix/templates";
import type { PlatformAdapter, PlatformFile } from "./adapter.js";

export class CodexAdapter implements PlatformAdapter {
  readonly platformId: PlatformId = "codex";
  readonly displayName = "OpenAI Codex";

  async detect(rootDir: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(rootDir, "AGENTS.md")) ||
      fs.existsSync(path.join(rootDir, ".codex"))
    );
  }

  getAgentPath(agentId: string): string {
    return `.codex/agents/${agentId}.md`;
  }

  getSkillPath(skillId: string): string {
    return `.codex/skills/${skillId}/SKILL.md`;
  }

  renderAgent(agent: AgentDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderAgent(agent, { platform: "codex", ...context });
    return {
      relativePath: this.getAgentPath(agent.id),
      content,
    };
  }

  renderSkill(skill: SkillDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderSkill(skill, { platform: "codex", ...context });
    return {
      relativePath: this.getSkillPath(skill.id),
      content,
    };
  }

  renderRootInstructions(agents: AgentDefinition[], context?: Record<string, unknown>): PlatformFile[] {
    const rootContent = renderRootInstructions(agents, {
      platformName: this.displayName,
      ...context,
    });

    const agentSummaries = agents
      .map((a) => `### ${a.name} (\`${a.id}\`)\n${a.mission}\n- **Responsibilities**: ${a.responsibilities.join("; ")}\n- Detailed instructions: \`${this.getAgentPath(a.id)}\``)
      .join("\n\n");

    const agentsMd = `${rootContent}

## Agent Definitions
${agentSummaries}

## Codex Execution Guide
When operating on this repository, coordinate with \`reponix-orchestrator\` and consult \`.reponix/\` for verified structural knowledge.
`;

    return [
      {
        relativePath: "AGENTS.md",
        content: agentsMd,
      },
    ];
  }
}
