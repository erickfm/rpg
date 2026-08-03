// ITEM 288 — THE CEILING THAT WOULD HAVE CAUGHT 2026-08-02, AND DID NOT EXIST.
//
// Worker onehundredfifteen's item 286 report ends with the gap this closes:
//
//   *"Nothing detects OVER-correction. Both authors' probes test a floor (is any
//   leg visible). Neither could have caught this bug — both passed with the
//   double correction live. A ceiling check ('is the hip still on the seat it is
//   registered to?') is what would have failed on 2026-08-02 and does not
//   exist."*
//
// This is that check, and it is a CEILING in the strict sense: it can only fail
// by a sitter being moved TOO FAR. Nothing here can be satisfied by moving a
// citizen further out, which is exactly the property every floor in this repo
// lacks.
//
// ── WHY THE ASSERTION IS A BAND AND NOT A LIMIT ────────────────────────────
//
// `ct/citizens.ts:901` decides how far a seated body is pushed forward:
//
//     const seatFwd = askedFwd > SEATED_KNEE_M ? askedFwd : 0;
//
// That rule is not "move it a bit less". It is a DICHOTOMY, and item 286
// derived it from the two fixes it reconciles:
//
//   · the seat is shallow enough that the redrawn shin (SEATED_KNEE_M = 0.356 m
//     forward of the hip) already clears its front face -> move the body NOT AT
//     ALL. Diner booth 0.275, jail lobby bench 0.210, casino lounge 0.115.
//   · the seat is deeper than the art can reach -> move the body the whole way.
//     Jail bunk 0.960.
//
// So a hip displacement is legal at **0**, and legal **above 0.356 m**, and
// illegal in between — because the only way to land in that band is for BOTH
// corrections to have been applied to the same seat. The diner's 0.275 m sat
// there for a day, put both booth sitters' hips on the table edge and their
// shins on the booth centreline, and **every probe in the suite stayed green**.
//
// The band is DERIVED from the same two constants the world uses
// (`SEATED_KNEE_TEXELS`, `SPRITE_H_M`), not predicted: change the art and the
// band moves with it.
//
// ── HOW A HIP IS MATCHED TO A SEAT, AND WHY 6 OF 14 ARE NOT JUDGED ─────────
//
// `ct/interior.ts:946` exports `takenSeats()` for precisely this pairing and
// **nothing consumes it** — it is not on `__ct`, so on the built bundle it has
// no runtime path at all (item 223: `await import('/src/proto/…')` 404s under
// `vite preview`). Until it is published, the honest substitute is the 219
// REGISTERED player seats, and a citizen is taken to be on one only when the
// nearest sits inside that seat's own trigger radius. Measured, that is
// unambiguous rather than marginal — 8 citizens read **exactly 0.000 m**, and
// the 6 it cannot match are not near-misses but 1.05-80.8 m away:
//
//   bank officer, 3 library readers  sit on furniture that is not a player seat
//   2 jail sitters                  the jail registers no player seats at all
//
// Those 6 are REPORTED, never silently dropped — GOTCHAS 34, and item 288's own
// second half. The matched count carries a floor, so a change that stops
// citizens sitting on seats fails loudly instead of passing over an empty set.
//
// SELF-TEST BOTH SIGNS. Reinstate the historical bug and this must go red:
//
//   sed -i 's/askedFwd > SEATED_KNEE_M ? askedFwd : 0/askedFwd/' src/proto/ct/citizens.ts
//   npm run build && SHOT_URL=… node scripts/probes/w117-item288-hip-on-its-seat.mjs
//   git checkout src/proto/ct/citizens.ts && npm run build
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-item288-hip-on-its-seat.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4190/');
const MIN_SITTERS = Number(process.env.MIN_SITTERS ?? 14);
// THE MEASURED POPULATION, NOT A GUESS — and it started life as a guess of 9,
// which the first run failed. 8 is what the world actually pairs: church 1,
// diner 2, casino 5. It is here so the coverage cannot rot silently, and it is
// NOT a threshold tuned until the check passed: the assertion it guards (the
// forbidden band) read 0 either way.
const MIN_MATCHED = Number(process.env.MIN_MATCHED ?? 8);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 60000 });
await reportWorld(p, URL);
await waitPainted(p, { quiet: true });

// The band's two ends, derived from ct/citizens.ts's own exported constants.
// COPIED WITH A CITATION, not invented: `SEATED_KNEE_TEXELS = 12` and
// `SPRITE_H_M = 1.9` at ct/citizens.ts:19,33, over the atlas's 64-row frame
// height. They are module-scope exports with no runtime path on the bundle —
// the same gap as `takenSeats()` above, and worth one `__ct` hook for both.
const SEATED_KNEE_TEXELS = 12, SPRITE_H_M = 1.9, FRAME_ROWS = 64;
const KNEE = SEATED_KNEE_TEXELS * SPRITE_H_M / FRAME_ROWS;    // 0.356 m
const EPS = 0.01;                                              // "at its seat"

const rows = await p.evaluate(() => {
  const seats = window.__ct.seats() || [];
  const rooms = window.__ct.roomDims();
  const out = [];
  // ⚠ NO `visible` TERM (GOTCHAS 79/79b): every interior is culled until you
  // stand in it, so filtering on visibility finds zero and says so in green.
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    const r = rooms.find((m) => Math.abs(q.x - m.cx) <= m.w / 2 && Math.abs(q.z - m.cz) <= m.d / 2);
    let best = null, bd = Infinity;
    for (const s of seats) {
      const d = Math.hypot(q.x - s.pose.x, q.z - s.pose.z);
      if (d < bd) { bd = d; best = s; }
    }
    out.push({
      room: r ? r.id : 'OUTSIDE', x: q.x, z: q.z,
      seat: best ? best.label : null, seatR: best ? best.r : null, d: bd,
    });
  });
  return out;
});

console.log(`\nseated citizens: ${rows.length}  (floor ${MIN_SITTERS})`);
if (rows.length < MIN_SITTERS) {
  console.log(`EXIT 3 — population floor not met; this measured nothing.`);
  await b.close(); process.exit(3);
}
console.log(`the legal band: displacement == 0 (+/-${EPS}) OR > ${KNEE.toFixed(3)} m; (${EPS}, ${KNEE.toFixed(3)}] is the double-correction signature\n`);

const matched = [], unmatched = [], bad = [];
for (const r of rows) {
  // ON THIS SEAT only if the nearest one's own trigger radius contains the hip.
  // Not a tuned threshold: it is the radius the seat itself declares.
  const on = r.seatR !== null && r.d <= r.seatR;
  const inBand = r.d > EPS && r.d <= KNEE;
  const state = !on ? 'not on a registered seat — NOT JUDGED'
    : inBand ? 'BOTH CORRECTIONS APPLIED — hip pushed off its own seat'
      : r.d <= EPS ? 'ok — hip at its seat (the art reaches past the face)'
        : `ok — hip moved ${r.d.toFixed(3)} m, past the ${KNEE.toFixed(3)} m the art can reach`;
  console.log(`  ${r.room.padEnd(9)} (${r.x.toFixed(2)}, ${r.z.toFixed(2)})`.padEnd(34)
    + `d ${r.d.toFixed(3)}  seat r ${r.seatR === null ? '-' : r.seatR.toFixed(2)}  ${state}`);
  if (!on) unmatched.push(r); else { matched.push(r); if (inBand) bad.push(r); }
}

console.log(`\n${matched.length} judged, ${unmatched.length} not judged, ${bad.length} in the forbidden band.`);
if (unmatched.length) {
  console.log('  NOT JUDGED, and why — these are reported, never scored (GOTCHAS 34):');
  for (const r of unmatched) {
    console.log(`    ${r.room.padEnd(9)} nearest registered seat is ${r.d.toFixed(2)} m away`
      + ` ("${r.seat}", r ${r.seatR === null ? '-' : r.seatR.toFixed(2)})`);
  }
  console.log('  Publishing ct/interior.ts:946 `takenSeats()` on `__ct` would judge all 14.');
}
if (errs.length) console.log(`console errors: ${errs.length}`);
await b.close();

// COVERAGE FLOOR — item 288's second half. A ceiling that judges nobody is the
// same silent green as a floor that judges nobody.
if (matched.length < MIN_MATCHED) {
  console.log(`\nEXIT 3 — only ${matched.length} of ${rows.length} sitters could be matched to a`
    + ` registered seat (floor ${MIN_MATCHED}). This run measured too little to have an opinion.`);
  process.exit(3);
}
if (bad.length) {
  console.log(`\nFAIL — ${bad.length} seated citizen(s) sit in the double-correction band.`);
  process.exit(1);
}
console.log(`\nPASS — every judged sitter's hip is either ON its seat or legitimately past the art's reach.`);
