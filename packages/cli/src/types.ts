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
  output?: OutputConfig;
}

export type OutputFormat = 'legacy' | 'okf' | 'both';

export interface OkfConfig {
  version?: string;
  root?: string;
  emitV01Timestamp?: boolean;
  sourceLinks?: 'relative' | 'permalink';
  staleAfterDays?: number;
  recordGitAuthors?: boolean;
}

export interface OutputConfig {
  format?: OutputFormat;
  okf?: OkfConfig;
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
  output?: OutputConfig;
}

export interface RenderOptions {
  dryRun?: boolean;
  targetDir?: string;
}

