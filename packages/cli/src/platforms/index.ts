import path from 'node:path';
import os from 'node:os';
import type { Platform, Scope, PlatformPaths } from '../types.js';

export function getPlatformPaths(platform: Platform, scope: Scope, customBaseDir?: string): PlatformPaths {
  const baseDir = customBaseDir || (scope === 'global' ? os.homedir() : process.cwd());

  switch (platform) {
    case 'opencode':
      return {
        agentsDir: scope === 'global'
          ? path.join(baseDir, '.config', 'opencode', 'agents')
          : path.join(baseDir, '.opencode', 'agents'),
        extension: '.md',
        rootInstructionFile: scope === 'global'
          ? path.join(baseDir, '.config', 'opencode', 'instructions.md')
          : path.join(baseDir, '.opencode', 'instructions.md'),
      };

    case 'claude-code':
      return {
        agentsDir: path.join(baseDir, '.claude', 'agents'),
        extension: '.md',
        rootInstructionFile: path.join(baseDir, 'CLAUDE.md'),
      };

    case 'gemini-cli':
      return {
        agentsDir: path.join(baseDir, '.gemini', 'agents'),
        extension: '.md',
        rootInstructionFile: path.join(baseDir, 'GEMINI.md'),
      };

    case 'cursor':
      return {
        agentsDir: path.join(baseDir, '.cursor', 'rules'),
        extension: '.mdc',
        rootInstructionFile: path.join(baseDir, '.cursorrules'),
      };

    case 'copilot':
      return {
        agentsDir: path.join(baseDir, '.github', 'instructions'),
        extension: '.instructions.md',
        rootInstructionFile: path.join(baseDir, 'AGENTS.md'),
      };

    case 'copilot-cli':
      return {
        agentsDir: path.join(baseDir, '.github', 'agents'),
        extension: '.agent.md',
        rootInstructionFile: path.join(baseDir, 'AGENTS.md'),
      };

    case 'codex':
      return {
        agentsDir: path.join(baseDir, '.codex', 'agents'),
        extension: '.md',
        configFile: 'AGENTS.md',
        mergedFile: true,
      };

    case 'continue':
      return {
        agentsDir: path.join(baseDir, '.continue', 'prompts'),
        extension: '.md',
      };

    case 'windsurf':
      return {
        agentsDir: path.join(baseDir, '.windsurf', 'rules'),
        extension: '.md',
        rootInstructionFile: path.join(baseDir, '.windsurf', 'rules.md'),
      };

    default:
      return {
        agentsDir: path.join(baseDir, '.agents'),
        extension: '.md',
        rootInstructionFile: path.join(baseDir, 'AGENTS.md'),
      };
  }
}
