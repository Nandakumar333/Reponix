import YAML from 'yaml';
import path from 'node:path';
import type { Concept, ConceptFrontmatter } from './types.js';

export function inferOwningAgent(bundleRelativePath: string, frontmatterAgent?: string): string {
  if (frontmatterAgent) return frontmatterAgent;
  const normalized = bundleRelativePath.replace(/\\/g, '/');
  if (normalized === 'overview.md' || normalized.startsWith('overview/')) return 'reponix-orchestrator';
  if (normalized.startsWith('inventory/')) return 'repo-analyst';
  if (normalized.startsWith('architecture/')) return 'arch-mapper';
  if (normalized.startsWith('contracts/')) return 'code-inspector';
  if (normalized.startsWith('reconstruction/')) return 'modernizer';
  if (normalized.startsWith('validation/')) return 'validator';
  return 'reponix-orchestrator';
}

export interface ParsedDocument {
  frontmatter: ConceptFrontmatter;
  body: string;
  frontmatterRaw: string;
  hasFrontmatter: boolean;
  lineOffset: number;
  yamlDoc?: YAML.Document;
}

export function parseRawDocument(content: string): ParsedDocument {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {} as ConceptFrontmatter,
      body: content,
      frontmatterRaw: '',
      hasFrontmatter: false,
      lineOffset: 1,
    };
  }

  const frontmatterRaw = match[1];
  const body = match[2];

  // Count lines in frontmatter block
  const linesBeforeBody = (content.slice(0, content.length - body.length)).split(/\r?\n/).length;

  let yamlDoc: YAML.Document | undefined;
  let frontmatter: ConceptFrontmatter = {} as ConceptFrontmatter;

  try {
    yamlDoc = YAML.parseDocument(frontmatterRaw, { keepSourceTokens: true });
    const parsed = yamlDoc.toJS();
    if (parsed && typeof parsed === 'object') {
      frontmatter = parsed as ConceptFrontmatter;
    }
  } catch {
    frontmatter = {} as ConceptFrontmatter;
  }

  return {
    frontmatter,
    body,
    frontmatterRaw,
    hasFrontmatter: true,
    lineOffset: linesBeforeBody,
    yamlDoc,
  };
}

export function parseConcept(
  rawContent: string,
  filePath: string,
  bundleRootDir: string
): Concept {
  const parsed = parseRawDocument(rawContent);
  const relPath = path.relative(bundleRootDir, filePath).replace(/\\/g, '/');
  const id = relPath.endsWith('.md') ? relPath.slice(0, -3) : relPath;
  const owningAgent = inferOwningAgent(relPath, parsed.frontmatter?.reponix?.agent);

  return {
    filePath,
    bundleRelativePath: relPath,
    id,
    owningAgent,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    raw: rawContent,
    lineOffset: parsed.lineOffset,
  };
}

export function serializeConcept(
  frontmatter: ConceptFrontmatter,
  body: string,
  baseDoc?: YAML.Document
): string {
  let yamlStr: string;

  if (baseDoc) {
    // Mutate existing doc to preserve order and comments
    for (const [key, value] of Object.entries(frontmatter)) {
      baseDoc.set(key, value);
    }
    yamlStr = baseDoc.toString().trim();
  } else {
    yamlStr = YAML.stringify(frontmatter, { lineWidth: 0 }).trim();
  }

  // Enforce LF line endings
  const cleanBody = body.replace(/\r\n/g, '\n');
  return `---\n${yamlStr}\n---\n\n${cleanBody.replace(/^\n+/, '')}`;
}
