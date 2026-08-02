# w20 — QUEUE item 28: outdoor benches and seated people

**Root cause, one line:** nothing could check either population — outdoor seats
because `seat-facing.mjs`'s rules are gated on being inside a registered room,
and seated people because `citizenSprite` kept its heading in a closure and
published nothing at all.

Port **4190** (my assigned 4199 was held). Build `73816f4b7`.

## The item's premise was right; w17's proposed fix turned out unnecessary

w17 concluded that outdoor benches *"cannot be covered by rule B as written"*
and that guarding them *"needs the seat to declare what it is meant to look at
— a change to `ctx.seat`"*. **That change was not needed, and I did not make
one.** Rule B fails outdoors because it asks *"is something substantial behind
me?"*, and outdoors the answer is always yes — a bench backs onto a shop front.
But the survey says the comparison is still decidable:

| outdoor seat | nearest ahead | nearest behind |
|---|---|---|
| park benches ×8 | nothing within 8 m | 3.4–4.7 m |
| bus stop ×2 | nothing | 1.57 m |
| car lot chairs ×2 | 5.95 m / nothing | 0.57–0.93 m |
| tyre stack | nothing | 1.71 m |
| shop benches ×2 | 4.01 m | 0.33 m |

**Every outdoor seat in the world has its nearest solid behind it and open
ground in front.** Turn one round and the two numbers swap. So the rule is the
same *shape* as rule B — a comparison, not a distance — just with the inequality
pointed the other way. That is the whole fix, and it needs no new API.

## What I changed

| file | |
|---|---|
| `src/proto/ct/citizens.ts` | publishes `mesh.userData.citizenFacing` (and keeps it in step in `setFacing`) |
| `scripts/bench-sitter-facing.mjs` | NEW. Rules C and D. |
| `scripts/probes/outdoor-survey.mjs` | NEW. The survey the rules were chosen from. |

**`ct/park.ts` is named by the item and I changed nothing in it** — the benches
are already correct (`yaw: Math.PI - yaw`, with a comment recording the exact
bug this check now guards). I used it only as a mutation target.

### The published key: neither obvious name was free

This is the part worth reading. My first draft wrote
`mesh.userData.citizen = { facing, seated }`, and it would have broken two
working instruments:

- **`userData.citizen` is already a boolean** (`= true`), stamped by
  `ct/interior.ts`, `ct/int-casino.ts` and `ct/int-library.ts` to mark a mesh as
  a person, and read by `scripts/J-library-people.mjs:66,83` and a traversal in
  `ct/int-thrift.ts`. Writing an object silently changes that contract.
- **`userData.facing` is already taken by building shells** — `ct/street.ts` and
  `ct/bank.ts` set it to the string `'x'` or `'z'`, and `scripts/shells.mjs:124`
  traverses **every mesh** looking for it. A number there makes that instrument
  parse citizens as buildings.

I found this because the probe crashed on `undefined.toFixed` — the room tags
were overwriting my object. The key is now `citizenFacing`, and I re-ran
`J-library-people.mjs`, `interior-people-close.mjs` and `shells.mjs`: all three
still pass.

It is set **inside `citizenSprite`** rather than by the caller, because the
existing room tags are opt-in and have been forgotten before — `int-casino.ts`'s
own comment records five figures going invisible to every people-sweep that way.

## The two rules

**Rule C (outdoor seats):** backwards if the nearest solid **ahead** is closer
than the nearest solid **behind**. All colliders count — outdoors the wall
behind you *is* the reference.

**Rule D (seated citizens):** backwards if substantial furniture is within
`REACH` **behind** and nothing nearer in front. **The inequality is deliberately
the opposite of rule C**: a bench sitter looks out at open ground, a person
seated at a table or a machine is placed to use it.

Rule D must be read in the **citizen** convention (`0 = +z`), not the seat one
(`0 = −z`) — the new GOTCHAS 62. Read the casino sitters in the seat convention
and they appear to stare 1.55 m into open floor; in their own convention they
are 0.39 m from the machine they are playing. Same world, opposite verdicts.

### Two false-positive families I found in my OWN rule first

Rule D's first draft failed 5 of 14 sitters. **All five were the rule, not the
world** — and both fixes were numbers `seat-facing.mjs` had already calibrated
and I had failed to reuse:

1. A **0.16 m church pew back**, a **0.18 m diner partition** and two **0.18 m
   jail walls** counted as "furniture you are turned away from". Fixed with that
   file's `DEEP = 0.80`, the documented line between a table and a backrest.
2. A bank customer with a counter **4.79 m** behind him. Four metres away is not
   your furniture. Fixed with that file's `REACH = 0.80`.

Both are **copied with citations**, not re-derived — `seat-facing.mjs:68-69`
does not export them and is not a file this item names. Follow-up below.

## How it is proven

Green on the live world, exit 0:

```
RULE C  17 outdoor seats — 15 look out · 0 backwards · 2 UNDECIDABLE
RULE D  14 seated citizens — 7 face something · 0 backwards · 7 UNDECIDABLE
```

**Mutation-tested on the WORLD, not on the check** — which is what the item's
DONE WHEN asks for ("goes red when one is deliberately turned around"):

| mutation | result |
|---|---|
| `park.ts:977` `yaw: Math.PI - yaw` → `-yaw` (every bench turned round) | rule C reports **6 backwards**, exit 1 |
| `citizens.ts:544` `facing` → `facing + Math.PI` (every person turned round) | rule D reports **7 backwards**, exit 1 |

Both reverted; `git diff` on `park.ts` is empty.

**Undecidable cases are printed, never scored as passes.** 2 park benches have
open ground both ways and 7 sitters have nothing substantial within reach; the
check names each one. A guard that silently scores unjudgeable cases green is
the family GOTCHAS 58 is about, and this is the honest half of the coverage.

Also: `npx tsc --noEmit` exits 0, `seat-facing.mjs` still 219/219 green, and
`node scripts/bugsweep.mjs` runs 93 shots with **zero STATION MISS** and no new
console errors.

## Found and NOT fixed — needs queueing

1. **The apartment is not a registered room, so its seats read as "outdoor".**
   *"sit on the bed and watch TV"* at (198.44, −15.58) is plainly indoors but
   `__ct.roomDims()` does not cover the apartment, so it falls to rule C. It
   passes, but by luck of layout rather than by the right rule — and the same
   hole means **`seat-facing.mjs`'s rules A and B have never applied to any
   apartment seat either.** That is a whole interior with no facing guard.
2. **The 2 undecidable park benches** at (−12.08, −78.8) and (−21.48, −84.2)
   sit in open ground with nothing within 8 m either way. Geometry cannot judge
   them; only a declared look-at target on `ctx.seat` can. This is the residue
   of w17's proposal, and it is 2 seats rather than all of them.
3. **Hoist `DEEP` and `REACH` out of `seat-facing.mjs`.** Three files now carry
   0.80 m — `seat-facing.mjs`, this check, and my item-22 comparison probe. A
   `scripts/lib/seatgeom.mjs` exporting the constants and the march would delete
   all three copies. This is the second item running where I have had to copy
   rather than import.
4. **Neither `seat-facing.mjs` nor `bench-sitter-facing.mjs` is registered in
   `checks.mjs`.** Item 21 covers the first; this one will need the same line,
   or the sixth facing bug ships exactly like the first five.
5. **Seated citizens are found by scene traversal, not a registry.** `__ct` has
   `seats()` but no `people()`. A registry would make rule D cheap and would
   stop depending on every room remembering to tag.
