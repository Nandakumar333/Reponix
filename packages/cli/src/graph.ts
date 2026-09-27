import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  GraphifyAdapter,
  GraphNormalizer,
  GraphQueryEngine,
  generateMermaidGraph,
  generateGraphSummary,
} from "@reponix/core";
import { StatusSchema, ReponixStatus } from "@reponix/schemas";

export interface GraphCommandOptions {
  force?: boolean;
  format?: "summary" | "mermaid" | "json";
  output?: string;
  rootDir?: string;
  preferFallback?: boolean;
  silent?: boolean;
}

export async function runGraphCommand(options: GraphCommandOptions = {}): Promise<void> {
  const rootDir = options.rootDir || process.cwd();
  const reponixDir = path.join(rootDir, ".reponix");

  if (!fs.existsSync(reponixDir)) {
    if (!options.silent) {
      console.log(pc.yellow("Warning: .reponix configuration not found. Initializing scaffolding first..."));
    }
    fs.mkdirSync(reponixDir, { recursive: true });
  }

  const normalizer = new GraphNormalizer();
  let normalizedGraph = !options.force ? normalizer.load(rootDir) : null;

  if (!normalizedGraph) {
    if (!options.silent) {
      console.log(pc.cyan("⚡ Extracting structural repository graph..."));
    }

    const adapter = new GraphifyAdapter();
    const extractResult = await adapter.extract(rootDir, {
      preferFallback: options.preferFallback,
      silent: options.silent,
    });

    if (!options.silent) {
      console.log(
        pc.green(`✔ Graph extracted (${extractResult.isFallback ? "built-in AST engine" : "Graphify CLI"})`)
      );
      console.log(pc.cyan("⚡ Normalizing structural entities and building index..."));
    }

    const { graph, index } = normalizer.normalize(extractResult.rawGraph, {
      repositoryName: path.basename(rootDir),
    });

    normalizer.save(rootDir, graph, index);
    normalizedGraph = { graph, index };

    // Generate Mermaid visualizer file
    const mmd = generateMermaidGraph(graph);
    const mmdPath = path.join(reponixDir, "graph", "graph.mmd");
    fs.writeFileSync(mmdPath, mmd, "utf-8");

    // Update status.json
    updateStatusWithGraph(reponixDir, graph);
  }

  const { graph, index } = normalizedGraph;
  const queryEngine = new GraphQueryEngine(graph, index);

  if (options.format === "json") {
    console.log(JSON.stringify(graph, null, 2));
    return;
  }

  if (options.format === "mermaid") {
    console.log(generateMermaidGraph(graph));
    return;
  }

  // Default: Formatted terminal summary
  if (!options.silent) {
    const metrics = queryEngine.getMetrics();

    console.log("");
    console.log(pc.bold(pc.cyan("┌────────────────────────────────────────────────────────┐")));
    console.log(pc.bold(pc.cyan("│             REPONIX STRUCTURAL GRAPH REPORT            │")));
    console.log(pc.bold(pc.cyan("└────────────────────────────────────────────────────────┘")));
    console.log("");
    console.log(`  ${pc.bold("Repository:")}            ${pc.white(graph.repository)}`);
    console.log(`  ${pc.bold("Total Nodes:")}           ${pc.green(String(metrics.totalNodes))}`);
    console.log(`  ${pc.bold("Total Relationships:")}   ${pc.green(String(metrics.totalRelationships))}`);
    console.log(
      `  ${pc.bold("Circular Dependencies:")} ${
        metrics.circularDependenciesCount > 0
          ? pc.yellow(String(metrics.circularDependenciesCount) + " detected")
          : pc.green("None detected")
      }`
    );
    console.log("");

    console.log(pc.bold("  Node Breakdown:"));
    for (const [type, count] of Object.entries(metrics.nodeTypes)) {
      console.log(`    • ${pc.cyan(type.padEnd(12))} : ${pc.white(String(count))}`);
    }
    console.log("");

    console.log(pc.bold("  Top Interconnected Components:"));
    for (const item of metrics.topConnectedNodes) {
      console.log(
        `    • ${pc.yellow(`[${item.type}]`)} ${pc.bold(item.name)} (${pc.dim(
          `${item.degree} connections`
        )})`
      );
    }
    console.log("");
    console.log(
      pc.dim(`  Artifacts saved to: ${path.join(reponixDir, "graph", "normalized")}`)
    );
    console.log("");
  }
}

function updateStatusWithGraph(reponixDir: string, graph: any): void {
  const statusPath = path.join(reponixDir, "status.json");
  let currentStatus: ReponixStatus;

  if (fs.existsSync(statusPath)) {
    try {
      currentStatus = StatusSchema.parse(JSON.parse(fs.readFileSync(statusPath, "utf-8")));
    } catch {
      currentStatus = StatusSchema.parse({});
    }
  } else {
    currentStatus = StatusSchema.parse({});
  }

  currentStatus.lastRun = new Date().toISOString();
  currentStatus.currentStage = "graph";
  currentStatus.stages.graph = {
    status: "COMPLETED",
    updatedAt: new Date().toISOString(),
    summary: `Extracted ${graph.stats.nodeCount} nodes and ${graph.stats.relationshipCount} relationships.`,
  };

  const fileCount = graph.stats.nodeTypes.file || 0;
  currentStatus.entitiesCount.files = fileCount;
  currentStatus.entitiesCount.nodes = graph.stats.nodeCount;
  currentStatus.entitiesCount.edges = graph.stats.relationshipCount;

  fs.writeFileSync(statusPath, JSON.stringify(currentStatus, null, 2), "utf-8");
}
