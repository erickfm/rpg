// Does every DOOR that a module declares actually ARRIVE?
//
// `ct/doors.ts` collects declarations from an eager glob of every ct module.
// A module in an import cycle with it resolves to an UNDEFINED namespace at
// collection time, so its `export const DOOR` is skipped. That used to happen
// silently; BLOCKED-C §0.2 asked for a warning and it landed, but a warning in
// the browser console is not something anyone reads on the way past.
//
// So count both ends. The source says how many modules declare a door; the
// running world says how many were collected. They must match, and when they
// do not this names the missing building rather than the missing count —
// "GOLDEN ACES is not in declaredDoors()" is actionable, "7 of 8" is not.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/doors-declared.mjs
//        --selftest   pretend a declaration is missing, require this to fail
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const DIR = 'src/proto/ct';

// ── the source end ────────────────────────────────────────────────────────
const declaring = [];
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.ts')) continue;
  const src = readFileSync(`${DIR}/${f}`, 'utf8');
  if (!/^export const DOOR\b/m.test(src)) continue;
  const m = src.match(/building:\s*'([^']+)'/);
  declaring.push({ file: f, building: m ? m[1] : '(unnamed)' });
}

// ── the running end ───────────────────────────────────────────────────────
const b = await chromium.launch();
const p = await b.newPage();
const warns = [];
p.on('console', (m) => { if (/\[doors\]/.test(m.text())) warns.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);
let arrived = await p.evaluate(() => (window.__ct.doors ? window.__ct.doors().map((d) => d.building) : null));
await b.close();

if (arrived === null) {
  console.error('__ct.doors() is not exposed — cannot check the running end.');
  process.exit(1);
}
if (SELFTEST) {
  const drop = arrived[0];
  arrived = arrived.slice(1);
  console.log(`selftest: pretending ${drop} never arrived — this MUST now go red`);
}

console.log(`${declaring.length} modules declare a DOOR; ${arrived.length} reached declaredDoors()`);
const missing = declaring.filter((d) => !arrived.includes(d.building));
for (const w of warns) console.log(`  ${w.replace(/\s+/g, ' ').slice(0, 110)}…`);

if (missing.length) {
  console.error(`\nDECLARED BUT NEVER COLLECTED:`);
  for (const m of missing) console.error(`  ${m.building.padEnd(16)} ${DIR}/${m.file}`);
  console.error(`\nThe facade painter, the [E] census and anything else driven by`);
  console.error(`declaredDoors() does not know these buildings have a door.`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the dropped declaration was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — a declaration was removed and this did not notice.'); process.exit(2); }
console.log('every declared door arrived.');
