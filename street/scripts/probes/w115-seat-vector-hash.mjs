// ITEM 286 — the 219-entry seat-offer vector, hashed, so "byte-identical" is a
// comparison and not a claim.
//
// Item 280's own note promised the vector was byte-identical before and after
// its change, on the reasoning that seats are CLAIMED at build time (right
// after `place()`) while `seatFwd` is applied in `update()`, which is strictly
// later. Item 286 changes the value `seatFwd` resolves to, so that promise has
// to be re-earned rather than inherited.
//
// Prints one sha256 over the whole vector plus the per-room counts, so a
// difference tells you WHERE as well as THAT.
//
// Usage: SHOT_URL=http://localhost:4712/ node scripts/probes/w115-seat-vector-hash.mjs
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
const MIN_SEATS = Number(process.env.MIN_SEATS ?? 200);
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p, { quiet: true });

// The seat REGISTRY, which is what item 93 and `seats-walk` both read. Rounded
// to the millimetre: a float printed at full precision would make this hash
// sensitive to arithmetic that no player and no check can observe.
const seats = await p.evaluate(() => window.__ct.seats().map((s) => ({
  x: +s.pose.x.toFixed(3), z: +s.pose.z.toFixed(3), yaw: +s.pose.yaw.toFixed(4),
  h: +s.pose.h.toFixed(3), r: +s.r.toFixed(3), label: s.label,
  ax: +s.at.x.toFixed(3), az: +s.at.z.toFixed(3),
})));
await b.close();

// POPULATION FLOOR, DERIVED FROM WHAT THE WORLD SHOULD HOLD — a hash over an
// empty array is a stable, meaningless green (GOTCHAS 34).
console.log(`seats registered: ${seats.length}  (floor ${MIN_SEATS})`);
if (seats.length < MIN_SEATS) {
  console.log('EXIT 3 — population floor not met; this measured nothing.');
  process.exit(3);
}

const byRoom = new Map();
for (const s of seats) byRoom.set(s.label, (byRoom.get(s.label) ?? 0) + 1);
for (const [k, v] of [...byRoom].sort()) console.log(`  ${String(v).padStart(4)}  ${k}`);

const h = createHash('sha256').update(JSON.stringify(seats)).digest('hex');
console.log(`\nseat-vector sha256: ${h}`);
