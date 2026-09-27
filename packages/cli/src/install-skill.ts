import fs from 'node:fs';
import path from 'node:path';
import { getSkillsRoot } from './engine/paths.js';
import { loadConfig, saveConfig } from './engine/manifest.js';
import type { Platform, Scope } from './types.js';

export function getSkillDestinationDir(platform: Platform, scope: Scope, baseDir: string = process.cwd()): string {
  switch (platform) {
    case 'gemini-cli':
      return path.join(baseDir, '.gemini', 'skills');
    case 'claude-code':
      return path.join(baseDir, '.claude', 'skills');
    case 'opencode':
      return path.join(baseDir, '.opencode', 'skills');
    default:
      return path.join(baseDir, '.agents', 'skills');
  }
}

export async function installSkill(
  skillName: string,
  platform: Platform = 'gemini-cli',
  scope: Scope = 'project',
  options?: { dryRun?: boolean; targetDir?: string }
): Promise<string | null> {
  const skillsRoot = getSkillsRoot();
  const sourceDir = path.join(skillsRoot, skillName);

  if (!fs.existsSync(sourceDir)) {
    console.warn(`  Warning: Skill "${skillName}" not found at ${sourceDir}`);
    return null;
  }

  const baseDir = options?.targetDir || process.cwd();
  const destParent = getSkillDestinationDir(platform, scope, baseDir);
  const destDir = path.join(destParent, skillName);

  if (!options?.dryRun) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(sourceDir, destDir, { recursive: true });

    // Update config if present
    const config = loadConfig(baseDir);
    if (config) {
      if (!config.skills) config.skills = { installed: [] };
      if (!config.skills.installed.includes(skillName)) {
        config.skills.installed.push(skillName);
        fs.writeFileSync(path.join(baseDir, 'reponix.config.json'), JSON.stringify(config, null, 2) + '\n');
      }
    }
  }

  return destDir;
}
