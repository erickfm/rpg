# w36 — item 73: walking-tier checks with no failing path

**PARTIAL — 2 of 8 cleared, and I am handing the other 6 back rather than
reporting the item done.** The two I cleared were not the two I expected to
clear, because **two of the eight could not have been cleared at all until they
were repaired first.**

Ports **4193** (dev) and **4199** (deliberately dead, for the status sweep);
`guards.sh` picked **4290** for the canfail builds. Debt register **22 → 20**.

## The headline: two of the eight could not fail at all

`scripts/jitter.mjs` and `scripts/integration-doors.mjs` **printed their own
failure verdict and exited 0.** They are the fourth and fifth members of the
family this repo has now paid for five times — `health.mjs` (item 61),
`bugsweep.mjs` (item 62), `w21-roof-climb.mjs` (item 64).

This is not a subtlety in either file. In each, the *only* exit call guarded a
case that essentially never happens, and the verdict had no exit path:

| check | its only exit | the verdict, which had none |
|---|---|---|
| `jitter` | `exit(3)` — "no walkers sampled" | `**N reversals — back-and-forth is present` |
| `integration-doors` | `exit(1)` — "no declared doors at all" | `N/M doors let you in`, after `FAIL` lines |

`integration-doors` is the sharper of the two: the guard it *does* have is a
careful, well-commented one against scoring success over zero assertions — and
it sits 25 lines above a verdict that could not fail. **The more doors that
broke, the quieter it got.** Both are in the belt of checks `npm run checks`
runs on every suite.

**This is exactly the trap `checks-can-fail.mjs`'s own header warns about** — the
desk's first sweep for this family grepped for whether `process.exit` appears
anywhere in the file, and all of these call it, just never on the path that
matters. Both of mine would have passed that grep.

### Fixed, and proved TWICE

Each now exits 1 on its own verdict (and `jitter` keeps 3 for "could not
answer", so a builder who forgot to start a preview is still distinguishable
from a world that really jitters).

I proved each mutation against **the fixed script and the pre-fix script from
git, on the same broken world** — because a canfail case registered against
either of these a day earlier would have been scored SLEPT for a reason that had
nothing to do with the world:

| mutation | world before | world after | pre-fix script | fixed script |
|---|---|---|---|---|
| `jitter-reversals` | 0 reversals | **29 reversals** | prints `24 reversals — back-and-forth is present`, **exit 0** | **exit 1** |
| `door-standoff` | 12/12 doors | **8/12 doors** | prints `8/12 doors let you in`, **exit 0** | **exit 1** |

Both mutations are **world** mutations, not edits to the checks:

- **`jitter-reversals`** drops `c.pick` from the head of the offset candidate
  list in `crowd.ts`. `c.pick` is the lateral offset a walker has COMMITTED to,
  and `crowd.ts`'s own comment on that line calls re-deriving the choice every
  frame *"the other half of the oscillation"* — so this **restores the real bug
  the user reported** (*"this red guy glitches back and forth as he walks
  sometimes idk why"*, the first line of `jitter.mjs`) rather than inventing a
  new one.
- **`door-standoff`** pushes `doorStandFor`'s standoff from 0.75 m to 4.5 m, so
  the published stand points are out of `[E]` reach. That is the check's whole
  subject: stand where the world says the door is, and press E.

Then both were run through **canfail itself**, on a built bundle via
`guards.sh`, not just by hand:

```
OK   door-standoff     CAUGHT   published door spots too far out to reach the door
OK   jitter-reversals  CAUGHT   walkers flip-flopping as they pass, the stickiness gone
1/1 checks caught their mutation
every mutated file restored byte-for-byte
```

Registry rows moved from `false` to `['door-standoff']` and `['jitter-reversals']`;
both names struck from `NO_PROOF_YET`. `checks-can-fail.mjs` exits **0** and its
own staleness guard confirmed the strike (it went red first, naming both, until
I removed them — so that guard works).

## The "cannot measure" path — all 8, complete

Every one of the eight run against a **dead port** (4199, proved `000`), status
read **unpiped** via `scripts/probes/w35-status-sweep.sh`:

```
w21-roof-climb  exit=1     corner-traffic  exit=1
I-seat-exit     exit=1     crowd-net       exit=1
unstick-walk    exit=1     side-walk       exit=1
integration-doors exit=1   jitter          exit=1
```

**None exits 0**, so there is no sleeping guard of that kind on the *unreachable
world* path. **But all 8 use exit 1 for "cannot measure"** — the same three-status
confusion w35 found across 12 of the 15 fast-tier checks. A builder who forgot to
start a preview is indistinguishable from a broken world in **20 of 23 checks
across both tiers.** That is now a whole-suite finding, not a fast-tier one.

## NOT DONE — 6 of 8 still have no failing path

`w21-roof-climb`, `I-seat-exit`, `unstick-walk`, `corner-traffic`, `crowd-net`,
`side-walk`. I ran out of budget, not ideas, and I would rather hand these back
than register cases I have not watched go red.

**Start here — this is what the next builder needs and it is most of the work:**

1. **`w21-roof-climb` has a known failing path already measured by w33 and
   nobody has registered it.** `notes/archive/w33-roof-hop-frames.md`: raising
   `PICKUP_CAB.roofY` (`src/proto/ct/cars.ts:148`) by **100 nanometres** took the
   hop from 4/4 to 0/4. That is a ready-made canfail case — `CARS` is already a
   constant in `canfail.mjs`. It is the cheapest of the six by a distance, and
   it is the one guarding the feature the user can see. **Budget ~12 min: the
   check itself takes ~10.**
2. Read w35's trap first (`notes/archive/w35-fast-tier-failpaths.md`): **mutate
   what the script ASSERTS on, not what it prints.** Several of these separate
   the two deliberately, and a check that does not move under the wrong mutation
   is not a sleeping check.
3. Runtimes are recorded in `checks.mjs:663` — `jitter` 73 s, `side-walk` 77 s,
   `crowd-net` 93 s, `corner-traffic` 141 s and up to ~7 min with retries. Budget
   one canfail case at a time; `guards.sh <case>` takes a single case name and
   that is how I kept every run synchronous.

## Also found, not fixed

- **`npm run build` really does wipe `dist/artifact.html`, and I watched it
  happen.** `guards.sh` builds per run, and after the two canfail runs
  `dist/artifact.html` was **gone**. I restored it from the `street/artifact/`
  staging copy I made during item 74 and verified md5
  `2417409ea434888b8b707d6405abad0b` on both. GOTCHAS 63 is correct and the
  staging copy is not optional — **anyone running `guards.sh` destroys the
  packed artifact.** Worth a line in GOTCHAS 63 naming `guards.sh` and
  `canfail.mjs` specifically, since neither looks like "a build".
- The **20-of-23 exit-1-on-dead-port** issue above deserves its own item; it is
  cheap and mechanical, and it spans both tiers.
