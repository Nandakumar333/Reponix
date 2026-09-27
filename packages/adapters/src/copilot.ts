import fs from "node:fs";
import path from "node:path";
import type { AgentDefinition, SkillDefinition, PlatformId } from "@reponix/schemas";
import { renderAgent, renderSkill, renderRootInstructions } from "@reponix/templates";
import type { PlatformAdapter, PlatformFile } from "./adapter.js";

export class CopilotAdapter implements PlatformAdapter {
  readonly platformId: PlatformId = "copilot";
  readonly displayName = "GitHub Copilot";

  async detect(rootDir: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(rootDir, ".github/copilot-instructions.md")) ||
      fs.existsSync(path.join(rootDir, ".github/agents"))
    );
  }

  getAgentPath(agentId: string): string {
    return `.github/agents/${agentId}.md`;
  }

  getSkillPath(skillId: string): string {
    return `.github/skills/${skillId}/SKILL.md`;
  }

  renderAgent(agent: AgentDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderAgent(agent, { platform: "copilot", ...context });
    return {
      relativePath: this.getAgentPath(agent.id),
      content,
    };
  }

  renderSkill(skill: SkillDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderSkill(skill, { platform: "copilot", ...context });
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

    const copilotMd = `${rootContent}

## GitHub Copilot Instructions
When analyzing or reconstructing code in this repository:
1. Adhere to the archaeological findings in \`.reponix/\`.
2. Do not introduce unverified assumptions; follow the agent guidelines in \`.github/agents/\`.
3. Consult \`reponix-orchestrator.md\` as the entry point for complex multi-step archaeology.
`;

    return [
      {
        relativePath: ".github/copilot-instructions.md",
        content: copilotMd,
      },
    ];
  }
}
