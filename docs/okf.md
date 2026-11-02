# Open Knowledge Format (OKF) v0.2 in Reponix

Reponix outputs repository intelligence as a verifiable **Open Knowledge Format (OKF) v0.2 bundle**. OKF transforms monolithic documentation into modular, atomic, citation-backed concept documents that can be safely consumed by humans, agents, and automated pipelines.

---

## 1. Core Principle: "The LLM Writes, the CLI Guarantees"

LLMs excel at extracting business logic, synthesizing architectural topology, and identifying API patterns, but can hallucinate filenames, invent line numbers, or create broken cross-links.

Reponix enforces a strict division of responsibility:
- **The LLM writes:** The agent drafts modular concept Markdown files with YAML frontmatter, cited source references, and inline footnote citations.
- **The CLI guarantees:** The deterministic `reponix okf` engine verifies bidirectional footnote links, checks real file existence, validates `#Lstart-Lend` line ranges, computes trust tiers, updates index files and changelogs, scans for secrets, and generates a change manifest.

---

## 2. OKF Bundle Layout

By default, an OKF bundle is created in `reponix/` at the repository root:

```
reponix/
├── index.md                 # Root bundle index with okf_version: "0.2"
├── log.md                   # Chronological date-grouped changelog (YYYY-MM-DD)
├── overview.md              # High-level repository intelligence summary
├── architecture/            # Architecture concepts (topology, components, data flows)
│   ├── index.md             # Subdirectory index
│   └── system-overview.md
├── contracts/               # Component & API contracts
│   ├── index.md
│   └── payment-api.md
├── inventory/               # Stack, dependency, and topology concepts
│   ├── index.md
│   └── tech-stack.md
├── procedures/              # Modernization blueprints & attested computations
│   ├── index.md
│   └── build-and-deploy.md
└── validation/              # Verification audit reports
    ├── index.md
    └── audit-summary.md
```

### Reserved Files

- **`index.md`**: Directory index listing all concepts within the current directory and immediate subdirectories. The root `index.md` contains frontmatter specifying `okf_version: "0.2"`. Subdirectory `index.md` files contain pure markdown without frontmatter.
- **`log.md`**: Chronological record of bundle updates grouped by ISO-8601 `YYYY-MM-DD` date headings, ordered newest first. Contains no YAML frontmatter.

---

## 3. Concept Document Anatomy

Every concept is a UTF-8 Markdown file consisting of YAML frontmatter and a Markdown body:

```markdown
---
type: API Endpoint
title: Create Payment Intent
description: Initiates a payment transaction with Stripe
status: stable
generated:
  by: reponix-code-inspector/gemini-2.5-pro
  at: 2026-10-24T00:00:00Z
verified:
  - by: process:reponix-validator
    at: 2026-10-24T00:05:00Z
  - by: human:alice
    at: 2026-10-24T08:00:00Z
stale_after: 2027-01-22T00:00:00Z
sources:
  - id: payment-ctrl
    resource: /src/controllers/payment.ts#L45-L80
    author: human:Bob
    last_modified: 2026-10-20T12:00:00Z
reponix:
  agent: code-inspector
  commit: 8a3f91b4c6e...
---

# Create Payment Intent

The payment controller initiates transactions with external gateways.[^payment-ctrl]

[^payment-ctrl]: Source implementation of the payment controller
```

### Frontmatter Fields

| Field | Required | Description |
|---|---|---|
| `type` | **Yes** | Concept type (e.g., `API Endpoint`, `Architecture`, `Inventory`, `Procedure`, `Attested Computation`). |
| `title` | No | Human-readable concept display name. |
| `description` | No | One-sentence summary used for search snippets and `index.md` generators. |
| `status` | No | Concept lifecycle: `draft` \| `stable` \| `deprecated`. |
| `generated` | No | Author attribution `{ by: "<actor>", at: "<ISO-8601-UTC-Z>" }`. |
| `verified` | No | List of verification events `{ by: "<actor>", at: "<ISO-8601-UTC-Z>" }`. |
| `stale_after` | No | ISO-8601 timestamp marking when the content is considered stale (default: +90 days). |
| `sources` | No | Array of source artifacts `{ id, resource, author, last_modified }`. |
| `reponix` | No | Reponix metadata `{ agent, commit, cli }`. |

---

## 4. Trust Tiers

Consumers derive an advisory trust tier from the `verified` frontmatter:

1. **`unverified`**: Concept has no `verified` entries (or is in `draft` status).
2. **`machine-confirmed`**: Verified by automated processes (e.g. `process:reponix-validator`) confirming source file citations and bounds.
3. **`human-reviewed`**: Verified by a human (`human:<id>`), representing vetted sign-off.

---

## 5. Footnote Citations & Cross-Links

- **Footnote Citations**: Every claim in the body should cite a source declared in `sources[]` using markdown footnote notation `[^source-id]`. Footnotes must be bidirectionally valid: every footnote must match a `sources[].id`, and every `sources[].id` must be cited.
- **Cross-Links**: Concepts link to each other using bundle-relative paths beginning with `/` (e.g. `[Payment API](/contracts/payment-api.md)`).

---

## 6. CLI Commands

Reponix includes a complete OKF management command suite under `reponix okf`:

### `reponix okf validate [dir]`
Validates an OKF bundle against the OKF v0.2 specification and Reponix profile:
```bash
# Standard validation
reponix okf validate

# Strict mode: treats profile warnings as hard errors (recommended in CI)
reponix okf validate --strict

# Export SARIF for GitHub Code Scanning
reponix okf validate --format sarif > okf-results.sarif
```

### `reponix okf finalize [dir]`
Runs the end-to-end pipeline:
1. **Secret Scanning:** Refuses to write if API keys or tokens are detected.
2. **Citation Validation:** Validates source files and line ranges.
3. **Link Validation:** Validates bundle-relative cross-links.
4. **Trust Stamping:** Stamps `generated`, `stale_after` (+90d), and verification status.
5. **Git Provenance:** Records commit SHA, rewrites permalinks (`--source-links permalink`), and records Git authors (`--record-git-authors`).
6. **Index Generation:** Builds or updates `index.md` files.
7. **Changelog Appending:** Records diffs into `log.md`.
8. **Manifest Generation:** Updates `.reponix/okf-manifest.json`.

```bash
reponix okf finalize
reponix okf finalize --source-links permalink --record-git-authors
```

### `reponix okf verify <concept-id> --by human:<id>`
Records human verification on a concept and logs it in `log.md`:
```bash
reponix okf verify contracts/payment-api --by human:alice
```

### `reponix okf stale [dir]`
Scans the bundle for concepts that are out of date:
- **Time staleness:** `now >= stale_after`
- **Git staleness:** detects changes in cited source files since `reponix.commit` via `git diff`.

```bash
reponix okf stale
reponix okf stale --format json
```

### `reponix okf plan-update [dir]`
Inspects Git changes and uses `.reponix/okf-manifest.json` to calculate an incremental run plan identifying exactly which source files changed, which concepts are affected, and which agents need to re-run:
```bash
reponix okf plan-update
```

### `reponix okf migrate`
Splits legacy monolithic Reponix documents (`docs/`) into an OKF v0.2 bundle (`reponix/`):
```bash
# Preview files to be created
reponix okf migrate --dry-run

# Execute migration
reponix okf migrate --from docs --to reponix
```

### `reponix okf pack [dir]`
Packages the entire bundle into a single artifact for LLM prompt context or APIs:
```bash
# Single concatenated Markdown file
reponix okf pack --format markdown --out full-bundle.md

# Single JSON payload
reponix okf pack --format json --out bundle.json

# Compressed POSIX tarball (zero external dependencies)
reponix okf pack --format tar --compress --out bundle.tar.gz
```

---

## 7. Configuration

Configure OKF output behavior in `reponix.config.json`:

```json
{
  "output": {
    "format": "okf",
    "okf": {
      "version": "0.2",
      "root": "reponix",
      "emitV01Timestamp": true,
      "sourceLinks": "relative",
      "staleAfterDays": 90,
      "recordGitAuthors": false
    }
  }
}
```

### Switching Back to Legacy Output

To use the legacy monolithic markdown format (`docs/`):
```json
{
  "output": {
    "format": "legacy"
  }
}
```
Or emit both during a transition:
```json
{
  "output": {
    "format": "both"
  }
}
```

---

## 8. CI/CD Integration

To automatically validate OKF bundles on pull requests, add this step to `.github/workflows/ci.yml`:

```yaml
- name: Validate OKF Bundle
  run: |
    if [ -d "reponix" ]; then
      npx reponix okf validate reponix --strict
    fi
```
