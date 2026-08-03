// THE [E] SIGHT GATE ASSUMES THE PLAYER IS ON THE GROUND FLOOR.
//
// `crosstown.ts` builds the visibility ray from a hardcoded eye:
//
//     const eye = new THREE.Vector3(px, 1.6, pz);
//     aim.set(s.x, groundPick(s.x, s.z) + 1.1, s.z);
//
// but `rig.pos.y` is height ABOVE THE CURRENT FLOOR, not world y — it reads a
// constant 1.62 on the street and in a third-floor room alike — and the floor
// itself is `apt.gy()`. So the player's true eye is `gy + rig.pos.y`, and the
// ray is built from 1.6 regardless.
//
//   street/ATM   gy 0.14   true eye 1.76   ray from 1.60   error 0.16 m
//   apartment    gy 5.40   true eye 7.02   ray from 1.60   error 5.42 m
//
// In 301 the ray therefore starts 5.4 m BELOW the floor the player is standing
// on and aims at groundPick + 1.1 = 6.5, so it travels up through the floor
// slab, is stopped by it, and canSee returns false for everything. Every [E]
// spot in that room is unselectable: not the door, and not "sleep until
// morning" standing 1.30 m from it with a reach of 1.35.
//
// FOUND while trying to verify C's "close this door" row, and it is why that
// row cannot be verified — the defect is in the sight gate, not in C's door.
// It also explains E's four presses doing nothing.
//
// The check is the invariant rather than the symptom: wherever the player can
// stand, the eye the gate uses must be the eye the player has. A symptom test
// ("is the door promptable") would go green the moment somebody moved the room
// to y 0 and would say nothing about the next elevated interior.
//
//   node scripts/A-eye-height-holds.mjs [port]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const ARG = process.argv[2];
const URL = process.env.SHOT_URL
  ?? (ARG && /^\d+$/.test(ARG) ? `http://localhost:${ARG}/` : ARG)
  ?? 'http://localhost:4188/';

// FIXED, and this constant had to move with it. crosstown.ts:921 now reads
// `apt.gy() + 1.6` where it read a bare 1.6, so the gate's eye tracks the floor
// the player is on. Comparing against a flat 1.6 would keep printing a 5.42 m
// error in 301 that no longer exists — my own stale number, in my own script,
// about the fault I filed. The diagnostic is the gate's rule, not a constant.
const gateEye = (gy) => gy + 1.6;
const TOL = 0.5;               // a step's worth of slop; 5.4 m is not slop
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2500);
await reportWorld(p, URL);

// Every floor the player can be put on, taken from the rooms the world declares
// rather than from a list I typed.
const rooms = await p.evaluate(() => window.__ct.roomDims().map((r) => ({ id: r.id, cx: r.cx, cz: r.cz })));
const places = [
  { id: 'street (bank ATM)', x: -5.6, z: 7.29 },
  ...rooms.map((r) => ({ id: `room ${r.id}`, x: r.cx, z: r.cz })),
];

const rows = [];
// THE SPAWN IS READ FIRST AND IS NEVER WARPED TO, because it cannot be. The
// player begins in 301 with a floor of 5.4, and warping back to those same
// coordinates later resolves the floor to 0 — the apartment is a floor CONTEXT
// entered through its door, not a place on the map. So a warp-based probe of
// 301 measures the street under the building and goes green having never been
// in the room. My first version did exactly that and reported MEASURED FINE.
{
  const v = await p.evaluate(() => window.__ct.pos());
  const trueEye = v[3] + v[1];
  rows.push({ id: 'apartment 301 (spawn)', gy: +v[3].toFixed(2),
              trueEye: +trueEye.toFixed(2), err: +(trueEye - gateEye(v[3])).toFixed(2) });
}
for (const q of places) {
  // READ AFTER THE FRAME, NOT IN THE SAME TICK. `warp(x, z)` leaves gy alone and
  // the world resolves the new floor on the next frames, so reading pos()
  // immediately returns the PREVIOUS room's floor. My first version did, and it
  // printed the apartment's 5.4 against the label "street" and the street's 0.14
  // against "apartment" — the fault was real and the two rows were swapped,
  // which is the most persuasive way to be wrong.
  await p.evaluate(([x, z]) => window.__ct.warp(x, z), [q.x, q.z]);
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const v = window.__ct.pos(); return { rigY: v[1], gy: v[3] }; });
  const trueEye = r.gy + r.rigY;
  rows.push({ ...q, gy: +r.gy.toFixed(2), trueEye: +trueEye.toFixed(2),
              err: +(trueEye - gateEye(r.gy)).toFixed(2) });
}

console.log(`\nthe gate builds its ray from apt.gy() + 1.6; the player's eye is gy + rig.pos.y\n`);
console.log(`  ${'where'.padEnd(24)} ${'floor'.padStart(6)} ${'true eye'.padStart(9)} ${'error'.padStart(7)}`);
for (const r of rows) {
  const bad = Math.abs(r.err) > TOL;
  console.log(`  ${bad ? '**' : '  '}${r.id.padEnd(22)} ${String(r.gy).padStart(6)} ${String(r.trueEye).padStart(9)} ${String(r.err).padStart(7)}`);
}
const bad = rows.filter((r) => Math.abs(r.err) > TOL);
console.log(`\nplaces where the gate's eye is more than ${TOL} m from the player's: ${bad.length} of ${rows.length}`);

// THE ASSERTION IS THE SYMPTOM, NOT THE ARITHMETIC ABOVE. Failing on the eye
// gap alone would stay RED after somebody fixes crosstown.ts to build the eye
// from gy + rig.pos.y, because this script hardcodes 1.6 exactly as the gate
// does — a check that cannot go green when the defect is repaired is worse than
// no check. So the numbers are the DIAGNOSIS and the test is what the player
// gets: in the room they spawn in, standing next to a live [E] spot, is it
// offered?
//
// Reloaded so the spawn context is real: the apartment is a floor entered
// through its door and cannot be warped back into.
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(3000);
// A STEP FIRST. canSee refuses everything while `landing` is set — "just
// arrived here; take a step first" — and it clears past 1.2 m, so a probe that
// never walks cannot tell that latch from a broken gate.
// WALK AWAY PAST 1.2 m, THEN WALK BACK. One short step is not enough: my first
// version moved 1.15 m, five centimetres short of the threshold, so a latched
// gate and a broken one would have looked identical. `landing` is cleared for
// good once the player is more than 1.2 m from where they arrived, so the walk
// out is what disarms it and the walk back is what puts them beside the spot.
const walk = async (key, frames) => {
  await p.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), key);
  for (let i = 0; i < frames; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  await p.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k })), key);
  await p.waitForTimeout(250);
  return p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
};
const start = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
// 301 is small and every single direction runs into a wall inside 1.2 m from
// the spawn point, so the walk out is a ROUTE rather than one key: s then d
// clears it, measured at 4.74 m. Tried and reported, because "could not walk
// clear" is a real outcome this check must be able to reach.
// 301 is small, and WALKING IS RELATIVE TO FACING — pressing 'w' without
// choosing a yaw just walks into whichever wall the spawn happens to face, which
// is how three attempts of mine stalled at 1.15, 0.66 and 1.16 m, each a few
// centimetres short of the threshold and each looking like a result. Turning
// costs nothing and does not move the player or change the floor, so the walk
// out tries every direction and keeps the best.
let away = start, far = 0;
for (let k = 0; k < 8 && far <= 1.2; k++) {
  await p.evaluate(([yaw]) => { const v = window.__ct.pos(); window.__ct.warp(v[0], v[2], yaw); }, [k * Math.PI / 4]);
  await p.waitForTimeout(120);
  away = await walk('w', 80);
  far = Math.hypot(away[0] - start[0], away[2] - start[2]);
}
console.log(`\nwalked ${far.toFixed(2)} m from the spawn point (the latch clears past 1.2 m)`);
if (far <= 1.2) {
  console.error(`\nCANNOT ANSWER — could not walk clear of the arrival latch, so a latched gate`);
  console.error(`  and a broken one cannot be told apart. Nothing was measured.`);
  await b.close(); process.exit(3);
}
// back toward the spawn, and the latch is already cleared for good by now
await p.evaluate(([x, z]) => { const v = window.__ct.pos(); window.__ct.warp(v[0], v[2], Math.atan2(x - v[0], -(z - v[2]))); }, [start[0], start[2]]);
await p.waitForTimeout(120);
await walk('w', 80);
await p.waitForTimeout(300);

// ── THE MARGIN IS READ FROM THE WORLD, AND IT IS THE TOUCH ONE (item 232) ───
//
// This filter was `s.d <= s.r + 0.6` — a hand-typed copy of `REACH_MARGIN`, so
// `grep REACH_MARGIN` did not even find it. Two faults in one line.
//
// WRONG CONSTANT. For a STANDING player `fp.ts:991` decides the aim-free offer
// with `d < s.r + TOUCH_MARGIN` (0.15). `REACH_MARGIN` (0.6) governs only the
// SEATED clause (`fp.ts:1006`) and the debug ring (`fp.ts:1124`) — neither is
// this. Measured cost of the difference: `probes/w88-margin-population.mjs`
// stands in the disputed ring r+0.15 .. r+0.60 at 11 live spots facing away and
// the world offers **0 of 11**, while a r+0.6 filter counts all 11.
//
// WHY IT MATTERS HERE SPECIFICALLY. This list is the candidate set for the
// verdict below: too generous, and the check can report "the spawn room offers
// what the player is standing next to" on the strength of a spot the player is
// NOT standing next to and can only get by turning to face it. The sentence it
// prints becomes untrue while the check stays green.
//
// HAND-TYPED, so it also could not follow a re-tune. `__ct.touchMargin()` is
// published for exactly this (item 223) and resolves on the BUILT bundle;
// `await import('/src/proto/fp.ts')` does NOT — it 404s under `vite preview`,
// which is how seven harnesses silently fell back to a default.
const TOUCH_MARGIN = await p.evaluate(() => window.__ct.touchMargin?.());
if (typeof TOUCH_MARGIN !== 'number' || !isFinite(TOUCH_MARGIN)) {
  console.error('ABORT: __ct.touchMargin() did not return a number — the candidate set below cannot be built.');
  await b.close(); process.exit(3);                          // GOTCHAS §32
}
const reach = await p.evaluate(([margin]) => {
  const v = window.__ct.pos();
  return window.__ct.spots().filter((s) => s.ok)
    .map((s) => ({ label: s.label, d: Math.hypot(s.x - v[0], s.z - v[2]), r: s.r, x: s.x, z: s.z }))
    .filter((s) => s.d <= s.r + margin)
    .sort((a, c) => a.d - c.d);
}, [TOUCH_MARGIN]);
const here = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log(`\nafter one step, standing at (${here[0]}, ${here[2]}) on floor ${here[3]}`);
console.log(`live [E] spots the player is TOUCHING (r + ${TOUCH_MARGIN}): ${reach.length}`);
for (const s of reach) console.log(`   ${s.label} at ${s.d.toFixed(2)} m (touch bound ${(s.r + TOUCH_MARGIN).toFixed(2)})`);

let offered = null;
for (const s of reach) {
  for (let k = 0; k < 12 && !offered; k++) {
    await p.evaluate(([yaw]) => { const v = window.__ct.pos(); window.__ct.warp(v[0], v[2], yaw); }, [k * Math.PI / 6]);
    await p.waitForTimeout(180);
    // ── `#ct-prompt`.textContent IS A GHOST (found on item 232) ─────────────
    //
    // `ct/hud.ts:1715` hides the prompt with `style.display = 'none'` and
    // RETURNS WITHOUT CLEARING THE TEXT. The element therefore keeps the last
    // thing it ever offered, permanently. Measured in
    // `probes/w88-does-prompt-clear.mjs`: warped 40 m up the street from the
    // jail door, and after a real 'w' movement nudge, `textContent` still read
    // "[E] into the HOUSE OF DETENTION".
    //
    // THIS CHECK'S WHOLE VERDICT RESTS ON THIS READ, and it is a false-green:
    // the walk above passes within touching distance of several spots, so by
    // the time the facings loop runs, the element is already populated. The old
    // read would report "the spawn room offers what the player is standing next
    // to" on the strength of a prompt that had been hidden many seconds and
    // several metres earlier — including in the exact case this check exists to
    // catch, where the sight gate is broken and NOTHING is really offered.
    //
    // `display` is the truth; `textContent` is only the caption on it.
    const t = await p.evaluate(() => {
      const el = document.getElementById('ct-prompt');
      if (!el || getComputedStyle(el).display === 'none') return null;
      return (el.textContent ?? '').trim() || null;
    });
    if (t) offered = t;
  }
}
await p.screenshot({ path: 'shots/A-eye-height-spawnroom.png' });
console.log(`\nprompt offered in the spawn room: ${offered ?? 'NONE, at any facing, beside every one of them'}`);
await b.close();
if (!reach.length) {
  console.error(`\nCANNOT ANSWER — no live [E] spot within reach after the step; nothing was tested.`);
  process.exit(3);                                       // GOTCHAS 32/34
}
if (!offered) {
  console.error(`\nMEASURED WRONG — the player spawns in 301 and CANNOT USE ANYTHING IN IT.`);
  console.error(`  ${reach.length} live [E] spot(s) are within reach and none is offered at any facing.`);
  console.error(`  Diagnosis above: the sight ray's origin does not match the player's eye`);
  console.error(`  is ${rows[0].trueEye} — it starts ${rows[0].err} m under the floor and is stopped by it.`);
  console.error(`  crosstown.ts should build the eye from the player's floor, not a constant.`);
  process.exit(1);
}
console.log(`\nMEASURED FINE — the spawn room offers what the player is standing next to.`);
