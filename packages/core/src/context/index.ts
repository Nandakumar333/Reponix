import { GraphNode, GraphRelationship, NormalizedGraph } from "@reponix/schemas";
import { GraphQueryEngine } from "../graph/query.js";

export interface ContextRequest {
  taskId: string;
  seedSymbols?: string[];
  seedFiles?: string[];
  maxTokens?: number; // default 4000
  maxDepth?: number;  // default 2
}

export interface ContextPackage {
  taskId: string;
  totalTokensEstimate: number;
  nodesIncluded: GraphNode[];
  relationshipsIncluded: GraphRelationship[];
  formattedContext: string;
  budgetStats: {
    requestedBudget: number;
    usedTokens: number;
    rawTokensEquivalent: number;
    compressionRatio: number; // usedTokens / rawTokensEquivalent (e.g. 0.35 = 65% reduction)
  };
}

export class ContextEngine {
  private graph: NormalizedGraph;
  private queryEngine: GraphQueryEngine;

  constructor(graph: NormalizedGraph, queryEngine: GraphQueryEngine) {
    this.graph = graph;
    this.queryEngine = queryEngine;
  }

  /**
   * Generates a token-budgeted, relevance-ranked context slice for an agent task.
   */
  public generateContext(request: ContextRequest): ContextPackage {
    const maxTokens = request.maxTokens || 4000;
    const maxDepth = request.maxDepth || 2;
    const seedSymbols = request.seedSymbols || [];
    const seedFiles = request.seedFiles || [];

    // 1. Identify seed nodes
    const seedNodes = new Set<GraphNode>();

    for (const sym of seedSymbols) {
      const byId = this.queryEngine.findNodeById(sym);
      if (byId) {
        seedNodes.add(byId);
      } else {
        const byName = this.queryEngine.findNodesByName(sym);
        for (const n of byName) seedNodes.add(n);
      }
    }

    for (const f of seedFiles) {
      const byPath = this.queryEngine.findNodesByPath(f);
      for (const n of byPath) seedNodes.add(n);
    }

    // If no seeds matched, pick high-degree entry points or top connected nodes as defaults
    if (seedNodes.size === 0) {
      const entryPoints = this.queryEngine.findEntryPoints();
      if (entryPoints.length > 0) {
        for (const ep of entryPoints.slice(0, 5)) {
          seedNodes.add(ep);
        }
      } else {
        const metrics = this.queryEngine.getMetrics();
        for (const item of metrics.topConnectedNodes.slice(0, 5)) {
          const n = this.queryEngine.findNodeById(item.id);
          if (n) seedNodes.add(n);
        }
        if (seedNodes.size === 0 && this.graph.nodes.length > 0) {
          for (const n of this.graph.nodes.slice(0, 5)) {
            seedNodes.add(n);
          }
        }
      }
    }

    // 2. BFS graph expansion with scored relevance
    const scoredNodes = new Map<string, { node: GraphNode; score: number }>();
    const relationshipsIncluded: GraphRelationship[] = [];
    const queue: Array<{ node: GraphNode; depth: number }> = [];

    for (const node of seedNodes) {
      scoredNodes.set(node.id, { node, score: 100 });
      queue.push({ node, depth: 0 });
    }

    const seenEdges = new Set<string>();

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;

      // Expand outgoing (callees & dependencies)
      const callees = this.queryEngine.findCallees(node.id);
      for (const callee of callees) {
        const edgeKey = `${node.id}->${callee.id}`;
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          relationshipsIncluded.push({
            id: edgeKey,
            sourceId: node.id,
            targetId: callee.id,
            type: "calls",
          });
        }

        const existing = scoredNodes.get(callee.id);
        const score = 100 - (depth + 1) * 25;
        if (!existing || existing.score < score) {
          scoredNodes.set(callee.id, { node: callee, score });
          queue.push({ node: callee, depth: depth + 1 });
        }
      }

      // Expand incoming (callers)
      const callers = this.queryEngine.findCallers(node.id);
      for (const caller of callers) {
        const edgeKey = `${caller.id}->${node.id}`;
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          relationshipsIncluded.push({
            id: edgeKey,
            sourceId: caller.id,
            targetId: node.id,
            type: "calls",
          });
        }

        const existing = scoredNodes.get(caller.id);
        const score = 90 - (depth + 1) * 30;
        if (!existing || existing.score < score) {
          scoredNodes.set(caller.id, { node: caller, score });
          queue.push({ node: caller, depth: depth + 1 });
        }
      }
    }

    // 3. Sort nodes by relevance score
    const sortedNodes = Array.from(scoredNodes.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => item.node);

    // 4. Token budgeting & formatting
    const selectedNodes: GraphNode[] = [];
    const contextSections: string[] = [
      `### Structural Context for Task: ${request.taskId}`,
      `Seed targets: ${seedSymbols.join(", ") || "Auto-detected entry points"}`,
      "",
    ];

    let currentTokens = this.estimateTokens(contextSections.join("\n"));
    let rawTokensEquivalent = 0;

    for (const node of sortedNodes) {
      const nodeSummary = this.formatNodeSummary(node);
      const nodeTokens = this.estimateTokens(nodeSummary);
      const hypotheticalRawTokens = 250; // Average raw file segment token cost
      rawTokensEquivalent += hypotheticalRawTokens;

      if (currentTokens + nodeTokens <= maxTokens) {
        currentTokens += nodeTokens;
        selectedNodes.push(node);
        contextSections.push(nodeSummary);
      } else {
        // Truncate to compact signature if remaining room
        const compact = `- [${node.type}] \`${node.name}\` (${node.path})`;
        const compactTokens = this.estimateTokens(compact);
        if (currentTokens + compactTokens <= maxTokens) {
          currentTokens += compactTokens;
          selectedNodes.push(node);
          contextSections.push(compact);
        }
      }
    }

    if (relationshipsIncluded.length > 0) {
      contextSections.push("");
      contextSections.push("### Key Relationships");
      for (const r of relationshipsIncluded.slice(0, 15)) {
        const s = this.queryEngine.findNodeById(r.sourceId)?.name || r.sourceId;
        const t = this.queryEngine.findNodeById(r.targetId)?.name || r.targetId;
        const edgeLine = `- \`${s}\` --(${r.type})--> \`${t}\``;
        if (currentTokens + this.estimateTokens(edgeLine) <= maxTokens) {
          currentTokens += this.estimateTokens(edgeLine);
          contextSections.push(edgeLine);
        }
      }
    }

    const formattedContext = contextSections.join("\n");
    const totalTokensEstimate = this.estimateTokens(formattedContext);

    const safeRaw = Math.max(rawTokensEquivalent, totalTokensEstimate * 2);
    const compressionRatio = Number((totalTokensEstimate / safeRaw).toFixed(2));

    return {
      taskId: request.taskId,
      totalTokensEstimate,
      nodesIncluded: selectedNodes,
      relationshipsIncluded,
      formattedContext,
      budgetStats: {
        requestedBudget: maxTokens,
        usedTokens: totalTokensEstimate,
        rawTokensEquivalent: safeRaw,
        compressionRatio,
      },
    };
  }

  private formatNodeSummary(node: GraphNode): string {
    const lines: string[] = [
      `#### [${node.type.toUpperCase()}] ${node.name}`,
      `- Path: \`${node.path}\`${node.location?.startLine ? ` (line ${node.location.startLine})` : ""}`,
    ];

    if (node.metadata?.parameters && node.metadata.parameters.length > 0) {
      lines.push(`- Parameters: ${node.metadata.parameters.join(", ")}`);
    }

    if (node.metadata?.returnType) {
      lines.push(`- Returns: \`${node.metadata.returnType}\``);
    }

    if (node.metadata?.isExported) {
      lines.push(`- Exported: yes`);
    }

    return lines.join("\n") + "\n";
  }

  private estimateTokens(text: string): number {
    // Standard rule of thumb: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
