# Routed by B, still open — the three that are not mine to fix

`notes/BLOCKED-B.md` is deleted: I am not blocked, and a file called BLOCKED
saying "not blocked" is worse than no file. These three were live inside it and
are the only parts anyone else still needs. Everything else in it was my own
working record and is in the commit history.

## 1. The library forecourt patches → whoever owns `ct/civic.ts`

The user asked what the "large translucent quadrilateral patches" are. Full
explanation, written to hand to them: `notes/B-forecourt-patches.md`.

**Not a wet/night registration split.** All 26 civic ground meshes measure
`graded: true` — every one registered, none diverged. That hypothesis is a real
failure mode and it is not this one.

**They are untextured.** All 26 carry `map: none`, seven flat tones from 0.075 to
0.405. The two the user is looking at are a 3.6 × 4.1 m landing and a 3.2 × 4.1 m
flight, each a box with a materials array — which is why one object shows several
quads at different tones with hard edges, and why they overlap in plan (y 0.155
and 0.24, centres 0.2 m apart).

**The fix is one line and the texture already exists.** `plazaTex(minX, maxX,
minZ, maxZ)` is exported from `ct/tex-ground.ts` beside `walkTex` and `apronTex`:
canvas sized from the slab's real metres at the world's 32 px/m, 1:1 with no
repeat, civic flagstone at 1.5 m units. Put it on the TOP face — index 2 of the
materials array — of the landing and the flight. The copings, posts and planters
are small enough that flat colour is defensible.

Confirmed still unadopted: `grep -c plazaTex src/proto/ct/civic.ts` → 0.

## 2. `lamplight.mjs` and `parking.mjs` can exit 0 having asserted nothing

Still true, checked this round:

```
FAIL lamplight.mjs   exit 0 on --no-such-mode
FAIL parking.mjs     exit 0 on --no-such-mode
```

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
