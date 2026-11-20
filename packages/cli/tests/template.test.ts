import { describe, it, expect } from 'vitest';
import { parseFrontmatter, generateRootInstruction, transformForPlatform, getPrimaryAgent } from '../src/engine/template.js';

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

describe('getPrimaryAgent', () => {
  it('returns reponix-orchestrator when present', () => {
    expect(getPrimaryAgent(['repo-analyst', 'reponix-orchestrator'])).toBe('reponix-orchestrator');
  });

  it('returns orchestrator when present', () => {
    expect(getPrimaryAgent(['repo-analyst', 'orchestrator'])).toBe('orchestrator');
  });

  it('falls back to the first agent when no orchestrator is present', () => {
    expect(getPrimaryAgent(['repo-analyst', 'arch-mapper', 'validator'])).toBe('repo-analyst');
  });
});

describe('transformForPlatform', () => {
  it('assigns mode: primary to primary agent and mode: subagent to others for opencode', () => {
    const agents = ['reponix-orchestrator', 'repo-analyst'];
    const orch = transformForPlatform('---\ndescription: Master\n---\nBody', 'reponix-orchestrator', 'opencode', agents);
    expect(orch).toContain('mode: primary');

    const analyst = transformForPlatform('---\ndescription: Analyst\n---\nBody', 'repo-analyst', 'opencode', agents);
    expect(analyst).toContain('mode: subagent');
  });

  it('assigns alwaysApply: true to primary agent and alwaysApply: false to others for cursor', () => {
    const agents = ['reponix-orchestrator', 'arch-mapper'];
    const orch = transformForPlatform('---\ndescription: Master\n---\nBody', 'reponix-orchestrator', 'cursor', agents);
    expect(orch).toContain('alwaysApply: true');

    const mapper = transformForPlatform('---\ndescription: Mapper\n---\nBody', 'arch-mapper', 'cursor', agents);
    expect(mapper).toContain('alwaysApply: false');
  });

  it('assigns trigger: always_on to primary agent and trigger: model_decision to others for windsurf', () => {
    const agents = ['reponix-orchestrator', 'arch-mapper'];
    const orch = transformForPlatform('---\ndescription: Master\n---\nBody', 'reponix-orchestrator', 'windsurf', agents);
    expect(orch).toContain('trigger: always_on');

    const mapper = transformForPlatform('---\ndescription: Mapper\n---\nBody', 'arch-mapper', 'windsurf', agents);
    expect(mapper).toContain('trigger: model_decision');
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
