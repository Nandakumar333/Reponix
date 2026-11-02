import fs from 'node:fs';
import path from 'node:path';
import type { Bundle, Concept } from './types.js';

export interface ConceptDiff {
  created: Concept[];
  updated: Concept[];
  deprecated: Concept[];
}

export function formatLogDate(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function diffConcepts(
  currentConcepts: Map<string, Concept>,
  previousConcepts?: Map<string, Concept>
): ConceptDiff {
  const created: Concept[] = [];
  const updated: Concept[] = [];
  const deprecated: Concept[] = [];

  if (!previousConcepts || previousConcepts.size === 0) {
    for (const concept of currentConcepts.values()) {
      if (concept.frontmatter.status === 'deprecated') {
        deprecated.push(concept);
      } else {
        created.push(concept);
      }
    }
    return { created, updated, deprecated };
  }

  for (const [relPath, concept] of currentConcepts.entries()) {
    const prev = previousConcepts.get(relPath);
    if (!prev) {
      if (concept.frontmatter.status === 'deprecated') {
        deprecated.push(concept);
      } else {
        created.push(concept);
      }
    } else {
      if (concept.frontmatter.status === 'deprecated' && prev.frontmatter.status !== 'deprecated') {
        deprecated.push(concept);
      } else if (concept.raw !== prev.raw) {
        updated.push(concept);
      }
    }
  }

  return { created, updated, deprecated };
}

export function appendLogEntries(
  bundle: Bundle,
  diff: ConceptDiff,
  date: Date = new Date(),
  writeToDisk: boolean = false
): string {
  const dateStr = formatLogDate(date);
  const existingLog = bundle.logFiles.get('log.md') || '';

  const entries: string[] = [];

  for (const c of diff.deprecated) {
    const title = c.frontmatter.title || path.basename(c.bundleRelativePath, '.md');
    entries.push(`* **Deprecation**: Deprecated [${title}](/${c.bundleRelativePath}) - cited source no longer exists.`);
  }

  for (const c of diff.created) {
    const title = c.frontmatter.title || path.basename(c.bundleRelativePath, '.md');
    const desc = c.frontmatter.description ? ` - ${c.frontmatter.description}` : '';
    entries.push(`* **Creation**: Added [${title}](/${c.bundleRelativePath})${desc}`);
  }

  for (const c of diff.updated) {
    const title = c.frontmatter.title || path.basename(c.bundleRelativePath, '.md');
    entries.push(`* **Update**: Updated [${title}](/${c.bundleRelativePath}).`);
  }

  return appendRawLogEntries(bundle, entries, date, writeToDisk);
}

export function appendRawLogEntries(
  bundle: Bundle,
  entries: string[],
  date: Date = new Date(),
  writeToDisk: boolean = false
): string {
  const dateStr = formatLogDate(date);
  const existingLog = bundle.logFiles.get('log.md') || '';

  if (entries.length === 0) {
    return existingLog || '# Bundle Update Log\n';
  }

  const newSection = `## ${dateStr}\n` + entries.join('\n') + '\n';

  let updatedLog = '';
  if (!existingLog) {
    updatedLog = `# Bundle Update Log\n\n${newSection}`;
  } else {
    // Check if ## dateStr already exists at the top
    const heading = `## ${dateStr}`;
    const headingIdx = existingLog.indexOf(heading);

    if (headingIdx !== -1) {
      // Append entries to existing heading block
      const beforeHeading = existingLog.slice(0, headingIdx + heading.length);
      const afterHeading = existingLog.slice(headingIdx + heading.length);
      updatedLog = `${beforeHeading}\n${entries.join('\n')}${afterHeading}`;
    } else {
      // Prepend under the title
      const titleMatch = existingLog.match(/^(#[^\n]+\n+)/);
      if (titleMatch) {
        const titlePart = titleMatch[1];
        const rest = existingLog.slice(titlePart.length);
        updatedLog = `${titlePart}${newSection}\n${rest.trimStart()}`;
      } else {
        updatedLog = `# Bundle Update Log\n\n${newSection}\n${existingLog}`;
      }
    }
  }

  bundle.logFiles.set('log.md', updatedLog);

  if (writeToDisk) {
    const logFilePath = path.join(bundle.rootDir, 'log.md');
    fs.writeFileSync(logFilePath, updatedLog, 'utf-8');
  }

  return updatedLog;
}
