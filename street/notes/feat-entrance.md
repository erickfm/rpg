# feat/entrance — the walk-up's front

Branch `feat/entrance`. Owns `ct/apartment.ts`, `resGroundTex` in
`ct/tex-world.ts`, and the new `scripts/entrance.mjs`. Nothing else touched.

---

## THE HEADLINE FOR THE DESK

**The building has no name.** Not THE WHITMORE, not EL MIRADOR (proposed in
the brief, rejected), not THE SYCAMORE (asked for, built, then removed). The
brass plaque is gone entirely. The gold **227** on the transom is the only
identification the building has, which is how plenty of real walk-ups are.

**→ `crosstown.ts:241` still reads `label: () => 'enter THE WHITMORE'`.**
That file is builder B's this round, so I did not touch it. The brief
expected the desk to swap in a new name at merge; there is no name now, so
that line needs a nameless label instead — `'enter the walk-up'`, or
`'enter No. 227'` to match the transom. **Do not let this ship as WHITMORE**;
it is the only place the dead name survives, and it is the string the player
actually reads at the door.

---

## What changed

### 1. The entrance is a composition now, not a pile of props

The root cause of every reported defect: `resGroundTex` tiled barred windows
at a fixed pitch straight across the middle of the facade, and `apartment.ts`
positioned the door furniture independently. Neither knew the other existed,
so they landed on top of each other.

The fix is a single shared definition — **`ENTRANCE` in `ct/tex-world.ts`**.
The texture and the props both read it. The texture keeps the window rhythm
out of a reserved 4 m span and paints a narrow limestone doorcase in the
middle of it; `apartment.ts` hangs the door, transom, buzzer and stoop inside
that same span. They cannot drift apart because there is one set of numbers.

Layout, either side of the door centreline:

```
0.000 … 0.875   doorway opening   (painted dark by resGroundTex)
0.875 … 1.250   limestone doorcase jamb
1.250 …         brick; buzzer panel centred at 1.55
2.000           edge of the reserved span
3.375           inner edge of the nearest window
```

Everything lands on whole texels. The facade is 8 px/m across and 10 px/m up,
so the opening is exactly 14 × 26 texels and the painted doorway registers
with the door geometry to the texel. That is what stops hairline gaps.

### 2. The three reported defects

| reported | cause | fix |
|---|---|---|
| plaque clipped to "THE WHITMOR" | plaque at x=6.96 sat *behind* the door leaf at x=6.95 and was occluded by it | all door furniture on ONE depth plane, 2 cm proud of the brick; and the plaque is gone anyway |
| plaque overlapping the left window | window pitch ran through the entrance; only 13 cm of brick between them | windows excluded from the reserved span; nearest window is now 3.375 m from the centreline |
| buzzer drawn on the right window | same | same; buzzer sits on clear brick, 1.7 m from the nearest window |

### 3. Two more I found in the review, not reported

- **The door was sunk into the stoop.** Door base sat at the sidewalk (0.14)
  while the stoop top was 0.29, so the step cut the bottom off the door. The
  stoop top *is* the threshold now (0.31) and the door stands on it, with its
  bottom centimetre buried so the two can never part and show a seam.
- **The buzzer detached from the wall at grazing angles** — it was 4 cm proud.
  Now 2 cm, along with everything else.

### 4. The stoop (explicitly in scope per the user)

Was a flat untextured slab: one colour on every face, so it had no form. Now
a proper step — painted tread with a nosing highlight, a worn hollow down the
middle and a threshold shadow; a riser with a lit top arris, grime where it
meets the walk, and a couple of chips; stone end faces. Widened to 1.95 m so
it is wider than the opening, deepened to project 0.40 m, and its base sinks
2 cm into the sidewalk so no seam can open at the pavement.

### 5. The window rhythm itself

Windows are now laid out symmetrically about the door: as many as fit each
panel with at least a pier's worth of brick between them and at each end,
slack spread evenly. Each one is *built into the wall* — stone lintel over,
stone sill under, dark reveal — instead of being a hole punched in brick.
Stone tone matches the sills `facadeTex` uses on the floors above.

Bar pitch went 4 texels → 3. At the narrower 12-texel window a 4-texel pitch
only fits two bars, and two bars read as window mullions, not security. I
caught this in `res-north-end.png` after the first pass.

---

## The one thing that got rebuilt twice

First attempt reserved the span by **painting the whole 4 m bay as a pale
stone panel**. Rejected, correctly — it read as a blank slab pasted onto the
building and dominated the facade. Reserving the span is a *layout* act, not
a *paint* act. The brick now runs straight through the entrance bay and the
only stone is the narrow doorcase hugging the door and transom. There is a
comment on `ENTRANCE.BAY_W` saying so, so nobody re-paints it.

---

## Which shots to look at

`shots/entrance-final/` — 27 angles, from `scripts/entrance.mjs` (new, mine).

Worth your time, in order:

- **`straight-near.png`** — the composition. Nothing overlaps anything.
- **`facade-wide.png`** — the whole 18 m residential facade in context.
- **`transom.png`** — the 227 and the reveal around the door.
- **`stoop-oblique.png`** — the step reading as built stone.
- **`graze-s.png` / `graze-n-low.png`** — eye almost on the wall, looking
  along it. This is the pair that would show z-fighting or a seam if there
  were one. There isn't.
- **`jamb-west-near.png`** — the brick where the plaque used to hang, to
  prove there is no hole, no floating fixing, no gap.

`shots/entrance-before/` is the same 27 angles on the unmodified branch.

Progression, if anyone wants it: `entrance-before` → `entrance-r1` (pale
panel, rejected) → `entrance-r2` (brick + doorcase) → `entrance-r3` (bars,
stone tone) → `entrance-final` (nameplate removed, span retuned to 4 m).

---

## Blast radius — proved, not assumed

`npm run fp` before/after. The raw `fpdiff` shows 68 structure differences,
**and they are noise**: I added three textures (the stoop's tread, riser and
ends), which shifts the seeded `Math.random()` stream, so every texture
created afterwards gets different dither grain and therefore a different
hash. Strip the texture hashes and the real picture is:

```
structure   395 vs 393    6 meshes removed, 4 added   (net -2)
places      395 vs 393    every change at x 6.7-7.0, z -42…-45
```

Removed: old stoop, plaque, old buzzer, old transom, old door, and the
separate dark recess plane. Added: new stoop, transom, buzzer, door. Net −2
is the plaque and the recess plane, both deliberate.

The recess plane is worth calling out: it was a 1.6 × 2.75 dark plane floating
0.02 m in front of the wall pretending to be a doorway. The texture paints the
doorway now, exactly registered, so the plane is redundant — one fewer surface
and one fewer chance to z-fight.

Only other movement: four props drifting 2–7 cm, which is the documented
pigeon noise floor. **Nothing outside the entrance moved.**

If you want to re-run that separation, the helper is 20 lines: strip
`/\d+x\d+:[0-9a-f]+/` from the structure signatures and re-diff as multisets.
Worth folding into `scripts/fpdiff.mjs` as a `--geom` flag — any change that
adds a texture will hit this same wall of false positives.

---

## Verification

- `npm run build` — clean (tsc + vite).
- `npm run sweep` — 48 shots, no page errors. Only the pre-existing
  `THREE.Clock` deprecation, a teardown context-loss, and GL driver perf
  messages; identical to baseline.
- `scripts/verify.mjs` — lobby, stairs, hermit, room 301 all fine.
- **Door tested end to end**, which `verify.mjs` does not do (it warps rather
  than pressing E): stand on the spot → `[E] enter THE WHITMORE` → press E →
  land at 201.2, −18.7 in the lobby. Passes.
- **`resGroundTex` checked at 13 widths** from 8 m to 40 m, plus the
  `bayW = 0` variant. Invariants hold everywhere: no window enters the
  reserved span, nothing runs off the texture edge, the layout is
  mirror-symmetric, and the doorcase always sits inside the bay.

---

## Known issues I did NOT fix (out of my files, or out of scope)

### The lobby exit is broken — pre-existing, and it is builder B's file

`[E] out to the street` from the lobby **does not work**. You press E and stay
put. I verified this on the unmodified baseline before my changes, so I did
not cause it.

Cause: `crosstown.ts` drops you at `FACE - 1.1` = x 5.9, but the *enter* spot
is at `FACE - 0.45` = x 6.55 with radius 1.05. You land 0.65 m away — inside
the re-enter trigger — and a single held E ping-pongs you straight back in.

This is the exact bug the bodega exit comment in `crosstown.ts` says was
already fixed *there* ("well outside the re-enter trigger radius so you can't
get sucked straight back in (the old bug)"). The walk-up never got the same
treatment. One-line fix — move the exit to about `FACE - 2.2`, or shrink the
enter radius — but it is in builder B's file this round.

### Cosmetic, noted not fixed

- **Ground-floor brick courses are 0.50 m; the facade above uses 0.446 m.**
  `resGroundTex` is 32 px over 3.2 m, `facadeTex` is 172 px over 15.4 m. There
  is a slight course-pitch step at the storey line. Pre-existing, affects every
  building on the street, and fixing it means touching shared brick — a
  whole-facade decision, not an entrance one.
- **Ground-floor windows do not align to the upper-floor column grid.** The
  upper columns sit on a 22 px pitch phased from the left edge; mine are
  symmetric about the door instead. I chose symmetry about the entrance
  deliberately — it is what the brief was about — but the two grids are
  visibly independent in `facade-wide.png` if you go looking.
- **Residential buildings under ~11 m get no ground-floor windows at all.**
  A 4 m entrance bay leaves panels too narrow for a 1.5 m window plus piers.
  Degrades gracefully (bare brick, doorcase still correct) rather than
  overlapping, which is the right failure, but it is a real limit.
- **The stoop is not a collider.** You can walk through the step rather than
  onto it. Pre-existing, invisible in first person because the camera rides
  well above a 0.17 m step, and adding a collider is a `props.ts`/rig concern.

---

## NOT DONE — other requests that landed on ct/apartment.ts

Scope was cut deliberately so the desk can split `apartment.ts` into modules
and let several builders work the interior in parallel instead of queueing.
**None of the following were started.** Screenshots are already in
`street/shots/`.

1. **Ceiling lamps** — `shots/user-ceilinglamp.png`. Two problems. (a) There
   is no fixture at all: a bare glow decal on the ceiling, no shade, no bulb,
   no ceiling rose, so it reads as a smudge. (b) It is a smooth radial
   gradient in a world that is otherwise entirely hard-edged nearest-filtered
   texels — badly off-style, too large and too soft. Wants a modelled period
   flush-mount (shallow opal dome, or a schoolhouse globe on a short stem)
   painted at world texel density, and a tighter stepped/dithered glow instead
   of the gradient. Applies to *every* interior lamp in `apartment.ts` with
   this problem, not just the hall one. The glow textures are the `glowT` /
   `glowMat` block.

2. **Stairwell top** — `shots/user-stairtop.png`. The top landing floor ends
   at the stairwell opening; you can walk straight off into the flight below.
   Needs a landing floor around the opening that still lets you walk *down*,
   plus a guard railing along the top of the stairs. The pale centre core wall
   also reads as a floating grey slab and is too high.
   **The catch, and it is a real one:** floor height here comes from the
   floor-picker `ground(x, z)` with hysteresis, *not* from mesh colliders. So
   adding a floor means extending the landing plateau inside that function
   while leaving the sloped stair region intact, and adding the railing as an
   obstacle. Get it wrong and you either fall through the floor or cannot
   descend at all. Test by actually walking up and back down, not by warping.

3. **Door number plate** — `shots/user-doorplate.png`. The 401 plate is a
   stark near-white rectangle far brighter than the muted interior palette,
   and the numerals are smeared because the text size does not land on the
   texel grid. Same root cause as the entrance plaque. Wants texel-aligned
   numerals and a brass or brushed-aluminium tone. It is `doorTexN` in
   `apartment.ts`.

4. **Flat neighbour** — screenshot in `shots/user-*.png`. Not specified to me
   beyond the name; pick it up from the original request.

---

## Files

```
M  src/proto/ct/apartment.ts     entrance rebuilt; plaque deleted; stoop textured
M  src/proto/ct/tex-world.ts     ENTRANCE constant + resGroundTex rewritten
A  scripts/entrance.mjs          27-angle entrance review sweep
A  notes/feat-entrance.md        this
```

`resGroundTex`'s signature gained an optional third argument
(`bayW = ENTRANCE.BAY_W`); the existing call in `ct/street.ts` is unchanged
and still correct. `ENTRANCE` is a new export in `tex-world.ts` — the brief
scoped me to `resGroundTex` only, so flagging it: it sits directly above
`resGroundTex` and nothing else in that file was touched.

**Load-bearing coupling to know about:** `ENTRANCE` centres the bay on the
*building*, so `apartment.ts`'s `DOOR_Z` must equal the residential
building's centre z. It does — No. 227 is 18 m wide centred at z = −44, laid
out by `ct/street.ts`'s EAST roster. Move that building and the door must
move with it. Commented in both files.
