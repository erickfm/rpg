// Walk the DINER. Interiors cannot be verified from a screenshot (GOTCHAS §1)
// and floors/collision least of all (§7), so this drives the real rig: it
// stands on the street, presses E, and then walks the room until something
// stops it.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4185/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const camY = () => p.evaluate(() => window.__ct.scene().getObjectByProperty('isCamera', true)?.position.y ?? null);
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(260); };
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(120); };

const results = [];
const check = (name, ok, detail) => { results.push([ok, name, detail]); };
const f2 = (n) => +n.toFixed(2);

// ── 1. the way in ────────────────────────────────────────────────────────
const FACE = 7.0, DZ = 9.6, KERB_H = 0.14;
await warp(-(FACE - 0.45), DZ, Math.PI / 2, KERB_H);
await p.waitForTimeout(250);
const promptOut = await prompt();
check('prompt appears on the west walk at the diner door', /DINER/.test(promptOut ?? ''), `prompt=${JSON.stringify(promptOut)}`);

await press();
const inside = await pos();
check('E puts you inside the diner slab (400 ≤ x < 480)', inside[0] >= 400 && inside[0] < 480, `pos=${inside.slice(0, 3).map(f2)}`);

// Which way are you looking? Asked the rig-truthful way — walk forward and see
// which way z moves. The room's front wall is at +z, so facing into the room
// means forward takes you toward -z.
const beforeF = await pos();
await hold('w', 260);
const afterF = await pos();
check('you spawn facing INTO the room, not at the wall you came through',
  afterF[2] < beforeF[2] - 0.05, `walking forward moved z ${f2(beforeF[2])} → ${f2(afterF[2])}`);

// ── 2. the floor ─────────────────────────────────────────────────────────
const gyIn = (await pos())[3];
check('floor height inside is 0 (not sunk, not floating)', Math.abs(gyIn) < 0.001, `gy=${gyIn}`);
// gy is what the rig stands ON; prove the floor MESH agrees with it, or you
// stand on an invisible plane a few centimetres off the lino.
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
}, 440);
check('the floor mesh is where the rig thinks the floor is',
  floorY !== null && Math.abs(floorY - gyIn) < 0.03, `floor mesh y=${floorY === null ? 'not found' : f2(floorY)}, rig gy=${gyIn}`);

// ── 3. the walls hold ────────────────────────────────────────────────────
// Room is 8.6 × 7.0 centred in its slab; walls + 0.36 capsule mean the player
// should never get past ±(4.3 - 0.36) in x or ±(3.5 - 0.36) in z.
const CX = inside[0] >= 400 ? Math.floor((inside[0] - 400) / 80) * 80 + 440 : 440;
const RUN = 2600;
// Every probe starts from a spot that is genuinely CLEAR of furniture. Start
// inside a collider's 0.36 m pad and the rig cannot move in any direction at
// all, and the probe reports "the wall held" having never taken a step.
const probe = async (lx, lz, key, axis, limit, sign) => {
  const yaw = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': Math.PI, '-z': 0 }[key];
  await warp(CX + lx, lz, yaw, 0);
  await p.waitForTimeout(150);
  const a0 = await pos();
  await hold('w', RUN);
  const a = await pos();
  const moved = Math.hypot(a[0] - a0[0], a[2] - a0[2]);
  const v = axis === 'x' ? a[0] - CX : a[2];
  const escaped = sign > 0 ? v > limit : v < -limit;
  check(`wall holds walking ${key}`, !escaped && moved > 0.3,
    moved <= 0.3 ? `HARNESS: never left the start point (stuck in furniture at local ${f2(lx)},${f2(lz)})`
      : `walked ${f2(moved)} m, stopped at local ${axis}=${f2(v)} (wall at ${sign > 0 ? '' : '-'}${limit})`);
};
// the clear lane between the counter stools and the booths, at local z = -0.35
await probe(0, -0.35, '-x', 'x', 3.95, -1);
await probe(0, -0.35, '+x', 'x', 3.95, 1);
// the back wall is behind the counter, so approach it outside the counter's run
await probe(3.8, -0.35, '-z', 'z', 3.15, -1);
// the front wall, at an x that is solid wall rather than doorway
await probe(-3.0, -0.35, '+z', 'z', 3.15, 1);

// the doorway itself: door is at local x = -2.6. Walk at it head-on. This is
// the one opening in the collider line, so it is the one place the room could
// leak — out the front and into the dead ground between slabs.
await warp(CX - 2.6, -0.35, Math.PI, 0);
await p.waitForTimeout(150);
await hold('w', RUN);
const doorRun = await pos();
check('you cannot walk out through the doorway onto dead ground',
  doorRun[2] < 3.9, `walking at the door reached z=${f2(doorRun[2])} (front wall is at 3.5)`);

// ── 4. the lane between the stools and the booths ────────────────────────
// counter at local z = -2.0, stools at -1.0; booths start about z = +0.24.
// Walk the full width of the room down that lane without snagging.
await warp(CX - 3.6, -0.35, Math.PI / 2, 0);
await p.waitForTimeout(150);
const laneA = await pos();
await hold('w', 2400);
const laneB = await pos();
check('you can walk the lane between the stools and the booths',
  laneB[0] - laneA[0] > 6.0, `travelled ${f2(laneB[0] - laneA[0])} m along the lane (want > 6.0)`);

// and back, to prove it is not a one-way squeeze
await warp(CX + 3.6, -0.35, -Math.PI / 2, 0);
await p.waitForTimeout(150);
const backA = await pos();
await hold('w', 2400);
const backB = await pos();
check('…and back the other way', backA[0] - backB[0] > 6.0, `travelled ${f2(backA[0] - backB[0])} m`);

// the door approach from inside: stand in the lane, walk to the door spot
await warp(CX - 2.6, -0.35, Math.PI, 0);
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
  !/DINER/.test(afterPrompt ?? ''), `prompt=${JSON.stringify(afterPrompt)}`);
// the harder version of the same question: press E again and see if it sucks
// you back inside without you having moved
await press();
const sucked = await pos();
check('a second E on the landing does not suck you straight back in',
  sucked[0] < 100, `pos=${sucked.slice(0, 3).map(f2)}`);

// can you walk away from the landing in every direction?
for (const [k, yaw] of [['out to the road', Math.PI / 2], ['along the walk', 0], ['back down the walk', Math.PI]]) {
  await warp(back[0], back[2], yaw, KERB_H);
  await p.waitForTimeout(120);
  const a = await pos();
  await hold('w', 500);
  const c = await pos();
  const d = Math.hypot(c[0] - a[0], c[2] - a[2]);
  check(`the landing is not boxed in — ${k}`, d > 0.9, `moved ${f2(d)} m`);
}

// ── 6. the room keeps its light after dark ───────────────────────────────
// props.dimWorld() skips |x| > 100 so interiors stay lit round the clock.
// Sample a wall material's colour at noon and again at 2am.
const sample = () => p.evaluate((cx) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > 6 || Math.abs(wp.z) > 6) return;
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
check('the diner keeps its own light after dark',
  dimmed === 0, `${dimmed}/${noon.length} interior materials were dimmed by the night sweep`);

// ── report ───────────────────────────────────────────────────────────────
console.log('');
for (const [ok, name, detail] of results) console.log(`${ok ? ' ok ' : 'FAIL'}  ${name}\n        ${detail}`);
const bad = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await p.screenshot({ path: 'shots/diner-walk.png' });
await b.close();
process.exit(bad ? 1 : 0);
