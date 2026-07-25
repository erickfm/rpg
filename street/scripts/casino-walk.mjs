// Walk GOLDEN ACES. Same shape as scripts/diner-walk.mjs and for the same
// reason: a screenshot proves nothing here (GOTCHAS §1) and floors and
// collision least of all (§7), so this drives the real rig — stands on the
// side-street walk, presses E, and then walks the room until something stops
// it.
//
// The casino's own risks, over and above the diner's: it has NO window, so the
// front wall must come back solid; its lanes are set by three colliders that
// nearly meet (two slot banks and the felt table); and its ceiling is low
// enough that the mirrored panels have to be above the eye, not through it.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4186/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
const warns = [];
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(260); };
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(120); };

const results = [];
const check = (name, ok, detail) => { results.push([ok, name, detail]); };
const f2 = (n) => +n.toFixed(2);

// the room, as specified in ct/int-casino.ts
const W = 10.5, D = 9.0, H = 2.5, RADIUS = 0.36;
const hw = W / 2, hd = D / 2;
const DOOR_X = 51.29, WALK_Z = -97.0, KERB_H = 0.14, DOOR_AT = -3.2;

// ── 1. the way in ────────────────────────────────────────────────────────
// Walk INTO the approach rather than warping onto the spot: warp does no
// collision resolution, so warping onto a trigger proves only that the number
// was typed correctly (GOTCHAS §8).
await warp(DOOR_X, WALK_Z - 0.9, Math.PI, KERB_H);
await p.waitForTimeout(200);
await hold('w', 900);
const onWalk = await pos();
const promptOut = await prompt();
check('walking up to the casino door raises the prompt',
  /GOLDEN ACES/.test(promptOut ?? ''), `pos=${onWalk.slice(0, 3).map(f2)} prompt=${JSON.stringify(promptOut)}`);

await press();
const inside = await pos();
check('E puts you inside an interior slab (x ≥ 400)', inside[0] >= 400, `pos=${inside.slice(0, 3).map(f2)}`);
const CX = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;

const beforeF = await pos();
await hold('w', 260);
const afterF = await pos();
check('you spawn facing INTO the room, not at the door you came through',
  afterF[2] < beforeF[2] - 0.05, `walking forward moved z ${f2(beforeF[2])} → ${f2(afterF[2])}`);

// ── 2. the floor ─────────────────────────────────────────────────────────
const gyIn = (await pos())[3];
check('floor height inside is 0 (not sunk, not floating)', Math.abs(gyIn) < 0.001, `gy=${gyIn}`);
const floorY = await p.evaluate((cx) => {
  let best = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > 0.2 || Math.abs(wp.z) > 0.2) return;
    if (Math.abs(o.rotation.x + Math.PI / 2) > 0.01) return;   // faces up
    if (best === null || wp.y < best) best = wp.y;
  });
  return best;
}, CX);
check('the floor mesh is where the rig thinks the floor is',
  floorY !== null && Math.abs(floorY - gyIn) < 0.03,
  `floor mesh y=${floorY === null ? 'not found' : f2(floorY)}, rig gy=${gyIn}`);

// The low ceiling has to be ABOVE the eye, or you are standing inside the
// mirrors. Read the eye off the rig itself — `__ct.pos()` returns the rig's y
// — rather than hunting the camera in the scene graph, where it is not a child
// and never turns up.
const eye = (await pos())[1];
check('the 2.5 m ceiling clears the 1.62 m eye',
  eye > 0.5 && eye < H - 0.3, `eye y=${f2(eye)}, ceiling ${H}`);

// ── 3. the walls hold, and the windowless front wall is solid ────────────
const RUN = 2600;
const probe = async (lx, lz, key, axis, limit, sign, note) => {
  const yaw = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': Math.PI, '-z': 0 }[key];
  await warp(CX + lx, lz, yaw, 0);
  await p.waitForTimeout(150);
  const a0 = await pos();
  await hold('w', RUN);
  const a = await pos();
  const moved = Math.hypot(a[0] - a0[0], a[2] - a0[2]);
  const v = axis === 'x' ? a[0] - CX : a[2];
  const escaped = sign > 0 ? v > limit : v < -limit;
  // A probe that never moved has not tested anything — it started inside a
  // collider's pad, where the rig cannot move in ANY direction and reports the
  // wall as holding. F hit this on the diner; fail it loudly instead.
  check(`wall holds walking ${key}${note ? ' — ' + note : ''}`, !escaped && moved > 0.3,
    moved <= 0.3 ? `HARNESS: never left the start point (stuck in furniture at local ${f2(lx)},${f2(lz)})`
      : `walked ${f2(moved)} m, stopped at local ${axis}=${f2(v)} (wall at ${sign > 0 ? '' : '-'}${limit})`);
};
// the front strip, z = 3.0, is clear right across the room
await probe(0, 3.0, '-x', 'x', hw - RADIUS + 0.02, -1);
await probe(0, 3.0, '+x', 'x', hw - RADIUS + 0.02, 1);
await probe(0, 3.0, '+z', 'z', hd - RADIUS + 0.02, 1, 'the windowless front wall');
// the back wall, approached west of the cage
await probe(-3.0, -3.0, '-z', 'z', hd - RADIUS + 0.02, -1);

// the doorway is the one gap in the collider line — the one place a room leaks
await warp(CX + DOOR_AT, 3.0, Math.PI, 0);
await p.waitForTimeout(150);
await hold('w', RUN);
const doorRun = await pos();
check('you cannot walk out through the doorway onto dead ground',
  doorRun[2] < hd + 0.4, `walking at the door reached z=${f2(doorRun[2])} (front wall at ${hd})`);

// ── 4. the lanes ─────────────────────────────────────────────────────────
// Three colliders set every lane in this room: two slot banks and the table.
// Each of these is a route the player will actually take.
const lane = async (name, lx, lz, yaw, ms, axis, want) => {
  await warp(CX + lx, lz, yaw, 0);
  await p.waitForTimeout(150);
  const a = await pos();
  await hold('w', ms);
  const c = await pos();
  const d = axis === 'x' ? Math.abs(c[0] - a[0]) : Math.abs(c[2] - a[2]);
  check(name, d > want, `travelled ${f2(d)} m (want > ${want})`);
};
// the aisle between the two slot banks, both ways
await lane('the aisle between the slot banks, walking east', -4.2, -0.35, Math.PI / 2, 2200, 'x', 4.6);
await lane('…and back west', 0.9, -0.35, -Math.PI / 2, 2200, 'x', 4.6);
// the corridor between the east end of the banks and the felt table
await lane('the gap between the banks and the felt table', 1.5, 3.0, 0, 2200, 'z', 3.0);
// the aisle in front of the cage
await lane('the aisle in front of the cage', -4.2, -3.0, Math.PI / 2, 2200, 'x', 4.6);
// past the felt table on the wall side
await lane('past the felt table on the east wall side', 4.6, 3.0, 0, 2200, 'z', 3.0);

// The door approach from inside. Start in the front strip (z > 1.91), which is
// the only part of the room clear of the slot banks at the door's x — starting
// at z = 1.0 puts the probe inside bank B's collider pad, where the rig cannot
// move at all and the test silently passes nothing.
await warp(CX + DOOR_AT, 2.4, Math.PI, 0);
await p.waitForTimeout(150);
await hold('w', 1400);
const atDoor = await pos();
const dPrompt = await prompt();
check('walking to the inside of the door raises the way-out prompt',
  /out to the street/.test(dPrompt ?? ''), `pos=${atDoor.slice(0, 3).map(f2)} prompt=${JSON.stringify(dPrompt)}`);

// ── 5. the way out, and NOT straight back in ─────────────────────────────
await press();
const back = await pos();
check('E at the inside door puts you back on the street', back[0] < 100, `pos=${back.slice(0, 3).map(f2)}`);
check('you land on the raised walk, not in the road', Math.abs(back[3] - KERB_H) < 0.001, `gy=${back[3]}`);
const afterPrompt = await prompt();
check('you are NOT standing in the re-entry trigger after stepping out',
  !/GOLDEN ACES/.test(afterPrompt ?? ''), `prompt=${JSON.stringify(afterPrompt)}`);
await press();
const sucked = await pos();
check('a second E on the landing does not suck you straight back in',
  sucked[0] < 100, `pos=${sucked.slice(0, 3).map(f2)}`);

for (const [k, yaw] of [['out across the side street', 0], ['east along the walk', Math.PI / 2], ['west along the walk', -Math.PI / 2]]) {
  await warp(back[0], back[2], yaw, KERB_H);
  await p.waitForTimeout(120);
  const a = await pos();
  await hold('w', 500);
  const c = await pos();
  const d = Math.hypot(c[0] - a[0], c[2] - a[2]);
  check(`the landing is not boxed in — ${k}`, d > 0.9, `moved ${f2(d)} m`);
}

// ── 6. the room keeps its light after dark ───────────────────────────────
const sample = () => p.evaluate((cx) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > 7 || Math.abs(wp.z) > 7) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && m.color && !m.transparent) out.push(m.color.getHex());
  });
  return out;
}, CX);
await p.evaluate(() => window.__ct.clock(12, 0));
await p.waitForTimeout(500);
const noon = await sample();
await p.evaluate(() => window.__ct.clock(2, 0));
await p.waitForTimeout(900);
const night = await sample();
const dimmed = noon.filter((c, i) => night[i] !== undefined && night[i] !== c).length;
check('the casino keeps its own light after dark — no daylight, no hour',
  dimmed === 0, `${dimmed}/${noon.length} interior materials were dimmed by the night sweep`);

// the kit warns on console about openings that do not fit and exits that land
// inside their own trigger. Both are silent bugs otherwise.
const kitWarns = warns.filter((w) => /\[interior:casino\]/.test(w));
check('the kit raised no warnings about this room', kitWarns.length === 0,
  kitWarns.length ? kitWarns.join(' | ') : 'none');

// ── report ───────────────────────────────────────────────────────────────
console.log('');
for (const [ok, name, detail] of results) console.log(`${ok ? ' ok ' : 'FAIL'}  ${name}\n        ${detail}`);
const bad = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await b.close();
process.exit(bad ? 1 : 0);
