// Does anything hang in mid-air?
//
// The auditor found a 0.44 m price card floating 0.325 m above its shelf in
// the thrift store — visible standing right at it. Same class as the litter
// that clipped: an object placed at a y somebody typed, rather than at the top
// of whatever it sits on. A number that was right when it was written and
// wrong the moment the shelf under it moved.
//
// So this does not check that card. For every small prop in every interior it
// finds the nearest surface DIRECTLY BENEATH — the top of any collider or any
// horizontal plane under its footprint — and reports the gap. Anything more
// than a few centimetres off is either floating or sunk.
//
// It cannot know intent: a hanging sign is SUPPOSED to have air under it. So
// it reports rather than fails, sorted worst first, and the reading is yours.
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

// A BOX may be given to point it somewhere else: `x0 x1 z0 z1`. The default
// stays interiors-only (x >= 400) so the reading above is unchanged, but the
// check is not interior-specific — an exterior prop sits on ground that other
// builders move, which is if anything the likelier way a typed y goes stale.
//
//     node scripts/floaters-walk.mjs 6 32 -12 16      # the car lot
const ARG = process.argv.slice(2).map(Number);
const BOX = ARG.length === 4 ? ARG : null;
const found = await p.evaluate(([BOX]) => {
  const V = window.__ct.scene().position.constructor;
  const B = window.__ct.scene().constructor;
  const props = [];
  const surfaces = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    const w = new V(); o.getWorldPosition(w);
    if (BOX) { if (w.x < BOX[0] || w.x > BOX[1] || w.z < BOX[2] || w.z > BOX[3]) return; }
    else if (w.x < 400) return;                             // default: interiors only
    const g = o.geometry.parameters;
    const isBox = o.geometry.type === 'BoxGeometry';
    const isPlane = o.geometry.type === 'PlaneGeometry';
    if (!isBox && !isPlane) return;
    const wx = (g.width ?? 0), wy = (g.height ?? 0), wd = (g.depth ?? 0);
    // a SURFACE is anything with a horizontal top: a box, or a plane laid flat
    if (isBox) surfaces.push({ x: w.x, z: w.z, hw: wx / 2, hd: wd / 2, top: w.y + wy / 2 });
    else if (Math.abs(Math.abs(o.rotation.x) - Math.PI / 2) < 0.01)
      surfaces.push({ x: w.x, z: w.z, hw: wx / 2, hd: (g.height ?? 0) / 2, top: w.y });
    // a small PROP is a little thing that ought to be resting on something
    const big = Math.max(wx, wy, wd);
    if (big > 0.9 || big < 0.05) return;
    if (isPlane && Math.abs(o.rotation.x) > 0.01) return;    // upright signage: excluded below anyway
    props.push({ x: w.x, y: w.y, z: w.z, half: wy / 2 || 0.01, w: wx, d: wd, kind: o.geometry.type });
  });
  const out = [];
  for (const pr of props) {
    let best = null;
    for (const s of surfaces) {
      if (Math.abs(s.x - pr.x) > s.hw + pr.w / 2) continue;
      if (Math.abs(s.z - pr.z) > s.hd + pr.d / 2 + 0.05) continue;
      const bottom = pr.y - pr.half;
      if (s.top > bottom + 0.02) continue;                   // it is above us
      if (!best || s.top > best) best = s.top;
    }
    if (best === null) continue;                             // nothing under it at all
    const gap = (pr.y - pr.half) - best;
    if (gap > 0.06) out.push({ gap: +gap.toFixed(3), at: [+pr.x.toFixed(2), +pr.y.toFixed(2), +pr.z.toFixed(2)], kind: pr.kind });
  }
  return out.sort((a, b) => b.gap - a.gap).slice(0, 15);
}, [BOX]);

console.log(found.length ? 'props with air under them, worst first:' : 'nothing floating');
for (const f of found) console.log(`  ${f.gap.toFixed(3)} m  ${f.kind} @ ${f.at.join(', ')}`);
console.log('\nA hanging sign is SUPPOSED to have air under it, so this reports and does not');
console.log('fail. What it is for is the prop that was meant to be RESTING on something.');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
