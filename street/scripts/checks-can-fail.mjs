// EVERY REGISTERED CHECK MUST DECLARE A WAY TO GO RED.
//
// The sibling guard `checks-registered.mjs` asks "is every self-testing script
// in the suite?". This asks the other half, which nothing asked: "does every
// check in the suite have a failing path at all?"
//
// Both halves are needed because they fail in opposite directions. A script
// with a selftest and no registry row runs never. A registry row with no
// selftest runs constantly and has never once been watched go red — and that is
// indistinguishable, from the summary, from a check that works.
//
// This project has paid for that three times, all found by hand and all the
// same shape: `health.mjs` printed WORLD BROKEN and exited 0 (item 61),
// `bugsweep.mjs` printed STATION MISS and exited 0 (item 62), and
// `w21-roof-climb.mjs` the same (item 64). A dead world scored green for
// months.
//
// AND THE DESK'S FIRST SWEEP FOR THEM FOUND ONLY ONE, because it grepped for
// whether `process.exit` appears anywhere in the file. All three call it — just
// never on the path that matters. THE TEST HAS TO BE BEHAVIOURAL: break the
// thing and read the status. That full sweep is item 70's remaining work; this
// guard is the part that stops the backlog growing while it happens.
//
// What it enforces: every row of CHECKS in scripts/checks.mjs either declares a
// failing path (`true` for a --selftest, or a named scripts/canfail.mjs case),
// or is named below with a reason. Opting out is fine. Opting out silently is
// not — the same rule, and the same wording, as checks-registered.mjs.
//
// No browser, no server, no build. Usage: node scripts/checks-can-fail.mjs
import { readFileSync } from 'node:fs';

// ── rows that legitimately have no mutation to run ──────────────────────────
//
// These are guards over the REPOSITORY rather than over the world: there is no
// world state to break, so `--selftest` has nothing to mean. Each still exits
// non-zero on its own failing path.
const EXEMPT = {
  'checks-registered': 'a guard over scripts/ itself — no world state to mutate',
  'checks-can-fail': 'this file — a guard over the registry, with no world state to mutate',
  'no-silent-pass': 'a guard over the other checks\' output — mutating the world proves nothing about it',
  'hashes-resolve': 'reads the repo, not the world — its failing path is a missing file',
};

// ── rows inventoried by item 70 as having NO failing-path proof yet ──────────
//
// THIS LIST IS A DEBT REGISTER, NOT A BLESSING. Every name here is a check that
// runs on every suite and that nothing has ever watched fail. It is written out
// in full, rather than waved through by a rule, so the count is visible and can
// only go down: taking one off means giving it a selftest or a canfail case.
//
// Produced by scripts/probes/w32-failpath-inventory.mjs against the registry,
// not typed from memory.
const NO_PROOF_YET = [
  'lot-frontage', 'mirror-walk', 'I-apron-grain', 'people-walk', 'floaters-walk',
  'jump-walk', 'feet-check', 'side-night',
  // 'gaps' — MOVED to WITHHELD below. It was never "nobody has looked": w37
  //   looked, tried, and wrote down why a case cannot be expressed. That reason
  //   belongs somewhere a reader can see it expire.
  // 'corner-traffic' — CLEARED by w37, item 77: canfail case `corner-lean-into`.
  //
  // 'unstick-walk' — CLEARED by onehundredfour, item 258: canfail case
  //   `unstick-off`. IT WAS ON THIS REGISTER FOR SIX DAYS FOR A REASON THAT HAD
  //   EXPIRED. w37 (item 77) had a working mutation and withheld it deliberately
  //   and correctly — the check was red on unmutated mainline at a phantom trap
  //   at (8.50, -94.50), and canfail scores CAUGHT on any non-zero exit
  //   (GOTCHAS §32), so a case would have certified itself whatever it did.
  //   Then the phantom was diagnosed as unstick-walk.mjs's own rotation-
  //   blindness and the check went green — and nothing anywhere could notice,
  //   because the deferral existed only as English prose. That is the whole
  //   reason WITHHELD below exists. Baseline re-measured green three times
  //   across two builds before the case was added.
  // 'crowd-net' — CLEARED by w37, item 77: canfail case `crowd-net-inroad`.
  // 'side-walk' — CLEARED by w37, item 77: canfail case `sidewalk-sealed`. It
  // already had a working failing path; nothing had watched it use one.
  // 'I-seat-exit' — CLEARED by w37, item 77: cases `seat-traps` and `seat-nosit`.
  // SIXTH MEMBER OF THE health.mjs FAMILY, and it needed a fix before either
  // case could mean anything: the verdict was `stuck.length ? 1 : 0`, so with
  // nothing in the world sittable it printed "no seat traps the player" over an
  // empty sample and exited 0. Proved twice, pre-fix and fixed, same broken world.
  // 'w21-roof-climb' — CLEARED by w37, item 77: canfail case `roof-unreachable`.
  // It already HAD a working failing path (item 64 gave it one); what it lacked
  // was a mutation anyone had watched it catch. Note the case is NOT w33's
  // 100-nanometre nudge, which item 77 handed on as ready-made and which no
  // longer reproduces — see the comment on the case in canfail.mjs.
  // 'A-eye-height-holds' — CLEARED by w35, item 72: canfail case `eye-gate-flat`,
  // proven CAUGHT behaviourally rather than declared.
  // 'integration-doors' — CLEARED by w36, item 73: canfail case `door-standoff`.
  // 'jitter' — CLEARED by w36, item 73: canfail case `jitter-reversals`.
  // BOTH NEEDED A FIX BEFORE THEY COULD BE CLEARED: each printed its own failure
  // and exited 0, so no mutation could ever have shown up. Proved twice — the
  // mutation was run against the fixed script and against the pre-fix script
  // from git on the same broken world, and only the fixed one goes red.
  'K-seat-lets-you-up', 'O-jail-door-agree',
  'L-slots-inworld', 'L-every-stool-seats-you', 'L-blackjack-inworld',
];

// ── guards we CHOSE NOT TO WRITE, and the reason that would end the choice ───
//
// ITEM 258, AND THE ONE THING THIS FILE COULD NOT SEE. `unstick-walk` sat on the
// register above for six days carrying a deferral that had already expired.
// w37 had a working mutation for it and withheld it — correctly, because the
// check was red on unmutated mainline and canfail scores CAUGHT on any non-zero
// exit, so the case would have certified itself. Then the world was fixed. The
// check went green. Nobody came back.
//
// **Nothing could have told them to.** This file reports whether a row DECLARES
// a failing path. It cannot know a case was written, tested, and held back for
// a temporary reason — that fact lived in an English comment in canfail.mjs,
// where no instrument reads. A withheld guard therefore stays withheld for ever,
// silently, after its reason evaporates. NO_PROOF_YET above cannot carry it
// either: that list means "nobody has looked yet", which is the opposite claim.
//
// So: a name here is a guard somebody looked at, decided against, and wrote down
// WHY and WHAT WOULD CHANGE THE ANSWER. The suite prints the block below on
// every run, green or red, with the age of each deferral in days — because the
// failure this fixes is not a wrong entry, it is an entry nobody re-reads. Six
// days was enough to lose one. Deliberately no automatic expiry: a machine
// cannot tell that a phantom trap was diagnosed away. A human reading
// "withheld 41 days ago because X" can, in about four seconds.
//
// KEEP IT SMALL. If you are tempted to add a name here because writing the case
// is tedious, it belongs in NO_PROOF_YET instead — this list is for cases that
// are IMPOSSIBLE or MISLEADING to write, not merely unwritten.
const WITHHELD = {
  gaps: {
    since: '2026-07-25',
    why: 'no single find/replace can express it — putting a vehicle on an [E] spot '
       + 'takes TWO coordinates (x from PARK_SNUG, z from the seeded stream), and '
       + 'w37\'s one-coordinate attempt correctly stayed green with the car 2.6 m '
       + 'away on the carriageway. A case that does not break the thing tests nothing.',
    expiresWhen: 'canfail can apply more than one edit per case, or the parking draw '
       + 'takes its spot from a single constant',
    where: 'scripts/canfail.mjs, above the carstate-bay case',
  },
};

const src = readFileSync('scripts/checks.mjs', 'utf8');
const body = src.slice(src.indexOf('const CHECKS = ['));

const rows = [];
for (const m of body.matchAll(/^\s*\['([a-zA-Z0-9._-]+)',\s*(.*)$/gm)) {
  const [, name, rest] = m;
  // drop the question string, then read the selftest column
  const after = rest.replace(/^(['"]).*?[^\\]\1\s*,\s*/, '');
  // THE COLUMN HAS THREE SHAPES, NOT TWO — and the third is a BARE STRING.
  //
  // scripts/checks.mjs reads it as: `false` skip, `true` pass --selftest,
  // anything else is canfail case names via
  // `Array.isArray(selftest) ? selftest : [selftest]` — so `'park-repro'` on
  // its own is a perfectly good declaration, and six rows use it that way
  // (park-repro, faces, crowd-walk, A-joinery-matches-fascia,
  // A-tree-canopy-opaque, A-diner-block-vs-sky).
  //
  // The first version of this parser accepted only `true` and `[`, and so
  // reported all six as having no way to go red — six working checks accused
  // by a guard that had only ever been tried against the two shapes I had in
  // mind. Caught by running it, not by reading it.
  const declares = /^true/.test(after) || /^\[/.test(after) || /^['"]/.test(after);
  rows.push({ name, declares });
}

if (!rows.length) {
  // A parser that matches nothing would pass this guard silently, which is the
  // exact shape the guard exists to catch. (GOTCHAS 34.)
  console.error('checks-can-fail: parsed ZERO rows out of scripts/checks.mjs.');
  console.error('That is a broken parser, not an empty registry — refusing to report a pass.');
  process.exit(2);
}

const WITHHELD_NAMES = Object.keys(WITHHELD);
const known = new Set([...Object.keys(EXEMPT), ...NO_PROOF_YET, ...WITHHELD_NAMES]);
const undeclared = rows.filter((r) => !r.declares && !known.has(r.name)).map((r) => r.name);
// …and the debt register must not rot either: a name that has since been given a
// selftest, or removed from the suite, should come off the list.
const registry = new Set(rows.map((r) => r.name));
const settled = (n) => !registry.has(n) || rows.find((r) => r.name === n)?.declares;
const stale = NO_PROOF_YET.filter(settled);
// THE SAME ROT TEST FOR WITHHELD, and it is the load-bearing half of the new
// convention. A withheld guard that has since been WRITTEN — the row now
// declares a path — must come off this list, or the next reader is told a case
// is missing that is sitting right there. That is precisely the state
// `unstick-walk` would have been left in had item 258 only added the case.
const staleWithheld = WITHHELD_NAMES.filter(settled);
// …and a deferral with no reason is the prose comment all over again, wearing a
// data structure. Refuse it rather than print a blank line.
const thin = WITHHELD_NAMES.filter((n) => !WITHHELD[n]?.why || !WITHHELD[n]?.since || !WITHHELD[n]?.expiresWhen);
// A name cannot be both "nobody has looked" and "somebody looked and declined".
const doubleCounted = WITHHELD_NAMES.filter((n) => NO_PROOF_YET.includes(n));

for (const [name, why] of Object.entries(EXEMPT)) console.log(`  exempt  ${name} — ${why}`);
console.log(`\n  ${rows.length} registered checks; ${rows.filter((r) => r.declares).length} declare a failing path`);
console.log(`  ${NO_PROOF_YET.length} on the item-70 debt register (no proof yet)`);
console.log(`  ${WITHHELD_NAMES.length} WITHHELD — a guard somebody decided not to write`);

// ── the WITHHELD block, printed on EVERY run, green or red ──────────────────
//
// Not gated on failure, and that is the entire mechanism. A deferral that only
// surfaces when something else is already broken is a deferral nobody reads —
// which is how six days passed on `unstick-walk`. The age in days is the part a
// human acts on: "withheld 9 days ago because the check was red" invites exactly
// the question "is it still red?", and that question is thirty seconds to
// answer. Derived from `since` rather than typed, so it cannot go stale itself.
if (WITHHELD_NAMES.length) {
  console.log('\nWITHHELD — guards deliberately not written. Re-read these; a reason can expire:\n');
  const today = Date.now();
  for (const n of WITHHELD_NAMES) {
    const w = WITHHELD[n];
    const days = Math.floor((today - Date.parse(w.since)) / 86400000);
    console.log(`  ${n}  (withheld ${w.since}, ${days} day${days === 1 ? '' : 's'} ago — ${w.where})`);
    console.log(`      why:  ${w.why}`);
    console.log(`      ends: ${w.expiresWhen}\n`);
  }
  console.log('  If one of those reasons no longer holds, WRITE THE CASE and delete the entry.');
  console.log('  A withheld guard is invisible to every other instrument here — that is why it is printed.');
}

if (!undeclared.length && !stale.length && !staleWithheld.length && !thin.length && !doubleCounted.length) {
  console.log('\nchecks-can-fail: every registered check declares a failing path, is exempt, is on the register, or is WITHHELD with a reason');
  process.exit(0);
}
if (undeclared.length) {
  console.error('\nREGISTERED WITH NO WAY TO GO RED — these run every suite and have never been watched fail:\n');
  for (const n of undeclared) console.error(`  ${n}`);
  console.error(`
Give it a failing path, or say why it has none:
  · a --selftest in the script, and \`true\` in its CHECKS row, or
  · a named mutation in scripts/canfail.mjs, and \`['case']\` in the row, or
  · a line in EXEMPT in this file, WITH A REASON, or
  · a line in WITHHELD in this file, with a reason AND what would end it.
A check nothing has watched fail is indistinguishable from one that works.`);
}
if (stale.length) {
  console.error('\nTHE DEBT REGISTER IN THIS FILE HAS GONE STALE — these no longer belong on it:\n');
  for (const n of stale) console.error(`  ${n} — now declares a failing path, or is no longer registered`);
  console.error('\nRemove it from NO_PROOF_YET. A register that keeps names it has settled stops being read.');
}
if (staleWithheld.length) {
  console.error('\nA WITHHELD GUARD HAS SINCE BEEN WRITTEN — the deferral is over:\n');
  for (const n of staleWithheld) console.error(`  ${n} — now declares a failing path, or is no longer registered`);
  console.error('\nDelete it from WITHHELD. Leaving it says a case is missing that is sitting right there.');
}
if (thin.length) {
  console.error('\nA WITHHELD ENTRY WITH NO REASON IS THE PROSE COMMENT AGAIN:\n');
  for (const n of thin) console.error(`  ${n} — needs all three of since, why, expiresWhen`);
  console.error('\nThe point of this list is that a reader can tell when a reason has expired.');
}
if (doubleCounted.length) {
  console.error('\nBOTH WITHHELD AND ON THE DEBT REGISTER — these are opposite claims:\n');
  for (const n of doubleCounted) console.error(`  ${n} — "nobody has looked" and "somebody looked and declined"`);
  console.error('\nPick one. NO_PROOF_YET is unexamined debt; WITHHELD is an examined decision.');
}
process.exit(1);
