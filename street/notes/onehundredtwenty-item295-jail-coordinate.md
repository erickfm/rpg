# Item 295 — retire the dead jail coordinate, and write down the trap

Worker onehundredtwenty, 2026-08-03. **Two text edits, exactly as the trimmed row
asked. No probe, no harness, no suite leg** — and nothing to run, so no port.

## Root cause in one line

**`(1006.37, 2.42, -5.60)` was quoted by two workers and there is nothing there**
— the material is at `-9.40`, one slot window along the same cell wall — and it
survived because every instrument in the argument read `material.color` from JS,
which cannot see that the night grader returned early.

## I checked the settlement against source before propagating it

The row hands down a verdict, and BUILDER-BRIEF §7 says find the number in the
source rather than believe it. Both halves hold:

- `src/proto/ct/props.ts:978` is exactly
  `if (Math.abs(wp.x) > 100) return;   // interiors keep their own light`.
- The jail really is past it, **derived, not taken on trust**:
  `src/proto/ct/interior.ts:46` is `const SLAB_X0 = 400, SLAB_W = 80`, so
  interior slabs sit at 400, 480, 560 … and the jail's is centred at **x 1000**.

So the grader never touches the room, and onehundredeighteen's pixels
(108.69 at 13:00, 108.69 at 02:00, against a street control 86.21 → 34.02) are
what a correctly-behaving room looks like.

## (1) The coordinate — LIVE uses fixed, RECORDS annotated

The distinction I worked to, because the row says *"returns nothing **live**"*:
**a number still aiming an instrument is live; a number in a worker's write-up is
a record**, and rewriting records falsifies them (the same reasoning GOTCHAS'
own renumbering table uses for `notes/archive/`).

**Fixed, because they were aiming something:**

- `scripts/probes/w116-jail-which-material.mjs` — `const T = [1006.37, 2.42, -5.60]`
  was the comparison target. It could only ever print *"NOT the coordinate item
  240 names"*, which is precisely how this gets re-litigated a fourth time. Now
  `-9.40`, with the settled pixel verdict written next to it.
- `scripts/probes/w71-jail-slot-look.mjs` — **this one was worse than a stale
  comment: it was a live camera station.** `warp(room.cx, -5.6, …)` parked the
  camera at a z with no window at it, while the material search beside it finds
  the slot **by geometry** and so was reading the right material all along. So it
  printed correct hexes over photographs of somewhere else. Hoisted to one named
  `SLOT_Z = -9.40`; the two were separate literals, which is how they drifted
  apart.
- `scripts/interiors-walk.mjs`, the `DECLARED` reason for the jail-light leg —
  it repeated `-5.60` and still read *"NOT SETTLED HERE … 240 is TODO and
  unclaimed; leave it there."* Rewritten to the settled verdict with the pixel
  numbers and the `props.ts:978` cause. **The leg is still declared failing and I
  did not loosen it** (BUILDER-BRIEF §7): it asserts `dimmed === 0` in a room that
  contains one window meant to dim, so it will keep failing, and the declaration
  now says why rather than promising a follow-up that has happened.

**Annotated at the top, body untouched** — `notes/w64-flaky-light-leg.md`,
`notes/w72-index-pairing.md`, `notes/onehundredsixteen-item287-declared-reds.md`,
and the historical list inside `scripts/probes/w118-item240-jail-pixels.mjs`
(that list's whole job is to record what each worker claimed, so the two `-5.60`
quotations in it are the point and stay).

**Deliberately not touched:** `notes/archive/QUEUE-done-2026-08-02.md`. Archive.

Everything else `-5.60` in the repo is unrelated geometry — the forecourt walk,
the burger bin at `int-burger.ts:318`, the church altar, a dozen probe stations.
The tight grep is `1006\.37, 2\.42, -5\.6`, and what it returns now is only
corrections that say the figure is dead.

## (2) The trap — `notes/GOTCHAS.md` §92

*"`material.color` read from JS is not 'is it dark' — three workers, two
overturned verdicts."* It carries the pixel numbers, the one-line cause, why a
JS read is structurally blind to it (an early return leaves no trace in a
colour; `POOL_FRAG` is not readable from JS at all), the rule (**is-it-dark is a
PIXEL question, always**), and the dead coordinate with its live replacement.
`§91` is unchanged above it; nothing was renumbered.

## What I did not do

- **I did not run the world.** This item is text; there is nothing to walk. The
  four edited `.mjs`/`.ts` files pass `node --check`, which is the whole of what
  a text edit can be verified by.
- **I did not add an index row for §92** in GOTCHAS' "THE FOURTEEN THAT ACTUALLY
  BITE" table. That table is explicitly ranked by *how many times each entry was
  cited by a builder*, and a brand-new entry has been cited zero times. Putting
  it there by hand would be asserting a number I made up. It has cost three
  sessions, so I expect it to earn a row — the desk should add it when it does.
- **I did not verify onehundredeighteen's pixel figures myself.** I verified the
  *cause* they rest on, in source, above. The pixels are theirs.
