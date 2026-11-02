# Reponix OKF Profile (v0.2)

The Reponix Profile defines constraints that produce production-grade, verifiable knowledge bundles. It is stricter than base OKF while remaining 100% conformant with the OKF v0.2 specification.

---

## 1. Conformance Layers

### Base OKF Conformance (Hard Errors)
- Every non-reserved `.md` file must contain parseable YAML frontmatter.
- Every frontmatter block must include a non-empty `type`.
- Reserved files (`index.md`, `log.md`) conform to spec §8 and §9.

### Profile Rules (Warnings by default, Errors under `--strict`)
- **Required Frontmatter:** Every concept except `index.md`/`log.md` must have `title`, `description` (one sentence without line breaks), `tags`, and `generated: { by, at }`.
- **Actor Format:** `generated.by` uses the actor convention: `reponix-<agent-name>/<model-id>`.
- **Sources Required:** Every claim-bearing concept (in `contracts/`, `inventory/`, `architecture/`, `reconstruction/`) must have $\ge 1$ entry in `sources` with `id`, `resource`, and `title`.
- **Bidirectional Footnote Resolution:** Every markdown footnote in the body (`[^id]`) must resolve to a `sources[].id`, and every `sources[].id` must be cited by at least one footnote in the body.
- **Resource Verification:** `sources[].resource` pointing into the repository must exist at HEAD. Line ranges `#Lstart-Lend` must fall within the file's line count.
- **Bundle-Relative Linking:** Concept-to-concept links use bundle-relative form (`/contracts/schemas/orders.md`).
- **Namespacing:** Reponix-specific metadata lives strictly under `reponix: { cli, commit, agent }`.
- **No Numeric Scores:** Numeric confidence or credibility scores are forbidden.
- **ISO-8601 UTC:** All timestamps must use ISO-8601 with explicit `Z` (e.g. `2026-10-24T09:12:00Z`).
- **v0.1 Compatibility:** When `output.okf.emitV01Timestamp` is true, also emit `timestamp: generated.at`.

---

## 2. Lifecycle & Trust Mapping

| State | Condition | Frontmatter Fields |
|---|---|---|
| **draft** | Agent-written, unverified | `status: draft`, no `verified` entries |
| **machine-confirmed** | All citations, links, and paths pass validation | `status: stable`, `verified: [{ by: process:reponix-validator, at }]` |
| **human-reviewed** | User ran `reponix okf verify` | `verified: [{ by: human:<id>, at }]` |
| **deprecated** | A cited source file no longer exists | `status: deprecated` + log entry; file is never deleted |

---

## 3. Freshness & Staleness

- `stale_after` = `generated.at` + `output.okf.staleAfterDays` (default 90 days).
- A concept is stale when `now >= stale_after`.

---

## 4. Consumer Leniency (Spec §11)

When reading bundles, tools must never crash or reject bundles for:
- Missing optional fields
- Unknown concept types
- Unknown frontmatter keys (must be preserved during round-trip edits)
- Broken links
- Missing index files
