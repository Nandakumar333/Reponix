import { describe, it, expect } from 'vitest';
import { parseFrontmatter, generateRootInstruction } from '../src/engine/template.js';

describe('parseFrontmatter', () => {
  it('correctly parses YAML frontmatter and body', () => {
    const raw = `---
name: reponix-orchestrator
description: Master agent
model: gemini-3.8-flash
---

You are the Reponix-Orchestrator.`;

    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('reponix-orchestrator');
    expect(frontmatter.description).toBe('Master agent');
    expect(body).toBe('You are the Reponix-Orchestrator.');
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
      ['reponix-orchestrator', 'repo-analyst'],
      'gemini-cli',
      { projectName: 'TestApp', techStack: 'TypeScript, React' }
    );

    expect(root).toContain('Multi-Agent Architecture');
    expect(root).toContain('@.gemini/agents/reponix-orchestrator.md');
    expect(root).toContain('@.gemini/agents/repo-analyst.md');
    expect(root).toContain('TestApp');
  });

  it('generates CLAUDE.md with agent references', () => {
    const root = generateRootInstruction(
      ['reponix-orchestrator', 'arch-mapper'],
      'claude-code',
      { projectName: 'LegacyService', techStack: 'Java' }
    );

    expect(root).toContain('Claude Code Instructions');
    expect(root).toContain('.claude/agents/reponix-orchestrator.md');
    expect(root).toContain('LegacyService');
  });

  it('generates instructions.md for opencode identifying primary and subagents', () => {
    const root = generateRootInstruction(
      ['reponix-orchestrator', 'arch-mapper'],
      'opencode',
      { projectName: 'ModernCloud', techStack: 'Python' }
    );

    expect(root).toContain('OpenCode Agent Instructions');
    expect(root).toContain('reponix-orchestrator');
    expect(root).toContain('primary');
    expect(root).toContain('subagent');
    expect(root).toContain('ModernCloud');
  });
});
