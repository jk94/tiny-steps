/**
 * Loads `@react-pdf/renderer` through **Node's own** `require`, bypassing
 * Jest's module registry. Wired up by `moduleNameMapper` in package.json, so
 * it applies to the production modules under test as well as to their specs.
 *
 * Why this is necessary: `@react-pdf/renderer` 4.x and its whole `@react-pdf/*`
 * dependency chain are ESM-only, and one of them (`yoga-layout`, the layout
 * engine) ships a WebAssembly loader that uses `import.meta.url`. Node 22.12+
 * loads all of that from CommonJS without complaint — `require(esm)` — but
 * Jest resolves and executes modules in its own CommonJS registry, which has no
 * equivalent. Every alternative was worse:
 *
 *   - transforming the chain to CJS via `transformIgnorePatterns` dies on
 *     `import.meta`, which has no CommonJS translation;
 *   - `customExportConditions: ['import']` (globally or per file) flips every
 *     well-behaved dual package onto its ESM build, including ones Jest itself
 *     loads inside the environment, and breaks the rest of the suite;
 *   - mocking the renderer would leave the actual PDF output untested.
 *
 * `createRequire` returns a real Node `require` bound to this file, so the
 * import graph below this point is Node's, not Jest's. The module instance is
 * therefore shared by every consumer that goes through this mapper — which is
 * what lets a spec spy on `Font.register` and observe the renderer's own call.
 */
// `process.getBuiltinModule` (Node 22.3+) hands back the *real* `node:module`,
// not the one Jest injects into the sandbox — whose `createRequire` would
// return another Jest require and land us straight back in Jest's registry.
const { createRequire } = process.getBuiltinModule('node:module');

module.exports = createRequire(__filename)('@react-pdf/renderer');
