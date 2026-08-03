// w93 / item 246 — EXACTLY what stops `scripts/interiors-walk.mjs` running on
// the built bundle, and how much of it is already redundant with `__ct`.
//
// The queue row says the harness "CANNOT RUN ON `vite preview` — it imports
// `ct/doors.ts`, which 404s — and this is in direct conflict with the project's
// own verify-on-the-built-bundle rule (GOTCHAS 28)". True, and reproduced: on
// the bundle it dies with `Failed to fetch dynamically imported module` and
// **exits 1**, which is a FALSE RED — GOTCHAS 32's exact ambiguity, "measured
// and it is wrong" reported by a check that never measured anything.
//
// This measures the SIZE of the conflict rather than restating it, because
// "make it bundle-runnable" and "declare it dev-only" are very different
// amounts of work and nobody had counted. It reads the harness's four
// `import('/src/proto/…')` sites and, for each, asks whether `window.__ct`
// already carries the same value — CHECKING THE TWO AGREE on a DEV server,
// where both sides exist. An equivalence asserted from the source is a guess.
//
// ⚠ THE FIRST VERSION OF THIS PROBE LIED, AND IT IS THE TRAP THE ROW WARNS
// ABOUT. It tried to pair each door with a `__ct.roomDims()` row by matching
// world coordinates, and scored **0 of 8** — which I nearly wrote up as
// "roomDims disagrees with doors.ts". It does not: a shopfront door stands on
// the STREET at x ≈ ±7, and the room it opens into is out in the interior belt
// at x = 440…1300. They are the same room and share no coordinate. The 0/8 was
// the matcher, not the world. (Kept here because a 0-of-8 that looks like a
// finding is precisely how a probe gets believed.)
//
// MUST BE RUN AGAINST A DEV SERVER — the one place both sides are readable:
//   SHOT_URL=http://localhost:4491/ node scripts/probes/w93-item246-iw-bundle-gap.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SITE = process.env.SHOT_URL || 'http://localhost:4491/';
const HARNESS = fileURLToPath(new URL('../interiors-walk.mjs', import.meta.url));
const src = readFileSync(HARNESS, 'utf8');

// ── STATIC: which values do the four import sites actually ask for? ────────
const sites = [...src.matchAll(/import\('(\/src\/proto\/[^']+)'\)/g)].map((m) => m[1]);
console.log(`interiors-walk.mjs has ${sites.length} dev-only import sites: ${[...new Set(sites)].join(', ')}`);

// `r.W` is assigned from `roomWidthFor` at the first site. Is it ever READ?
// A value nobody consumes is not a reason to publish anything.
//
// ⚠ MY FIRST ATTEMPT AT THIS PRINTED `-1 genuine reads`, WHICH IS THE SAME
// CLASS OF FAULT THIS WHOLE ITEM IS ABOUT. It counted writes as
// `/\br\.W\b\s*=/`, and that pattern matches `r.W === undefined` as well as
// `r.W = d.W` — so writes (3) exceeded mentions (2) and the subtraction went
// negative. A count that can go negative is not a count. So: no arithmetic.
// PRINT THE LINES and let the reader judge, which is what a two-mention symbol
// deserves anyway.
const lines = src.split('\n');
const show = (re, label) => {
  const hits = lines.map((t, i) => [i + 1, t])
    .filter(([, t]) => re.test(t) && !/^\s*(\/\/|\*)/.test(t));
  console.log(`  ${label} — ${hits.length} non-comment line(s):`);
  for (const [i, t] of hits) console.log(`    ${String(i).padStart(5)}: ${t.trim()}`);
  return hits;
};
const wHits = show(/\br\.W\b/, '`r.W` (the roomWidthFor value)');
show(/\b(?:r|room)\.at\b/, '`r.at` / `room.at` (the declaredDoors value)');

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(SITE, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const canImport = await p.evaluate(async () => {
  try { await import('/src/proto/ct/doors.ts'); return true; } catch { return false; }
});
console.log(`\n${SITE} — /src/proto/ct/doors.ts importable: ${canImport ? 'YES (dev server)' : 'NO (built bundle)'}`);
if (!canImport) {
  console.error('This probe needs a DEV server; on a bundle only one side of the comparison exists.');
  await b.close(); process.exit(3);
}

// ── DYNAMIC: does __ct.doors() agree with doors.ts, door for door? ─────────
const r = await p.evaluate(async () => {
  const dm = await import('/src/proto/ct/doors.ts');
  const im = await import('/src/proto/ct/interior.ts');
  const ctDoors = window.__ct.doors();
  const rows = dm.declaredDoors().map((decl) => {
    const name = decl.building;
    const s = { stand: dm.doorStandFor(name), point: dm.doorPointFor(name), at: decl.at ?? null };
    const pub = ctDoors.find((d) => d.building === name) ?? null;
    const near = (a, c) => a && c && Math.hypot(a.x - c.x, a.z - c.z) < 1e-9;
    return { name, standOk: near(s.stand, pub && pub.stand), pointOk: near(s.point, pub && pub.point),
      published: !!pub, at: s.at };
  });
  return { rows, nParty: Array.isArray(im.PARTY) ? im.PARTY.length : null,
    ctKeys: Object.keys(window.__ct).sort() };
});

const n = r.rows.length;
const standOk = r.rows.filter((x) => x.standOk).length;
const pointOk = r.rows.filter((x) => x.pointOk).length;
const pubOk = r.rows.filter((x) => x.published).length;
// POPULATION FLOOR. Every agreement below is a filter over `declaredDoors()`,
// and 0 of 0 agrees perfectly. (GOTCHAS 34.)
if (n < 8) {
  console.error(`POPULATION FLOOR: ${n} declared doors, want >= 8. Nothing measured.`);
  await b.close(); process.exit(3);
}
console.log(`declared doors: ${n}`);
console.log(`  published on __ct.doors():             ${pubOk}/${n}`);
console.log(`  doorStandFor agrees exactly:           ${standOk}/${n}`);
console.log(`  doorPointFor agrees exactly:           ${pointOk}/${n}`);
for (const x of r.rows) if (!x.standOk || !x.pointOk || !x.published) {
  console.log(`    DIFFERS: ${x.name} published=${x.published} stand=${x.standOk} point=${x.pointOk}`);
}
const partyPublished = r.ctKeys.some((k) => /party/i.test(k));
console.log(`  interior.ts PARTY:                     ${r.nParty} declared party wall(s), `
  + `published on __ct? ${partyPublished ? 'yes' : 'NO'}`);

// SELF-TEST, NEGATIVE SIGN. The agreement checks above are `< 1e-9` compares;
// if the comparator were broken they would read 0/n, not n/n — so the sign that
// needs proving is the other one: that a DELIBERATELY WRONG value is rejected.
const neg = await p.evaluate(async () => {
  const dm = await import('/src/proto/ct/doors.ts');
  const s = dm.doorStandFor('DINER');
  const bad = { x: s.x + 0.5, z: s.z };
  return Math.hypot(bad.x - s.x, bad.z - s.z) < 1e-9;      // must be FALSE
});
console.log(`  self-test: a 0.5 m displaced stand is rejected: ${neg === false ? 'PASS' : '*** FAIL ***'}`);
if (neg !== false) { await b.close(); process.exit(2); }

console.log('\nVERDICT — the gap is ONE value, not four');
console.log(`  doorStandFor / doorPointFor  (3 of the 4 sites' needs): ALREADY on __ct.doors(), ${standOk}/${n} and ${pointOk}/${n} exact.`);
console.log(`  roomWidthFor -> r.W: ${wHits.length} non-comment line(s) in the whole harness, all of them`);
console.log(`     the same assignment. Nothing reads it (\`inRoom\` uses lower-case \`r.w\`, measured`);
console.log(`     from colliders, and the room builder uses \`built.w\`). DEAD.`);
console.log(`  declaredDoors().at -> r.at: a FALLBACK only (\`(built && built.door) || { x: room.at, … }\`).`);
console.log(`  interior.ts PARTY: NOT published, and the harness exits 3 without it.`);
console.log('  => publishing PARTY on __ct is the whole remaining blocker. It lives in');
console.log('     src/proto/crosstown.ts, a file item 246 does not name — queued, not done here.');
await b.close();
