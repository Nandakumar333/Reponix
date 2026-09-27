import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "yaml";
import { scaffoldReponix } from "../../packages/cli/src/scaffold.js";

describe("Integration: reponix init scaffolding", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reponix-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("scaffolds Gemini CLI suite into a fresh repository", async () => {
    const config = {
      version: "1.0",
      platform: "gemini",
      scope: "project",
      suite: "minimal",
      project: {
        name: "test-service",
        language: ["TypeScript"],
        framework: ["Express"],
      },
      graphify: {
        enabled: true,
      },
      outputDirectory: ".reponix",
    };

    const result = await scaffoldReponix(config, { targetDir: tempDir });

    expect(result.createdFiles.length).toBeGreaterThan(5);

    // Verify .reponix configuration files
    const configPath = path.join(tempDir, ".reponix/config.yaml");
    const manifestPath = path.join(tempDir, ".reponix/manifest.json");
    const statusPath = path.join(tempDir, ".reponix/status.json");

    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(statusPath)).toBe(true);

    const parsedConfig = yaml.parse(fs.readFileSync(configPath, "utf-8"));
    expect(parsedConfig.platform).toBe("gemini");
    expect(parsedConfig.suite).toBe("minimal");

    const parsedManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(parsedManifest.platform).toBe("gemini");
    expect(parsedManifest.agents.length).toBe(5);

    // Verify platform-native files
    expect(fs.existsSync(path.join(tempDir, "GEMINI.md"))).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".gemini/agents/spy-orchestrator.md"))
    ).toBe(true);
  });

  it("scaffolds Claude Code suite into a fresh repository", async () => {
    const config = {
      version: "1.0",
      platform: "claude",
      scope: "project",
      suite: "full",
      project: {
        name: "test-claude-service",
        language: ["Python"],
        framework: ["FastAPI"],
      },
      graphify: {
        enabled: true,
      },
      outputDirectory: ".reponix",
    };

    const result = await scaffoldReponix(config, { targetDir: tempDir });
    expect(result.createdFiles.length).toBeGreaterThan(10);

    expect(fs.existsSync(path.join(tempDir, "CLAUDE.md"))).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/agents/spy-orchestrator.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".claude/agents/reconstruction-agent.md"))
    ).toBe(true);
  });

  it("scaffolds Cursor rules with .mdc extension", async () => {
    const config = {
      version: "1.0",
      platform: "cursor",
      scope: "project",
      suite: "minimal",
      project: {
        name: "cursor-test",
        language: ["Go"],
        framework: [],
      },
      graphify: {
        enabled: true,
      },
      outputDirectory: ".reponix",
    };

    const result = await scaffoldReponix(config, { targetDir: tempDir });
    expect(fs.existsSync(path.join(tempDir, ".cursorrules"))).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, ".cursor/rules/spy-orchestrator.mdc"))
    ).toBe(true);
  });

  it("prevents overwriting unless force is true", async () => {
    const config = {
      version: "1.0",
      platform: "gemini",
      scope: "project",
      suite: "minimal",
      project: {
        name: "overwrite-test",
        language: ["JavaScript"],
        framework: [],
      },
      graphify: {
        enabled: true,
      },
      outputDirectory: ".reponix",
    };

    // First scaffold
    await scaffoldReponix(config, { targetDir: tempDir });

    // Second scaffold without force should throw
    await expect(
      scaffoldReponix(config, { targetDir: tempDir, force: false })
    ).rejects.toThrow("already initialized");

    // Second scaffold with force should succeed
    const forcedResult = await scaffoldReponix(config, {
      targetDir: tempDir,
      force: true,
    });
    expect(forcedResult.createdFiles.length).toBeGreaterThan(0);
  });
});
