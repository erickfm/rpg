# Item 65 — the V overlay stops calling pedestrians traps

**Root cause, one line: `ct/crowd.ts:168` (`ctx.solid`) puts every citizen's box
into the same `colliders` array the overlay scores, and traffic does the same for
vehicles — so `trapAgainst` was measuring corridors against things that walk
away.**

Changed `ct/debug-collision.ts` and `crosstown.ts`. **`ct/gap.ts` was NOT
touched** — see the boundary note below. Ports **4193** (dev) and **4191**
(preview), both proved free with `curl` before use and both shut down after.

---

## Why it painted the whole east walk red

The citizen lane is `x = 6.00` (`ct/crowd-net.ts:87`, `EAST_X = ROAD_HALF + IN`)
and a citizen spans `lane ± 0.25` (`crowd.ts:167`), so its `maxX` is 6.25. The
block faces it walks past are at 6.70 (the bodega, `bodega-corner.ts:220`) and
6.88 — **0.45 m and 0.63 m**, both well under the 0.95 m that reads red. So every
walker painted a standing red slot for as long as it stood there.

This is not theoretical: it **cost a queue item**. A previous builder's red-dump
read one of those moving boxes out of `colliders()` and wrote it down as a static
prop at `x 5.75…6.25`, the desk queued it as item 57, and I spent that claim
proving there is no prop there (`notes/w30-east-walk-trap.md`).

## The fix

Actors are still **drawn** — they really do stop the player, and an overlay that
hid some of what blocks you would be lying in the other direction — but in
**amber** (`0xffb020`), and they are **never scored**: neither a trap candidate
nor a wall that can form a corridor.

**Filtered by object IDENTITY, not by shape.** `crosstown.ts` keeps a
`Set<AABB>` filled at the only two places an actor box can enter `colliders`:
the crowd's `solid` hook and traffic's `vehicleBox` hook. A size test would have
worked on today's world and quietly excused every real 0.5 × 0.5 crate with it.

A separate `__ct.actorColliders()` accessor was added rather than a flag on
`colliders()`, **deliberately**: `colliders()` returns the live array by
reference and `scripts/interiors-walk.mjs --selftest` walls every door shut by
pushing onto it. Returning a mapped copy would have left that selftest mutating a
throwaway array and passing having tested nothing.

## Measured — both rules scored in the SAME sample

Scoring one live world two ways in one pass, so the comparison cannot be two
different worlds (the trap w24 named when it said the world-wide red count *"is
not a number"* — two runs of one build gave 171 and 166):

| | |
|---|---|
| OLD rule red | **169…173** — varies frame to frame, because actors move |
| NEW rule red | **160…160** — stable |
| of the old red, actors themselves | 5…6 |
| static boxes red ONLY because an actor stood beside them | 4…7 |

So the old rule invented **9–13 phantom reds per frame** and made the count
non-deterministic. The new figure of 160 is **exactly** the static red count w24
arrived at by filtering the movers out by hand — the overlay now reports on its
own what previously took a builder and a custom probe.

## Verified on the BUILT BUNDLE, by reading the rendered colour

`scripts/probes/w30-overlay-built.mjs` presses V and reads each wireframe's
actual material, rather than re-deriving the rule — a re-implementation can agree
with itself while the overlay draws something else.

```
346 green + 160 red + 12 amber = 518 colliders, +1 player box = 519 wireframes
```

- all **12** actors amber, **none** red;
- red still **160**, so nothing was silenced;
- **V turns the overlay fully off again** (519 → 0);
- 0 console errors; `bugsweep` 96 shots, **0 STATION MISS**; `tsc --noEmit` clean.

**Mutation, which is the one that matters here:** a genuine static trap planted
beside the walking lane — the exact geometry item 57 claimed and did not have —
is **still caught, gap 0.450 m**. A fix that silenced the false red by silencing
all red would be worse than the bug.

## Fingerprint: the world did not move

`fp before` (pre-change build) vs `fp after`, both on the built bundle:

```
textures  44c087f0 == 44c087f0      IDENTICAL
structure b9c8813c == b9c8813c      IDENTICAL
objects   8315     == 8315
places    8315 vs 8315 — 6 differ, every one within 5 cm of its partner
```

The six drifting meshes are at `x 6.00` (z −12.2, −44.1, −76.1) and `x −5.69 /
−6.00 / −6.64` — **the six citizens**, on the very lanes this item is about.
Textures and structure identical is the standard's requirement; `tints` differs
on the chase-light frame, which `fpdiff` itself labels *"not a verdict"*.

## Found and NOT fixed — for the desk

1. **`npm run fpdiff` is broken and CLAUDE.md documents it as the way to prove a
   change.** `package.json:15` runs `node scripts/fpdiff.mjs` with **no
   arguments**, but the script's own usage line is
   `fpdiff.mjs shots/<a>.json shots/<b>.json` and it dereferences
   `A._structure` immediately — so the documented recipe *"`npm run fp before` →
   change → `npm run fp after` → `npm run fpdiff`"* crashes with a `TypeError`
   every time. It works as `node scripts/fpdiff.mjs shots/before.json
   shots/after.json`. One-line fix in `package.json`, which is not a file this
   item names.
2. **`ct/gap.ts` was deliberately left alone.** Item 65 names it, but **w27 holds
   item 59 against the same file** — BUILDER-BRIEF §9 says skip on a file
   collision, and two agents in one file is what corrupted a worktree and broke
   the live world. The overlay is fixed at its call site instead, which is where
   the user-visible defect was. **`trapAgainst` itself still has no notion of a
   moving actor**, so any OTHER caller that hands it an array containing actors
   has the same bug — worth one line in `gap.ts` once w27 is done, or at least a
   doc comment saying the array must be static.
3. **`nudgeClear`'s parked-car decisions were not audited** against this. They
   call `trapAgainst` too (`crosstown.ts:662`, `others = colliders.filter(...)`);
   whether that array can contain actors at the time it runs depends on build
   order and I did not measure it. If it can, parking decisions have been made
   against pedestrians.
4. **Instrument caveat, stated because it nearly misled me.** The dev-side probes
   match actors *by value* (`minX maxX minZ maxZ rot`) because object identity
   does not survive the browser boundary, and the idle vehicle pool is all parked
   at `x = 999`, so their keys collapse — one probe reported "27 actor
   colliders" where there are **12**. The shipped code uses identity and has no
   such ambiguity; the built-bundle probe reads rendered materials and agrees at
   12. Do not quote the 27.
5. **`w30-overlay-built.mjs` needed a `page.mouse.click` before the first V.**
   Without focus the first keypress is swallowed and the second turns the overlay
   *on*, which reads as "V drew nothing" followed by "V left 519 wireframes
   behind" — the probe reporting a broken overlay that works perfectly. Cost one
   run; worth copying into any probe that sends keys.
