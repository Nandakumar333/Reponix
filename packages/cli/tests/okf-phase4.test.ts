import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { loadBundle } from '../src/okf/bundle.js';
import { finalizeBundle } from '../src/okf/finalize.js';
import { scanTextForSecrets, scanConceptForSecrets } from '../src/okf/secrets.js';
import { generateOkfManifest, readOkfManifest, writeOkfManifest } from '../src/okf/manifest.js';
import { generateUpdatePlan, formatUpdatePlanReport } from '../src/okf/plan.js';
import { migrateLegacyDocs, slugify, splitMarkdownSections } from '../src/okf/migrate.js';
import { packBundleToMarkdown, packBundleToJson, packBundleToTar, packBundle } from '../src/okf/pack.js';

describe('Phase 4: OKF Migration, Packing, and Incremental Updates', () => {
  let tmpDir: string;
  let repoDir: string;
  let bundleDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reponix-p4-test-'));
    repoDir = path.join(tmpDir, 'repo');
    bundleDir = path.join(repoDir, 'reponix');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(bundleDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors on Windows
    }
  });

  function setupGitRepo(): void {
    execSync('git init', { cwd: repoDir, stdio: 'pipe' });
    execSync('git config user.name "Tester"', { cwd: repoDir, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: repoDir, stdio: 'pipe' });
  }

  describe('Secret Scanning', () => {
    it('detects and redacts AWS access keys', () => {
      const text = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE\nother content';
      const results = scanTextForSecrets(text);
      expect(results.length).toBe(1);
      expect(results[0].rule).toBe('AWS Access Key ID');
      expect(results[0].redacted).toBe('AKIA****************');
      expect(results[0].line).toBe(1);
    });

    it('detects GitHub personal access tokens', () => {
      const text = 'token: ghp_123456789012345678901234567890123456';
      const results = scanTextForSecrets(text);
      expect(results.length).toBe(1);
      expect(results[0].rule).toBe('GitHub Token');
      expect(results[0].redacted.startsWith('ghp_')).toBe(true);
    });

    it('detects Google API keys, Slack tokens, and Private Key headers', () => {
      const google = 'apiKey: AIzaSyA1234567890123456789012345678901';
      expect(scanTextForSecrets(google).some(r => r.rule === 'Google API Key')).toBe(true);

      const slack = 'slack_token = xoxb-123456789012-1234567890123-abcdef123456';
      expect(scanTextForSecrets(slack).some(r => r.rule === 'Slack Token')).toBe(true);

      const privKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...';
      expect(scanTextForSecrets(privKey).some(r => r.rule === 'Private Key Block')).toBe(true);
    });

    it('causes finalizeBundle to abort when a concept contains secrets', async () => {
      const conceptContent = `---
type: Reference
title: Credentials Doc
---

# Config
Here is the API key: AKIAIOSFODNN7EXAMPLE
`;
      fs.writeFileSync(path.join(bundleDir, 'creds.md'), conceptContent, 'utf-8');

      await expect(
        finalizeBundle({
          bundleDir,
          repoRoot: repoDir,
        })
      ).rejects.toThrow(/Secret scanning failed! Refusing to finalize/);
    });
  });

  describe('Manifest & Incremental Update Planning', () => {
    it('generates and stores .reponix/okf-manifest.json with source mappings and hashes', async () => {
      setupGitRepo();

      const srcFile = path.join(repoDir, 'src', 'payment.ts');
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, 'export function pay() {}\n', 'utf-8');

      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "feat: payment"', { cwd: repoDir, stdio: 'pipe' });

      const conceptContent = `---
type: Contract
title: Payment Contract
sources:
  - id: pay-src
    resource: /src/payment.ts
---

# Payment
Calls payment logic.[^pay-src]

[^pay-src]: Payment implementation
`;
      const contractsDir = path.join(bundleDir, 'contracts');
      fs.mkdirSync(contractsDir, { recursive: true });
      fs.writeFileSync(path.join(contractsDir, 'payment.md'), conceptContent, 'utf-8');

      const { bundle } = await finalizeBundle({
        bundleDir,
        repoRoot: repoDir,
      });

      const manifest = readOkfManifest(repoDir);
      expect(manifest).not.toBeNull();
      expect(manifest?.version).toBe('0.2.0');
      expect(manifest?.lastCommit).toBeDefined();
      expect(manifest?.mappings['src/payment.ts']).toContain('contracts/payment.md');
      expect(manifest?.conceptHashes['contracts/payment.md']).toBeDefined();
    });

    it('generates update plan identifying changed source files and agents to run', () => {
      setupGitRepo();

      const srcFile = path.join(repoDir, 'src', 'auth.ts');
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, 'export const AUTH = 1;\n', 'utf-8');

      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: repoDir, stdio: 'pipe' });
      const baseCommit = execSync('git rev-parse HEAD', { cwd: repoDir, encoding: 'utf-8' }).trim();

      // Create concept in bundle
      const conceptContent = `---
type: Architecture
title: Auth Architecture
reponix:
  agent: arch-mapper
sources:
  - id: auth-src
    resource: /src/auth.ts
---
# Auth
Auth details.[^auth-src]
[^auth-src]: Source
`;
      const archDir = path.join(bundleDir, 'architecture');
      fs.mkdirSync(archDir, { recursive: true });
      fs.writeFileSync(path.join(archDir, 'auth.md'), conceptContent, 'utf-8');

      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });

      // Mock manifest
      const manifest = {
        version: '0.2.0',
        lastCommit: baseCommit,
        lastUpdated: '2026-06-01T00:00:00Z',
        mappings: {
          'src/auth.ts': ['architecture/auth.md'],
        },
        conceptHashes: {
          'architecture/auth.md': 'hash123',
        },
      };
      writeOkfManifest(repoDir, manifest);

      // Modify src/auth.ts
      fs.appendFileSync(srcFile, 'export const NEW_AUTH = 2;\n');
      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "update auth"', { cwd: repoDir, stdio: 'pipe' });

      const plan = generateUpdatePlan(bundle, manifest);
      expect(plan.changedFiles).toContain('src/auth.ts');
      expect(plan.affectedConcepts).toContain('architecture/auth.md');
      expect(plan.agentsToRun).toContain('arch-mapper');

      const textReport = formatUpdatePlanReport(plan, 'text');
      expect(textReport).toContain('Changed Source Files');
      expect(textReport).toContain('src/auth.ts');
      expect(textReport).toContain('Affected OKF Concepts (1)');
      expect(textReport).toContain('arch-mapper');

      const jsonReport = JSON.parse(formatUpdatePlanReport(plan, 'json'));
      expect(jsonReport.affectedConcepts).toContain('architecture/auth.md');
    });
  });

  describe('Legacy Docs Migration', () => {
    let docsDir: string;

    beforeEach(() => {
      docsDir = path.join(repoDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });

      fs.writeFileSync(
        path.join(docsDir, 'README.md'),
        '# Repository Overview\n\nThis is a sample project for migration testing.\n',
        'utf-8'
      );

      fs.writeFileSync(
        path.join(docsDir, 'contracts.md'),
        '# User API\nEndpoint for users in `src/api/users.ts`.\n\n# Orders API\nEndpoint for orders in `src/api/orders.ts`.\n',
        'utf-8'
      );

      fs.writeFileSync(
        path.join(docsDir, 'architecture.md'),
        '# System Architecture\nHigh level architecture.\n\n# Data Flow\nData pipeline stages.\n',
        'utf-8'
      );

      fs.writeFileSync(
        path.join(docsDir, 'inventory.md'),
        '# Tech Stack\nNode.js and TypeScript.\n',
        'utf-8'
      );

      fs.writeFileSync(
        path.join(docsDir, 'reconstruction-spec.md'),
        '# Build Procedure\nRun npm install and npm build.\n',
        'utf-8'
      );

      fs.writeFileSync(
        path.join(docsDir, 'validation-report.md'),
        '# Validation\nAll tests passed.\n',
        'utf-8'
      );
    });

    it('slugifies titles and splits markdown sections correctly', () => {
      expect(slugify('/api/v1/users')).toBe('apiv1users');
      expect(slugify('System Architecture (Core)')).toBe('system-architecture-core');

      const md = '# Section One\nBody 1\n\n## Section Two\nBody 2\n';
      const sections = splitMarkdownSections(md, 1, 2);
      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe('Section One');
      expect(sections[1].title).toBe('Section Two');
    });

    it('previews migration files without writing when dryRun is true', async () => {
      const result = await migrateLegacyDocs({
        inputDir: docsDir,
        outputDir: bundleDir,
        repoRoot: repoDir,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.files.length).toBeGreaterThanOrEqual(6);
      expect(result.files.some(f => f.relativePath === 'overview.md')).toBe(true);
      expect(result.files.some(f => f.relativePath.startsWith('contracts/'))).toBe(true);
      expect(result.files.some(f => f.relativePath.startsWith('architecture/'))).toBe(true);

      // Verify no files written yet
      expect(fs.existsSync(path.join(bundleDir, 'overview.md'))).toBe(false);
    });

    it('executes migration and finalizes resulting OKF bundle', async () => {
      const result = await migrateLegacyDocs({
        inputDir: docsDir,
        outputDir: bundleDir,
        repoRoot: repoDir,
        dryRun: false,
      });

      expect(result.dryRun).toBe(false);
      expect(fs.existsSync(path.join(bundleDir, 'overview.md'))).toBe(true);
      expect(fs.existsSync(path.join(bundleDir, 'index.md'))).toBe(true);
      expect(fs.existsSync(path.join(bundleDir, 'log.md'))).toBe(true);
      expect(fs.existsSync(path.join(bundleDir, 'contracts', 'index.md'))).toBe(true);

      // Validate the migrated bundle loads cleanly
      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      expect(bundle.concepts.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Single-Artifact Packing', () => {
    beforeEach(() => {
      fs.writeFileSync(
        path.join(bundleDir, 'c1.md'),
        '---\ntype: Architecture\ntitle: Architecture Concept\n---\n# Arch\nDetails.\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(bundleDir, 'c2.md'),
        '---\ntype: Contract\ntitle: API Contract\n---\n# API\nContract details.\n',
        'utf-8'
      );
    });

    it('packs bundle to single markdown file with TOC and concept delimiters', () => {
      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const md = packBundleToMarkdown(bundle);

      expect(md).toContain('# Open Knowledge Format (OKF) Bundle');
      expect(md).toContain('## Table of Contents');
      expect(md).toContain('<!-- concept: c1.md -->');
      expect(md).toContain('<!-- concept: c2.md -->');
      expect(md).toContain('Architecture Concept');
      expect(md).toContain('API Contract');
    });

    it('packs bundle to structured JSON format', () => {
      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const jsonStr = packBundleToJson(bundle);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.okf_version).toBe('0.2');
      expect(parsed.concepts.length).toBe(2);
      expect(parsed.concepts[0].frontmatter.type).toBeDefined();
    });

    it('packs bundle to valid POSIX tar archive with ustar headers', () => {
      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const tarBuf = packBundleToTar(bundle, false);

      expect(tarBuf.length).toBeGreaterThanOrEqual(1536); // At least 1 file header + content + 1024 zero tail
      expect(tarBuf.length % 512).toBe(0);

      // Verify ustar magic at offset 257 in first header
      const magic = tarBuf.subarray(257, 263).toString('ascii');
      expect(magic).toBe('ustar\0');
    });

    it('packs bundle to gzipped tar (.tar.gz)', () => {
      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const gzBuf = packBundleToTar(bundle, true);

      // Verify gzip magic bytes (0x1f, 0x8b)
      expect(gzBuf[0]).toBe(0x1f);
      expect(gzBuf[1]).toBe(0x8b);

      const unzipped = zlib.gunzipSync(gzBuf);
      expect(unzipped.length % 512).toBe(0);
      const magic = unzipped.subarray(257, 263).toString('ascii');
      expect(magic).toBe('ustar\0');
    });

    it('writes packed file to disk via packBundle', () => {
      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const outPath = path.join(tmpDir, 'bundle-export.md');

      packBundle(bundle, {
        format: 'markdown',
        outFile: outPath,
      });

      expect(fs.existsSync(outPath)).toBe(true);
      const read = fs.readFileSync(outPath, 'utf-8');
      expect(read).toContain('<!-- concept: c1.md -->');
    });
  });
});
