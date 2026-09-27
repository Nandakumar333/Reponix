import { describe, it, expect } from 'vitest';
import { getPlatformPaths } from '../src/platforms/index.js';
import type { Platform } from '../src/types.js';

describe('getPlatformPaths', () => {
  const platforms: Platform[] = [
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

  it('correctly maps Codex paths with merged file', () => {
    const paths = getPlatformPaths('codex', 'project', '/mock/project');
    expect(paths.mergedFile).toBe(true);
    expect(paths.configFile).toBe('AGENTS.md');
  });
});
