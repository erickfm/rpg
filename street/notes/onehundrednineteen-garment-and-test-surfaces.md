# Item 249 — the second garment rests on the pan, and the eleven test surfaces

Worker onehundrednineteen, 2026-08-03. Port **4750**, built bundle
(`npx vite preview --port 4750 --strictPort`), never dev.

Files changed: `src/proto/ct/apartment.ts`, `src/proto/ct/hud.ts`,
`src/proto/crosstown.ts` (**comment only**), `notes/BUILDER-BRIEF.md`.
**The row's file column names no file** — see the note on that at the end.

---

## (1) The garment was embedded 0.030 m. The row is right, to the millimetre.

Measured on the built world before touching anything
(`scripts/probes/w119-249-garment-vs-pan.mjs`, which finds the three boxes by
their own `BoxGeometry` parameters — the pan is the only 0.42 × 0.04 × 0.40 in
the room, so nothing is retyped):

```
pan       y 5.827 .. 5.867
back      y 5.867 .. 6.327
shirt     y 6.197 .. 6.417     ← item 146's fix: it straddles the BACK. Correct.
garment2  y 5.837 .. 5.977     ← bottom 0.030 m BELOW the pan's top
```

**Root cause in one line: its `y` was a hand-typed `RY + 0.50` — a second copy of
a number the seat pan already owned — so it recorded the pan's height at the
moment somebody typed it and not afterwards.** Three centimetres of a 14 cm
bundle were buried in a 4 cm pan: **three quarters of the pan's entire
thickness.**

**And the frame is worse than the number**, which is why the row insists on
looking. From eye level the pan disappears behind the garment entirely and what
is left reads as a loose brown flap hanging off the front of the chair — the
same "separate rail" mistake the user photographed in item 146, wearing
different clothes. Shots, three angles, before and after, all on the built
bundle:

- `shots/w119-249-chair-{before,after}-eye.png`
- `shots/w119-249-chair-{before,after}-low.png`
- `shots/w119-249-chair-{before,after}-quarter.png` — **this is the one that
  answers it.** Head-on, "resting on" and "sunk into" look nearly identical
  because the garment covers the pan; from the front quarter and high, the pan's
  own top face shows beside the garment and the join can be read.

The before shots are the real pre-change build, not a memory: `apartment.ts` was
checked out at `HEAD~1`, rebuilt, and re-shot through the same probe at the same
three camera stations.

**The fix.** The pan's height is now named once — `PAN_Y`, `PAN_T`, `PAN_TOP` —
and the garment's centre is `PAN_TOP + GARMENT_H / 2`. **Derived, not
renumbered**: a hand-typed `RY + 0.53` would be the same second copy that caused
this, and the next person to move the seat would leave the garment behind again.

```
after:  garment2  y 5.867 .. 6.007      gap = 0 m  (resting)
```

**x, z, size and yaw are all unchanged, deliberately.** Only the height was
wrong, and this chair has **0.01 m** of margin against the dresser collider plus
a 166° door arc to clear (the block above it in the file says so). Nudging it in
plan to "drape" it over the front lip would spend clearance the chair does not
have — and a solid box overhanging an edge is the FLOATING fault, which is the
one the user has already reported twice. Neither floats nor embeds, which is
what the row asks for.

## (2) `__hud` vs `__ct` — and the row undercounts it

The row: *"`window.__hud` VERSUS `window.__ct` IS UNDOCUMENTED and cost ninety
three probe detours."*

**Enumerated from the running world rather than from the source**
(`scripts/probes/w119-249-test-surfaces.mjs` — the source has several publish
sites and a doc built by grepping one of them would be wrong the first time
anybody added to another):

> **11 test surfaces, 162 members.** `__ct` (54), `__atm` (17), `__rent` (17),
> `__frontages` (16), `__librarypc` (16), `__inv` (11), `__slots` (11),
> `__blackjack` (9), `__hud` (8), `__lab` (3), `__THREE__`.

So documenting only the two the row names would have left **nine** undocumented,
with exactly the same failure mode. Written in three places, because the item
asks for both:

- **`notes/BUILDER-BRIEF.md` §4a** — the authoritative map: what each surface
  OWNS, the rule that follows (*world → `__ct`; a panel being up → `__hud`; one
  machine → that machine's own*), the fact that **`__ct` is not a superset**, and
  the command to re-enumerate it. It describes OWNERSHIP rather than listing 162
  members, because ownership is stable and member lists rot.
- **`ct/hud.ts`**, above `__hud`'s publish site.
- **`crosstown.ts`**, above `__ct`'s publish site. **Comment only — no member of
  that object is changed.**

## Verification

| | |
|---|---|
| `npm run typecheck` | **0** |
| `npm run build` | **0** |
| `node scripts/health.mjs` | **0**, `WORLD OK` |
| `npm run sweep` | **0**, `0 STATION MISS, 0 COVERAGE` |
| `scripts/A-eye-height-holds.mjs` | **0**, `MEASURED FINE` (the spawn room is 301, so this is the one that covers it) |
| `scripts/floaters-walk.mjs` | **1**, and **62 props under 1.4 m — the identical figure the clean suite reported before this change.** No floater added. |

`floaters-walk`'s exit 1 is pre-existing and its scope line says why it could
never have caught this one anyway: *"scope: every interior (x >= 400)"*, and the
apartment is at x ≈ 199. **Nothing in the suite looks at prop-versus-furniture
inside 301** — see below.

`box()` in `apartment.ts` adds a mesh and nothing else, so no collider moved and
nothing about movement or floors changed by this edit.

## FOUND AND NOT FIXED

1. **This is the THIRD garment-versus-furniture defect and there is still no
   check for it.** 146 (floating shirt), 249 (embedded garment), and the row
   itself says the user has reported two of the three. `floaters-walk` only
   looks at `x >= 400`, so no instrument covers apartment 301 at all. A guard
   that asserts *every prop resting on a surface has its underside within a few
   mm of that surface's top, in a RANGE so neither sign passes* would have caught
   both and would catch the next. Worth a row; not this one's scope, and it wants
   thinking about which props are "resting" and which hang by design.
2. **The queue row's `file(s)` column names no file.** `claim.sh --check-paths`
   resolves nothing out of it, so the claim printed no file list at all and I had
   to find `ct/apartment.ts` by grep. Measured while doing item 244: **10 of the
   14 open rows are like this.** Fix belongs upstream in `add.sh`.
3. **`crosstown.ts` was edited (comment only) and is not named by the row.**
   Reported per §9. No live row named it — checked with the queue-based
   `ownership.sh` from item 244, which is what it is for.
4. **`__lab` is published from outside `src/proto/`** — it does not grep there.
   Named in the map from the runtime enumeration, but I have not traced its home.

## Values: derived or copied

- the garment's `y` — **derived** from `PAN_TOP`, in the same block.
- the seat pan's own height — **named once** (`PAN_Y`/`PAN_T`), was four literals.
- 5.827/5.867/5.837/5.977/0.030 — **measured** on the built world, twice
  (before and after), never predicted.
- the camera yaw convention in the shot probe — **measured**
  (`scripts/probes/w119-249-aim.mjs`: `dir = (sin yaw, −cos yaw)`, so facing a
  delta is `atan2(dx, −dz)`). The first cut used `atan2(dx, dz)` and
  photographed the opposite wall; reading `__ct.camera()` in the same tick as the
  warp reports the SPAWN, because the rig is copied onto the camera in the render
  loop and `evaluate` gets no frames.
- 11 surfaces / 162 members — **enumerated at runtime**, with the command to
  re-run it printed beside the number.
