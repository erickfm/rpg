// IS THE SELECTION OUTLINE GONE FROM NORMAL PLAY, AND STILL THERE FOR DEBUG?
//
// Four user reports killed the outline as a player feature, all with one cause:
// it drew the `ctx.spot()` proximity VOLUME, never the object, because a spot
// carries a position and a radius and never carried the thing. *"this outline
// is not around the object, i wanted to be around the object."* Then the
// ruling that settled it: *"yea get rid of outline unless debug is true, we'll
// probably want that for debug."*
//
// So there are two claims here and they pull in opposite directions, which is
// exactly why this is a script and not a look:
//
//   NORMAL PLAY — standing at an [E], prompt showing, NOTHING is drawn.
//   DEBUG       — after `__ct.debugSpots(true)`, the volume IS drawn.
//   AND BACK    — `debugSpots(false)` removes it again.
//
// The third is not padding. A flag that turns a thing on and cannot turn it off
// leaves the world in the state the user asked to be rid of, and "it defaults
// off" would still pass a check that only ever looked at the default.
//
// WHAT IT COUNTS. `SpotOutline` builds a group of lines wearing one
// `LineBasicMaterial` at 0xfff3c4 (fp.ts:536), so the outline is countable
// directly rather than inferred from a screenshot — which could not tell a
// missing outline from a dark one anyway, and screenshots are for LOOKING,
// never for PROVING.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4181/';
const WANT_STATIONS = 6;

const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});
// every line in the scene wearing the outline's own colour
const outlineLines = () => page.evaluate(() => {
  const scene = window.__ct.scene();
  let n = 0;
  scene.traverse((o) => {
    if (!(o.isLine || o.isLineSegments || o.isLineLoop)) return;
    const m = o.material;
    if (m && m.color && m.color.getHex() === 0xfff3c4) n++;
  });
  return n;
});

// ── find stations where an [E] is actually being offered ────────────────────
// DISTINCT LABELS, not just the first six that answer. The first cut took
// candidates in registry order and every one of its six stations was "sit on
// the bench" — six copies of one spot, passing six times and covering one
// case. A check that only ever exercises one kind of thing is a check that
// has not been run on the others (GOTCHAS §34).
const cand = await page.evaluate(() => {
  const seen = new Set(), out = [];
  // NOT filtered on ok() here either. ok() is evaluated where the PLAYER is,
  // and at collection the player is still at spawn — filtering on it left six
  // stations that were all SEATS, because seats are what happens to be live
  // from the pavement. Doors, the ATM and the counters never got a look. The
  // prompt read after the warp is the real gate; this is only a shortlist.
  for (const s of window.__ct.spots()) {
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    out.push({ x: s.x, z: s.z, label: s.label });
  }
  return out;
});
const stations = [];
for (const c of cand) {
  if (stations.length >= WANT_STATIONS) break;
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [c.x, c.z]);
  // stand just off the spot and look straight at it
  await page.evaluate(([x, z, gy]) => window.__ct.warp(x + 0.5, z, Math.PI / 2, gy, 0), [c.x, c.z, gy]);
  await page.waitForTimeout(240);
  const p = await prompt();
  if (p) stations.push({ ...c, gy, prompt: p });
}

console.log(`\n  ${stations.length} stations where an [E] is being offered\n`);

let pass = 0, fail = 0;
const say = (ok, what, detail) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}: ${detail}`);
  ok ? pass++ : fail++;
};

// THE DEFAULT, ASSERTED FIRST AND ON ITS OWN — before this script has called
// `debugSpots` even once. It matters that this comes first: the loop below
// toggles the flag off at the end of every station, so from the second station
// onward "nothing is drawn" would be true because THIS SCRIPT turned it off,
// not because the world ships that way. Proved by breaking it — with
// `let debugSpots = true` in crosstown.ts only this assertion failed, and the
// eighteen after it passed on a world that draws the outline in normal play.
{
  const st = stations[0];
  await page.evaluate(([x, z, gy]) => window.__ct.warp(x + 0.5, z, Math.PI / 2, gy, 0), [st.x, st.z, st.gy]);
  await page.waitForTimeout(240);
  const n = await outlineLines();
  say(n === 0, 'the flag DEFAULTS off (no debugSpots call has been made)',
    `${n} outline lines at "${st.label}"`);
}

for (const st of stations) {
  await page.evaluate(([x, z, gy]) => window.__ct.warp(x + 0.5, z, Math.PI / 2, gy, 0), [st.x, st.z, st.gy]);
  await page.waitForTimeout(240);

  const offBefore = await outlineLines();
  const p1 = await prompt();
  say(p1 !== '' && offBefore === 0, `normal play at "${st.label}"`,
    `prompt "${p1 || '(none)'}", ${offBefore} outline lines drawn`);

  await page.evaluate(() => window.__ct.debugSpots(true));
  await page.waitForTimeout(240);
  const on = await outlineLines();
  say(on > 0, `debug ON at "${st.label}"`, `${on} outline lines drawn`);

  await page.evaluate(() => window.__ct.debugSpots(false));
  await page.waitForTimeout(240);
  const offAfter = await outlineLines();
  say(offAfter === 0, `debug OFF again at "${st.label}"`, `${offAfter} outline lines drawn`);
}

// ── and nowhere in normal play, not just at the stations we chose ───────────
await page.evaluate(() => window.__ct.debugSpots(false));
let anywhere = 0;
for (const c of cand.slice(0, 40)) {
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [c.x, c.z]);
  await page.evaluate(([x, z, gy]) => window.__ct.warp(x + 0.5, z, Math.PI / 2, gy, 0), [c.x, c.z, gy]);
  await page.waitForTimeout(120);
  anywhere += await outlineLines();
}
say(anywhere === 0, 'nothing drawn anywhere in normal play',
  `${anywhere} outline lines across ${Math.min(40, cand.length)} live spots`);

await b.close();
console.log(`\n  ${pass} pass, ${fail} fail`);
if (stations.length < WANT_STATIONS) {
  console.log(`\n  FAIL: only ${stations.length} stations found, wanted ${WANT_STATIONS} —`);
  console.log('  a run that tests nothing must not report success (GOTCHAS §34).');
  process.exit(1);
}
if (fail) process.exit(1);
console.log('\n  the outline is out of normal play and alive behind the debug flag');
