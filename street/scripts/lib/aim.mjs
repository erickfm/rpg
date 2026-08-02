// WHICH WORLD IS THIS INSTRUMENT POINTED AT, and did anybody choose it?
//
// 648 scripts in this directory carried a line of the shape
//
//     const URL = process.env.SHOT_URL ?? 'http://localhost:4185/';
//
// across 21 different hardcoded ports. Run any of them without `SHOT_URL` and
// they open that port, measure whatever is serving it, and print a confident
// number about it — with nothing in the output saying the port was a default
// nobody picked.
//
// ON A MACHINE WITH NINE BUILDERS THAT PORT BELONGS TO SOMEBODY ELSE. Measured
// on 2026-08-02: every port in 4180-4199 was listening, and `jump-walk.mjs`'s
// default of 4185 had been serving another builder's tree all session. That is
// GOTCHAS 48 — "an instrument that cannot be aimed gives a specific, credible,
// wrong number" — and this repo has paid for it repeatedly:
//
//   · canfail.mjs reported 0/3 guards SLEPT; it was 3/3 CAUGHT against its own
//     port. Two separate rounds lost, and its header says so at length.
//   · five guards were reported as having STOPPED GUARDING when all six were
//     fine.
//   · a 5.260 m jump report cost a builder a whole item to disprove.
//
// Nobody was careless in any of those. The instrument answered a question it
// had no way to ask, and said nothing about having guessed.
//
// ── what this does, and what it deliberately does not ─────────────────────
//
// `SHOT_URL` set  → hand it straight back, in silence. That is the normal path
//                   and it is completely unchanged.
// `SHOT_URL` unset → hand back the same fallback the script had, so nothing
//                   that works today stops working — but say so, loudly, on
//                   the FIRST lines of output, naming the port and saying it
//                   was not chosen.
//
// IT ANNOUNCES RATHER THAN REFUSES, and that is a deliberate split from
// `canfail.mjs`, which refuses outright. canfail is one tool with one caller
// and a documented invocation; this is 648 scripts, most of them one-shot
// probes whose whole value is being runnable in one line while you are looking
// at something. Refusing would have converted a silent wrong answer into a
// blanket "cannot run", which is a worse trade for a probe and no better for a
// check — `checks.mjs` passes `SHOT_URL` explicitly to everything it spawns, so
// no registered check ever reaches this branch at all.
//
// The banner goes to STDERR on purpose: a caller piping stdout into a diff or a
// summary still sees it on the terminal, and it cannot be swallowed by a `| tail`.
//
// Usage — replaces the `??` expression it was codemodded from, in place:
//
//     import { aim } from './lib/aim.mjs';        // '../lib/aim.mjs' in probes/
//     const URL = aim('http://localhost:4185/');

/** Resolve the world to measure. Returns `SHOT_URL` when set; otherwise returns
 *  `fallback` and prints an unmissable banner saying the port was not chosen. */
export function aim(fallback) {
  const set = process.env.SHOT_URL;
  if (set) return set;
  const port = (String(fallback).match(/:(\d+)/) ?? [, '?'])[1];
  const who = process.argv[1] ? process.argv[1].split('/').slice(-2).join('/') : 'this script';
  process.stderr.write(
    `\n  ⚠  NOT AIMED — no SHOT_URL, so ${who} fell back to PORT ${port}.\n`
    + `     ${fallback}\n`
    + `     Nobody chose that port. If another builder is serving it, everything\n`
    + `     below is a confident measurement of SOMEBODY ELSE'S WORLD (GOTCHAS 48).\n`
    + `     Aim it:  SHOT_URL=http://localhost:<your port>/ node ${who}\n\n`);
  return fallback;
}
