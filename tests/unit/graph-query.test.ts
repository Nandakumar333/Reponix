import { describe, it, expect, beforeEach } from "vitest";
import { GraphNormalizer, GraphQueryEngine } from "@reponix/core";

describe("GraphQueryEngine Unit Tests", () => {
  let queryEngine: GraphQueryEngine;

  beforeEach(() => {
    const rawData = {
      nodes: [
        { id: "file:src/cli.ts", name: "cli.ts", type: "file", path: "src/cli.ts" },
        { id: "file:src/order.ts", name: "order.ts", type: "file", path: "src/order.ts" },
        { id: "file:src/payment.ts", name: "payment.ts", type: "file", path: "src/payment.ts" },
        { id: "func:handleCommand", name: "handleCommand", type: "function", path: "src/cli.ts", isExported: true },
        { id: "func:createOrder", name: "createOrder", type: "function", path: "src/order.ts", isExported: true },
        { id: "func:processPayment", name: "processPayment", type: "function", path: "src/payment.ts", isExported: true },
        { id: "class:OrderManager", name: "OrderManager", type: "class", path: "src/order.ts" },
      ],
      edges: [
        { source: "file:src/cli.ts", target: "file:src/order.ts", relation: "imports" },
        { source: "file:src/order.ts", target: "file:src/payment.ts", relation: "imports" },
        { source: "func:handleCommand", target: "func:createOrder", relation: "calls" },
        { source: "func:createOrder", target: "func:processPayment", relation: "calls" },
        { source: "file:src/order.ts", target: "class:OrderManager", relation: "defines" },
      ],
    };

    const normalizer = new GraphNormalizer();
    const { graph, index } = normalizer.normalize(rawData);
    queryEngine = new GraphQueryEngine(graph, index);
  });

  it("should look up nodes by ID, name, path, and type", () => {
    const nodeById = queryEngine.findNodeById("func:createOrder");
    expect(nodeById).not.toBeNull();
    expect(nodeById?.name).toBe("createOrder");

    const nodesByName = queryEngine.findNodesByName("createOrder");
    expect(nodesByName).toHaveLength(1);
    expect(nodesByName[0].id).toBe("func:createOrder");

    const nodesByPath = queryEngine.findNodesByPath("payment.ts");
    expect(nodesByPath.length).toBeGreaterThanOrEqual(1);

    const functions = queryEngine.findNodesByType("function");
    expect(functions.length).toBe(3);
  });

  it("should find callers and callees", () => {
    const callers = queryEngine.findCallers("func:createOrder");
    expect(callers).toHaveLength(1);
    expect(callers[0].id).toBe("func:handleCommand");

    const callees = queryEngine.findCallees("func:createOrder");
    expect(callees).toHaveLength(1);
    expect(callees[0].id).toBe("func:processPayment");
  });

  it("should find dependencies and dependents", () => {
    const deps = queryEngine.findDependencies("file:src/cli.ts");
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe("file:src/order.ts");

    const dependents = queryEngine.findDependents("file:src/order.ts");
    expect(dependents).toHaveLength(1);
    expect(dependents[0].id).toBe("file:src/cli.ts");
  });

  it("should trace data flow paths from source to sink", () => {
    const flow = queryEngine.findDataFlow("func:handleCommand", "func:processPayment");
    expect(flow).not.toBeNull();
    expect(flow?.nodes.map((n) => n.id)).toEqual([
      "func:handleCommand",
      "func:createOrder",
      "func:processPayment",
    ]);
  });

  it("should detect circular dependencies when present", () => {
    // Current setup has no cycles
    expect(queryEngine.detectCircularDependencies()).toHaveLength(0);

    // Add a cycle: payment.ts -> cli.ts
    const cyclicData = {
      nodes: [
        { id: "mod:A", name: "A", type: "module" },
        { id: "mod:B", name: "B", type: "module" },
        { id: "mod:C", name: "C", type: "module" },
      ],
      edges: [
        { source: "mod:A", target: "mod:B", relation: "imports" },
        { source: "mod:B", target: "mod:C", relation: "imports" },
        { source: "mod:C", target: "mod:A", relation: "imports" },
      ],
    };

    const normalizer = new GraphNormalizer();
    const { graph, index } = normalizer.normalize(cyclicData);
    const cyclicEngine = new GraphQueryEngine(graph, index);

    const cycles = cyclicEngine.detectCircularDependencies();
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0].cycle).toContain("mod:A");
    expect(cycles[0].cycle).toContain("mod:B");
    expect(cycles[0].cycle).toContain("mod:C");
  });

  it("should compute accurate graph metrics", () => {
    const metrics = queryEngine.getMetrics();
    expect(metrics.totalNodes).toBe(7);
    expect(metrics.totalRelationships).toBe(5);
    expect(metrics.topConnectedNodes.length).toBeGreaterThan(0);
    expect(metrics.circularDependenciesCount).toBe(0);
  });
});
