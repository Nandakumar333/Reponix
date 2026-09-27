import fs from "node:fs";
import path from "node:path";
import type { AgentDefinition, SkillDefinition, PlatformId } from "@reponix/schemas";
import { renderAgent, renderSkill, renderRootInstructions } from "@reponix/templates";
import type { PlatformAdapter, PlatformFile } from "./adapter.js";

export class OpenCodeAdapter implements PlatformAdapter {
  readonly platformId: PlatformId = "opencode";
  readonly displayName = "OpenCode";

  async detect(rootDir: string): Promise<boolean> {
    return fs.existsSync(path.join(rootDir, ".opencode"));
  }

  getAgentPath(agentId: string): string {
    return `.opencode/agents/${agentId}.md`;
  }

  getSkillPath(skillId: string): string {
    return `.opencode/skills/${skillId}/SKILL.md`;
  }

  renderAgent(agent: AgentDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderAgent(agent, { platform: "opencode", ...context });
    return {
      relativePath: this.getAgentPath(agent.id),
      content,
    };
  }

  renderSkill(skill: SkillDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderSkill(skill, { platform: "opencode", ...context });
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

    return [
      {
        relativePath: ".opencode/instructions.md",
        content: rootContent,
      },
    ];
  }
}
