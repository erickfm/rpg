#!/usr/bin/env node
// THE CLAIM: in the PACKED ARTIFACT — the single file the user actually opens —
// you can WALK UP TO each casino game, sit down on its stool, play it, and get
// back up again.
//
// GOTCHAS §37: "everything the user opens is one of two builds neither of which
// is the dev server", and the deep checks are supposed to run against the
// artifact, except that `check-artifact.mjs` stops at "it opens standalone and
// draws" and "would pass just as happily with the spawn on the street, a door
// gapping, or a whole module missing."
//
// THIS IS A SPECIFIC RISK FOR THESE TWO MODULES, not general caution. Both
// reach `ct/hud.ts` through a DYNAMIC import, deliberately — a static one would
// put them in a runtime cycle with `ct/world.ts`'s eager glob, which is the
// fault that dropped GOLDEN ACES from the bundle while dev worked perfectly
// (GOTCHAS §28), and `ct/hud.ts` also imports `virtual:build-stamp`, which does
// not exist outside the bundler. A dynamic import is a code-split point, and
// whether a lazily-imported chunk survives `pack-artifact.mjs` inlining
// everything into ONE file is exactly the kind of thing that works in
// `vite preview` and fails in the pack.
//
// ── WHY THIS DRIVES THE SEAT AND NOT `open()` ────────────────────────────────
//
// Until 2026-08-02 every play verdict below started from `window.__slots.open()`.
// That is the module's API, not the way anybody reaches the game: a machine
// whose stool no longer seats you passed this check and would ship unplayable.
// That is not a hypothetical class — it is the one that has already shipped
// here repeatedly (105 stools seating you with your back to the machine, a bed
// seat whose coordinate drifted, and the felt table which for weeks registered
// no seat at all, so `open()` was the ONLY way in). BUILDER-BRIEF §10 is
// explicit that seats are proved by WALKING them; w25's
// `probes/w25-sit-in-artifact.mjs` proved the approach on the slots, and this
// is that approach promoted into the check and widened to BOTH games.
//
// So for each game this now reads the seat label from the game module's own
// source, finds the seats the artifact publishes under it, stands the player a
// metre BEHIND that seat's own published approach point facing it, holds W
// until the world OFFERS the seat, holds [E], and requires that the player end
// up seated ON A SEAT CARRYING THAT LABEL with that game's panel up. Then
// Escape, and up again.
//
// The walk is the part `open()` could never do: it proves the stool is
// REACHABLE. A seat inside a collider, or behind a prop pushed into its
// approach lane, offers itself to a teleport and not to a player.
//
//   SHOT_URL=http://localhost:<port>/artifact.html node scripts/probes/L-games-in-artifact.mjs
//   … --selftest   prove it can fail
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 aborted — nothing measured. Note which side of that line A MISSING SEAT
// falls on: it is a FAIL, not an abort. A world that publishes no stool for a
// shipped game has been measured and is wrong, and turning that red is the
// whole point of this rewrite.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SELF = fileURLToPath(import.meta.url);
const SRC = resolve(dirname(SELF), '..', '..', 'src', 'proto', 'ct');

// ── THE SEAT LABELS, DERIVED ────────────────────────────────────────────────
// BUILDER-BRIEF §8: derive, never retype. These two strings are the bridge
// between the stool and the game — `int-casino.ts` puts them on the seat, the
// game module joins on them — and a second hand-typed copy here is how an
// instrument ends up confidently measuring a label nobody publishes any more.
// A `.mjs` cannot import a `.ts`, so this reads the declaration out of the
// owning module and ABORTS if it cannot find it, rather than falling back to a
// guess:
//
//   src/proto/ct/slots.ts:1247       const SLOT_SEAT_LABEL = 'sit at the slot';
//   src/proto/ct/blackjack.ts:1198   export const SEAT_LABEL = 'sit at the blackjack table';
//
// It has a second effect worth having. If a game module's label changes and the
// artifact is not rebuilt, the artifact publishes no seat under the new string
// and this goes red — which is the correct reading, because the file the user
// opens is then stale.
const labelFromSource = (file, name) => {
  let text;
  try { text = readFileSync(resolve(SRC, file), 'utf8'); }
  catch (e) { return { err: `cannot read src/proto/ct/${file} — ${e.message}` }; }
  const m = new RegExp(`^\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*'([^']+)'`, 'm').exec(text);
  if (!m) return { err: `src/proto/ct/${file} no longer declares \`const ${name} = '…'\`` };
  return { label: m[1], where: `${file}:${text.slice(0, m.index).split('\n').length}` };
};

const GAMES = [
  {
    name: 'SEVENS', what: 'the slot machine',
    station: '__slots', panel: 'ct-slots',
    source: ['slots.ts', 'SLOT_SEAT_LABEL'],
    // Played through the station once SEATED — the seat is what opened it.
    play: () => {
      window.__slots.insert(20);
      const before = window.__slots.view().credits;
      const started = window.__slots.play();
      const after = window.__slots.view().credits;
      return { ok: started && after === before - 1,
        how: `takes a bet and spins (${before} -> ${after} credits)` };
    },
  },
  {
    name: 'GOLDEN ACES', what: 'the blackjack table',
    station: '__blackjack', panel: 'ct-blackjack',
    source: ['blackjack.ts', 'SEAT_LABEL'],
    play: () => {
      window.__blackjack.buyIn(50);
      const dealt = window.__blackjack.deal();
      const v = window.__blackjack.view();
      return { ok: dealt && v.phase !== 'betting', how: `deals a hand (phase ${v.phase})` };
    },
  },
];

// ── MUTATIONS ───────────────────────────────────────────────────────────────
// GOTCHAS §27. Two families, and the second is what the rewrite exists for:
//
//   *-gone       the module never reached the pack — the original pair, kept
//   no-*-seat    the game is there and its STOOL is not. This is the item's
//                DONE WHEN, and the regression `open()` could not see: under
//                the old check both of these passed, green, in full.
//   never-seats  the stool is there and does not seat you
const MUTATIONS = {
  'slots-gone': () => { Object.defineProperty(window, '__slots', { get: () => undefined }); },
  'blackjack-gone': () => { Object.defineProperty(window, '__blackjack', { get: () => undefined }); },
  'no-slot-seat': () => {
    const all = window.__ct.seats.bind(window.__ct);
    window.__ct.seats = () => all().filter((s) => s.label !== 'sit at the slot');
  },
  'no-blackjack-seat': () => {
    const all = window.__ct.seats.bind(window.__ct);
    window.__ct.seats = () => all().filter((s) => s.label !== 'sit at the blackjack table');
  },
  'never-seats': () => { window.__ct.seated = () => null; },
};

if (process.argv.includes('--selftest')) {
  if (!process.env.SHOT_URL) {
    console.error('ABORTED: --selftest needs SHOT_URL too.');
    process.exit(3);
  }
  let slept = 0;
  const names = Object.keys(MUTATIONS);
  for (const name of names) {
    let code = 0, out = '';
    try {
      out = execFileSync(process.execPath, [SELF], {
        env: { ...process.env, L_ART_MUTATE: name }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const failed = (out.match(/^FAIL/gm) ?? []).length;
    const caught = code === 1 && failed > 0;      // exit 3 is NOT a catch, GOTCHAS §32
    if (!caught) slept++;
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(18)} exit=${code} fails=${failed}`);
  }
  // The aim guard is part of the check and gets watched too: pointed at the
  // ordinary bundle this must ABORT rather than pass, or it would certify the
  // wrong build (GOTCHAS §48).
  let guard = 0;
  try {
    execFileSync(process.execPath, [SELF], {
      env: { ...process.env, SHOT_URL: process.env.SHOT_URL.replace('artifact.html', '') },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) { guard = e.status ?? -1; }
  const guardOK = guard === 3;
  if (!guardOK) slept++;
  console.log(`${guardOK ? 'CAUGHT ' : 'SLEPT  '} ${'wrong-build'.padEnd(18)} exit=${guard} (must be 3)`);
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
  // The whole point is the PACKED build. Pointed at the ordinary bundle this
  // would pass and prove nothing about what ships — an instrument that answers
  // about whatever it happens to be looking at (GOTCHAS §48).
  console.error(`ABORTED: ${URL} is not an artifact.html. This check exists to test the`
    + ' PACKED single-file build; against the ordinary bundle it would pass and mean nothing.');
  process.exit(3);
}

for (const g of GAMES) {
  const r = labelFromSource(...g.source);
  if (r.err) {
    console.error(`ABORTED: ${r.err}.`);
    console.error('  This check joins the stool to the game on that string and will not guess'
      + ' it. Nothing was measured.');
    process.exit(3);
  }
  g.label = r.label; g.where = r.where;
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
// Exit 3, not a crash, when nothing is serving — GOTCHAS §32. Its sibling
// `L-slots-inworld.mjs` grew this guard first and then this one crashed on the
// very next run for want of it, which is the argument for fixing a class rather
// than an instance: node turns an unhandled throw into exit 1, and exit 1 in
// this project means "measured, and it is WRONG".
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
} catch (e) {
  console.error(`ABORTED: ${URL} is not serving — ${String(e.message).split('\n')[0]}`);
  console.error('  Nothing was measured. This is not a red.');
  await b.close();
  process.exit(3);
}

const up = await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 })
  .then(() => true).catch(() => false);
if (!up) {
  console.error('ABORTED: the artifact never initialised — nothing below was measured.');
  await b.close(); process.exit(3);
}

// The panels are built inside a `.then()` on a dynamic import, so they arrive a
// tick after the world does. Wait for the EVENT rather than sleeping a constant
// (GOTCHAS §30) — and a timeout here is the finding, not an error.
const waited = await p.waitForFunction(
  () => typeof window.__slots?.open === 'function' && typeof window.__blackjack?.open === 'function',
  { timeout: 15000 }).then(() => true).catch(() => false);

// Mutate only once the world is up: every one of these replaces something the
// world publishes, none of which exists before it does. The `arrived` verdict
// is therefore READ AFTER this and not from `waited` — asserting the state the
// wait observed would make the two `*-gone` mutations invisible, which is
// precisely how this check slept on them on its first selftest.
if (process.env.L_ART_MUTATE) {
  const fn = MUTATIONS[process.env.L_ART_MUTATE];
  if (!fn) { console.error(`ABORTED: no mutation "${process.env.L_ART_MUTATE}"`); await b.close(); process.exit(3); }
  await p.evaluate(fn);
  console.log(`  [MUTATED: ${process.env.L_ART_MUTATE}] — this run is expected to FAIL`);
}
const arrived = waited && await p.evaluate(
  (keys) => keys.every((k) => typeof window[k]?.open === 'function'),
  GAMES.map((g) => g.station)).catch(() => false);

console.log('\nWALKING UP TO BOTH GAMES AND SITTING DOWN, IN THE SINGLE-FILE ARTIFACT.\n');
for (const g of GAMES) console.log(`  ${g.name.padEnd(12)} joins its stool on '${g.label}'  (${g.where})`);
console.log();

check(arrived,
  'both games reach the packed artifact — their panels are built behind a DYNAMIC'
  + ' import of ct/hud.ts, which is a code-split point that the single-file pack'
  + ' has to inline; if it did not, they would be silently absent from the only'
  + ' build the user opens (GOTCHAS §28, §37)');
if (!arrived) {
  console.error('\n  a game is not reachable in the artifact — nothing below is meaningful.');
  await b.close(); process.exit(1);
}

// ── THE MATHS SURVIVED THE BUNDLER ──────────────────────────────────────────
// Kept from the `open()` era and still worth having: a tree-shake that dropped
// a strip or a pay row leaves a machine that runs and pays the wrong amount,
// which no amount of sitting down would show.
const rtp = await p.evaluate(() => window.__slots.rtp());
console.log(`  the machine inside the artifact enumerates its own RTP at`
  + ` ${(rtp.rtp * 100).toFixed(3)}%`);
check(Math.abs(rtp.rtp - 0.92834) < 0.0001,
  `the slot machine's pay tables survived the pack — it computes ${(rtp.rtp * 100).toFixed(3)}%`
  + ' from its own strips, in the artifact, which a dropped strip or pay row would move');
check(rtp.combos === 10648, `and all ${rtp.combos.toLocaleString()} stop combinations are there`);

const rules = await p.evaluate(() => window.__blackjack.rules());
console.log(`  the table inside the artifact: ${rules.decks} decks, "${rules.dealer}",`
  + ` blackjack pays ${rules.blackjackPays}`);
check(rules.decks === 6 && rules.blackjackPays === 1.5 && !rules.hitsSoft17,
  'the blackjack table kept its rules through the pack');

// ── AND YOU CAN WALK UP TO EACH ONE AND SIT DOWN ────────────────────────────
const panelUp = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
// BUILDER-BRIEF §5: `press()` can begin and end inside a single animation frame
// and the [E] dispatch is an edge read once per rendered frame, so a tap is
// never observed. This once made a working feature report three false failures.
const hold = async (k, ms = 90) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms);
  await p.keyboard.up(k); await p.waitForTimeout(160);
};
const until = async (fn, arg, what, ms = 8000) => {
  try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};

// How far behind the approach point to start the walk, and how far the walk
// must actually carry you. Both MEASURED, not assumed —
// `probes/w28-walk-to-seat.mjs`, against this artifact:
//
//   back   slot settles at        walks to    blackjack settles at   walks to
//   0.6    7.01 (shoved 0.18)     8.13        −10.75 (no shove)      −12.03
//   1.0    7.01 (shoved 0.58)     8.17        −10.35 (no shove)      −12.04
//   1.5    5.04 (shoved 0.89)     4.99 ✗      −9.85  (no shove)      −12.02
//
// Two things that decide the design. First, there is only 0.42 m of clear floor
// behind a slot stool's approach point — ask for more and the world settles you
// at the same 7.01 — so a bigger set-back does not buy a longer walk. Second, at
// 1.5 m the slot start point is on the FAR side of the machine row behind: the
// player cannot get through, walks in on a different stool two rows away, and
// the prompt still reads 'sit at the slot'. That run would have passed. It is
// why the walk below stops on ARRIVING AT THIS SEAT and not on the prompt.
//
// The prompt alone is worth almost nothing here: the trigger radius is over a
// metre, so it is already up on the first frame — the original attempt at this
// walked 0.10 m and called it a walk. So W is held until the player stops
// advancing on the seat, and the distance covered is itself a verdict.
const BACK = 1.0;
const MIN_WALK = 0.5;     // slots cover 1.12 m from the shoved start, blackjack 1.69 m
const AT_SEAT = 0.5;      // both stop 0.05–0.12 m from the stool they were aimed at

for (const g of GAMES) {
  console.log(`\n── ${g.name}: ${g.what} ─────────────────────────────`);

  const seats = await p.evaluate((l) => window.__ct.seats().filter((s) => s.label === l), g.label);
  // GOTCHAS §34: assert the population before the absences, or nought seats
  // makes every verdict below free. A FAIL and not an abort — see the header.
  check(seats.length > 0,
    `${g.what} publishes at least one seat under its own '${g.label}'`
    + ` (${seats.length} found) — with none it is reachable only from the console,`
    + ' which is not a way anybody plays it');
  if (!seats.length) { console.log('      (no seat — nothing further about this game was measured)'); continue; }
  console.log(`  ${seats.length} seat(s) carry '${g.label}'`);

  const seat = seats[Math.floor(seats.length / 2)];
  const before = await panelUp();

  // A stride BEHIND the seat's own approach point, facing the seat.
  //
  // Derived from the geometry the world publishes, deliberately NOT from
  // `pose.yaw`: `int-casino.ts:1203` puts the approach at `seat − facing·0.8`,
  // so the facing IS `normalize(pose − at)`, and `facing = (sin yaw, −cos yaw)`
  // (same file, same comment). Reading `pose.yaw` would make this inherit the
  // exact fault this class of bug is made of — 96 stools once sat you looking
  // at the far wall because that yaw was written the other way round.
  await p.evaluate(({ s, back }) => {
    const dx = s.at.x - s.pose.x, dz = s.at.z - s.pose.z;
    const len = Math.hypot(dx, dz) || 1;
    window.__ct.warp(s.at.x + (dx / len) * back, s.at.z + (dz / len) * back,
      Math.atan2(-dx / len, dz / len), undefined, 0);
  }, { s: seat, back: BACK });
  await p.waitForTimeout(250);
  const from = await p.evaluate(() => window.__ct.pos());

  // WALK IN. Hold W until the player STOPS ADVANCING on the stool — the event,
  // not a constant sleep (GOTCHAS §30) — and never longer than the cap. Both
  // games run out of floor at the stool itself, so "stopped" is arrival.
  const dTo = (q) => Math.hypot(q[0] - seat.pose.x, q[2] - seat.pose.z);
  await p.keyboard.down('w');
  let last = dTo(from), stalled = 0, to = from;
  for (let i = 0; i < 20 && stalled < 3; i++) {          // ≤3.0 s
    await p.waitForTimeout(150);
    to = await p.evaluate(() => window.__ct.pos());
    const d = dTo(to);
    stalled = last - d < 0.02 ? stalled + 1 : 0;
    last = d;
  }
  await p.keyboard.up('w');
  await p.waitForTimeout(120);
  to = await p.evaluate(() => window.__ct.pos());
  const walked = Math.hypot(to[0] - from[0], to[2] - from[2]);
  // How much of the requested set-back the world actually granted. Slot stools
  // have 0.42 m of clear floor behind their approach point and no more, so this
  // is normally ~0.6 m for SEVENS and 0 for GOLDEN ACES — worth printing rather
  // than hiding, because it is the reason MIN_WALK cannot be raised.
  const len = Math.hypot(seat.at.x - seat.pose.x, seat.at.z - seat.pose.z) || 1;
  const shoved = Math.hypot(from[0] - (seat.at.x + (seat.at.x - seat.pose.x) / len * BACK),
    from[2] - (seat.at.z + (seat.at.z - seat.pose.z) / len * BACK));
  console.log(`  walked ${walked.toFixed(2)} m from (${from[0].toFixed(2)}, ${from[2].toFixed(2)})`
    + ` to (${to[0].toFixed(2)}, ${to[2].toFixed(2)}) — ${dTo(to).toFixed(2)} m from the stool`
    + (shoved > 0.1 ? `  [the ${BACK.toFixed(1)} m set-back settled ${shoved.toFixed(2)} m forward: no more clear floor behind]` : ''));

  const offered = await p.evaluate((l) => {
    const d = document.getElementById('ct-prompt');
    return !!d && d.style.display !== 'none' && (d.textContent ?? '').includes(l);
  }, g.label);
  check(walked >= MIN_WALK && dTo(to) <= AT_SEAT,
    `you can WALK to ${g.what} — held W carried the player ${walked.toFixed(2)} m and left him`
    + ` ${dTo(to).toFixed(2)} m from the stool he set out for, so the seat is REACHABLE and not`
    + ' merely triggerable by a teleport onto it');
  check(offered,
    `and standing there ${g.what} OFFERS you its seat, by the label its own module joins on`);
  check(before === null, `no panel was up beforehand — so this is measuring the sit at ${g.name}`);

  await hold('e');                                   // sit
  const seated = await until(() => !!window.__ct.seated(), undefined, 'the player to be seated');
  await until((id) => window.__hud.panel() === id, g.panel, `${g.what} to open`);
  const after = await panelUp();

  // WHICH seat you landed on, read back from the world rather than assumed. The
  // same casino floor carries 21 other stools labelled 'sit at the table'
  // (roulette, craps, poker) a couple of metres away, and a walk that drifted
  // onto one of those would otherwise read as a clean pass.
  const onLabel = await p.evaluate(() => {
    const pose = window.__ct.seated();
    if (!pose) return null;
    return window.__ct.seats().find((s) => s.pose === pose)?.label ?? '(a seat with no label)';
  });
  console.log(`  aimed at the stool at (${seat.pose.x.toFixed(2)}, ${seat.pose.z.toFixed(2)});`
    + ` seated on '${onLabel ?? 'nothing'}';  panel before: ${before ?? 'none'}  after: ${after ?? 'none'}`);

  check(seated && onLabel === g.label,
    `HOLDING [E] SEATS THE PLAYER ON ${g.what.toUpperCase()}'S OWN STOOL, in the packed`
    + ` artifact (landed on '${onLabel ?? 'nothing'}')`);
  check(after === g.panel,
    `and sitting down OPENS ${g.name} — the SEAT is the trigger, not \`${g.station}.open()\``);

  // …and it actually plays. A game that opens and cannot be used is the same
  // outcome for the player as one that is missing.
  if (after === g.panel) {
    const r = await p.evaluate(g.play);
    check(r.ok, `and from that seat ${g.what} ${r.how}, in the artifact`);
  } else {
    check(false, `${g.what} could not be played — it never opened from its seat`);
  }

  // ── AND YOU CAN GET BACK UP ───────────────────────────────────────────────
  // BUILDER-BRIEF §11: a panel you cannot close is the worst bug this project
  // ships, `hud.ts` blocks keydown while one is open, and "i can't get up
  // anything i do once i sit down" took three rounds to fix. A sit that cannot
  // be undone is not a working seat, so it is checked here rather than left to
  // whoever wrote the sit.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  const closed = await panelUp();
  check(closed === null, `ESCAPE closes ${g.name} from inside it (panel now ${closed ?? 'none'})`);

  await until(() => !window.__ct.seated(), undefined, 'the player to stand up', 4000);
  const stillSeated = await p.evaluate(() => !!window.__ct.seated());
  if (stillSeated) { await hold('e'); await p.waitForTimeout(300); }
  const standing = await p.evaluate(() => !window.__ct.seated());
  check(standing,
    `and the player GETS BACK UP off ${g.what} — not trapped (BUILDER-BRIEF §11)`
    + (stillSeated ? ' [needed a further E after Escape]' : ''));
  // Leave the world clean for the next game rather than carrying a stuck panel
  // into it, which would turn one fault into three.
  if (!standing || closed !== null) await p.evaluate(() => window.__hud?.closePanels?.());
}

console.log();
check(errs.length === 0, `no console errors from the artifact (${errs.length})`
  + (errs.length ? `: ${errs[0]}` : ''));

await b.close();
console.log(bad === 0 ? '\n  all checks pass — you can walk up to both games, sit down and play.\n'
                      : `\n  ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
