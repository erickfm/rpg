// THE AUDITOR AND I DISAGREE ABOUT THE ALLEY DOOR, SO REPRODUCE THEIR
// MEASUREMENT RATHER THAN ARGUE WITH IT.
//
// AUDIT, re-opening the row: a brightness profile across the wall the fitting
// is mounted on, at its own height, 28 bins at 22:00 — baseline 18.0, peak 44.0
// in the two bins where the fitting is drawn, "2 of 28 bins raised, no falloff
// either side. A cast pool lights a wall over a span; this lights only itself."
//
// B, landing it: the DOOR went 0.0079 -> 0.0787 and carries `poolLit`.
//
// Both can be true, and if they are then the auditor's predicate can never go
// green however the lighting is fixed — which is worth knowing before anyone
// spends another pass on it. So this measures three things in one run:
//
//   1. the auditor's own profile, same shape, on this build
//   2. the DOOR's tint, so the two numbers sit side by side
//   3. THE WALL MESH ITSELF — its span, its sizeW, whether it is poolable at
//      all — because ct/props.ts excludes wide meshes from pooling BY DESIGN
//      (one material carries one tint, so a 12 m wall cannot hold a gradient),
//      and if the wall is one of those then "no falloff on the wall" is the
//      rule working, not the fix failing.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(22, 0));
await p.waitForTimeout(1500);

const D = [19.40, 1.06, -55.45];          // the door, measured in alleydoor.mjs
const GLOW = [19.40, 2.15, -55.45];       // the self-lit quad above it

const r = await p.evaluate(([DX, DY, DZ]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = { door: null, glow: null, walls: [] };
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const cx = (w.min.x + w.max.x) / 2, cy = (w.min.y + w.max.y) / 2, cz = (w.min.z + w.max.z) / 2;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m?.color) return;
    const span = Math.max(w.max.x - w.min.x, w.max.z - w.min.z);
    const row = { at: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)],
                  size: [+(w.max.x - w.min.x).toFixed(2), +(w.max.y - w.min.y).toFixed(2), +(w.max.z - w.min.z).toFixed(2)],
                  span: +span.toFixed(2), tint: +m.color.r.toFixed(4),
                  graded: !!m.userData?.graded, selfLit: !!m.userData?.selfLit,
                  poolLit: !!m.userData?.poolLit, mod: n.userData.mod ?? '?' };
    if (Math.hypot(cx - DX, cy - DY, cz - DZ) < 0.4 && row.size[1] > 1.5) out.door = row;
    if (Math.hypot(cx - DX, cz - DZ) < 1.0 && Math.abs(cy - 2.15) < 0.2 && row.selfLit) out.glow = row;
    // THE WALL the fitting is on: a tall surface in the same plane as the door,
    // wide enough that the span rule bites
    if (Math.abs(cz - DZ) < 1.2 && w.max.y > 3 && span > 3) out.walls.push(row);
  });
  out.walls.sort((a, c) => c.span - a.span);
  return out;
}, D);

console.log('\n── the three surfaces, at 22:00 ──');
const show = (name, q) => console.log(q
  ? `  ${name.padEnd(8)} ${JSON.stringify(q.size).padEnd(22)} span ${String(q.span).padStart(6)} m   tint ${String(q.tint).padEnd(8)}` +
    ` graded ${q.graded ? 'Y' : 'n'} selfLit ${q.selfLit ? 'Y' : 'n'} poolLit ${q.poolLit ? 'Y' : 'n'}`
  : `  ${name.padEnd(8)} (not found)`);
show('door', r.door);
show('glow', r.glow);
for (const w of r.walls.slice(0, 3)) show('wall', w);

// THE SPAN RULE, spelled out from ct/props.ts's own constants rather than
// remembered: full pooling to 6 m, nothing past 12, smoothstepped between.
const SPAN_FULL = 6, SPAN_NONE = 12;
const sizeW = (span) => {
  const tw = 1 - Math.min(1, Math.max(0, (span - SPAN_FULL) / (SPAN_NONE - SPAN_FULL)));
  return tw * tw * (3 - 2 * tw);
};
console.log('\n── can each of those pool at all? (props.ts: full to 6 m, none past 12) ──');
for (const [name, q] of [['door', r.door], ...r.walls.slice(0, 3).map((w) => ['wall', w])]) {
  if (!q) continue;
  console.log(`  ${name.padEnd(6)} span ${String(q.span).padStart(6)} m -> sizeW ${sizeW(q.span).toFixed(4)}` +
    (sizeW(q.span) === 0 ? '   CANNOT POOL, by design' : '   can pool'));
}

// ── the auditor's own profile, same shape ────────────────────────────────
await p.evaluate(([X, Z]) => window.__ct.warp(X, Z + 3.2, 0, 0, 0.06), [D[0], D[2]]);
await settle(p);
const png = (await p.screenshot()).toString('base64');
const prof = await p.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const W = img.width, H = img.height;
  // a band across the frame at the fitting's height — the top third, above the
  // door and below the eaves, which is where the auditor's 28 bins sit
  const y0 = Math.round(H * 0.18), y1 = Math.round(H * 0.30);
  const bins = [];
  for (let k = 0; k < 28; k++) {
    const x0 = Math.round((k * W) / 28), x1 = Math.round(((k + 1) * W) / 28);
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; n++;
    }
    bins.push(+(s / n).toFixed(1));
  }
  return bins;
}, png);
console.log('\n── the auditor\'s profile reproduced: 28 bins across the wall at the fitting\'s height ──');
console.log('  ' + prof.join(' '));
const base = [...prof].sort((a, c) => a - c)[Math.floor(prof.length * 0.4)];
const raised = prof.filter((v) => v > base * 1.35).length;
console.log(`  baseline ~${base}   peak ${Math.max(...prof)}   bins more than 35% over baseline: ${raised} of 28`);
await p.screenshot({ path: 'shots/wp-wall.png' });
console.log('  shots/wp-wall.png');
await b.close();
