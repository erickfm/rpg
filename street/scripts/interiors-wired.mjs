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
// Usage: SHOT_URL=http://localhost:4185/ node scripts/interiors-wired.mjs
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'src/proto/ct';
const files = readdirSync(DIR).filter((f) => /^int-.+\.ts$/.test(f)).sort();
if (!files.length) { console.error('no ct/int-*.ts files at all — wrong directory?'); process.exit(2); }

// what each file CLAIMS to be: its filename id, and the builder it exports
const onDisk = files.map((f) => {
  const src = readFileSync(`${DIR}/${f}`, 'utf8');
  const builders = [...src.matchAll(/export function (build\w+)\s*\(/g)].map((m) => m[1]);
  return { file: f, id: f.replace(/^int-|\.ts$/g, ''), builders };
});

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (/\[interior\]/.test(m.text())) errs.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.rooms !== undefined, { timeout: 15000 });
const built = await p.evaluate(() => window.__ct.rooms());
await b.close();

const problems = [];
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

console.log(`${files.length} interior files on disk: ${onDisk.map((r) => r.id).join(', ')}`);
console.log(`${built.length} rooms registered in the world: ${built.join(', ')}`);
if (problems.length) {
  console.log('');
  for (const s of problems) console.log(`  FAIL  ${s}`);
  console.log(`\n${problems.length} problem(s). Every ct/int-*.ts must build a room you can reach.`);
  process.exit(1);
}
console.log('\nevery interior on disk is built and reachable in the world');
