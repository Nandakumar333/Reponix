import path from 'node:path';
import pc from 'picocolors';
import type { Bundle, Concept } from './types.js';
import { isGitRepo, hasFileChangedSinceCommit, parsePermalink } from './git.js';
import { resolveResourcePath } from './cite.js';

export interface StaleConceptResult {
  id: string;
  bundleRelativePath: string;
  owningAgent: string;
  reasons: string[];
  isTimeStale: boolean;
  isGitStale: boolean;
  staleAfter?: string;
  commit?: string;
  changedFiles?: string[];
}

export function checkConceptStaleness(
  concept: Concept,
  bundle: Bundle,
  now: Date = new Date(),
  isRepoGit: boolean = false
): StaleConceptResult | null {
  const fm = concept.frontmatter;
  const reasons: string[] = [];
  let isTimeStale = false;
  let isGitStale = false;
  const changedFiles: string[] = [];

  // 1. Time-based staleness check
  if (fm.stale_after) {
    const parsed = Date.parse(fm.stale_after);
    if (!isNaN(parsed) && now.getTime() >= parsed) {
      isTimeStale = true;
      reasons.push(`Past stale_after timestamp: ${fm.stale_after}`);
    }
  }

  // 2. Git change-based staleness check
  const baseCommit = fm.reponix?.commit;
  if (isRepoGit && baseCommit && Array.isArray(fm.sources)) {
    for (const src of fm.sources) {
      if (!src.resource) continue;

      const { resolvedPath, isExternal } = resolveResourcePath(
        src.resource,
        concept.filePath,
        bundle.repoRoot
      );

      let candidateRepoRel: string | null = null;

      if (!isExternal && resolvedPath) {
        candidateRepoRel = path.relative(bundle.repoRoot, resolvedPath);
      } else if (isExternal && src.resource) {
        const parsedUrl = parsePermalink(src.resource);
        if (parsedUrl?.repoRelativePath) {
          candidateRepoRel = parsedUrl.repoRelativePath;
        }
      }

      if (candidateRepoRel) {
        if (hasFileChangedSinceCommit(bundle.repoRoot, baseCommit, candidateRepoRel)) {
          isGitStale = true;
          changedFiles.push(src.resource);
          reasons.push(`Cited source file changed since commit ${baseCommit}: "${src.resource}"`);
        }
      }
    }
  }

  if (reasons.length === 0) {
    return null;
  }

  return {
    id: concept.id,
    bundleRelativePath: concept.bundleRelativePath,
    owningAgent: concept.owningAgent || 'unknown',
    reasons,
    isTimeStale,
    isGitStale,
    staleAfter: fm.stale_after,
    commit: baseCommit,
    changedFiles: changedFiles.length > 0 ? changedFiles : undefined,
  };
}

export function checkBundleStaleness(
  bundle: Bundle,
  now: Date = new Date()
): StaleConceptResult[] {
  const isRepoGit = isGitRepo(bundle.repoRoot);
  const staleResults: StaleConceptResult[] = [];

  for (const concept of bundle.concepts.values()) {
    const result = checkConceptStaleness(concept, bundle, now, isRepoGit);
    if (result) {
      staleResults.push(result);
    }
  }

  return staleResults;
}

export function formatStaleReport(
  staleResults: StaleConceptResult[],
  format: 'text' | 'json' = 'text'
): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        totalStale: staleResults.length,
        staleConcepts: staleResults,
      },
      null,
      2
    );
  }

  if (staleResults.length === 0) {
    return pc.green('\n  ✔ All concepts are fresh! Zero stale concepts detected.\n');
  }

  const lines: string[] = [''];
  lines.push(pc.bold(pc.yellow(`  ⚠ Found ${staleResults.length} stale concept(s):\n`)));

  for (const res of staleResults) {
    lines.push(pc.bold(`  • ${pc.cyan(res.bundleRelativePath)} [${res.owningAgent}]`));
    for (const r of res.reasons) {
      lines.push(`      ${pc.yellow('↳')} ${r}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
