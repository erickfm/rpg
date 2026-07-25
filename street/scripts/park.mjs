// feat/park — is the park lit, and are the lamps beside the path?
//
// The auditor's finding was "NOT lit — ZERO light sources; black at night", so
// the first thing this asserts is that there ARE emitters and that the ground
// under them is not black. The second thing matters more for keeping it right:
// the lamp positions are DERIVED from ctx.site('park') using ct/park.ts's own
// offsets, and the park has been re-cut twice — so this checks each lamp
// actually stands beside the loop, and fails loudly if E moves it rather than
// quietly lighting the grass.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/park.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(2, 30));
await page.waitForTimeout(1600);

const r = await page.evaluate(() => {
  const sc = window.__ct.scene();
  // the park's own ground plane tells us the site without trusting a constant
  let site = null;
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (Math.abs(o.position.y - 0.14) > 1e-6 || o.position.x > -8) return;
    if (g.width < 15 || g.height < 15) return;
    site = { minX: o.position.x - g.width / 2, maxX: o.position.x + g.width / 2,
             minZ: o.position.z - g.height / 2, maxZ: o.position.z + g.height / 2 };
  });
  // Park lanterns, found BY TAG. This matched an exact 0.22 x 0.20 x 0.22 lens
  // box and reported ZERO lamps the moment that geometry changed — in a park
  // that had ten of them, with the change being a bug fix to those very lamps.
  // props.ts sets userData.parkLantern, which cannot go stale when a box is
  // resized.
  const lamps = [];
  sc.traverse((o) => {
    if (o.userData?.parkLantern)
      lamps.push([+o.position.x.toFixed(2), +o.position.z.toFixed(2), +o.position.y.toFixed(2)]);
  });
  // how bright is the park ground at 3am? sample the material of its floor
  let floorLum = null;
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (Math.abs(o.position.y - 0.14) > 1e-6 || o.position.x > -8) return;
    if (g.width < 15 || g.height < 15) return;
    const c = o.material.color;
    floorLum = +(0.299 * c.r + 0.587 * c.g + 0.114 * c.b).toFixed(4);
  });
  // additive emitters that actually carry opacity right now
  let lit = 0;
  const emitters = [];
  sc.traverse((o) => {
    if (o.isMesh && o.material?.blending === 2 && o.material.opacity > 0.05 &&
        o.position.x < -8 && o.position.x > -40) {
      lit++; emitters.push([o.position.x, o.position.z]);
    }
  });
  // PER LANTERN, NOT A TOTAL. `lit` is a count over the whole park, and the bar
  // on it was 8 while the world lights 20 — so six lanterns could go black and
  // the remaining four would clear it. This park is the one the auditor found
  // "NOT lit — ZERO light sources" and the user called the shittiest he had
  // seen; a check on it that tolerates most of the lamps failing is not
  // checking the thing that was wrong.
  //
  // Each lantern carries a halo and a ground pool. Pair emitters to lanterns by
  // position and report the WORST-lit lantern, which is the only number that
  // can say "they are all emitting".
  const perLamp = lamps.map(([lx, lz]) =>
    emitters.filter(([ex, ez]) => Math.hypot(ex - lx, ez - lz) < 1.2).length);
  return { site, lamps, floorLum, lit, perLamp, darkest: perLamp.length ? Math.min(...perLamp) : 0 };
});

console.log(`\n  park site: x ${r.site?.minX} … ${r.site?.maxX}, z ${r.site?.minZ} … ${r.site?.maxZ}`);
console.log(`  park lanterns: ${r.lamps.length}`);
console.log(`  additive emitters carrying light inside the park at 3am: ${r.lit}`);
console.log(`  park ground material luminance at 3am: ${r.floorLum}`);

// the loop, by ct/park.ts's own rule
const lx0 = r.site.minX + 3.2, lx1 = r.site.maxX - 0.25 - 1.35;
const lz0 = r.site.minZ + 1.7, lz1 = r.site.maxZ - 1.7;
// distance from a point to the loop rectangle's PERIMETER
const toLoop = (x, z) => {
  const onLeg = (a, b, c) => Math.abs(a - b) <= 0 ? Infinity : 0;
  const dLegs = [
    Math.abs(x - lx0) + Math.max(0, Math.max(lz0 - z, z - lz1)),
    Math.abs(x - lx1) + Math.max(0, Math.max(lz0 - z, z - lz1)),
    Math.abs(z - lz0) + Math.max(0, Math.max(lx0 - x, x - lx1)),
    Math.abs(z - lz1) + Math.max(0, Math.max(lx0 - x, x - lx1)),
  ];
  return Math.min(...dLegs);
};
const offs = r.lamps.map(([x, z]) => +toLoop(x, z).toFixed(2));
const worst = Math.max(...offs);
console.log(`  each lantern's distance from the loop path: ${offs.join(', ')}`);

// TEN, and it is structural rather than a magic number: ct/props.ts builds four
// lanterns per leg on two legs, plus one at each end of the loop "so the corners
// are not the dark bit". That count does not move when E re-cuts the park — the
// legs get longer, not more numerous — so a floor of 8 bought nothing except
// room for the two END lamps to disappear unnoticed, which is exactly the
// failure the comment that placed them was written to prevent.
const okCount = r.lamps.length >= 10;
const okLit = r.lit >= 8;
// whatever lanterns the park has — the count follows E's site cut — every one
// of them must be carrying light, not just enough of them to reach a total
const okEach = r.perLamp.length > 0 && r.darkest >= 1;
const okBeside = worst <= 1.3;             // beside it, not on it and not adrift
const okClear = Math.min(...offs) >= 0.75; // off the 1.5 m path itself
console.log(`\n  ${okCount ? 'OK  ' : 'FAIL'} the park HAS light sources (${r.lamps.length})`);
console.log(`  ${okLit ? 'OK  ' : 'FAIL'} they are emitting at 3am (${r.lit} sheets lit)`);
console.log(`  ${okEach ? 'OK  ' : 'FAIL'} EVERY lantern is carrying light ` +
  `(worst has ${r.darkest} emitter${r.darkest === 1 ? '' : 's'}; per lamp ${r.perLamp.join(',')})`);
console.log(`  ${okBeside ? 'OK  ' : 'FAIL'} every lantern stands beside the loop (worst ${worst} m)`);
console.log(`  ${okClear ? 'OK  ' : 'FAIL'} none stands ON the 1.5 m path (nearest ${Math.min(...offs)} m)`);

// AND WALK PAST THEM. This check knew where the lanterns stand and never once
// tried to get past one, which is not good enough for ten new colliders on a
// path — the project's rule is that anything involving movement is verified by
// walking it, and "0.95 m from the path centre" is arithmetic, not a walk.
//
// It was builder E's own park walk that showed this up: E's instrument walks
// all four legs and mine did not walk any. My own ad-hoc attempt earlier had
// measured distance along z only, so a run that drifted 22 m sideways off the
// leg still counted as a pass. Distance travelled is not the same as getting
// there.
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(700);
await page.mouse.click(500, 310);
const leg = async (label, x, z, yaw, secs, axis, want) => {
  await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [x, z, yaw]);
  await page.waitForTimeout(160);
  const a = await page.evaluate(() => window.__ct.pos());
  await page.keyboard.down('w');
  await page.waitForTimeout((secs - 1.5) * 1000);
  const b2 = await page.evaluate(() => window.__ct.pos());     // 1.5 s from the end
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  const c = await page.evaluate(() => window.__ct.pos());
  const along = Math.abs(axis === 'x' ? c[0] - a[0] : c[2] - a[2]);
  const drift = Math.abs(axis === 'x' ? c[2] - a[2] : c[0] - a[0]);
  const lastBit = Math.hypot(c[0] - b2[0], c[2] - b2[2]);
  // DISTANCE ALONE WAS ONE PEDESTRIAN FROM FLIPPING, and had already flipped.
  // Measured over four runs, the northbound legs came in at 12.7, 16.0, 18.8
  // and 19.6 m against a 16 m line while southbound sat at 25-29 m. The park
  // loop has citizens walking it; one standing in a 1.5 m path stops the
  // player for a few seconds and the distance collapses. That is not a floor
  // defect, which is the only thing this leg is asking about.
  //
  // So ask what bfd0b7ae asked of lotwalk: not how far it got, but whether it
  // was STOPPED. Still moving when the clock ran out means the lane is open
  // and the distance was only ever a time budget. Dead still means blocked.
  const moving = lastBit > 0.8;
  const ok = drift < 1.2 && (along > want || moving);
  const why = ok ? (along > want ? '' : ' (short, but still moving — path open)') : '';
  console.log(`  ${ok ? 'OK  ' : 'STUCK'} ${label}: ${along.toFixed(1)} m along, ${drift.toFixed(2)} m off the leg, ${lastBit.toFixed(2)} m in the last 1.5 s${why}`);
  return ok;
};
console.log('\n  walking the loop past the lanterns:');
let walked = true;
walked = await leg('street leg, south to north', lx1, lz0 + 1.0, Math.PI, 6, 'z', 8) && walked;
walked = await leg('street leg, north to south', lx1, lz1 - 1.0, 0, 6, 'z', 8) && walked;
walked = await leg('back leg, north to south', lx0, lz1 - 1.0, 0, 6, 'z', 8) && walked;
walked = await leg('back leg, south to north', lx0, lz0 + 1.0, Math.PI, 6, 'z', 8) && walked;

// AND KEEP THEM OFF THE GATE ENTRY.
//
// E's park quality pass found "the gate lamp stands on the entry centreline"
// and generously took it as theirs rather than mine. Measured: it is not one of
// mine — my nearest lantern is 3.3 m from the centreline and no collider
// crosses it at all. But the park has been re-cut twice, my lanterns are placed
// by formula off ctx.site('park'), and a third re-cut could walk one straight
// into the entry without anything noticing. So the check asserts it now.
//
// The entry is found rather than assumed: it is the narrow path quad that
// reaches the street edge at site.maxX.
const entry = await page.evaluate((maxX) => {
  const sc = window.__ct.scene();
  let best = null;
  sc.traverse((o) => {
    const g = o.geometry?.parameters;
    if (!o.isMesh || !g || o.geometry.type !== 'PlaneGeometry') return;
    if (Math.abs(o.position.y - 0.1445) > 0.02) return;
    if (!g.width || !g.height || g.width > 4 || g.height > 4) return;
    // THE MOST STREET-WARD PATH SLAB, not "one touching the street edge".
    // 1da5e891 brought the loop in off the boundary and turned its corners, so
    // the entry stopped touching maxX and this went blind — it refused to
    // answer rather than passing, which is the only reason the change was
    // visible at all, but a detector keyed to a boundary the design has moved
    // away from is a remembered coordinate wearing a filter.
    //
    // Derive it: whichever path piece reaches furthest toward the street IS the
    // way in, wherever the loop sits. That survives the park being re-cut,
    // which it has been three times.
    const reach = o.position.x + g.width / 2;
    if (!best || reach > best.reach) best = { z: o.position.z, d: g.height, x: o.position.x, reach };
  });
  return best;
}, r.site.maxX);
if (!entry) {
  console.error('\n  FAIL could not find the gate entry path — this check cannot answer');
  process.exitCode = 1;
} else {
  const clear = r.lamps.map(([x, z]) => +Math.abs(z - entry.z).toFixed(2));
  const nearest = Math.min(...clear);
  const ok = nearest > entry.d / 2 + 0.6;
  console.log(`\n  gate entry at z ${entry.z.toFixed(2)}, ${entry.d.toFixed(2)} m wide`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} no lantern stands on the entry (nearest is ${nearest} m off its centreline)`);
  if (!ok) process.exitCode = 1;
}

const shot = async (n, x, z, tx, tz, gy, p2) => {
  await page.evaluate(([x, z, tx, tz, gy, p2]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p2), [x, z, tx, tz, gy, p2]);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `shots/pk-${n}.png` });
};
await shot('path-night', lx1, lz0 + 1.5, lx1, lz1, 0.14, -0.02);
await shot('gate-night', r.site.maxX + 1.0, (lz0 + lz1) / 2, lx0, (lz0 + lz1) / 2, 0.14, -0.02);
await shot('across-night', lx0 + 2, lz0 + 2, lx1, lz1, 0.14, 0.0);
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(900);
await shot('path-day', lx1, lz0 + 1.5, lx1, lz1, 0.14, -0.02);

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (!okCount || !okLit || !okEach || !okBeside || !okClear || !walked) process.exit(1);
console.log('\nno page errors');
