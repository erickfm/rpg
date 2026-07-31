// THE JAIL'S DOOR WORKS AND ITS PAVEMENT SURVIVES — asserted, not looked at.
//
// Named for the CLAIMS it makes, not for the subject it looks at (GOTCHAS 24);
// `O-jail-look.mjs` is the investigation and this is the assertion suite.
//
//   node scripts/O-jail-walk.mjs [door|lane|all]     SHOT_URL is required
//
// exit 0 measured and fine · 1 measured and WRONG · 2 usage · 3 nothing measured
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { modes } from './lib/modes.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/ (GOTCHAS 48)'); process.exit(2); }
const mode = modes('O-jail-walk', ['door', 'lane', 'all']);
const SELFTEST = process.argv.includes('--selftest');

const FX = 57.0, CZ = -103.0, KERB = 55.0, RADIUS = 0.36;
let bad = 0, checks = 0;
const ok = (cond, msg) => { checks++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => { (window).__F_DEBUG = true; });
p.on('console', (msg) => { if (msg.text().includes('F-DEBUG')) console.log('PAGE:', msg.text()); });
await afterFrames(p, 10); await p.waitForTimeout(900);

if (SELFTEST) {
  // Break the WORLD on purpose and require this to go red (GOTCHAS 27). The
  // mutation pushes a slab across the jail's doorway onto the same collider
  // array the movement code reads, so it is the world that changes and not
  // this script's view of it.
  await p.evaluate(() => window.__ct.colliders().push(
    { minX: 55.4, maxX: 56.9, minZ: -105.5, maxZ: -100.5 }));
  console.log('SELFTEST: a slab pushed across the doorway — every claim below MUST go red');
}

// ── the population, asserted BEFORE any absence (GOTCHAS 34) ──────────────
const pop = await p.evaluate(() => {
  const ct = window.__ct;
  return {
    rooms: ct.rooms ? ct.rooms().map((r) => r.id) : null,
    doors: ct.doors().map((d) => d.building),
    spots: ct.spots().filter((s) => /DETENTION/i.test(s.label ?? '')).length,
  };
});
if (!pop.doors.includes('JAIL')) {
  console.error('ABORT: no door declared for JAIL — nothing below would be measuring the jail');
  await b.close(); process.exit(3);
}
console.log(`population: ${pop.doors.length} declared doors, JAIL among them`);

// ── DOOR: walk to it, press E, be inside; press E, be back on the pavement ─
if (mode === 'door' || mode === 'all') {
  console.log('\n── the door ──');
  // `doors()` publishes `stand` as an OBJECT, not as standX/standZ. My first
  // cut read fields that do not exist and compared against NaN — which is a
  // comparison that is false rather than an error, so the check went red
  // saying the LANDING was wrong when the landing was fine and the reader was
  // broken. GOTCHAS 48: an instrument that cannot be aimed gives a specific,
  // credible, wrong number.
  const stand = await p.evaluate(() => {
    const d = window.__ct.doors().find((x) => x.building === 'JAIL');
    return d?.stand ?? null;
  });
  if (!stand) { console.error('ABORT: JAIL publishes no stand point'); await b.close(); process.exit(3); }
  // Approach ON FOOT from the middle of the street rather than warping onto the
  // spot: a trigger that only fires when you are teleported onto it is not a
  // door anybody can use.
  await p.evaluate(() => window.__ct.warp(53.5, -103.0, Math.PI / 2, 0, 0));
  await afterFrames(p, 4);
  await p.keyboard.down('w');
  // walk until progress stops rather than for a fixed time — a fixed hold is a
  // bet on how busy the machine is (GOTCHAS 30)
  let last = null, still = 0;
  for (let i = 0; i < 90 && still < 6; i++) {
    await afterFrames(p, 3);
    const q = await p.evaluate(() => window.__ct.pos());
    if (last !== null && Math.hypot(q[0] - last[0], q[2] - last[2]) < 0.01) still++; else still = 0;
    last = q;
  }
  await p.keyboard.up('w');
  const atDoor = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  console.log(`   walked to (${atDoor[0]}, ${atDoor[2]})`);
  ok(atDoor[0] > 55.9, `walking east up the street reaches the door (x ${atDoor[0]} > 55.9)`);

  // THERE IS NO `__ct.prompt()`. My first cut invented one, got `null`, and
  // reported the door as not offering itself — while the very next line pressed
  // E and went inside. A reader that returns null for everything proves nothing
  // either way, which is the whole of GOTCHAS 34.
  //
  // The world does publish `spots()`, so ask the real predicate instead: is the
  // player inside the jail spot's REACH? Reach is not radius — `fp.ts:425` adds
  // REACH_MARGIN = 0.6 on top of r.
  const REACH_MARGIN = 0.6;
  const reachable = await p.evaluate(([margin]) => {
    const q = window.__ct.pos();
    const hits = window.__ct.spots()
      .filter((s) => /DETENTION/i.test(s.label ?? ''))
      .map((s) => ({ label: s.label, r: s.r, ok: s.ok,
                     d: +Math.hypot(s.x - q[0], s.z - q[2]).toFixed(2),
                     near: Math.hypot(s.x - q[0], s.z - q[2]) < s.r + margin }));
    return hits;
  }, [REACH_MARGIN]);
  console.log(`   jail spots in reach: ${JSON.stringify(reachable)}`);
  ok(reachable.some((h) => h.near && h.ok),
    'standing where the walk stopped, the jail\'s [E] is within reach and live');

  // WAIT FOR THE TRANSITION, not for six frames. A door is driven by the
  // render loop and a frame is 17 ms on an idle machine and over a second on
  // one running the rest of the suite (GOTCHAS 30) — `afterFrames(p, 6)` here
  // passed on a quiet machine and gave FOUR reds on a working door as soon as
  // anything else was running, every one of them one step behind the truth.
  await p.keyboard.press('e');
  const crossed = await p.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      if (window.__ct.pos()[0] > 400) return res(true);
      // 25 s, not 8. A door transition is driven by the render loop and this
      // world now carries eleven registered modules; on a machine running the
      // rest of the suite a frame is over a second (GOTCHAS 30). At 8 s this
      // timed out ONCE on a door that works — and reported it as a RED rather
      // than as "nothing measured", which is the expensive direction: a false
      // red on a confirmed row costs somebody a re-walk.
      if (performance.now() - t0 > 25000) return res(false);
      requestAnimationFrame(tick);
    };
    tick();
  }));
  // A TIMEOUT IS AN ABORT, NOT A FAILURE. GOTCHAS 32: exit 3 means the check
  // never ran and nothing follows about the world; exit 1 means it ran and the
  // world is wrong. Scoring a timeout as a red conflates the two, and the
  // reader cannot tell a broken door from a busy machine.
  if (!crossed) {
    console.error('ABORT: E did not cross within 25 s — the machine is loaded, or the door is dead.');
    console.error('       Nothing below measures the room. Re-run before believing anything.');
    await b.close(); process.exit(3);
  }
  const inside = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  ok(inside[0] > 400, `E puts you INSIDE — x ${inside[0]}, the interior slab belt is x >= 400`);

  // WALK THE LENGTH OF THE ROOM — down the line the gate is on, not down the
  // middle. The middle is the counter, and the counter is SUPPOSED to stop
  // you; a check that walks into it and reports the room unwalkable would be
  // measuring the threshold working and calling it a fault.
  // yaw 0, NOT PI. The camera's forward is (sin t, -cos t) — see GOTCHAS 33,
  // where the two yaw conventions in this world differ by a z-flip and cost
  // the park its benches. At yaw 0 the camera looks down -z, which is INTO the
  // room; at PI it looks at the front wall, which is what I did first and it
  // walked 0.78 m into the door and reported the room unwalkable.
  await p.evaluate(([x, z]) => window.__ct.warp(x + 1.95, z - 1.0, 0, 0, 0),
    [inside[0], inside[2]]);
  await afterFrames(p, 4);
  await p.keyboard.down('w');
  let l2 = null, s2 = 0;
  for (let i = 0; i < 120 && s2 < 6; i++) {
    await afterFrames(p, 3);
    const q = await p.evaluate(() => window.__ct.pos());
    if (l2 !== null && Math.hypot(q[0] - l2[0], q[2] - l2[2]) < 0.01) s2++; else s2 = 0;
    l2 = q;
  }
  await p.keyboard.up('w');
  const deep = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  const travelled = Math.abs(deep[2] - inside[2]);
  console.log(`   walked ${travelled.toFixed(2)} m into the room, to (${deep[0]}, ${deep[2]})`);
  ok(travelled > 8, `the room is WALKABLE for its length — ${travelled.toFixed(2)} m, not a box you stand in`);

  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0), [inside[0], inside[2]]);
  await afterFrames(p, 5);
  await p.keyboard.press('e');
  const left = await p.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      if (window.__ct.pos()[0] < 400) return res(true);
      if (performance.now() - t0 > 25000) return res(false);
      requestAnimationFrame(tick);
    };
    tick();
  }));
  if (!left) {
    console.error('ABORT: E from inside did not leave within 25 s — loaded machine, or a dead way out.');
    await b.close(); process.exit(3);
  }
  const out = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  ok(out[0] < 100, `E from inside puts you back on the STREET — (${out[0]}, ${out[2]})`);
  ok(out[0] > KERB && out[0] < FX, `and on the PAVEMENT, not in the road — ${KERB} < ${out[0]} < ${FX}`);
  // the way out must clear the way in, or a second E bounces you straight back
  {
    const gap = Math.hypot(out[0] - stand.x, out[2] - stand.z);
    ok(gap > 1.65, `the landing clears the way-in trigger — ${gap.toFixed(2)} m against r 1.05 + REACH_MARGIN 0.6`);
  }
}

// ── LANE: the pavement across the closed end is still walkable ─────────────
if (mode === 'lane' || mode === 'all') {
  console.log('\n── the pavement across the closed end ──');
  // The claim the site was approved on: this walk got WIDER, not narrower.
  // Scan out to 70, not 60 — the walkability fix (notes/O-jail-site-walkable.md)
  // set the building back into a forecourt, so the first collider along this
  // line now sits at ~61 (the building's own face), not ~57. A scan bounded at
  // 60 would find nothing and read every raw gap as null, which is a scan that
  // stopped short, not a wall that vanished (GOTCHAS §34: an absence over a
  // scan range that does not reach the thing is not evidence of anything).
  const reach = await p.evaluate(([kerb, radius]) => {
    const cols = window.__ct.colliders();
    const blocked = (x, z) => cols.some((c) =>
      x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius);
    const out = {};
    for (const [name, z] of [['north walk', -97.0], ['centre', -103.0], ['south walk', -109.0]]) {
      let stop = null;
      for (let x = kerb; x <= 70; x += 0.01) if (blocked(x, z)) { stop = +x.toFixed(2); break; }
      out[name] = stop;
    }
    return out;
  }, [KERB, RADIUS]);
  for (const [k, v] of Object.entries(reach)) {
    // raw gap, capsule NOT subtracted — the convention everywhere in this
    // project except one builder's notes (GOTCHAS 29)
    const raw = v === null ? null : +(v + RADIUS - KERB).toFixed(2);
    console.log(`   ${k.padEnd(11)} capsule stops at x ${v}, raw walk ${raw} m`);
    ok(raw !== null && raw >= 1.85,
      `${k}: ${raw} m of walk, against 1.70 m before the jail and a 0.72 m capsule`);
  }

  // and you can get from one pavement to the other ACROSS the end without
  // entering the carriageway, which is the request the site was chosen to
  // answer (FEATURE-REQUESTS.md: "close the walkable ring another way")
  const across = await p.evaluate(([radius]) => {
    const cols = window.__ct.colliders();
    const blocked = (x, z) => cols.some((c) =>
      x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius);
    const X = 55.9;                       // on the pavement, clear of the kerb
    for (let z = -97.0; z >= -109.0; z -= 0.05) {
      if (blocked(X, z)) return +z.toFixed(2);
      if (window.__ct.groundAt(X, z) < 0.10) return +z.toFixed(2);   // stepped into the road
    }
    return null;
  }, [RADIUS]);
  ok(across === null,
    across === null
      ? 'north walk to south walk ACROSS the closed end, on pavement the whole way'
      : `blocked or off the pavement at z ${across}`);
}

console.log(`\n${checks} checks, ${bad} failed`);
await b.close();
if (SELFTEST) {
  console.log(bad > 0 ? 'SELFTEST CAUGHT the mutation' : 'SELFTEST DID NOT CATCH IT — this check is decoration');
  process.exit(bad > 0 ? 0 : 2);
}
process.exit(bad ? 1 : 0);
