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
│       │   └── engine/
│       │       ├── template.ts     # Handlebars template renderer + platform formatter
│       │       ├── paths.ts        # Package resource resolver (dev monorepo vs bundled dist)
│       │       └── manifest.ts     # Reads/writes reponix.config.json
│       ├── scripts/
│       │   └── bundle.js           # esbuild bundler + asset copy
│       ├── tests/                  # CLI and engine unit tests
│       ├── package.json
│       └── tsconfig.json
│
├── templates/
│   └── generic/                    # Single template set for all platforms
│       └── agents/
│           ├── reponix-orchestrator.md.hbs
│           ├── repo-analyst.md.hbs
│           ├── arch-mapper.md.hbs
│           ├── code-inspector.md.hbs
│           ├── modernizer.md.hbs
│           └── validator.md.hbs
│
├── skills/                         # Built-in installable skills
│   ├── graphify/
│   │   └── SKILL.md
│   ├── arch-review/
│   │   └── SKILL.md
│   └── modernization/
│       └── SKILL.md
│
├── docs/
│   └── PRD.md
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
