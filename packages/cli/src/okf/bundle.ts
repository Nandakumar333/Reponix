import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { parseConcept } from './parse.js';
import type { Bundle, Concept } from './types.js';

export interface LoadBundleOptions {
  repoRoot?: string;
  allowMissing?: boolean;
}

export function findRepoRoot(startDir: string): string {
  let cur = path.resolve(startDir);
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(cur, '.git')) || fs.existsSync(path.join(cur, 'package.json'))) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(startDir);
}

export function loadBundle(bundleDir: string, options?: LoadBundleOptions): Bundle {
  const resolvedBundleDir = path.resolve(bundleDir);
  const repoRoot = path.resolve(options?.repoRoot || findRepoRoot(resolvedBundleDir));

  // Security check: Bundle dir must not escape repo root
  const relativeToRepo = path.relative(repoRoot, resolvedBundleDir);
  if (relativeToRepo.startsWith('..') || path.isAbsolute(relativeToRepo)) {
    throw new Error(`Path traversal error: Bundle directory "${resolvedBundleDir}" escapes repo root "${repoRoot}"`);
  }

  if (!fs.existsSync(resolvedBundleDir)) {
    if (options?.allowMissing) {
      return {
        rootDir: resolvedBundleDir,
        repoRoot,
        concepts: new Map(),
        indexFiles: new Map(),
        logFiles: new Map(),
      };
    }
    throw new Error(`Bundle directory does not exist: ${resolvedBundleDir}`);
  }

  // Security check: Check if bundleDir itself is a symlink
  const bundleStat = fs.lstatSync(resolvedBundleDir);
  if (bundleStat.isSymbolicLink()) {
    throw new Error(`Security violation: Bundle root directory is a symlink: ${resolvedBundleDir}`);
  }

  const concepts = new Map<string, Concept>();
  const indexFiles = new Map<string, string>();
  const logFiles = new Map<string, string>();
  let okfVersion: string | undefined;

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Symlink check
      const lstat = fs.lstatSync(fullPath);
      if (lstat.isSymbolicLink()) {
        throw new Error(`Security violation: Symlinks are forbidden in OKF bundles: ${fullPath}`);
      }

      // Check path traversal
      const relToRepo = path.relative(repoRoot, fullPath);
      if (relToRepo.startsWith('..') || path.isAbsolute(relToRepo)) {
        throw new Error(`Security violation: Path escapes repository root: ${fullPath}`);
      }

      if (entry.isDirectory()) {
        // Skip hidden directories like .git
        if (!entry.name.startsWith('.')) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        // Only process .md files
        if (!entry.name.endsWith('.md')) {
          continue;
        }

        const relToBundle = path.relative(resolvedBundleDir, fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf-8');

        if (entry.name === 'index.md') {
          indexFiles.set(relToBundle, content);
          // If at root, check for okf_version in frontmatter
          if (relToBundle === 'index.md') {
            const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (match) {
              try {
                const fm = YAML.parse(match[1]);
                if (fm && fm.okf_version) {
                  okfVersion = String(fm.okf_version);
                }
              } catch {
                // ignore
              }
            }
          }
        } else if (entry.name === 'log.md') {
          logFiles.set(relToBundle, content);
        } else {
          const concept = parseConcept(content, fullPath, resolvedBundleDir);
          concepts.set(concept.bundleRelativePath, concept);
        }
      }
    }
  }

  walk(resolvedBundleDir);

  return {
    rootDir: resolvedBundleDir,
    repoRoot,
    concepts,
    indexFiles,
    logFiles,
    okfVersion,
  };
}
