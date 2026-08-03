# Item 275 — the watch and how far down you must look

Worker onehundredten, 2026-08-03. Port **4661** (4186/4188 were taken).

## The row was inverted, and the desk caught it mid-item

The row asked me to **widen** a 20° window. Halfway through, the desk relayed
the user's clarification:

> *"i want you to need to look straight down, it is confused. im asking for
> that. it isnt that way"*

His original words — *"to look at your watch you need to look straight down
(couple deg of tolerance)"* — were **a specification, not a bug report**. I had
already written and typechecked the widening change (a gate derived from
`FOV_REST / 2` = 44°, the pitch at which the horizon leaves the frame); it was
reverted unshipped. Recording it because the reasoning is still true and
someone may be tempted by it later: **44° is where the world runs out of the
top of the frame**, and that is a real landmark if the taste ever flips back.

## What I measured before changing anything

All on the **built bundle**, not dev.

| | before | after |
|---|---|---|
| watch appears at | **54.384°** below level | **71.582°** |
| pitch clamp | **74.485°** | 74.485° (untouched) |
| tolerance window | **20.10°** | **2.90°** |
| spread over 5 runs | 0.000° | 0.000° |

`scripts/probes/w110-watch-gate.mjs` measures both edges off the world: the
clamp by holding ArrowDown until pitch stops moving, the gate by **bisecting**
with `__ct.warp(…, pitch)` to 0.01°. Neither `PITCH_LIMIT` nor the tolerance is
retyped in the probe.

## The row's other hypothesis is DISPROVED

The row guessed the watch might be *"shown long before it can be read"* —
`WATCH_DROP` leaving the LCD mostly under the frame at 54°. It does not.

- The wrapper is `position:fixed`. **The frame at 55° and the frame at 74° are
  identical** — same transform matrix to the last digit, on every one of the
  15 pitches sampled. Nothing improves as you keep pitching down.
- Client boxes at 1280×958 (`w110-lcd-pixels.mjs`; marker divs parented *inside*
  the wrapper so the browser applies the drop and the rotation):

  | | y | cut | on screen |
  |---|---|---|---|
  | case | 845.5…1002.9 | 44.9 px | 71.5% |
  | LCD | 868.9…966.4 | 8.4 px | 91.4% |
  | **digits** | 891.4…951.8 | **0.0 px** | **100%** |
  | caption | 931.6…987.3 | 29.3 px | 47.4% |

  **Readable-at and appears-at were always the same angle.**

⚠ My first version of that measurement did the rotation by hand and reported
the **stowed** LCD as 99.3% on screen — which `shots/w110-pitch-54.png` flatly
contradicts. The screenshot caught the instrument. That is why the shipped
probe makes the browser do the transform.

## What changed

- `fp.ts` — **`PITCH_LIMIT = 1.3` exported**, replacing three hand-typed `1.3`s
  (mouse clamp `:511`, the two arrow-key clamps `:515-516`). Pure refactor.
- `crosstown.ts` — `WATCH_TOLERANCE = degToRad(2.9)` and
  `WATCH_PITCH = -(PITCH_LIMIT - WATCH_TOLERANCE)`. The gate at `:2002` now
  reads `rig.pitch < WATCH_PITCH`. **The tolerance measures back from the
  clamp**, so if the neck ever moves the watch moves with it.
- `ct/hud.ts` — comment only, see below.

**`fp.ts` is a file the row did not name** (BUILDER-BRIEF §9). I edited it
because the desk's own instruction was *"derive it from the clamp rather than
typing a second magic number"*, and the clamp lives there with no export.
Flagging it rather than hiding it.

## The `WATCH_DROP` comment was lying, and the lie was dangerous

It claimed the 30 px was `WATCH_PIVOT × sin(tilt)`, *"DERIVED so it stays right
if the tilt is ever tuned again"*. It is not derived, **and that formula is
wrong**: 242 × sin(18°) = **74.8**, which would push the face 45 px further
down and put the digits **39 px under the frame** — destroying the exact thing
this item is about. A future builder "restoring the derivation" would have
broken the clock.

I did **not** change the value. I replaced the false claim with the measured
constraint it was actually buying: the fist's inner bottom corner must stay
below the frame (it sits **26.5 px** below at drop 30; its outer corner is
34.7 px above, so the edge crosses diagonally and reads as cut). Seating the
whole case on the bottom edge needs drop ≈ **−15**, which floats the fist by
19.5 px — the failure the original comment describes. **The two wants pull
opposite ways; there is no formula waiting to be found.**

`WATCH_TILT` (−18°, item 200's settled taste call) untouched.

## Proof

- `w110-watch-gate.mjs` — **PASS**, 5 runs, spread 0.000° on both edges.
  Both signs self-tested at ±0.5° of the measured edge; negative case (back to
  level) stows.
- **Mutation, at the source**: `WATCH_TOLERANCE` → `degToRad(20.1)`, rebuilt.
  Probe went **red** (`FAIL: tolerance 20.10 deg outside 1..5`, exit 1) and the
  bisected edge landed on **54.384°** — `-0.95` rad to three decimals, the
  threshold this item replaced. So the probe reads the shipped gate, not its
  own arithmetic. Restored and rebuilt.
  **An in-page mutation was tried first and is deliberately NOT in the file**:
  it raced the world's per-frame transform write, threw, and the run went red
  on a console error while the gate never moved. A mutation that fails for the
  wrong reason is worse than none.
- `w110-pitch-clamp-both-signs.mjs` — the refactor's real risk is a typo in the
  direction nobody tests. **PASS**: ±74.485° on ArrowUp, ArrowDown, mouse-up
  and mouse-down drag. The reference is measured, so the file holds no copy
  of 1.3 either.
- `tsc --noEmit` clean · `vitest` 17/17 · `health.mjs` **WORLD OK** ·
  `bugsweep` **0 STATION MISS, 0 COVERAGE**, no new console errors.
- **Looked at**: `shots/w110-after-clamp.png` — at the clamp the wrist is up
  and `15:14` is legible. `shots/w110-after-3deg-short.png` — 3° short of the
  edge, no watch. That is the gesture he asked for.

## Found, not fixed — for the desk to queue

1. **`D-walk.mjs` fails on the ATM: `pressing E opens the machine: 3 full-screen
   panels -> 3`.** **PRE-EXISTING, NOT MINE** — verified by checking
   `src/proto/` out at `abe88b868`, rebuilding, and re-running: it fails
   identically. Worth a row; the next line (`ESC gets you back out of it:
   3 -> 3`) passes against the same unchanged count, so the counter may be the
   bug rather than the ATM.
2. **The `CROSSTOWN QUARTZ` caption is 52.6% under the frame** and the case
   71.5% on screen. The digits are fine, so this is cosmetic, and fixing it
   means reopening the drop/fist trade-off above. Not touched.
3. **The watch box overlaps the prompt line.** `ct-note` sits at
   (640, 840); the watch spans x 468…928, y 735…990. At the new steep gate this
   is rarer than before, but a floor-level `[E]` prompt read while looking
   straight down would be behind the wrist.
