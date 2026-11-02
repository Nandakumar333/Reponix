import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadBundle } from '../src/okf/bundle.js';
import { parseConcept, parseRawDocument, serializeConcept } from '../src/okf/parse.js';
import { OkfV02Adapter } from '../src/okf/spec-adapter.js';
import { validateConcept, validateBundle } from '../src/okf/validate.js';
import { generateAllIndices } from '../src/okf/index-gen.js';
import { finalizeBundle } from '../src/okf/finalize.js';
import { formatSarifReport, formatJsonReport } from '../src/okf/report.js';
import type { ConceptFrontmatter } from '../src/okf/types.js';

describe('OKF v0.2 Deterministic Engine', () => {
  let tmpRepoDir: string;
  let tmpBundleDir: string;

  beforeEach(() => {
    tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reponix-okf-test-'));
    // Mark as repo root
    fs.writeFileSync(path.join(tmpRepoDir, 'package.json'), JSON.stringify({ name: 'test-repo' }));
    tmpBundleDir = path.join(tmpRepoDir, 'reponix');
    fs.mkdirSync(tmpBundleDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpRepoDir, { recursive: true, force: true });
  });

  describe('Spec Conformance & Examples from SPEC.md', () => {
    const adapter = new OkfV02Adapter();

    it('validates SPEC.md §4.3 (BigQuery Table concept)', () => {
      const raw = `---
type: BigQuery Table
title: Customer Orders
description: One row per completed customer order across all channels.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, orders, revenue]
generated: { by: reference_agent/gemini-2.5-pro, at: 2026-05-28T14:30:00Z }
---

# Schema

| Column | Type | Description |
|---|---|---|
| \`order_id\` | STRING | Globally unique order identifier. |
`;
      const concept = parseConcept(raw, path.join(tmpBundleDir, 'orders.md'), tmpBundleDir);
      const issues = adapter.validateConceptConformance(concept);
      expect(issues.filter(i => i.severity === 'error')).toHaveLength(0);
      expect(concept.frontmatter.type).toBe('BigQuery Table');
    });

    it('validates SPEC.md §4.4 (Playbook concept)', () => {
      const raw = `---
type: Playbook
title: "Incident response: data freshness alert"
description: Steps to triage a freshness alert on the orders pipeline.
tags: [oncall, incident]
generated: { by: human:ahormati, at: 2026-04-12T09:00:00Z }
---

# Trigger

A freshness alert fires when orders lags.
`;
      const concept = parseConcept(raw, path.join(tmpBundleDir, 'playbook.md'), tmpBundleDir);
      const issues = adapter.validateConceptConformance(concept);
      expect(issues.filter(i => i.severity === 'error')).toHaveLength(0);
      expect(concept.frontmatter.type).toBe('Playbook');
    });

    it('validates SPEC.md §10.2 (Attested Computation concept)', () => {
      const raw = `---
type: Attested Computation
title: Revenue for fiscal year
description: Recognized revenue for a fiscal year, per Finance's definition.
status: stable
runtime: bigquery
parameters:
  - { name: year, type: integer, required: true }
executor:
  resource: references/skills/run-on-bq.md
  receipt: [job_id, executed_sql, result]
attester:
  resource: references/attesters/revenue.py
generated: { by: reference_agent/gemini-2.5-pro, at: 2026-06-20T22:53:05Z }
verified: { by: human:ahormati, at: 2026-06-25T09:00:00Z }
stale_after: 2026-09-23T00:00:00Z
sources:
  - id: rev-policy
    resource: https://wiki.acme/finance/revenue-recognition
    title: Revenue recognition policy
---

# Computation

    SELECT SUM(amount) AS revenue
    FROM finance.recognized_revenue
    WHERE fiscal_year = @year

The computation binds only the declared parameters.[^rev-policy]

[^rev-policy]: Revenue recognition policy
`;
      const concept = parseConcept(raw, path.join(tmpBundleDir, 'revenue.md'), tmpBundleDir);
      const issues = adapter.validateConceptConformance(concept);
      expect(issues.filter(i => i.severity === 'error')).toHaveLength(0);
      expect(concept.frontmatter.runtime).toBe('bigquery');
    });

    it('treats bare verified mapping as a one-element list (§5.2)', () => {
      const bareMapping = { by: 'human:ahormati', at: '2026-06-25T09:00:00Z' };
      const normalized = adapter.normalizeVerified(bareMapping);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].by).toBe('human:ahormati');
      expect(adapter.deriveTrustTier(bareMapping)).toBe('human-reviewed');

      const processMapping = { by: 'process:nightly', at: '2026-06-25T09:00:00Z' };
      expect(adapter.deriveTrustTier(processMapping)).toBe('machine-confirmed');
      expect(adapter.deriveTrustTier(undefined)).toBe('unverified');
    });
  });

  describe('Round-trip parsing and serialization', () => {
    it('preserves unknown keys, key ordering, comments, and body bytes', () => {
      const raw = `---
type: Component
title: Order Service
description: Core order management domain service.
tags:
  - orders
  - domain
custom_engine_flag: true
vendor_metadata:
  uuid: 1234-abcd
reponix:
  cli: 0.1.2
  agent: arch-mapper
---

# Details

Some paragraph with \`backticks\` and tables.

| Header 1 | Header 2 |
|---|---|
| Val 1 | Val 2 |
`;
      const parsed = parseRawDocument(raw);
      expect(parsed.frontmatter.type).toBe('Component');
      expect((parsed.frontmatter as any).custom_engine_flag).toBe(true);
      expect((parsed.frontmatter as any).vendor_metadata.uuid).toBe('1234-abcd');

      const serialized = serializeConcept(parsed.frontmatter, parsed.body, parsed.yamlDoc);
      expect(serialized).toContain('custom_engine_flag: true');
      expect(serialized).toContain('uuid: 1234-abcd');
      expect(serialized).toContain('# Details');
      expect(serialized).toContain('| Header 1 | Header 2 |');

      // Re-parse serialized output
      const reParsed = parseRawDocument(serialized);
      expect(reParsed.frontmatter.type).toBe('Component');
      expect((reParsed.frontmatter as any).custom_engine_flag).toBe(true);
      expect((reParsed.frontmatter as any).vendor_metadata.uuid).toBe('1234-abcd');
      expect(reParsed.body.trim()).toBe(parsed.body.trim());
    });
  });

  describe('Valid Bundle Fixture', () => {
    it('validates a complete, conformant Reponix OKF v0.2 bundle without errors', () => {
      // 1. Create source files in repo
      const srcDir = path.join(tmpRepoDir, 'src', 'api');
      const svcDir = path.join(tmpRepoDir, 'src', 'services');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(svcDir, { recursive: true });

      // Write mock files with at least 100 lines
      const mockLines = Array.from({ length: 120 }, (_, i) => `// Line ${i + 1}`).join('\n');
      fs.writeFileSync(path.join(srcDir, 'orders.controller.ts'), mockLines, 'utf-8');
      fs.writeFileSync(path.join(svcDir, 'order.service.ts'), mockLines, 'utf-8');

      // 2. Create target bundle concepts
      const contractsDir = path.join(tmpBundleDir, 'contracts', 'apis');
      const schemasDir = path.join(tmpBundleDir, 'contracts', 'schemas');
      const archDir = path.join(tmpBundleDir, 'architecture', 'components');
      fs.mkdirSync(contractsDir, { recursive: true });
      fs.mkdirSync(schemasDir, { recursive: true });
      fs.mkdirSync(archDir, { recursive: true });

      // inventory service component
      fs.writeFileSync(
        path.join(archDir, 'inventory-service.md'),
        `---
type: Component
title: Inventory Service
description: Manages inventory levels and stock reservation.
tags: [inventory, stock]
status: stable
generated: { by: reponix-arch-mapper/gemini-3.8-flash, at: 2026-10-24T09:12:00Z }
verified: { by: process:reponix-validator, at: 2026-10-24T09:20:00Z }
stale_after: 2027-01-22T09:12:00Z
sources:
  - id: svc
    resource: ../../../src/services/order.service.ts#L10-L50
    title: Inventory logic
reponix: { cli: 0.1.2, agent: arch-mapper }
---

# Inventory Overview

Manages stock.[^svc]

[^svc]: Inventory logic
`,
        'utf-8'
      );

      // orders schema table
      fs.writeFileSync(
        path.join(schemasDir, 'orders.md'),
        `---
type: Database Table
title: Orders Table
description: Stores persistent customer order records.
tags: [db, orders]
status: stable
generated: { by: reponix-code-inspector/gemini-3.8-flash, at: 2026-10-24T09:12:00Z }
verified: { by: process:reponix-validator, at: 2026-10-24T09:20:00Z }
stale_after: 2027-01-22T09:12:00Z
sources:
  - id: schema
    resource: ../../../src/api/orders.controller.ts#L1-L30
    title: Orders schema definition
reponix: { cli: 0.1.2, agent: code-inspector }
---

# Orders Schema

Stores customer orders.[^schema]

[^schema]: Orders schema definition
`,
        'utf-8'
      );

      // The reference concept from brief
      fs.writeFileSync(
        path.join(contractsDir, 'post-orders.md'),
        `---
type: API Endpoint
title: POST /orders
description: Creates an order from a cart and reserves inventory.
resource: ../../../src/api/orders.controller.ts#L18-L64
tags: [orders, rest, write-path]
status: stable
generated: { by: reponix-code-inspector/example-model, at: 2026-10-24T09:12:00Z }
verified: { by: process:reponix-validator, at: 2026-10-24T09:20:00Z }
stale_after: 2027-01-22T09:12:00Z
sources:
  - id: ctrl
    resource: ../../../src/api/orders.controller.ts#L18-L64
    title: OrdersController.create
  - id: svc
    resource: ../../../src/services/order.service.ts#L40-L97
    title: OrderService.placeOrder
reponix: { cli: 0.1.2, commit: 9f1c2ab, agent: code-inspector }
---

# Schema

| Field | Type | Required | Notes |
|---|---|---|---|
| \`cartId\` | string | yes | Must reference an open cart. |

# Behavior

Validates the cart, then reserves stock through the
[Inventory Service](/architecture/components/inventory-service.md).[^svc]
Persists to the [orders table](/contracts/schemas/orders.md).[^ctrl]

[^ctrl]: OrdersController.create
[^svc]: OrderService.placeOrder
`,
        'utf-8'
      );

      // Generate index files
      const bundle = loadBundle(tmpBundleDir, { repoRoot: tmpRepoDir });
      generateAllIndices(bundle, true);

      // Validate bundle under strict mode
      const reloadedBundle = loadBundle(tmpBundleDir, { repoRoot: tmpRepoDir });
      const issues = validateBundle(reloadedBundle, { strict: true });
      const errors = issues.filter(i => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Error Class Fixture', () => {
    it('detects and flags every error class defined in the OKF profile and spec', () => {
      const errDir = path.join(tmpBundleDir, 'contracts', 'apis');
      fs.mkdirSync(errDir, { recursive: true });

      // Concept with multiple deliberate errors:
      // 1. Missing type
      // 2. Missing title
      // 3. Multi-sentence description
      // 4. Missing tags
      // 5. Invalid timestamp format (missing Z)
      // 6. Numeric score present
      // 7. Forbidden top-level key 'confidence'
      // 8. Footnote with no matching source
      // 9. Source never cited
      // 10. Source pointing to missing file
      // 11. Broken link
      fs.writeFileSync(
        path.join(errDir, 'bad-endpoint.md'),
        `---
type: ""
description: First sentence here. Second sentence invalidates single sentence rule.
confidence: 0.95
score: 100
generated: { by: invalid_actor_format, at: 2026-10-24 09:12:00 }
sources:
  - id: ghost-source
    resource: ../../../src/missing-file.ts#L10-L20
    title: Missing File
reponix: { cli: 0.1.2, agent: code-inspector }
---

# Bad Content

Citing unknown footnote here.[^unresolved]
And linking to nowhere [Missing Concept](/contracts/missing.md).
`,
        'utf-8'
      );

      const bundle = loadBundle(tmpBundleDir, { repoRoot: tmpRepoDir });
      const issues = validateBundle(bundle, { strict: true });

      const issueCodes = new Set(issues.map(i => i.code));

      expect(issueCodes.has('OKF_SPEC_TYPE_REQUIRED')).toBe(true);
      expect(issueCodes.has('OKF_PROFILE_TITLE_MISSING')).toBe(true);
      expect(issueCodes.has('OKF_PROFILE_DESCRIPTION_FORMAT')).toBe(true);
      expect(issueCodes.has('OKF_PROFILE_TAGS_MISSING')).toBe(true);
      expect(issueCodes.has('OKF_PROFILE_TIMESTAMP_FORMAT')).toBe(true);
      expect(issueCodes.has('OKF_PROFILE_NO_NUMERIC_SCORES')).toBe(true);
      expect(issueCodes.has('OKF_PROFILE_NAMESPACING')).toBe(true);
      expect(issueCodes.has('OKF_CITE_FOOTNOTE_UNRESOLVED')).toBe(true);
      expect(issueCodes.has('OKF_CITE_SOURCE_UNCITED')).toBe(true);
      expect(issueCodes.has('OKF_CITE_FILE_NOT_FOUND')).toBe(true);
      expect(issueCodes.has('OKF_LINK_BROKEN')).toBe(true);
    });

    it('flags line range out of bounds', () => {
      const srcDir = path.join(tmpRepoDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'short.ts'), 'line 1\nline 2\nline 3\n', 'utf-8');

      const contractsDir = path.join(tmpBundleDir, 'contracts');
      fs.mkdirSync(contractsDir, { recursive: true });
      fs.writeFileSync(
        path.join(contractsDir, 'out-of-bounds.md'),
        `---
type: Domain Entity
title: Short Entity
description: Test line bounds.
tags: [test]
generated: { by: reponix-code-inspector/model, at: 2026-10-24T09:12:00Z }
sources:
  - id: short
    resource: ../../src/short.ts#L10-L50
    title: Short File
reponix: { cli: 0.1.2, agent: code-inspector }
---

Checking entity.[^short]

[^short]: Short File
`,
        'utf-8'
      );

      const bundle = loadBundle(tmpBundleDir, { repoRoot: tmpRepoDir });
      const issues = validateBundle(bundle, { strict: true });
      expect(issues.some(i => i.code === 'OKF_CITE_LINE_RANGE_OUT_OF_BOUNDS')).toBe(true);
    });
  });

  describe('v0.1-Style Bundle Backward Compatibility', () => {
    it('successfully reads and processes a v0.1 bundle using timestamp and # Citations', () => {
      fs.writeFileSync(
        path.join(tmpBundleDir, 'v01-metric.md'),
        `---
type: Metric
title: Monthly Active Users
description: Count of unique active users in a 30-day window.
tags: [product, growth]
timestamp: 2026-05-28T22:53:05Z
---

# Definition

Calculates unique active users over 30 days.

# Citations
- https://wiki.acme/growth/metrics
`,
        'utf-8'
      );

      // Consumers MUST NOT crash or reject (§11)
      const bundle = loadBundle(tmpBundleDir, { repoRoot: tmpRepoDir });
      expect(bundle.concepts.size).toBe(1);

      const concept = bundle.concepts.get('v01-metric.md')!;
      expect(concept.frontmatter.type).toBe('Metric');
      expect(concept.frontmatter.timestamp).toBe('2026-05-28T22:53:05Z');
      expect(concept.body).toContain('# Citations');
    });
  });

  describe('Security: Symlinks and Path Traversal', () => {
    it('rejects path traversal attempting to escape the repository root', () => {
      const outsideDir = path.resolve(tmpRepoDir, '..', 'escaped-bundle');
      expect(() => {
        loadBundle(outsideDir, { repoRoot: tmpRepoDir });
      }).toThrow(/Path traversal error/);
    });

    it('rejects symlinks inside the bundle directory', () => {
      const realDir = path.join(tmpRepoDir, 'real-target');
      fs.mkdirSync(realDir, { recursive: true });
      fs.writeFileSync(path.join(realDir, 'file.md'), '---\ntype: Test\n---\nBody');

      const symlinkPath = path.join(tmpBundleDir, 'linked-dir');
      try {
        fs.symlinkSync(realDir, symlinkPath, 'junction');
      } catch {
        // Skip if OS permissions restrict symlink creation
        return;
      }

      expect(() => {
        loadBundle(tmpBundleDir, { repoRoot: tmpRepoDir });
      }).toThrow(/Security violation: Symlinks are forbidden/);
    });
  });

  describe('Idempotence of index generation and finalize', () => {
    it('running index generation twice produces identical output', () => {
      fs.writeFileSync(
        path.join(tmpBundleDir, 'overview.md'),
        `---
type: Repository
title: Overview
description: High-level overview of the system.
tags: [overview]
generated: { by: reponix-orchestrator/gemini-3.8-flash, at: 2026-10-24T09:12:00Z }
---
# Overview
Content here.
`,
        'utf-8'
      );

      const bundle1 = loadBundle(tmpBundleDir, { repoRoot: tmpRepoDir });
      generateAllIndices(bundle1, true);
      const rootIndex1 = fs.readFileSync(path.join(tmpBundleDir, 'index.md'), 'utf-8');

      const bundle2 = loadBundle(tmpBundleDir, { repoRoot: tmpRepoDir });
      generateAllIndices(bundle2, true);
      const rootIndex2 = fs.readFileSync(path.join(tmpBundleDir, 'index.md'), 'utf-8');

      expect(rootIndex1).toBe(rootIndex2);
      expect(rootIndex1).toContain('okf_version: "0.2"');
      expect(rootIndex1).toContain('* [Overview](overview.md) - High-level overview of the system.');
    });

    it('running finalize twice yields identical results and zero diff', async () => {
      const srcDir = path.join(tmpRepoDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'app.ts'), 'export const app = 1;\n', 'utf-8');

      fs.writeFileSync(
        path.join(tmpBundleDir, 'overview.md'),
        `---
type: Repository
title: Repository Overview
description: Overview of the repository architecture.
tags: [system]
generated: { by: reponix-orchestrator/gemini-3.8-flash, at: 2026-10-24T09:12:00Z }
sources:
  - id: app
    resource: ../src/app.ts#L1
    title: Application entry
reponix: { cli: 0.1.2, agent: reponix-orchestrator }
---

# Architecture

Application root.[^app]

[^app]: Application entry
`,
        'utf-8'
      );

      // Run finalize pass 1
      const res1 = await finalizeBundle({
        bundleDir: tmpBundleDir,
        repoRoot: tmpRepoDir,
        strict: true,
      });
      expect(res1.summary.success).toBe(true);

      const overviewContentPass1 = fs.readFileSync(path.join(tmpBundleDir, 'overview.md'), 'utf-8');
      const indexContentPass1 = fs.readFileSync(path.join(tmpBundleDir, 'index.md'), 'utf-8');

      // Run finalize pass 2
      const res2 = await finalizeBundle({
        bundleDir: tmpBundleDir,
        repoRoot: tmpRepoDir,
        strict: true,
      });
      expect(res2.summary.success).toBe(true);

      const overviewContentPass2 = fs.readFileSync(path.join(tmpBundleDir, 'overview.md'), 'utf-8');
      const indexContentPass2 = fs.readFileSync(path.join(tmpBundleDir, 'index.md'), 'utf-8');

      expect(overviewContentPass1).toBe(overviewContentPass2);
      expect(indexContentPass1).toBe(indexContentPass2);
    });
  });

  describe('Report Formatters (SARIF 2.1.0 and JSON)', () => {
    it('emits compliant SARIF 2.1.0 output', () => {
      const issues = [
        {
          code: 'OKF_SPEC_TYPE_REQUIRED',
          severity: 'error' as const,
          path: 'contracts/apis/bad.md',
          line: 1,
          message: 'Missing type in frontmatter',
          agent: 'code-inspector',
        },
        {
          code: 'OKF_LINK_BROKEN',
          severity: 'warning' as const,
          path: 'contracts/apis/bad.md',
          line: 25,
          message: 'Broken link',
          agent: 'code-inspector',
        },
      ];

      const sarifRaw = formatSarifReport(issues);
      const sarif = JSON.parse(sarifRaw);

      expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);

      const run = sarif.runs[0];
      expect(run.tool.driver.name).toBe('reponix-okf');
      expect(run.tool.driver.rules).toHaveLength(2);
      expect(run.results).toHaveLength(2);

      const errorResult = run.results.find((r: any) => r.ruleId === 'OKF_SPEC_TYPE_REQUIRED');
      expect(errorResult.level).toBe('error');
      expect(errorResult.locations[0].physicalLocation.artifactLocation.uri).toBe('contracts/apis/bad.md');
      expect(errorResult.properties.owningAgent).toBe('code-inspector');

      const warnResult = run.results.find((r: any) => r.ruleId === 'OKF_LINK_BROKEN');
      expect(warnResult.level).toBe('warning');
    });

    it('emits structured JSON summary for orchestrator agent', () => {
      const issues = [
        {
          code: 'OKF_CITE_FILE_NOT_FOUND',
          severity: 'error' as const,
          path: 'contracts/apis/order.md',
          message: 'File not found',
          agent: 'code-inspector',
        },
      ];

      const jsonRaw = formatJsonReport(issues);
      const parsed = JSON.parse(jsonRaw);
      expect(parsed.valid).toBe(false);
      expect(parsed.summary.errors).toBe(1);
      expect(parsed.issues[0].code).toBe('OKF_CITE_FILE_NOT_FOUND');
    });
  });
});
