import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runGraphCommand } from "../../packages/cli/src/graph.js";

describe("CLI Graph Command Integration Tests", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reponix-graph-cmd-"));

    // Create a realistic sample repository structure
    const srcDir = path.join(tempDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });

    fs.writeFileSync(
      path.join(srcDir, "index.ts"),
      `import { UserService } from "./userService.js";
export function main() {
  const service = new UserService();
  return service.getUser();
}
`,
      "utf-8"
    );

    fs.writeFileSync(
      path.join(srcDir, "userService.ts"),
      `export class UserService {
  getUser() {
    return { id: 1, name: "Alice" };
  }
}
`,
      "utf-8"
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should extract, normalize, and save structural graph artifacts", async () => {
    await runGraphCommand({
      rootDir: tempDir,
      preferFallback: true,
      silent: true,
      force: true,
    });

    const sourceGraph = path.join(tempDir, ".reponix", "graph", "source", "graph.json");
    const sourceReport = path.join(tempDir, ".reponix", "graph", "source", "GRAPH_REPORT.md");
    const normNodes = path.join(tempDir, ".reponix", "graph", "normalized", "nodes.json");
    const normRels = path.join(tempDir, ".reponix", "graph", "normalized", "relationships.json");
    const normIndex = path.join(tempDir, ".reponix", "graph", "normalized", "graph-index.json");
    const mmdFile = path.join(tempDir, ".reponix", "graph", "graph.mmd");
    const statusFile = path.join(tempDir, ".reponix", "status.json");

    expect(fs.existsSync(sourceGraph)).toBe(true);
    expect(fs.existsSync(sourceReport)).toBe(true);
    expect(fs.existsSync(normNodes)).toBe(true);
    expect(fs.existsSync(normRels)).toBe(true);
    expect(fs.existsSync(normIndex)).toBe(true);
    expect(fs.existsSync(mmdFile)).toBe(true);
    expect(fs.existsSync(statusFile)).toBe(true);

    const nodes = JSON.parse(fs.readFileSync(normNodes, "utf-8"));
    expect(nodes.length).toBeGreaterThanOrEqual(2);

    const status = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
    expect(status.stages.graph?.status).toBe("COMPLETED");
    expect(status.entitiesCount?.nodes).toBeGreaterThan(0);
    expect(status.entitiesCount?.edges).toBeGreaterThanOrEqual(0);
  });

  it("should generate valid Mermaid diagram content", async () => {
    await runGraphCommand({
      rootDir: tempDir,
      preferFallback: true,
      silent: true,
      force: true,
    });

    const mmdPath = path.join(tempDir, ".reponix", "graph", "graph.mmd");
    const content = fs.readFileSync(mmdPath, "utf-8");
    expect(content.startsWith("graph TD")).toBe(true);
    expect(content).toContain("index.ts");
    expect(content).toContain("userService.ts");
  });
});
