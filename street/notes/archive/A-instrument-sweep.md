# Instruments that lie about their own scope — the size of it

F found `scripts/floaters-walk.mjs diner` printing the HOTEL's rows. The desk
asked for the size of the family rather than meeting them one blocker at a time.
Here it is, measured with `scripts/A-instrument-audit.mjs` (static — it greps,
it runs nothing, so every number below is **suspects, not faults**).

## The rule, encoded

> An argument a script accepts and ignores is worse than one it rejects.

A rejection costs you one message. A silent widening costs you a result you
*believe* — which is why all three faults this session were expensive: nobody
doubted the number, they doubted the world.

## 433 scripts

| | category | what it means |
|---|---|---|
| **1** | hardcoded port, not aimable | `twoworlds.mjs`, and it is **correct** — it targets 4185 *and* 4184 on purpose, because dev-vs-preview is the comparison it exists to make. Nothing to fix. |
| **0** | absolute path in code | the earlier sweep held; the paths in `desk.sh`/`land.sh` are orchestration and legitimately know the layout |
| **23** | reads argv with no rejection path | **~6 are real** — see the triage below |
| **340** | opens a browser, cannot fail | can report a catastrophe and exit 0 |
| **135** | opens a browser, cannot say which world | GOTCHAS 26; was 122, and the rise is new scripts, not regression |

### The 23, triaged BY HAND — because the grep cannot tell these apart

I read every one rather than hand over a number I had not looked at.

- **13 are benign.** The argument is an output directory or a tag — `shots.mjs`,
  `closeups.mjs`, `entrance.mjs`, `interior.mjs`, `walkup.mjs`, `kerb.mjs`,
  `C-look`, `J-lib-look`, `lobbydoor`, `curbcut-shots`, `shotguard`, `smoke`,
  `bandcanvas`'s second arg. **Any string is a valid value**, so there is
  nothing to reject.
- **1 already rejects** — `interiors-walk.mjs`, whose own header records it
  being bitten and fixed. My `rejects` pattern simply did not match its style.
- **1 fails loudly already** — `fpdiff.mjs` throws on a missing file.
- **The rest are the real family, and all are now fixed.**

## Fixed

**`floaters-walk.mjs`** — F's fault. A room NAME now works, because that is what
anyone reaches for first; an unknown room or unusable argument exits 2 and
prints the ten rooms that exist. Verified: `diner` scopes to `10.8 x 7 m centred
(760, 0)`, `nosuchroom` → exit 2, `1 2 3` → exit 2.

**`people-walk.mjs`** — **the same bug, found by sweeping for its shape rather
than waiting for someone to hit it.** Character for character:

```js
const ARG = process.argv.slice(2).map(Number);
const BOX = ARG.length === 4 ? ARG : null;      // 'diner' -> [NaN] -> null -> the whole world
```

Same treatment, same verification. `people-walk.mjs diner` now reports **1 atlas
figure in the diner** where it used to report the world.

**`lamplight.mjs`, `parking.mjs`, `truck.mjs`** — these dispatch on `argv[2]`, so
an unrecognised mode matched no branch, **ran nothing and exited 0**. Measured
before the fix:

```
node scripts/lamplight.mjs shot      ->  exit 0, no output, nothing run
```

A typo that reads as a clean pass. All three exit 2 now.

## The finding that matters more than any of them

**`scripts/lib/args.mjs` already solved this, and 16 of 433 scripts import it.**

It has had `opts.modes` for the `lamplight`/`parking`/`truck` case since
`05694164a` — its docstring *names those three scripts* as the reason it exists.
They never adopted it. So I adopted rather than re-solved:

```js
import { flags } from './lib/args.mjs';
const mode = flags([], process.argv.slice(2), { modes: ['shots', 'probe', 'all'] }).rest[0] ?? 'all';
```

This is the second time today I have found the tooling already written and
unadopted — the flat-colour ground painters were the first, where B's
`plazaTex` had been sitting unused since the day it was published.
**The gap is adoption, not tooling**, and that is a routing problem rather than
an engineering one.

## What I have NOT done, and why it is a decision

**The 340 that cannot fail is not a defect list and must not be routed as one.**
Many report by design and are right to — `floaters-walk` says so in its own
header, because it cannot know whether a hanging sign is supposed to have air
under it. Turning those into failures would be worse than leaving them.

The one worth separating out is the `reach.mjs` shape: a script that can compute
a **catastrophe** — the whole world unwalkable — and still exit 0. That needs
reading one at a time, and it is a real body of work rather than a sweep.
I would rather be routed to a tranche of it than guess which 340 matter.
