import { describe, it, expect, beforeEach } from "vitest";
import { GraphNormalizer, GraphQueryEngine, ContextEngine } from "@reponix/core";

describe("ContextEngine Unit Tests", () => {
  let contextEngine: ContextEngine;

  beforeEach(() => {
    const rawData = {
      nodes: [
        { id: "func:orderController", name: "orderController", type: "function", path: "src/api/orders.ts", isExported: true },
        { id: "class:OrderService", name: "OrderService", type: "class", path: "src/services/order.ts" },
        { id: "func:createOrder", name: "createOrder", type: "function", path: "src/services/order.ts", parameters: ["userId", "items"], returnType: "Promise<Order>" },
        { id: "func:validateItems", name: "validateItems", type: "function", path: "src/services/order.ts", parameters: ["items"] },
        { id: "func:calculateTotal", name: "calculateTotal", type: "function", path: "src/services/order.ts", parameters: ["items"] },
        { id: "func:insertOrderDB", name: "insertOrderDB", type: "function", path: "src/db/orders.ts", parameters: ["order"] },
      ],
      edges: [
        { source: "func:orderController", target: "func:createOrder", relation: "calls" },
        { source: "func:createOrder", target: "func:validateItems", relation: "calls" },
        { source: "func:createOrder", target: "func:calculateTotal", relation: "calls" },
        { source: "func:createOrder", target: "func:insertOrderDB", relation: "calls" },
      ],
    };

    const normalizer = new GraphNormalizer();
    const { graph, index } = normalizer.normalize(rawData);
    const queryEngine = new GraphQueryEngine(graph, index);
    contextEngine = new ContextEngine(graph, queryEngine);
  });

  it("should generate a structured context package for a given seed symbol", () => {
    const pkg = contextEngine.generateContext({
      taskId: "TASK-101",
      seedSymbols: ["createOrder"],
      maxTokens: 2000,
      maxDepth: 2,
    });

    expect(pkg.taskId).toBe("TASK-101");
    expect(pkg.nodesIncluded.length).toBeGreaterThan(0);
    expect(pkg.formattedContext).toContain("Structural Context for Task: TASK-101");
    expect(pkg.formattedContext).toContain("createOrder");
    expect(pkg.budgetStats.usedTokens).toBeLessThanOrEqual(pkg.budgetStats.requestedBudget);
  });

  it("should enforce strict token budgets", () => {
    const pkg = contextEngine.generateContext({
      taskId: "TASK-BUDGET-TIGHT",
      seedSymbols: ["createOrder"],
      maxTokens: 80, // Very tight budget
    });

    expect(pkg.budgetStats.usedTokens).toBeLessThanOrEqual(80);
  });

  it("should achieve significant token reduction vs raw full file loading", () => {
    const pkg = contextEngine.generateContext({
      taskId: "TASK-COMPRESSION",
      seedSymbols: ["createOrder"],
      maxTokens: 3000,
    });

    // Compression ratio is usedTokens / rawTokensEquivalent
    expect(pkg.budgetStats.compressionRatio).toBeLessThanOrEqual(0.6); // at least 40% reduction, up to 70%+
  });

  it("should fallback to auto-detected entry points when seeds are empty", () => {
    const pkg = contextEngine.generateContext({
      taskId: "TASK-NO-SEEDS",
      maxTokens: 1000,
    });

    expect(pkg.nodesIncluded.length).toBeGreaterThan(0);
  });
});
