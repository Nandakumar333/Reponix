import { describe, it, expect } from "vitest";
import {
  compileTemplate,
  renderAgent,
  renderSkill,
  renderRootInstructions,
} from "@reponix/templates";
import { spyOrchestratorAgent, repositoryAnalystAgent } from "@reponix/core";
import { graphifySkill } from "@reponix/core";

describe("Generic Templates Engine", () => {
  it("compiles standard Handlebars helpers", () => {
    const template = "{{upper name}} is {{#if (eq role 'Leader')}}Boss{{/if}} | {{join items ', '}}";
    const result = compileTemplate(template, {
      name: "alice",
      role: "Leader",
      items: ["a", "b", "c"],
    });

    expect(result).toBe("ALICE is Boss | a, b, c");
  });

  it("renders reponix-orchestrator agent markdown with required sections", () => {
    const rendered = renderAgent(spyOrchestratorAgent, {
      projectName: "TestService",
      platform: "gemini",
    });

    expect(rendered).toContain("# SPY Orchestrator");
    expect(rendered).toContain("## Role");
    expect(rendered).toContain("## Mission");
    expect(rendered).toContain("## Responsibilities");
    expect(rendered).toContain("## Inputs");
    expect(rendered).toContain("## Required Context");
    expect(rendered).toContain("## Workflow");
    expect(rendered).toContain("## Output Contract");
    expect(rendered).toContain("## Handoff Protocol");
  });

  it("renders generic skill template", () => {
    const rendered = renderSkill(graphifySkill, {
      projectName: "TestService",
    });

    expect(rendered).toContain("# Graphify Integration");
    expect(rendered).toContain("npx graphify");
  });

  it("renders root instructions", () => {
    const rendered = renderRootInstructions([spyOrchestratorAgent, repositoryAnalystAgent], {
      projectName: "PaymentGateway",
      platformName: "Claude Code",
    });

    expect(rendered).toContain("PaymentGateway");
    expect(rendered).toContain("Claude Code");
    expect(rendered).toContain("reponix-orchestrator");
    expect(rendered).toContain("repository-analyst");
  });
});
