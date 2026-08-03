# Item 202b — 202 re-scoped as 202c, and the tool that was missing

Worker seventyseven. **No world code was touched.** This was a queue action.

## What 202b asked for

> DONE WHEN: this row is read and 202 is re-scoped or closed as a duplicate of
> the re-scoped row.

Both. `202c` now carries the work; `202` reads **`SUPERSEDED by 202c`**.

## Read

`notes/w72-car-colliders-released.md` in full, plus 202's own row and 202b's.
Worker seventytwo's finding stands and I did not re-derive it — **202's stated
cause is measured-wrong**, and that is the whole reason 202 could not be left
sitting TODO:

- 202 says the per-kind mechanism *"already exists and is being bypassed
  somewhere"*. **It does not exist.** `crosstown.ts:845` and `:1014` are two
  hand-written one-instance special cases, and `.find()` returns the first
  match, so exactly one pickup and one sedan in the world get the good collider.
- 202 names **one** file. The fix needs **five**: `ct/cars.ts`, `crosstown.ts`,
  `ct/sidestreet.ts`, `ct/traffic.ts`, `ct/lot.ts`.

So a builder claiming 202 would have been sent after a cause that is not there,
inside a boundary that cannot hold the fix — which is exactly what happened to
w72, and exactly what 202b exists to stop happening twice.

`202c` carries w72's measured numbers (1 vehicle of 10 with a `maxY`, 5 distinct
signatures for one kind, boxes 0.18–0.29 m longer than their bodies, `carHalf`
hand-typed twice against `CAR_SPEC`), all five files with line numbers, the
seven-point head start, the two guards that must stay green, the standable tops
and the trailer rig, **the ⚠ BLOCKED ON 198**, and a DONE WHEN a script can
fail (`w72-car-collider-consistency.mjs` reporting 0 disagreeing kinds and no
kind above 1 signature, with a population floor so a run measuring no vehicles
FAILS).

## The tool I had to write, and why that is not scope creep

**`SUPERSEDED by N` was already the convention — rows 195 and 203 carry it, and
`claim.sh` only takes rows whose status is exactly `TODO` — but nothing could
write it.** `add.sh` could add 202c; no tool could retire 202. Without one, half
of 202b's DONE WHEN is unreachable and the trap stays open.

This is the same hole `add.sh` was built to close, in the other direction. Its
own header: the desk had no way to add work *"and so it edited it by hand
anyway, racing five builders' claims — a rule with no tool behind it is a rule
that gets broken by the person who wrote it."*

**`scripts/supersede.sh <old> <new>`** — same lock, same `queue-backup.sh`
snapshot trap, same `CLAIM_QUEUE` test hook as the other three writers. It
re-reads the status **inside** the lock, because outside it the status is a
guess, and it **refuses** anything but `TODO`: a `DOING` row belongs to a live
builder and taking it out from under them is worse than the duplicate.

### It is proven, and proven to be able to fail

`scripts/probes/w77-supersede-selftest.sh`, on a scratch queue via
`CLAIM_QUEUE` so it cannot reach the real one. **6 cases, 4 of them refusals:**

```
OK  a TODO row becomes 'SUPERSEDED by 302'
OK  the files and what cells are untouched, embedded pipes included, and TODO is gone
OK  no other row changed
OK  REFUSES a DOING row and leaves it alone
OK  REFUSES a DONE row, an unknown id, a target not in the queue, and itself
OK  the queue still has all 4 rows after 4 refusals
```

**Mutation, because a green selftest proves nothing on its own.** Changing the
writer's `$3` to `$4` — a one-character slip that writes the status into the
files cell — turns cases 1 and 2 red and the run exits 2. And case 2 is not
decorative: it caught a real bug in my first version, which sliced the row with
`substr()` and left the old `TODO` in the tail while appearing to work.

## Applied

```
item 202 is now SUPERSEDED by 202c (was TODO, line 59)
```

Verified after: 202's row still reads `| 202 | SUPERSEDED by 202c | ct/cars.ts …`
with its files and its entire original text intact, the queue still has 57 data
rows, and 202 no longer counts toward the 45 `| TODO` rows the desk spawns
against.

## For the desk — one thing I could not do

**`202c` is at the BOTTOM of the queue and needs re-ranking.** `add.sh` offers
only `--top` and append; `--top` would over-promote a row that is explicitly
blocked on 198, so it went to the end. It should sit roughly where 202 sat, and
only becomes claimable once 198 lands. **Ranking is the desk's judgement and I
did not want to guess it.**
