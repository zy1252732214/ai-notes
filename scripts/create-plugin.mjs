import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2] ?? '';
const name = process.argv[3] ?? '';
const idPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

if (!idPattern.test(id) || id.length > 64 || name.trim().length === 0 || name.length > 80) {
  console.error('Usage: node scripts/create-plugin.mjs <id> <display name>');
  console.error('id: 1–64 chars, lowercase letters, digits, dots, and hyphens.');
  process.exit(1);
}
if (/["\\\n\r]/.test(name)) {
  console.error('Display name cannot contain quotes or newlines.');
  process.exit(1);
}

const dest = path.join(root, 'plugins', id);
if (fs.existsSync(dest)) {
  console.error(`plugins/${id} already exists.`);
  process.exit(1);
}

const packageName = `@ai-notes/plugin-${id.replaceAll('.', '-')}`;
const template = path.join(root, 'templates', 'plugin-starter');
const files = [
  'package.json',
  'tsconfig.json',
  'manifest.json',
  'README.md',
  'src/main.ts',
  'src/main.test.ts',
];

for (const relative of files) {
  const target = path.join(dest, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const text = fs
    .readFileSync(path.join(template, relative), 'utf8')
    .replaceAll('@ai-notes/plugin-starter', packageName)
    .replaceAll('plugin-starter', id)
    .replaceAll('Plugin Starter', name);
  fs.writeFileSync(target, text);
}

console.log(`Created plugins/${id} (${packageName}).`);
console.log('Next: pnpm install');
console.log(`      pnpm --filter ${packageName} test`);
console.log(`      pnpm --filter ${packageName} build`);
