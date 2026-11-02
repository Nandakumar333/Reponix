import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { loadBundle } from './bundle.js';
import { validateCitations } from './cite.js';
import { validateLinks } from './links.js';
import { stampTrust } from './trust.js';
import { serializeConcept, parseRawDocument } from './parse.js';
import { generateAllIndices } from './index-gen.js';
import { appendLogEntries, diffConcepts } from './log.js';
import { validateBundle } from './validate.js';
import { createFinalizeSummary } from './report.js';
import type { Bundle, FinalizeSummary, ValidationIssue } from './types.js';

import {
  isGitRepo,
  getCurrentCommitSha,
  getRemoteOriginUrl,
  normalizeRepoWebUrl,
  buildPermalink,
  getFileGitMetadata,
} from './git.js';
import { resolveResourcePath } from './cite.js';

export interface FinalizeOptions {
  bundleDir?: string;
  repoRoot?: string;
  strict?: boolean;
  staleAfterDays?: number;
  emitV01Timestamp?: boolean;
  sourceLinks?: 'relative' | 'permalink';
  recordGitAuthors?: boolean;
}

import { scanBundleForSecrets } from './secrets.js';
import { generateOkfManifest, writeOkfManifest } from './manifest.js';

export async function finalizeBundle(options?: FinalizeOptions): Promise<{
  bundle: Bundle;
  summary: FinalizeSummary;
}> {
  const targetDir = options?.bundleDir || 'reponix';
  const bundle = loadBundle(targetDir, { repoRoot: options?.repoRoot, allowMissing: false });

  // Pre-flight: Scan for secrets before writing or stamping anything
  const secretIssues = scanBundleForSecrets(bundle);
  if (secretIssues.length > 0) {
    const msgs = secretIssues.map(i => `[${i.path}:${i.line}] ${i.message}`).join('\n');
    throw new Error(`Secret scanning failed! Refusing to finalize:\n${msgs}`);
  }

  // Clone snapshot of previous concepts for log diffing
  const previousConcepts = new Map(
    Array.from(bundle.concepts.entries()).map(([k, v]) => [k, { ...v, frontmatter: { ...v.frontmatter } }])
  );

  const isGit = isGitRepo(bundle.repoRoot);
  const currentSha = isGit ? getCurrentCommitSha(bundle.repoRoot) : null;
  const remoteUrl = isGit ? getRemoteOriginUrl(bundle.repoRoot) : null;
  const repoWeb = remoteUrl ? normalizeRepoWebUrl(remoteUrl) : null;

  // 1. Cite check & 2. Links check per concept, 3. Trust stamp, and 4. Provenance enrichment
  for (const concept of bundle.concepts.values()) {
    // 1. Cite check using local paths first
    const citeResult = validateCitations(concept, bundle.repoRoot, false);
    const linkIssues = validateLinks(concept, bundle, false);

    const hasMissingSourceFile = citeResult.issues.some(
      i => i.code === 'OKF_CITE_FILE_NOT_FOUND'
    );
    const allPassed = citeResult.issues.length === 0 && linkIssues.length === 0;

    // 2. Stamp trust
    stampTrust(concept, {
      allPassed,
      hasMissingSourceFile,
      staleAfterDays: options?.staleAfterDays ?? 90,
      emitV01Timestamp: options?.emitV01Timestamp ?? true,
    });

    // 3. Provenance enrichment: record commit
    if (isGit && currentSha) {
      concept.frontmatter.reponix = {
        ...concept.frontmatter.reponix,
        commit: currentSha,
      };
    }

    // 4. Provenance enrichment: Git authors and/or permalink rewriting
    if (Array.isArray(concept.frontmatter.sources) && isGit) {
      for (const src of concept.frontmatter.sources) {
        if (!src.resource) continue;

        const { resolvedPath, fragment, isExternal } = resolveResourcePath(
          src.resource,
          concept.filePath,
          bundle.repoRoot
        );

        if (!isExternal && resolvedPath) {
          const repoRel = path.relative(bundle.repoRoot, resolvedPath);

          // Record Git author & last_modified if requested
          if (options?.recordGitAuthors) {
            const gitMeta = getFileGitMetadata(bundle.repoRoot, repoRel);
            if (gitMeta?.author && !src.author) {
              src.author = gitMeta.author;
            }
            if (gitMeta?.lastModified && !src.last_modified) {
              src.last_modified = gitMeta.lastModified;
            }
          }

          // Rewrite sourceLinks to permalink if configured
          if (options?.sourceLinks === 'permalink' && currentSha && repoWeb) {
            src.resource = buildPermalink(
              repoWeb.webUrl,
              repoWeb.type,
              currentSha,
              repoRel,
              fragment
            );
          }
        }
      }
    }

    // Write updated concept back to disk
    const parsedRaw = parseRawDocument(concept.raw);
    const updatedContent = serializeConcept(
      concept.frontmatter,
      concept.body,
      parsedRaw.yamlDoc
    );

    fs.writeFileSync(concept.filePath, updatedContent, 'utf-8');
    concept.raw = updatedContent;
  }

  // 4. Index generation
  generateAllIndices(bundle, true);

  // 5. Log appending
  const diff = diffConcepts(bundle.concepts, previousConcepts);
  appendLogEntries(bundle, diff, new Date(), true);

  // 6. Update .reponix/okf-manifest.json
  const manifest = generateOkfManifest(bundle, currentSha);
  writeOkfManifest(bundle.repoRoot, manifest);

  // 7. Final validation pass
  const issues = validateBundle(bundle, { strict: options?.strict });
  const summary = createFinalizeSummary(bundle, issues);

  return { bundle, summary };
}
