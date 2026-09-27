export type Platform =
  | 'opencode'
  | 'claude-code'
  | 'copilot'
  | 'copilot-cli'
  | 'codex'
  | 'cursor'
  | 'continue'
  | 'windsurf'
  | 'gemini-cli';

export type Scope = 'project' | 'global';

export type Suite = 'intelligence' | 'modernization' | 'full';

export interface PlatformPaths {
  agentsDir: string;
  extension: string;
  configFile?: string;
  mergedFile?: boolean;
  rootInstructionFile?: string;
}

export interface ReponixConfig {
  $schema?: string;
  platform: Platform;
  scope: Scope;
  suite: Suite;
  model?: string;
  project: {
    name: string;
    description?: string;
    language?: string[];
    framework?: string[];
    targetLanguage?: string[];
    targetFramework?: string[];
  };
  agents: {
    core: string[];
    optional?: string[];
  };
  skills: {
    installed: string[];
  };
}

export interface InitAnswers {
  platform: Platform;
  scope: Scope;
  suite: Suite;
  projectName: string;
  projectDescription?: string;
  techStack: string[];
  targetStack?: string[];
  model?: string;
  coreAgents: string[];
  optionalAgents: string[];
  installedSkills: string[];
}

export interface RenderOptions {
  dryRun?: boolean;
  targetDir?: string;
}
