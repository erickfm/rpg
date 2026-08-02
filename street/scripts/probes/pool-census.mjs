// WHO CAN RECEIVE THE LAMP POOL, AND WHO SITS IN ONE WITHOUT BEING ABLE TO?
//
// Three user reports in sixty seconds are one bug: the pool is applied PER
// MESH and stops at mesh boundaries.
//   bodega facade   a hard-edged BRIGHT rectangle — lit, neighbours are not
//   alley door      a hard-edged BLACK door — unlit, neighbours are
//   brick wall      a pool cropped at a straight edge with nothing there
// Same fault, both signs. It is 'nine registered, ten stay dry' again, in
// light instead of wet.
//
// `props.lit()` is OPT-IN: traffic, crowd, cars, sidestreet and props' own
// props call it. Buildings, walls, doors and alley dressing never do.
//
// Usage: SHOT_URL=http://localhost:PORT/ node scripts/pool-census.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from '../lib/reachable.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { setNight } from '../lib/clock.mjs';

const URL = aim('http://localhost:4177/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await goto(page, URL);
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await setNight(page, 23, 0);

const r = await page.evaluate(() => {
  const LAMP_R = 7.0;
  const sc = window.__ct.scene();
  // lamp heads, the way glow.mjs finds them
  const lamps = [];
  sc.traverse((o) => {
    if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
      o.updateMatrixWorld(true);
      const m = o.matrixWorld.elements;
      lamps.push({ x: m[12], z: m[14] });
    }
  });
  const inPool = (x, z) => lamps.some((L) => Math.hypot(L.x - x, L.z - z) <= LAMP_R);

  const rows = [];
  sc.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.updateMatrixWorld(true);
    const m = o.matrixWorld.elements;
    const x = m[12], y = m[13], z = m[14];
    if (Math.abs(x) > 100) return;                 // interiors keep their own light
    if (y > 6) return;                             // a pool is thrown DOWN; roofs are out
    if (!inPool(x, z)) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    // THE ACTUAL GATE, from props.ts: `pool: poolable && !selfLit && !noLamp`
    // with `poolable = wy.y < 4.5 && span < 6`. `graded` is NOT the gate --
    // dimWorld traverses everything, so graded is nearly universal and my
    // first census reported 3% and learned nothing.
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const lo = bb.min.clone().applyMatrix4(o.matrixWorld);
    const hi = bb.max.clone().applyMatrix4(o.matrixWorld);
    const span = Math.max(Math.abs(hi.x - lo.x), Math.abs(hi.z - lo.z));
    // The gate is a TAPER now, not a step: full weight to 6 m, nothing past
    // 12, smoothstep between. Measuring the old `span < 6` here would have this
    // script reporting a rule the code no longer has.
    const tw = 1 - Math.min(1, Math.max(0, (span - 6) / 6));
    const sizeW = tw * tw * (3 - 2 * tw);
    const tooWide = sizeW <= 0, tooHigh = !(y < 4.5);
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mm) {
      if (!mat?.color) continue;
      rows.push({ mod: mod ?? '(unattributed)', tooWide, tooHigh,
                  selfLit: !!mat.userData?.selfLit, noLamp: !!mat.userData?.noLight,
                  poolable: !tooWide && !tooHigh && !mat.userData?.selfLit && !mat.userData?.noLight,
                  partial: sizeW > 0 && sizeW < 1,
                  span: +span.toFixed(1), x: +x.toFixed(1), z: +z.toFixed(1) });
    }
  });

  const by = {};
  for (const q of rows) {
    by[q.mod] ??= { total: 0, unreg: 0, wide: 0, high: 0 };
    by[q.mod].total++;
    if (!q.poolable) by[q.mod].unreg++;
    if (q.tooWide) by[q.mod].wide++;
    if (q.tooHigh) by[q.mod].high++;
  }
  return { lamps: lamps.length, total: rows.length,
           unreg: rows.filter((q) => !q.poolable).length,
           wide: rows.filter((q) => q.tooWide).length,
           high: rows.filter((q) => q.tooHigh).length,
           partial: rows.filter((q) => q.partial).length,
           widest: rows.filter((q) => q.tooWide).sort((a, b) => b.span - a.span).slice(0, 5),
           mods: Object.entries(by).sort((a, b) => b[1].unreg - a[1].unreg)
                   .map(([k, v]) => ({ mod: k, ...v })) };
});

console.log(`\n  ${r.lamps} lamps. Of ${r.total} material-slots standing inside a 7 m pool,`);
console.log(`  ${r.unreg} CANNOT receive it — ${(r.unreg / r.total * 100).toFixed(0)}% of everything a lamp shines on.\n`);
console.log(`  excluded for SPAN >= 12 m: ${r.wide}   for HEIGHT >= 4.5 m: ${r.high}`);
console.log(`  partially weighted (6-12 m span, the old cliff's blast radius): ${r.partial}`);
console.log('  widest things a lamp shines on and cannot light:');
for (const w of r.widest) console.log(`    ${w.mod} span ${w.span} m at (${w.x}, ${w.z})`);
console.log('\n  module            in a pool   cannot receive');
for (const m of r.mods)
  console.log(`  ${m.mod.padEnd(18)} ${String(m.total).padStart(7)} ${String(m.unreg).padStart(15)}`);
console.log('\n  A pool that stops at a mesh boundary is the same fault with either sign:');
console.log('  lit next to unlit reads as a bright rectangle, unlit next to lit as a');
console.log('  black one. Registration is OPT-IN, so a new prop is born unable.\n');
await browser.close();
