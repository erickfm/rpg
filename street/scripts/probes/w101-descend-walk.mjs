// ITEM 130 — WALK DOWN THINGS AND SAY WHAT THE CAMERA DID.
//
// The user: *"i think just make all drops falls then we can work back from
// there."* The desk's ruling (`FEATURE-REQUESTS.md:2715`): *"no threshold:
// every drop becomes a fall, kerbs included"*, with the risk flagged by name —
// *"a staircase is a sequence of small drops and could become a bouncing
// descent."*
//
// ⚠ THAT RISK CANNOT HAPPEN, and the reason is written down in `ct/civic.ts:98`:
// **"the picker does not know about treads. It walks you up a smooth ramp at
// the flight's own gradient and the drawn steps ride within half a riser of
// it."** `ct/apartment.ts` is its model and does the same. Floor height in this
// world comes from a picker, never from colliders (GOTCHAS §7), so a flight of
// steps is a SLOPE as far as `fp.ts` is concerned — there are no risers to fall
// down. The `flight` case below measures that rather than asserting it.
//
// What removing the gate DOES change is the other thing, and nobody asked about
// it: with the threshold at 0, **any downhill at all** — a ramp, a flight, the
// crown of the road — drops the floor every single frame, so `airY` never
// returns to 0. `fp.ts:647` makes both head bob AND the jump gate conditional
// on `airY === 0`. So the number this probe exists to produce is `air%`: the
// share of frames on which the player is off the ground.
//
// CLAUDE.md: movement and floors are verified by ACTUALLY WALKING. Every case
// holds a key and samples per animation frame. Nothing warps into a descent —
// a probe that teleports down a step measures the teleport.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-descend-walk.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4191/');
const RUNS = Number(process.env.RUNS ?? 3);
const TAG = process.argv[2] ?? 'now';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.warp && window.__ct.camY, null, { timeout: 60000 });

const warp = (x, z, yaw) => p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [x, z, yaw]);

/**
 * Hold `key` (and optionally a second key) and sample per animation frame:
 * camera Y, frame duration, x, z, and THE FLOOR UNDER THE FEET.
 *
 * That last one is what makes `air%` possible without touching `fp.ts`: `airY`
 * is private, but `camY() - height - groundAt(x, z)` is the same quantity
 * computed from two public hooks. `height` is read off the world at rest in the
 * same frame rather than typed, because a typed 1.62 would silently become a
 * measurement of the crouch offset the day anyone touches it.
 */
const walk = (key, ms, extra = null) => p.evaluate(async ([k, ms, ex]) => {
  const down = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { key: c }));
  const up = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { key: c }));
  const q0 = window.__ct.pos();
  const EYE = window.__ct.camY() - window.__ct.groundAt(q0[0], q0[2]);   // at rest, on the ground
  down(k);
  if (ex) down(ex);
  const out = await new Promise((done) => {
    const o = []; const t0 = performance.now(); let prev = t0;
    const tick = () => {
      const now = performance.now();
      const q = window.__ct.pos();
      o.push([+window.__ct.camY().toFixed(5), (now - prev) / 1000,
        +q[0].toFixed(3), +q[2].toFixed(3), +window.__ct.groundAt(q[0], q[2]).toFixed(5)]);
      prev = now;
      if (now - t0 > ms) return done(o);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  up(k);
  if (ex) up(ex);
  return { EYE, out };
}, [key, ms, extra]);

// air% — the share of frames whose camera sits more than `eps` above the floor
// under it. eps is 0.045: head bob is 0.035 (fp.ts:207) and it is applied ONLY
// when grounded, so a grounded walking frame can legitimately sit 0.035 high.
// This is the exact trap the previous item's kerb case fell into — it asked for
// "a drop over 0.05 m" and measured head bob (`w50-stepoff-fall.md`).
const AIR_EPS = 0.045;
const airPct = (EYE, t) => 100 * t.filter((f) => f[0] - EYE - f[4] > AIR_EPS).length / t.length;

// ── FIND THE FEATURES IN THE WORLD, never type their coordinates (§8) ───────
const found = await p.evaluate(() => {
  const G = (x, z) => window.__ct.groundAt(x, z);
  const out = { kerb: null, flights: [] };
  for (let z = -44; z <= -8 && !out.kerb; z += 0.5) {
    for (let x = -14; x <= 14; x += 0.25) {
      const a = G(x, z), c = G(x + 0.25, z);
      if (a - c > 0.10 && a - c < 0.20 && Math.abs(G(x - 1.4, z) - a) < 0.005
        && Math.abs(G(x + 1.4, z) - c) < 0.005) { out.kerb = { x, z, hi: a, lo: c }; break; }
    }
  }
  return out;
});
if (!found.kerb) { console.log('ABORT no kerb located — nothing to walk off'); await b.close(); process.exit(3); }
console.log(`kerb ${(found.kerb.hi - found.kerb.lo).toFixed(3)} m at (${found.kerb.x}, ${found.kerb.z})`);

// ── THE FLIGHT: the walk-up's ramp, reached and left ON FOOT ────────────────
//
// I tried and abandoned hunting for a descent by scanning `groundAt` for runs
// of falling samples. It found five candidates and **not one of them could be
// walked** — the picker answers for every point in R² (`lib/floors.mjs`), so a
// coordinate it names is not a place a body can go: a collider, a wall or a
// building can be standing on it. The first cut of this probe reported
// "descended -0.005 m" from one of those and I nearly wrote it up.
//
// `ct/apartment.ts` publishes `scene.userData.spawn` precisely so a check can
// find the building from a preview (`jump-walk.mjs:229`), and holding W from
// the lobby CLIMBS — the picker follows the ramp. So the flight is: walk up it,
// turn round, walk down it. Derived from the published spawn, never typed.
const spawn = await p.evaluate(() => window.__ct.scene()?.userData?.spawn ?? null);
if (!spawn || !isFinite(spawn.x) || !isFinite(spawn.gy)) {
  console.log('ABORT the world publishes no scene.userData.spawn — the ramp cannot be'
    + ' located, and every descent verdict below would be free (GOTCHAS §32)');
  await b.close(); process.exit(3);
}
const APT_X = spawn.x + 1.4, APT_Z = spawn.z - 3.7;
const LOBBY = [APT_X + 0.6, APT_Z + 6.0];
console.log(`walk-up at (${APT_X.toFixed(2)}, ${APT_Z.toFixed(2)}), storey ${(spawn.gy / 2).toFixed(2)} m`);

/** Climb the ramp on foot from the lobby; returns the storey reached. */
const climb = async () => {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI, 0, 0), LOBBY);
  await p.waitForTimeout(450);
  await walk('w', 2600);                        // yaw PI faces +z, up the shaft
  await p.waitForTimeout(300);
  return (await p.evaluate(() => window.__ct.pos()))[3];
};
const up = await climb();
if (!(up > 0.5)) { console.log(`ABORT holding W from the lobby did not climb (storey ${up}) —`
  + ' the ramp is the instrument here, so this is a MISSING measurement, not a verdict');
  await b.close(); process.exit(3); }
console.log(`climbed to storey ${up.toFixed(2)} m on foot; the descent is the same ramp, turned round\n`);

const stat = (xs) => {
  const v = [...xs].sort((a, c) => a - c);
  const mean = v.reduce((a, c) => a + c, 0) / v.length;
  return `${mean.toFixed(3)} [${v[0].toFixed(3)}..${v[v.length - 1].toFixed(3)}]`;
};
const acc = {};
const push = (k, v) => (acc[k] ??= []).push(v);

for (let run = 0; run < RUNS; run++) {
  // ── 1. THE KERB — the case item 112 deliberately left instant ─────────────
  await warp(found.kerb.x - 1.4, found.kerb.z, Math.PI / 2);
  await p.waitForTimeout(250);
  {
    const { EYE, out: t } = await walk('w', 900);
    let worst = 0, worstDt = 0;
    for (let i = 1; i < t.length; i++) {
      const d = t[i - 1][0] - t[i][0];
      if (d > worst) { worst = d; worstDt = t[i][1]; }
    }
    // A body leaving a step of height h cannot lose more than
    // sqrt(2gh)*dt + g*dt^2/2 in one frame — evaluated on the frame that
    // actually happened, never on a nominal 16 ms.
    const h = found.kerb.hi - found.kerb.lo;
    push('kerb.worst', worst);
    push('kerb.bound', Math.sqrt(2 * 14 * h) * worstDt + 7 * worstDt * worstDt);
    push('kerb.air', airPct(EYE, t));
  }

  // ── 2. THE DESCENT — the desk's bouncing-stairs risk ──────────────────────
  // Climb it on foot, turn round, walk down. yaw 0 faces -z, back down the shaft.
  await climb();
  await p.evaluate(() => { const q = window.__ct.pos(); window.__ct.warp(q[0], q[2], 0, undefined, 0); });
  await p.waitForTimeout(300);
  {
    const { EYE, out: t } = await walk('w', 2600);
    let worst = 0, rises = 0, biggestRise = 0;
    for (let i = 1; i < t.length; i++) {
      const d = t[i - 1][0] - t[i][0];
      if (d > worst) worst = d;
      // A BOUNCE is the camera going back UP mid-descent by more than head bob
      // can account for: bob is 0.035, so 0.07 peak to peak. 0.09 clears it.
      if (-d > 0.09) { rises++; biggestRise = Math.max(biggestRise, -d); }
    }
    push('flight.worst', worst);
    push('flight.bounces', rises);
    push('flight.rise', biggestRise);
    push('flight.desc', t[0][0] - t.at(-1)[0]);
    push('flight.air', airPct(EYE, t));
  }

  // ── 3. FLAT-ISH ROAD, and 4. jumping while walking on it ──────────────────
  await warp(0, -30, Math.PI / 2);
  await p.waitForTimeout(250);
  {
    const { EYE, out: t } = await walk('w', 1200);
    push('road.air', airPct(EYE, t));
    push('road.travel', Math.hypot(t.at(-1)[2] - t[0][2], t.at(-1)[3] - t[0][3]));
    // HEAD BOB, measured as an ENVELOPE rather than by counting sign changes —
    // my first cut counted direction changes over a 0.008 m threshold and
    // returned 0.000 on a world where bob demonstrably works, because the
    // ground's own slope swamps the per-frame delta. The eye's height ABOVE
    // ITS OWN FLOOR does not have that problem: at rest it is EYE exactly, and
    // walking it swings by +/-bob. `bob` is 0.035 (fp.ts:207), so a working bob
    // shows ~0.07 peak to peak and a suppressed one ~0.
    const h = t.map((f) => f[0] - EYE - f[4]);
    push('road.bobPP', Math.max(...h) - Math.min(...h));
  }
  await warp(0, -30, Math.PI / 2);
  await p.waitForTimeout(250);
  {
    const { out: t } = await walk('w', 1200, ' ');
    push('jumpwalk.rise', Math.max(...t.map((f) => f[0])) - Math.min(...t.map((f) => f[0])));
  }
  // 5. jump while walking DOWNHILL — the gate `airY === 0 && vy === 0` is the
  // thing at stake, and downhill is where it is false under the new rule.
  await climb();
  await p.evaluate(() => { const q = window.__ct.pos(); window.__ct.warp(q[0], q[2], 0, undefined, 0); });
  await p.waitForTimeout(300);
  {
    const { EYE, out: t } = await walk('w', 2600, ' ');
    // did the camera ever rise clear of the floor by more than a hop's worth?
    push('jumpslope.clear', Math.max(...t.map((f) => f[0] - EYE - f[4])));
  }
  // 6. TAP space repeatedly while walking downhill, and count how many taps
  //    produced a hop. HELD space (case 5) is not the same question and it
  //    flatters the result: `jumpHeld` fires it on the FIRST grounded frame,
  //    however long that takes. A player taps. The gate is
  //    `airY === 0 && vy === 0`, so a tap that lands on an airborne frame is
  //    simply eaten — that is the one thing at 0 a player would actually feel,
  //    and it is measured rather than reasoned about.
  await climb();
  await p.evaluate(() => { const q = window.__ct.pos(); window.__ct.warp(q[0], q[2], 0, undefined, 0); });
  await p.waitForTimeout(300);
  {
    const r = await p.evaluate(async () => {
      const ev = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k }));
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const q0 = window.__ct.pos();
      const EYE = window.__ct.camY() - window.__ct.groundAt(q0[0], q0[2]);
      ev('keydown', 'w');
      let taps = 0, hops = 0;
      for (let i = 0; i < 10; i++) {
        ev('keydown', ' '); await sleep(90); ev('keyup', ' ');
        taps++;
        // a hop is the eye clearing its own floor by more than head bob can do
        let peak = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < 200) {
          const q = window.__ct.pos();
          peak = Math.max(peak, window.__ct.camY() - EYE - window.__ct.groundAt(q[0], q[2]));
          await new Promise((r) => requestAnimationFrame(r));
        }
        if (peak > 0.20) hops++;
        await sleep(120);
      }
      ev('keyup', 'w');
      return { taps, hops };
    });
    push('taps.hops', r.hops);
  }
  process.stderr.write(`  run ${run + 1}/${RUNS}\n`);
}

console.log(`${TAG} — ${RUNS} runs, mean [min..max]   (air% = frames >${AIR_EPS} m off the floor)\n`);
const line = (k, l) => console.log(`   ${l.padEnd(30)} ${stat(acc[k])}`);
console.log(`KERB  ${(found.kerb.hi - found.kerb.lo).toFixed(3)} m`);
line('kerb.worst', 'biggest single-frame drop');
line('kerb.bound', 'gravity bound for that frame');
line('kerb.air', 'air%');
console.log(`   -> ${acc['kerb.worst'].every((v, i) => v <= acc['kerb.bound'][i] + 1e-6)
  ? 'FALLS — every frame inside the bound' : 'INSTANT — a frame outdropped gravity'}`);
console.log(`\nDESCENT  the walk-up ramp, climbed on foot to storey ${up.toFixed(2)} m and walked back down`);
line('flight.desc', 'descended');
line('flight.worst', 'biggest single-frame drop');
line('flight.bounces', 'BOUNCES (rise > 0.09 m)');
line('flight.rise', 'biggest mid-descent rise');
line('flight.air', 'air%');
console.log('\nLEVEL ROAD');
line('road.travel', 'walked (m)');
line('road.air', 'air%');
line('road.bobPP', 'head-bob peak-to-peak (m)');
line('jumpwalk.rise', 'jump-while-walking rise (m)');
console.log('\nJUMPING WHILE WALKING DOWNHILL');
line('jumpslope.clear', 'max clearance over the floor (m)');
console.log('   -> a hop clears ~0.48-0.54 m; anything under ~0.2 m means the jump never fired');
line('taps.hops', 'hops from 10 TAPPED jumps');
console.log('   -> held space fires on the first grounded frame; a tap does not wait');
if (errs.length) console.log(`\nPAGE ERRORS (${errs.length}):\n  ` + errs.join('\n  '));
else console.log('\nno page errors');
await b.close();
