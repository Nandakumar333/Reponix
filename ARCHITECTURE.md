# Reponix Architecture & Design

## Overview

`reponix` is a zero-config CLI tool that scaffolds a production-grade multi-agent repository intelligence and modernization system into any codebase. It utilizes a **single set of generic templates** that emit native configurations for any supported AI coding platform.

It is installed via **npx**:
```bash
npx reponix init
```

---

## Design Principles

1. **Single Template, All Platforms** — A single generic template set (`templates/generic/agents/*.md.hbs`) generates agent configurations across all 9 supported platforms:
   - Claude Code
   - Gemini CLI
   - Cursor
   - OpenCode
   - GitHub Copilot
   - GitHub Copilot CLI
   - Codex
   - Continue
   - Windsurf
2. **Orchestration-First** — The Reponix-Orchestrator agent owns the intelligence and modernization workflow. All sub-agents are invoked through the orchestrator; sub-agents do not coordinate directly.
3. **Evidence-Driven Analysis** — Every architectural finding, contract specification, and reconstruction blueprint must cite real source files and lines. Hallucinations are actively detected by the Validator agent.
4. **Skill-Composable** — Skills are installable modules (`SKILL.md` + optional references/scripts) that extend agent capabilities (such as code graphs or architectural diagrams).
5. **Clean Monorepo Layout** — Lightweight single CLI package (`packages/cli`) with root templates and skills, mirroring the battle-tested architecture of ShaAgent.

---

## Repository Layout

```
reponix/
├── packages/
│   └── cli/                        # Node.js CLI (npx reponix entry point)
│       ├── src/
│       │   ├── index.ts            # CLI entry point (Commander.js)
│       │   ├── init.ts             # `reponix init` command logic
│       │   ├── list.ts             # `reponix list agents|skills`
│       │   ├── install-skill.ts    # `reponix skill install <name>`
│       │   ├── prompts.ts          # Interactive prompts
│       │   ├── types.ts            # Shared CLI and config definitions
│       │   ├── platforms/
│       │   │   └── index.ts        # Scope-aware platform path resolver
│       │   ├── engine/
│       │   │   ├── template.ts     # Handlebars template renderer + platform formatter
│       │   │   ├── paths.ts        # Package resource resolver (dev monorepo vs bundled dist)
│       │   │   └── manifest.ts     # Reads/writes reponix.config.json
│       │   └── okf/                # Open Knowledge Format (OKF v0.2) engine
│       │       ├── types.ts        # OKF Bundle, Concept, Frontmatter types
│       │       ├── spec-adapter.ts # OKF v0.2 specification adapter
│       │       ├── parse.ts        # YAML AST round-tripping preserving comments
│       │       ├── bundle.ts       # Secure bundle loader & traversal guards
│       │       ├── cite.ts         # Footnote citation & line bounds checker
│       │       ├── links.ts        # Cross-link extraction & resolution
│       │       ├── trust.ts        # Trust tier transitions & verification
│       │       ├── index-gen.ts    # Idempotent index.md generation
│       │       ├── log.ts          # ISO date-grouped changelog manager
│       │       ├── git.ts          # Git commit SHA, permalinks, author extraction
│       │       ├── stale.ts        # Time & Git staleness evaluator
│       │       ├── secrets.ts      # Secret pattern scanner pre-flight
│       │       ├── manifest.ts     # .reponix/okf-manifest.json tracker
│       │       ├── plan.ts         # Incremental agent update planner
│       │       ├── migrate.ts      # Legacy monolithic docs converter
│       │       ├── pack.ts         # Single-artifact packager (MD, JSON, TAR)
│       │       ├── validate.ts     # Two-layer validator (spec + profile)
│       │       ├── finalize.ts     # End-to-end pipeline orchestrator
│       │       ├── report.ts       # Text, JSON, and SARIF formatters
│       │       └── command.ts      # `reponix okf` CLI subcommands
│       ├── scripts/
│       │   └── bundle.js           # tsc bundler + asset copy
│       ├── tests/                  # Test suites (vitest)
│       ├── package.json
│       └── tsconfig.json
│
├── templates/
│   └── generic/                    # Single template set for all platforms
│       ├── agents/
│       │   ├── reponix-orchestrator.md.hbs
│       │   ├── repo-analyst.md.hbs
│       │   ├── arch-mapper.md.hbs
│       │   ├── code-inspector.md.hbs
│       │   ├── modernizer.md.hbs
│       │   └── validator.md.hbs
│       └── partials/
│           └── okf-contract.md.hbs # Reusable OKF output contract partial
│
├── skills/                         # Built-in installable skills
│   ├── okf/                        # Open Knowledge Format (OKF v0.2) skill
│   │   ├── SKILL.md
│   │   ├── NOTICE
│   │   └── reference/              # Vendored spec, profile, and types
│   ├── graphify/
│   │   └── SKILL.md
│   ├── arch-review/
│   │   └── SKILL.md
│   └── modernization/
│       └── SKILL.md
│
├── docs/
│   ├── PRD.md
│   └── okf.md                      # OKF user guide and command reference
├── reponix.config.schema.json      # JSON Schema for project configuration
├── package.json                    # Monorepo root configuration
└── README.md
```

---

## Single-Template Rendering Strategy

```
[Generic .hbs Template] ──► [Handlebars Render] ──► [Platform Formatter] ──► [Platform Agent File]
```

### Generic Template Structure
- Frontmatter containing metadata (`name`, `description`, `model`).
- Markdown body detailing agent persona, tools, workflows, and output format.
- Output contract dynamically selected via `output.format` (`okf`, `legacy`, or `both`) leveraging `okf-contract.md.hbs`.

### Platform Adapters & Formats

| Platform | Frontmatter Transformation | File Extension | Output Directory |
|---|---|---|---|
| **Claude Code** | Stripped frontmatter, HTML comment | `.md` | `.claude/agents/` + `CLAUDE.md` |
| **Gemini CLI** | Stripped frontmatter, HTML comment | `.md` | `.gemini/agents/` + `GEMINI.md` |
| **Cursor** | Cursor MDC metadata block | `.mdc` | `.cursor/rules/` |
| **OpenCode** | Mode, temperature, permission settings | `.md` | `.opencode/agents/` |
| **GitHub Copilot** | Markdown instruction format | `.md` | `.github/agents/` + instructions |
| **Codex** | Merged AGENTS.md format | `.md` | `.codex/agents/` + `AGENTS.md` |
| **Continue** | Prompt structure | `.md` | `.continue/prompts/` |
| **Windsurf** | Rule structure | `.md` | `.windsurf/rules/` |

---

## Open Knowledge Format (OKF v0.2) Subsystem

Reponix incorporates a complete, deterministic OKF v0.2 processing pipeline governed by the principle: **"The LLM writes, the CLI guarantees"**.

```
Agent Markdown + Footnotes [^id]
          │
          ▼
┌──────────────────────────────────────────────┐
│          reponix okf finalize                │
├──────────────────────────────────────────────┤
│ 1. Secret Scanning Pre-Flight                │
│    Detects AWS/GitHub/Slack/Stripe/priv keys │
│ 2. Citation Verification                     │
│    Footnote [^id] <-> sources[].id matching  │
│    Source file existence & line range bounds │
│ 3. Link Resolution                           │
│    Validates bundle-relative `/...` links    │
│ 4. Trust Stamping                            │
│    Sets generated, stale_after (+90d)        │
│    Awards machine-confirmed status           │
│ 5. Provenance Enrichment                     │
│    Records Git SHA, permalinks, authors      │
│ 6. Idempotent Index Generation               │
│    Generates directory index.md files        │
│ 7. Changelog Appending                       │
│    Appends structured diff to log.md         │
│ 8. Change Manifest Tracking                  │
│    Saves .reponix/okf-manifest.json          │
└──────────────────────────────────────────────┘
          │
          ▼
   Verified OKF Bundle (reponix/)
```

---

## Agent Pipeline: Repository Intelligence & Modernization

```
User → Reponix-Orchestrator
         │
         ├─► [1. Repo Analyst]      (Inventory: stack, layout, dependencies, configs)
         │
         ├─► [2. Arch Mapper]       (Topology: components, data flows, Mermaid diagrams)
         │
         ├─► [3. Code Inspector]    (Contracts: APIs, database schemas, business rules)
         │
         ├─► [4. Modernizer]        (Blueprints: target-neutral specs, refactoring roadmap)
         │
         └─► [5. Validator]         (Verification: source citations, gap analysis)
```
