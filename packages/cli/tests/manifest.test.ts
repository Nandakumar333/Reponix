import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createConfigFromAnswers, saveConfig, loadConfig } from '../src/engine/manifest.js';
import type { InitAnswers } from '../src/types.js';

describe('Manifest / Config Manager', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reponix-manifest-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const sampleAnswers: InitAnswers = {
    platform: 'gemini-cli',
    scope: 'project',
    suite: 'modernization',
    projectName: 'DemoApp',
    projectDescription: 'Demo legacy app',
    techStack: ['python'],
    targetStack: ['typescript', 'node'],
    model: 'gemini-3.8-flash',
    coreAgents: ['orchestrator', 'repo-analyst'],
    optionalAgents: [],
    installedSkills: ['graphify'],
  };

  it('creates valid ReponixConfig object from answers', () => {
    const config = createConfigFromAnswers(sampleAnswers);
    expect(config.platform).toBe('gemini-cli');
    expect(config.suite).toBe('modernization');
    expect(config.project.name).toBe('DemoApp');
    expect(config.project.targetLanguage).toEqual(['typescript', 'node']);
    expect(config.agents.core).toContain('orchestrator');
  });

  it('saves and reloads config accurately from disk', () => {
    const savedPath = saveConfig(sampleAnswers, tmpDir);
    expect(fs.existsSync(savedPath)).toBe(true);

    const loaded = loadConfig(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.project.name).toBe('DemoApp');
    expect(loaded?.skills.installed).toContain('graphify');
  });

  it('honors dryRun flag without writing to disk', () => {
    saveConfig(sampleAnswers, tmpDir, true);
    const loaded = loadConfig(tmpDir);
    expect(loaded).toBeNull();
  });
});
