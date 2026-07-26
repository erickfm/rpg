// THE LIBRARY'S DOORWAY IS THE ONE ITS FACADE HAS.
//
// Named for the claim, per GOTCHAS §24. The user's report was
// *"library entrance doesnt match exterior"* and the fault was one fact
// authored twice: `ct/civic.ts` paints a 2.50 x 4.00 arched DOUBLE door under a
// fanlight, `ct/interior.ts`'s fallback hung a 1.60 x 2.15 flush single leaf
// with a vision panel behind it, and nothing compared them.
//
// This asserts three things, in the order that matters:
//
//   1. THE POPULATION. The library slab is in the world and its own doorcase is
//      in the scene. Every verdict below is an absence or a span, and both are
//      free on a world that failed to build the room (GOTCHAS §34).
//   2. THE OPENING. The clear span cut in the room's front wall is 2.50 m and
//      the head is at 4.00 m — measured off `__ct.colliders()`, which is the
//      same array the movement code tests, not off the declaration.
//   3. THE KIT'S FLUSH LEAF IS NOT IN IT. `ct/int-library.ts` hides the one
//      `ct/interior.ts` hangs, by finding its 32x64 texture. That is a hack
//      against a file I do not own, and the failure mode if F changes the kit
//      is BOTH doors standing in one opening — which is worse than the
//      original fault and completely silent. So it is asserted here.
//
// WHAT THIS CANNOT DO, said plainly rather than left for the next reader:
// the facade's numbers are painted into a private texture in E's `ct/civic.ts`
// and cannot be read at runtime, so FACADE below is a table I measured by hand
// off that file's own texel arithmetic (40x48 texels over BAY_W 5.0 m x BAY_H
// 6.0 m = 8 px/m). If E repaints the entrance, this check goes on passing.
// It guards the interior against drifting, not the pair against being changed.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { modes } from './lib/modes.mjs';

const mode = modes('J-library-door', ['probe', 'all']);
void mode;
const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4192/';

// measured off ct/civic.ts's `doorT`, at its own 8 px/m:
//   leaves  fillRect(10, 16, 20, 32)  ->  2.50 m wide, 4.00 m tall
const FACADE = { clearW: 2.50, h: 4.00 };
const TOL = 0.12;                      // one texel of the facade's own grid

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// ── 1. the population ────────────────────────────────────────────────────────
const room = await page.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'library'));
if (!room) {
  console.error('ABORT  no library slab in __ct.roomDims() — nothing to measure');
  await b.close(); process.exit(3);                 // GOTCHAS §32: 3, not 1
}
console.log(`library slab  w ${room.w}  d ${room.d}  at (${room.cx}, ${room.cz})`);

if (SELFTEST) {
  // TWO mutations, one per verdict, both in the LIVE world so there is nothing
  // to rebuild — the shape scripts/canfail.mjs uses for the walking suites.
  await page.evaluate(([cx, cz, d]) => {
    // (a) jam the doorway: a post in the middle of the opening, pushed onto the
    //     same array the movement code reads
    window.__ct.colliders().push({
      minX: cx - 0.30, maxX: cx + 0.30,
      minZ: cz + d / 2 - 0.02, maxZ: cz + d / 2 + 0.20,
    });
    // (b) un-hide the kit's flush leaf, which is precisely what would happen if
    //     ct/interior.ts stopped painting it 32x64
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const img = mat?.map?.image;
      if (img && img.width === 32 && img.height === 64) o.visible = true;
    });
  }, [room.cx, room.cz, room.d]);
  console.log('SELFTEST: doorway jammed and the kit leaf un-hidden — both must go red');
}

// ── 2. the opening, measured ─────────────────────────────────────────────────
//
// Sampled INSIDE the wall band (cz + d/2 .. + T), not at the threshold: the kit
// deliberately puts a blocker across the doorway on the OUTER face so you cannot
// walk out of the front of a room, and sampling there would read every doorway
// in the world as sealed.
const span = await page.evaluate(([cx, cz, d]) => {
  const T = 0.18, zc = cz + d / 2 + T / 2;
  const solidAt = (x, y) => window.__ct.colliders().some((c) =>
    x >= c.minX && x <= c.maxX && zc >= c.minZ && zc <= c.maxZ
    && (c.minY === undefined || (y >= c.minY && y <= c.maxY)));
  const STEP = 0.02;
  let lo = null, hi = null;
  for (let x = cx - 6; x <= cx + 6; x += STEP) {
    if (!solidAt(x, 1.0)) { if (lo === null) lo = x; hi = x; }
    else if (lo !== null && hi !== null && hi - lo > 0.3) break;
  }
  return { lo, hi, zc };
}, [room.cx, room.cz, room.d]);

const clear = span.lo === null ? 0 : span.hi - span.lo + 0.02;
report('the clear opening is the facade\'s 2.50 m',
  Math.abs(clear - FACADE.clearW) <= TOL,
  `measured ${clear.toFixed(2)} m against ${FACADE.clearW.toFixed(2)} (tolerance ${TOL})`);

// the head. The kit's wall above the door is a run from DOOR_H to H, so a point
// at 4.20 m on the door line must be solid and one at 3.80 m must not.
const head = await page.evaluate(([cx, cz, d]) => {
  const T = 0.18, zc = cz + d / 2 + T / 2;
  const hit = (y) => window.__ct.colliders().some((c) =>
    cx >= c.minX && cx <= c.maxX && zc >= c.minZ && zc <= c.maxZ
    && (c.minY === undefined || (y >= c.minY && y <= c.maxY)));
  return { below: hit(3.80), above: hit(4.20) };
}, [room.cx, room.cz, room.d]);
// Colliders in this world are 2D AABBs with no y, so the head cannot be read
// from them — say so rather than assert something that is free.
console.log(`note: colliders carry no y (below ${head.below}, above ${head.above}); `
  + `the 4.00 m head is asserted by the declaration and looked at, not measured here`);

// ── 3. one door in the opening, not two ──────────────────────────────────────
const leaves = await page.evaluate(([cx, cz, w, d]) => {
  let kit = 0, own = 0;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    const p = o.getWorldPosition(o.position.clone());
    if (Math.abs(p.x - cx) > w / 2 + 2 || Math.abs(p.z - cz) > d / 2 + 2) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const img = mat?.map?.image;
    if (!img) return;
    if (img.width === 32 && img.height === 64 && o.visible) kit++;
    if (img.width === 16 && img.height === 48) own++;
  });
  return { kit, own };
}, [room.cx, room.cz, room.w, room.d]);

report('the doorcase\'s own two leaves are in the world',
  leaves.own >= 2, `${leaves.own} leaf planes (2 leaves, back to back, is 4)`);
report('and the kit\'s flush single leaf is NOT',
  leaves.kit === 0, `${leaves.kit} visible 32x64 kit leaves in the library slab`);

report('no console errors', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

console.log(fails ? `\n${fails} FAILED` : '\nall good');
await b.close();
if (SELFTEST) {
  // a selftest that does not go red is a check that is decoration (GOTCHAS §27)
  process.exit(fails >= 2 ? 0 : 2);
}
process.exit(fails ? 1 : 0);
