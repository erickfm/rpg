// DOES THE BUNTING HANG ON ANYTHING, OR FLOAT?
//
// The user: *"the garlands are disconnected"* — they should terminate on real
// posts and chain between them rather than hanging in mid-air.
//
// The lot's most identifying object, by its own file's account: *"the single
// most identifying thing about the typology is not the cars, which any street
// has: it is the PENNANT BUNTING."* So it is worth a check that cannot go quiet.
//
// A run is drawn as a polyline of flat segments following a catenary between
// TIES. There are exactly two ways that reads as "disconnected", and this
// measures both rather than looking at it:
//
//   1. A GAP MID-RUN. Consecutive segments must share an endpoint. A polyline
//      whose pieces do not meet is a dotted line, and it is invisible in a
//      screenshot at any distance you would actually stand.
//   2. A FREE END. Every end of a chain must land on something that exists —
//      a bunting post or the sign mast — not in the air. This is the half the
//      user actually complained about.
//
// Endpoints are reconstructed from each segment's own world matrix (centre,
// local x axis, width), never from the TIES table the source builds them from.
// Reading back the table would only prove the table agrees with itself.
//
// Usage: SHOT_URL=http://127.0.0.1:4191/ node scripts/I-bunting.mjs
//        --selftest   lift one segment 0.4 m, require both clauses to notice
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);
const URL = aim('http://127.0.0.1:4191/');
const JOIN = 0.02;          // 2 cm: segments of one polyline share a point exactly
const ANCHOR = 0.45;        // an end this close to a post top is tied to it

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

if (ARGS.selftest) {
  const n = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let done = 0;
    s.traverse((o) => {
      if (done || !o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'lot') return;
      const g = o.geometry.parameters;
      if (Math.abs(g.height - 0.62) > 0.001) return;      // a pennant sheet
      o.position.y += 0.4; done = 1;                      // break the chain
    });
    s.updateMatrixWorld(true);
    return done;
  });
  console.log(`  SELFTEST: lifted ${n} bunting segment 0.4 m out of its run — this must go red\n`);
}

const world = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const segs = [], posts = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    const g = o.geometry.parameters ?? {};
    const e = o.matrixWorld.elements;
    if (o.geometry.type === 'PlaneGeometry' && Math.abs(g.height - 0.62) < 0.001) {
      // the sheet's local +x is the run direction, and the STRING is its top
      // edge — the cloth hangs below, so the tie point is up by height/2
      const ex = [e[0], e[1], e[2]], ey = [e[4], e[5], e[6]];
      const n = Math.hypot(...ex) || 1, ny = Math.hypot(...ey) || 1;
      const c = [e[12], e[13], e[14]];
      const half = g.width / 2;
      const top = c.map((v, i) => v - (ey[i] / ny) * (0.62 / 2));
      segs.push({
        a: top.map((v, i) => v - (ex[i] / n) * half),
        b: top.map((v, i) => v + (ex[i] / n) * half),
        len: +g.width.toFixed(3),
      });
      return;
    }
    // the bunting posts, and the sign mast: uprights the runs may tie to
    if (o.geometry.type === 'CylinderGeometry') {
      const h = g.height ?? 0;
      if (h < 1.5) return;
      posts.push({ x: e[12], y: e[13] + h / 2, z: e[14], h: +h.toFixed(2) });
    }
  });
  return { segs, posts };
});

const { segs, posts } = world;
const d3 = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
console.log(`\n  ${segs.length} bunting segments, ${posts.length} uprights they could tie to\n`);

const FAIL = [];
// ── 1. every segment end either meets another segment, or is a chain end ────
const ends = [];
for (const s of segs) { ends.push({ p: s.a }, { p: s.b }); }
let joined = 0;
const free = [];
for (let i = 0; i < ends.length; i++) {
  let meets = 0;
  for (let j = 0; j < ends.length; j++) {
    if (i === j || Math.floor(i / 2) === Math.floor(j / 2)) continue;   // not its own other end
    if (d3(ends[i].p, ends[j].p) <= JOIN) meets++;
  }
  if (meets) joined++; else free.push(ends[i].p);
}
console.log(`  ${joined} of ${ends.length} segment ends meet the next segment (within ${JOIN * 100} cm)`);
console.log(`  ${free.length} are ends of a run — these are the ones that must be tied\n`);

// ── 2. every free end lands on an upright ───────────────────────────────────
for (const f of free) {
  let best = { d: 1e9, p: null };
  for (const q of posts) {
    // horizontal distance to the post, and how far below its top the tie sits
    const dh = Math.hypot(f[0] - q.x, f[2] - q.z);
    const dv = Math.abs(f[1] - q.y);
    const d = Math.hypot(dh, dv);
    if (d < best.d) best = { d, p: q, dh, dv };
  }
  const ok = best.d <= ANCHOR;
  console.log(`     end at (${f[0].toFixed(2)}, ${f[1].toFixed(2)}, ${f[2].toFixed(2)})  `
    + `${ok ? 'TIED to' : 'FLOATS — nearest'} an upright ${best.d.toFixed(3)} m away `
    + `(${best.dh.toFixed(2)} across, ${best.dv.toFixed(2)} below its top)`);
  if (!ok) FAIL.push(`a bunting run ends at (${f[0].toFixed(2)}, ${f[1].toFixed(2)}, ${f[2].toFixed(2)}) `
    + `with no upright within ${ANCHOR} m — nearest is ${best.d.toFixed(2)} m`);
}

// a run that is one segment long, or a stray sheet, is also "disconnected"
const gaps = ends.length - joined - free.length;
if (gaps) FAIL.push(`${gaps} segment ends are neither joined nor accounted for`);
if (!segs.length) FAIL.push('no bunting found at all');

if (FAIL.length) { console.log('\nFAIL'); for (const f of FAIL.slice(0, 12)) console.log('  · ' + f); }
else console.log('\nevery run is a continuous chain and every end is tied to a real upright.');

await b.close();
process.exit(FAIL.length ? 1 : 0);
