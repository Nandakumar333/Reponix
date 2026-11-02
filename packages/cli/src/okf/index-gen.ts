import fs from 'node:fs';
import path from 'node:path';
import type { Bundle, Concept } from './types.js';

export const DIRECTORY_DESCRIPTIONS: Record<string, string> = {
  inventory: 'Repository stack, dependencies, build tools, and configurations.',
  dependencies: 'Third-party libraries and runtime packages.',
  build: 'Build tools and packaging manifests.',
  configs: 'Runtime configuration files and environment settings.',
  architecture: 'Component topologies, data flows, and architectural views.',
  components: 'Logical system components and service boundaries.',
  flows: 'Data flow and sequence lifecycles.',
  decisions: 'Architecture decision records.',
  contracts: 'System APIs, database schemas, domain entities, and business rules.',
  apis: 'REST, GraphQL, and RPC service endpoints.',
  schemas: 'Database tables and data storage definitions.',
  entities: 'Domain entity models and invariants.',
  rules: 'Core business logic and algorithmic policies.',
  events: 'Event streaming topics and message definitions.',
  reconstruction: 'Target-neutral reconstruction blueprints and refactoring specs.',
  phases: 'Sequential migration phases and work breakdown.',
  specs: 'Target component specifications.',
  validation: 'Verification audit reports and gap analyses.',
  gaps: 'Identified gaps and evidence defects.',
};

export interface IndexEntry {
  title: string;
  target: string;
  description?: string;
  isDir: boolean;
}

export function buildDirectoryIndex(
  dirRelPath: string,
  bundle: Bundle
): string {
  const isRoot = dirRelPath === '' || dirRelPath === '.';
  const dirNormalized = isRoot ? '' : dirRelPath.replace(/\\/g, '/');

  // Collect immediate concepts and subdirectories
  const conceptEntries: IndexEntry[] = [];
  const subdirs = new Set<string>();

  for (const [relPath, concept] of bundle.concepts.entries()) {
    const parentDir = path.dirname(relPath).replace(/\\/g, '/');
    const normParent = parentDir === '.' ? '' : parentDir;

    if (normParent === dirNormalized) {
      // Direct child concept
      const title = concept.frontmatter.title || path.basename(relPath, '.md');
      const target = path.basename(relPath);
      const description = concept.frontmatter.description;
      conceptEntries.push({ title, target, description, isDir: false });
    } else if (normParent.startsWith(dirNormalized ? dirNormalized + '/' : '')) {
      // Child in a deeper directory: extract first subdir segment
      const remainder = dirNormalized
        ? normParent.slice(dirNormalized.length + 1)
        : normParent;
      const firstSubdir = remainder.split('/')[0];
      if (firstSubdir) {
        subdirs.add(firstSubdir);
      }
    }
  }

  // Sort concepts alphabetically by title
  conceptEntries.sort((a, b) => a.title.localeCompare(b.title));

  // Sort subdirectories
  const sortedSubdirs = Array.from(subdirs).sort();

  const lines: string[] = [];

  // Root index gets okf_version frontmatter (§12)
  if (isRoot) {
    lines.push('---');
    lines.push('okf_version: "0.2"');
    lines.push('---');
    lines.push('');
    lines.push('# Reponix Knowledge Bundle');
    lines.push('');
  } else {
    const folderName = path.basename(dirRelPath);
    const heading = folderName.charAt(0).toUpperCase() + folderName.slice(1);
    lines.push(`# ${heading}`);
    lines.push('');
  }

  if (conceptEntries.length > 0) {
    if (!isRoot) {
      lines.push('## Concepts');
      lines.push('');
    }
    for (const entry of conceptEntries) {
      const desc = entry.description ? ` - ${entry.description}` : '';
      lines.push(`* [${entry.title}](${entry.target})${desc}`);
    }
    lines.push('');
  }

  if (sortedSubdirs.length > 0) {
    lines.push(isRoot ? '## Sections' : '## Subdirectories');
    lines.push('');
    for (const subdir of sortedSubdirs) {
      const folderKey = subdir.toLowerCase();
      const defaultDesc = DIRECTORY_DESCRIPTIONS[folderKey] || `${subdir} concepts and specifications.`;
      const title = subdir.charAt(0).toUpperCase() + subdir.slice(1);
      lines.push(`* [${title}](${subdir}/) - ${defaultDesc}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

export function generateAllIndices(
  bundle: Bundle,
  writeToDisk: boolean = false
): Map<string, string> {
  const generatedIndices = new Map<string, string>();

  // Determine all directories that need index.md
  const directories = new Set<string>();
  directories.add(''); // root

  for (const relPath of bundle.concepts.keys()) {
    let cur = path.dirname(relPath).replace(/\\/g, '/');
    while (cur && cur !== '.') {
      directories.add(cur);
      cur = path.dirname(cur).replace(/\\/g, '/');
    }
  }

  for (const dir of directories) {
    const indexContent = buildDirectoryIndex(dir, bundle);
    const indexRelPath = dir ? `${dir}/index.md` : 'index.md';
    generatedIndices.set(indexRelPath, indexContent);
    bundle.indexFiles.set(indexRelPath, indexContent);

    if (writeToDisk) {
      const targetPath = path.join(bundle.rootDir, indexRelPath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, indexContent, 'utf-8');
    }
  }

  return generatedIndices;
}
