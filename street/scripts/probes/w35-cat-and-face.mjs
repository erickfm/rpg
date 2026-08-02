// w35 — ITEM 66, the two sampled rows that only a RENDERED frame can settle.
//
// L187 "put the cat on the right side of the paper trash" — the whole history of
// this row is that "right" is frame-relative and five derived coordinates were
// right in the wrong frame. So this does not reason about axes at all: it warps
// to the user's own canonical station and PROJECTS both objects through the live
// camera, so "right" means right on the screen the user is looking at.
//
// L195 "whats up with this kids face? its multi color?" — faces.mjs samples the
// cheek row of the FRONT view and the row itself records that it passed both
// before AND after the fault, so it is not evidence here. A head crop is.
//
//   SHOT_URL=http://localhost:4191/ node scripts/probes/w35-cat-and-face.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4191/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
mkdirSync('shots/w35', { recursive: true });

// ── L187 ──────────────────────────────────────────────────────────────────
// the user's own station, quoted from the row: (-8.5, -39.5) yaw -0.785
// DAYLIGHT, explicitly: the first run of this probe shot a black rectangle
// because the world clock happened to be at 04:14. A frame you cannot see is
// not evidence, and "I took a screenshot" would still have been true.
await p.evaluate(() => { window.__ct.clock(13, 0); window.__ct.warp(-8.5, -39.5, -0.785, 0, 0); });
await p.waitForTimeout(900);
await p.screenshot({ path: 'shots/w35/cat-user-frame.png' });

const cat = await p.evaluate(() => {
  const s = window.__ct.scene(), cam = window.__ct.camera();
  const V = s.position.constructor;
  const project = (v) => {
    const q = v.clone().project(cam);
    return { sx: +((q.x * 0.5 + 0.5) * 900).toFixed(1), sy: +((-q.y * 0.5 + 0.5) * 600).toFixed(1), inFront: q.z < 1 };
  };
  const boxOf = (o) => {
    o.updateWorldMatrix(true, true);
    let mn = null, mx = null;
    o.traverse((c) => {
      if (!c.isMesh || !c.geometry) return;
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox;
      for (const xi of [bb.min.x, bb.max.x]) for (const yi of [bb.min.y, bb.max.y]) for (const zi of [bb.min.z, bb.max.z]) {
        const v = new V(xi, yi, zi).applyMatrix4(c.matrixWorld);
        if (!mn) { mn = v.clone(); mx = v.clone(); } else { mn.min(v); mx.max(v); }
      }
    });
    return mn ? { mn, mx } : null;
  };
  // the cat, by her own tag
  let catObj = null;
  s.traverse((o) => { if (o.userData && o.userData.catShadow) catObj = o; });
  const catPos = catObj.getWorldPosition(new V());
  // THE NEAREST LITTER IS NOT THE PAPER, and assuming it was is how this probe
  // first reported the row false. `ct/props.ts:3142-3144` drops THREE pieces in
  // this alley — flattened cardboard at (-10.60,-41.45) and (-9.40,-42.40), and
  // the folded NEWSPAPER at (-12.60,-42.05). The two nearest the cat are both
  // cardboard; the paper the user meant is the far one. So each piece is
  // projected and labelled by which authored drop it matches, rather than by
  // being closest.
  const AUTHORED = [
    { what: 'flattened cardboard', x: -10.60, z: -41.45 },
    { what: 'flattened cardboard', x: -9.40, z: -42.40 },
    { what: 'folded newspaper', x: -12.60, z: -42.05 },
  ];
  const floor = [];
  s.traverse((o) => {
    if (!o.isMesh || (o.userData && o.userData.catShadow)) return;
    const bx = boxOf(o);
    if (!bx) return;
    const c = bx.mn.clone().add(bx.mx).multiplyScalar(0.5);
    const h = bx.mx.y - bx.mn.y;
    if (h < 0.2 && c.y < 0.4 && catPos.distanceTo(c) < 4.0) {
      const hit = AUTHORED.find((a) => Math.hypot(a.x - c.x, a.z - c.z) < 0.35);
      if (hit) floor.push({ what: hit.what, c, span: [+(bx.mx.x - bx.mn.x).toFixed(2), +(bx.mx.z - bx.mn.z).toFixed(2)], d: +catPos.distanceTo(c).toFixed(3) });
    }
  });
  floor.sort((a, c) => a.d - c.d);
  return {
    cat: { world: [+catPos.x.toFixed(2), +catPos.z.toFixed(2)], screen: project(catPos.clone().setY(0.25)) },
    litter: floor.map((f) => ({ what: f.what, world: [+f.c.x.toFixed(2), +f.c.z.toFixed(2)], span: f.span, d: f.d, screen: project(f.c) })),
  };
});

console.log('\n== L187 — the cat in the USER\'S frame, station (-8.5,-39.5) yaw -0.785 ==');
console.log('  cat   ', JSON.stringify(cat.cat));
for (const l of cat.litter) console.log('  litter', JSON.stringify(l));
const paper = cat.litter.find((l) => l.what === 'folded newspaper');
const card = cat.litter.filter((l) => l.what === 'flattened cardboard');
if (paper) {
  const right = cat.cat.screen.sx > paper.screen.sx;
  console.log(`  => PAPER at screen-x ${paper.screen.sx}, CAT at ${cat.cat.screen.sx}: the cat is ${right ? 'RIGHT' : 'LEFT'} of the printed paper`);
  console.log(`  => separation ${(cat.cat.screen.sx - paper.screen.sx).toFixed(1)} px on screen, ${paper.d} m in world`);
}
for (const c of card) {
  console.log(`  => cardboard at screen-x ${c.screen.sx} (${c.screen.sx > cat.cat.screen.sx ? 'right of' : 'left of'} the cat), ${c.d} m clear in world`);
}
console.log('  shot shots/w35/cat-user-frame.png');

// ── L195 ──────────────────────────────────────────────────────────────────
// Paint every look on the world's own painter and crop the heads, which is the
// contact sheet H says it found the fault by looking at.
const faces = await p.evaluate(() => window.__ct.atlases().length);
console.log(`\n== L195 — citizen atlases: ${faces}`);
// p1 IS identifiable after all — `people()` publishes `hs`, and the row's own
// "kid" is the hs 0.91 walker. The auditor recorded that it could not tell the
// six apart because all six MESHES share a height; the per-person scale is on
// people(), which is where to ask.
const kid = await p.evaluate(() => {
  const ppl = window.__ct.walkers();
  const info = window.__ct.people();
  let bi = -1, bh = 9;
  info.forEach((q, i) => { if (q.hs < bh) { bh = q.hs; bi = i; } });
  const w = ppl[bi];
  if (w) window.__ct.warp(w.x + 1.0, w.z, Math.PI / 2, 0, 0.15);
  return { index: bi, hs: bh, at: w ? [+w.x.toFixed(2), +w.z.toFixed(2)] : null };
});
console.log('  smallest walker (the "kid", p1):', JSON.stringify(kid));
await p.waitForTimeout(900);
const people = await p.evaluate(() => window.__ct.people().slice(0, 3));
console.log('  people sample:', JSON.stringify(people));
await p.screenshot({ path: 'shots/w35/citizen-head.png' });
console.log('  shot shots/w35/citizen-head.png');
await b.close();
