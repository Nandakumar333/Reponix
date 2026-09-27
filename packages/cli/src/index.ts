#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./init.js";
import { runDoctor } from "./doctor.js";
import { runGraphCommand } from "./graph.js";

const program = new Command();

program
  .name("reponix")
  .description("Reponix — AI Software Intelligence & Reconstruction Engine")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize Reponix agent scaffolding in current repository")
  .option("-p, --platform <platform>", "AI harness: claude, gemini, cursor, copilot, opencode, codex")
  .option("-s, --suite <suite>", "Analysis suite: full, minimal, reconstruction-only, architecture-only")
  .option("--scope <scope>", "Installation scope: project or global", "project")
  .option("-m, --model <model>", "Target model configuration")
  .option("-y, --yes", "Run non-interactively using defaults or provided flags")
  .option("-f, --force", "Overwrite existing .reponix directory")
  .option("--no-graphify", "Disable Graphify integration")
  .action(async (options) => {
    await runInit({
      platform: options.platform,
      suite: options.suite,
      scope: options.scope,
      model: options.model,
      yes: options.yes,
      force: options.force,
      graphify: options.graphify,
    });
  });

program
  .command("doctor")
  .description("Check repository environment, toolchain, and Reponix status")
  .action(() => {
    runDoctor();
  });

program
  .command("graph")
  .description("Generate, normalize and inspect structural repository graph")
  .option("-f, --force", "Force re-extraction and normalization of the repository graph")
  .option("--format <format>", "Output format: summary, mermaid, json", "summary")
  .option("--fallback", "Use built-in AST extractor instead of native Graphify CLI")
  .action(async (options) => {
    await runGraphCommand({
      force: options.force,
      format: options.format as "summary" | "mermaid" | "json",
      preferFallback: options.fallback,
    });
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
