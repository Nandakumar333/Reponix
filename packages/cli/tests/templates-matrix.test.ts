import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { renderAgents } from '../src/engine/template.js';
import type { Platform, OutputFormat, InitAnswers } from '../src/types.js';

describe('Template Matrix Rendering (All 9 Platforms x 3 Output Modes)', () => {
  let tmpDir: string;

  const platforms: Platform[] = [
    'opencode',
    'claude-code',
    'copilot',
    'copilot-cli',
    'codex',
    'cursor',
    'continue',
    'windsurf',
    'gemini-cli',
  ];

  const outputModes: OutputFormat[] = ['legacy', 'okf', 'both'];

  const coreAgents = [
    'reponix-orchestrator',
    'repo-analyst',
    'arch-mapper',
    'code-inspector',
    'modernizer',
    'validator',
  ];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reponix-tpl-matrix-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const mode of outputModes) {
    describe(`Output Mode: ${mode}`, () => {
      for (const platform of platforms) {
        it(`renders all agent templates for platform "${platform}" in mode "${mode}"`, async () => {
          const runDir = path.join(tmpDir, `${platform}-${mode}`);
          fs.mkdirSync(runDir, { recursive: true });

          const answers: InitAnswers = {
            platform,
            scope: 'project',
            suite: 'modernization',
            projectName: `Matrix-${platform}-${mode}`,
            techStack: ['TypeScript', 'Node.js'],
            targetStack: ['Go'],
            model: 'gemini-3.8-flash',
            coreAgents,
            optionalAgents: [],
            installedSkills: ['graphify', 'arch-review', 'modernization', 'okf'],
            output: {
              format: mode,
              okf: {
                version: '0.2',
                root: 'reponix',
                emitV01Timestamp: true,
                sourceLinks: 'relative',
                staleAfterDays: 90,
                recordGitAuthors: false,
              },
            },
          };

          const writtenFiles = await renderAgents(answers, { targetDir: runDir });
          expect(writtenFiles.length).toBeGreaterThan(0);

          for (const filePath of writtenFiles) {
            expect(fs.existsSync(filePath)).toBe(true);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(content.length).toBeGreaterThan(50);

            // Test mode-specific assertions on agent files (ignore root instruction files)
            const isRootInstruction =
              filePath.endsWith('GEMINI.md') ||
              filePath.endsWith('CLAUDE.md') ||
              filePath.endsWith('instructions.md') ||
              filePath.endsWith('.cursorrules') ||
              filePath.endsWith('rules.md') ||
              (filePath.endsWith('AGENTS.md') && platform !== 'codex');

            if (!isRootInstruction) {
              const isOrchestrator = filePath.includes('reponix-orchestrator');

              if (mode === 'legacy') {
                expect(content).not.toContain('Open Knowledge Format (OKF) v0.2 Output Contract');
                if (isOrchestrator) {
                  expect(content).toContain('Repository Intelligence Synthesis');
                  expect(content).not.toContain('OKF Bundle Overview: `overview.md`');
                } else if (platform !== 'codex') {
                  expect(content).toContain('Output Contract');
                }
              } else if (mode === 'okf') {
                expect(content).toContain('Open Knowledge Format (OKF) v0.2 Output Contract');
                if (isOrchestrator) {
                  expect(content).toContain('OKF Bundle Overview: `overview.md`');
                  expect(content).not.toContain('Repository Intelligence Synthesis');
                } else if (platform !== 'codex') {
                  expect(content).not.toContain('Output Contract: `docs/');
                }
              } else if (mode === 'both') {
                expect(content).toContain('Open Knowledge Format (OKF) v0.2 Output Contract');
                if (isOrchestrator) {
                  expect(content).toContain('Repository Intelligence Synthesis');
                  expect(content).toContain('OKF Bundle Overview: `overview.md`');
                } else if (platform !== 'codex') {
                  expect(content).toContain('Output Contract');
                }
              }

              // Platform format checks
              if (platform === 'cursor') {
                expect(filePath.endsWith('.mdc')).toBe(true);
                expect(content).toContain('globs: *');
              } else if (platform === 'opencode') {
                if (filePath.includes('reponix-orchestrator')) {
                  expect(content).toContain('mode: primary');
                } else {
                  expect(content).toContain('mode: subagent');
                }
              } else if (platform === 'copilot' || platform === 'copilot-cli') {
                expect(content).toContain('description:');
              } else if (platform === 'gemini-cli' || platform === 'claude-code') {
                expect(content.startsWith('<!-- Agent:')).toBe(true);
              }
            }
          }
        });
      }
    });
  }
});
