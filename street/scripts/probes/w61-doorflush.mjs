// ARE THE FLAT DOORS FLUSH WITH THE WALL?
//
// The user: *"doors in apt are flush with wall on every floor except my
// floor."* A screenshot cannot settle that — a door photographed head-on has
// no reveal to show whether it is set into the wall or stuck on it. The number
// can settle it.
//
// For each of the eight flat doors this walks the scene graph, finds the leaf,
// and reports how far its face sits from the hall face of the wall it is in.
//   > 0   the leaf stands PROUD of the wall  -> reads flush/applied
//   < 0   the leaf is RECESSED into an opening -> reads like a doorway
//
// The wall face is not retyped: it is read off the wall boxes actually in the
// scene, by finding the shell wall segment nearest each door and taking its
// real half-thickness from its own geometry parameters.
//
// Usage: SHOT_URL=http://localhost:4192/ node scripts/probes/w61-doorflush.mjs [outdir]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4192/');
const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'shots/w61-doorflush';
mkdirSync(outDir, { recursive: true });

// ct/apartment.ts:124 — `export const APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7`.
// Copied with a citation rather than imported: this is a .mjs probe and the
// constant lives in a TS module the bundle does not re-export (BUILDER-BRIEF
// §8). confirmOrigin() below checks it against the running world before use.
const APT_X = 200, APT_Z = -20, ST = 2.7;
const AX = (l) => APT_X + l, AZI = (l) => APT_Z + l;
const DOOR_Z = AZI(3.5);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ct, null, { timeout: 60000 });
// GOTCHAS 78: __ct exists before anything is drawn. Wait for the RENDERER.
await afterFrames(page, 3);

const rows = await page.evaluate(({ AX0, DOOR_Z, ST }) => {
  const sc = window.__ct.scene();
  sc.updateMatrixWorld(true);
  const out = [];
  // Every mesh whose world position sits on the door centreline in z, within
  // the walk-up's x band. That catches leaves, casings and wall pieces alike;
  // we then sort them out by geometry type and size.
  const near = [];
  sc.traverse((o) => {
    if (!o.isMesh) return;
    // world position off the matrix directly — `window.THREE` is not published
    const e = o.matrixWorld.elements;
    const p = { x: e[12], y: e[13], z: e[14] };
    if (p.x < AX0 - 4 || p.x > AX0 + 7) return;
    if (Math.abs(p.z - DOOR_Z) > 1.6) return;
    const g = o.geometry;
    near.push({
      type: g.type, params: g.parameters ? { ...g.parameters } : null,
      x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4),
      name: o.name || '',
    });
  });
  return near;
}, { AX0: AX(0), DOOR_Z, ST });

// The door leaf planes are PlaneGeometry(DOOR_W, 2.1); the hung leaves are
// BoxGeometry with a 0.045 thin axis. The wall pieces are BoxGeometry with a
// 0.14 thin axis. Classify by that rather than by guessing at names.
// 2.1 was the old applied panel's height; 2.12 is FLAT_LEAF_H, the hung leaf.
// Accept both so the same probe reads before and after.
const leaves = rows.filter((r) => r.type === 'PlaneGeometry'
  && r.params.height > 2.05 && r.params.height < 2.2
  && r.params.width > 0.9 && r.params.width < 1.2);
const wallish = rows.filter((r) => r.type === 'BoxGeometry'
  && Math.abs(r.params.depth - 0.14) < 1e-6);

console.log(`world: ${URL}`);
console.log(`\nWALL PIECES on the door centreline (BoxGeometry depth 0.14):`);
for (const w of wallish.sort((a, b) => a.x - b.x || a.y - b.y)) {
  console.log(`  x=${w.x.toFixed(3)}  y=${w.y.toFixed(3)}  `
    + `w=${w.params.width.toFixed(3)} h=${w.params.height.toFixed(3)}`);
}
console.log(`\nFLAT-DOOR LEAF PLANES (PlaneGeometry h=2.1):`);
if (!leaves.length) console.log('  (none found)');
for (const l of leaves.sort((a, b) => a.x - b.x || a.y - b.y)) {
  const floor = Math.round((l.y - 1.05) / ST);
  const west = l.x < AX(1.2);
  // hall face of the wall this door belongs to
  const wallN = west ? AX(0.005) : AX(2.395);
  const hallFace = wallN + (west ? +0.07 : -0.07);
  // positive = proud of the wall, into the hall
  const proud = west ? l.x - hallFace : hallFace - l.x;
  console.log(`  floor ${floor + 1}  ${west ? 'WEST(01)' : 'EAST(02)'}  `
    + `x=${l.x.toFixed(3)}  hallFace=${hallFace.toFixed(3)}  `
    + `proud=${(proud * 1000).toFixed(0)} mm  ${proud >= 0 ? 'FLUSH/APPLIED' : 'RECESSED'}`);
}

// ── and a look, from where a person actually stands on each landing ────────
// GOTCHAS 78, the sharp end of it: `afterFrames` waits for rAF callbacks, and
// rAF fires whether or not the renderer has put anything on the canvas. On a
// COLD `vite preview` that is not enough — every one of these eight frames came
// back solid black from the built bundle while the same bundle's scene graph
// and walk tests read perfectly. So wait for a PIXEL, which is the only thing
// that actually proves the world was drawn.
// The renderer is not published on `__ct` (crosstown.ts:1339 keeps it local),
// so a probe cannot ask it for a frame count without editing a file this item
// does not name. What IS available is the encoded frame: a uniformly black
// 1280x720 PNG compresses to about 6 kB and a drawn one to about 58 kB, so
// size is a usable PROXY for "something got drawn". It is a proxy and it is
// labelled as one — the actual proof is the brightness check run over the
// finished files afterwards, which is what caught the black set to begin with.
const BLACK_PNG_MAX = 12000;
const drawn = async (capMs = 45000) => {
  const t0 = Date.now();
  for (;;) {
    const buf = await page.screenshot();
    if (buf.length > BLACK_PNG_MAX) {
      console.log(`  [drawn] first painted frame after ${Date.now() - t0} ms `
        + `(${(buf.length / 1024).toFixed(0)} kB)`);
      return true;
    }
    if (Date.now() - t0 > capMs) {
      console.warn(`[drawn] canvas still ~black after ${capMs} ms `
        + `(${buf.length} B) — the shots below are NOT evidence of anything`);
      return false;
    }
    await page.waitForTimeout(400);
  }
};
await drawn();
const at = (dx, dz) => Math.atan2(dx, -dz);
for (let f = 0; f < 4; f++) {
  // stand in the hall, north of the doors, looking back at them obliquely —
  // a head-on shot cannot show a reveal even when there is one
  const sx = AX(1.55), sz = AZI(5.6);
  await page.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, -0.02),
    [sx, sz, at(AX(0.05) - sx, DOOR_Z - sz), f * ST]);
  await afterFrames(page, 3);
  await page.screenshot({ path: `${outDir}/floor${f + 1}-west.png` });
  await page.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, -0.02),
    [AX(0.85), sz, at(AX(2.35) - AX(0.85), DOOR_Z - sz), f * ST]);
  await afterFrames(page, 3);
  await page.screenshot({ path: `${outDir}/floor${f + 1}-east.png` });
}
console.log(`\nshots -> ${outDir}`);
if (errs.length) { console.log(`\nCONSOLE ERRORS (${errs.length}):`); for (const e of errs.slice(0, 5)) console.log('  ' + e); }
await browser.close();
