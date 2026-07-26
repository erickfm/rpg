#!/usr/bin/env node
// THE CLAIM: both casino games survive the PACKED ARTIFACT — the single-file
// build the user actually opens — and not merely the dev server.
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
// not exist outside the bundler.
//
// A dynamic import is a code-split point. `pack-artifact.mjs` inlines
// everything into ONE file, and whether a lazily-imported chunk survives that
// is exactly the kind of thing that works in `vite preview` and fails in the
// pack. If it does fail, the panel is never constructed, `__slots` never
// appears, and both games are silently absent from the thing that ships — with
// every other check still green.
//
//   SHOT_URL=http://localhost:<port>/artifact.html node scripts/L-games-in-artifact.mjs
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 aborted — nothing measured.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

// GOTCHAS §27. The mutations remove from the artifact's published surface the
// exact things this check reads — which is what a module lost to the pack would
// look like from here, and is the only way to watch this particular check fail
// short of building a tree without the games in it.
const MUTATIONS = {
  'no-slots': '__slots',
  'no-blackjack': '__blackjack',
};

if (process.argv[2] === '--selftest') {
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
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(14)} exit=${code} fails=${failed}`);
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
  // The whole point is the PACKED build. Pointed at the ordinary bundle this
  // would pass and prove nothing about what ships — an instrument that answers
  // about whatever it happens to be looking at (GOTCHAS §48).
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
await p.goto(URL, { waitUntil: 'networkidle' });
if (process.env.L_ART_MUTATE) {
  const g = MUTATIONS[process.env.L_ART_MUTATE];
  if (!g) { console.error(`ABORTED: no mutation "${process.env.L_ART_MUTATE}"`); await b.close(); process.exit(3); }
  await p.evaluate((k) => { delete window[k]; Object.defineProperty(window, k, { get: () => undefined }); }, g);
  console.log(`  [MUTATED: ${process.env.L_ART_MUTATE}] — this run is expected to FAIL`);
}

console.log('\nSEVENS — both games, in the SINGLE-FILE ARTIFACT.\n');

const up = await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 })
  .then(() => true).catch(() => false);
if (!up) {
  console.error('ABORTED: the artifact never initialised — nothing below was measured.');
  await b.close(); process.exit(3);
}

// The panels are built inside a `.then()` on a dynamic import, so they arrive a
// tick after the world does. Wait for the EVENT rather than sleeping a constant
// (GOTCHAS §30) — and a timeout here is the finding, not an error.
const arrived = await p.waitForFunction(
  () => typeof window.__slots?.open === 'function' && typeof window.__blackjack?.open === 'function',
  { timeout: 15000 }).then(() => true).catch(() => false);

check(arrived,
  'both games reach the packed artifact — their panels are built behind a DYNAMIC'
  + ' import of ct/hud.ts, which is a code-split point that the single-file pack'
  + ' has to inline; if it did not, they would be silently absent from the only'
  + ' build the user opens (GOTCHAS §28, §37)');
if (!arrived) {
  console.error('\n  neither game is reachable in the artifact — nothing below is meaningful.');
  await b.close(); process.exit(1);
}

// The maths has to survive the bundler too: a tree-shake that dropped a strip or
// a pay row would leave a machine that runs and pays the wrong amount.
const rtp = await p.evaluate(() => window.__slots.rtp());
console.log(`  the machine inside the artifact enumerates its own RTP at`
  + ` ${(rtp.rtp * 100).toFixed(3)}%\n`);
check(Math.abs(rtp.rtp - 0.92834) < 0.0001,
  `the slot machine's pay tables survived the pack — it computes ${(rtp.rtp * 100).toFixed(3)}%`
  + ' from its own strips, in the artifact, which a dropped strip or pay row would move');
check(rtp.combos === 10648, `and all ${rtp.combos.toLocaleString()} stop combinations are there`);

const rules = await p.evaluate(() => window.__blackjack.rules());
console.log(`  the table inside the artifact: ${rules.decks} decks, "${rules.dealer}",`
  + ` blackjack pays ${rules.blackjackPays}\n`);
check(rules.decks === 6 && rules.blackjackPays === 1.5 && !rules.hitsSoft17,
  'the blackjack table kept its rules through the pack');

// …and both actually PLAY. A module that loads and cannot be used is the same
// outcome as one that is missing.
const slotOK = await p.evaluate(async () => {
  window.__slots.open();
  window.__slots.insert(20);
  const before = window.__slots.view().credits;
  const started = window.__slots.play();
  return { started, before, after: window.__slots.view().credits };
});
check(slotOK.started && slotOK.after === slotOK.before - 1,
  `the slot machine takes a bet and spins in the artifact (${slotOK.before} -> ${slotOK.after})`);
await p.evaluate(() => window.__slots.close());

const bjOK = await p.evaluate(async () => {
  window.__blackjack.open();
  window.__blackjack.buyIn(50);
  const dealt = window.__blackjack.deal();
  const v = window.__blackjack.view();
  return { dealt, phase: v.phase, chips: v.chips };
});
check(bjOK.dealt && bjOK.phase !== 'betting',
  `the blackjack table deals a hand in the artifact (phase ${bjOK.phase})`);
await p.evaluate(() => window.__blackjack.close());

check(errs.length === 0, `no console errors from the artifact (${errs.length})`
  + (errs.length ? `: ${errs[0]}` : ''));

await b.close();
console.log(bad === 0 ? '\n  all checks pass — both games ship.\n' : `\n  ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
