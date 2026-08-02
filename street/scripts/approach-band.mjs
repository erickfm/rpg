// THE CONTINUOUS-APPROACH INSTRUMENT — item 99, and the thing that would have
// caught item 98.
//
// THE USER, on the SEVENS door: *"when i try to enter the casino there's like a
// distance far away i can enter (i dont like this), then a distance i can't
// enter, then when im at the door i can enter again… make sure we review these
// things. this just seems messy and idk how you are missing this sort of
// stuff."*
//
// ── WHY NOTHING IN THIS PROJECT COULD SEE IT ──────────────────────────────
//
// Every existing [E] check WARPS TO A COORDINATE AND PRESSES E.
// `scripts/interiors-walk.mjs` alone has 13 `warp()` calls; `spots-walk`,
// `D-walk` and `bugsweep` are the same shape. They sample DISCRETE STATIONS.
//
// A prompt that is offered at 5 m, dead at 2.5 m, and offered again at 0.8 m
// PASSES AT EVERY ONE OF THOSE STATIONS. The defect lives strictly BETWEEN the
// samples, so it is invisible by construction — not missed through carelessness
// but unreachable by the method. That is the whole of the user's "idk how you
// are missing this".
//
// So this one WALKS. It holds `w`, records what the HUD is offering on EVERY
// RENDERED FRAME, and asserts the resulting offer band is CONTIGUOUS: once a
// door is offered on an approach it must stay offered until you are past it.
// A gap in the middle is the bug, and it is a shape you can only see from a
// continuous trace.
//
// ── THE ORACLE IS THE DOM, NOT pickSpot ───────────────────────────────────
//
// It reads `#ct-prompt`'s text, which is literally the string the player sees.
// It deliberately does NOT call `pickSpot` or re-implement it: an oracle that
// shares the implementation's assumptions is not independent about those
// assumptions (crosstown.ts:1597 records this project paying for exactly that —
// an occlusion oracle that copied the buggy eye height and so agreed with the
// bug). The HUD line is the user's own instrument.
//
// ── SAMPLING IS PER FRAME, AND TERMINATION IS ON WORLD STATE ──────────────
//
// `dt` is clamped at 0.05 s, so under load a fixed `waitForTimeout` covers an
// unknown distance and a fixed step count covers an unknown span. A rAF
// recorder inside the page samples once per rendered frame whatever the
// framerate, and the walk ends when the PLAYER STOPS MOVING or has passed the
// target — never on a wall-clock guess.
//
// Usage:
//   SHOT_URL=http://localhost:4185/ node scripts/approach-band.mjs
//   ... --only SEVENS          just the approaches whose label matches
//   ... --offsets 0,0.5,1.0    lateral offsets of the approach lane, metres
//   ... --plot                 print the per-frame band plot for every approach
//   ... --selftest             prove the instrument can FAIL
import { chromium } from 'playwright';
import { aim } from './lib/aim.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

// ── args ──────────────────────────────────────────────────────────────────
// GOTCHAS 34: refuse a flag we do not understand rather than run the normal
// sweep while the caller believes they ran something else.
let only = null, plot = false, selftest = false, dump = null;
let offsets = [0, 0.5, 1.0, -0.5, -1.0];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--only') { only = argv[++i]; continue; }
  if (a === '--plot') { plot = true; continue; }
  if (a === '--selftest') { selftest = true; continue; }
  // --dump writes the RAW per-frame trace — position, yaw and the exact prompt
  // string — so another script can replay a candidate predicate over the real
  // trajectory instead of over an idealised straight line. The player does not
  // walk a perfect line (kerbs, the facade cushion, citizens), and a model fed
  // the intended path rather than the walked one is testing its own arithmetic.
  if (a === '--dump') { dump = argv[++i]; continue; }
  if (a === '--offsets') {
    offsets = argv[++i].split(',').map(Number);
    if (offsets.some((n) => !Number.isFinite(n))) { console.error('--offsets wants numbers'); process.exit(2); }
    continue;
  }
  console.error(`unknown argument ${JSON.stringify(a)} — see the usage block at the top of this file`);
  process.exit(2);
}

// HOW FAR OUT THE APPROACH STARTS. 8 m, which is past `pickSpot`'s own 6 m
// `reach` — the walk has to begin OUTSIDE any acceptance region or it cannot
// observe the leading edge of the band, and the leading edge is half the
// user's complaint ("a distance far away i can enter, i dont like this").
const START_D = 8.0;

const URL = aim('http://localhost:4185/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);          // GOTCHAS 26: prove the world, do not name it
await setClock(page, 13, 0);           // a DAY hour: see D-walk on why night settles are flaky
await page.mouse.click(640, 360);      // pointer lock, so keys reach the rig
await page.waitForTimeout(600);

// ── the per-frame recorder ────────────────────────────────────────────────
//
// Installed once, armed per leg. It pushes one row per rendered frame:
// position, yaw, and the HUD's prompt text exactly as displayed (empty string
// when the line is hidden — `hud.ts:990` hides it for null AND while a panel is
// up, and both of those genuinely mean "nothing is being offered to press").
await page.evaluate(() => {
  window.__w47 = { rows: [], on: false, raf: 0 };
  const tick = () => {
    if (window.__w47.on) {
      const p = window.__ct.pos();
      const el = document.getElementById('ct-prompt');
      const txt = el && el.style.display !== 'none' ? (el.textContent || '') : '';
      window.__w47.rows.push([p[0], p[2], window.__ct.yaw(), txt]);
    }
    window.__w47.raf = requestAnimationFrame(tick);
  };
  tick();
});

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 0, 0), [x, z, yaw]);

// WARM-UP. D-walk.mjs:74 measured this and it is not superstition: without one
// throwaway warp the FIRST leg of a run walks off sideways having never turned,
// and every later leg from the identical warp behaves. A harness whose first
// measurement is systematically different from the rest is reporting an
// artefact, and this file's whole subject is instruments that measure
// themselves instead of the world.
await warp(0, -90, 0);
await page.waitForTimeout(400);
await page.keyboard.down('w'); await page.waitForTimeout(200); await page.keyboard.up('w');
await page.waitForTimeout(300);

/** Walk one approach, recording every frame. Returns the trace.
 *
 *  `tx,tz` is the spot being approached; `nx,nz` its OUTWARD normal (away from
 *  the building). The player starts `START_D` out along that normal, shifted
 *  `lat` metres sideways, faces the way they are walking — which is what a
 *  player does — and holds `w`.
 *
 *  TERMINATION IS WORLD STATE. The leg ends when the player has stopped moving
 *  (the facade stops them) or has walked past the target. The wall-clock cap is
 *  a safety net that is reported when it fires, never a normal exit — a check
 *  that silently ends on a timeout is measuring the timeout. */
async function walkApproach(tx, tz, nx, nz, lat) {
  // perpendicular to the approach, on the ground plane
  const px = -nz, pz = nx;
  const sx = tx + nx * START_D + px * lat;
  const sz = tz + nz * START_D + pz * lat;
  // Face the way you are going: yaw 0 is fwd (0,0,-1), so fwd = (sin y, -cos y)
  // and walking direction is -n.
  const yaw = Math.atan2(-nx, nz);
  await warp(sx, sz, yaw);
  await page.waitForTimeout(350);           // let the rig settle at the new spot

  await page.evaluate(() => { window.__w47.rows.length = 0; window.__w47.on = true; });
  await page.keyboard.down('w');

  let reason = 'cap';
  const t0 = Date.now();
  let lastN = 0, stillFor = 0;
  while (Date.now() - t0 < 20000) {
    await page.waitForTimeout(120);
    const st = await page.evaluate(([a, c, dx, dz]) => {
      const r = window.__w47.rows;
      const n = r.length;
      if (!n) return { n: 0, past: false, still: false };
      const [x, z] = r[n - 1];
      // signed progress along the approach: positive once past the target
      const past = (x - a) * dx + (z - c) * dz > 0.15;
      // "stopped" is measured over the last ~10 frames of the trace itself,
      // not over wall-clock: the facade has caught us.
      const k = Math.max(0, n - 10);
      const moved = Math.hypot(r[n - 1][0] - r[k][0], r[n - 1][1] - r[k][1]);
      return { n, past, still: n - k >= 8 && moved < 0.02 };
    }, [tx, tz, -nx, -nz]);
    if (st.past) { reason = 'past the target'; break; }
    if (st.still) {
      stillFor++;
      if (stillFor >= 2) { reason = 'stopped by the world'; break; }
    } else stillFor = 0;
    if (st.n === lastN) {           // no frames at all — the page is wedged
      reason = 'no frames rendered'; break;
    }
    lastN = st.n;
  }
  await page.keyboard.up('w');
  await page.evaluate(() => { window.__w47.on = false; });
  const rows = await page.evaluate(() => window.__w47.rows.slice());
  await page.waitForTimeout(80);
  return { rows, reason, start: [sx, sz] };
}

/** Reduce a trace to the band for ONE label, and judge it.
 *
 *  `offered[i]` is "the HUD was naming THIS door on frame i". The assertion is
 *  contiguity: between the first and last frame it was offered, it must never
 *  have gone away. That is the user's sentence turned into a predicate. */
function band(rows, tx, tz, label) {
  const pts = rows.map(([x, z, , txt]) => ({
    d: Math.hypot(x - tx, z - tz),
    on: txt.includes(label),
    txt,
  }));
  const first = pts.findIndex((p) => p.on);
  const last = pts.length - 1 - [...pts].reverse().findIndex((p) => p.on);
  if (first < 0) return { pts, ever: false, gaps: [], firstD: null, lastD: null };
  // every maximal OFF run strictly inside [first,last] is a gap
  const gaps = [];
  let run = null;
  for (let i = first; i <= last; i++) {
    if (!pts[i].on) { if (!run) run = { i0: i, i1: i }; else run.i1 = i; }
    else if (run) { gaps.push(run); run = null; }
  }
  return {
    pts, ever: true, gaps,
    firstD: pts[first].d, lastD: pts[last].d,
    // the widest gap, in metres of travel — a one-frame flicker and a 3 m dead
    // zone are not the same finding and must not print the same
    gapSpans: gaps.map((g) => ({
      fromD: pts[g.i0].d, toD: pts[g.i1].d,
      metres: Math.abs(pts[g.i0].d - pts[g.i1].d),
      // what WAS offered in the hole, if anything — a gap filled by a competing
      // spot has a different cause from a gap filled by nothing
      instead: [...new Set(pts.slice(g.i0, g.i1 + 1).map((p) => p.txt).filter(Boolean))],
    })),
  };
}

/** One line per frame is unreadable; one column per 0.25 m is the plot the item
 *  asked for. `#` offered, `.` not, ordered far -> near. */
function plotBand(b, tx, tz) {
  if (!b.pts.length) return '    (no frames)';
  const BIN = 0.25;
  const maxD = Math.max(...b.pts.map((p) => p.d));
  const bins = Math.ceil(maxD / BIN);
  const cell = new Array(bins).fill(' ');
  for (const p of b.pts) {
    const i = Math.min(bins - 1, Math.floor(p.d / BIN));
    if (cell[i] === ' ') cell[i] = p.on ? '#' : '.';
    else if (cell[i] === '.' && p.on) cell[i] = '#';   // any offer in the bin counts
  }
  // far on the left, the door on the right — the direction of travel
  const strip = cell.slice().reverse().join('');
  const far = (bins * BIN).toFixed(1);
  return `    ${far.padStart(5)}m |${strip}| 0m  (# offered, . dead, 0.25 m per column)`;
}

// ── what to sweep ─────────────────────────────────────────────────────────
//
// EVERY DECLARED DOOR, from the world's own registry, plus every non-door spot
// that is reachable from outside. Derived, never retyped: `__ct.doors()`
// publishes the stand point and the outward normal, and `__ct.spots()`
// publishes the rest. A list of doors hand-typed here would be a check of the
// list. (BUILDER-BRIEF §8.)
const world = await page.evaluate(() => ({
  doors: window.__ct.doors(),
  spots: window.__ct.spots(),
  pos: window.__ct.pos(),
}));

// Match each declared door to the SPOT that actually carries its prompt: the
// nearest registered spot to the published stand point. The door registry knows
// geometry, the spot registry knows the label, and the label is what the HUD
// prints — so the two have to be joined rather than assumed to agree. (They do
// not always: int-casino.ts:203 records this exact pair drifting 0.25 m apart.)
let approaches = [];
for (const d of world.doors) {
  const near = world.spots
    .map((s) => ({ s, dd: Math.hypot(s.x - d.stand.x, s.z - d.stand.z) }))
    .sort((a, b) => a.dd - b.dd)[0];
  if (!near || near.dd > 2.0) {
    approaches.push({ name: d.building, label: null, skip: `no spot within 2 m of its stand point (nearest ${near ? near.dd.toFixed(2) : 'none'} m)` });
    continue;
  }
  approaches.push({
    name: d.building,
    label: near.s.label,
    tx: near.s.x, tz: near.s.z, r: near.s.r,
    nx: d.point.nx, nz: d.point.nz,
    driftFromStand: near.dd,
  });
}
if (only) approaches = approaches.filter((a) => `${a.name} ${a.label ?? ''}`.toLowerCase().includes(only.toLowerCase()));

console.log(`\ncontinuous-approach sweep — ${approaches.length} approach(es) x ${offsets.length} lateral offset(s)`);
console.log(`start ${START_D} m out, walking in, sampling EVERY RENDERED FRAME\n`);

let fails = 0, legs = 0, framesTotal = 0;
const findings = [];
const dumped = [];
const incompleteLegs = [];

for (const a of approaches) {
  if (a.skip) { console.log(`  SKIP  ${a.name}: ${a.skip}`); continue; }
  console.log(`─ ${a.name}  →  ${JSON.stringify(a.label)}   spot r=${a.r} at (${a.tx.toFixed(2)}, ${a.tz.toFixed(2)})`);
  for (const lat of offsets) {
    const { rows, reason } = await walkApproach(a.tx, a.tz, a.nx, a.nz, lat);
    legs++; framesTotal += rows.length;
    if (dump) dumped.push({ door: a.name, label: a.label, tx: a.tx, tz: a.tz, r: a.r, lat, reason, rows });
    const b = band(rows, a.tx, a.tz, a.label);
    const tag = `lat ${lat >= 0 ? '+' : ''}${lat.toFixed(1)} m`;
    if (!rows.length) { console.log(`    ${tag}: NO FRAMES (${reason})`); fails++; continue; }
    // WHERE THE WALK ACTUALLY ENDED — and WHETHER THAT IS THE WORLD'S FAULT OR
    // MINE. This distinction cost a revision of this file and is the whole of
    // BUILDER-BRIEF §7 ("half of all defects here are the instrument").
    //
    // The first version failed 9 legs as BLOCKED. Then I named the blockers
    // from the collider registry (scripts/probes/w47-what-blocks.mjs):
    //
    //   HOTEL ORPHEUS — a 4.1 x 2.1 m box with userData `tyre, wheelbase,
    //   steer, hoodTop`. A PARKED CAR, at groundAt 0, i.e. ON THE ROAD.
    //   ST BRIGID — a 0.40 x 0.40 m box with userData `lampPart`. A lamp post
    //   at the kerb.
    //
    // Every leg starts 8 m out along the door's own normal, and 8 m out from a
    // side-street door IS THE ROADWAY. So those legs were walking across the
    // street and into legitimately-parked scenery. That is the world being
    // right and the approach being unrealistic — a player walks the pavement.
    //
    // I then tried to rescue the verdict by classifying the blocker as pavement
    // or roadway from `groundAt`, and that was wrong too: ST BRIGID's blocker is
    // a KERBSIDE LAMP POST straddling the kerb line (x 5.15–5.55 against a kerb
    // edge at ~5.2), so a probe just past the stopping point lands on the kerb
    // top and reads "pavement". It is ordinary street furniture and the 3 m
    // pavement behind it is clear.
    //
    // SO A TRUNCATED LEG CARRIES NO VERDICT AT ALL, and saying otherwise twice
    // running is the point. This instrument approaches head-on down the door's
    // normal because that is the geometry that exposes the band; it is NOT a
    // model of how a player reaches a door, and it cannot tell a trap on the
    // walking lane from scenery correctly placed at the kerb. Establishing THAT
    // needs an approach that follows the pavement, which this does not yet do —
    // recorded as the instrument's main known gap.
    //
    // The band verdict is unaffected: it is judged over whatever part of the
    // approach was actually walked, and 10 of the 12 doors walk it in full.
    const endX = rows[rows.length - 1][0], endZ = rows[rows.length - 1][1];
    const endD = Math.hypot(endX - a.tx, endZ - a.tz);
    let short = null;
    if (reason === 'stopped by the world' && endD > a.r + 1.0) {
      // probe just BEYOND where we stopped — that is where the blocker is, not
      // where the player is standing
      const bx = endX + (a.tx - endX) / endD * 0.6, bz = endZ + (a.tz - endZ) / endD * 0.6;
      const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [bx, bz]);
      short = { endD, onPavement: gy > 0.05, gy };
    }
    if (short) {
      console.log(`    ${tag}: INCOMPLETE — stopped ${short.endD.toFixed(2)} m short of the spot (obstruction at groundAt ${short.gy.toFixed(2)})`);
      incompleteLegs.push({ door: a.name, lat, ...short });
      if (!b.ever) continue;
    }
    if (!b.ever) {
      // never offered at all on this lane. Not automatically a defect — a lane
      // 1 m off a 1.05 m door may simply never be an approach to it — but it is
      // reported, because "never offered" and "offered in three pieces" are
      // different answers and only one of them is fine.
      console.log(`    ${tag}: never offered  (${rows.length} frames, ended: ${reason}, ${endD.toFixed(2)} m from the spot)`);
      continue;
    }
    const bad = b.gaps.length > 0;
    if (bad) fails++;
    const gapTxt = bad
      ? b.gapSpans.map((g) => `DEAD ${g.fromD.toFixed(2)}→${g.toD.toFixed(2)} m (${g.metres.toFixed(2)} m of walking)${g.instead.length ? ` [instead: ${g.instead.join(' / ')}]` : ' [nothing offered]'}`).join('; ')
      : 'contiguous';
    console.log(`    ${tag}: ${bad ? 'GAP ' : 'ok  '} offered ${b.firstD.toFixed(2)} m → ${b.lastD.toFixed(2)} m · ${rows.length} frames · ${gapTxt}`);
    if (plot || bad) console.log(plotBand(b, a.tx, a.tz));
    if (bad) findings.push({ door: a.name, lat, spans: b.gapSpans, firstD: b.firstD });
    else findings.push({ door: a.name, lat, spans: [], firstD: b.firstD });
  }
  console.log('');
}

// ── the far-offer summary, which is the OTHER half of the user's sentence ──
// "there's like a distance far away i can enter (i dont like this)". The band
// being contiguous is necessary and not sufficient; a contiguous band that
// starts 7 m from the door is still wrong to him.
if (incompleteLegs.length) {
  console.log(`INCOMPLETE — ${incompleteLegs.length} leg(s) did not reach the door. NO VERDICT, either way.`);
  console.log(`  The approach starts ${START_D} m out along the door's own normal, and for a side-street`);
  console.log(`  door that is the ROADWAY — so these legs walk across the street into scenery that`);
  console.log(`  is correctly placed. Named from the collider registry: HOTEL ORPHEUS is a parked`);
  console.log(`  car (userData tyre/wheelbase/steer), ST BRIGID a kerbside lamp post (lampPart).`);
  console.log(`  Telling a real trap from street furniture needs a pavement-following approach,`);
  console.log(`  which this instrument does not have yet. That is its main known gap.`);
  for (const b of incompleteLegs) console.log(`  ${b.door.padEnd(16)} lat ${b.lat >= 0 ? '+' : ''}${b.lat.toFixed(1)} m — stopped ${b.endD.toFixed(2)} m short`);
  console.log('');
}

const firsts = findings.filter((f) => f.firstD != null).map((f) => f.firstD);
if (firsts.length) {
  firsts.sort((x, y) => y - x);
  console.log(`furthest distance any door was offered from: ${firsts[0].toFixed(2)} m` +
    `   (median ${firsts[Math.floor(firsts.length / 2)].toFixed(2)} m)`);
}

// ── --selftest: a tool nobody has watched fail is worth what an unrun tool is ─
//
// Assert the OPPOSITE of a thing known to be true, through the same band()
// judgement the real legs use, and demand it be caught. If a synthetic trace
// with a hole in it reads "contiguous", every green line above is worthless.
if (selftest) {
  console.log('\n── selftest: does band() actually see a hole? ──');
  const mk = (ons) => ons.map((on, i) => [0, -(ons.length - i) * 0.2, 0, on ? '[E] into SEVENS' : '']);
  const holed = band(mk([1, 1, 0, 0, 0, 1, 1]), 0, 0, 'into SEVENS');
  const solid = band(mk([0, 1, 1, 1, 1, 1, 1]), 0, 0, 'into SEVENS');
  const never = band(mk([0, 0, 0]), 0, 0, 'into SEVENS');
  const t = [
    ['a trace with a 3-frame hole reports a gap', holed.gaps.length === 1],
    ['…and measures its span', holed.gapSpans[0].metres > 0],
    ['a solid trace reports none', solid.gaps.length === 0],
    ['a never-offered trace is not a gap', never.ever === false && never.gaps.length === 0],
    ['trailing OFF frames are not a gap', band(mk([1, 1, 1, 0, 0]), 0, 0, 'into SEVENS').gaps.length === 0],
  ];
  for (const [n, okd] of t) { console.log(`  ${okd ? 'PASS' : 'FAIL'}  ${n}`); if (!okd) fails++; }
}

if (dump) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(dump, JSON.stringify({ url: URL, spots: world.spots, legs: dumped }));
  console.log(`\nraw trace written to ${dump} (${dumped.length} legs)`);
}

console.log(`\n${legs} legs walked, ${framesTotal} frames sampled, ${fails} failing`);
if (errors.length) console.log(`console errors: ${errors.length}\n  ${errors.slice(0, 5).join('\n  ')}`);
await browser.close();
process.exit(fails ? 1 : 0);
