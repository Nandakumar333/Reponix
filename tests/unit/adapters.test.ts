import { describe, it, expect } from "vitest";
import {
  getAllAdapters,
  getAdapter,
  ClaudeAdapter,
  GeminiAdapter,
  CursorAdapter,
  OpenCodeAdapter,
  CopilotAdapter,
  CodexAdapter,
} from "@reponix/adapters";
import { spyOrchestratorAgent } from "@reponix/core";

describe("Platform Adapters", () => {
  it("provides 6 core platform adapters", () => {
    const adapters = getAllAdapters();
    expect(adapters.length).toBe(6);
    const platformIds = adapters.map((a) => a.platformId);
    expect(platformIds).toEqual([
      "claude",
      "gemini",
      "cursor",
      "opencode",
      "copilot",
      "codex",
    ]);
  });

  it("Claude adapter generates .claude paths and CLAUDE.md", () => {
    const adapter = getAdapter("claude");
    expect(adapter).toBeInstanceOf(ClaudeAdapter);

    const file = adapter.renderAgent(spyOrchestratorAgent);
    expect(file.relativePath).toBe(".claude/agents/spy-orchestrator.md");
    expect(file.content).toContain("# SPY Orchestrator");

    const rootFiles = adapter.renderRootInstructions([spyOrchestratorAgent]);
    expect(rootFiles.length).toBe(1);
    expect(rootFiles[0].relativePath).toBe("CLAUDE.md");
  });

  it("Gemini adapter generates .gemini paths and GEMINI.md", () => {
    const adapter = getAdapter("gemini");
    expect(adapter).toBeInstanceOf(GeminiAdapter);

    const file = adapter.renderAgent(spyOrchestratorAgent);
    expect(file.relativePath).toBe(".gemini/agents/spy-orchestrator.md");

    const rootFiles = adapter.renderRootInstructions([spyOrchestratorAgent]);
    expect(rootFiles[0].relativePath).toBe("GEMINI.md");
    expect(rootFiles[0].content).toContain("@.gemini/agents/spy-orchestrator.md");
  });

  it("Cursor adapter generates .cursor/rules/*.mdc with frontmatter", () => {
    const adapter = getAdapter("cursor");
    expect(adapter).toBeInstanceOf(CursorAdapter);

    const file = adapter.renderAgent(spyOrchestratorAgent);
    expect(file.relativePath).toBe(".cursor/rules/spy-orchestrator.mdc");
    expect(file.content).toContain("---");
    expect(file.content).toContain("description:");
    expect(file.content).toContain("alwaysApply: false");

    const rootFiles = adapter.renderRootInstructions([spyOrchestratorAgent]);
    expect(rootFiles[0].relativePath).toBe(".cursorrules");
  });

  it("OpenCode adapter generates .opencode/agents and instructions", () => {
    const adapter = getAdapter("opencode");
    expect(adapter).toBeInstanceOf(OpenCodeAdapter);

    const file = adapter.renderAgent(spyOrchestratorAgent);
    expect(file.relativePath).toBe(".opencode/agents/spy-orchestrator.md");

    const rootFiles = adapter.renderRootInstructions([spyOrchestratorAgent]);
    expect(rootFiles[0].relativePath).toBe(".opencode/instructions.md");
  });

  it("Copilot adapter generates .github/agents and instructions", () => {
    const adapter = getAdapter("copilot");
    expect(adapter).toBeInstanceOf(CopilotAdapter);

    const file = adapter.renderAgent(spyOrchestratorAgent);
    expect(file.relativePath).toBe(".github/agents/spy-orchestrator.md");

    const rootFiles = adapter.renderRootInstructions([spyOrchestratorAgent]);
    expect(rootFiles[0].relativePath).toBe(".github/copilot-instructions.md");
  });

  it("Codex adapter generates .codex/agents and AGENTS.md", () => {
    const adapter = getAdapter("codex");
    expect(adapter).toBeInstanceOf(CodexAdapter);

    const file = adapter.renderAgent(spyOrchestratorAgent);
    expect(file.relativePath).toBe(".codex/agents/spy-orchestrator.md");

    const rootFiles = adapter.renderRootInstructions([spyOrchestratorAgent]);
    expect(rootFiles[0].relativePath).toBe("AGENTS.md");
  });
});
