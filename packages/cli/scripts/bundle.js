import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_ROOT = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(CLI_ROOT, '../..');
const DIST = path.join(CLI_ROOT, 'dist');

async function bundle() {
  console.log('📦 Copying templates and skills to dist/...');

  const srcTemplates = path.join(MONOREPO_ROOT, 'templates');
  const distTemplates = path.join(DIST, 'templates');
  if (fs.existsSync(srcTemplates)) {
    fs.mkdirSync(distTemplates, { recursive: true });
    fs.cpSync(srcTemplates, distTemplates, { recursive: true });
    console.log('   ✔ templates/ copied');
  }

  const srcSkills = path.join(MONOREPO_ROOT, 'skills');
  const distSkills = path.join(DIST, 'skills');
  if (fs.existsSync(srcSkills)) {
    fs.mkdirSync(distSkills, { recursive: true });
    fs.cpSync(srcSkills, distSkills, { recursive: true });
    console.log('   ✔ skills/ copied');
  }

  // Copy README.md and LICENSE to package root for npm distribution
  for (const docFile of ['README.md', 'LICENSE']) {
    const src = path.join(MONOREPO_ROOT, docFile);
    const dest = path.join(CLI_ROOT, docFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`   ✔ ${docFile} copied`);
    }
  }

  console.log('✅ Packaging complete.');
}

bundle().catch((err) => {
  console.error(err);
  process.exit(1);
});
