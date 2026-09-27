import * as p from "@clack/prompts";
import pc from "picocolors";
import type { PlatformId, SuiteType } from "@reponix/schemas";
import { detectStack } from "./detector.js";
import { scaffoldReponix } from "./scaffold.js";

export interface InitOptions {
  platform?: PlatformId;
  scope?: "project" | "global";
  suite?: SuiteType;
  model?: string;
  yes?: boolean;
  force?: boolean;
  graphify?: boolean;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const isNonInteractive = options.yes || Boolean(options.platform && options.suite);

  const detected = detectStack(process.cwd());

  if (isNonInteractive) {
    const config = {
      version: "1.0",
      platform: options.platform || "gemini",
      scope: options.scope || "project",
      suite: options.suite || "full",
      model: options.model,
      project: {
        name: detected.projectName,
        language: detected.languages,
        framework: detected.frameworks,
      },
      graphify: {
        enabled: options.graphify ?? true,
        autoInstall: true,
      },
      outputDirectory: ".reponix",
    };

    const result = await scaffoldReponix(config, { force: options.force });
    console.log(pc.green(`✔ Reponix initialized successfully! (${result.createdFiles.length} files created)`));
    return;
  }

  p.intro(pc.bgCyan(pc.black(" REPONIX — AI Software Intelligence & Reconstruction Engine ")));

  p.note(
    `Project: ${pc.bold(detected.projectName)}\n` +
      `Languages: ${pc.cyan(detected.languages.join(", ") || "None detected")}\n` +
      `Frameworks: ${pc.cyan(detected.frameworks.join(", ") || "None detected")}`,
    "Repository Detected"
  );

  const scope = (await p.select({
    message: "Where should REPONIX be installed?",
    options: [
      { value: "project", label: "Project", hint: "Local repository (.reponix/)" },
      { value: "global", label: "Global", hint: "User home directory" },
    ],
    initialValue: options.scope || "project",
  })) as "project" | "global";

  if (p.isCancel(scope)) {
    p.cancel("Initialization cancelled.");
    return;
  }

  const platform = (await p.select({
    message: "Select AI coding harness:",
    options: [
      { value: "gemini", label: "Gemini CLI", hint: ".gemini/agents/ & GEMINI.md" },
      { value: "claude", label: "Claude Code", hint: ".claude/agents/ & CLAUDE.md" },
      { value: "cursor", label: "Cursor", hint: ".cursor/rules/*.mdc" },
      { value: "copilot", label: "GitHub Copilot", hint: ".github/agents/ & instructions" },
      { value: "opencode", label: "OpenCode", hint: ".opencode/agents/" },
      { value: "codex", label: "OpenAI Codex", hint: "AGENTS.md & .codex/" },
    ],
    initialValue: options.platform || "gemini",
  })) as PlatformId;

  if (p.isCancel(platform)) {
    p.cancel("Initialization cancelled.");
    return;
  }

  const suite = (await p.select({
    message: "Select Analysis Suite:",
    options: [
      { value: "full", label: "Full Archaeological Suite (All 13 Agents)", hint: "Recommended" },
      { value: "minimal", label: "Minimal (Cartographer, Architecture, Code)", hint: "Fast start" },
      { value: "reconstruction-only", label: "Reconstruction Suite", hint: "Architecture + Reconstruction" },
      { value: "architecture-only", label: "Architecture Only", hint: "Topology & Component Maps" },
    ],
    initialValue: options.suite || "full",
  })) as SuiteType;

  if (p.isCancel(suite)) {
    p.cancel("Initialization cancelled.");
    return;
  }

  const installGraphify = await p.confirm({
    message: "Enable Graphify AST & Structural Graph extraction?",
    initialValue: options.graphify ?? true,
  });

  if (p.isCancel(installGraphify)) {
    p.cancel("Initialization cancelled.");
    return;
  }

  const s = p.spinner();
  s.start("Generating Reponix agent scaffolding...");

  try {
    const config = {
      version: "1.0",
      platform,
      scope,
      suite,
      model: options.model,
      project: {
        name: detected.projectName,
        language: detected.languages,
        framework: detected.frameworks,
      },
      graphify: {
        enabled: Boolean(installGraphify),
        autoInstall: true,
      },
      outputDirectory: ".reponix",
    };

    const result = await scaffoldReponix(config, { force: options.force });
    s.stop(`Scaffolded ${result.createdFiles.length} files successfully!`);

    p.outro(
      `${pc.green("✔")} Reponix initialized for ${pc.cyan(platform)} (${suite} suite).\n\n` +
        `Next steps:\n` +
        `  1. Inspect configuration in ${pc.bold(".reponix/config.yaml")}\n` +
        `  2. Run archaeology scan: ${pc.cyan("npx reponix scan")}\n` +
        `  3. Check status: ${pc.cyan("npx reponix status")}`
    );
  } catch (err: any) {
    s.stop("Initialization failed.");
    p.log.error(err.message || String(err));
    process.exit(1);
  }
}
