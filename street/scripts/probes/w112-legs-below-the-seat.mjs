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
  await waitPainted(p, { quiet: true });

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

  const diff = async ([A, B, seatRow]) => {
    const load = async (b64) => {
      const im = new Image();
      await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + b64; });
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      cv.getContext('2d').drawImage(im, 0, 0);
      return { d: cv.getContext('2d').getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height };
    };
    const x = await load(A), y = await load(B);
    let all = 0, below = 0, lowest = -1;
    for (let r = 0; r < x.h; r++) {
      for (let q = 0; q < x.w; q++) {
        const i = (r * x.w + q) * 4;
        // any channel differing by more than 8 — well inside 8-bit rounding but
        // far under a real repaint. The per-run count is printed, so a noisy
        // frame shows up as a number instead of hiding inside a verdict.
        if (Math.abs(x.d[i] - y.d[i]) > 8 || Math.abs(x.d[i + 1] - y.d[i + 1]) > 8
          || Math.abs(x.d[i + 2] - y.d[i + 2]) > 8) {
          all++;
          if (r > seatRow) { below++; if (r > lowest) lowest = r; }
        }
      }
    }
    return { all, below, lowest };
  };
  let noise = { all: 0, below: 0, lowest: -1 };
  for (const [q0, q1] of nz) {
    const m = await p.evaluate(diff, [q0.toString('base64'), q1.toString('base64'), geo.seatRow]);
    noise = { all: Math.max(noise.all, m.all), below: Math.max(noise.below, m.below), lowest: -1 };
  }
  const d = await p.evaluate(diff, [a.toString('base64'), c.toString('base64'), geo.seatRow]);

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
  if (d.all > 0.5 * SCREEN) state = 'IMPLAUSIBLE — the diff is most of the screen, not a sprite';
  else if (noise.all > 0.25 * d.all) state = 'TOO NOISY to judge (animated screens)';
  else if (d.all - noise.all <= floorPx) state = 'NOT VISIBLE from this vantage';
  else if (d.below - noise.below >= floorPx) state = 'ok';
  else state = 'NO LEG BELOW THE SEAT';
  rows.push({ room: s.room, x: s.x, z: s.z, all: d.all, below: d.below,
    noiseAll: noise.all, noiseBelow: noise.below,
    texels: (d.below - noise.below) / (pxPerTexel * pxPerTexel), floorPx, exempt, state });
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
if (judged < MIN_SITTERS) {
  console.log(`\nEXIT 3 — only ${judged} sitter(s) could be judged from a standing vantage `
    + `(floor ${MIN_SITTERS}). This run measured too little to have an opinion.`);
  process.exit(3);
}
console.log(`\n${bad === 0 ? 'PASS' : 'FAIL'} — ${bad} seated citizen(s) show nothing below the seat they are on.`);
process.exit(bad === 0 ? 0 : 1);
