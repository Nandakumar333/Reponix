import fs from 'node:fs';
import path from 'node:path';
import type { ReponixConfig, InitAnswers } from '../types.js';

export const CONFIG_FILENAME = 'reponix.config.json';

export function createConfigFromAnswers(answers: InitAnswers): ReponixConfig {
  return {
    $schema: 'https://reponix.dev/schema/v1.json',
    platform: answers.platform,
    scope: answers.scope,
    suite: answers.suite,
    model: answers.model || 'gemini-3.8-flash',
    project: {
      name: answers.projectName,
      description: answers.projectDescription,
      language: answers.techStack,
      targetLanguage: answers.targetStack,
    },
    agents: {
      core: answers.coreAgents,
      optional: answers.optionalAgents.length > 0 ? answers.optionalAgents : undefined,
    },
    skills: {
      installed: answers.installedSkills,
    },
  };
}

export function saveConfig(
  answers: InitAnswers,
  targetDir: string = process.cwd(),
  dryRun: boolean = false
): string {
  const config = createConfigFromAnswers(answers);
  const filePath = path.join(targetDir, CONFIG_FILENAME);

  if (!dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  return filePath;
}

export function loadConfig(dir: string = process.cwd()): ReponixConfig | null {
  const filePath = path.join(dir, CONFIG_FILENAME);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ReponixConfig;
  } catch {
    return null;
  }
}
