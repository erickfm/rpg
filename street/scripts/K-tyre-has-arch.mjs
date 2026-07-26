// VERIFYING F's ROW "wheel arches read as arches" — independently, because the
// population is what has defeated everybody who has touched it.
//
// F settled it at 83 tyres / 83 arched / 0 bare, and was right to leave the row
// LANDED rather than re-confirm its own work. F's own note names the weakness:
//
//   > my colour heuristic would stop being a heuristic [if] `tyre.userData.tyre
//   > = true` … the population was the whole problem
//
// The history is three measurers and three populations: 328 (radius alone —
// diner bar stools are cylinders of radius 0.19), 86 (the auditor), 83 (F, by
// colour). So this does not re-run F's predicate. It brings a SECOND, unrelated
// discriminator and asks whether the two agree:
//
//   AXIS   a tyre is a cylinder lying on its SIDE. A stool, a leg, a bollard,
//          a lamp post is a cylinder standing UP. Nothing about a barstool can
//          make its axis horizontal, so this cannot make F's mistake.
//   SKIN   F's: a tyre carries a MAP, a prop carries a flat colour.
//
// Two filters built on unrelated properties agreeing on the same set is worth
// far more than either number alone — and where they DISAGREE is the only place
// a wrong answer can be hiding.
//
// It also does two things a scene-graph assertion cannot:
//   · a MUTATION — lift a car body and require the check to go red. F's
//     evidence names what would catch it going false and never watched it.
//   · a LOOK. The row's words are "read as ARCHES", and geometry overlapping
//     geometry is not a reading (GOTCHAS §23).
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-tyre-has-arch.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4292/';
const ARGS = flags(['--selftest']);
const SELFTEST = ARGS.selftest;
const OUT = 'shots/K-arch';
mkdirSync(OUT, { recursive: true });

// F's floor, and the auditor's number, bracket the truth. Measured, not
// remembered: anything under this and the absence below passes for free.
const MIN_TYRES = 60;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(700);

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

// THE MUTATION: lift every car body 0.6 m off its wheels, in the live scene,
// before anything is measured. The tyres stay exactly where they are; nothing
// dips down around them any more, which is precisely "no arch". If the verdict
// below survives that, it is not measuring arches.
if (SELFTEST) {
  const lifted = await page.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let n = 0;
    s.traverse((o) => {
      const g = o.geometry;
      if (!g || !g.parameters || !/Box/.test(g.type)) return;
      // a car body: a big box low down and wider than it is tall
      const { width: w = 0, height: h = 0, depth: d = 0 } = g.parameters;
      if (w < 1.2 || d < 2.0 || h > 1.2) return;
      o.position.y += 0.6; n++;
    });
    s.updateMatrixWorld(true);
    return n;
  });
  console.log(`      --selftest: lifted ${lifted} car bodies 0.6 m off their wheels`);
}

const r = await page.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const V = window.__ct.scene().constructor;      // unused, kept for clarity
  const cyl = [];
  s.traverse((o) => {
    const g = o.geometry;
    if (!g || !g.parameters || !/Cylinder/.test(g.type)) return;
    const rad = (g.parameters.radiusTop + g.parameters.radiusBottom) / 2;
    if (!(rad >= 0.18 && rad <= 0.42)) return;
    o.updateWorldMatrix(true, false);
    const m = o.matrixWorld.elements;
    // the cylinder's own +y axis, in world space. |y| near 1 = standing up.
    const ax = [m[4], m[5], m[6]];
    const len = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    const upright = Math.abs(ax[1] / len);
    const mat = o.material;
    const mats = Array.isArray(mat) ? mat : [mat];
    const mapped = mats.some((q) => q && q.map);
    const box = new (Object.getPrototypeOf(o).constructor === Object ? Object : Object)();
    // bounding box in world space
    g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    cyl.push({
      rad, upright, mapped,
      x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2,
      top: bb.max.y, bot: bb.min.y,
      minx: bb.min.x, maxx: bb.max.x, minz: bb.min.z, maxz: bb.max.z,
    });
  });

  // the two populations, both with F's height filter so they are comparable
  const low = (c) => (c.top + c.bot) / 2 < 1.2;
  const byAxis = cyl.filter((c) => low(c) && c.upright < 0.5);
  const bySkin = cyl.filter((c) => low(c) && c.mapped);

  // every solid that could BE an arch: anything that is not one of these
  // cylinders. Collected once, so the per-tyre test is a scan and not a
  // traversal per tyre.
  const solids = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (g.parameters && /Cylinder/.test(g.type)) {
      const rad = (g.parameters.radiusTop + g.parameters.radiusBottom) / 2;
      if (rad >= 0.18 && rad <= 0.42) return;                // that is a tyre
    }
    g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.y > 3) return;                                 // buildings, not bodywork
    solids.push({ minx: bb.min.x, maxx: bb.max.x, minz: bb.min.z, maxz: bb.max.z, bot: bb.min.y, top: bb.max.y });
  });

  // THE PREDICATE, one frame throughout: is there body geometry directly above
  // this tyre whose BOTTOM sits below the tyre's TOP? That is what an arch
  // physically is — the panel dipping down around the wheel.
  const arched = (t) => solids.some((b) =>
    b.maxx > t.minx && b.minx < t.maxx &&
    b.maxz > t.minz && b.minz < t.maxz &&
    b.top > t.top &&                       // it is above, not the road under it
    b.bot < t.top);                        // …and it comes down past the tyre's top

  const bare = byAxis.filter((t) => !arched(t));
  return {
    total: cyl.length,
    axis: byAxis.length, skin: bySkin.length,
    axisNotSkin: byAxis.filter((c) => !c.mapped).length,
    skinNotAxis: bySkin.filter((c) => c.upright >= 0.5).length,
    solids: solids.length,
    archedCount: byAxis.length - bare.length,
    bare: bare.slice(0, 6).map((t) => ({ x: +t.x.toFixed(2), z: +t.z.toFixed(2), top: +t.top.toFixed(3) })),
    bareN: bare.length,
    // A STREET car, not one in the lot: the row is about the fleet the player
    // walks past, and a car parked nose-in behind a fence can only be seen from
    // three-quarters. Nearest tyre to the main road's kerb line.
    example: (() => {
      const street = byAxis.filter((c) => Math.abs(c.x) > 3 && Math.abs(c.x) < 7.5);
      const pick = (street.length ? street : byAxis)
        .slice().sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
      return pick ? { x: +pick.x.toFixed(2), z: +pick.z.toFixed(2), top: +pick.top.toFixed(3) } : null;
    })(),
  };
});

console.log(`      ${r.total} cylinders in the tyre radius band · ${r.solids} candidate solids under 3 m`);

// ── the population, before any absence is asserted ───────────────────────
ok(r.axis >= MIN_TYRES, `AXIS filter (a tyre lies on its side): ${r.axis} tyres — floor ${MIN_TYRES}`);
if (r.axis < MIN_TYRES) { console.log('EMPTY SUBJECT SET'); await browser.close(); process.exit(3); }
console.log(`      SKIN filter (F's — a tyre carries a map): ${r.skin}`);

// THE VERIFICATION THAT MATTERS: two unrelated properties, one set.
ok(Math.abs(r.axis - r.skin) <= 1,
  `the two filters agree to within one (${r.axis} by axis, ${r.skin} by skin)`);
if (r.axisNotSkin || r.skinNotAxis) {
  console.log(`      the difference: ${r.axisNotSkin} lying-down and unmapped, ${r.skinNotAxis} mapped and standing up`);
}

// ── the claim ────────────────────────────────────────────────────────────
ok(r.bareN === 0, `every tyre has body geometry arching over it (${r.archedCount}/${r.axis}, ${r.bareN} bare)`);
if (r.bareN) console.log('      bare at:', JSON.stringify(r.bare));

// ── and it READS as an arch, which a scene graph cannot say ──────────────
//
// The row's own words. Two frames from where a player stands: square on the
// flank of a parked car from the pavement, and low, which is where a wheel arch
// is either present or plainly absent.
if (r.example && !SELFTEST) {
  const { x, z } = r.example;
  // SQUARE ON THE FLANK, from the pavement side, and LOW — a wheel arch is a
  // thing you read from beside the car at about hip height, not from a
  // three-quarter view where the body's own perspective does the arching.
  // Yaw here is the CAMERA convention, forward = (sin y, −cos y): GOTCHAS §33
  // says say which one you mean, because the mesh convention is a z-flip away.
  const stand = await page.evaluate(([tx, tz]) => {
    const sx = tx + (tx < 0 ? -3.0 : 3.0);
    const yaw = Math.atan2(tx - sx, -(tz - tz));
    window.__ct.warp(sx, tz, yaw, window.__ct.groundAt(sx, tz), -0.16);
    return { sx: +sx.toFixed(2), yaw: +yaw.toFixed(3) };
  }, [x, z]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/flank.png` });
  // …and again with the eye AIMED at the arch rather than at the car. Closing
  // in is the wrong instinct and I tried it first: at 2 m a 1.6 m eye is above
  // the bed rail and the arch falls off the bottom of the frame entirely. The
  // fix is not distance, it is PITCH — derived from the geometry rather than
  // guessed, so it frames the thing under test at whatever height it sits.
  await page.evaluate(([tx, tz, ty]) => {
    const sx = tx + (tx < 0 ? -3.2 : 3.2);
    const gy = window.__ct.groundAt(sx, tz);
    const pitch = -Math.atan2((gy + 1.6) - (ty - 0.2), Math.abs(sx - tx));
    window.__ct.warp(sx, tz, Math.atan2(tx - sx, 0), gy, pitch);
  }, [x, z, r.example.top]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/arch-close.png` });
  console.log(`      LOOKED: stood at (${stand.sx}, ${z}) yaw ${stand.yaw}, square on the flank`
    + ` of the tyre at (${x}, ${z}) — ${OUT}/flank.png, and close at 2 m in ${OUT}/arch-close.png`);
}

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
if (SELFTEST) {
  const caught = fails.length > 0;
  console.log(caught ? 'SELFTEST: caught the lifted bodies' : 'SELFTEST: NOT CAUGHT — this check is decoration');
  process.exit(caught ? 0 : 2);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
