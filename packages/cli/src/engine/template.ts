import Handlebars from 'handlebars';
import fs from 'node:fs';
import path from 'node:path';
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
Handlebars.registerHelper('includes', (arr: unknown, value: unknown) => {
  return Array.isArray(arr) && arr.includes(value);
});

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

function transformForPlatform(
  content: string,
  agentName: string,
  platform: Platform
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const description = frontmatter.description || `${agentName} agent for Reponix`;

  switch (platform) {
    case 'gemini-cli':
    case 'claude-code':
      return `<!-- Agent: ${agentName} | ${description} -->\n\n${body}`;

    case 'cursor':
      return `---
description: ${description}
globs: *
alwaysApply: false
---

${body}`;

    case 'opencode': {
      const mode = frontmatter.mode || (agentName === 'reponix-orchestrator' || agentName === 'orchestrator' ? 'primary' : 'subagent');
      const modelLine = frontmatter.model ? `\nmodel: ${frontmatter.model}` : '';
      return `---
description: ${description}
mode: ${mode}${modelLine}
---

${body}`;
    }

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

  switch (platform) {
    case 'gemini-cli': {
      const imports = allAgents.map(a => `@.gemini/agents/${a}.md`).join('\n');
      return `# Reponix — Repository Intelligence & Modernization System

## Project Context
- **Project:** ${projectName}
${techStack ? `- **Source Stack:** ${techStack}\n` : ''}${targetStack ? `- **Target Stack:** ${targetStack}\n` : ''}

## Multi-Agent Architecture
${imports}

Start by invoking the **reponix-orchestrator** agent when beginning repository analysis or modernization.
`;
    }

    case 'claude-code': {
      const list = allAgents.map(a => `- **${a}**: See \`.claude/agents/${a}.md\``).join('\n');
      return `# Reponix — Claude Code Instructions

Project: **${projectName}**
${techStack ? `Source Tech Stack: ${techStack}\n` : ''}

## Active Reponix Agents
${list}

Always address the **reponix-orchestrator** agent to coordinate repository discovery and reconstruction blueprints.
`;
    }

    case 'opencode': {
      const list = allAgents.map(a => `- **${a}**: \`.opencode/agents/${a}.md\` (${(a === 'reponix-orchestrator' || a === 'orchestrator') ? 'primary' : 'subagent'})`).join('\n');
      return `# Reponix — OpenCode Agent Instructions

Project: **${projectName}**
${techStack ? `- **Source Stack:** ${techStack}\n` : ''}${targetStack ? `- **Target Stack:** ${targetStack}\n` : ''}
## Configured Agents
${list}

The **reponix-orchestrator** is the **primary agent** that interacts with the user and coordinates the archaeology and modernization workflow.
All other agents operate as specialized subagents under the orchestrator's direction.
`;
    }

    default: {
      const list = allAgents.map(a => `- **${a}**`).join('\n');
      return `# Reponix Agent Instructions

Project: **${projectName}**

## Configured Agents
${list}

Use the **reponix-orchestrator** as the entry point for all workflows.
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
  const written: string[] = [];

  const context = {
    projectName: answers.projectName,
    projectDescription: answers.projectDescription,
    techStack: answers.techStack.join(', '),
    targetStack: answers.targetStack?.join(', '),
    model: answers.model || 'gemini-3.8-flash',
  };

  const templatesDir = path.join(getTemplatesRoot(), 'generic', 'agents');

  if (mergedFile) {
    // Single merged AGENTS.md file
    let combined = `# Reponix Agent Suite for ${answers.projectName}\n\n`;
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
      rendered = transformForPlatform(rendered, agentName, answers.platform);

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
  }

  return written;
}
