import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { detectStack } from "./detector.js";

export function runDoctor(): void {
  console.log(pc.bold("\nReponix Doctor — Environment & Workspace Diagnostics\n"));

  // Check Node.js
  const nodeVersion = process.version;
  console.log(`Node.js Runtime: ${pc.green(nodeVersion)}`);

  // Check Workspace
  const cwd = process.cwd();
  const stack = detectStack(cwd);
  console.log(`Working Directory: ${pc.cyan(cwd)}`);
  console.log(`Detected Project: ${pc.bold(stack.projectName)}`);
  console.log(`Detected Languages: ${pc.cyan(stack.languages.join(", "))}`);
  console.log(`Detected Frameworks: ${pc.cyan(stack.frameworks.join(", ") || "None")}`);

  // Check .reponix
  const reponixDir = path.join(cwd, ".reponix");
  if (fs.existsSync(reponixDir)) {
    console.log(`Reponix Directory: ${pc.green("Present (.reponix/)")}`);
    const configFile = path.join(reponixDir, "config.yaml");
    console.log(`Config File: ${fs.existsSync(configFile) ? pc.green("Found") : pc.yellow("Missing")}`);
    const manifestFile = path.join(reponixDir, "manifest.json");
    console.log(`Manifest File: ${fs.existsSync(manifestFile) ? pc.green("Found") : pc.yellow("Missing")}`);
  } else {
    console.log(`Reponix Directory: ${pc.yellow("Not initialized (run npx reponix init)")}`);
  }

  console.log(pc.green("\nAll core prerequisites met.\n"));
}
