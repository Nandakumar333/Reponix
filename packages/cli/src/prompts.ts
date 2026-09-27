import * as p from '@clack/prompts';
import pc from 'picocolors';
import path from 'node:path';
import type { Platform, Scope, Suite, InitAnswers } from './types.js';

export async function promptInit(defaults?: Partial<InitAnswers>): Promise<InitAnswers> {
  p.intro(pc.bgCyan(pc.black(' Reponix — Repository Intelligence & Modernization ')));

  const scope = defaults?.scope || (await p.select({
    message: 'Where do you want to install Reponix?',
    options: [
      { value: 'project', label: 'Current Repository', hint: 'recommended' },
      { value: 'global', label: 'User Home Directory', hint: 'global config' },
    ],
  })) as Scope;

  if (p.isCancel(scope)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const platform = defaults?.platform || (await p.select({
    message: 'Which AI platform are you targeting?',
    options: [
      { value: 'gemini-cli', label: 'Gemini CLI', hint: '.gemini/agents + GEMINI.md' },
      { value: 'claude-code', label: 'Claude Code', hint: '.claude/agents + CLAUDE.md' },
      { value: 'cursor', label: 'Cursor', hint: '.cursor/rules/*.mdc' },
      { value: 'opencode', label: 'OpenCode', hint: '.opencode/agents' },
      { value: 'copilot', label: 'GitHub Copilot', hint: '.github/instructions' },
      { value: 'copilot-cli', label: 'GitHub Copilot CLI', hint: '.github/agents' },
      { value: 'codex', label: 'OpenAI Codex', hint: 'AGENTS.md' },
      { value: 'continue', label: 'Continue', hint: '.continue/prompts' },
      { value: 'windsurf', label: 'Windsurf', hint: '.windsurf/rules' },
    ],
  })) as Platform;

  if (p.isCancel(platform)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const suite = defaults?.suite || (await p.select({
    message: 'Select an Agent Suite:',
    options: [
      {
        value: 'modernization',
        label: 'Modernization Suite (Recommended)',
        hint: 'Reponix-Orchestrator + Intelligence Agents + Modernizer',
      },
      {
        value: 'intelligence',
        label: 'Intelligence Suite',
        hint: 'Repo Analyst + Arch Mapper + Code Inspector + Validator',
      },
      {
        value: 'full',
        label: 'Full Suite',
        hint: 'All agents and skills included',
      },
    ],
  })) as Suite;

  if (p.isCancel(suite)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const defaultProjectName = path.basename(process.cwd());
  const projectName = defaults?.projectName || (await p.text({
    message: 'Project name:',
    defaultValue: defaultProjectName,
    placeholder: defaultProjectName,
  })) as string;

  if (p.isCancel(projectName)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  let coreAgents: string[] = [];
  let optionalAgents: string[] = [];

  if (suite === 'intelligence') {
    coreAgents = ['repo-analyst', 'arch-mapper', 'code-inspector', 'validator'];
  } else if (suite === 'modernization') {
    coreAgents = [
      'reponix-orchestrator',
      'repo-analyst',
      'arch-mapper',
      'code-inspector',
      'modernizer',
      'validator',
    ];
  } else {
    coreAgents = [
      'reponix-orchestrator',
      'repo-analyst',
      'arch-mapper',
      'code-inspector',
      'modernizer',
      'validator',
    ];
  }

  const installedSkills = ['graphify', 'arch-review', 'modernization'];

  return {
    platform,
    scope,
    suite,
    projectName: projectName || defaultProjectName,
    techStack: defaults?.techStack || ['auto-detect'],
    targetStack: defaults?.targetStack,
    model: defaults?.model || 'gemini-3.8-flash',
    coreAgents,
    optionalAgents,
    installedSkills,
  };
}
