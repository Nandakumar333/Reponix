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

  it('renders OpenCode agents with reponix-orchestrator as primary agent, subagents as subagent, and creates opencode.json', async () => {
    const answers: InitAnswers = {
      platform: 'opencode',
      scope: 'project',
      suite: 'intelligence',
      projectName: 'OpenCodeProject',
      techStack: ['Node.js', 'Express'],
      model: 'gemini-3.8-flash',
      coreAgents: ['reponix-orchestrator', 'repo-analyst'],
      optionalAgents: [],
      installedSkills: [],
    };

    const written = await renderAgents(answers, { targetDir: tmpDir });
    expect(written.length).toBeGreaterThanOrEqual(4); // 2 agents + instructions.md + opencode.json

    const orchestratorPath = path.join(tmpDir, '.opencode', 'agents', 'reponix-orchestrator.md');
    expect(fs.existsSync(orchestratorPath)).toBe(true);
    const orchestratorContent = fs.readFileSync(orchestratorPath, 'utf-8');
    expect(orchestratorContent).toContain('mode: primary');
    expect(orchestratorContent).toContain('description:');

    const analystPath = path.join(tmpDir, '.opencode', 'agents', 'repo-analyst.md');
    expect(fs.existsSync(analystPath)).toBe(true);
    const analystContent = fs.readFileSync(analystPath, 'utf-8');
    expect(analystContent).toContain('mode: subagent');

    const instructionsPath = path.join(tmpDir, '.opencode', 'instructions.md');
    expect(fs.existsSync(instructionsPath)).toBe(true);
    const instructionsContent = fs.readFileSync(instructionsPath, 'utf-8');
    expect(instructionsContent).toContain('primary agent');

    // opencode.json verification
    const configPath = path.join(tmpDir, 'opencode.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.default_agent).toBe('reponix-orchestrator');
    expect(config.agent['reponix-orchestrator'].mode).toBe('primary');
    expect(config.agent['repo-analyst'].mode).toBe('subagent');
  });

  it('correctly sets first agent as primary in opencode.json and agent files when orchestrator is not present', async () => {
    const answers: InitAnswers = {
      platform: 'opencode',
      scope: 'project',
      suite: 'intelligence',
      projectName: 'NoOrchestratorProject',
      techStack: ['Python'],
      model: 'gemini-3.8-flash',
      coreAgents: ['repo-analyst', 'arch-mapper', 'validator'],
      optionalAgents: [],
      installedSkills: [],
    };

    const written = await renderAgents(answers, { targetDir: tmpDir });
    const configPath = path.join(tmpDir, 'opencode.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.default_agent).toBe('repo-analyst');
    expect(config.agent['repo-analyst'].mode).toBe('primary');
    expect(config.agent['arch-mapper'].mode).toBe('subagent');
    expect(config.agent['validator'].mode).toBe('subagent');

    const analystPath = path.join(tmpDir, '.opencode', 'agents', 'repo-analyst.md');
    expect(fs.existsSync(analystPath)).toBe(true);
    const analystContent = fs.readFileSync(analystPath, 'utf-8');
    expect(analystContent).toContain('mode: primary');
  });

  it('installs the okf skill and preserves output configuration', async () => {
    const dest = await installSkill('okf', 'gemini-cli', 'project', { targetDir: tmpDir });
    expect(dest).not.toBeNull();
    if (dest) {
      expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'reference', 'SPEC.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'reference', 'profile.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'reference', 'types.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'NOTICE'))).toBe(true);
    }
  });

  it('defaults to okf format and renders OKF contract when output is omitted', async () => {
    const answers: InitAnswers = {
      platform: 'gemini-cli',
      scope: 'project',
      suite: 'intelligence',
      projectName: 'DefaultOkfProject',
      techStack: ['TypeScript'],
      model: 'gemini-3.8-flash',
      coreAgents: ['code-inspector'],
      optionalAgents: [],
      installedSkills: ['okf'],
      // output omitted to test default
    };

    const written = await renderAgents(answers, { targetDir: tmpDir });
    expect(written.length).toBeGreaterThanOrEqual(1);

    const inspectorPath = path.join(tmpDir, '.gemini', 'agents', 'code-inspector.md');
    expect(fs.existsSync(inspectorPath)).toBe(true);

    const content = fs.readFileSync(inspectorPath, 'utf-8');
    expect(content).toContain('Open Knowledge Format (OKF) v0.2 Output Contract');
    expect(content).toContain('- **Owning Subtree:** `contracts/`');
    expect(content).not.toContain('## 3. Output Contract: `docs/contracts.md`');
  });
});
