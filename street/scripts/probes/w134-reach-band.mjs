// HOW CLOSE DO YOU HAVE TO GET BEFORE IT OFFERS ITSELF — walked, several rooms.
//
// Item 309: *"with the radius for all these things a bit less."* "A bit" is a
// feel, and the failure mode is overshooting into fiddly, so the only useful
// measurement is the one a player makes with his feet: walk straight at a thing
// and write down the distance at which `[E]` starts naming it.
//
// IT WALKS. Warping is used only to get to the START of each approach — the
// approach itself is holding W through real collision, and the number reported
// is where the live `#ct-prompt` changed, not where a predicate says it should.
//
// TWO NUMBERS PER SITE, because the trim is meant to bite on one and not the
// other: AIMED at the thing (must stay generous — that is the half of selection
// the user asked for by name) and AIMED 90 DEGREES AWAY (the aim-free pass,
// which is what he is complaining grabs him).
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w134-reach-band.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4186/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1800);

const K = await p.evaluate(() => ({
  TM: window.__ct.touchMargin(), R: window.__ct.playerRadius(),
  trim: window.__ct.reachTrim ? window.__ct.reachTrim() : 1,
  onIt: window.__ct.onItRadius ? window.__ct.onItRadius() : window.__ct.playerRadius(),
}));
console.log(`REACH_TRIM ${K.trim}  ON_IT ${K.onIt.toFixed(3)}  TOUCH_MARGIN ${K.TM}  RADIUS ${K.R}`);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});
const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
const yawOf = () => p.evaluate(() => window.__ct.yaw());
const frames = (n = 2) => p.evaluate((k) => new Promise((r) => {
  let i = 0; const tick = () => (++i >= k ? r() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
async function turnTo(want) {
  for (let i = 0; i < 140; i++) {
    const err = norm(want - (await yawOf()));
    if (Math.abs(err) < 0.035) return true;
    const key = err > 0 ? 'ArrowRight' : 'ArrowLeft';
    await p.keyboard.down(key);
    await p.waitForTimeout(Math.min(240, Math.max(28, Math.abs(err) / 1.7 * 1000)));
    await p.keyboard.up(key);
    await frames(2);
  }
  return false;
}

// ⚠ THE AIM-FREE LEG DEPARTS, IT DOES NOT ARRIVE, AND THAT IS NOT A DETAIL.
//
// First cut walked AT the target with the eyes 90° off, strafing. Two runs of
// the same code gave 1.00 m and 0.26 m for the same door, because a strafing
// body takes a different path round the furniture every time and the sample is
// wherever it happened to be at 55 ms. Departing from the spot the walk has
// already reached removes the path: there is only one line, and it is the one
// the arrival leg just proved is walkable. The threshold is the same either way.
//
// The approach: from `start`, walk toward `target` holding W, sampling the
// prompt every step. Returns the distance at which `want` first appeared.
async function approach({ name, start, target, want, off = 0 }) {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [start.x, start.z]);
  const bearing = Math.atan2(target.x - start.x, -(target.z - start.z));
  await p.evaluate(([x, z, gy, y]) => window.__ct.warp(x, z, 0, gy, y), [start.x, start.z, gy, bearing + off]);
  await p.waitForTimeout(450);
  await turnTo(bearing);
  let first = null, steps = 0;
  await p.keyboard.down('w');
  for (let i = 0; i < 150; i++) {
    await p.waitForTimeout(45);
    const q = await pos();
    const d = Math.hypot(q.x - target.x, q.z - target.z);
    const t = await prompt();
    steps++;
    if (t && t.includes(want) && first === null) first = d;
    if (d < 0.10) break;
  }
  await p.keyboard.up('w');
  const q = await pos();
  const dEnd = Math.hypot(q.x - target.x, q.z - target.z);
  if (off === 0) {
    console.log(`  ${name.padEnd(30)} aimed    offered from `
      + `${first === null ? '   never' : first.toFixed(2) + ' m'}  (walked in to ${dEnd.toFixed(2)} m, ${steps} steps)`);
    return first;
  }
  // ── and now leave it, eyes 90° off, along the line we came in on ─────────
  await turnTo(bearing + Math.PI / 2);
  let lastSeen = null, gone = null, out = 0;
  await p.keyboard.down('d');                     // strafe right = back down the line
  for (let i = 0; i < 150; i++) {
    await p.waitForTimeout(45);
    const q2 = await pos();
    const d = Math.hypot(q2.x - target.x, q2.z - target.z);
    const t = await prompt();
    out++;
    if (t && t.includes(want)) lastSeen = d;
    else if (lastSeen !== null && gone === null) gone = d;
    if (d > 2.2 || (gone !== null && d > gone + 0.6)) break;
  }
  await p.keyboard.up('d');
  console.log(`  ${name.padEnd(30)} aim 90°  held out to  `
    + `${lastSeen === null ? '   never' : lastSeen.toFixed(2) + ' m'}  (left to ${(await pos() && gone !== null ? gone.toFixed(2) : '  ?')} m, ${out} steps)`);
  return lastSeen;
}

const spots = await p.evaluate(() => window.__ct.spots());
const find = (re) => spots.find((s) => re.test(s.label));

// ── the sites, one per room the user might be in ─────────────────────────
const sites = [];
const cal = find(/read the calendar/);
const door301 = spots.filter((s) => /the door/.test(s.label)).sort((a, c) => a.z - c.z)[0];
const atm = find(/use the machine/);
const n227 = find(/227/);
const counter = find(/buy cereal/);
const seat = find(/sit on the bench/);
const pew = find(/sit in the pew/);
const diner = find(/sit at the counter/);
for (const [name, s] of [['301 calendar', cal], ['301 door (room side)', door301],
  ['the ATM', atm], ['No. 227 entry', n227], ['bodega counter', counter],
  ['a park bench', seat], ["St Brigid's pew", pew], ['diner counter stool', diner]]) {
  if (!s) { console.log(`  ${name}: NOT FOUND among ${spots.length} spots — not measured`); continue; }
  sites.push({ name, s });
}
console.log(`${sites.length} sites found of 8:`);
for (const { name, s } of sites) console.log(`  ${name}: "${s.label}" (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) r ${s.r}`);

console.log('walked:');
for (const { name, s } of sites) {
  // START 1.8 m OUT, AND TRY THE DIAGONALS. At 2.6 m every start inside flat
  // 301 is in a wall — the room is 4 m across — so the calendar and the bed
  // walked from outside the building and were stopped 1.1 m short by the
  // dresser, reporting "never offered" for a spot that works. A start that
  // cannot reach its target is a measurement of nothing, and it looks exactly
  // like a defect (GOTCHAS 34).
  const R2 = Math.SQRT1_2;
  for (const dir of [[0, 1], [0, -1], [1, 0], [-1, 0],
    [R2, R2], [-R2, R2], [R2, -R2], [-R2, -R2]]) {
    const st = { x: s.x + dir[0] * 1.8, z: s.z + dir[1] * 1.8 };
    const okStart = await p.evaluate(([x, z, sy]) => {
      const g = window.__ct.groundAt(x, z);
      if (!isFinite(g) || Math.abs(g - sy) > 0.6) return false;
      const R = window.__ct.playerRadius();
      return !window.__ct.colliders().some((c) => c && isFinite(c.minX)
        && x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    }, [st.x, st.z, await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [s.x, s.z])]);
    if (!okStart) continue;
    await approach({ name, start: st, target: s, want: s.label.slice(0, 12) });
    await approach({ name, start: st, target: s, want: s.label.slice(0, 12), off: Math.PI / 2 });
    break;
  }
}
await b.close();
