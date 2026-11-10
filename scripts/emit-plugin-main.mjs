import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Turn a plugin's src/main.ts into dist/main.js for the sandbox iframe.
 * The host loads that file as a classic script and only rewrites
 * `import { definePlugin } from '@ai-notes/plugin-sdk'` plus `export default`.
 */
const dir = process.cwd();
const sourcePath = path.join(dir, 'src', 'main.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    removeComments: true,
  },
  fileName: 'main.ts',
}).outputText;

let output = transpiled.replace(/^\uFEFF/, '').trim() + '\n';
output = output.replace(/^export (?!default\b)/gm, '');

const importLines = [...output.matchAll(/^import .+$/gm)].map((match) => match[0]);
const allowed = /^import \{ definePlugin \} from ['"]@ai-notes\/plugin-sdk['"];?$/;
if (importLines.length !== 1 || !importLines.every((line) => allowed.test(line))) {
  throw new Error(
    `Sandbox entry must import only definePlugin from @ai-notes/plugin-sdk.\n${importLines.join('\n')}`,
  );
}
if (!/^export default /m.test(output)) {
  throw new Error('Sandbox entry must use `export default`.');
}
if (/^export \{/m.test(output) || /^export \*/m.test(output)) {
  throw new Error('Sandbox entry must not re-export bindings.');
}

const outFile = path.join(dir, 'dist', 'main.js');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, output);
console.log(`wrote ${path.relative(dir, outFile)}`);
