import fs from 'node:fs';
import path from 'node:path';
import type { Concept, ValidationIssue } from './types.js';

export interface CitationCheckResult {
  issues: ValidationIssue[];
  citedSources: Set<string>;
  uncitedSources: Set<string>;
  missingSources: Set<string>;
}

export function extractFootnotes(body: string): {
  references: Array<{ id: string; line: number }>;
  definitions: Array<{ id: string; line: number }>;
} {
  const references: Array<{ id: string; line: number }> = [];
  const definitions: Array<{ id: string; line: number }> = [];

  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check definitions: [^id]: ...
    const defMatch = line.match(/^\[\^([^\]]+)\]:/);
    if (defMatch) {
      definitions.push({ id: defMatch[1].trim(), line: i + 1 });
    }

    // Check inline references: [^id]
    // Negative lookahead to avoid matching definition beginning
    const refRegex = /\[\^([^\]]+)\](?!:)/g;
    let match: RegExpExecArray | null;
    while ((match = refRegex.exec(line)) !== null) {
      references.push({ id: match[1].trim(), line: i + 1 });
    }
  }

  return { references, definitions };
}

export function parseLineFragment(fragment: string): { start: number; end: number } | null {
  // e.g. #L18-L64, #L18-64, #L18
  const matchRange = fragment.match(/^#L?(\d+)-L?(\d+)$/i);
  if (matchRange) {
    return { start: parseInt(matchRange[1], 10), end: parseInt(matchRange[2], 10) };
  }
  const matchSingle = fragment.match(/^#L?(\d+)$/i);
  if (matchSingle) {
    const line = parseInt(matchSingle[1], 10);
    return { start: line, end: line };
  }
  return null;
}

export function resolveResourcePath(
  resource: string,
  conceptFilePath: string,
  repoRoot: string
): { resolvedPath?: string; fragment?: string; isExternal: boolean } {
  const trimmed = resource.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { isExternal: true };
  }

  // Split path and fragment
  const hashIdx = trimmed.indexOf('#');
  const pathPart = hashIdx !== -1 ? trimmed.slice(0, hashIdx) : trimmed;
  const fragment = hashIdx !== -1 ? trimmed.slice(hashIdx) : undefined;

  if (!pathPart) {
    return { fragment, isExternal: false };
  }

  // If path starts with relative prefix ./ or ../
  let resolved: string;
  if (pathPart.startsWith('.')) {
    resolved = path.resolve(path.dirname(conceptFilePath), pathPart);
  } else if (path.isAbsolute(pathPart)) {
    // Relative to repo root if path starts with /
    resolved = path.resolve(repoRoot, '.' + pathPart);
  } else {
    // Relative to repo root
    resolved = path.resolve(repoRoot, pathPart);
  }

  return { resolvedPath: resolved, fragment, isExternal: false };
}

export function validateCitations(
  concept: Concept,
  repoRoot: string,
  strict: boolean = false
): CitationCheckResult {
  const issues: ValidationIssue[] = [];
  const defaultSeverity = strict ? 'error' : 'warning';

  const sources = concept.frontmatter.sources || [];
  const sourceIds = new Set<string>();
  const sourceMap = new Map<string, any>();

  for (const src of sources) {
    if (src.id) {
      sourceIds.add(src.id);
      sourceMap.set(src.id, src);
    }
  }

  const { references } = extractFootnotes(concept.body);
  const referencedIds = new Set(references.map(r => r.id));

  const citedSources = new Set<string>();
  const uncitedSources = new Set<string>();
  const missingSources = new Set<string>();

  // 1. Check that every footnote reference resolves to a sources[].id
  for (const ref of references) {
    if (sourceIds.has(ref.id)) {
      citedSources.add(ref.id);
    } else {
      missingSources.add(ref.id);
      issues.push({
        code: 'OKF_CITE_FOOTNOTE_UNRESOLVED',
        severity: defaultSeverity,
        path: concept.bundleRelativePath,
        line: concept.lineOffset + ref.line - 1,
        message: `Footnote [^${ref.id}] has no matching source in frontmatter (missing id: "${ref.id}")`,
        agent: concept.owningAgent,
      });
    }
  }

  // 2. Check that every sources[].id is cited by at least one footnote
  for (const srcId of sourceIds) {
    if (!referencedIds.has(srcId)) {
      uncitedSources.add(srcId);
      issues.push({
        code: 'OKF_CITE_SOURCE_UNCITED',
        severity: defaultSeverity,
        path: concept.bundleRelativePath,
        message: `Source with id "${srcId}" is declared in frontmatter but never cited in body via [^${srcId}]`,
        agent: concept.owningAgent,
      });
    }
  }

  // 3. Validate sources[].resource targets
  for (const src of sources) {
    if (!src.resource || typeof src.resource !== 'string') {
      issues.push({
        code: 'OKF_CITE_SOURCE_RESOURCE_MISSING',
        severity: 'error',
        path: concept.bundleRelativePath,
        message: `Source${src.id ? ` "${src.id}"` : ''} is missing required "resource" field`,
        agent: concept.owningAgent,
      });
      continue;
    }

    const { resolvedPath, fragment, isExternal } = resolveResourcePath(
      src.resource,
      concept.filePath,
      repoRoot
    );

    if (isExternal) {
      continue; // External URLs accepted without network check
    }

    if (resolvedPath) {
      if (!fs.existsSync(resolvedPath)) {
        issues.push({
          code: 'OKF_CITE_FILE_NOT_FOUND',
          severity: defaultSeverity,
          path: concept.bundleRelativePath,
          message: `Cited source file does not exist: "${src.resource}" (resolved to "${resolvedPath}")`,
          agent: concept.owningAgent,
        });
        continue;
      }

      // Check line range if fragment specified
      if (fragment) {
        const lineRange = parseLineFragment(fragment);
        if (lineRange) {
          try {
            const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
            const totalLines = fileContent.split(/\r?\n/).length;

            if (lineRange.start < 1 || lineRange.end > totalLines || lineRange.start > lineRange.end) {
              issues.push({
                code: 'OKF_CITE_LINE_RANGE_OUT_OF_BOUNDS',
                severity: defaultSeverity,
                path: concept.bundleRelativePath,
                message: `Line range ${fragment} is out of bounds for "${src.resource}" (file has ${totalLines} lines)`,
                agent: concept.owningAgent,
              });
            }
          } catch {
            // ignore read error
          }
        }
      }
    }
  }

  return {
    issues,
    citedSources,
    uncitedSources,
    missingSources,
  };
}
