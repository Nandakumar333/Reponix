import {
  GraphNode,
  GraphNodeType,
  GraphRelationship,
  NormalizedGraph,
  GraphIndexData,
} from "@reponix/schemas";

export interface CircularDependency {
  cycle: string[]; // Node IDs in sequence ending with cycle.length > 1
}

export interface DataFlowPath {
  sourceId: string;
  sinkId: string;
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface GraphMetrics {
  totalNodes: number;
  totalRelationships: number;
  nodeTypes: Record<string, number>;
  relationshipTypes: Record<string, number>;
  topConnectedNodes: Array<{ id: string; name: string; type: string; degree: number }>;
  circularDependenciesCount: number;
}

export class GraphQueryEngine {
  private graph: NormalizedGraph;
  private index: GraphIndexData;

  constructor(graph: NormalizedGraph, index: GraphIndexData) {
    this.graph = graph;
    this.index = index;
  }

  public findNodeById(id: string): GraphNode | null {
    return this.index.nodesById[id] || null;
  }

  public findNodesByName(name: string, type?: GraphNodeType): GraphNode[] {
    const ids = this.index.nodesByName[name] || [];
    const nodes = ids.map((id) => this.index.nodesById[id]).filter(Boolean) as GraphNode[];
    if (type) {
      return nodes.filter((n) => n.type === type);
    }
    return nodes;
  }

  public findNodesByPath(pathSubstring: string): GraphNode[] {
    const results: GraphNode[] = [];
    const normalizedSub = pathSubstring.replace(/\\/g, "/").toLowerCase();
    for (const node of this.graph.nodes) {
      if (node.path.toLowerCase().includes(normalizedSub)) {
        results.push(node);
      }
    }
    return results;
  }

  public findNodesByType(type: GraphNodeType): GraphNode[] {
    const ids = this.index.nodesByType[type] || [];
    return ids.map((id) => this.index.nodesById[id]).filter(Boolean) as GraphNode[];
  }

  /**
   * Finds all nodes calling the specified symbol (by ID or symbol name).
   */
  public findCallers(symbolIdOrName: string): GraphNode[] {
    const targetIds = this.resolveSymbolIds(symbolIdOrName);
    const callerNodeIds = new Set<string>();

    for (const targetId of targetIds) {
      const incoming = this.index.incomingEdges[targetId] || [];
      for (const rel of incoming) {
        if (rel.type === "calls") {
          callerNodeIds.add(rel.sourceId);
        }
      }
    }

    return Array.from(callerNodeIds)
      .map((id) => this.findNodeById(id))
      .filter((n): n is GraphNode => n !== null);
  }

  /**
   * Finds all nodes called by the specified symbol.
   */
  public findCallees(symbolIdOrName: string): GraphNode[] {
    const sourceIds = this.resolveSymbolIds(symbolIdOrName);
    const calleeNodeIds = new Set<string>();

    for (const sourceId of sourceIds) {
      const outgoing = this.index.outgoingEdges[sourceId] || [];
      for (const rel of outgoing) {
        if (rel.type === "calls") {
          calleeNodeIds.add(rel.targetId);
        }
      }
    }

    return Array.from(calleeNodeIds)
      .map((id) => this.findNodeById(id))
      .filter((n): n is GraphNode => n !== null);
  }

  /**
   * Finds all dependencies (modules/files imported or depended on).
   */
  public findDependencies(moduleIdOrPath: string): GraphNode[] {
    const sourceIds = this.resolveModuleIds(moduleIdOrPath);
    const depNodeIds = new Set<string>();

    for (const sourceId of sourceIds) {
      const outgoing = this.index.outgoingEdges[sourceId] || [];
      for (const rel of outgoing) {
        if (rel.type === "imports" || rel.type === "depends_on") {
          depNodeIds.add(rel.targetId);
        }
      }
    }

    return Array.from(depNodeIds)
      .map((id) => this.findNodeById(id))
      .filter((n): n is GraphNode => n !== null);
  }

  /**
   * Finds all dependents (modules/files that import or depend on this node).
   */
  public findDependents(moduleIdOrPath: string): GraphNode[] {
    const targetIds = this.resolveModuleIds(moduleIdOrPath);
    const dependentNodeIds = new Set<string>();

    for (const targetId of targetIds) {
      const incoming = this.index.incomingEdges[targetId] || [];
      for (const rel of incoming) {
        if (rel.type === "imports" || rel.type === "depends_on") {
          dependentNodeIds.add(rel.sourceId);
        }
      }
    }

    return Array.from(dependentNodeIds)
      .map((id) => this.findNodeById(id))
      .filter((n): n is GraphNode => n !== null);
  }

  /**
   * Identifies candidate entry points (main, CLI, controllers, routes, top exported functions).
   */
  public findEntryPoints(): GraphNode[] {
    const entryPoints: GraphNode[] = [];
    const entryNames = new Set(["main", "run", "start", "init", "index", "handler", "execute"]);

    for (const node of this.graph.nodes) {
      // 1. Named entry points
      if (entryNames.has(node.name.toLowerCase()) && (node.type === "function" || node.type === "file")) {
        entryPoints.push(node);
        continue;
      }

      // 2. Exported functions in entry files (index.ts, main.ts, cli.ts)
      if (
        node.type === "function" &&
        node.metadata?.isExported &&
        (node.path.includes("index") || node.path.includes("cli") || node.path.includes("main"))
      ) {
        entryPoints.push(node);
        continue;
      }

      // 3. Files with outgoing dependencies but zero incoming imports
      if (node.type === "file") {
        const incoming = this.index.incomingEdges[node.id] || [];
        const isImported = incoming.some((r) => r.type === "imports");
        const outgoing = this.index.outgoingEdges[node.id] || [];
        const hasExports = outgoing.some((r) => r.type === "defines" || r.type === "imports");

        if (!isImported && hasExports && (node.path.endsWith("index.ts") || node.path.endsWith("main.py"))) {
          entryPoints.push(node);
        }
      }
    }

    return entryPoints;
  }

  /**
   * Breadth-first search for a direct or indirect path between source and sink.
   */
  public findDataFlow(sourceId: string, sinkId: string, maxDepth = 6): DataFlowPath | null {
    if (sourceId === sinkId) {
      const node = this.findNodeById(sourceId);
      return node ? { sourceId, sinkId, nodes: [node], relationships: [] } : null;
    }

    const queue: Array<{ currentId: string; path: string[]; relPath: GraphRelationship[] }> = [
      { currentId: sourceId, path: [sourceId], relPath: [] },
    ];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const { currentId, path: currentPath, relPath } = queue.shift()!;

      if (currentPath.length > maxDepth) {
        continue;
      }

      const outgoing = this.index.outgoingEdges[currentId] || [];
      for (const rel of outgoing) {
        const nextId = rel.targetId;
        if (nextId === sinkId) {
          const finalPathIds = [...currentPath, nextId];
          const nodes = finalPathIds
            .map((id) => this.findNodeById(id))
            .filter((n): n is GraphNode => n !== null);
          return {
            sourceId,
            sinkId,
            nodes,
            relationships: [...relPath, rel],
          };
        }

        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push({
            currentId: nextId,
            path: [...currentPath, nextId],
            relPath: [...relPath, rel],
          });
        }
      }
    }

    return null;
  }

  /**
   * Detects circular dependencies (cycles in the import/dependency graph) using DFS.
   */
  public detectCircularDependencies(): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const pathStack: string[] = [];

    // Consider only files and modules for circular imports
    const candidateNodes = this.graph.nodes.filter((n) => n.type === "file" || n.type === "module");

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      pathStack.push(nodeId);

      const outgoing = this.index.outgoingEdges[nodeId] || [];
      for (const rel of outgoing) {
        if (rel.type === "imports" || rel.type === "depends_on") {
          const targetId = rel.targetId;

          if (!visited.has(targetId)) {
            dfs(targetId);
          } else if (recStack.has(targetId)) {
            // Cycle detected!
            const cycleStartIdx = pathStack.indexOf(targetId);
            if (cycleStartIdx !== -1) {
              const cyclePath = pathStack.slice(cycleStartIdx).concat(targetId);
              cycles.push({ cycle: cyclePath });
            }
          }
        }
      }

      pathStack.pop();
      recStack.delete(nodeId);
    };

    for (const node of candidateNodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /**
   * Computes top interconnected nodes and structural graph metrics.
   */
  public getMetrics(): GraphMetrics {
    const degrees: Array<{ id: string; name: string; type: string; degree: number }> = [];

    for (const node of this.graph.nodes) {
      const outDeg = (this.index.outgoingEdges[node.id] || []).length;
      const inDeg = (this.index.incomingEdges[node.id] || []).length;
      degrees.push({
        id: node.id,
        name: node.name,
        type: node.type,
        degree: outDeg + inDeg,
      });
    }

    degrees.sort((a, b) => b.degree - a.degree);

    return {
      totalNodes: this.graph.nodes.length,
      totalRelationships: this.graph.relationships.length,
      nodeTypes: this.graph.stats.nodeTypes,
      relationshipTypes: this.graph.stats.relationshipTypes,
      topConnectedNodes: degrees.slice(0, 8),
      circularDependenciesCount: this.detectCircularDependencies().length,
    };
  }

  private resolveSymbolIds(symbolIdOrName: string): string[] {
    if (this.index.nodesById[symbolIdOrName]) {
      return [symbolIdOrName];
    }
    const matchingIds = this.index.nodesByName[symbolIdOrName];
    if (matchingIds && matchingIds.length > 0) {
      return matchingIds;
    }
    return [symbolIdOrName];
  }

  private resolveModuleIds(moduleIdOrPath: string): string[] {
    if (this.index.nodesById[moduleIdOrPath]) {
      return [moduleIdOrPath];
    }
    const byPath = this.index.nodesByPath[moduleIdOrPath];
    if (byPath && byPath.length > 0) {
      return byPath;
    }
    const byName = this.index.nodesByName[moduleIdOrPath];
    if (byName && byName.length > 0) {
      return byName;
    }
    return [moduleIdOrPath];
  }
}
