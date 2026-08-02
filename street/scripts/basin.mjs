// feat/basin — the catch basin, from where a player stands.
//
// The old one was two flat planes and the user's read was "what is this it
// looks bad". Everything that makes a casting read — the frame flange, the
// rebate the grate drops into, the slots being holes rather than paint, the
// throat under the kerb — is an EDGE, so this looks at it from the angles that
// show edges: standing over it, walking past it, and down the gutter line.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/basin.mjs [shots|probe|wet|all]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { modes } from './lib/modes.mjs';

const mode = modes('basin', ['probe', 'shots', 'wet', 'all']);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(600);

const shot = async (n, x, z, tx, tz, gy, p) => {
  await page.evaluate(([x, z, tx, tz, gy, p]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, gy, p]);
  await page.waitForTimeout(340);
  await page.screenshot({ path: `shots/bs-${n}.png` });
};

// BOTH BASINS. This probed the east one only, at (4.7, -92.5), and graded the
// catch basin DONE on it. There are two: ct/tex-ground.ts:876-877 builds
// basin(ROAD_HALF, -92.5, 1) and basin(-ROAD_HALF, -105, -1), and `side` flips
// the sign on every proud face — fx = kx - side * PROUD. A sign error would
// appear on the west one and nowhere else, and nothing was looking at it.
//
// Same shape as be83f55a's wheel arches: a verdict I reported confidently,
// which covered exactly the instance I had in front of me. Trying to widen a
// check is a good way to find out how narrow the hand verdict was.
const BASINS = [{ name: 'east', x: 4.7, z: -92.5, side: 1 },
                { name: 'west', x: -4.7, z: -105, side: -1 }];
if (mode === 'probe' || mode === 'all') {
 for (const B of BASINS) {
  const r = await page.evaluate((B) => {
    const sc = window.__ct.scene();
    const near = [];
    sc.traverse((o) => {
      if (!o.isMesh) return;
      if (Math.hypot(o.position.x - B.x, o.position.z - B.z) > 1.2) return;
      const g = o.geometry?.parameters ?? {};
      near.push({ y: +o.position.y.toFixed(4), h: g.height,
        top: g.height ? +(o.position.y + g.height / 2).toFixed(4) : null,
        kind: o.geometry?.type,
        part: o.userData.basinPart ?? null, side: o.userData.basinSide ?? null,
        // road-most face, SIGNED by which kerb this is: on the west side the
        // road is to the +x of the casting, so "reaches out of the kerb" is the
        // other direction. Without this the west basin reads inside out.
        outer: g.width ? +(B.side * (o.position.x - B.side * Math.abs(g.width) / 2)).toFixed(4) : null });
    });
    return near;
  }, B);
  const boxes = r.filter((m) => m.kind === 'BoxGeometry');
  const tops = boxes.map((b) => b.top).filter((t) => t !== null);
  const frameTop = Math.max(...tops.filter((t) => t < 0.06));
  // the bars must sit BELOW the frame — that step is the whole read
  const barTops = tops.filter((t) => t < frameTop - 0.0005 && t > 0.01);
  console.log(`\n  ${B.name} basin: ${r.length} meshes (${boxes.length} solid)`);
  console.log(`  frame top      ${frameTop.toFixed(4)} m`);
  console.log(`  grate bar top  ${barTops.length ? Math.max(...barTops).toFixed(4) : 'none'} m`);
  const rebate = barTops.length ? frameTop - Math.max(...barTops) : 0;
  console.log(`  rebate         ${(rebate * 1000).toFixed(1)} mm`);
  console.log(`\n  ${boxes.length >= 15 ? 'OK  ' : 'FAIL'} the casting is geometry, not a decal (${boxes.length} solids)`);
  console.log(`  ${rebate > 0.005 ? 'OK  ' : 'FAIL'} the grate is SUNK into the frame, not flush with it`);

  // THE THROAT WAS ONLY EVER PHOTOGRAPHED. canfail.mjs broke PROUD to -0.02 —
  // the surround buried behind the kerb face instead of standing out of it —
  // and this script passed, because it took two pictures of the throat and
  // measured none of it. That is the house rule failing inside my own check:
  // screenshots are for LOOKING, never for PROVING.
  //
  // The surround must reach FURTHER out of the kerb than the opening it
  // frames, which is what casts the shadow line that makes a drain read as a
  // drain. Signed, so a buried frame goes negative rather than merely small.
  const frame = r.filter((m) => m.part === 'frame' && m.outer !== null);
  const mouth = r.filter((m) => m.part === 'throat' && m.outer !== null);
  let proud = null;
  if (frame.length && mouth.length) {
    proud = Math.min(...mouth.map((m) => m.outer)) - Math.min(...frame.map((m) => m.outer));
    console.log(`  throat proud   ${(proud * 1000).toFixed(1)} mm  (${frame.length} frame solids)`);
  }
  // Upper bound is not decoration: a lintel 22 mm proud hid the whole 66 mm
  // opening at the 20 degrees people actually stand at, which is why PROUD is
  // 7 mm and not more. Both ends of the range are a real failure.
  const proudOK = proud !== null && proud > 0.002 && proud < 0.022;
  console.log(`  ${proudOK ? 'OK  ' : 'FAIL'} the surround stands PROUD of the throat, and not so far it hides it`);
  if (boxes.length < 15 || rebate <= 0.005 || !proudOK) process.exitCode = 1;
 }
 if (process.exitCode) process.exit(1);
}

// NOTE on the 4th argument: warp's `gy` is the GROUND height under the
// camera, not the eye height — the eye rides about 1.6 m above it. So a shot
// on the walk passes 0.14 (the kerb reveal) and a shot in the road passes 0.
// Getting this wrong puts the camera three metres up and quietly turns every
// judgement into a top-down one, which is the exact mistake the trash rig
// failed on.
const WALK = 0.14, ROAD = 0;

if (mode === 'shots' || mode === 'all') {
  // standing over it on the walk, looking down — the angle the user shot from
  await shot('over', 5.9, -91.4, 4.7, -92.6, WALK, -0.62);
  // walking past on the walk, the angle you actually pass it at
  await shot('walkby', 5.7, -89.4, 5.2, -93.4, WALK, -0.34);
  // down the gutter line, so the throat under the kerb is side-on
  await shot('gutter', 4.5, -88.2, 4.8, -93.2, ROAD, -0.30);
  // from the road, square to the kerb face — the throat's own view, and close,
  // because a 7 cm opening in a 13 cm kerb is a real detail at a real size
  await shot('throat', 3.4, -92.5, 5.0, -92.5, ROAD, -0.40);
  await shot('throat-near', 4.15, -92.2, 5.0, -92.5, ROAD, -0.52);
}

if (mode === 'wet' || mode === 'all') {
  // The world's rain predicate, duplicated here because scripts cannot import
  // ASK THE WORLD FOR ITS OWN SCHEDULE. This carried a hand-copy of rainAt under
  // a comment claiming "scripts cannot import from the TS module" — true when it
  // was written, false since props began publishing the function. 04013742
  // found it: the FOURTH stale copy of a formula that was rewritten in
  // e0c68e46, disagreeing with the world on 16 of 48 hours and passing only
  // because hour 0 happens to be rainy under both.
  //
  // A predicate that is wrong on a third of the schedule and right on the hour
  // you happen to pick is not a predicate, it is a coincidence with a comment.
  const SCHEDULE = await page.evaluate(() => {
    const f = window.__ct.scene().userData.rainAt;
    return typeof f === 'function' ? Array.from({ length: 48 }, (_, h) => !!f(h)) : null;
  });
  if (!SCHEDULE) { console.error('\n  FAIL props did not publish scene.userData.rainAt'); process.exit(1); }
  let wetH = 0; for (let h = 0; h < 48; h++) if (SCHEDULE[h]) { wetH = h; break; }
  await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
  // 16 s, not 7. 013fd008 measured the wet look settling over ~16 s — the road
  // goes 1.000 -> 0.597 -> 0.329 -> 0.224 -> 0.186 -> 0.172 -> 0.167 -> 0.165 at
  // two-second intervals — so a shot at 7 s is of a street still darkening. The
  // whole point of these two frames is what wet looks like.
  await page.waitForTimeout(16000);
  await shot('wet-over', 5.9, -91.4, 4.7, -92.6, 1.62, -0.62);
  await shot('wet-gutter', 4.4, -87.6, 4.7, -93.2, 1.20, -0.26);
  console.log('shots -> shots/bs-*.png');
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
