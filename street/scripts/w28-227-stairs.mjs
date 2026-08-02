#!/usr/bin/env node
// THE CLAIM: you can walk up to No. 227 — the player's own front door — press
// [E], and then just HOLD W and go up the stairs. Which is the first thing
// anybody does after opening their own front door, and which did not work.
//
// Item 53 is explicit about how this must be proved: **walk it, do not warp to a
// coordinate and call it proven.** A check that warped instead of walking is how
// the storey picker went untested for its whole life. So nothing here teleports
// into the lobby: the door's own [E] spot is found through `__ct.spots()`, the
// player is put on the STREET at it, the world's own `act()` does the entering,
// and from wherever that leaves him the only input is a held W.
//
// The verdict is `gy` — the storey the world thinks you are standing on — not
// `camY`, which is a constant 1.62 eye height whatever is under your feet, and
// not a screenshot.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/w28-227-stairs.mjs
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 3 aborted.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN server. There is no default —'
    + ' a default port is somebody else\'s world (GOTCHAS §26, §48).');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.spots !== undefined, { timeout: 30000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  await b.close(); process.exit(3);
}

console.log('\nWALKING IN THROUGH No. 227 AND UP THE STAIRS.\n');

// The door, from the world's own spot registry — never a typed coordinate
// (GOTCHAS §20). The apartment block is placed by crosstown.ts and has moved.
const door = await p.evaluate(() =>
  (window.__ct.spots() ?? []).find((s) => /enter No\. 227/.test(s.label ?? '')) ?? null);
if (!door) {
  console.error('ABORTED: no spot in this world is labelled \'enter No. 227\'.'
    + ' Nothing below was measured.');
  await b.close(); process.exit(3);
}
console.log(`  the door publishes itself at (${door.x.toFixed(2)}, ${door.z.toFixed(2)}), r=${door.r}`);

// Stand on the STREET at the door and let the world offer it.
await p.evaluate((d) => window.__ct.warp(d.x, d.z, 0, 0, 0), door);
await p.waitForTimeout(400);
const offered = await p.waitForFunction(() => {
  const el = document.getElementById('ct-prompt');
  return !!el && el.style.display !== 'none' && /enter No\. 227/.test(el.textContent ?? '');
}, { timeout: 8000 }).then(() => true).catch(() => false);
check(offered, 'standing at No. 227 the door OFFERS itself — this is the real spot,'
  + ' not a coordinate this script invented');

const before = await p.evaluate(() => window.__ct.pos());
// HELD, not pressed: the [E] dispatch is an edge read once per rendered frame,
// so a tap inside one frame is never observed (BUILDER-BRIEF §5).
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(500);
const landed = await p.evaluate(() => window.__ct.pos());
check(Math.hypot(landed[0] - before[0], landed[2] - before[2]) > 1,
  `pressing [E] put you INSIDE — the lobby, at (${landed[0].toFixed(2)}, ${landed[2].toFixed(2)})`);
console.log(`  the door left you at (${landed[0].toFixed(2)}, ${landed[2].toFixed(2)}), gy ${landed[3].toFixed(2)}\n`);

// ── AND NOW THE ONLY INPUT IS W ──────────────────────────────────────────────
// No steering, no second warp. If the landing faces you at the core wall
// between the flights instead of at a flight, this is where it shows.
await p.keyboard.down('w');
let peak = landed[3], last = landed;
for (let i = 0; i < 24 && peak < 1.0; i++) {        // ≤ 6 s
  await p.waitForTimeout(250);
  last = await p.evaluate(() => window.__ct.pos());
  if (last[3] > peak) peak = last[3];
}
await p.keyboard.up('w');
await p.waitForTimeout(200);
const end = await p.evaluate(() => window.__ct.pos());
const walked = Math.hypot(end[0] - landed[0], end[2] - landed[2]);
console.log(`  held W: walked ${walked.toFixed(2)} m to (${end[0].toFixed(2)}, ${end[2].toFixed(2)}),`
  + `  gy went ${landed[3].toFixed(2)} -> ${peak.toFixed(2)}\n`);

// A step is RISE/STEPS ≈ 0.193 m; a whole half-flight is 1.35. Requiring more
// than one step's worth is what separates "reached the stairs and climbed" from
// "shuffled onto the bottom nosing", and requiring the LANDING is what separates
// it from "got two steps up and jammed".
check(peak > 0.19, `holding W REACHES THE FIRST STEP AND CLIMBS IT — gy rose to ${peak.toFixed(2)}`);
check(peak >= 1.34, `and keeps going to the half-landing at 1.35 (reached ${peak.toFixed(2)}),`
  + ' so it is a staircase you can walk up and not a step you can trip over');
check(errs.length === 0, `no page errors (${errs.length})` + (errs.length ? `: ${errs[0]}` : ''));

await b.close();
console.log(bad === 0
  ? '\n  you can open your own front door and walk up your own stairs.\n'
  : `\n  ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
