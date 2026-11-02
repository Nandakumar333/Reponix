import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { loadBundle } from './bundle.js';
import { validateBundle } from './validate.js';
import { generateAllIndices } from './index-gen.js';
import { finalizeBundle } from './finalize.js';
import { formatTextReport, formatJsonReport, formatSarifReport } from './report.js';
import { addHumanVerification } from './trust.js';
import { parseRawDocument, serializeConcept } from './parse.js';
import { appendRawLogEntries } from './log.js';
import { checkBundleStaleness, formatStaleReport } from './stale.js';
import { loadConfig } from '../engine/manifest.js';

import { generateUpdatePlan, formatUpdatePlanReport } from './plan.js';
import { migrateLegacyDocs } from './migrate.js';
import { packBundle, type PackFormat } from './pack.js';

export function okfCommand(): Command {
  const okf = new Command('okf').description('Manage Open Knowledge Format (OKF) v0.2 bundles');

  // okf validate
  okf
    .command('validate [dir]')
    .description('Validate an OKF v0.2 bundle against spec and Reponix profile')
    .option('--strict', 'Treat profile warnings as hard errors', false)
    .option('--format <type>', 'Output format: text, json, or sarif', 'text')
    .action(async (dir: string | undefined, opts: { strict?: boolean; format?: string }) => {
      const config = loadConfig();
      const targetDir = dir || config?.output?.okf?.root || 'reponix';
      const resolvedDir = path.resolve(targetDir);

      try {
        const bundle = loadBundle(resolvedDir);
        const issues = validateBundle(bundle, { strict: Boolean(opts.strict) });

        if (opts.format === 'json') {
          console.log(formatJsonReport(issues));
        } else if (opts.format === 'sarif') {
          console.log(formatSarifReport(issues));
        } else {
          console.log(formatTextReport(issues));
        }

        const hasErrors = issues.some(i => i.severity === 'error');
        if (hasErrors) {
          process.exit(1);
        }
      } catch (err: any) {
        console.error(pc.red(`\n  ✖ Error: ${err.message}\n`));
        process.exit(1);
      }
    });

  // okf index
  okf
    .command('index [dir]')
    .description('Generate or refresh index.md directory files throughout an OKF bundle')
    .action(async (dir: string | undefined) => {
      const config = loadConfig();
      const targetDir = dir || config?.output?.okf?.root || 'reponix';
      const resolvedDir = path.resolve(targetDir);

      try {
        const bundle = loadBundle(resolvedDir);
        const generated = generateAllIndices(bundle, true);
        console.log(pc.green(`\n  ✔ Successfully generated/updated ${generated.size} index.md file(s).\n`));
      } catch (err: any) {
        console.error(pc.red(`\n  ✖ Error: ${err.message}\n`));
        process.exit(1);
      }
    });

  // okf verify
  okf
    .command('verify <concept-id>')
    .description('Record human verification for an OKF concept document')
    .requiredOption('--by <actor>', 'Human actor identifier (MUST start with "human:")')
    .option('--dir <dir>', 'Bundle directory', undefined)
    .action(async (conceptId: string, opts: { by: string; dir?: string }) => {
      const config = loadConfig();
      const targetDir = opts.dir || config?.output?.okf?.root || 'reponix';
      const resolvedDir = path.resolve(targetDir);

      if (!opts.by.startsWith('human:')) {
        console.error(pc.red(`\n  ✖ Error: Actor identifier must begin with "human:", got "${opts.by}"\n`));
        process.exit(1);
      }

      try {
        const bundle = loadBundle(resolvedDir);
        const cleanId = String(conceptId).trim();
        let targetConcept = bundle.concepts.get(cleanId);
        if (!targetConcept && !cleanId.endsWith('.md')) {
          targetConcept = bundle.concepts.get(cleanId + '.md');
        }
        if (!targetConcept) {
          for (const c of bundle.concepts.values()) {
            if (
              c.id === cleanId ||
              c.id === cleanId.replace(/\.md$/, '') ||
              path.basename(c.bundleRelativePath, '.md') === cleanId ||
              c.bundleRelativePath === cleanId ||
              c.bundleRelativePath.endsWith(cleanId)
            ) {
              targetConcept = c;
              break;
            }
          }
        }

        if (!targetConcept) {
          console.error(pc.red(`\n  ✖ Error: Concept "${conceptId}" not found in bundle at ${targetDir}\n`));
          process.exit(1);
        }

        addHumanVerification(targetConcept, opts.by);

        // Serialize and save
        const parsedRaw = parseRawDocument(targetConcept.raw);
        const updatedContent = serializeConcept(
          targetConcept.frontmatter,
          targetConcept.body,
          parsedRaw.yamlDoc
        );

        fs.writeFileSync(targetConcept.filePath, updatedContent, 'utf-8');
        targetConcept.raw = updatedContent;

        // Append log entry
        const title = targetConcept.frontmatter.title || path.basename(targetConcept.bundleRelativePath, '.md');
        appendRawLogEntries(
          bundle,
          [`* **Verification**: Verified [${title}](/${targetConcept.bundleRelativePath}) by ${opts.by}.`],
          new Date(),
          true
        );

        console.log(
          pc.green(
            `\n  ✔ Successfully verified "${targetConcept.bundleRelativePath}" by ${opts.by}.\n`
          )
        );
      } catch (err: any) {
        console.error(pc.red(`\n  ✖ Error: ${err.message}\n`));
        process.exit(1);
      }
    });

  // okf stale
  okf
    .command('stale [dir]')
    .description('Check an OKF bundle for time-expired or git-diff stale concepts')
    .option('--format <type>', 'Output format: text or json', 'text')
    .action(async (dir: string | undefined, opts: { format?: 'text' | 'json' }) => {
      const config = loadConfig();
      const targetDir = dir || config?.output?.okf?.root || 'reponix';
      const resolvedDir = path.resolve(targetDir);

      try {
        const bundle = loadBundle(resolvedDir);
        const results = checkBundleStaleness(bundle);

        if (opts.format === 'json') {
          console.log(formatStaleReport(results, 'json'));
        } else {
          console.log(formatStaleReport(results, 'text'));
        }
      } catch (err: any) {
        console.error(pc.red(`\n  ✖ Error: ${err.message}\n`));
        process.exit(1);
      }
    });

  // okf plan-update
  okf
    .command('plan-update [dir]')
    .description('Compute incremental update plan comparing Git changes against OKF manifest')
    .option('--format <type>', 'Output format: text or json', 'text')
    .action(async (dir: string | undefined, opts: { format?: 'text' | 'json' }) => {
      const config = loadConfig();
      const targetDir = dir || config?.output?.okf?.root || 'reponix';
      const resolvedDir = path.resolve(targetDir);

      try {
        const bundle = loadBundle(resolvedDir);
        const plan = generateUpdatePlan(bundle);
        console.log(formatUpdatePlanReport(plan, opts.format));
      } catch (err: any) {
        console.error(pc.red(`\n  ✖ Error: ${err.message}\n`));
        process.exit(1);
      }
    });

  // okf migrate
  okf
    .command('migrate')
    .description('Convert existing monolithic Reponix documentation into an OKF v0.2 bundle')
    .option('--from <dir>', 'Source directory containing legacy docs (docs/ or reponix/)', undefined)
    .option('--to <dir>', 'Target bundle directory', undefined)
    .option('--dry-run', 'Preview migrated files without writing to disk', false)
    .action(async (opts: { from?: string; to?: string; dryRun?: boolean }) => {
      const config = loadConfig();
      const targetDir = opts.to || config?.output?.okf?.root || 'reponix';

      try {
        const result = await migrateLegacyDocs({
          inputDir: opts.from,
          outputDir: targetDir,
          dryRun: Boolean(opts.dryRun),
        });

        if (result.dryRun) {
          console.log(pc.bold(pc.yellow(`\n  🔎 Dry run: ${result.files.length} file(s) would be created in "${targetDir}":\n`)));
          for (const f of result.files) {
            console.log(`    • ${pc.cyan(f.relativePath)}`);
          }
          console.log('');
        } else {
          console.log(pc.bold(pc.green(`\n  ✔ Migration complete! Generated ${result.files.length} OKF file(s) in "${targetDir}".\n`)));
        }
      } catch (err: any) {
        console.error(pc.red(`\n  ✖ Migration failed: ${err.message}\n`));
        process.exit(1);
      }
    });

  // okf pack
  okf
    .command('pack [dir]')
    .description('Package the entire OKF bundle into a single artifact (markdown, json, or tar)')
    .option('--format <type>', 'Output format: markdown, json, or tar', 'markdown')
    .option('--out <file>', 'Output destination file path', undefined)
    .option('--compress', 'Compress tar archive with gzip (.tar.gz)', false)
    .action(async (
      dir: string | undefined,
      opts: { format: PackFormat; out?: string; compress?: boolean }
    ) => {
      const config = loadConfig();
      const targetDir = dir || config?.output?.okf?.root || 'reponix';
      const resolvedDir = path.resolve(targetDir);

      try {
        const bundle = loadBundle(resolvedDir);
        const { content, outFile } = packBundle(bundle, {
          format: opts.format,
          outFile: opts.out,
          compress: Boolean(opts.compress),
        });

        if (outFile) {
          console.log(pc.green(`\n  ✔ Successfully packed OKF bundle to "${outFile}".\n`));
        } else {
          if (typeof content === 'string') {
            console.log(content);
          } else {
            process.stdout.write(content);
          }
        }
      } catch (err: any) {
        console.error(pc.red(`\n  ✖ Pack failed: ${err.message}\n`));
        process.exit(1);
      }
    });

  // okf finalize
  okf
    .command('finalize [dir]')
    .description('Run cite -> links -> trust -> index -> log -> validate pipeline on an OKF bundle')
    .option('--strict', 'Treat profile warnings as hard errors', false)
    .option('--format <type>', 'Output format: text, json, or sarif', 'json')
    .option('--source-links <type>', 'Source links type: relative or permalink', undefined)
    .option('--record-git-authors', 'Record git authors for cited files', false)
    .action(async (
      dir: string | undefined,
      opts: {
        strict?: boolean;
        format?: string;
        sourceLinks?: 'relative' | 'permalink';
        recordGitAuthors?: boolean;
      }
    ) => {
      const config = loadConfig();
      const targetDir = dir || config?.output?.okf?.root || 'reponix';
      const resolvedDir = path.resolve(targetDir);

      const sourceLinks = opts.sourceLinks || config?.output?.okf?.sourceLinks || 'relative';
      const recordGitAuthors = Boolean(opts.recordGitAuthors || config?.output?.okf?.recordGitAuthors);

      try {
        const { bundle, summary } = await finalizeBundle({
          bundleDir: resolvedDir,
          strict: Boolean(opts.strict),
          staleAfterDays: config?.output?.okf?.staleAfterDays ?? 90,
          emitV01Timestamp: config?.output?.okf?.emitV01Timestamp ?? true,
          sourceLinks,
          recordGitAuthors,
        });

        if (opts.format === 'text') {
          console.log(formatTextReport(summary.issues));
          console.log(
            pc.bold(
              `\n  Finalize Summary: ${summary.validConcepts}/${summary.totalConcepts} concepts valid.\n`
            )
          );
        } else if (opts.format === 'sarif') {
          console.log(formatSarifReport(summary.issues));
        } else {
          // Default: json
          console.log(JSON.stringify(summary, null, 2));
        }

        if (!summary.success) {
          process.exit(1);
        }
      } catch (err: any) {
        console.error(pc.red(`\n  ✖ Finalize failed: ${err.message}\n`));
        process.exit(1);
      }
    });

  return okf;
}
