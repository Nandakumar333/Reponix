# Reponix

> **AI Repository Archaeology, Software Intelligence & Reconstruction Engine**

Reponix is a portable AI agent scaffolding and repository intelligence platform. It analyzes existing codebases, extracts structural graphs, builds semantic knowledge, and produces target-neutral reconstruction blueprints so target AI coding agents can reimplement or modernize software in any target language and framework.

---

## 🚀 Quick Start

### Installation & Initialization

In any target repository, run:

```bash
npx reponix init
```

Or initialize non-interactively with specific flags:

```bash
# Initialize for Claude Code with full analysis suite
npx reponix init --platform claude --suite full --yes

# Initialize for Gemini CLI with minimal suite
npx reponix init --platform gemini --suite minimal --yes

# Initialize for Cursor
npx reponix init --platform cursor --suite full --yes
```

### Environment Check

Verify your toolchain and project prerequisites:

```bash
npx reponix doctor
```

---

## 🏛 Architecture & Packages

Reponix is structured as a modular TypeScript monorepo:

- **`packages/schemas`** (`@reponix/schemas`): Zod schemas and TypeScript type declarations for agents, skills, configs, manifests, status, evidence, and structured handoffs.
- **`packages/templates`** (`@reponix/templates`): Handlebars template compiler and generic agent templates (`.md.hbs`) for 13 semantic archaeology agents.
- **`packages/adapters`** (`@reponix/adapters`): Platform-native adapters transforming generic agents into platform directories for:
  - Claude Code (`.claude/agents/*.md`, `CLAUDE.md`)
  - Gemini CLI (`.gemini/agents/*.md`, `GEMINI.md`)
  - Cursor (`.cursor/rules/*.mdc`, `.cursorrules`)
  - OpenCode (`.opencode/agents/*.md`, `.opencode/instructions.md`)
  - GitHub Copilot (`.github/agents/*.md`, `.github/copilot-instructions.md`)
  - OpenAI Codex (`.codex/agents/*.md`, `AGENTS.md`)
- **`packages/core`** (`@reponix/core`): Central registry of agents and skills with dependency resolution and analysis suites (`full`, `minimal`, `reconstruction-only`, `architecture-only`).
- **`packages/cli`** (`reponix`): The command-line tool featuring repository stack detection and the interactive scaffolding engine.

---

## 🤖 The 13 Semantic Archaeology Agents

1. **`spy-orchestrator`**: Master coordinator managing state transitions, evidence verification, and reconstruction pipelines.
2. **`repository-analyst`**: Technology stack, directory layout, and package manifest inventory.
3. **`architecture-agent`**: System topology, component boundaries, and visual Mermaid diagrams.
4. **`code-agent`**: Symbol inventory, public interfaces, domain models, and core algorithms.
5. **`api-agent`**: External contracts, REST routes, GraphQL, gRPC, and message queues.
6. **`database-agent`**: Database tables, columns, relations, migrations, and ORM persistence models.
7. **`feature-agent`**: End-to-end capability mapping linking user actions to code and tests.
8. **`workflow-agent`**: Transaction lifecycles, state machines, queues, and compensation logic.
9. **`business-rule-agent`**: Domain validation constraints, thresholds, and calculation algorithms.
10. **`security-agent`**: Authentication schemes, authorization models, and automatic secret redaction.
11. **`testing-agent`**: Test suite catalog and behavior verification matrices.
12. **`reconstruction-agent`**: Target-neutral specifications and implementation blueprints.
13. **`validator-agent`**: Cross-checking evidence, resolving contradictions, and identifying gaps.

---

## 🛠 Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run unit and integration tests
npm test
```

## License

Apache-2.0
