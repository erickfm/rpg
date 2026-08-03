#!/usr/bin/env node
// ITEM 272 — CAN A PLAYER SEE ANY OF A SEATED CITIZEN BELOW THE SEAT?
//
//   the user: *"people sitting still looks bad because they have no legs??"*
//
// The complaint is not "the legs are unpainted" — they were painted. It is that
// NONE OF THE PAINT REACHES THE SCREEN: `citizenPlane` puts the seated origin
// on the seat top, the old block drew every leg row below that origin, and the
// seat's own front face stands between the sprite plane and the aisle. So the
// thing to assert is a RENDERING fact, and it is the one the user was looking
// at: is any of him visible below the seat line?
//
// ── HOW HIS PIXELS ARE IDENTIFIED, WITHOUT A COLOUR THRESHOLD ──────────────
//
// Shoot the same frame twice — once as it ships, once with only that one sprite
// `visible = false` — and difference them. Pixels that change ARE the pixels he
// was painting, exactly, including his black shoes, which no colour key can
// separate from a dark floor. Nothing else in the frame moves between the two
// shots because the camera does not move and the check does not advance a game
// minute (the world clock is frozen with `__ct.clock`).
//
// ── WHAT IS DERIVED, AND WHAT IS ASSERTED ─────────────────────────────────
//
//   seat row     his origin's world y, projected through the LIVE camera. The
//                origin IS the seat top — citizenPlane's own contract — so this
//                is read, never typed.
//   texel size   his sprite's projected height in px / 64 rows. The floor below
//                is stated in texels and converted with this, so it does not
//                assume a viewport, a distance or a field of view.
//   FLOOR        4 texels² of him must survive below the seat row. Not a
//                predicted number: the PRE-FIX value is 0 for every occluded
//                sitter (run the negative case below and watch it), so any
//                positive floor discriminates. 4 texels² is set only high
//                enough to be above single-pixel diff noise, which is measured
//                and reported per run rather than assumed.
//
// ── THE NEGATIVE CASE, WHICH IS THE ONLY REASON TO BELIEVE THE GREEN ──────
//
//   git stash push -- src/proto/ct/citizens.ts
//   SHOT_URL=... node scripts/probes/w112-legs-below-the-seat.mjs   # must FAIL
//   git stash pop
//
// ── SCOPE, STATED SO NOBODY OVER-READS IT ─────────────────────────────────
//
// A reader at a library desk or a teller at a counter is CORRECTLY hidden below
// the waist — that is what a desk does. Those rooms are listed in EXEMPT with
// the reason, and an exempt sitter that DOES show legs is reported, not failed:
// the exemption is about what this check can honestly assert, not a licence.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w112-legs-below-the-seat.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
const FLOOR_TEXELS = Number(process.env.FLOOR_TEXELS ?? 4);
const MIN_SITTERS = Number(process.env.MIN_SITTERS ?? 6);
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }

// Rooms whose furniture legitimately hides a sitter below the waist from every
// standing approach. Reported, never failed.
const EXEMPT = new Map([
  ['library', 'reading desks — a desk hides a reader below the waist, correctly'],
  ['bank', 'the loan counter stands between the player and the applicant'],
]);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });
// freeze the clock: the two frames of each pair must differ ONLY by the sprite
await p.evaluate(() => window.__ct.clock(13, 0));

const sitters = await p.evaluate(() => {
  const rooms = window.__ct.roomDims();
  const found = [];
  window.__ct.scene().traverse((o) => {
    // ⚠ NO `visible` TERM (GOTCHAS 79/79b). Being seated is an authoring fact;
    // every interior is culled until you stand in it, so a census that filtered
    // on visibility would find zero and say so in green.
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    const r = rooms.find((m) => Math.abs(q.x - m.cx) <= m.w / 2 && Math.abs(q.z - m.cz) <= m.d / 2);
    found.push({ room: r ? r.id : 'OUTSIDE', x: q.x, y: q.y, z: q.z, cz: r ? r.cz : q.z - 2 });
  });
  window.__W112S = [];
  window.__ct.scene().traverse((o) => { if (o.userData?.citizen && o.userData?.seated) window.__W112S.push(o); });
  return found;
});

console.log(`seated citizens found: ${sitters.length}  (floor ${MIN_SITTERS})`);
if (sitters.length < MIN_SITTERS) {
  console.log('EXIT 3 — population floor not met; this measured nothing.');
  await b.close(); process.exit(3);
}

const rows = [];
for (let i = 0; i < sitters.length; i++) {
  const s = sitters[i];
  // stand 2 m out on the room-centre side — a normal standing approach
  const dir = Math.sign(s.cz - s.z) || -1;
  const sx = s.x, sz = s.z + dir * 2.0;
  const yaw = Math.atan2(0, -(s.z - sz));      // rig yaw: 0 looks down −z (GOTCHAS 62)
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.14), [sx, sz, yaw]);
  // ── THE VANTAGE MUST SETTLE BEFORE ANYTHING IS PHOTOGRAPHED (item 288) ──
  //
  // A warp into another room changes what is culled in, and the default two
  // painted frames are not enough for it. Measured: this loop's jail sitter came
  // back `visible 2742, below 0` — "NO LEG BELOW THE SEAT" — while the SAME
  // sitter, shot after a clean settle, reads **11,081 px with 1,391 below**. The
  // giveaway is that 2742 is the pixel count of the sitter measured in the
  // PREVIOUS iteration: the frame being differenced still belonged to the last
  // vantage. Across two runs the values 3320 and 2742 swapped between the jail
  // bench and a casino stool, which is not something a world can do.
  //
  // That is GOTCHAS 80 exactly — `afterFrames`/`waitPainted` prove the renderer
  // drew, not that it drew THIS camera — and it had been manufacturing a
  // false defect that survived into a queue row.
  // SETTLE ON STABILITY, NOT ON A CLOCK. A fixed wait is GOTCHAS 30 and it only
  // moved the failure: eight painted frames stopped the jail sitter being
  // measured against the previous vantage, but the room was still fading during
  // the noise baseline, so the mask below swallowed the whole sprite and the
  // verdict flipped from a false FAIL to a false NOT VISIBLE. Both readings were
  // the settle, not the world.
  //
  // So: shoot pairs until the frame stops changing on its own. The casino's
  // animated screens never fully settle, which is what the try cap is for — and
  // what the mask exists to handle. `settled` is reported per sitter so an
  // exhausted cap is a number on the page, not a silent assumption.
  await waitPainted(p, { quiet: true, frames: 6 });
  let settleTries = 0, settleDelta = -1, calm = 0;
  for (; settleTries < 14; settleTries++) {
    const u = await p.screenshot();
    await waitPainted(p, { quiet: true, frames: 2 });
    await p.waitForTimeout(150);
    const v = await p.screenshot();
    settleDelta = await p.evaluate(async ([A, B]) => {
      const load = async (b64) => {
        const im = new Image();
        await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + b64; });
        const cv = document.createElement('canvas');
        cv.width = im.width; cv.height = im.height;
        cv.getContext('2d').drawImage(im, 0, 0);
        return cv.getContext('2d').getImageData(0, 0, im.width, im.height).data;
      };
      const x = await load(A), y = await load(B);
      let n = 0;
      for (let i = 0; i < x.length; i += 4) {
        if (Math.abs(x[i] - y[i]) > 8 || Math.abs(x[i + 1] - y[i + 1]) > 8
          || Math.abs(x[i + 2] - y[i + 2]) > 8) n++;
      }
      return n;
    }, [u.toString('base64'), v.toString('base64')]);
    // TWO CALM READINGS IN A ROW, not one. A room fading in passes through
    // arbitrarily small deltas on its way, so a single quiet sample is not
    // evidence that it has stopped — measured, the jail bench settled "calm" at
    // a delta under 2000 while its sitter was still fading up, and the noise
    // mask then swallowed the whole sprite (3,320 px of him marked as
    // self-changing) and reported NO LEG BELOW THE SEAT on a man whose leg is in
    // the photograph. The casino's reels never go calm at all, which is what the
    // try cap is for and what the mask exists to handle.
    if (settleDelta < 300) { if (++calm >= 2) break; } else calm = 0;
  }

  const geo = await p.evaluate(([idx]) => {
    const o = window.__W112S[idx];
    const cam = window.__ct.camera();
    const V = window.__ct.scene().position.constructor;
    const prj = (wx, wy, wz) => {
      const v = new V(wx, wy, wz).project(cam);
      return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
    };
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const g = o.geometry.boundingBox;
    const top = o.position.y + g.max.y * o.scale.y;
    const bot = o.position.y + g.min.y * o.scale.y;
    return {
      seatRow: prj(o.position.x, o.position.y, o.position.z).y,   // the ORIGIN = the seat top
      spriteTop: prj(o.position.x, top, o.position.z).y,
      spriteBot: prj(o.position.x, bot, o.position.z).y,
    };
  }, [i]);
  const pxPerTexel = Math.abs(geo.spriteBot - geo.spriteTop) / 64;

  // ── THE NOISE BASELINE COMES FIRST, AND IT IS NOT OPTIONAL ──────────────
  //
  // Two frames with NOTHING changed. The casino runs animated slot screens and
  // the sky moves, so a diff of two consecutive frames is not zero everywhere,
  // and the first run of this check read 299,004 "sprite" pixels off one casino
  // stool — 47% of the screen, for a sprite about 200 px tall. A verdict built
  // on that number would have been confident nonsense. Measured, printed, and
  // subtracted from the verdict below.
  // THREE baseline samples, and the verdict uses the WORST. One sample is not
  // enough: the slot reels move in bursts, so a single pair can land inside a
  // still moment, read noise 0, and hand the 2,743 px of moving reel to the
  // sprite. That is exactly what made this check FAIL on 1 run in 5 with the
  // world unchanged — on a casino stool that a photograph shows is entirely
  // behind its own cabinet (`shots/w112-room-casino-9-after.png`).
  const nz = [];
  for (let k = 0; k < 3; k++) {
    const q0 = await p.screenshot();
    await waitPainted(p, { quiet: true });
    nz.push([q0, await p.screenshot()]);
  }

  const a = await p.screenshot();
  await p.evaluate(([idx]) => { window.__W112S[idx].visible = false; }, [i]);
  await waitPainted(p, { quiet: true });
  const c = await p.screenshot();
  await p.evaluate(([idx]) => { window.__W112S[idx].visible = true; }, [i]);

  // ── SUBTRACT THE NOISE PER PIXEL, NOT PER COUNT (item 288) ──────────────
  //
  // The old form measured the noise as a NUMBER and took it off the sprite's
  // NUMBER. Two things were wrong with that, and both are visible in the run it
  // replaces. Arithmetically it produced **-1257.9 and -4640.9 texels²** — a
  // negative area, which is not a quantity the world can have. And logically a
  // count says nothing about WHERE: 35,700 noisy pixels on a slot screen were
  // being deducted from a sprite those pixels never overlapped, so the check
  // gave up on **4 of 5 casino sitters** as TOO NOISY while its own numbers held
  // the answer.
  //
  // A pixel that changes on its own between two frames with NOTHING altered
  // cannot be evidence about the sprite. So mask it out and never count it
  // again. That is general — it handles the slot reels, the sky, a lamp chase,
  // anything — where naming the animated meshes would have to be revisited
  // every time somebody adds one.
  //
  // IT CAN ONLY UNDER-COUNT, WHICH IS THE SAFE DIRECTION FOR A FLOOR. If a
  // sitter stands in front of an animated screen, hiding him reveals moving
  // pixels and those are masked away with the rest — so the check credits him
  // with less leg than he has, never more. `masked` is printed per run so that
  // suppression is a number on the page rather than a silent subtraction.
  const measure = async ([pairs, A, C, seatRow]) => {
    const load = async (b64) => {
      const im = new Image();
      await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + b64; });
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      cv.getContext('2d').drawImage(im, 0, 0);
      return { d: cv.getContext('2d').getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height };
    };
    // any channel differing by more than 8 — well inside 8-bit rounding but far
    // under a real repaint.
    const differs = (x, y, i) => Math.abs(x[i] - y[i]) > 8
      || Math.abs(x[i + 1] - y[i + 1]) > 8 || Math.abs(x[i + 2] - y[i + 2]) > 8;

    const first = await load(A);
    const mask = new Uint8Array(first.w * first.h);
    let masked = 0;
    for (const [P, Q] of pairs) {
      const u = await load(P), v = await load(Q);
      for (let k = 0; k < mask.length; k++) {
        if (!mask[k] && differs(u.d, v.d, k * 4)) { mask[k] = 1; masked++; }
      }
    }
    const y = await load(C);
    let all = 0, below = 0, lowest = -1, rawAll = 0;
    for (let r = 0; r < first.h; r++) {
      for (let q = 0; q < first.w; q++) {
        const k = r * first.w + q;
        if (!differs(first.d, y.d, k * 4)) continue;
        rawAll++;
        if (mask[k]) continue;                 // this pixel moves on its own
        all++;
        if (r > seatRow) { below++; if (r > lowest) lowest = r; }
      }
    }
    return { all, below, lowest, masked, rawAll };
  };
  const d = await p.evaluate(measure, [
    nz.map(([q0, q1]) => [q0.toString('base64'), q1.toString('base64')]),
    a.toString('base64'), c.toString('base64'), geo.seatRow,
  ]);
  // kept under the old names so the printed table and the verdict below read the
  // same; `noise` is now "how much of the frame was masked out", not a deduction.
  const noise = { all: d.masked, below: d.rawAll - d.all, lowest: -1 };

  const floorPx = FLOOR_TEXELS * pxPerTexel * pxPerTexel;
  const exempt = EXEMPT.get(s.room);
  // THREE OUTCOMES, NOT TWO. A sitter this vantage cannot see is UNMEASURED —
  // GOTCHAS 34: a check that found nothing to check must say so, not score it.
  //
  // NOISE IS TESTED FIRST, and that ordering is load-bearing. Testing
  // visibility first let one casino stool flip between NOT VISIBLE and NO LEG
  // BELOW THE SEAT on consecutive runs of identical code, because its noise
  // floated either side of the visible count — a check that changes its verdict
  // without the world changing is worse than no check.
  let state;
  // A 1.9 m sprite two metres away cannot be half the screen. When it reads as
  // one, the two frames differ for some reason other than the sprite — a room
  // fade, a lamp, a mid-transition frame — and the number is not about legs.
  // Seen once at 636,597 px of 640,000 on a jail bench, with a noise baseline
  // of 6, so the baseline alone does not catch it.
  const SCREEN = 1000 * 640;
  // ── AND A CEILING, WHICH THIS CHECK NEVER HAD (item 288) ────────────────
  //
  // Everything above is a FLOOR: "enough of him survives below the seat line".
  // A floor is satisfied by any amount of overshoot, which is how the double
  // correction of 2026-08-02 passed this very probe while putting two diners'
  // hips on the table edge.
  //
  // The ceiling is DERIVED FROM THE SPRITE, not chosen. `citizenPlane` puts a
  // seated origin at HIP_ROW 44 of 64 (`ct/citizens.ts:678`) and the plane is
  // 0.95 m wide against SPRITE_H_M 1.9 m, so the frame is 32 texels across.
  // Below the hip there are at most 64 - 44 = 20 rows. **No seated citizen can
  // honestly paint more than 20 x 32 = 640 texels² below his own seat line** —
  // there is no more sprite down there to paint with. A reading above that is
  // not a leg; it is the diff attributing something else to him.
  //
  // STATED SCOPE, because this ceiling is deliberately loose. It catches the
  // gross case (the sprite is not where the check thinks it is) and it does NOT
  // catch a 0.275 m over-correction — measured, that one only doubles the count,
  // from ~45 to ~110 texels², nowhere near 640. The tight ceiling for that is
  // geometric, not photographic, and lives in
  // `scripts/probes/w117-item288-hip-on-its-seat.mjs`. Two different questions;
  // this one must not be tightened until it appears to answer the other.
  const HIP_ROW = 44, FRAME_ROWS = 64, FRAME_COLS = Math.round(0.95 / 1.9 * 64);
  const CEIL_TEXELS = (FRAME_ROWS - HIP_ROW) * FRAME_COLS;      // 640
  const belowTexels = d.below / (pxPerTexel * pxPerTexel);
  if (d.all > 0.5 * SCREEN) state = 'IMPLAUSIBLE — the diff is most of the screen, not a sprite';
  else if (d.all <= floorPx) state = 'NOT VISIBLE from this vantage';
  else if (belowTexels > CEIL_TEXELS) state = `IMPLAUSIBLE — ${belowTexels.toFixed(0)} texels² below the seat, over the ${CEIL_TEXELS} the sprite HAS`;
  else if (d.below >= floorPx) state = 'ok';
  else state = 'NO LEG BELOW THE SEAT';
  rows.push({ room: s.room, x: s.x, z: s.z, all: d.all, below: d.below, settleTries, settleDelta,
    noiseAll: noise.all, noiseBelow: noise.below,
    texels: belowTexels, floorPx, ceilTexels: CEIL_TEXELS, exempt, state });
}

console.log('\nvisible sprite pixels, and how many of them are BELOW the seat line');
console.log('(noise = the same two numbers for two frames with NOTHING changed):');
let bad = 0, judged = 0;
for (const r of rows) {
  const verdict = r.exempt && r.state === 'NO LEG BELOW THE SEAT' ? 'exempt by furniture'
    : r.exempt && r.state === 'ok' ? 'ok (exempt, but visible anyway)' : r.state;
  if (r.state === 'ok' || (r.state === 'NO LEG BELOW THE SEAT' && !r.exempt)) judged++;
  if (r.state === 'NO LEG BELOW THE SEAT' && !r.exempt) bad++;
  console.log(`  ${r.room.padEnd(9)} (${r.x.toFixed(2)}, ${r.z.toFixed(2)})  `
    + `visible ${String(r.all).padStart(6)}   below ${String(r.below).padStart(6)}`
    + `   noise ${String(r.noiseAll).padStart(6)}/${String(r.noiseBelow).padStart(5)}`
    + `   = ${r.texels.toFixed(1).padStart(7)} texels² (floor ${r.floorPx.toFixed(0)})   ${verdict}`);
}
console.log(`\n${rows.length} sitters; ${judged} actually judged; ${bad} showing nothing below their seat.`);
for (const [k, why] of EXEMPT) console.log(`  exempt: ${k} — ${why}`);
await b.close();
if (errs.length) console.log(`console errors: ${errs.length}`);
// ── COVERAGE IS NOW A FRACTION OF THE POPULATION, NOT A CONSTANT (item 288) ──
//
// The old floor was `judged >= 6` against a population of 14. That is 43%, and
// it was set to the coverage the check happened to achieve — so the run where
// four casino sitters went TOO NOISY scored PASS while judging under half the
// world. *"A check that silently judges 43% of its population is a floor problem
// of a different kind."*
//
// So the floor is stated as a share and the ABSOLUTE number is derived from the
// population actually found, which means it tracks the world instead of a
// number typed a fortnight ago. `MIN_JUDGED_FRAC` is the one knob and it is
// stated, not silent: every run prints the coverage it achieved either way.
// A RATCHET AT THE MEASURED VALUE, AND SAID PLAINLY. Coverage today is 6 of 10
// non-exempt (60%); the floor sits just under it at 55% so that a REGRESSION in
// coverage fails while today's world passes. That is not the same thing as
// "loosen it until it goes green", and the difference is worth stating because
// it looks identical from the outside: the assertion this guards (0 sitters
// showing nothing below their seat) reads 0 at every setting, and the floor is
// here only to stop the check quietly measuring less of the world over time.
//
// **60% IS NOT THE TARGET.** Item 288 asks for all 14. The 4 non-exempt sitters
// still unjudged are named in the EXIT 3 block below, and what would reach them
// is in this file's handoff — freezing the slot reels for the diff, which is a
// change to `ct/slots.ts` and not this probe's to make.
const MIN_JUDGED_FRAC = Number(process.env.MIN_JUDGED_FRAC ?? 0.55);
// SAME BASIS ON BOTH SIDES OF THE RATIO. The first cut divided `judged` — which
// counts exempt sitters that turned out visible — by the NON-EXEMPT population,
// and reported "8 of 10" from two different populations. A coverage number that
// cannot be recomputed from its own two counts is the kind of figure this repo
// has been burned by; both sides are non-exempt now.
const judgeable = rows.filter((r) => !r.exempt).length;
const judgedHere = rows.filter((r) => !r.exempt
  && (r.state === 'ok' || r.state === 'NO LEG BELOW THE SEAT')).length;
const need = Math.ceil(judgeable * MIN_JUDGED_FRAC);
console.log(`\ncoverage: ${judgedHere} of ${judgeable} non-exempt sitters judged `
  + `(${(100 * judgedHere / Math.max(1, judgeable)).toFixed(0)}%, floor ${(100 * MIN_JUDGED_FRAC).toFixed(0)}% = ${need})`
  + `   [${judged} judged overall, incl. exempt sitters that proved visible]`);
if (judgedHere < need || judged < MIN_SITTERS) {
  console.log(`\nEXIT 3 — only ${judgedHere} non-exempt sitter(s) could be judged from a standing vantage `
    + `(floor ${Math.max(MIN_SITTERS, need)} = max(${MIN_SITTERS} absolute, ${need} = ${(100 * MIN_JUDGED_FRAC).toFixed(0)}% of ${judgeable})).`
    + ` This run measured too little to have an opinion.`);
  for (const r of rows) {
    if (r.state !== 'ok' && r.state !== 'NO LEG BELOW THE SEAT') {
      console.log(`    unjudged: ${r.room.padEnd(9)} (${r.x.toFixed(2)}, ${r.z.toFixed(2)})  ${r.state}`);
    }
  }
  process.exit(3);
}
console.log(`\n${bad === 0 ? 'PASS' : 'FAIL'} — ${bad} seated citizen(s) show nothing below the seat they are on.`);
process.exit(bad === 0 ? 0 : 1);
