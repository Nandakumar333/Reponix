import { execSync } from 'node:child_process';
import path from 'node:path';
import pc from 'picocolors';
import type { Bundle, Concept } from './types.js';
import { readOkfManifest, type OkfManifest } from './manifest.js';
import { isGitRepo } from './git.js';

export interface UpdatePlan {
  lastCommit: string | null;
  changedFiles: string[];
  affectedConcepts: string[];
  agentsToRun: string[];
  unmappedFiles: string[];
}

export function inferAgentForConcept(
  conceptPath: string,
  concept?: Concept
): string {
  if (concept?.owningAgent && concept.owningAgent !== 'unknown') {
    return concept.owningAgent;
  }
  if (concept?.frontmatter?.reponix?.agent) {
    return concept.frontmatter.reponix.agent;
  }

  const norm = conceptPath.replace(/\\/g, '/');
  if (norm.startsWith('contracts/')) return 'code-inspector';
  if (norm.startsWith('architecture/')) return 'arch-mapper';
  if (norm.startsWith('inventory/')) return 'repo-analyst';
  if (norm.startsWith('modernization/')) return 'modernizer';
  if (norm.startsWith('procedures/')) return 'modernizer';
  if (norm.startsWith('validation/')) return 'validator';

  return 'repo-analyst';
}

export function getChangedGitFiles(cwd: string, baseCommit?: string | null): string[] {
  if (!isGitRepo(cwd)) {
    return [];
  }

  try {
    const diffCmd = baseCommit
      ? `git diff --name-only ${baseCommit}`
      : 'git diff --name-only HEAD';

    const out = execSync(diffCmd, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }).trim();

    if (!out) return [];
    return out
      .split(/\r?\n/)
      .map(s => s.trim().replace(/\\/g, '/'))
      .filter(s => s.length > 0);
  } catch {
    return [];
  }
}

export function generateUpdatePlan(
  bundle: Bundle,
  manifest?: OkfManifest | null
): UpdatePlan {
  const activeManifest = manifest || readOkfManifest(bundle.repoRoot);

  if (!activeManifest) {
    throw new Error(
      'No OKF manifest found at .reponix/okf-manifest.json. Run "reponix okf finalize" first to build the manifest.'
    );
  }

  const changedFiles = getChangedGitFiles(bundle.repoRoot, activeManifest.lastCommit);
  const affectedConceptPaths = new Set<string>();
  const unmappedFiles: string[] = [];

  for (const changed of changedFiles) {
    const mapped = activeManifest.mappings[changed];
    if (mapped && mapped.length > 0) {
      for (const c of mapped) {
        affectedConceptPaths.add(c);
      }
    } else {
      unmappedFiles.push(changed);
    }
  }

  const agentsToRun = new Set<string>();
  const affectedList = Array.from(affectedConceptPaths).sort();

  for (const conceptPath of affectedList) {
    const concept = bundle.concepts.get(conceptPath);
    const agent = inferAgentForConcept(conceptPath, concept);
    agentsToRun.add(agent);
  }

  return {
    lastCommit: activeManifest.lastCommit,
    changedFiles,
    affectedConcepts: affectedList,
    agentsToRun: Array.from(agentsToRun).sort(),
    unmappedFiles,
  };
}

export function formatUpdatePlanReport(
  plan: UpdatePlan,
  format: 'text' | 'json' = 'text'
): string {
  if (format === 'json') {
    return JSON.stringify(plan, null, 2);
  }

  const lines: string[] = [''];
  lines.push(pc.bold(pc.cyan('  📋 Incremental Update Plan')));
  if (plan.lastCommit) {
    lines.push(`  Base commit: ${pc.yellow(plan.lastCommit)}`);
  }
  lines.push('');

  lines.push(
    `  Changed Source Files (${plan.changedFiles.length}):`
  );
  if (plan.changedFiles.length === 0) {
    lines.push(pc.dim('    (None detected)'));
  } else {
    for (const f of plan.changedFiles) {
      lines.push(`    • ${f}`);
    }
  }
  lines.push('');

  lines.push(
    `  Affected OKF Concepts (${plan.affectedConcepts.length}):`
  );
  if (plan.affectedConcepts.length === 0) {
    lines.push(pc.dim('    (None affected)'));
  } else {
    for (const c of plan.affectedConcepts) {
      lines.push(`    • ${pc.green(c)}`);
    }
  }
  lines.push('');

  lines.push(pc.bold(`  Agents to Run (${plan.agentsToRun.length}):`));
  if (plan.agentsToRun.length === 0) {
    lines.push(pc.green('    ✔ All concepts are up-to-date. No agents need to run.'));
  } else {
    for (const agent of plan.agentsToRun) {
      lines.push(`    ⚡ ${pc.bold(pc.magenta(agent))}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}
