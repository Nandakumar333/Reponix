import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Bundle, Concept } from './types.js';
import { resolveResourcePath } from './cite.js';
import { parsePermalink } from './git.js';
import { formatUtcIso } from './trust.js';

export interface OkfManifest {
  version: string;
  lastCommit: string | null;
  lastUpdated: string;
  mappings: Record<string, string[]>; // sourceFilePath (repo-relative) -> [conceptPaths (bundle-relative)]
  conceptHashes: Record<string, string>; // conceptPath -> SHA-256 content hash
}

export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function getManifestPath(repoRoot: string): string {
  return path.join(repoRoot, '.reponix', 'okf-manifest.json');
}

export function readOkfManifest(repoRoot: string): OkfManifest | null {
  const manifestPath = getManifestPath(repoRoot);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw) as OkfManifest;
  } catch {
    return null;
  }
}

export function writeOkfManifest(repoRoot: string, manifest: OkfManifest): string {
  const manifestPath = getManifestPath(repoRoot);
  const dir = path.dirname(manifestPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(manifestPath, content, 'utf-8');
  return manifestPath;
}

export function generateOkfManifest(
  bundle: Bundle,
  lastCommit: string | null = null,
  now: Date = new Date()
): OkfManifest {
  const mappings: Record<string, string[]> = {};
  const conceptHashes: Record<string, string> = {};

  for (const concept of bundle.concepts.values()) {
    // 1. Compute hash of concept content
    const hash = computeSha256(concept.raw);
    conceptHashes[concept.bundleRelativePath] = hash;

    // 2. Extract cited source files
    if (Array.isArray(concept.frontmatter.sources)) {
      for (const src of concept.frontmatter.sources) {
        if (!src.resource) continue;

        let repoRelativeSource: string | null = null;
        const { resolvedPath, isExternal } = resolveResourcePath(
          src.resource,
          concept.filePath,
          bundle.repoRoot
        );

        if (!isExternal && resolvedPath) {
          repoRelativeSource = path
            .relative(bundle.repoRoot, resolvedPath)
            .replace(/\\/g, '/');
        } else if (isExternal) {
          const permalink = parsePermalink(src.resource);
          if (permalink?.repoRelativePath) {
            repoRelativeSource = permalink.repoRelativePath.replace(/\\/g, '/');
          }
        }

        if (repoRelativeSource) {
          if (!mappings[repoRelativeSource]) {
            mappings[repoRelativeSource] = [];
          }
          if (!mappings[repoRelativeSource].includes(concept.bundleRelativePath)) {
            mappings[repoRelativeSource].push(concept.bundleRelativePath);
          }
        }
      }
    }
  }

  // Sort mappings keys for determinism
  const sortedMappings: Record<string, string[]> = {};
  for (const key of Object.keys(mappings).sort()) {
    sortedMappings[key] = mappings[key].sort();
  }

  return {
    version: '0.2.0',
    lastCommit,
    lastUpdated: formatUtcIso(now),
    mappings: sortedMappings,
    conceptHashes,
  };
}
