import { describe, it, expect } from "vitest";
import {
  allAgents,
  allSkills,
  resolveSuite,
} from "@reponix/core";

describe("Agent & Skill Registry", () => {
  it("contains exactly 13 core/optional archaeology agents", () => {
    expect(allAgents.length).toBe(13);
    const agentIds = allAgents.map((a) => a.id);
    expect(agentIds).toContain("reponix-orchestrator");
    expect(agentIds).toContain("repository-analyst");
    expect(agentIds).toContain("architecture-agent");
    expect(agentIds).toContain("code-agent");
    expect(agentIds).toContain("api-agent");
    expect(agentIds).toContain("database-agent");
    expect(agentIds).toContain("feature-agent");
    expect(agentIds).toContain("workflow-agent");
    expect(agentIds).toContain("business-rule-agent");
    expect(agentIds).toContain("security-agent");
    expect(agentIds).toContain("testing-agent");
    expect(agentIds).toContain("reconstruction-agent");
    expect(agentIds).toContain("validator-agent");
  });

  it("contains core skills", () => {
    const skillIds = allSkills.map((s) => s.id);
    expect(skillIds).toContain("graphify");
    expect(skillIds).toContain("repository-analysis");
    expect(skillIds).toContain("reconstruction");
  });

  it("resolves the full suite with all 13 agents", () => {
    const resolved = resolveSuite("full");
    expect(resolved.agents.length).toBe(13);
    expect(resolved.skills.length).toBeGreaterThanOrEqual(2);
  });

  it("resolves the minimal suite with required dependencies", () => {
    const resolved = resolveSuite("minimal");
    const agentIds = resolved.agents.map((a) => a.id);
    expect(agentIds).toContain("reponix-orchestrator");
    expect(agentIds).toContain("repository-analyst");
    expect(agentIds).toContain("architecture-agent");
    expect(agentIds).toContain("code-agent");
    expect(agentIds).toContain("validator-agent");
    expect(agentIds).not.toContain("security-agent");
  });

  it("resolves reconstruction-only suite", () => {
    const resolved = resolveSuite("reconstruction-only");
    const agentIds = resolved.agents.map((a) => a.id);
    expect(agentIds).toContain("reconstruction-agent");
    expect(agentIds).toContain("business-rule-agent");
    expect(agentIds).toContain("workflow-agent");
  });
});
