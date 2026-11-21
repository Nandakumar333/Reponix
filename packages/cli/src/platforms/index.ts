import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { Platform, Scope, PlatformPaths } from '../types.js';

export function getPlatformPaths(platform: Platform, scope: Scope, customBaseDir?: string): PlatformPaths {
  const baseDir = customBaseDir || (scope === 'global' ? os.homedir() : process.cwd());

  switch (platform) {
    case 'antigravity':
      return {
        agentsDir: scope === 'global'
          ? path.join(baseDir, '.gemini', 'antigravity', 'agents')
          : path.join(baseDir, '.agents', 'agents'),
        extension: '.md',
        rootInstructionFile: path.join(baseDir, 'AGENTS.md'),
      };

    case 'opencode': {
      const dotConfig = path.join(baseDir, '.opencode', 'opencode.json');
      const rootConfig = path.join(baseDir, 'opencode.json');
      const configFile = scope === 'global'
        ? path.join(baseDir, '.config', 'opencode', 'opencode.json')
        : (fs.existsSync(dotConfig) ? dotConfig : rootConfig);

      return {
        agentsDir: scope === 'global'
          ? path.join(baseDir, '.config', 'opencode', 'agents')
          : path.join(baseDir, '.opencode', 'agents'),
        extension: '.md',
        rootInstructionFile: scope === 'global'
          ? path.join(baseDir, '.config', 'opencode', 'instructions.md')
          : path.join(baseDir, '.opencode', 'instructions.md'),
        configFile,
      };
    }

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
