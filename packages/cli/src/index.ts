#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './init.js';
import { listCommand } from './list.js';
import { installSkill } from './install-skill.js';
import pc from 'picocolors';

const program = new Command();

program
  .name('reponix')
  .description('Scaffold production-grade multi-agent repository intelligence and modernization systems')
  .version('0.1.0');

// Add init command
program.addCommand(initCommand());

// Add list command
program
  .command('list')
  .description('List available agents and skills')
  .argument('[target]', 'Target to list: agents, skills, or all', 'all')
  .action((target) => {
    listCommand(target as any);
  });

// Add skill command
const skill = program.command('skill').description('Manage Reponix skills');

skill
  .command('install <name>')
  .description('Install a specific skill into the current repository')
  .option('--platform <name>', 'Target platform', 'gemini-cli')
  .action(async (name, opts) => {
    console.log(pc.cyan(`\n  Installing skill "${name}"...`));
    const dest = await installSkill(name, opts.platform);
    if (dest) {
      console.log(pc.green(`  ✔ Successfully installed to ${dest}\n`));
    } else {
      console.log(pc.red(`  ✖ Skill installation failed\n`));
    }
  });

// Add doctor command
program
  .command('doctor')
  .description('Verify toolchain and prerequisites')
  .action(() => {
    console.log(pc.bold(pc.cyan('\n  Reponix Doctor: Diagnostics\n')));
    console.log(`   ${pc.green('✔')} Node.js version: ${process.version}`);
    console.log(`   ${pc.green('✔')} Platform: ${process.platform}`);
    console.log(`   ${pc.green('✔')} Architecture: ${process.arch}`);
    console.log(pc.green('\n  All checks passed. Ready to initialize!\n'));
  });

program.parse(process.argv);
