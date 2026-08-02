# Queue item 6 — the jail's brick seam disagreements, fixed

**Root cause, one line:** `shell()` in `ct/jail.ts` handed the FLANK material to
material index 0 as well, but on `BoxGeometry(depth, height, width)` the ±x
faces span `width` and the ±z faces span `depth` — so a texture painted for
`depth` metres was stretched over a face `width` metres wide.

**227 → 0.** The item said 103–107; it had grown to 227 by the time I measured.

## The item's stated cause was a hypothesis, and it was wrong

`notes/w3-seampairs-jail.md` (the prior worker, who correctly established the
readings as REAL) guessed *"a single mis-parameterised `masonry()` call reused
across the flank with the wrong width argument"* and pointed at *"the east flank
wall between roughly z −97 and −109 … sharpest at the pier around (61, 6.1,
−103)"*.

The flanks were never the problem. Measured with `scripts/w15-jailfaces.mjs`,
which reports every jail masonry face with its declared density, its measured
density, its real face size in metres and its canvas size: **`mi4`/`mi5` — the
actual flanks — read 15.96–16.09 px/m against a declared 16 on every shell.**
Every bad reading was on `mi0`, `mi1`, or on a single-material trim box. The
face w3 saw by eye at x≈61 was the building's *back* (x = BX = 65) seen from
the yard, not its east flank.

Four distinct faults, all the same mistake in different places — **a texture
sized to one face being worn by a face of a different size**:

| where | measured vs declared 16 px/m | pairs |
|---|---|---|
| the upper storey's BACK wall, wearing the 4 m flank canvas over 14 m | **4.57** | 58 |
| the two piers' backs, same | 11.03 | 66 |
| the yard screen walls' 0.2 m end caps, wearing the 9.65 m run | **770** | 72 |
| the lintel + recess-back shells sharing the piers' full-height flank | 52.86 / 23.13 / 18.55 | ~10 |
| five trim boxes sharing one 1 m ashlar canvas (0.08 m sill → 14 m band) | 1.14 … 200 | ~21 |

## What I changed — `src/proto/ct/jail.ts` only

1. **`shell()` gains a `back` material, defaulting to `face`.** Derived, not
   chosen: both ±x faces span exactly `width × height`, and every `face`
   texture in this file is painted at exactly that. The upper storey is the one
   caller that passes an explicit `back` — its `face` has the windows painted
   into it, so the back gets `upperTex(W, …, front=false)`.
2. **The screen walls' end caps** are painted at `SCR_T` (0.2 m), not `SCR_LEN`
   (9.65 m). On that wall `shell`'s `face` slot IS the thin return; the long
   elevation is the `flank` pair.
3. **The lintel and recess-back shells paint their own flanks** at their own
   height and depth instead of sharing the piers' 4 × 4.6 m one.
4. **The trim is dressed stone, not ashlar.** Sills, jambs, the door head and
   the string course are each one dressed stone; `dressed(wM, hM)` paints a
   face, a lit top arris and a shadowed underside, sized to its own face.

## The one judgement call, and why it is not a loosened check

`dressed()` declares `'detail'`, which takes the trim out of `seampairs`'
like-for-like question. **On its own that would be exactly the "loosen it until
it passes" move BUILDER-BRIEF §7 forbids**, so it is not doing the work:

- The density is **derived** — `DRESS_PPM = masonry(1, 1, 0, 2).ppm`, the same
  call `stoneTex` makes, not a retyped 16. Measured after: jambs **15.71 × 16**,
  door head **16.05 × 16.36**, string course **16 × 15.38** against the ashlar's
  declared 16. Those three would pass on their own merits declared as brick.
- The **pixels changed**: the ashlar joints are gone from the trim, which is
  visible in `shots/w15-jail-port-before.png` vs `-after.png`.
- The two sill sizes genuinely cannot comply: a lit arris, a face and a shadowed
  underside is **three texels minimum**, and three texels over an 0.08 m sill is
  37.5 px/m however it is declared. That is the honest reason the label is
  `'detail'` and I have said so in the source rather than in a commit message.

## Mutation tests — every check here can go red

| mutation | result |
|---|---|
| `seampairs.mjs --selftest` (doubles one face's `repeat.x`) | **SELFTEST PASSED** — the tool still catches a mis-scaled face |
| revert `shell()`'s index 0 to `flank`, keep everything else | **126 REAL disagreements** return |
| demand the walk pass THROUGH the fence and the screen wall | both legs go **FAIL** |

## Did the world move? No — and I can show it rather than assert it

`npm run fp before` / `after`, then compared. Raw `fpdiff` reads alarming
(“1718 differ … this IS a structural change”); it is not, and here is why.

- **objects 8351 → 8351.** Nothing added, removed or reshaped.
- `fpdiff`'s `structure` string embeds the material's **texture hash**, and the
  harness seeds `Math.random`, so every canvas painted after `jail.ts` in the
  seeded stream re-grains. Strip only the texture hash and **structure differs
  on 30 rows, all of them `MeshBasicMaterial:WxH` canvas-size changes on the
  meshes I edited** (`154x38 → 3x38`, `16x16 → 11x60`, `16x16 → 18x3`). **Not
  one `BoxGeometry`/`PlaneGeometry` parameter changed.**
- `tints` IDENTICAL. `places` 3 rows differ — four ground decals at
  (−5.7…−6.5, ·, −21…−24), `mod=props`, y flipping between 0.14 and 0.19.
  **Those are not mine:** with the seed removed — the world as the user actually
  loads it — two consecutive loads of *identical* code disagree on 3 of the 4
  (`scripts/w15-whatmoved.mjs`). They pick their y at random every load.
- Two seeded runs of my own build give a **byte-identical** fingerprint
  (`textures=e6029fa3 structure=53b13970 places=460c3743` twice), so the 3 rows
  above are the only difference, and they are a coin flip.

## Verified

- `seampairs.mjs`: **0** like-for-like, **0** brick-vs-brick. Was 227.
- `scripts/w15-jailfaces.mjs`: **0** bad faces of 46 jail masonry faces.
- `scripts/w15-jail-walk.mjs`: 8/8 legs — approach, forecourt, yard to the
  fence, both screen walls hold, not wedged, floor continuous (`groundAt` 0.14
  at all five points), and the walk in front measures **6.00 m**.
- `node scripts/bugsweep.mjs`: **zero STATION MISS**, no new console errors.
- **All of the above re-run on the BUILT bundle** (`npm run build` +
  `vite preview`), not only on dev.

## Found and did NOT fix — for the desk to queue

1. **The 0.2 m screen-wall end caps are barely visible.** They were a real
   declared-vs-drawn mismatch (770 px/m, 72 of the 227 pairs) and are now
   correct, but the −x end butts into the building's back wall and the +x end
   is coplanar with the fence at `FENCE_X`, so a player can hardly see either.
   **The visible win is the back wall and the sally-port trim, not these.** I am
   flagging it so the desk does not over-credit the pair count.
2. **`scripts/probes/*.mjs` are broken by the reorganisation.** They import
   `./lib/…` and now live one directory down, so e.g.
   `node scripts/probes/jailwalk.mjs` dies with `Cannot find module
   .../scripts/probes/lib/frames.mjs`. ~330 files. A `../lib/` rewrite fixes it.
3. **`ct/jail.ts` still has a masonry face I could not judge**: `scripts/`'s
   seam list shows three world-wide UNDECLARED faces outside the jail
   (`32x32 at (11.3,8.5,−79.5)`, `(11.2,13,−70.5)`, `0.45x3.2 at
   (15.9,0,−54.3)`). Not mine, not in this item, still unjudgeable.
4. **I did not touch `int-jail.ts`.** The item named the exterior only, and the
   room is a separate coordinate space.

## Derived or copied?

Derived throughout. `DRESS_PPM` comes from `masonry(1,1,0,2).ppm`; every
end-cap and flank size comes from the constant the shell is already built
from (`SCR_T`, `DEP`, `LINT_Y`, `JAIL.RECESS`); `w15-jail-walk.mjs` reads the
site from `window.__ct.sites().jail` and derives `FX`/`BX`/`FENCE_X` from
`JAIL.FORE`/`JAIL.DEPTH` rather than typing 61/65/74.65. **Nothing was retyped.**

## One process note the desk should see

My first commit (`d3770c506`) swept in another agent's staged reorganisation of
~350 notes and ~330 scripts, because `git commit` commits the whole index and
this worktree is shared. The desk caught it independently and landed
`52b7c8a99 GOTCHAS 59: a spawned builder may share your worktree, and git add -A
then lies`. My later commits are clean. **I also nearly reported a false green:
`vite preview --port 4195` failed with "port in use" and my instrument happily
measured somebody else's world on 4195 and said 0 disagreements.** I only
noticed because the build stamp was not mine. GOTCHAS 48 is real and the build
stamp in `reportWorld` is what saves you.
