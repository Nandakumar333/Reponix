import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { GraphNormalizer } from "@reponix/core";

describe("GraphNormalizer Unit Tests", () => {
  let tempDir: string;
  let normalizer: GraphNormalizer;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reponix-norm-test-"));
    normalizer = new GraphNormalizer();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should normalize raw nodes and edges into a NormalizedGraph", () => {
    const rawData = {
      nodes: [
        { id: "file:src/index.ts", name: "index.ts", type: "file", path: "src/index.ts" },
        { id: "class:OrderService", name: "OrderService", type: "class", path: "src/order.ts" },
        { id: "func:calcDiscount", name: "calcDiscount", type: "function", path: "src/order.ts", start_line: 42 },
      ],
      edges: [
        { source: "file:src/index.ts", target: "class:OrderService", relation: "imports" },
        { source: "class:OrderService", target: "func:calcDiscount", relation: "calls" },
      ],
    };

    const { graph, index } = normalizer.normalize(rawData, { repositoryName: "test-repo" });

    expect(graph.version).toBe("1.0");
    expect(graph.repository).toBe("test-repo");
    expect(graph.nodes.length).toBe(3);
    expect(graph.relationships.length).toBe(2);

    expect(graph.stats.nodeCount).toBe(3);
    expect(graph.stats.relationshipCount).toBe(2);
    expect(graph.stats.nodeTypes.file).toBe(1);
    expect(graph.stats.nodeTypes.class).toBe(1);
    expect(graph.stats.nodeTypes.function).toBe(1);

    expect(index.nodesById["file:src/index.ts"]).toBeDefined();
    expect(index.nodesByName["OrderService"]).toContain("class:OrderService");
    expect(index.outgoingEdges["file:src/index.ts"]).toHaveLength(1);
    expect(index.incomingEdges["func:calcDiscount"]).toHaveLength(1);
  });

  it("should handle links field as alternative to edges", () => {
    const rawData = {
      nodes: [
        { id: "a", name: "a", type: "module" },
        { id: "b", name: "b", type: "module" },
      ],
      links: [
        { source: "a", target: "b", relation: "depends_on" },
      ],
    };

    const { graph } = normalizer.normalize(rawData);
    expect(graph.relationships.length).toBe(1);
    expect(graph.relationships[0].sourceId).toBe("a");
    expect(graph.relationships[0].targetId).toBe("b");
    expect(graph.relationships[0].type).toBe("depends_on");
  });

  it("should deduplicate duplicate nodes and edges", () => {
    const rawData = {
      nodes: [
        { id: "node1", name: "Duplicate", type: "function" },
        { id: "node1", name: "Duplicate", type: "function" },
      ],
      edges: [
        { source: "node1", target: "node1", relation: "calls" },
        { source: "node1", target: "node1", relation: "calls" },
      ],
    };

    const { graph } = normalizer.normalize(rawData);
    expect(graph.nodes.length).toBe(1);
    expect(graph.relationships.length).toBe(1);
  });

  it("should save and load normalized graph from disk", () => {
    const rawData = {
      nodes: [
        { id: "file:app.ts", name: "app.ts", type: "file", path: "app.ts" },
      ],
      edges: [],
    };

    const { graph, index } = normalizer.normalize(rawData, { repositoryName: "save-load-test" });
    const { nodesPath, relationshipsPath, indexPath } = normalizer.save(tempDir, graph, index);

    expect(fs.existsSync(nodesPath)).toBe(true);
    expect(fs.existsSync(relationshipsPath)).toBe(true);
    expect(fs.existsSync(indexPath)).toBe(true);

    const loaded = normalizer.load(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.graph.nodes.length).toBe(1);
    expect(loaded?.graph.nodes[0].name).toBe("app.ts");
    expect(loaded?.index.nodesById["file:app.ts"]).toBeDefined();
  });
});
