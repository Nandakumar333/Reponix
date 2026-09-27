# Reponix

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

Scaffold a production-grade **repository intelligence & modernization multi-agent AI system** into any codebase in 30 seconds.

```bash
npx reponix init
```

---

## What It Does

`npx reponix init` guides you through a streamlined setup process and writes a complete multi-agent repository intelligence and modernization system into your workspace:

1. **Launch:** Run `npx reponix init`
2. **Scope:** Choose **project** (current repository) or **global** (user home directory)
3. **Platform:** Select your AI coding harness (Claude Code, Gemini CLI, Cursor, OpenCode, GitHub Copilot, Codex, Continue, Windsurf)
4. **Agent Suite:** Choose **Modernization Suite** (Orchestrator + Intelligence agents + Modernizer) or **Intelligence Suite** (Analysis only)
5. **Setup:** Reponix renders platform-native agent files, installs selected skills, and saves configuration into `reponix.config.json`

---

## Agent System

Reponix deploys specialized agents designed for deep repository archaeology and system modernization:

```
User → Orchestrator
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

### Core Agents

| Agent | Role | Output Artifact |
|---|---|---|
| **Orchestrator** | Coordinates the entire intelligence and modernization lifecycle. All sub-agents report through it. | Synthesis & Roadmaps |
| **Repo Analyst** | Discovers stack, dependencies, manifest files, directory topologies, and build tools. | `docs/inventory.md` |
| **Arch Mapper** | Maps system topology, service boundaries, data flows, and renders visual Mermaid diagrams. | `docs/architecture.md` |
| **Code Inspector** | Extracts REST/GraphQL endpoints, database schemas/migrations, domain entities, and core business rules. | `docs/contracts.md` |
| **Modernizer** | Produces target-neutral reconstruction blueprints, API specifications, and phased refactoring plans. | `docs/reconstruction-spec.md` |
| **Validator** | Audits generated documentation and migration blueprints against real source code evidence to guarantee zero hallucination. | `docs/validation-report.md` |

### Built-in Skills

| Skill | Role |
|---|---|
| **`graphify`** | Code relationship extraction, call trees, and import graph queries. |
| **`arch-review`** | Architectural fitness checks, layer separation validation, and Mermaid visualization. |
| **`modernization`** | Target-neutral specification formatting and migration blueprint generator. |

---

## Supported Platforms

| Platform | Agent File Location | Root Instructions |
|---|---|---|
| **Gemini CLI** | `.gemini/agents/*.md` | `GEMINI.md` |
| **Claude Code** | `.claude/agents/*.md` | `CLAUDE.md` |
| **Cursor** | `.cursor/rules/*.mdc` | `.cursorrules` |
| **OpenCode** | `.opencode/agents/*.md` | `.opencode/instructions.md` |
| **GitHub Copilot** | `.github/instructions/*.instructions.md` | `AGENTS.md` |
| **GitHub Copilot CLI** | `.github/agents/*.agent.md` | `AGENTS.md` |
| **OpenAI Codex** | `.codex/agents/*.md` | `AGENTS.md` (merged) |
| **Continue** | `.continue/prompts/*.md` | — |
| **Windsurf** | `.windsurf/rules/*.md` | `.windsurf/rules.md` |

---

## Non-Interactive & Flag Usage

```bash
# Initialize for Claude Code with Modernization Suite
npx reponix init --platform claude-code --suite modernization --yes

# Initialize for Gemini CLI non-interactively
npx reponix init --platform gemini-cli --yes

# Preview files without writing to disk
npx reponix init --platform cursor --dry-run
```

---

## Development

```bash
# Build the CLI package and sync templates/skills
npm run build

# Run test suite
npm test
```

## License

Apache-2.0
