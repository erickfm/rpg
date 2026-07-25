# Every open finding, graded by whether a player can see it

3,400 lines of audit across five reports, and until Round 8 of `seam-audit.md`
I had **never once** graded a finding by whether it is visible. I found that out
by nearly routing a builder to fix twelve mirrored faces that turn out to be
symmetric triangles — technically flipped, visually identical.

> **Establishing that a defect is real is not the same as establishing that it
> matters.**

So this is the pass I owed. Everything I still hold open, ranked by player
impact rather than by how cleanly I could measure it. The desk should route from
this file, not from the severity tables in the individual reports — those rank
by measurement confidence, which is a different thing.

## Route these

| # | finding | can a player see it? | where | evidence |
|---|---|---|---|---|
| 1 | **sign/meter post leaves 0.90 m** of walk at z −71.4, west | **Yes — it is felt, not seen.** 0.90 m against a 0.72 m capsule is the tightest squeeze in the world | `ct/props.ts` | `lane-audit.md` R4 |
| 2 | **thrift price card floats 0.325 m** above its shelf | **Yes**, standing at the shelf. It is a 0.44 m card hanging in air in a room you walk into | `ct/int-thrift.ts` | `float-audit.md` R3 |
| 3 | **four of eight rooms have no keeper** | **Yes** — half the shops you enter are staffed and half are empty, and the difference is obvious once you have seen both | G's four rooms | `interior-audit.md` R16 |
| 4 | **casino ceiling is 2.50 m**, lowest in the world, while the kit's own docstring names a casino as wanting *more* than 2.9 | **Probably** — 0.90 m against the hotel, and headroom is felt on entry | `ct/int-casino.ts` or the docstring | `interior-audit.md` R18 |

## Record, do not route

| finding | why not | where |
|---|---|---|
| **12 mirrored pennant faces** | The art is a symmetric triangle. Genuinely flipped, provably invisible. **Latent** — matters the day lettering goes through that path | `seam-audit.md` R8 |
| **library ashlar at 9.41 px/m** | Real and off the world's 8/16 grid, but it is a 17% difference on stone, and I cannot show it is visible. Fold into pattern #1 when that is routable again | `seam-audit.md` R7b |
| **BODEGA has no published frontage** | Tooling only. Costs a future auditor an hour, costs a player nothing | `request-audit.md` |
| **rooftop bulkhead at 13.5 px/m** | Does not read as masonry beside a parapet that does. Probably out of scope for the rule | `seam-audit.md` R7c |

## Blocked

**The bench ad** — a failed *search*, not a failed shot. No ad-panel geometry
exists anywhere in the world by shape. Now located as *the stop in front of
LIQUOR*. Needs its owner to say whether it was ever built.
See `BLOCKED-AUDIT-seams.md`.

## Instruments, and what they can still answer

| tool | state |
|---|---|
| `doorsweep.mjs`, `lane3.mjs`, `handed.mjs`, `turn.mjs`, `reach.mjs` | **Sound.** Each verified against a second source or against the code |
| `floats.mjs` | **Sound with a threshold.** 158 bulbs on standoffs are separable from 1 real float by gap size — 0.325 m against a 0.128 m maximum |
| `density.mjs` | **Cannot answer pattern #1.** Its filter is geometric, so foliage, ground decals and signage now sit in a net meant for masonry. Needs modules to declare what a face is — the `userData.mod` pattern already proven by `lot` and `walkup` |

## What I got wrong, kept in one place

Four wrong or unusable results this session, all the same root cause — **a
number that was true when I wrote it down and stale when I used it**:

- the **church** graded NOT DONE from 12,260 points walked on an empty block; it
  had moved to the main frontage
- the **park** graded a dark yard from a census of its near seventh, while 25 m
  of it were unreachable
- the **door alignment** first reported two doors "OFF THE DOOR" when both
  "doors" were **citizens** standing in the street
- the **lot** found by "reachable ground near things shaped like cars", which
  found the side street

Every one was caught before it reached a builder, and every one was caught the
same way: by checking the instrument against a second source rather than by
looking harder at the first.
