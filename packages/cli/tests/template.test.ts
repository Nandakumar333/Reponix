import { describe, it, expect } from 'vitest';
import { parseFrontmatter, generateRootInstruction } from '../src/engine/template.js';

describe('parseFrontmatter', () => {
  it('correctly parses YAML frontmatter and body', () => {
    const raw = `---
name: orchestrator
description: Master agent
model: gemini-3.8-flash
---

You are the Orchestrator.`;

    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('orchestrator');
    expect(frontmatter.description).toBe('Master agent');
    expect(body).toBe('You are the Orchestrator.');
  });

  it('handles markdown without frontmatter gracefully', () => {
    const raw = `Just regular markdown body.`;
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({});
    expect(body).toBe('Just regular markdown body.');
  });
});

describe('generateRootInstruction', () => {
  it('generates GEMINI.md with @ imports', () => {
    const root = generateRootInstruction(
      ['orchestrator', 'repo-analyst'],
      'gemini-cli',
      { projectName: 'TestApp', techStack: 'TypeScript, React' }
    );

    expect(root).toContain('Multi-Agent Architecture');
    expect(root).toContain('@.gemini/agents/orchestrator.md');
    expect(root).toContain('@.gemini/agents/repo-analyst.md');
    expect(root).toContain('TestApp');
  });

  it('generates CLAUDE.md with agent references', () => {
    const root = generateRootInstruction(
      ['orchestrator', 'arch-mapper'],
      'claude-code',
      { projectName: 'LegacyService', techStack: 'Java' }
    );

    expect(root).toContain('Claude Code Instructions');
    expect(root).toContain('.claude/agents/orchestrator.md');
    expect(root).toContain('LegacyService');
  });
});
