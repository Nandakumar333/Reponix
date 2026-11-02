import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { finalizeBundle } from './finalize.js';
import { formatLogDate } from './log.js';
import type { FinalizeSummary } from './types.js';

export interface MigrateOptions {
  inputDir?: string;
  outputDir?: string;
  repoRoot?: string;
  dryRun?: boolean;
}

export interface MigratedFile {
  relativePath: string;
  content: string;
}

export interface MigrateResult {
  files: MigratedFile[];
  dryRun: boolean;
  outputDir: string;
  finalizeSummary?: FinalizeSummary;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function splitMarkdownSections(
  content: string,
  minLevel: number = 1,
  maxLevel: number = 2
): Array<{ title: string; body: string }> {
  const lines = content.split(/\r?\n/);
  const sections: Array<{ title: string; body: string }> = [];

  let currentTitle = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      if (level >= minLevel && level <= maxLevel) {
        if (currentTitle || currentLines.length > 0) {
          sections.push({
            title: currentTitle || 'Overview',
            body: currentLines.join('\n').trim(),
          });
        }
        currentTitle = headingMatch[2].trim();
        currentLines = [];
        continue;
      }
    }
    currentLines.push(line);
  }

  if (currentTitle || currentLines.length > 0) {
    sections.push({
      title: currentTitle || 'Overview',
      body: currentLines.join('\n').trim(),
    });
  }

  return sections.filter(s => s.body.length > 0 || s.title.length > 0);
}

function detectCitedFiles(text: string): string[] {
  const matches = text.match(/(?:`|\(|"|'|\s)([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,5})(?:`|\)|"|'|\s|$)/g);
  if (!matches) return [];

  const files = new Set<string>();
  for (const raw of matches) {
    const clean = raw.replace(/[`"'\s()]/g, '');
    if (
      clean.includes('/') &&
      !clean.startsWith('http://') &&
      !clean.startsWith('https://') &&
      !clean.endsWith('.md')
    ) {
      files.add(clean.startsWith('/') ? clean : `/${clean}`);
    }
  }
  return Array.from(files);
}

function createConceptDocument(
  frontmatter: Record<string, any>,
  body: string
): string {
  const yamlStr = YAML.stringify(frontmatter).trim();
  return `---\n${yamlStr}\n---\n\n${body.trim()}\n`;
}

export async function migrateLegacyDocs(
  options?: MigrateOptions
): Promise<MigrateResult> {
  const repoRoot = options?.repoRoot || process.cwd();
  let inputDir = options?.inputDir;

  if (!inputDir) {
    if (fs.existsSync(path.join(repoRoot, 'docs'))) {
      inputDir = path.join(repoRoot, 'docs');
    } else if (fs.existsSync(path.join(repoRoot, 'reponix'))) {
      inputDir = path.join(repoRoot, 'reponix');
    } else {
      inputDir = path.join(repoRoot, 'docs');
    }
  }

  const outputDir = path.resolve(options?.outputDir || path.join(repoRoot, 'reponix'));
  const files: MigratedFile[] = [];

  // Helper to read legacy file
  function readLegacy(name: string): string | null {
    const full = path.join(inputDir!, name);
    if (fs.existsSync(full)) {
      return fs.readFileSync(full, 'utf-8');
    }
    return null;
  }

  // 1. README.md -> overview.md
  const readmeContent = readLegacy('README.md');
  if (readmeContent) {
    files.push({
      relativePath: 'overview.md',
      content: createConceptDocument(
        {
          type: 'Overview',
          title: 'Repository Intelligence Overview',
          status: 'draft',
          reponix: { agent: 'reponix-orchestrator' },
        },
        readmeContent
      ),
    });
  }

  // 2. contracts.md -> contracts/*.md
  const contractsContent = readLegacy('contracts.md');
  if (contractsContent) {
    const sections = splitMarkdownSections(contractsContent, 1, 2);
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      let slug = slugify(sec.title);
      if (!slug) slug = `contract-${i + 1}`;

      const citedFiles = detectCitedFiles(sec.body);
      const sources = citedFiles.map((file, idx) => ({
        id: `src-${idx + 1}`,
        resource: file,
        title: `Source for ${path.basename(file)}`,
      }));

      files.push({
        relativePath: `contracts/${slug}.md`,
        content: createConceptDocument(
          {
            type: 'API Endpoint',
            title: sec.title,
            status: 'draft',
            sources: sources.length > 0 ? sources : undefined,
            reponix: { agent: 'code-inspector' },
          },
          `# ${sec.title}\n\n${sec.body}`
        ),
      });
    }
  }

  // 3. architecture.md -> architecture/*.md
  const archContent = readLegacy('architecture.md');
  if (archContent) {
    const sections = splitMarkdownSections(archContent, 1, 2);
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      let slug = slugify(sec.title);
      if (!slug) slug = `architecture-${i + 1}`;

      files.push({
        relativePath: `architecture/${slug}.md`,
        content: createConceptDocument(
          {
            type: 'Architecture',
            title: sec.title,
            status: 'draft',
            reponix: { agent: 'arch-mapper' },
          },
          `# ${sec.title}\n\n${sec.body}`
        ),
      });
    }
  }

  // 4. inventory.md -> inventory/*.md
  const invContent = readLegacy('inventory.md');
  if (invContent) {
    const sections = splitMarkdownSections(invContent, 1, 2);
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      let slug = slugify(sec.title);
      if (!slug) slug = `inventory-${i + 1}`;

      files.push({
        relativePath: `inventory/${slug}.md`,
        content: createConceptDocument(
          {
            type: 'Inventory',
            title: sec.title,
            status: 'draft',
            reponix: { agent: 'repo-analyst' },
          },
          `# ${sec.title}\n\n${sec.body}`
        ),
      });
    }
  }

  // 5. reconstruction-spec.md -> procedures/*.md
  const reconContent = readLegacy('reconstruction-spec.md');
  if (reconContent) {
    const sections = splitMarkdownSections(reconContent, 1, 2);
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      let slug = slugify(sec.title);
      if (!slug) slug = `procedure-${i + 1}`;

      files.push({
        relativePath: `procedures/${slug}.md`,
        content: createConceptDocument(
          {
            type: 'Procedure',
            title: sec.title,
            status: 'draft',
            reponix: { agent: 'modernizer' },
          },
          `# ${sec.title}\n\n${sec.body}`
        ),
      });
    }
  }

  // 6. validation-report.md -> initial log.md entry
  const valContent = readLegacy('validation-report.md');
  const dateStr = formatLogDate(new Date());
  let initialLog = `# Bundle Update Log\n\n## ${dateStr}\n* **Initialization**: Migrated legacy Reponix documentation into OKF v0.2 bundle.\n`;
  if (valContent) {
    initialLog += `* **Validation**: Initialized with legacy validation report summary.\n`;
  }
  files.push({
    relativePath: 'log.md',
    content: initialLog,
  });

  // If dry-run, return planned files without writing
  if (options?.dryRun) {
    return {
      files,
      dryRun: true,
      outputDir,
    };
  }

  // Write all files
  for (const f of files) {
    const dest = path.join(outputDir, f.relativePath);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.writeFileSync(dest, f.content, 'utf-8');
  }

  // Finalize bundle to stamp trust, build indices, and compile log
  const { summary } = await finalizeBundle({
    bundleDir: outputDir,
    repoRoot,
    strict: false,
  });

  return {
    files,
    dryRun: false,
    outputDir,
    finalizeSummary: summary,
  };
}
