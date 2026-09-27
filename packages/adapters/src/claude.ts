import fs from "node:fs";
import path from "node:path";
import type { AgentDefinition, SkillDefinition, PlatformId } from "@reponix/schemas";
import { renderAgent, renderSkill, renderRootInstructions } from "@reponix/templates";
import type { PlatformAdapter, PlatformFile } from "./adapter.js";

export class ClaudeAdapter implements PlatformAdapter {
  readonly platformId: PlatformId = "claude";
  readonly displayName = "Claude Code";

  async detect(rootDir: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(rootDir, ".claude")) ||
      fs.existsSync(path.join(rootDir, "CLAUDE.md"))
    );
  }

  getAgentPath(agentId: string): string {
    return `.claude/agents/${agentId}.md`;
  }

  getSkillPath(skillId: string): string {
    return `.claude/skills/${skillId}/SKILL.md`;
  }

  renderAgent(agent: AgentDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderAgent(agent, { platform: "claude", ...context });
    return {
      relativePath: this.getAgentPath(agent.id),
      content,
    };
  }

  renderSkill(skill: SkillDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderSkill(skill, { platform: "claude", ...context });
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

    const claudeMd = `${rootContent}

## Invoking Reponix in Claude Code
To execute archaeological analysis, start by delegating to \`spy-orchestrator\`:
- View agents in \`.claude/agents/\`
- Run \`npx reponix scan\` to begin automated extraction
`;

    return [
      {
        relativePath: "CLAUDE.md",
        content: claudeMd,
      },
    ];
  }
}
