import * as fs from "node:fs";
import * as path from "node:path";
import {
  GraphNode,
  GraphNodeType,
  GraphNodeTypeSchema,
  GraphRelationship,
  GraphRelationshipType,
  GraphRelationshipTypeSchema,
  NormalizedGraph,
  NormalizedGraphSchema,
  GraphIndexData,
  GraphIndexDataSchema,
} from "@reponix/schemas";
import { RawGraphOutput, RawGraphNode, RawGraphEdge } from "./adapter.js";

export interface NormalizationOptions {
  repositoryName?: string;
  generateIndex?: boolean;
}

export class GraphNormalizer {
  /**
   * Normalizes raw graph data into standardized NormalizedGraph and pre-computed GraphIndexData.
   */
  public normalize(
    raw: unknown,
    options: NormalizationOptions = {}
  ): { graph: NormalizedGraph; index: GraphIndexData } {
    const rawData = (raw && typeof raw === "object" ? raw : {}) as RawGraphOutput;
    const rawNodes = Array.isArray(rawData.nodes) ? rawData.nodes : [];
    const rawEdges = Array.isArray(rawData.edges)
      ? rawData.edges
      : Array.isArray(rawData.links)
        ? rawData.links
        : [];

    const nodesMap = new Map<string, GraphNode>();
    const nodeNameToIds = new Map<string, string[]>();

    // 1. Normalize nodes
    for (const rawNode of rawNodes) {
      const node = this.normalizeNode(rawNode);
      if (node) {
        nodesMap.set(node.id, node);
        const existing = nodeNameToIds.get(node.name) || [];
        existing.push(node.id);
        nodeNameToIds.set(node.name, existing);
      }
    }

    // 2. Normalize edges / relationships
    const relationships: GraphRelationship[] = [];
    const seenRelKeys = new Set<string>();

    for (let i = 0; i < rawEdges.length; i++) {
      const rawEdge = rawEdges[i];
      const rel = this.normalizeRelationship(rawEdge, i, nodesMap, nodeNameToIds);
      if (rel) {
        const key = `${rel.sourceId}:${rel.type}:${rel.targetId}`;
        if (!seenRelKeys.has(key)) {
          seenRelKeys.add(key);
          relationships.push(rel);
        }
      }
    }

    const nodes = Array.from(nodesMap.values());

    // 3. Compute stats
    const nodeTypes: Record<string, number> = {};
    for (const n of nodes) {
      nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1;
    }

    const relationshipTypes: Record<string, number> = {};
    for (const r of relationships) {
      relationshipTypes[r.type] = (relationshipTypes[r.type] || 0) + 1;
    }

    const graph: NormalizedGraph = NormalizedGraphSchema.parse({
      version: "1.0",
      repository: options.repositoryName || "unknown",
      generatedAt: new Date().toISOString(),
      stats: {
        nodeCount: nodes.length,
        relationshipCount: relationships.length,
        nodeTypes,
        relationshipTypes,
      },
      nodes,
      relationships,
    });

    // 4. Compute index
    const index = this.buildIndex(graph);

    return { graph, index };
  }

  /**
   * Builds an inverted search index over the normalized graph.
   */
  public buildIndex(graph: NormalizedGraph): GraphIndexData {
    const nodesById: Record<string, GraphNode> = {};
    const nodesByName: Record<string, string[]> = {};
    const nodesByPath: Record<string, string[]> = {};
    const nodesByType: Record<GraphNodeType, string[]> = {
      file: [],
      module: [],
      class: [],
      function: [],
      interface: [],
      variable: [],
    };
    const outgoingEdges: Record<string, GraphRelationship[]> = {};
    const incomingEdges: Record<string, GraphRelationship[]> = {};

    for (const node of graph.nodes) {
      nodesById[node.id] = node;

      if (!nodesByName[node.name]) {
        nodesByName[node.name] = [];
      }
      nodesByName[node.name].push(node.id);

      if (!nodesByPath[node.path]) {
        nodesByPath[node.path] = [];
      }
      nodesByPath[node.path].push(node.id);

      if (nodesByType[node.type]) {
        nodesByType[node.type].push(node.id);
      }
    }

    for (const rel of graph.relationships) {
      if (!outgoingEdges[rel.sourceId]) {
        outgoingEdges[rel.sourceId] = [];
      }
      outgoingEdges[rel.sourceId].push(rel);

      if (!incomingEdges[rel.targetId]) {
        incomingEdges[rel.targetId] = [];
      }
      incomingEdges[rel.targetId].push(rel);
    }

    return GraphIndexDataSchema.parse({
      nodesById,
      nodesByName,
      nodesByPath,
      nodesByType,
      outgoingEdges,
      incomingEdges,
    });
  }

  /**
   * Saves normalized graph artifacts to .reponix/graph/normalized/
   */
  public save(
    rootDir: string,
    graph: NormalizedGraph,
    index?: GraphIndexData
  ): { nodesPath: string; relationshipsPath: string; indexPath: string } {
    const normDir = path.join(rootDir, ".reponix", "graph", "normalized");
    if (!fs.existsSync(normDir)) {
      fs.mkdirSync(normDir, { recursive: true });
    }

    const nodesPath = path.join(normDir, "nodes.json");
    const relationshipsPath = path.join(normDir, "relationships.json");
    const indexPath = path.join(normDir, "graph-index.json");

    fs.writeFileSync(nodesPath, JSON.stringify(graph.nodes, null, 2), "utf-8");
    fs.writeFileSync(relationshipsPath, JSON.stringify(graph.relationships, null, 2), "utf-8");

    const graphIndex = index || this.buildIndex(graph);
    fs.writeFileSync(indexPath, JSON.stringify(graphIndex, null, 2), "utf-8");

    return { nodesPath, relationshipsPath, indexPath };
  }

  /**
   * Loads saved normalized graph and index from .reponix/graph/normalized/
   */
  public load(rootDir: string): { graph: NormalizedGraph; index: GraphIndexData } | null {
    const normDir = path.join(rootDir, ".reponix", "graph", "normalized");
    const nodesPath = path.join(normDir, "nodes.json");
    const relationshipsPath = path.join(normDir, "relationships.json");
    const indexPath = path.join(normDir, "graph-index.json");

    if (!fs.existsSync(nodesPath) || !fs.existsSync(relationshipsPath)) {
      return null;
    }

    try {
      const nodes = JSON.parse(fs.readFileSync(nodesPath, "utf-8")) as GraphNode[];
      const relationships = JSON.parse(fs.readFileSync(relationshipsPath, "utf-8")) as GraphRelationship[];

      const nodeTypes: Record<string, number> = {};
      for (const n of nodes) {
        nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1;
      }
      const relationshipTypes: Record<string, number> = {};
      for (const r of relationships) {
        relationshipTypes[r.type] = (relationshipTypes[r.type] || 0) + 1;
      }

      const graph = NormalizedGraphSchema.parse({
        version: "1.0",
        repository: path.basename(rootDir),
        generatedAt: new Date().toISOString(),
        stats: {
          nodeCount: nodes.length,
          relationshipCount: relationships.length,
          nodeTypes,
          relationshipTypes,
        },
        nodes,
        relationships,
      });

      let index: GraphIndexData;
      if (fs.existsSync(indexPath)) {
        index = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as GraphIndexData;
      } else {
        index = this.buildIndex(graph);
      }

      return { graph, index };
    } catch {
      return null;
    }
  }

  private normalizeNode(rawNode: RawGraphNode): GraphNode | null {
    if (!rawNode) return null;

    const rawId = String(rawNode.id || rawNode.name || "");
    if (!rawId) return null;

    const name = String(rawNode.name || rawId.split(":").pop() || "unknown");
    const filePath = String(rawNode.file || rawNode.path || "unknown").replace(/\\/g, "/");

    // Map raw type to valid GraphNodeType
    let type: GraphNodeType = "variable";
    const rawType = String(rawNode.type || "").toLowerCase();

    if (rawType.includes("file")) {
      type = "file";
    } else if (rawType.includes("module") || rawType.includes("package")) {
      type = "module";
    } else if (rawType.includes("class") || rawType.includes("struct")) {
      type = "class";
    } else if (rawType.includes("func") || rawType.includes("method") || rawType.includes("def")) {
      type = "function";
    } else if (rawType.includes("interface") || rawType.includes("protocol") || rawType.includes("trait")) {
      type = "interface";
    } else {
      type = "variable";
    }

    const startLine = typeof rawNode.start_line === "number" ? rawNode.start_line : undefined;
    const endLine = typeof rawNode.end_line === "number" ? rawNode.end_line : undefined;

    return {
      id: rawId,
      name,
      type,
      path: filePath,
      location: startLine ? { startLine, endLine } : undefined,
      metadata: {
        isExported: Boolean(rawNode.isExported),
        parameters: Array.isArray(rawNode.parameters) ? rawNode.parameters : undefined,
        returnType: typeof rawNode.returnType === "string" ? rawNode.returnType : undefined,
      },
    };
  }

  private normalizeRelationship(
    rawEdge: RawGraphEdge,
    index: number,
    nodesMap: Map<string, GraphNode>,
    nodeNameToIds: Map<string, string[]>
  ): GraphRelationship | null {
    if (!rawEdge) return null;

    let sourceId = String(rawEdge.source || "");
    let targetId = String(rawEdge.target || "");

    if (!sourceId || !targetId) return null;

    // Resolve targetId if it is only a symbol name not yet a node ID
    if (!nodesMap.has(targetId)) {
      const candidates = nodeNameToIds.get(targetId);
      if (candidates && candidates.length === 1) {
        targetId = candidates[0];
      } else if (!targetId.includes(":")) {
        // Create an implicit symbol node if needed
        const implicitId = `symbol:${targetId}`;
        if (!nodesMap.has(implicitId)) {
          const implicitNode: GraphNode = {
            id: implicitId,
            name: targetId,
            type: "function",
            path: "external",
            metadata: { isExternal: true },
          };
          nodesMap.set(implicitId, implicitNode);
        }
        targetId = implicitId;
      }
    }

    // Resolve sourceId if needed
    if (!nodesMap.has(sourceId)) {
      const candidates = nodeNameToIds.get(sourceId);
      if (candidates && candidates.length === 1) {
        sourceId = candidates[0];
      }
    }

    let relType: GraphRelationshipType = "depends_on";
    const rawRel = String(rawEdge.relation || rawEdge.type || "").toLowerCase();

    if (rawRel.includes("call")) {
      relType = "calls";
    } else if (rawRel.includes("import") || rawRel.includes("include") || rawRel.includes("require")) {
      relType = "imports";
    } else if (rawRel.includes("define") || rawRel.includes("contains") || rawRel.includes("has")) {
      relType = "defines";
    } else if (rawRel.includes("implement")) {
      relType = "implements";
    } else if (rawRel.includes("extend") || rawRel.includes("inherit")) {
      relType = "extends";
    } else {
      relType = "depends_on";
    }

    return {
      id: `rel:${index}:${sourceId}->${targetId}`,
      sourceId,
      targetId,
      type: relType,
      metadata: {
        weight: typeof rawEdge.weight === "number" ? rawEdge.weight : 1,
      },
    };
  }
}
