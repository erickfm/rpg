// Does every interior that EXISTS actually get built?
//
// Four rooms have now been finished, committed and left unreachable — the
// casino, the hotel, the tax office and the pawn shop. Each was a complete
// room, and each was invisible to every player because a one-line
// construction call was missing from an entry point its author did not own.
// The auditor reported it three rounds running and it survived all three.
//
// A silent failure that has recurred four times does not need more care, it
// needs a test. This is the test. It compares what is ON DISK against what the
// running world actually registered, so it fails for a room nobody wired, a
// room whose builder threw on the way up, and a room whose id does not match
// its filename — all three of which produce the same symptom: you cannot get
// in, and nothing says why.
//
// It also checks the WIDER contract: any ct/*.ts that exports a build…()
// function but no register() is a module the world loader cannot see, which
// is the exact shape of all five failures. That is a migration nag, not a
// hard failure — plenty of leaf modules export builders that are called by
// their owner rather than by the loader — so it reports and does not exit 1.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/world-wired.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'src/proto/ct';
const files = readdirSync(DIR).filter((f) => /^int-.+\.ts$/.test(f)).sort();
if (!files.length) { console.error('no ct/int-*.ts files at all — wrong directory?'); process.exit(2); }

// --selftest: claim a room exists on disk that the world never built, and
// require this to go red.
//
// The last of my six checks to get one, and the only one whose mutation is not
// a collider: it compares FILES ON DISK against rooms in the WORLD, so breaking
// it means lying about the disk rather than changing the world. A phantom
// `int-selftest.ts` exporting `buildSelftest` is exactly the failure this
// script was written for — a finished room whose construction call nobody
// made — and it is the shape all five real ones took (casino, hotel, tax
// office, park, car lot).
//
// Injected AFTER the empty-directory guard above, so a genuinely wrong working
// directory still exits 2 rather than being masked by the phantom.
const SELFTEST = process.argv.includes('--selftest');
if (SELFTEST) {
  files.push('int-selftest.ts');
  console.log('selftest: claiming an int-selftest.ts nobody built — this MUST now go red');
}

// what each file CLAIMS to be: its filename id, and the builder it exports
const onDisk = files.map((f) => {
  if (SELFTEST && f === 'int-selftest.ts') return { file: f, id: 'selftest', builders: ['buildSelftest'] };
  const src = readFileSync(`${DIR}/${f}`, 'utf8');
  const builders = [...src.matchAll(/export function (build\w+)\s*\(/g)].map((m) => m[1]);
  return { file: f, id: f.replace(/^int-|\.ts$/g, ''), builders };
});

// ── the wider contract: is this builder called by ANYONE? ──
//
// The nag that matters is not "has no register()" — most modules export a
// builder their own owner calls, and that is fine. It is "exports a builder
// and NOBODY calls it", which is the exact shape of all five failures: the
// casino, the hotel, the tax office, the park and the car lot were each a
// complete module whose entry point appeared in no other file in the tree.
//
// So it greps the whole source tree, not just the entry point. A module that
// is neither loader-registered nor called from anywhere is ORPHANED and this
// fails, because there is no reading of that which is intentional.
const allSrc = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(`${d}/${e.name}`);
    else if (e.name.endsWith('.ts')) allSrc.push(`${d}/${e.name}`);
  }
};
walk('src');
const orphans = [];
for (const f of readdirSync(DIR).filter((f) => /\.ts$/.test(f) && !/^int-/.test(f)).sort()) {
  const src = readFileSync(`${DIR}/${f}`, 'utf8');
  const builders = [...src.matchAll(/export function (build\w+)\s*\(/g)].map((m) => m[1]);
  if (!builders.length) continue;
  if (/export function register\s*\(/.test(src)) continue;          // the loader has it
  const calledBy = [];
  for (const other of allSrc) {
    if (other.endsWith(`/${f}`)) continue;
    const text = readFileSync(other, 'utf8');
    if (builders.some((bn) => new RegExp(`\\b${bn}\\s*\\(`).test(text))) calledBy.push(other);
  }
  if (!calledBy.length) orphans.push(`${f} exports ${builders.join(', ')} and NOTHING in src/ calls it`);
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (/\[interior\]/.test(m.text())) errs.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.rooms !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4185/');   // GOTCHAS 26: prove it, do not just name it
const built = await p.evaluate(() => window.__ct.rooms());
const loaded = await p.evaluate(() => window.__ct.modules());
await b.close();

const problems = [...orphans.map((o) => o)];
for (const r of onDisk) {
  if (r.builders.length === 0) {
    problems.push(`${r.file} exports no build…() function, so nothing can construct it`);
  } else if (r.builders.length > 1) {
    problems.push(`${r.file} exports ${r.builders.length} builders (${r.builders.join(', ')}) — `
      + 'the loader takes the first, so the rest are dead code');
  }
  if (!built.includes(r.id)) {
    problems.push(`${r.file} is NOT IN THE WORLD — no room registered the id "${r.id}". `
      + 'Either its builder threw on the way up, or its spec.id does not match its filename.');
  }
}
for (const id of built) {
  if (!onDisk.some((r) => r.id === id)) {
    problems.push(`a room registered the id "${id}" but there is no ct/int-${id}.ts — `
      + 'the id and the filename must agree, or this check cannot see it');
  }
}
for (const e of errs) problems.push(`the world complained while building: ${e}`);

console.log(`${loaded.length} modules registered with the world loader: `
  + loaded.map((r) => `${r.path.replace('./', '')}@${r.order}`).join(', '));
console.log(`\n${files.length} interior files on disk: ${onDisk.map((r) => r.id).join(', ')}`);
console.log(`${built.length} rooms registered in the world: ${built.join(', ')}`);
if (problems.length) {
  console.log('');
  for (const s of problems) console.log(`  FAIL  ${s}`);
  console.log(`\n${problems.length} problem(s). Every ct/int-*.ts must build a room you can reach.`);
  process.exit(1);
}
console.log('\nevery interior on disk is built and reachable in the world');
