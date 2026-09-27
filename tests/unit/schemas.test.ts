import { describe, it, expect } from "vitest";
import {
  AgentDefinitionSchema,
  SkillDefinitionSchema,
  EvidenceRecordSchema,
  StructuredHandoffSchema,
  ReponixConfigSchema,
  ManifestSchema,
  StatusSchema,
} from "@reponix/schemas";

describe("Schemas & Validation Layer", () => {
  it("validates a complete AgentDefinition", () => {
    const validAgent = {
      id: "test-agent",
      name: "Test Agent",
      description: "A test agent for schemas",
      role: "Tester",
      mission: "Verify correctness",
      responsibilities: ["Run assertions"],
      inputs: ["test-file.ts"],
      outputs: ["result.json"],
      skills: ["test-skill"],
      workflow: ["1. Setup", "2. Execute"],
      optional: false,
      dependencies: [],
    };

    const parsed = AgentDefinitionSchema.parse(validAgent);
    expect(parsed.id).toBe("test-agent");
  });

  it("fails AgentDefinition when required fields are missing", () => {
    const invalidAgent = {
      id: "incomplete-agent",
      // missing name, description, role, mission, responsibilities, workflow
    };

    expect(() => AgentDefinitionSchema.parse(invalidAgent)).toThrow();
  });

  it("validates EvidenceRecord and confidence constraints", () => {
    const validEvidence = {
      id: "EV-001",
      type: "EXTRACTED" as const,
      source: "src/index.ts",
      location: "L10-L20",
      description: "Entrypoint definition",
      confidence: 0.95,
    };

    const parsed = EvidenceRecordSchema.parse(validEvidence);
    expect(parsed.confidence).toBe(0.95);

    // Out-of-bounds confidence
    expect(() =>
      EvidenceRecordSchema.parse({
        ...validEvidence,
        confidence: 1.5,
      })
    ).toThrow();
  });

  it("validates StructuredHandoff", () => {
    const handoff = {
      taskId: "task-101",
      agent: "code-agent",
      status: "COMPLETED" as const,
      confidence: 0.9,
      artifacts: [".reponix/semantic/code.json"],
      unknowns: [],
      nextRecommendedAgents: ["api-agent"],
      timestamp: new Date().toISOString(),
    };

    const parsed = StructuredHandoffSchema.parse(handoff);
    expect(parsed.status).toBe("COMPLETED");
  });

  it("validates ReponixConfig and rejects unsupported platforms", () => {
    const validConfig = {
      version: "1.0",
      platform: "gemini" as const,
      scope: "project" as const,
      suite: "full" as const,
      project: {
        name: "MyRepo",
        language: ["TypeScript"],
        framework: ["Node.js"],
      },
      graphify: {
        enabled: true,
        autoInstall: true,
      },
    };

    const parsed = ReponixConfigSchema.parse(validConfig);
    expect(parsed.platform).toBe("gemini");

    // Invalid platform
    expect(() =>
      ReponixConfigSchema.parse({
        ...validConfig,
        platform: "unsupported-platform",
      })
    ).toThrow();
  });

  it("validates ManifestSchema and StatusSchema", () => {
    const manifest = {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      platform: "claude" as const,
      scope: "project" as const,
      suite: "full",
      agents: [
        {
          id: "spy-orchestrator",
          name: "SPY Orchestrator",
          path: ".claude/agents/spy-orchestrator.md",
          optional: false,
        },
      ],
      skills: [],
      rootFiles: [{ path: "CLAUDE.md", purpose: "Root instructions" }],
    };

    const parsedManifest = ManifestSchema.parse(manifest);
    expect(parsedManifest.agents.length).toBe(1);

    const status = {
      version: "1.0",
      overallCompletion: 50,
      currentStage: "SEMANTIC",
      stages: {
        init: { status: "COMPLETED" as const },
        semantic: { status: "IN_PROGRESS" as const },
      },
      entitiesCount: {
        files: 10,
        nodes: 50,
        edges: 120,
        features: 5,
        apis: 8,
        databaseTables: 3,
        evidenceCount: 42,
      },
    };

    const parsedStatus = StatusSchema.parse(status);
    expect(parsedStatus.overallCompletion).toBe(50);
  });
});
