import type { AgentDefinition, SkillDefinition, PlatformId } from "@reponix/schemas";

export interface PlatformFile {
  relativePath: string;
  content: string;
}

export interface PlatformAdapter {
  readonly platformId: PlatformId;
  readonly displayName: string;

  detect(rootDir: string): Promise<boolean>;
  getAgentPath(agentId: string): string;
  getSkillPath(skillId: string): string;

  renderAgent(agent: AgentDefinition, context?: Record<string, unknown>): PlatformFile;
  renderSkill(skill: SkillDefinition, context?: Record<string, unknown>): PlatformFile;
  renderRootInstructions(agents: AgentDefinition[], context?: Record<string, unknown>): PlatformFile[];
}
