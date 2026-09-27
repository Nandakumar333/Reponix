import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import {
  type ReponixConfig,
  type ReponixManifest,
  type ReponixStatus,
  ReponixConfigSchema,
  ManifestSchema,
  StatusSchema,
} from "@reponix/schemas";
import { resolveSuite } from "@reponix/core";
import { getAdapter } from "@reponix/adapters";

export interface ScaffoldOptions {
  targetDir?: string;
  force?: boolean;
}

export interface ScaffoldResult {
  config: ReponixConfig;
  manifest: ReponixManifest;
  status: ReponixStatus;
  createdFiles: string[];
}

export async function scaffoldReponix(
  rawConfig: unknown,
  options: ScaffoldOptions = {}
): Promise<ScaffoldResult> {
  const targetDir = options.targetDir || process.cwd();
  const force = options.force ?? false;

  // Validate configuration input with Zod
  const config = ReponixConfigSchema.parse(rawConfig);

  const reponixDir = path.join(targetDir, config.outputDirectory);
  if (fs.existsSync(reponixDir) && !force) {
    const existingConfig = path.join(reponixDir, "config.yaml");
    if (fs.existsSync(existingConfig)) {
      throw new Error(
        `Reponix is already initialized in "${targetDir}". Use --force to overwrite.`
      );
    }
  }

  // Ensure necessary .reponix subdirectories exist
  const dirsToCreate = [
    reponixDir,
    path.join(reponixDir, "graph", "source"),
    path.join(reponixDir, "graph", "normalized"),
    path.join(reponixDir, "semantic"),
    path.join(reponixDir, "evidence"),
    path.join(reponixDir, "docs"),
    path.join(reponixDir, "reconstruction"),
    path.join(reponixDir, "validation"),
  ];

  for (const dir of dirsToCreate) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const createdFiles: string[] = [];

  // Write config.yaml
  const configPath = path.join(reponixDir, "config.yaml");
  fs.writeFileSync(configPath, yaml.stringify(config), "utf-8");
  createdFiles.push(path.relative(targetDir, configPath));

  // Initialize status.json
  const status: ReponixStatus = StatusSchema.parse({
    version: config.version,
    lastRun: new Date().toISOString(),
    overallCompletion: 0,
    currentStage: "INITIALIZED",
    stages: {
      init: {
        status: "COMPLETED",
        updatedAt: new Date().toISOString(),
        summary: `Scaffolded ${config.suite} suite for ${config.platform}`,
      },
      graph: { status: "NOT_STARTED" },
      inventory: { status: "NOT_STARTED" },
      semantic: { status: "NOT_STARTED" },
      reconstruction: { status: "NOT_STARTED" },
      validation: { status: "NOT_STARTED" },
    },
    entitiesCount: {
      files: 0,
      nodes: 0,
      edges: 0,
      features: 0,
      apis: 0,
      databaseTables: 0,
      evidenceCount: 0,
    },
  });

  const statusPath = path.join(reponixDir, "status.json");
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), "utf-8");
  createdFiles.push(path.relative(targetDir, statusPath));

  // Resolve suite agents & skills
  const resolved = resolveSuite(config.suite);
  const adapter = getAdapter(config.platform);

  const manifestAgents: ReponixManifest["agents"] = [];
  const manifestSkills: ReponixManifest["skills"] = [];
  const manifestRootFiles: ReponixManifest["rootFiles"] = [];

  // Render & write agents
  for (const agent of resolved.agents) {
    const rendered = adapter.renderAgent(agent, {
      projectName: config.project.name,
      platform: config.platform,
    });

    const fullPath = path.join(targetDir, rendered.relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, rendered.content, "utf-8");
    createdFiles.push(rendered.relativePath);

    manifestAgents.push({
      id: agent.id,
      name: agent.name,
      path: rendered.relativePath,
      optional: agent.optional ?? false,
    });
  }

  // Render & write skills
  for (const skill of resolved.skills) {
    const rendered = adapter.renderSkill(skill, {
      projectName: config.project.name,
      platform: config.platform,
    });

    const fullPath = path.join(targetDir, rendered.relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, rendered.content, "utf-8");
    createdFiles.push(rendered.relativePath);

    manifestSkills.push({
      id: skill.id,
      name: skill.name,
      path: rendered.relativePath,
    });
  }

  // Render & write root platform instructions
  const rootFiles = adapter.renderRootInstructions(resolved.agents, {
    projectName: config.project.name,
    platform: config.platform,
  });

  for (const rf of rootFiles) {
    const fullPath = path.join(targetDir, rf.relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, rf.content, "utf-8");
    createdFiles.push(rf.relativePath);

    manifestRootFiles.push({
      path: rf.relativePath,
      purpose: `Root instructions for ${adapter.displayName}`,
    });
  }

  // Write manifest.json
  const manifest: ReponixManifest = ManifestSchema.parse({
    version: config.version,
    generatedAt: new Date().toISOString(),
    platform: config.platform,
    scope: config.scope,
    suite: config.suite,
    model: config.model,
    agents: manifestAgents,
    skills: manifestSkills,
    rootFiles: manifestRootFiles,
  });

  const manifestPath = path.join(reponixDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  createdFiles.push(path.relative(targetDir, manifestPath));

  return {
    config,
    manifest,
    status,
    createdFiles,
  };
}
