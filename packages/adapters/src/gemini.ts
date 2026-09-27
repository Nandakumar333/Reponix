import fs from "node:fs";
import path from "node:path";
import type { AgentDefinition, SkillDefinition, PlatformId } from "@reponix/schemas";
import { renderAgent, renderSkill, renderRootInstructions } from "@reponix/templates";
import type { PlatformAdapter, PlatformFile } from "./adapter.js";

export class GeminiAdapter implements PlatformAdapter {
  readonly platformId: PlatformId = "gemini";
  readonly displayName = "Gemini CLI";

  async detect(rootDir: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(rootDir, ".gemini")) ||
      fs.existsSync(path.join(rootDir, "GEMINI.md"))
    );
  }

  getAgentPath(agentId: string): string {
    return `.gemini/agents/${agentId}.md`;
  }

  getSkillPath(skillId: string): string {
    return `.gemini/skills/${skillId}/SKILL.md`;
  }

  renderAgent(agent: AgentDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderAgent(agent, { platform: "gemini", ...context });
    return {
      relativePath: this.getAgentPath(agent.id),
      content,
    };
  }

  renderSkill(skill: SkillDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderSkill(skill, { platform: "gemini", ...context });
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

    const agentImports = agents
      .map((a) => `@${this.getAgentPath(a.id)}`)
      .join("\n");

    const geminiMd = `${rootContent}

## Agent Imports
${agentImports}

Start by consulting the \`reponix-orchestrator\` instructions when initiating archaeological investigations.
`;

    return [
      {
        relativePath: "GEMINI.md",
        content: geminiMd,
      },
    ];
  }
}
