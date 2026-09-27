import { NormalizedGraph, GraphNodeType } from "@reponix/schemas";
import { GraphQueryEngine } from "./query.js";

export interface MermaidOptions {
  maxNodes?: number;
  filterTypes?: GraphNodeType[];
  direction?: "TD" | "LR";
}

/**
 * Generates Mermaid diagram representation of the structural graph.
 */
export function generateMermaidGraph(
  graph: NormalizedGraph,
  options: MermaidOptions = {}
): string {
  const direction = options.direction || "TD";
  const maxNodes = options.maxNodes || 40;
  const filterTypes = new Set(options.filterTypes || ["file", "module", "class"]);

  const lines: string[] = [`graph ${direction}`];

  // Select top relevant nodes
  const filteredNodes = graph.nodes
    .filter((n) => filterTypes.has(n.type))
    .slice(0, maxNodes);

  const includedNodeIds = new Set(filteredNodes.map((n) => n.id));

  // Sanitize IDs for Mermaid syntax
  const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");

  // Output nodes
  for (const node of filteredNodes) {
    const sId = sanitizeId(node.id);
    const label = `${node.name} [${node.type}]`;
    lines.push(`  ${sId}["${label}"]`);
  }

  // Output relationships between included nodes
  let edgeCount = 0;
  for (const rel of graph.relationships) {
    if (includedNodeIds.has(rel.sourceId) && includedNodeIds.has(rel.targetId)) {
      if (edgeCount++ > maxNodes * 2) break;
      const sSource = sanitizeId(rel.sourceId);
      const sTarget = sanitizeId(rel.targetId);
      lines.push(`  ${sSource} -->|${rel.type}| ${sTarget}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generates a formatted text summary of the graph metrics and structural health.
 */
export function generateGraphSummary(
  graph: NormalizedGraph,
  queryEngine?: GraphQueryEngine
): string {
  const qe = queryEngine || new GraphQueryEngine(graph, {
    nodesById: {},
    nodesByName: {},
    nodesByPath: {},
    nodesByType: {
      file: [],
      module: [],
      class: [],
      function: [],
      interface: [],
      variable: [],
    },
    outgoingEdges: {},
    incomingEdges: {},
  });

  const metrics = qe.getMetrics();

  const lines: string[] = [
    `=== Reponix Structural Graph Summary ===`,
    `Repository: ${graph.repository}`,
    `Nodes: ${metrics.totalNodes}`,
    `Relationships: ${metrics.totalRelationships}`,
    `Circular Dependencies: ${metrics.circularDependenciesCount}`,
    ``,
    `Node Breakdown:`,
    ...Object.entries(metrics.nodeTypes).map(([type, count]) => `  - ${type}: ${count}`),
    ``,
    `Relationship Breakdown:`,
    ...Object.entries(metrics.relationshipTypes).map(([type, count]) => `  - ${type}: ${count}`),
    ``,
    `Top Interconnected Components:`,
    ...metrics.topConnectedNodes.map((n) => `  - [${n.type}] ${n.name} (connections: ${n.degree})`),
  ];

  return lines.join("\n");
}
