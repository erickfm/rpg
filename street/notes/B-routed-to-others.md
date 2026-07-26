# The weed tufts glow at night — measured, mechanism NOT identified

For C (`ct/weeds.ts` owns the tuft) and for E and C as the other two placers.
I placed the street's five, so this is partly mine to report and not mine alone
to fix.

**What I measured**, standing outdoors, stepping 20:00 -> 23:00 so the night
state arms properly:

```
walk (tex-ground, ground level)   night tint 0.045
street kerb tuft                  night tint 0.528
park tuft (-31.9, -86.3)          night tint 0.77   (colour cac3b3)
```

**What I looked at**: at the east catch basin at 23:00 the tuft reads as bright
green against a dark street. It is the most luminous thing in frame that is not
a lamp. The lot's tufts along the fence do the same.

**What the material says about itself**: `userData` is `{ graded: true }` and
nothing else — not `wet`, not `selfLit`, not `poolLit`. So it is in `litList`,
it is not in the wet registry, my `isSelfLit` heuristic is NOT misfiring on it,
and no lamp pool is holding it at full daylight. It is `alphaTest: 0.4`, not
transparent, normal blending — exactly as `weeds.ts` intends, and specifically
NOT on `dimWorld`'s transparent skip list. There are 341 distinct tuft materials,
so the one-per-tone cache is not collapsing them either.

**What I could not establish.** Why a ground-level material in `litList` settles
at 0.53 when the walk beside it settles at 0.045. `floorFor(y)` returns
`FLOOR_GROUND` for anything under 1.0 m and a tuft is 0.35 m tall, so on the face
of it they should match. I checked the obvious suspects above and none of them
is it. I am not going to guess at the mechanism — I have published three
confident wrong answers today and each one cost a round.

**What it is worth to whoever picks it up**: the fault is real and visible, it
affects all three placements (street, lot, park), and the four cheapest
hypotheses are already eliminated. Start from why the floor differs.

---

# Routed by B, still open — the three that are not mine to fix

`notes/BLOCKED-B.md` is deleted: I am not blocked, and a file called BLOCKED
saying "not blocked" is worse than no file. These three were live inside it and
are the only parts anyone else still needs. Everything else in it was my own
working record and is in the commit history.

## 1. The library forecourt patches → CLOSED, fixed by `ct/civic.ts`'s owner

Resolved in `b0b69cb48` ("The park quality pass: the field, the bench, the
shrubs, the forecourt"). Not with `plazaTex` — with their own texture, which is
the right call: it is their surface and their palette.

Measured before and after:

```
before   0 textured, 26 flat, 7 tones, two big flat slabs (3.6x4.1, 3.2x4.1)
after   16 textured, 12 flat, 4 tones, NO flat slab over 3 m2
```

The landing and the flight — the two the user was actually looking at — now carry
a 48 px map. Looked at it from the courtyard mouth: flagstone with legible joints
and tone variation, steps reading as steps, no flat translucent patches. **The
user's complaint is fixed.**

**One measurement handed over, not a complaint.** Those slabs work out at
12.4–13.8 px/m against the 32 px/m every other surface here derives from its real
metres, and `repeat.y` differs across faces of the same box — 0.13, 0.93 and 2.73
— so the joints do not line up face to face. On screen it reads fine, because the
flags are large enough that the joints stay legible, which is why this is a note
rather than a routed fix. If it ever wants tightening, `plazaTex(minX, maxX,
minZ, maxZ)` is still exported and sizes its canvas from real metres at 32 px/m
automatically.

## 2. `lamplight.mjs` and `parking.mjs` can exit 0 having asserted nothing

Still true, checked this round:

```
FAIL lamplight.mjs   exit 0 on --no-such-mode
FAIL parking.mjs     exit 0 on --no-such-mode
```

Still exactly these two, re-checked this round. `laneaudit.mjs` briefly appeared
on the list and was a FALSE POSITIVE of mine, not a fault of theirs: its `mode`
is a loop variable — `for (const mode of ['fixtures','all'])` — and it never
reads `process.argv`, so it cannot be handed a mode it does not know. The check
requires an argv-derived mode now and no longer flags it.

Hand either a mode it does not know and it matches no branch, falls off the end
of the file and exits 0 — a green row for a check that ran nothing. `truck.mjs`
was on this list and its owner has fixed it; these two are the remainder.

Two lines each, and the shared guard is already written:

```js
import { modes } from './lib/modes.mjs';
const mode = modes('lamplight', ['shots', 'probe', 'all']);
const mode = modes('parking',   ['dist', 'probe', 'shots', 'all'], 'probe');
```

`parking`'s default is `probe`, not `all`, so it needs the third argument or the
fix silently changes its no-argument behaviour. `scripts/no-silent-pass.mjs`
guards this and is red until both land — deliberately; `land.sh` does not gate on
`checks.mjs`, so it blocks nobody.

## 3. The ledger is materially behind the inbox → `AUDIT`, which owns "verify the ledger"

I found four user requests to B with no ledger row at all, added them, then
checked whether that was a B quirk. Counting inbox routings against ledger rows
per owner:

```
owner    inbox  ledger    gap
  F         18       8     10
  H         10       2      8
  D         12       7      5
  A          6       3      3
```

**An upper bound, not a list.** It compares line counts and one row can
legitimately cover several inbox lines — my own cups are two lines and one row.
So the claim is "materially behind for F, H, D and A", not a count of missing
requests.

Why it matters: an untracked request never appears in `ledger.sh`, which is the
command we are told to run before telling the user anything is finished. All four
of mine were already DONE, which is exactly why nobody noticed — nothing was
failing.

I have not touched anyone else's rows. Adding one asserts what the work is and
what state it is in, and I can only vouch for mine.
