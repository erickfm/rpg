# w19 — `REACH_MARGIN` is read from the world now, in all four places

Queue item 40. Commit `2747366ad`. Port 4184 (4180–4199 were all taken by other
builders by the time I reached this item).

## Root cause, one line

`__ct` published a spot's `r` but never the margin added to it, so the only way
for a script to reconstruct the world's own near-test was to retype the number.

That is worth saying precisely, because it is not carelessness: **every one of
the four authors was reconstructing a predicate the world would not tell them.**
Give them a reader and the duplication has no reason to exist.

## The row's premise was right, its count was not

The item named **one** script. There are **four**, and one of them is a
registered check:

| file | what it did |
|---|---|
| `scripts/O-jail-walk.mjs` | `const REACH_MARGIN = 0.6;` — a registered check (SLOW tier) |
| `scripts/D-look-selects.mjs` | `const REACH_MARGIN = 0.6;` — **every verdict in the file** is a comparison against `r + REACH_MARGIN` |
| `scripts/probes/F-diag-owalk.mjs` | same copy |
| `scripts/probes/O-jail-walk-fix.mjs` | same copy, inside the page evaluate |

**Two of them also hand-computed the SUM**: `ok(gap > 1.65, ...)` with the
message `"r 1.05 + REACH_MARGIN 0.6"` — two copied numbers and their arithmetic,
so re-tuning either the margin or the jail spot's radius would have left the
assertion measuring against a line nobody re-drew. Both terms come off the world
now: `r` from the spot itself, the margin from `__ct.reachMargin()`.

**Three cited `fp.ts:425`.** The constant is at `fp.ts:486`. The number was right
only by luck of nobody having tuned it since — that is what a citation looks like
once it has stopped being a link.

## I did NOT merge the two `REACH`es

The row said not to, and it was right. `fp.ts`'s `REACH_MARGIN` is 0.6 and
`seat-facing.mjs`'s `REACH` is 0.80; they share four letters and nothing else —
one is how far outside its radius a spot can be selected, the other is how close
furniture has to be to count as "the thing you are sitting at". Untouched.

## The design decision, and why not the obvious one

`reachMargin: () => REACH_MARGIN` is a reader of its own rather than a `reach`
field on each `spots()` row. The margin is ONE global, not a property of a spot;
putting it on every row would have added ~200 copies of the number to the payload
whose whole purpose is to remove copies of the number. `crosstown.ts` already
imported `REACH_MARGIN` from `./fp` (line 27), so there is no copy on the world
side either.

## Mutation test

The check has to *follow* the world, not merely compile. With
`reachMargin: () => 0.05` patched into `crosstown.ts`:

    OK   the landing clears the way-in trigger — 2.20 m against r 1.05 + REACH_MARGIN 0.05 = 1.10

against the real world's

    OK   the landing clears the way-in trigger — 2.20 m against r 1.05 + REACH_MARGIN 0.6 = 1.65

Before the change it printed `1.65` whatever the world said. `crosstown.ts`
restored and rebuilt.

**A red-producing mutation is not reachable here, and I would rather say so than
fake one.** Margins of 1.5 and 5.0 — the values large enough to make the landing
assertion fail — change spot selection *inside the jail* enough that the way-out
`[E]` stops winning the pick, so the run aborts at exit 3 (nothing measured)
before reaching the assertion. That is the world breaking first, not the check
sleeping. The 0.05 run is the honest evidence: the value flows.

## Regression control

`scripts/O-jail-walk.mjs all` after the change: **11 checks, 1 failed**, and the
one failure is pre-existing. Proved rather than asserted — I ran the unmodified
script from `git show HEAD:...` side by side and it fails identically, at the
same coordinate, with the same numbers (`2.20 m` on the assertion I rewrote).

`scripts/D-look-selects.mjs`: **12 pass, 0 fail, 1 skipped — 3 spots settled**,
"looking selects at range, gaze is what does it, and it drops past the reach".

Both repaired probes now run and report the jail prompt live.

`node scripts/bugsweep.mjs`: zero STATION MISS.

## Found and NOT fixed

**1. `O-jail-walk.mjs` has a real, pre-existing red, and it is the same class as
this item.** `FAIL and on the PAVEMENT, not in the road — 55 < 60.12 < 57`. The
constant is `const FX = 57.0` at the top of the file — a hand-typed frontage
coordinate. The jail site was rebuilt with a forecourt reaching to about x 61
(`scripts/probes/O-jail-walk-fix.mjs`'s own text: *"walked past the old facade
line (x 56.88) into the new forecourt, stopped near the building's own face
(~61)"*), so the player lands at 60.12 on pavement that did not exist when 57.0
was typed. **The check is wrong and the world is right.** I did not widen the
bound — loosening a failing check until it passes is the one thing the brief
forbids, and `FX` is used by the lane assertions too, so it needs whoever owns
the jail site rather than a nudge from me.

**2. 288 files in `scripts/probes/` cannot import their libraries.** They still
say `from './lib/frames.mjs'` and the reorganisation moved them one directory
down, so `node scripts/probes/<any>.mjs` dies with `ERR_MODULE_NOT_FOUND` before
a browser opens. I repointed **only the two I had to edit** — an edit to a file
that cannot run is cosmetic — and left the other 286. This is the same
reorganisation `checks.mjs`'s pre-flight guard was written for; that guard covers
the CHECKS table, and nothing covers a probe.

**3. Two source comments still hand-type the value**, and are outside this item:

- `src/proto/ct/int-casino.ts:257` — "REACH_MARGIN = 0.6 on top of r"
- `src/proto/ct/int-hotel.ts:176` — "fp.ts:425 adds REACH_MARGIN = 0.6", the
  wrong line again

They are prose, so nothing executes them, but they are exactly the copies that go
quietly false. The DONE WHEN grep passes: **`src/proto/fp.ts:486` is the only
executable assignment of the value left in the repo.**

    grep -rn "REACH_MARGIN *= *[0-9]" --include=*.ts --include=*.mjs . \
      | grep -v node_modules | grep -vE ':[0-9]+: *(//|\*)'
    src/proto/fp.ts:486:export const REACH_MARGIN = 0.6;

## Verdict

No after-images: this adds one reader to `__ct` and changes where four scripts
get a number from. The world is unmoved — `npm run build` clean, bugsweep zero
STATION MISS, and the jail walk lands at the identical coordinate before and
after.
