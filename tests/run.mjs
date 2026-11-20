import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tests } from './harness.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort()) {
  await import(pathToFileURL(join(dir, f)).href);
}
let failed = 0;
for (const { name, fn } of tests) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
