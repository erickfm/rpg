// VERIFYING O's JAIL ROW — six stations, in the order a player meets them.
// Not my building. LOOKS ONLY: it writes the frames the row asks to be judged
// on and prints the station under each, so a finding can name where it stood.
//
// O's own `O-jail-walk.mjs all` answers the measurable half and is green with a
// selftest that goes red. What it cannot answer is the half the row itself puts
// in capitals — IS THE SERGEANT LOOKING AT YOU OR PAST YOU, and do BOTH cell
// runs read the same (GOTCHAS 41: one function taking `side`, and the mirror is
// where the bug hides). Those are looking questions.
//
//   SHOT_URL=http://localhost:4182/ node scripts/E-verify-jail.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4182/');
const OUT = 'shots/E-verify-jail';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));

// where IS the interior? Ask, do not remember — the row says the module takes
// every coordinate from `ctx.site('jail')`, and the interior sits out on the
// slab belt at x >= 400 rather than under the facade.
const dims = await page.evaluate(() => {
  const all = window.__ct.roomDims();
  const out = {};
  for (const [k, v] of Object.entries(all)) if (/jail|cell|police/i.test(k)) out[k] = v;
  return { matched: out, allIds: Object.keys(all) };
});
console.log('rooms matching jail/cell/police:', JSON.stringify(dims.matched));
if (!Object.keys(dims.matched).length) console.log('   (none matched; ids are:', dims.allIds.join(', '), ')');

const shoot = async (k, x, z, yaw, gy, pitch, what) => {
  await page.evaluate(([x, z, yaw, gy, p]) => window.__ct.warp(x, z, yaw, gy, p), [x, z, yaw, gy, pitch]);
  await page.waitForTimeout(800);
  const png = await page.screenshot({ path: `${OUT}/${k}.png` });
  // measure the PNG, never the live canvas — a WebGL backbuffer is empty to
  // drawImage by design, which is how H nearly filed a working fade as broken
  const n = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const g = document.createElement('canvas'); g.width = 100; g.height = 50;
    const c = g.getContext('2d');
    c.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.78), 0, 0, 100, 50);
    const d = c.getImageData(0, 0, 100, 50).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
    return seen.size;
  }, png.toString('base64'));
  console.log(`  ${OUT}/${k}.png  (${n} colours)  station (${x}, ${z}) — ${what}`);
  return n;
};

console.log('\n── outside, on the side street ──');
await shoot('1-street-east', 40, -103.0, Math.PI / 2, 0.14, 0.10,
  'anywhere in the side street facing east: does the building close the street');
await shoot('2-foot-lookup', 55.6, -103.0, Math.PI / 2, 0.14, 0.45,
  'on the pavement at its foot, looking up at the barred windows');
await shoot('3-at-the-door', 55.9, -100.8, Math.PI / 2, 0.14, 0.05,
  'at the door — the [E] should be live here');

// ── inside, ENTERED THE WAY A PLAYER ENTERS ──────────────────────────────
//
// The first cut of this guessed the interior coordinates off O's walk log
// (x 1000, ~22 m of room) and photographed a blank wall from inside the
// geometry. Guessing where you are standing is how you grade the wrong
// building — I did exactly that to a church earlier today.
//
// So: stand at the door, hold [E], and ASK where that put me. Then sweep the
// four cardinal facings from the real position and let the frames say what is
// there. The key is HELD because the dispatch is edge-triggered inside the
// frame loop and a press() can fall between two frames.
console.log('\n── inside, entered through the door ──');
// STAND ON THE SPOT, do not stand where I guessed the door was. My first cut
// warped to (55.9, -100.8) and pressed [E] into thin air: the spot's radius is
// 1.05 m and I was 2.23 m off it, so nothing was in reach and the run was about
// to report the door dead. Ask the world where the trigger is and go there.
const spot = await page.evaluate(() => {
  const s = window.__ct.spots().find((s) => /DETENTION/i.test(s.label ?? ''));
  return s ? { x: s.x, z: s.z, r: s.r, label: s.label } : null;
});
if (!spot) {
  console.log('\nEXIT 3: no HOUSE OF DETENTION spot is registered at all — nothing to press.');
  await b.close();
  process.exit(3);
}
console.log(`   the door's trigger: "${spot.label}" at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) r=${spot.r}`);
await page.evaluate(([x, z]) => window.__ct.warp(x - 0.6, z, Math.PI / 2, 0.14, 0), [spot.x, spot.z]);
await page.waitForTimeout(600);
const d = await page.evaluate(([x, z]) => {
  const p = window.__ct.pos();
  return +Math.hypot(x - p[0], z - p[2]).toFixed(2);
}, [spot.x, spot.z]);
console.log(`   standing ${d} m from it, inside r=${spot.r}`);
await page.keyboard.press('e');
// WAIT FOR THE TRANSITION, not for a fixed timeout. O's own file explains why
// and it cost four false reds to learn: a door is driven by the render loop,
// and on a machine running the rest of the suite a frame can exceed a second.
// My first cut waited 900 ms and reported the interior unreachable on a door
// that works — the same false red, one file over.
const crossed = await page.evaluate(() => new Promise((res) => {
  const t0 = performance.now();
  const tick = () => {
    if (window.__ct.pos()[0] > 400) return res(true);
    if (performance.now() - t0 > 25000) return res(false);
    requestAnimationFrame(tick);
  };
  tick();
}));
const inside = await page.evaluate(() => window.__ct.pos());
if (!crossed) {
  console.log(`\nEXIT 3: [E] at the door did not cross within 25 s — still at x ${inside[0].toFixed(1)}.`);
  console.log('A busy machine or a dead door; either way nothing below measures the room.');
  await b.close();
  process.exit(3);
}
const [ix, , iz] = inside;
console.log(`   [E] landed me at (${ix.toFixed(2)}, ${iz.toFixed(2)}) — the lobby`);

const FACES = [['n', 0], ['e', Math.PI / 2], ['s', Math.PI], ['w', -Math.PI / 2]];
for (const [tag, yaw] of FACES) {
  await shoot(`4-lobby-${tag}`, ix, iz, yaw, inside[3], 0.05,
    `the lobby from where the door put me, facing ${tag} — the counter and the desk sergeant`);
}
// deeper in: the corridor and the cells. Stepped along the room's long axis
// from the real landing rather than from a remembered number.
for (const d of [6, 12, 18]) {
  await shoot(`5-in-${d}m`, ix, iz - d, Math.PI, inside[3], 0.0,
    `${d} m down the room from the door — gate, then the corridor with bars both sides`);
}
// GOTCHAS 41: both cell runs come from one function taking `side`, and the
// mirror is where the bug hides. Shoot BOTH from the same standing point.
await shoot('6a-cells-left', ix, iz - 18, -Math.PI / 2, inside[3], 0.0,
  'the cells through the bars, LEFT run');
await shoot('6b-cells-right', ix, iz - 18, Math.PI / 2, inside[3], 0.0,
  'the cells through the bars, RIGHT run — the mirror');

// ── IS THE SERGEANT LOOKING AT YOU, OR DOES HE ONLY EVER LOOK AT YOU? ─────
//
// The row puts this in capitals and it is the one question a single frame
// cannot answer. Citizen sprites in this world are 8-sector, and THE PAINTED
// SECTOR IS CHOSEN RELATIVE TO THE VIEWER — so a figure that turns to face
// the camera does so by construction, and "he is looking at me" is vacuous
// unless the sector is fixed.
//
// The test is two viewpoints, not one. Approach the counter from well left and
// well right, both aimed at the same spot on it. If the painted face is frontal
// from BOTH, the sector is following me and the row's claim is about the
// renderer rather than about the sergeant. If one of them shows a profile, he
// has a real facing and it can be judged.
console.log('\n── the sergeant, from two sides (8-sector sprites face the viewer) ──');
for (const [tag, dx] of [['left', -3.2], ['right', 3.2]]) {
  // aim both cameras at the same point on the counter, so only the viewpoint differs
  const tx = ix, tz = iz - 4.4;
  const px = ix + dx, pz = iz;
  const yaw = Math.atan2(tx - px, -(tz - pz));   // PLAYER yaw: forward is (sin t, -cos t)
  await shoot(`7-sergeant-from-${tag}`, px, pz, yaw, inside[3], 0.02,
    `the counter from ${Math.abs(dx)} m ${tag} of centre, aimed at the same point`);
}

// ── "one man in one of them" ─────────────────────────────────────────────
// Eight cells, four a side. One frame of one cell cannot support or refute a
// claim about the run, and an absence found by looking at two of eight is not
// an absence (GOTCHAS 34). Walk the corridor and look into BOTH runs at each
// step, so the claim is judged against the whole row of cells.
console.log('\n── the cells, both runs, along the whole corridor ──');
for (const d of [14, 17, 20, 23]) {
  await shoot(`8-cells-${d}m-left`, ix, iz - d, -Math.PI / 2, inside[3], 0.0,
    `${d} m in, LEFT run`);
  await shoot(`8-cells-${d}m-right`, ix, iz - d, Math.PI / 2, inside[3], 0.0,
    `${d} m in, RIGHT run`);
}

console.log('\nLOOKS ONLY — asserts nothing. Judge these by eye and name the station.');
await b.close();
