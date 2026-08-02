// ITEM 132 — THE CHECK THAT CAN FAIL for the bulb program.
//
// A screenshot cannot prove a chase does anything; the whole change is in TIME.
// So this reads the light off ONE REAL RUN OF SOCKETS for a full loop and
// reconstructs what a person standing there would have seen.
//
// ── why it reads a physical run and not the materials ──────────────────
//
// The first version of this probe grouped the bulb meshes by material
// reference and sorted the groups by bulb count. That recovers the six phase
// classes correctly but in AN ARBITRARY ORDER, and every question worth asking
// — is the comet contiguous, is it travelling, which way, do odds and evens
// split — is a question about class ORDER. It reported 209 of 330 samples
// unclassifiable against a world that was working fine. That was an instrument
// fault of exactly the kind BUILDER-BRIEF §7 describes.
//
// The fix is to stop inferring order and measure it. Bulb `i` is class
// `i % PHASES` and a run is emitted in one pass, so ALONG ANY STRAIGHT RUN OF
// SOCKETS CONSECUTIVE BULBS ARE CONSECUTIVE CLASSES. Sorting one run's bulbs
// by position therefore recovers the true cycle order — and it is also
// literally what the viewer sees, which is the thing being checked.
//
// Exits NON-ZERO when a mode is missing. Positive control at the bottom of the
// note: against 720f98399's single-mode chase it reports comet-only and exits 1.
//
// Usage: SHOT_URL=http://localhost:4183/ node scripts/probes/w51-chase-program.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4183/';
const SECONDS = Number(process.env.SECONDS ?? 17);   // one 13.2 s loop plus slack

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 640 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate((h) => window.__ct.clock(h, 10), 23);
// stand where the sign is, so the frame hook that drives the chase is rendering
await p.evaluate(() => window.__ct.warp(53.6, -103.2, Math.PI, undefined, 0.5));
await p.waitForTimeout(1200);

const data = await p.evaluate(async (secs) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // every bulb: a small SphereGeometry mesh whose material opts out of fog
  const bulbs = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'SphereGeometry') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.fog !== false) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x - bb.min.x > 0.4) return;                 // a bulb, not a lamp globe
    bulbs.push({ x: (bb.min.x + bb.max.x) / 2, y: (bb.min.y + bb.max.y) / 2,
      z: (bb.min.z + bb.max.z) / 2, m });
  });
  // the longest horizontal run: one y, one z, many x
  const runs = new Map();
  for (const bl of bulbs) {
    const k = `${Math.round(bl.y * 20)}|${Math.round(bl.z * 20)}`;
    if (!runs.has(k)) runs.set(k, []);
    runs.get(k).push(bl);
  }
  const run = [...runs.values()].sort((a, c) => c.length - a.length)[0].sort((a, c) => a.x - c.x);
  const mats = run.map((bl) => bl.m);
  const rows = [];
  const t0 = performance.now();
  await new Promise((res) => {
    const step = () => {
      rows.push(mats.map((m) => m.color.getHexString()));
      if (performance.now() - t0 > secs * 1000) return res();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  return { n: run.length, y: +run[0].y.toFixed(2), z: +run[0].z.toFixed(2),
    x0: +run[0].x.toFixed(2), x1: +run[run.length - 1].x.toFixed(2),
    bulbs: bulbs.length, rows };
}, SECONDS);

console.log(`bulbs in the world: ${data.bulbs}`);
console.log(`run read: ${data.n} sockets at y ${data.y}, z ${data.z}, x ${data.x0}..${data.x1}`);
console.log(`samples: ${data.rows.length} over ~${SECONDS}s\n`);

const N = data.n;
const all = new Set(data.rows.flat());
const lum = (h) => parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16);
const litCol = [...all].sort((a, c) => lum(c) - lum(a))[0];
// a socket that never changes colour is a dud, and is excluded from the pattern
const dud = Array.from({ length: N }, (_, k) => new Set(data.rows.map((r) => r[k])).size === 1);
const live = Array.from({ length: N }, (_, k) => k).filter((k) => !dud[k]);
console.log(`colours: ${[...all].join(', ')}   lit = #${litCol}   duds on this run: ${N - live.length}\n`);

const seen = { comet: 0, alt: 0, allOn: 0, allOff: 0, other: 0 };
let fwd = 0, back = 0, prevLead = null;
for (const r of data.rows) {
  const lit = live.filter((k) => r[k] === litCol);
  const frac = lit.length / live.length;
  if (frac > 0.95) { seen.allOn++; prevLead = null; continue; }
  if (frac < 0.05) { seen.allOff++; prevLead = null; continue; }
  // `alt`: about half lit, and every lit socket the same parity along the run
  if (frac > 0.4 && frac < 0.6 && new Set(lit.map((k) => k % 2)).size === 1) {
    seen.alt++; prevLead = null; continue;
  }
  // `comet`: about a third lit, arriving as adjacent PAIRS
  if (frac > 0.2 && frac < 0.45) {
    const pairs = [];
    for (let i = 0; i < lit.length; i++) {
      if (lit[i + 1] === lit[i] + 1) { pairs.push(lit[i + 1]); i++; }
    }
    if (pairs.length >= Math.floor(lit.length / 2) - 1 && pairs.length > 0) {
      const lead = pairs[0] % 6;                     // front of the first comet, mod the cycle
      if (prevLead !== null && lead !== prevLead) {
        if ((prevLead + 1) % 6 === lead) fwd++;
        else if ((lead + 1) % 6 === prevLead) back++;
      }
      prevLead = lead;
      seen.comet++; continue;
    }
  }
  seen.other++;
}

console.log('what the sign did, in samples:');
for (const [k, v] of Object.entries(seen)) console.log(`   ${k.padEnd(8)} ${v}`);
console.log(`   comet travelled: ${fwd} steps forward, ${back} steps backward`);

const fails = [];
if (seen.comet < 20) fails.push(`comet seen in only ${seen.comet} samples — the running pair is not running`);
if (seen.alt < 5) fails.push('no `alt` (odd/even split) observed');
if (seen.allOn < 5) fails.push('no all-lit state observed (`flash` / `on`)');
if (seen.allOff < 3) fails.push('no all-dark state observed (`flash`)');
if (fwd < 3) fails.push('comet never travelled forward');
if (back < 3) fails.push('comet never travelled backward — `back` mode missing');
if (seen.other > data.rows.length * 0.15) fails.push(`${seen.other} unclassifiable samples — the pattern is not what it claims`);
if (N - live.length === 0) fails.push('no dud socket on the longest run — the 1984 ladder was lost');

console.log(errs.length ? `\nconsole errors: ${errs.length}\n  ${errs.join('\n  ')}` : '\nconsole errors: none');
await b.close();
if (fails.length) { console.log('\nFAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\nPASS — every mode in the program was observed on a real run of sockets');
