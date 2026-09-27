import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { getTemplatesRoot, getSkillsRoot } from './engine/paths.js';
import { loadConfig } from './engine/manifest.js';

export function listCommand(target: 'agents' | 'skills' | 'all' = 'all'): void {
  const config = loadConfig();

  if (target === 'agents' || target === 'all') {
    console.log(pc.bold(pc.cyan('\n  Available Reponix Agents:')));
    const agentsDir = path.join(getTemplatesRoot(), 'generic', 'agents');
    if (fs.existsSync(agentsDir)) {
      const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md.hbs'));
      for (const file of files) {
        const name = file.replace('.md.hbs', '');
        const isInstalled = config?.agents.core.includes(name) || config?.agents.optional?.includes(name);
        const status = isInstalled ? pc.green(' [configured]') : '';
        console.log(`   • ${pc.bold(name)}${status}`);
      }
    }
  }

  if (target === 'skills' || target === 'all') {
    console.log(pc.bold(pc.cyan('\n  Available Reponix Skills:')));
    const skillsDir = getSkillsRoot();
    if (fs.existsSync(skillsDir)) {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const entry of entries) {
        const isInstalled = config?.skills.installed.includes(entry.name);
        const status = isInstalled ? pc.green(' [installed]') : '';
        console.log(`   • ${pc.bold(entry.name)}${status}`);
      }
    }
  }

  console.log();
}
