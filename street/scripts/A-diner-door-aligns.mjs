// IS THE DINER'S PAINTED DOOR WHERE ITS DECLARED DOOR IS?
//
// An ASSERTION, and it exits non-zero. The queue's first item is that the room
// declares the door and the facade follows; `dinerFront` converts the declared
// world position with `doorAlongU`, so the two agree BY CONSTRUCTION — which is
// exactly the kind of claim that is worth measuring, because construction
// arguments are what GOTCHAS 27 says checks get talked out of.
//
// Method: the painter draws the door's lower leaf in bright STEEL across the
// full door width, and nothing else at that height on this front is bright and
// neutral. Find that run of columns in the painter's own canvas, convert the
// run's centre back to world z through the frontage's own uDir, and compare it
// to `doorWorld`. Reads the canvas, not a screenshot — GOTCHAS 1.
// NOT REGISTERED IN scripts/checks.mjs, AND IT HAS NO SELFTEST. GOTCHAS 27
// says both go in the same commit as the check, and I am deliberately not
// paying that here: a proper mutation for this one has to make the DECLARED
// door move while the painted one stays put, which means a hook in
// ct/tex-world.ts, and this branch is under a "look and report, change
// nothing" instruction. So this is EVIDENCE I ran once, not a guard standing
// watch — do not read a green board as covering it.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const TOL = 0.30;                                // metres. half a door width is 0.53

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

const r = await p.evaluate((shift) => {
  const f = (globalThis.__frontages || []).find((q) => q.name === 'DINER');
  if (!f) return { err: 'no DINER frontage' };
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
  const WANT = f.frontageM / 4.2;
  let img = null, best = 0.12;
  scene.traverse((n) => {
    if (!n.isMesh || !Array.isArray(n.material)) return;
    const e = n.matrixWorld.elements;
    if (e[14] < lo || e[14] > hi || e[13] < 1.4 || e[13] > 2.8) return;
    for (const m of n.material) {
      const im = m && m.map && m.map.image;
      if (!im || im.width < 100) continue;
      const err = Math.abs(im.width / im.height - WANT) / WANT;
      if (err < best) { best = err; img = im; }
    }
  });
  if (!img) return { err: 'no DINER band canvas' };
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, c.width, c.height).data;
  const ppm = c.width / f.frontageM;
  // Sample INSIDE the door's 0.85 m steel panel: 0.80 m above the pavement.
  // Two rows either side of that were wrong on the way here and each failed
  // loudly enough to be caught only because the run WIDTH was printed —
  // 0.45 m lands on the kick rail, which is bright neutral for the full
  // 11.3 m, and the check duly "found a door" 11 m wide.
  const y = Math.round(c.height - 0.80 * ppm);
  const runs = [];
  let s = -1;
  for (let x = 0; x <= c.width; x++) {
    let neutral = false;
    if (x < c.width) {
      const i = (y * c.width + x) * 4;
      const R = d[i], G = d[i + 1], B = d[i + 2];
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      neutral = mx > 140 && mx - mn < 22;
    }
    if (neutral && s < 0) s = x;
    if (!neutral && s >= 0) { runs.push([s, x - 1]); s = -1; }
  }
  // PICK THE RUN THAT IS DOOR-WIDTH, not the longest one. The glass-block
  // panel is also a bright neutral at this height and is twice a door wide,
  // so "longest" finds the glass block every time.
  const scored = runs
    .map(([a, z]) => ({ a, z, w: (z - a + 1) / ppm }))
    .filter((q) => Math.abs(q.w - f.doorWidthM) / f.doorWidthM < 0.45)
    .sort((q, w) => Math.abs(q.w - f.doorWidthM) - Math.abs(w.w - f.doorWidthM));
  if (!scored.length) {
    return { err: 'no door-width bright-neutral run at door height', y, ppm,
      sawRuns: runs.map(([a, z]) => +(((z - a + 1) / ppm).toFixed(2))) };
  }
  const [bs, be] = [scored[0].a, scored[0].z];
  const uMid = ((bs + be) / 2 + 0.5) / ppm;        // metres along canvas u
  // u runs along the frontage in the direction the placement recorded.
  const paintedWorld = f.uDir > 0 ? lo + uMid : hi - uMid;
  return {
    ppm, y, runPx: [bs, be], runW: (be - bs + 1) / ppm,
    paintedWorld, declared: f.doorWorld, doorWidthM: f.doorWidthM,
    lo, hi, uDir: f.uDir, shift,
  };
}, 0);

if (r.err) { console.error('ABORT:', r.err, JSON.stringify(r)); process.exit(3); }

console.log(`\n  DINER frontage      ${r.lo} … ${r.hi}   uDir ${r.uDir}   ${r.ppm} px/m`);
console.log(`  declared door       z = ${r.declared.toFixed(2)}  (width ${r.doorWidthM} m)`);
console.log(`  painted door leaf   z = ${r.paintedWorld.toFixed(2)}  (bright-neutral run ${r.runW.toFixed(2)} m at px ${r.runPx})`);
const off = Math.abs(r.paintedWorld - r.declared);
console.log(`  offset              ${off.toFixed(2)} m   tolerance ${TOL} m\n`);
await b.close();

if (off > TOL) {
  console.error(`FAIL: the painted door is ${off.toFixed(2)} m from the door the [E] spot and the room use.`);
  process.exit(1);
}
console.log('OK  the painted door leaf sits on the declared door position.');
