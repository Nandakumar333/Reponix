import path from 'node:path';
import type { Bundle, Concept, ValidationIssue } from './types.js';

export interface ExtractedLink {
  text: string;
  target: string;
  line: number;
}

export function extractMarkdownLinks(body: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const lines = body.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match markdown links: [text](target), ignoring ![image](url)
    const linkRegex = /(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(line)) !== null) {
      const text = match[1];
      const target = match[2].trim();
      links.push({ text, target, line: i + 1 });
    }
  }

  return links;
}

export function resolveBundleLink(
  target: string,
  conceptRelPath: string
): { resolvedRelPath?: string; fragment?: string; isExternal: boolean } {
  const trimmed = target.trim();

  // Ignore external URLs or mailto
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#')
  ) {
    return { isExternal: true };
  }

  // Strip fragment
  const hashIdx = trimmed.indexOf('#');
  const pathPart = hashIdx !== -1 ? trimmed.slice(0, hashIdx) : trimmed;
  const fragment = hashIdx !== -1 ? trimmed.slice(hashIdx) : undefined;

  if (!pathPart) {
    return { fragment, isExternal: false };
  }

  let resolvedRel: string;

  if (pathPart.startsWith('/')) {
    // Bundle-relative
    resolvedRel = pathPart.slice(1);
  } else {
    // Relative to concept directory
    const conceptDir = path.dirname(conceptRelPath);
    resolvedRel = path.join(conceptDir, pathPart);
  }

  // Normalize slashes
  resolvedRel = path.normalize(resolvedRel).replace(/\\/g, '/');

  return { resolvedRelPath: resolvedRel, fragment, isExternal: false };
}

export function validateLinks(
  concept: Concept,
  bundle: Bundle,
  strict: boolean = false
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const defaultSeverity = strict ? 'error' : 'warning';
  const links = extractMarkdownLinks(concept.body);

  for (const link of links) {
    const { resolvedRelPath, isExternal } = resolveBundleLink(
      link.target,
      concept.bundleRelativePath
    );

    if (isExternal || !resolvedRelPath) {
      continue;
    }

    // Check if concept exists in bundle
    // Also check if target is an index file or directory index
    const candidatePaths = [
      resolvedRelPath,
      resolvedRelPath + '.md',
      resolvedRelPath.endsWith('/') ? resolvedRelPath + 'index.md' : resolvedRelPath + '/index.md',
    ];

    const exists = candidatePaths.some(p =>
      bundle.concepts.has(p) ||
      bundle.indexFiles.has(p) ||
      bundle.logFiles.has(p)
    );

    if (!exists) {
      issues.push({
        code: 'OKF_LINK_BROKEN',
        severity: defaultSeverity,
        path: concept.bundleRelativePath,
        line: concept.lineOffset + link.line - 1,
        message: `Broken link to "${link.target}" (resolved to "${resolvedRelPath}")`,
        agent: concept.owningAgent,
      });
    }
  }

  return issues;
}
