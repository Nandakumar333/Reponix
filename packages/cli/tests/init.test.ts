import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { renderAgents } from '../src/engine/template.js';
import { installSkill } from '../src/install-skill.js';
import type { InitAnswers } from '../src/types.js';

describe('renderAgents and skill installation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reponix-render-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('renders Gemini CLI agents and GEMINI.md in target directory', async () => {
    const answers: InitAnswers = {
      platform: 'gemini-cli',
      scope: 'project',
      suite: 'modernization',
      projectName: 'TestModernize',
      techStack: ['Python', 'Django'],
      targetStack: ['TypeScript', 'Fastify'],
      model: 'gemini-3.8-flash',
      coreAgents: ['reponix-orchestrator', 'repo-analyst', 'arch-mapper'],
      optionalAgents: [],
      installedSkills: ['graphify'],
    };

    const written = await renderAgents(answers, { targetDir: tmpDir });
    expect(written.length).toBeGreaterThanOrEqual(4); // 3 agents + GEMINI.md

    const orchestratorPath = path.join(tmpDir, '.gemini', 'agents', 'reponix-orchestrator.md');
    expect(fs.existsSync(orchestratorPath)).toBe(true);

    const orchestratorContent = fs.readFileSync(orchestratorPath, 'utf-8');
    expect(orchestratorContent).toContain('TestModernize');
    expect(orchestratorContent).toContain('Python, Django');
    expect(orchestratorContent).toContain('TypeScript, Fastify');

    const geminiMdPath = path.join(tmpDir, 'GEMINI.md');
    expect(fs.existsSync(geminiMdPath)).toBe(true);
  });

  it('renders Cursor rules with .mdc extension', async () => {
    const answers: InitAnswers = {
      platform: 'cursor',
      scope: 'project',
      suite: 'intelligence',
      projectName: 'CursorProject',
      techStack: ['Go'],
      model: 'gemini-3.8-flash',
      coreAgents: ['repo-analyst'],
      optionalAgents: [],
      installedSkills: [],
    };

    const written = await renderAgents(answers, { targetDir: tmpDir });
    const rulePath = path.join(tmpDir, '.cursor', 'rules', 'repo-analyst.mdc');
    expect(fs.existsSync(rulePath)).toBe(true);

    const content = fs.readFileSync(rulePath, 'utf-8');
    expect(content).toContain('globs: *');
  });

  it('installs built-in skill into target directory', async () => {
    const dest = await installSkill('graphify', 'gemini-cli', 'project', { targetDir: tmpDir });
    expect(dest).not.toBeNull();
    if (dest) {
      expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
    }
  });
});
