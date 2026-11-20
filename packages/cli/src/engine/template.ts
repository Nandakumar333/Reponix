import Handlebars from 'handlebars';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import type { InitAnswers, Platform, RenderOptions } from '../types.js';
import { getPlatformPaths } from '../platforms/index.js';
import { getTemplatesRoot } from './paths.js';

// Register Handlebars helpers
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('neq', (a, b) => a !== b);
Handlebars.registerHelper('or', (...args) => {
  args.pop();
  return args.some(Boolean);
});
Handlebars.registerHelper('and', (...args) => {
  args.pop();
  return args.every(Boolean);
});
Handlebars.registerHelper('includes', (arr: unknown, value: unknown) => {
  return Array.isArray(arr) && arr.includes(value);
});

export function registerPartials(): void {
  const partialsDir = path.join(getTemplatesRoot(), 'generic', 'partials');
  if (fs.existsSync(partialsDir)) {
    const files = fs.readdirSync(partialsDir).filter(f => f.endsWith('.hbs'));
    for (const file of files) {
      const name = path.basename(file, '.md.hbs').replace(/\.hbs$/, '');
      const content = fs.readFileSync(path.join(partialsDir, file), 'utf-8');
      Handlebars.registerPartial(name, content);
      Handlebars.registerPartial(path.basename(file, '.hbs'), content);
    }
  }
}

// Auto-register available partials
registerPartials();

export function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  try {
    const frontmatter = YAML.parse(match[1]) || {};
    return { frontmatter, body: match[2].trim() };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

export function getPrimaryAgent(allAgents: string[]): string {
  if (allAgents.includes('reponix-orchestrator')) return 'reponix-orchestrator';
  if (allAgents.includes('orchestrator')) return 'orchestrator';
  return allAgents[0] || 'reponix-orchestrator';
}

export function isAgentPrimary(agentName: string, allAgents: string[]): boolean {
  return agentName === getPrimaryAgent(allAgents);
}

export function transformForPlatform(
  content: string,
  agentName: string,
  platform: Platform,
  allAgents: string[] = []
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const description = frontmatter.description || `${agentName} agent for Reponix`;
  const isPrimary = isAgentPrimary(agentName, allAgents);

  switch (platform) {
    case 'gemini-cli':
    case 'claude-code':
      return `<!-- Agent: ${agentName} | ${description} -->\n\n${body}`;

    case 'cursor':
      return `---
description: ${description}
globs: *
alwaysApply: ${isPrimary ? 'true' : 'false'}
---

${body}`;

    case 'opencode': {
      const mode = isPrimary ? 'primary' : 'subagent';
      const modelLine = frontmatter.model ? `\nmodel: ${frontmatter.model}` : '';
      return `---
description: ${description}
mode: ${mode}${modelLine}
---

${body}`;
    }

    case 'windsurf': {
      const trigger = isPrimary ? 'always_on' : 'model_decision';
      return `---
trigger: ${trigger}
description: ${description}
---

${body}`;
    }

    case 'continue':
    case 'copilot':
    case 'copilot-cli':
      return `---
name: ${agentName}
description: ${description}
---

${body}`;

    default:
      return content;
  }
}

export function generateRootInstruction(
  allAgents: string[],
  platform: Platform,
  context: { projectName: string; techStack?: string; targetStack?: string }
): string {
  const { projectName, techStack, targetStack } = context;
  const primaryAgent = getPrimaryAgent(allAgents);

  switch (platform) {
    case 'gemini-cli': {
      const imports = allAgents.map(a => `@.gemini/agents/${a}.md`).join('\n');
      return `# Reponix — Repository Intelligence & Modernization System

## Project Context
- **Project:** ${projectName}
${techStack ? `- **Source Stack:** ${techStack}\n` : ''}${targetStack ? `- **Target Stack:** ${targetStack}\n` : ''}
## Multi-Agent Architecture
${imports}

Start by invoking the **${primaryAgent}** agent when beginning repository analysis or modernization.
`;
    }

    case 'claude-code': {
      const list = allAgents.map(a => `- **${a}**: See \`.claude/agents/${a}.md\` (${(a === primaryAgent) ? 'primary' : 'subagent'})`).join('\n');
      return `# Reponix — Claude Code Instructions

Project: **${projectName}**
${techStack ? `Source Tech Stack: ${techStack}\n` : ''}
## Active Reponix Agents
${list}

Always address the **${primaryAgent}** agent to coordinate repository discovery and reconstruction blueprints.
`;
    }

    case 'opencode': {
      const list = allAgents.map(a => `- **${a}**: \`.opencode/agents/${a}.md\` (${(a === primaryAgent) ? 'primary' : 'subagent'})`).join('\n');
      return `# Reponix — OpenCode Agent Instructions

Project: **${projectName}**
${techStack ? `- **Source Stack:** ${techStack}\n` : ''}${targetStack ? `- **Target Stack:** ${targetStack}\n` : ''}
## Configured Agents
${list}

The **${primaryAgent}** is the **primary agent** that interacts with the user and coordinates the archaeology and modernization workflow.
All other agents operate as specialized subagents under the orchestrator's direction.
`;
    }

    case 'cursor': {
      const list = allAgents.map(a => `- **${a}**: \`.cursor/rules/${a}.mdc\` (${(a === primaryAgent) ? 'primary (alwaysApply: true)' : 'subagent (alwaysApply: false)'})`).join('\n');
      return `# Reponix — Cursor Agent Rules

Project: **${projectName}**
${techStack ? `- **Source Stack:** ${techStack}\n` : ''}${targetStack ? `- **Target Stack:** ${targetStack}\n` : ''}
## Configured Agents
${list}

The **${primaryAgent}** rule is configured as the **primary agent** (\`alwaysApply: true\`) to coordinate repository discovery and modernization.
All other rules operate as specialized subagents (\`alwaysApply: false\`) invoked when needed.
`;
    }

    case 'windsurf': {
      const list = allAgents.map(a => `- **${a}**: \`.windsurf/rules/${a}.md\` (${(a === primaryAgent) ? 'primary (always_on)' : 'subagent (model_decision)'})`).join('\n');
      return `# Reponix — Windsurf Rules Instructions

Project: **${projectName}**
${techStack ? `- **Source Stack:** ${techStack}\n` : ''}${targetStack ? `- **Target Stack:** ${targetStack}\n` : ''}
## Configured Rules
${list}

The **${primaryAgent}** is configured as the **primary agent** (\`trigger: always_on\`) to coordinate repository discovery and modernization.
All other rules are configured with \`trigger: model_decision\` to be activated contextually.
`;
    }

    case 'continue': {
      const list = allAgents.map(a => `- **${a}**: \`.continue/prompts/${a}.md\` (${(a === primaryAgent) ? 'primary' : 'subagent'})`).join('\n');
      return `# Reponix — Continue Instructions

Project: **${projectName}**
${techStack ? `- **Source Stack:** ${techStack}\n` : ''}${targetStack ? `- **Target Stack:** ${targetStack}\n` : ''}
## Configured Prompts
${list}

Use the **${primaryAgent}** as the primary entry point for repository discovery and modernization.
`;
    }

    case 'copilot':
    case 'copilot-cli': {
      const list = allAgents.map(a => `- **${a}**: (${(a === primaryAgent) ? 'primary' : 'subagent'})`).join('\n');
      return `# Reponix — GitHub Copilot Agent Instructions

Project: **${projectName}**
${techStack ? `- **Source Stack:** ${techStack}\n` : ''}${targetStack ? `- **Target Stack:** ${targetStack}\n` : ''}
## Configured Agents
${list}

The **${primaryAgent}** is the primary agent to coordinate repository discovery and modernization.
All other agents operate as specialized subagents under the orchestrator's direction.
`;
    }

    default: {
      const list = allAgents.map(a => `- **${a}**`).join('\n');
      return `# Reponix Agent Instructions

Project: **${projectName}**

## Configured Agents
${list}

Use the **${primaryAgent}** as the entry point for all workflows.
`;
    }
  }
}

export async function renderAgents(
  answers: InitAnswers,
  options?: RenderOptions
): Promise<string[]> {
  const dryRun = options?.dryRun ?? false;
  const platformPaths = getPlatformPaths(answers.platform, answers.scope, options?.targetDir);
  const { agentsDir, extension, mergedFile, rootInstructionFile } = platformPaths;

  if (!dryRun) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  const allAgents = [...answers.coreAgents, ...answers.optionalAgents];
  const primaryAgent = getPrimaryAgent(allAgents);
  const written: string[] = [];
  const agentDescriptions: Record<string, string> = {};

  registerPartials();

  const context = {
    projectName: answers.projectName,
    projectDescription: answers.projectDescription,
    techStack: answers.techStack.join(', '),
    targetStack: answers.targetStack?.join(', '),
    model: answers.model || 'gemini-3.8-flash',
    output: answers.output || { format: 'okf' },
  };

  const templatesDir = path.join(getTemplatesRoot(), 'generic', 'agents');

  if (mergedFile) {
    // Single merged AGENTS.md file
    let combined = `# Reponix Agent Suite for ${answers.projectName}\n\n`;
    combined += `Primary agent: **${primaryAgent}**.\n\n`;
    for (const agentName of allAgents) {
      const tplPath = path.join(templatesDir, `${agentName}.md.hbs`);
      if (!fs.existsSync(tplPath)) continue;
      const raw = fs.readFileSync(tplPath, 'utf-8');
      const compiled = Handlebars.compile(raw);
      const rendered = compiled(context);
      const { body } = parseFrontmatter(rendered);
      combined += `\n\n---\n\n# Agent: ${agentName}\n\n${body}\n`;
    }
    const outFile = path.join(agentsDir, platformPaths.configFile || 'AGENTS.md');
    if (!dryRun) {
      fs.writeFileSync(outFile, combined, 'utf-8');
    }
    written.push(outFile);
  } else {
    for (const agentName of allAgents) {
      const tplPath = path.join(templatesDir, `${agentName}.md.hbs`);
      if (!fs.existsSync(tplPath)) {
        console.warn(`  Warning: Template not found for agent "${agentName}" at ${tplPath}`);
        continue;
      }
      const raw = fs.readFileSync(tplPath, 'utf-8');
      const compiled = Handlebars.compile(raw);
      let rendered = compiled(context);
      const parsed = parseFrontmatter(rendered);
      agentDescriptions[agentName] = parsed.frontmatter.description || `${agentName} agent for Reponix`;
      rendered = transformForPlatform(rendered, agentName, answers.platform, allAgents);

      const outFile = path.join(agentsDir, `${agentName}${extension}`);
      if (!dryRun) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, rendered, 'utf-8');
      }
      written.push(outFile);
    }

    if (rootInstructionFile) {
      const rootContent = generateRootInstruction(allAgents, answers.platform, context);
      if (!dryRun) {
        fs.mkdirSync(path.dirname(rootInstructionFile), { recursive: true });
        fs.writeFileSync(rootInstructionFile, rootContent, 'utf-8');
      }
      written.push(rootInstructionFile);
    }

    if (answers.platform === 'opencode') {
      const baseDir = options?.targetDir || (answers.scope === 'global' ? os.homedir() : process.cwd());
      const configFile = platformPaths.configFile || (
        answers.scope === 'global'
          ? path.join(baseDir, '.config', 'opencode', 'opencode.json')
          : path.join(baseDir, 'opencode.json')
      );

      let config: Record<string, any> = {};
      if (fs.existsSync(configFile)) {
        try {
          config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        } catch {
          config = {};
        }
      }

      config.$schema = config.$schema || 'https://opencode.ai/config.json';
      config.default_agent = primaryAgent;
      config.agent = config.agent || {};

      for (const agentName of allAgents) {
        const isPrimary = isAgentPrimary(agentName, allAgents);
        const desc = agentDescriptions[agentName] || `${agentName} agent for Reponix`;
        config.agent[agentName] = {
          ...(config.agent[agentName] || {}),
          mode: isPrimary ? 'primary' : 'subagent',
          description: desc,
        };
      }

      if (!dryRun) {
        fs.mkdirSync(path.dirname(configFile), { recursive: true });
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      }
      written.push(configFile);
    }
  }

  return written;
}
