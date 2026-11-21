import { describe, it, expect } from 'vitest';
import { getPlatformPaths } from '../src/platforms/index.js';
import type { Platform } from '../src/types.js';

describe('getPlatformPaths', () => {
  const platforms: Platform[] = [
    'antigravity',
    'gemini-cli',
    'claude-code',
    'cursor',
    'opencode',
    'copilot',
    'copilot-cli',
    'codex',
    'continue',
    'windsurf',
  ];

  it('resolves valid paths for all supported platforms in project scope', () => {
    for (const platform of platforms) {
      const paths = getPlatformPaths(platform, 'project', '/mock/project');
      expect(paths.agentsDir).toBeDefined();
      expect(paths.extension).toBeDefined();
    }
  });

  it('correctly maps Antigravity paths in project and global scope', () => {
    const projectPaths = getPlatformPaths('antigravity', 'project', '/mock/project');
    expect(projectPaths.agentsDir).toContain('.agents');
    expect(projectPaths.extension).toBe('.md');
    expect(projectPaths.rootInstructionFile).toContain('AGENTS.md');

    const globalPaths = getPlatformPaths('antigravity', 'global', '/mock/home');
    expect(globalPaths.agentsDir).toContain('.gemini');
    expect(globalPaths.agentsDir).toContain('antigravity');
    expect(globalPaths.extension).toBe('.md');
  });

  it('correctly maps Gemini CLI paths', () => {
    const paths = getPlatformPaths('gemini-cli', 'project', '/mock/project');
    expect(paths.agentsDir).toContain('.gemini');
    expect(paths.extension).toBe('.md');
    expect(paths.rootInstructionFile).toContain('GEMINI.md');
  });

  it('correctly maps Claude Code paths', () => {
    const paths = getPlatformPaths('claude-code', 'project', '/mock/project');
    expect(paths.agentsDir).toContain('.claude');
    expect(paths.extension).toBe('.md');
    expect(paths.rootInstructionFile).toContain('CLAUDE.md');
  });

  it('correctly maps Cursor paths', () => {
    const paths = getPlatformPaths('cursor', 'project', '/mock/project');
    expect(paths.agentsDir).toContain('.cursor');
    expect(paths.extension).toBe('.mdc');
    expect(paths.rootInstructionFile).toContain('.cursorrules');
  });

  it('correctly maps OpenCode paths with opencode.json config file', () => {
    const paths = getPlatformPaths('opencode', 'project', '/mock/project');
    expect(paths.agentsDir).toContain('.opencode');
    expect(paths.extension).toBe('.md');
    expect(paths.rootInstructionFile).toContain('instructions.md');
    expect(paths.configFile).toContain('opencode.json');
  });

  it('correctly maps Codex paths with merged file', () => {
    const paths = getPlatformPaths('codex', 'project', '/mock/project');
    expect(paths.mergedFile).toBe(true);
    expect(paths.configFile).toBe('AGENTS.md');
  });
});
