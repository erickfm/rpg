// WALK to the three seats item 307 names, sit, and GET OUT. Five runs each.
//
// The item: *"you sit in the bank client chair, on a slot stool, and on 301's
// bed, and get out of each one, five runs each"* — *"walked in a browser and
// not screenshotted"*. So the approach and the departure are done with the W
// key through the real collision system, never by warping onto the pose:
// I-seat-exit's own header records that the whole class of seat bug it was
// written for *"only appears when sitting TELEPORTS you, which is what happens
// to every player who walks up to a seat and never happens to a probe that
// starts on top of it."*
//
// What is warped, and why it is not a cheat: the player is placed a few metres
// from the seat to begin (301, the bank and the casino are hundreds of metres
// apart and the point here is the seat, not the commute), and TURNING is done
// by re-warping to the player's OWN position with a new yaw — a rotation of
// zero translation, which is what a mouse does. Every metre of approach and
// every metre of the walk away is `keyboard.down('w')` through `FPRig.update`.
//
// THE EXIT KEY IS READ OFF THE SCREEN, NOT ASSUMED. The seated prompt names it
// — `[ESC] stand up`, `[ESC] stop watching TV`, or the unjoined `[E] <exit>` —
// and this presses whatever it says, which is the contract the player is
// actually given. That is the whole disagreement behind the three red checks
// (items 188 and 206 moved the exit off `[E]` and onto `[ESC]`), so assuming a
// key here would be assuming the answer.
//
// Usage: SHOT_URL=http://127.0.0.1:4190/ node scripts/probes/w132-walk-three-seats.mjs [--runs 5]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://127.0.0.1:4190/');
const argv = process.argv.slice(2);
const RUNS = Number(argv[argv.indexOf('--runs') + 1]) || 5;
const WANT = [/sit in the client chair/i, /sit at the slot/i, /sit on the bed/i];

const b = await chromium.launch();
let p;
const fresh = async () => {
  if (p) await p.close();
  p = await b.newPage({ viewport: { width: 800, height: 520 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  await p.waitForTimeout(1100);
};
await fresh();

const pos = () => p.evaluate(() => window.__ct.pos());              // [x, eyeY, z, gy]
const seated = () => p.evaluate(() => window.__ct.seated() !== null);
const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const prompt = () => p.evaluate(() => {
  const e = document.getElementById('ct-prompt');
  return e && e.style.display !== 'none' ? (e.textContent ?? '') : '';
});
const press = async (k, settle = 800) => {
  await p.keyboard.down(k); await p.waitForTimeout(110); await p.keyboard.up(k); await p.waitForTimeout(settle);
};
/** Rotate on the spot — same position, new yaw. Zero translation.
 *
 *  THE YAW IS `atan2(dx, -dz)` AND THE SIGN IS NOT COSMETIC. `fp.ts` builds its
 *  forward vector as `(sin yaw, 0, -cos yaw)`, so facing a point needs the z
 *  term negated; `atan2(dx, dz)` points you 180° AWAY. Measured on the open
 *  street rather than reasoned — walk 0.4 s at a target 5 m ahead:
 *
 *      atan2(dx,  dz):  5.00 m -> 6.39 m   (further)
 *      atan2(dx, -dz):  5.00 m -> 4.01 m   (closer)
 *
 *  This is GOTCHAS 62's family — a seat's yaw and a facing use opposite zero
 *  directions — and the wrong form is copied around `scripts/`: `I-seat-exit`'s
 *  own "AIM AT THE SEAT" step (the one whose comment says a probe looking the
 *  wrong way records "did not sit" for a perfectly sittable seat) uses
 *  `atan2(dx, dz)` and therefore aims the player directly away from it. */
const face = async (tx, tz) => {
  await p.evaluate(([X, Z]) => {
    const q = window.__ct.pos();
    window.__ct.warp(q[0], q[2], Math.atan2(X - q[0], -(Z - q[2])));
  }, [tx, tz]);
  await p.waitForTimeout(120);
};

const seats = await p.evaluate(() => window.__ct.seats().map((s, i) => ({
  i, label: s.label, pose: { x: s.pose.x, z: s.pose.z }, at: { x: s.at.x, z: s.at.z },
})));

/** Walk toward (tx,tz) with the W key until within `stop` m or out of tries.
 *  Returns metres actually covered on foot. */
const walkTo = async (tx, tz, stop = 0.35, tries = 26) => {
  const start = await pos();
  let covered = 0, prev = start;
  for (let i = 0; i < tries; i++) {
    const q = await pos();
    if (Math.hypot(q[0] - tx, q[2] - tz) <= stop) break;
    await face(tx, tz);
    await p.keyboard.down('w'); await p.waitForTimeout(150); await p.keyboard.up('w');
    await p.waitForTimeout(60);
    const r = await pos();
    covered += Math.hypot(r[0] - prev[0], r[2] - prev[2]);
    prev = r;
  }
  return covered;
};

const results = [];
for (const re of WANT) {
  const s = seats.find((q) => re.test(q.label));
  const runs = [];
  for (let run = 1; run <= RUNS; run++) {
    await fresh();
    const rec = { run, backedOff: 0, walkedIn: 0, sat: false, seatedPrompt: '', exitKey: null,
      presses: 0, gotOut: false, walkedOut: 0, note: '' };

    // ── GET TO THE APPROACH POINT, THEN BACK OFF ON FOOT AND WALK IN ────────
    //
    // THE STOREY HAS TO BE SET WITH THE POSITION. `warp(x, z, yaw)` leaves `gy`
    // alone, and the player SPAWNS IN 301 at gy 5.4 (GOTCHAS 51/79b), so a warp
    // to the bank at gy 5.4 puts him a storey above its floor: the first cut of
    // this probe walked 11.5 m around the bank with an empty prompt and
    // reported the client chair unsittable. `groundAt` answers relative to the
    // storey you are already on (the picker has hysteresis, GOTCHAS 7), so ask
    // it AFTER moving to the spot and then re-warp with the answer.
    //
    // AND THE WALK STARTS FROM `at`, BACKWARDS, rather than from a point
    // computed 2.6 m out along the approach bearing. That computed point is
    // not a place: the second cut of this probe put the player inside the next
    // bank of slot machines and covered 0.66 m of a 2.6 m approach before the
    // colliders stopped him. `at` is the one square the world itself publishes
    // as where you stand to use this seat, so backing out of it with `S` and
    // returning with `W` walks a corridor that is known to exist — and it is
    // still the collision system carrying every metre in both directions.
    // WHICH SQUARE ACTUALLY OFFERS THIS SEAT. Usually `at` does. The bed's does
    // NOT: it carries a second spot and from `at` the prompt reads
    // `[E] sleep until morning`, so a probe that trusts `at` reports the
    // television seat unsittable (K-tv-off-unless-seated documents the same
    // thing and sweeps for a square too). The sweep is done by warping because
    // it is a SEARCH, not the measurement; the approach and the exit that this
    // check is actually about are walked, below.
    const stand = await p.evaluate(([ax, az, px, pz, label]) => {
      const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const el = () => document.getElementById('ct-prompt')?.textContent ?? '';
      window.__ct.warp(ax, az, 0);
      const gy = window.__ct.groundAt(ax, az);
      const tries = [[0, 0]];
      for (let r = 0.35; r <= 1.4; r += 0.35) {
        for (let k = 0; k < 12; k++) tries.push([Math.cos(k * Math.PI / 6) * r, Math.sin(k * Math.PI / 6) * r]);
      }
      return { tries, gy, ax, az, px, pz, re: re.source, prompt: el() };
    }, [s.at.x, s.at.z, s.pose.x, s.pose.z, s.label]);
    let found = null;
    for (const [ox, oz] of stand.tries) {
      await p.evaluate(([X, Z, G, PX, PZ]) => {
        window.__ct.warp(X, Z, Math.atan2(PX - X, -(PZ - Z)), G);   // face the seat — see `face()`
      }, [s.at.x + ox, s.at.z + oz, stand.gy, s.pose.x, s.pose.z]);
      await p.waitForTimeout(180);
      const q = await prompt();
      if (new RegExp(s.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(q)) {
        found = { x: s.at.x + ox, z: s.at.z + oz }; break;
      }
    }
    if (!found) { rec.note = 'no square around the seat offers it at all'; runs.push(rec); continue; }
    rec.stand = found;
    await p.evaluate(([X, Z, G]) => window.__ct.warp(X, Z, 0, G), [found.x, found.z, stand.gy]);
    await p.waitForTimeout(300);
    await face(s.pose.x, s.pose.z);
    const back0 = await pos();
    for (let i = 0; i < 8; i++) { await p.keyboard.down('s'); await p.waitForTimeout(140); await p.keyboard.up('s'); await p.waitForTimeout(45); }
    const back1 = await pos();
    rec.backedOff = Math.hypot(back1[0] - back0[0], back1[2] - back0[2]);
    await p.waitForTimeout(200);
    rec.walkedIn = await walkTo(found.x, found.z, 0.30);
    await face(s.pose.x, s.pose.z);
    await p.waitForTimeout(280);

    // Sit with [E] — the prompt is the authority on whether it is on offer.
    const seatRe = new RegExp(s.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    let q = await prompt();
    if (seatRe.test(q)) await press('e');
    rec.sat = await seated();
    if (!rec.sat) rec.note = `prompt on arrival was ${JSON.stringify(q)}`;
    if (!rec.sat) { rec.note = `never sat; prompt was ${JSON.stringify(await prompt())}`; runs.push(rec); continue; }

    // ── GET OUT, pressing whatever the screen names ────────────────────────
    for (let i = 1; i <= 4; i++) {
      const sp = await prompt();
      const pn = await panel();
      if (i === 1) rec.seatedPrompt = sp || (pn ? `(panel ${pn} up, prompt hidden)` : '(no prompt)');
      // `[ESC] …` is the exit half of the joined seated prompt. With a panel up
      // there is no prompt at all and Escape is the panel's own way out.
      const key = /\[ESC\]/.test(sp) || pn ? 'Escape' : 'e';
      if (!rec.exitKey) rec.exitKey = key;
      await press(key);
      rec.presses = i;
      if (!(await seated())) { rec.gotOut = true; break; }
    }
    if (rec.gotOut) {
      // WALK AWAY FROM THE SEAT, NOT INTO IT — AND NOT ON ONE BEARING ONLY.
      //
      // `stand()` puts you back on the square you sat down from, still FACING
      // the chair, so holding W there walks you into the thing you just got off:
      // one cut of this probe read that as `walked away 0.00 m` on three seats
      // that were completely fine.
      //
      // Turning 180° is not enough either. The slot stool's own published `at`
      // is INSIDE a collider — warp to it and `unstick` shoves you from z 14.17
      // to 13.64 — and from there the bearing straight back from the machine is
      // the one blocked direction. Measured, eight compass bearings from that
      // spot: 0.00, 0.09, 0.11, 0.14, 0.21, 0.94, 1.40, 1.48 m. A player who
      // stands up and finds a machine behind him turns and walks out sideways,
      // so the question is "can he move AT ALL", not "can he move on the one
      // bearing this script happened to pick". Best of eight; bearing reported.
      const a = await pos();
      let best = 0, bestAng = null;
      for (let k = 0; k < 8 && best <= 0.15; k++) {
        const ang = k * Math.PI / 4;
        await p.evaluate(([X, Z, A]) => window.__ct.warp(X, Z, A), [a[0], a[2], ang]);
        await p.waitForTimeout(140);
        for (let i = 0; i < 4; i++) { await p.keyboard.down('w'); await p.waitForTimeout(150); await p.keyboard.up('w'); await p.waitForTimeout(45); }
        const c = await pos();
        const d = Math.hypot(c[0] - a[0], c[2] - a[2]);
        if (d > best) { best = d; bestAng = Math.round(ang * 180 / Math.PI); }
        if (d <= 0.15) { await p.evaluate(([X, Z]) => window.__ct.warp(X, Z), [a[0], a[2]]); await p.waitForTimeout(120); }
      }
      rec.walkedOut = best; rec.walkedBearing = bestAng;
    }
    runs.push(rec);
  }
  results.push({ label: s.label, runs });
}

console.log('');
let bad = 0, total = 0;
for (const r of results) {
  console.log(`  ${r.label}`);
  for (const q of r.runs) {
    total++;
    const okRun = q.sat && q.gotOut && q.walkedOut > 0.15;
    if (!okRun) bad++;
    console.log(`     run ${q.run}: backed off ${q.backedOff.toFixed(2)} m, walked in ${q.walkedIn.toFixed(2)} m · sat ${q.sat ? 'yes' : 'NO'}`
      + ` · exit key ${String(q.exitKey ?? '--').padEnd(6)} x${q.presses}`
      + ` · out ${q.gotOut ? 'yes' : 'NO'} · walked away ${q.walkedOut.toFixed(2)} m`
      + `${q.walkedBearing === null || q.walkedBearing === undefined ? '' : ` (bearing ${q.walkedBearing}°)`}`
      + `${okRun ? '' : '   <-- FAILED'}${q.note ? `   ${q.note}` : ''}`);
  }
  const p0 = r.runs.find((x) => x.seatedPrompt);
  console.log(`     seated prompt: ${JSON.stringify(p0?.seatedPrompt ?? '')}\n`);
}
console.log(total
  ? (bad
    ? `FAIL  ${bad} of ${total} walked runs did not sit, did not get out, or could not walk away.`
    : `PASS  ${total} walked runs: sat on all three seats, got out of every one, `
      + `and walked away from every one.`)
  : 'FAIL  no runs were performed — nothing measured.');
console.log('');
await b.close();
process.exit(bad || !total ? 1 : 0);
