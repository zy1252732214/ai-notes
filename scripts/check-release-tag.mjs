import { readFileSync } from 'node:fs';

const tag = process.argv[2] ?? '';
const configPath = new URL('../apps/desktop/src-tauri/tauri.conf.json', import.meta.url);
const version = JSON.parse(readFileSync(configPath, 'utf8')).version;

const matches = tag === `v${version}` || tag.startsWith(`v${version}-`);
if (!matches) {
  console.error(
    `::error::Tag ${tag || '(empty)'} does not match apps/desktop/src-tauri/tauri.conf.json version ${version}. Bump that version first, then push v${version}.`,
  );
  process.exit(1);
}

console.log(`tag ${tag} matches app version ${version}`);
