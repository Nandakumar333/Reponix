import fs from "node:fs";
import path from "node:path";
import type { AgentDefinition, SkillDefinition, PlatformId } from "@reponix/schemas";
import { renderAgent, renderSkill, renderRootInstructions } from "@reponix/templates";
import type { PlatformAdapter, PlatformFile } from "./adapter.js";

export class CursorAdapter implements PlatformAdapter {
  readonly platformId: PlatformId = "cursor";
  readonly displayName = "Cursor";

  async detect(rootDir: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(rootDir, ".cursor")) ||
      fs.existsSync(path.join(rootDir, ".cursorrules"))
    );
  }

  getAgentPath(agentId: string): string {
    return `.cursor/rules/${agentId}.mdc`;
  }

  getSkillPath(skillId: string): string {
    return `.cursor/skills/${skillId}/SKILL.md`;
  }

  renderAgent(agent: AgentDefinition, context?: Record<string, unknown>): PlatformFile {
    const rawContent = renderAgent(agent, { platform: "cursor", ...context });
    const mdcContent = `---
description: ${agent.description.replace(/\n/g, " ")}
globs: *
alwaysApply: false
---

${rawContent}
`;
    return {
      relativePath: this.getAgentPath(agent.id),
      content: mdcContent,
    };
  }

  renderSkill(skill: SkillDefinition, context?: Record<string, unknown>): PlatformFile {
    const content = renderSkill(skill, { platform: "cursor", ...context });
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

    const cursorRules = `${rootContent}

## Cursor Operating Instructions
When prompted for repository archaeology, reconstruction, or analysis, follow the rule definitions in \`.cursor/rules/\`.
Coordinate through \`spy-orchestrator.mdc\`.
`;

    return [
      {
        relativePath: ".cursorrules",
        content: cursorRules,
      },
    ];
  }
}
