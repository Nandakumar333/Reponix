import { Command } from 'commander';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import path from 'node:path';
import { promptInit } from './prompts.js';
import { renderAgents } from './engine/template.js';
import { installSkill } from './install-skill.js';
import { saveConfig } from './engine/manifest.js';
import type { Platform, Scope, Suite, InitAnswers } from './types.js';

export function initCommand(): Command {
  const cmd = new Command('init');

  cmd
    .description('Scaffold Reponix repository intelligence and modernization agents')
    .option('-y, --yes', 'Skip prompts and accept defaults')
    .option('--platform <name>', 'Target AI platform (gemini-cli|claude-code|cursor|opencode|copilot|codex|continue|windsurf)')
    .option('--scope <scope>', 'Installation scope: project or global')
    .option('--project', 'Install into current project repository')
    .option('--global', 'Install into user home directory')
    .option('--suite <type>', 'Suite: intelligence, modernization, or full')
    .option('--dry-run', 'Preview changes without writing files to disk')
    .option('--target-dir <path>', 'Custom directory to initialize')
    .action(async (opts) => {
      const targetDir = opts.targetDir ? path.resolve(opts.targetDir) : process.cwd();
      const dryRun = Boolean(opts.dryRun);

      console.log(pc.bold(pc.cyan('\n  ╔══════════════════════════════════════════╗')));
      console.log(pc.bold(pc.cyan('  ║          Reponix Agent Scaffolder        ║')));
      console.log(pc.bold(pc.cyan('  ╚══════════════════════════════════════════╝\n')));

      if (dryRun) {
        console.log(pc.yellow('  [DRY RUN] No files will be written to disk.\n'));
      }

      let scope: Scope = 'project';
      if (opts.global) scope = 'global';
      else if (opts.project) scope = 'project';
      else if (opts.scope === 'global' || opts.scope === 'project') scope = opts.scope;

      const platform = opts.platform as Platform | undefined;
      const suite = opts.suite as Suite | undefined;

      let answers: InitAnswers;

      if (opts.yes) {
        // Non-interactive defaults
        const resolvedPlatform: Platform = platform || 'gemini-cli';
        const resolvedSuite: Suite = suite || 'modernization';
        const coreAgents = [
          'reponix-orchestrator',
          'repo-analyst',
          'arch-mapper',
          'code-inspector',
          'modernizer',
          'validator',
        ];

        answers = {
          platform: resolvedPlatform,
          scope,
          suite: resolvedSuite,
          projectName: path.basename(targetDir),
          techStack: ['auto-detect'],
          model: 'gemini-3.8-flash',
          coreAgents,
          optionalAgents: [],
          installedSkills: ['graphify', 'arch-review', 'modernization'],
        };
      } else {
        answers = await promptInit({
          platform,
          scope,
          suite,
          projectName: path.basename(targetDir),
        });
      }

      const s = p.spinner();
      s.start('Rendering agent configurations and platform files...');

      try {
        const writtenAgents = await renderAgents(answers, { dryRun, targetDir });

        for (const skill of answers.installedSkills) {
          await installSkill(skill, answers.platform, answers.scope, { dryRun, targetDir });
        }

        const configFile = saveConfig(answers, targetDir, dryRun);

        s.stop(pc.green('Setup completed successfully!'));

        console.log(pc.bold('\n  Written Files:'));
        for (const file of writtenAgents) {
          console.log(`   ${pc.green('✔')} ${file}`);
        }
        console.log(`   ${pc.green('✔')} ${configFile}\n`);

        console.log(pc.bold(pc.cyan('  Next Steps:')));
        console.log(`   1. Open your AI coding harness (${pc.bold(answers.platform)}).`);
        console.log(`   2. Invoke the ${pc.bold('reponix-orchestrator')} agent to begin discovery:`);
        console.log(pc.gray('      "Analyze this repository and generate system architecture."\n'));
      } catch (err: any) {
        s.stop(pc.red('Initialization failed.'));
        console.error(pc.red(`\n  Error: ${err.message}\n`));
        process.exit(1);
      }
    });

  return cmd;
}
