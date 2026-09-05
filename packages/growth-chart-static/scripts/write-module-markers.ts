/**
 * Marks the two `tsc` outputs with their module format.
 *
 * The package root has no `"type"` field, so Node would read every emitted
 * `.js` as CommonJS — including `dist/esm/`, whose `import`/`export` statements
 * would then fail to parse. A nested `package.json` per output directory is the
 * standard way to scope the format without renaming files to `.mjs`/`.cjs`
 * (which `tsc` cannot do from `.ts`/`.tsx` sources).
 *
 * Run as the last step of `bun run build` in this package.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const markers: Record<string, string> = {
  'dist/esm/package.json': '{ "type": "module" }',
  'dist/cjs/package.json': '{ "type": "commonjs" }',
};

for (const [relativePath, contents] of Object.entries(markers)) {
  writeFileSync(resolve(packageRoot, relativePath), `${contents}\n`);
}
