import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import {
  isGitRepo,
  getCurrentCommitSha,
  getRemoteOriginUrl,
  normalizeRepoWebUrl,
  buildPermalink,
  parsePermalink,
  getFileGitMetadata,
  hasFileChangedSinceCommit,
} from '../src/okf/git.js';
import {
  checkConceptStaleness,
  checkBundleStaleness,
  formatStaleReport,
} from '../src/okf/stale.js';
import { addHumanVerification } from '../src/okf/trust.js';
import { loadBundle } from '../src/okf/bundle.js';
import { finalizeBundle } from '../src/okf/finalize.js';
import { parseRawDocument, serializeConcept } from '../src/okf/parse.js';
import { appendRawLogEntries } from '../src/okf/log.js';

describe('Phase 3: OKF Trust, Provenance, and Staleness Pipeline', () => {
  let tmpDir: string;
  let repoDir: string;
  let bundleDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reponix-p3-test-'));
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
    execSync('git config user.name "Alice Dev"', { cwd: repoDir, stdio: 'pipe' });
    execSync('git config user.email "alice@example.com"', { cwd: repoDir, stdio: 'pipe' });
  }

  describe('Git detection and URL parsing', () => {
    it('detects git repositories accurately', () => {
      expect(isGitRepo(repoDir)).toBe(false);
      setupGitRepo();
      expect(isGitRepo(repoDir)).toBe(true);
    });

    it('normalizes GitHub SSH and HTTPS URLs', () => {
      const sshRes = normalizeRepoWebUrl('git@github.com:octocat/Hello-World.git');
      expect(sshRes).toEqual({
        type: 'github',
        webUrl: 'https://github.com/octocat/Hello-World',
      });

      const httpsRes = normalizeRepoWebUrl('https://github.com/octocat/Hello-World.git');
      expect(httpsRes).toEqual({
        type: 'github',
        webUrl: 'https://github.com/octocat/Hello-World',
      });
    });

    it('normalizes GitLab SSH and HTTPS URLs', () => {
      const sshRes = normalizeRepoWebUrl('git@gitlab.com:gitlab-org/gitlab.git');
      expect(sshRes).toEqual({
        type: 'gitlab',
        webUrl: 'https://gitlab.com/gitlab-org/gitlab',
      });

      const httpsRes = normalizeRepoWebUrl('https://gitlab.com/gitlab-org/gitlab.git');
      expect(httpsRes).toEqual({
        type: 'gitlab',
        webUrl: 'https://gitlab.com/gitlab-org/gitlab',
      });
    });

    it('builds correct permalinks for GitHub and GitLab', () => {
      const ghPermalink = buildPermalink(
        'https://github.com/octocat/Hello-World',
        'github',
        'abcdef1234567890',
        'src/index.ts',
        '#L10-L20'
      );
      expect(ghPermalink).toBe(
        'https://github.com/octocat/Hello-World/blob/abcdef1234567890/src/index.ts#L10-L20'
      );

      const glPermalink = buildPermalink(
        'https://gitlab.com/gitlab-org/gitlab',
        'gitlab',
        'abcdef1234567890',
        'src/index.ts',
        '#L10-L20'
      );
      expect(glPermalink).toBe(
        'https://gitlab.com/gitlab-org/gitlab/-/blob/abcdef1234567890/src/index.ts#L10-L20'
      );
    });

    it('parses GitHub and GitLab permalinks back to repo relative path', () => {
      const ghParsed = parsePermalink(
        'https://github.com/octocat/Hello-World/blob/abcdef1234567890/src/utils/math.ts#L5-L10'
      );
      expect(ghParsed).toEqual({
        commitSha: 'abcdef1234567890',
        repoRelativePath: 'src/utils/math.ts',
        fragment: '#L5-L10',
      });

      const glParsed = parsePermalink(
        'https://gitlab.com/gitlab-org/gitlab/-/blob/1234567890abcdef/lib/api.rb#L1'
      );
      expect(glParsed).toEqual({
        commitSha: '1234567890abcdef',
        repoRelativePath: 'lib/api.rb',
        fragment: '#L1',
      });
    });
  });

  describe('Trust: addHumanVerification', () => {
    it('appends human verification and upgrades status to stable', () => {
      const conceptContent = `---
type: Architecture
title: Payment Flow
status: draft
generated: { by: reponix-arch-mapper/model, at: 2026-06-01T00:00:00Z }
---

# Architecture
`;
      const conceptFile = path.join(bundleDir, 'payment.md');
      fs.writeFileSync(conceptFile, conceptContent, 'utf-8');

      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const concept = bundle.concepts.get('payment.md')!;

      addHumanVerification(concept, 'human:alice', new Date('2026-06-15T10:00:00Z'));

      expect(concept.frontmatter.status).toBe('stable');
      const verifiedList = Array.isArray(concept.frontmatter.verified)
        ? concept.frontmatter.verified
        : [concept.frontmatter.verified];
      expect(verifiedList).toContainEqual({
        by: 'human:alice',
        at: '2026-06-15T10:00:00Z',
      });
    });

    it('rejects verification if actor does not start with human:', () => {
      const conceptContent = `---
type: Architecture
title: Payment Flow
---
# Body
`;
      const conceptFile = path.join(bundleDir, 'payment.md');
      fs.writeFileSync(conceptFile, conceptContent, 'utf-8');

      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const concept = bundle.concepts.get('payment.md')!;

      expect(() => {
        addHumanVerification(concept, 'agent:validator');
      }).toThrow('Actor identifier must begin with "human:"');

      expect(() => {
        addHumanVerification(concept, 'alice');
      }).toThrow('Actor identifier must begin with "human:"');
    });

    it('logs verification action via appendRawLogEntries', () => {
      const bundle = loadBundle(bundleDir, { repoRoot: repoDir, allowMissing: true });
      appendRawLogEntries(
        bundle,
        ['* **Verification**: Verified [Payment Flow](/payment.md) by human:alice.'],
        new Date('2026-06-15'),
        true
      );

      const logPath = path.join(bundleDir, 'log.md');
      expect(fs.existsSync(logPath)).toBe(true);
      const logContent = fs.readFileSync(logPath, 'utf-8');
      expect(logContent).toContain('## 2026-06-15');
      expect(logContent).toContain('Verified [Payment Flow](/payment.md) by human:alice');
    });
  });

  describe('Staleness checking', () => {
    it('flags time-expired concepts', () => {
      const conceptContent = `---
type: Reference
title: Old Config
stale_after: 2026-01-01T00:00:00Z
---
# Config
`;
      const conceptFile = path.join(bundleDir, 'old.md');
      fs.writeFileSync(conceptFile, conceptContent, 'utf-8');

      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const concept = bundle.concepts.get('old.md')!;

      const staleRes = checkConceptStaleness(
        concept,
        bundle,
        new Date('2026-06-01T00:00:00Z'),
        false
      );

      expect(staleRes).not.toBeNull();
      expect(staleRes?.isTimeStale).toBe(true);
      expect(staleRes?.reasons[0]).toContain('Past stale_after timestamp: 2026-01-01T00:00:00Z');
    });

    it('does not flag concepts before stale_after', () => {
      const conceptContent = `---
type: Reference
title: Fresh Config
stale_after: 2026-12-31T00:00:00Z
---
# Config
`;
      const conceptFile = path.join(bundleDir, 'fresh.md');
      fs.writeFileSync(conceptFile, conceptContent, 'utf-8');

      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });
      const concept = bundle.concepts.get('fresh.md')!;

      const staleRes = checkConceptStaleness(
        concept,
        bundle,
        new Date('2026-06-01T00:00:00Z'),
        false
      );

      expect(staleRes).toBeNull();
    });

    it('detects git-modified cited files since recorded commit', () => {
      setupGitRepo();

      // Create a source file in repo
      const srcFile = path.join(repoDir, 'src', 'calc.ts');
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, 'export function add(a: number, b: number) { return a + b; }\n', 'utf-8');

      // Commit 1
      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "initial commit"', { cwd: repoDir, stdio: 'pipe' });
      const commit1 = getCurrentCommitSha(repoDir)!;

      // Create concept citing src/calc.ts at commit 1
      const conceptContent = `---
type: Contract
title: Calculator API
stale_after: 2027-01-01T00:00:00Z
sources:
  - id: calc-src
    resource: /src/calc.ts
reponix:
  commit: ${commit1}
  agent: code-inspector
---

# Calculator

The calculator provides addition.[^calc-src]

[^calc-src]: Source implementation
`;
      const contractsDir = path.join(bundleDir, 'contracts');
      fs.mkdirSync(contractsDir, { recursive: true });
      const conceptFile = path.join(contractsDir, 'calc.md');
      fs.writeFileSync(conceptFile, conceptContent, 'utf-8');

      const bundle = loadBundle(bundleDir, { repoRoot: repoDir });

      // Before modifying src/calc.ts, should not be stale
      let results = checkBundleStaleness(bundle, new Date('2026-06-01'));
      expect(results.length).toBe(0);

      // Now modify src/calc.ts and commit 2
      fs.appendFileSync(srcFile, 'export function multiply(a: number, b: number) { return a * b; }\n');
      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "add multiply function"', { cwd: repoDir, stdio: 'pipe' });

      // After commit 2, concept should be flagged as git-stale
      results = checkBundleStaleness(bundle, new Date('2026-06-01'));
      expect(results.length).toBe(1);
      expect(results[0].isGitStale).toBe(true);
      expect(results[0].owningAgent).toBe('code-inspector');
      expect(results[0].changedFiles).toEqual(['/src/calc.ts']);

      // Format report
      const jsonReport = JSON.parse(formatStaleReport(results, 'json'));
      expect(jsonReport.totalStale).toBe(1);
      expect(jsonReport.staleConcepts[0].id).toBe('contracts/calc');
    });
  });

  describe('Provenance enrichment in finalizeBundle', () => {
    it('populates git author and last_modified when recordGitAuthors is true', async () => {
      setupGitRepo();

      const srcFile = path.join(repoDir, 'src', 'auth.ts');
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, '// Authentication logic\nexport const AUTH = true;\n', 'utf-8');

      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "feat: auth service"', { cwd: repoDir, stdio: 'pipe' });

      const conceptContent = `---
type: Architecture
title: Auth Service
sources:
  - id: auth-code
    resource: /src/auth.ts
---

# Auth

Auth details.[^auth-code]

[^auth-code]: Auth implementation
`;
      fs.writeFileSync(path.join(bundleDir, 'auth.md'), conceptContent, 'utf-8');

      const { bundle } = await finalizeBundle({
        bundleDir,
        repoRoot: repoDir,
        recordGitAuthors: true,
      });

      const updated = bundle.concepts.get('auth.md')!;
      const src = updated.frontmatter.sources![0];
      expect(src.author).toBe('human:Alice Dev');
      expect(src.last_modified).toBeDefined();
      expect(src.last_modified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(updated.frontmatter.reponix?.commit).toBeDefined();
    });

    it('rewrites repo-relative source links to GitHub permalinks when sourceLinks is permalink', async () => {
      setupGitRepo();
      execSync('git remote add origin https://github.com/my-org/my-service.git', {
        cwd: repoDir,
        stdio: 'pipe',
      });

      const srcFile = path.join(repoDir, 'src', 'db.ts');
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, '// Database pool\nexport const DB = 1;\n', 'utf-8');

      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "feat: database"', { cwd: repoDir, stdio: 'pipe' });
      const sha = getCurrentCommitSha(repoDir)!;

      const conceptContent = `---
type: Architecture
title: Database
sources:
  - id: db-code
    resource: /src/db.ts#L1-L2
---

# Database

Database connections.[^db-code]

[^db-code]: Database pool
`;
      fs.writeFileSync(path.join(bundleDir, 'db.md'), conceptContent, 'utf-8');

      const { bundle, summary } = await finalizeBundle({
        bundleDir,
        repoRoot: repoDir,
        sourceLinks: 'permalink',
      });

      expect(summary.success).toBe(true);
      const updated = bundle.concepts.get('db.md')!;
      const src = updated.frontmatter.sources![0];
      expect(src.resource).toBe(
        `https://github.com/my-org/my-service/blob/${sha}/src/db.ts#L1-L2`
      );
    });

    it('rewrites repo-relative source links to GitLab permalinks when sourceLinks is permalink', async () => {
      setupGitRepo();
      execSync('git remote add origin git@gitlab.com:enterprise/platform.git', {
        cwd: repoDir,
        stdio: 'pipe',
      });

      const srcFile = path.join(repoDir, 'src', 'queue.ts');
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, '// Queue worker\nexport const QUEUE = 1;\n', 'utf-8');

      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "feat: queue"', { cwd: repoDir, stdio: 'pipe' });
      const sha = getCurrentCommitSha(repoDir)!;

      const conceptContent = `---
type: Architecture
title: Queue
sources:
  - id: queue-code
    resource: /src/queue.ts#L1
---

# Queue

Message queue.[^queue-code]

[^queue-code]: Queue worker
`;
      fs.writeFileSync(path.join(bundleDir, 'queue.md'), conceptContent, 'utf-8');

      const { bundle, summary } = await finalizeBundle({
        bundleDir,
        repoRoot: repoDir,
        sourceLinks: 'permalink',
      });

      expect(summary.success).toBe(true);
      const updated = bundle.concepts.get('queue.md')!;
      const src = updated.frontmatter.sources![0];
      expect(src.resource).toBe(
        `https://gitlab.com/enterprise/platform/-/blob/${sha}/src/queue.ts#L1`
      );
    });
  });
});
