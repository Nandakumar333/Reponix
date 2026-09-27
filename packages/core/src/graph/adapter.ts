import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

export interface GraphifyExtractionResult {
  sourceDir: string;
  graphJsonPath: string;
  reportPath?: string;
  rawGraph: unknown;
  isFallback: boolean;
  version?: string;
}

export interface GraphifyExtractOptions {
  outputDir?: string;
  forceNative?: boolean;
  preferFallback?: boolean;
  silent?: boolean;
}

export interface RawGraphNode {
  id: string;
  name: string;
  type: string;
  file?: string;
  path?: string;
  start_line?: number;
  end_line?: number;
  [key: string]: unknown;
}

export interface RawGraphEdge {
  source: string;
  target: string;
  relation?: string;
  type?: string;
  [key: string]: unknown;
}

export interface RawGraphOutput {
  nodes?: RawGraphNode[];
  edges?: RawGraphEdge[];
  links?: RawGraphEdge[];
  [key: string]: unknown;
}

export class GraphifyAdapter {
  private graphifyVersion: string | null = null;
  private isGraphifyChecked = false;

  /**
   * Detects whether Graphify CLI is installed and available in the system PATH.
   */
  public async detect(): Promise<{ available: boolean; version?: string }> {
    if (this.isGraphifyChecked) {
      return {
        available: this.graphifyVersion !== null,
        version: this.graphifyVersion || undefined,
      };
    }

    try {
      const output = execSync("graphify --version", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000,
      }).trim();
      this.graphifyVersion = output || "unknown";
      this.isGraphifyChecked = true;
      return { available: true, version: this.graphifyVersion };
    } catch {
      this.graphifyVersion = null;
      this.isGraphifyChecked = true;
      return { available: false };
    }
  }

  /**
   * Extracts structural graph from repository.
   * If Graphify CLI is available and preferFallback is not true, executes Graphify.
   * Otherwise, executes the high-fidelity built-in AST fallback extractor.
   */
  public async extract(
    rootDir: string,
    options: GraphifyExtractOptions = {}
  ): Promise<GraphifyExtractionResult> {
    const outputDir = options.outputDir || path.join(rootDir, ".reponix", "graph", "source");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const detection = await this.detect();

    if (detection.available && !options.preferFallback) {
      try {
        return await this.extractWithGraphify(rootDir, outputDir, detection.version);
      } catch (err) {
        if (!options.silent) {
          console.warn(
            `Graphify CLI execution failed, falling back to built-in AST extractor: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    // Built-in AST extractor
    return await this.extractWithBuiltin(rootDir, outputDir);
  }

  /**
   * Executes native Graphify CLI
   */
  private async extractWithGraphify(
    rootDir: string,
    outputDir: string,
    version?: string
  ): Promise<GraphifyExtractionResult> {
    const tempOutputDir = path.join(outputDir, "temp_graphify");
    if (!fs.existsSync(tempOutputDir)) {
      fs.mkdirSync(tempOutputDir, { recursive: true });
    }

    try {
      execSync(`graphify extract "${rootDir}" --no-cluster --out "${tempOutputDir}"`, {
        cwd: rootDir,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120000,
      });
    } catch (e) {
      // In case graphify extract fails or outputs in different path
      throw new Error(`Graphify command execution failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Search for generated graph.json in tempOutputDir or tempOutputDir/graphify-out/
    const possibleGraphPaths = [
      path.join(tempOutputDir, "graphify-out", "graph.json"),
      path.join(tempOutputDir, "graph.json"),
      path.join(rootDir, "graphify-out", "graph.json"),
    ];

    let foundGraphPath: string | null = null;
    for (const p of possibleGraphPaths) {
      if (fs.existsSync(p)) {
        foundGraphPath = p;
        break;
      }
    }

    if (!foundGraphPath) {
      throw new Error("Graphify executed but graph.json was not found in expected output directories.");
    }

    const targetGraphJson = path.join(outputDir, "graph.json");
    fs.copyFileSync(foundGraphPath, targetGraphJson);

    // Look for GRAPH_REPORT.md
    const possibleReportPaths = [
      path.join(tempOutputDir, "graphify-out", "GRAPH_REPORT.md"),
      path.join(tempOutputDir, "GRAPH_REPORT.md"),
      path.join(rootDir, "graphify-out", "GRAPH_REPORT.md"),
    ];
    let targetReportPath: string | undefined;
    for (const rp of possibleReportPaths) {
      if (fs.existsSync(rp)) {
        targetReportPath = path.join(outputDir, "GRAPH_REPORT.md");
        fs.copyFileSync(rp, targetReportPath);
        break;
      }
    }

    // Clean up temporary directory if exists
    try {
      fs.rmSync(tempOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }

    const rawContent = fs.readFileSync(targetGraphJson, "utf-8");
    const rawGraph = JSON.parse(rawContent);

    return {
      sourceDir: outputDir,
      graphJsonPath: targetGraphJson,
      reportPath: targetReportPath,
      rawGraph,
      isFallback: false,
      version,
    };
  }

  /**
   * Deterministic built-in AST and code extractor.
   * Traverses project files and extracts files, imports, classes, functions, interfaces, and calls.
   */
  public async extractWithBuiltin(
    rootDir: string,
    outputDir: string
  ): Promise<GraphifyExtractionResult> {
    const nodes: RawGraphNode[] = [];
    const edges: RawGraphEdge[] = [];
    const visitedFiles = new Set<string>();

    const ignoreDirs = new Set([
      "node_modules",
      ".git",
      ".reponix",
      "dist",
      "build",
      ".next",
      "coverage",
      "__pycache__",
      ".venv",
      "venv",
      ".gemini",
      ".claude",
      ".cursor",
    ]);

    const sourceExtensions = new Set([
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".py",
      ".go",
      ".java",
      ".json",
    ]);

    const scanDirectory = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            scanDirectory(path.join(currentDir, entry.name));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (sourceExtensions.has(ext)) {
            const fullPath = path.join(currentDir, entry.name);
            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
            visitedFiles.add(relPath);

            const fileNodeId = `file:${relPath}`;
            nodes.push({
              id: fileNodeId,
              name: entry.name,
              type: "file",
              path: relPath,
              file: relPath,
            });

            this.parseFileContent(fullPath, relPath, fileNodeId, nodes, edges);
          }
        }
      }
    };

    scanDirectory(rootDir);

    const rawGraph: RawGraphOutput = {
      nodes,
      edges,
    };

    const targetGraphJson = path.join(outputDir, "graph.json");
    fs.writeFileSync(targetGraphJson, JSON.stringify(rawGraph, null, 2), "utf-8");

    const reportPath = path.join(outputDir, "GRAPH_REPORT.md");
    const reportContent = [
      "# Reponix Graph Extraction Report",
      "",
      `- **Generated At:** ${new Date().toISOString()}`,
      `- **Extractor Mode:** Built-in AST Extractor`,
      `- **Files Scanned:** ${visitedFiles.size}`,
      `- **Nodes Extracted:** ${nodes.length}`,
      `- **Relationships Extracted:** ${edges.length}`,
      "",
      "## Node Distribution",
      ...Object.entries(
        nodes.reduce((acc, n) => {
          acc[n.type] = (acc[n.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([type, count]) => `- **${type}:** ${count}`),
      "",
    ].join("\n");

    fs.writeFileSync(reportPath, reportContent, "utf-8");

    return {
      sourceDir: outputDir,
      graphJsonPath: targetGraphJson,
      reportPath,
      rawGraph,
      isFallback: true,
      version: "reponix-builtin-1.0",
    };
  }

  /**
   * Parses single file content to extract declarations, imports, and calls.
   */
  private parseFileContent(
    filePath: string,
    relPath: string,
    fileNodeId: string,
    nodes: RawGraphNode[],
    edges: RawGraphEdge[]
  ): void {
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      return;
    }

    const lines = content.split(/\r?\n/);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") {
      this.parseTypeScriptOrJavaScript(content, lines, relPath, fileNodeId, nodes, edges);
    } else if (ext === ".py") {
      this.parsePython(content, lines, relPath, fileNodeId, nodes, edges);
    }
  }

  private parseTypeScriptOrJavaScript(
    content: string,
    lines: string[],
    relPath: string,
    fileNodeId: string,
    nodes: RawGraphNode[],
    edges: RawGraphEdge[]
  ): void {
    // 1. Imports: import ... from "path"
    const importRegex = /(?:import\s+(?:[\w*\s{},$]+)\s+from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const targetModule = match[1] || match[2];
      if (targetModule) {
        const importNodeId = `module:${targetModule}`;
        edges.push({
          source: fileNodeId,
          target: importNodeId,
          relation: "imports",
          type: "imports",
        });
      }
    }

    // 2. Classes & Interfaces
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Class match
      const classMatch = /^(?:\s*export\s+)?(?:\s*abstract\s+)?class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$]+))?(?:\s+implements\s+([A-Za-z0-9_$,\s]+))?/.exec(line);
      if (classMatch) {
        const className = classMatch[1];
        const extendsClass = classMatch[2];
        const implementsList = classMatch[3];
        const classNodeId = `class:${relPath}:${className}`;

        nodes.push({
          id: classNodeId,
          name: className,
          type: "class",
          file: relPath,
          path: relPath,
          start_line: lineNum,
          isExported: line.includes("export"),
        });

        edges.push({
          source: fileNodeId,
          target: classNodeId,
          relation: "defines",
          type: "defines",
        });

        if (extendsClass) {
          edges.push({
            source: classNodeId,
            target: extendsClass,
            relation: "extends",
            type: "extends",
          });
        }

        if (implementsList) {
          const ifaces = implementsList.split(",").map((s) => s.trim()).filter(Boolean);
          for (const iface of ifaces) {
            edges.push({
              source: classNodeId,
              target: iface,
              relation: "implements",
              type: "implements",
            });
          }
        }
      }

      // Interface match
      const ifaceMatch = /^(?:\s*export\s+)?interface\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$,\s]+))?/.exec(line);
      if (ifaceMatch) {
        const ifaceName = ifaceMatch[1];
        const ifaceNodeId = `interface:${relPath}:${ifaceName}`;

        nodes.push({
          id: ifaceNodeId,
          name: ifaceName,
          type: "interface",
          file: relPath,
          path: relPath,
          start_line: lineNum,
          isExported: line.includes("export"),
        });

        edges.push({
          source: fileNodeId,
          target: ifaceNodeId,
          relation: "defines",
          type: "defines",
        });
      }

      // Functions match
      const funcMatch = /^(?:\s*export\s+)?(?:\s*async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)/.exec(line) ||
        /^(?:\s*export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>/.exec(line);

      if (funcMatch) {
        const funcName = funcMatch[1];
        const params = funcMatch[2] ? funcMatch[2].split(",").map((p) => p.trim()).filter(Boolean) : [];
        const funcNodeId = `function:${relPath}:${funcName}`;

        nodes.push({
          id: funcNodeId,
          name: funcName,
          type: "function",
          file: relPath,
          path: relPath,
          start_line: lineNum,
          parameters: params,
          isExported: line.includes("export"),
        });

        edges.push({
          source: fileNodeId,
          target: funcNodeId,
          relation: "defines",
          type: "defines",
        });
      }
    }

    // 3. Simple Call detection
    const callRegex = /\b([A-Za-z0-9_$]+)\s*\(/g;
    let callMatch: RegExpExecArray | null;
    const reservedKeywords = new Set([
      "if",
      "for",
      "while",
      "switch",
      "catch",
      "function",
      "return",
      "require",
      "import",
      "export",
      "super",
    ]);

    while ((callMatch = callRegex.exec(content)) !== null) {
      const calledName = callMatch[1];
      if (!reservedKeywords.has(calledName) && calledName.length > 2) {
        edges.push({
          source: fileNodeId,
          target: calledName,
          relation: "calls",
          type: "calls",
        });
      }
    }
  }

  private parsePython(
    content: string,
    lines: string[],
    relPath: string,
    fileNodeId: string,
    nodes: RawGraphNode[],
    edges: RawGraphEdge[]
  ): void {
    // 1. Imports: import foo / from foo import bar
    const importRegex = /^(?:from\s+([A-Za-z0-9_.]+)\s+import\s+([A-Za-z0-9_,\s]+)|import\s+([A-Za-z0-9_.]+))/gm;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const mod = match[1] || match[3];
      if (mod) {
        edges.push({
          source: fileNodeId,
          target: `module:${mod}`,
          relation: "imports",
          type: "imports",
        });
      }
    }

    // 2. Classes and defs
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const classMatch = /^\s*class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:/.exec(line);
      if (classMatch) {
        const className = classMatch[1];
        const classNodeId = `class:${relPath}:${className}`;
        nodes.push({
          id: classNodeId,
          name: className,
          type: "class",
          file: relPath,
          path: relPath,
          start_line: lineNum,
        });
        edges.push({
          source: fileNodeId,
          target: classNodeId,
          relation: "defines",
          type: "defines",
        });
      }

      const defMatch = /^\s*def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\):/.exec(line);
      if (defMatch) {
        const defName = defMatch[1];
        const defNodeId = `function:${relPath}:${defName}`;
        nodes.push({
          id: defNodeId,
          name: defName,
          type: "function",
          file: relPath,
          path: relPath,
          start_line: lineNum,
        });
        edges.push({
          source: fileNodeId,
          target: defNodeId,
          relation: "defines",
          type: "defines",
        });
      }
    }
  }
}
