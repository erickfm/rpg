// ONE QUESTION: does the felt table register seats today?
//
// `notes/archive/BLOCKED-L.md` and a comment in `ct/blackjack.ts` both still say
// it registers none. This asks `__ct.seats()` rather than reading either file
// back at itself — a note is a hypothesis about the world, the world is the
// answer (BUILDER-BRIEF §7).
//
// The label is READ OUT OF blackjack.ts's own `export const SEAT_LABEL` rather
// than retyped here: node cannot import a .ts, and a second hand-typed copy of
// that string is exactly the coupling this whole item is about.
//
// Exit 1 if no seat carries the label. MUTATION-TESTED, and the FIRST attempt
// failed to fail, which is the more interesting half:
//
//   1. Changed `SEAT_LABEL` in blackjack.ts.  STILL GREEN — 4 seats, wearing the
//      mutated string. `int-casino.ts` IMPORTS the constant, so the two sides of
//      the bridge move together and can never disagree. That is a proof the
//      derivation is real (BUILDER-BRIEF §8) and a proof this mutation is inert.
//   2. Dropped the label argument at the felt table's own `gameStool()` call —
//      the state before `ae4147cee`, verbatim.  RED: 0 blackjack seats, and
//      'sit at the table' goes 21 -> 25 as the four fall back to the shared
//      string. That is the historical bug and the check catches it.
//
//   SHOT_URL=http://localhost:4184/ node scripts/probes/w19-blackjack-seats.mjs
import { aim } from '../lib/aim.mjs';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const SRC = 'src/proto/ct/blackjack.ts';
const LABEL = (readFileSync(SRC, 'utf8').match(/export const SEAT_LABEL = '([^']+)'/) ?? [])[1];
if (!LABEL) { console.error(`no 'export const SEAT_LABEL' in ${SRC}`); process.exit(2); }

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(600);
const out = await p.evaluate((label) => {
  const seats = window.__ct.seats();
  const by = {};
  for (const s of seats) by[s.label] = (by[s.label] ?? 0) + 1;
  return {
    total: seats.length, by,
    bj: seats.filter((s) => s.label === label).map((s) => ({
      x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2), yaw: +s.pose.yaw.toFixed(3),
      at: s.at ? { x: +s.at.x.toFixed(2), z: +s.at.z.toFixed(2) } : null,
    })),
  };
}, LABEL);
await b.close();

console.log(`${out.total} seats registered`);
for (const [k, n] of Object.entries(out.by).sort((a, c) => c[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${k}`);
}
console.log(`\n"${LABEL}" seats: ${out.bj.length}`);
for (const s of out.bj) {
  console.log(`  seat (${s.x}, ${s.z}) yaw ${s.yaw}` +
    (s.at ? `   stand at (${s.at.x}, ${s.at.z})` : '   NO SEPARATE APPROACH POINT'));
}
process.exit(out.bj.length ? 0 : 1);
