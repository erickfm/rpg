#!/usr/bin/env node
// THE CLAIM: in the PACKED ARTIFACT — the single file the user actually opens —
// you can stand at a slot stool, press [E], and be SEATED with the machine open;
// and you can get back up again.
//
// Item 45's DONE WHEN asks for "opened it and sat down at one game". Its sibling
// `L-games-in-artifact.mjs` proves both games are REACHABLE in the pack, but it
// does so by calling `__slots.open()` directly — which is the module's API, not
// the seat. A game whose module inlines perfectly and whose stool no longer
// seats you would pass that check and be unplayable, and BUILDER-BRIEF §10 is
// explicit that seats are proved by WALKING them.
//
// So this drives the world: warp to the seat's OWN published approach point,
// wait for the world to OFFER the stool, hold [E], and read `__ct.seated()`.
//
// BUILDER-BRIEF §11 is the other half and is why standing up is checked here
// rather than left to the sit: `hud.ts` blocks keydown while a panel is open,
// and "i can't get up anything i do once i sit down" is this project's worst
// shipped bug. A sit that cannot be undone is not a working seat.
//
//   SHOT_URL=http://localhost:<port>/artifact.html node scripts/probes/w25-sit-in-artifact.mjs
//   … --selftest   prove it can fail
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 aborted — nothing measured.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

// The mutations remove the two things the verdicts below rest on: the seat's
// ability to seat you, and the world's ability to stand you up. Both are what a
// real regression would look like from here.
const MUTATIONS = {
  'never-seats': () => {
    window.__ct.seated = () => null;
  },
  'never-stands': () => {
    const w = window.__ct.warp;
    void w;
    window.__hud.panel = () => 'ct-slots';          // the panel never closes
  },
};

if (process.argv.includes('--selftest')) {
  if (!process.env.SHOT_URL) { console.error('ABORTED: --selftest needs SHOT_URL too.'); process.exit(3); }
  let slept = 0;
  const names = Object.keys(MUTATIONS);
  for (const name of names) {
    let code = 0, out = '';
    try {
      out = execFileSync(process.execPath, [SELF], {
        env: { ...process.env, W25_MUTATE: name }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const failed = (out.match(/^FAIL/gm) ?? []).length;
    const caught = code === 1 && failed > 0;        // exit 3 is NOT a catch
    if (!caught) slept++;
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(14)} exit=${code} fails=${failed}`);
  }
  // Aimed at the ordinary bundle this must ABORT rather than pass — otherwise it
  // certifies a build that is not the artifact (GOTCHAS §48).
  let guard = 0;
  try {
    execFileSync(process.execPath, [SELF], {
      env: { ...process.env, SHOT_URL: process.env.SHOT_URL.replace('artifact.html', '') },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) { guard = e.status ?? -1; }
  const guardOK = guard === 3;
  if (!guardOK) slept++;
  console.log(`${guardOK ? 'CAUGHT ' : 'SLEPT  '} ${'wrong-build'.padEnd(14)} exit=${guard} (must be 3)`);
  console.log(slept === 0
    ? `\n  selftest: ${names.length + 1} / ${names.length + 1} CAUGHT. The check can fail.\n`
    : `\n  selftest: ${slept} SLEPT.\n`);
  process.exit(slept === 0 ? 0 : 2);
}

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to a server for YOUR OWN dist/artifact.html.'
    + ' There is no default — a default port is somebody else\'s server (GOTCHAS §26, §48).');
  process.exit(3);
}
if (!/artifact\.html/.test(URL)) {
  console.error(`ABORTED: ${URL} is not an artifact.html. This check exists to test the`
    + ' PACKED single-file build; against the ordinary bundle it would pass and mean nothing.');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  console.error('  Nothing was measured. This is not a red.');
  await b.close(); process.exit(3);
}

// The panels arrive a tick after the world, behind a dynamic import.
await p.waitForFunction(
  () => typeof window.__slots?.open === 'function' && typeof window.__hud?.panel === 'function',
  { timeout: 20000 }).catch(() => {});

if (process.env.W25_MUTATE) {
  const fn = MUTATIONS[process.env.W25_MUTATE];
  if (!fn) { console.error(`ABORTED: no mutation "${process.env.W25_MUTATE}"`); await b.close(); process.exit(3); }
  await p.evaluate(fn);
  console.log(`  [MUTATED: ${process.env.W25_MUTATE}] — this run is expected to FAIL`);
}

// Hold the key. `press()` can begin and end inside one animation frame, and the
// [E] dispatch is an edge read once per rendered frame, so a tap is never seen
// (BUILDER-BRIEF §5).
const press = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(90);
  await p.keyboard.up(k); await p.waitForTimeout(160);
};
const until = async (fn, what, ms = 15000) => {
  try { await p.waitForFunction(fn, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};
const panelUp = () => p.evaluate(() => window.__hud?.panel?.() ?? null);

console.log('\nSITTING DOWN AT A GAME, IN THE SINGLE-FILE ARTIFACT.\n');

// Aimed from the world's own published seats, never from typed coordinates —
// GOTCHAS §20: every hand-typed coordinate in a probe here has eventually been
// wrong.
const seats = await p.evaluate(() =>
  window.__ct.seats().filter((s) => s.label === 'sit at the slot'));
console.log(`  ${seats.length} stools publish themselves as 'sit at the slot'\n`);
// Assert the population before the absences (GOTCHAS §34): nought stools would
// make every verdict below free.
if (!seats.length) {
  console.error('ABORTED: no seat in the artifact is labelled \'sit at the slot\'.'
    + ' Nothing below was measured.');
  await b.close(); process.exit(3);
}

const seat = seats[Math.floor(seats.length / 2)];
await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos().gy ?? 0, 0), seat);
const offered = await until(() => {
  const d = document.getElementById('ct-prompt');
  return !!d && d.style.display !== 'none' && /sit at the slot/.test(d.textContent ?? '');
}, 'the stool to offer itself');
check(offered, 'the stool OFFERS itself when you stand at its own approach point');

const before = await panelUp();
await press('e');                                     // sit
const seated = await until(() => !!window.__ct.seated(), 'the player to be seated');
await until(() => window.__hud.panel() === 'ct-slots', 'the machine to open');
const after = await panelUp();
console.log(`\n  sat at the stool at (${seat.pose.x.toFixed(2)}, ${seat.pose.z.toFixed(2)})`);
console.log(`  panel before: ${before ?? 'none'}    after: ${after ?? 'none'}\n`);

check(before === null, 'no panel was up beforehand — so this is measuring the sit');
check(seated, 'HOLDING [E] AT THE STOOL SEATS THE PLAYER, in the packed artifact');
check(after === 'ct-slots', 'and sitting down OPENS THE MACHINE — the seat is the trigger');

// ── AND YOU CAN GET BACK UP ──────────────────────────────────────────────────
// BUILDER-BRIEF §11: a panel you cannot close is the worst bug this project
// ships, and `hud.ts` blocks keydown while one is open. "i can't get up anything
// i do once i sit down" was three rounds to fix.
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
const closed = await panelUp();
check(closed === null, `ESCAPE closes the machine from inside it (panel now ${closed ?? 'none'})`);

const upAgain = await until(() => !window.__ct.seated(), 'the player to stand up', 8000);
const stillSeated = await p.evaluate(() => !!window.__ct.seated());
if (stillSeated) { await press('e'); await p.waitForTimeout(300); }
const standing = await p.evaluate(() => !window.__ct.seated());
console.log(`  after Escape: seated=${stillSeated}; after a further [E]: standing=${standing}\n`);
check(standing, 'and the player GETS BACK UP off the stool — not trapped (BUILDER-BRIEF §11)');
void upAgain;

check(errs.length === 0, `no page errors from the artifact (${errs.length})`
  + (errs.length ? `: ${errs[0]}` : ''));

await b.close();
console.log(bad === 0 ? '\n  all checks pass — you can sit down and play, in the artifact.\n'
                      : `\n  ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
