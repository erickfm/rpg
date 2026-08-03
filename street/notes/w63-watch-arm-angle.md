# w63 — item 165: the forearm goes down and away now

Ports: **4190** (dev) and **4191** (`vite preview`, the built bundle). Both
proved `000` before I bound them; 4192 was already serving somebody else's
world.

> *"too much arm here i think it shou;ld have a bit of a steeper angle maybe?"*
> — 2026-08-02, with `Screenshot from 2026-08-02 20-29-35.png`

## His diagnosis was right, and the row's reading of it was right too

**Root cause, one line:** the forearm w57 added was added along the wrong axis —
at **5°** it lay across the whole bottom of the frame as one flat slab of one
tone and one thickness, and a limb seen from your own eyes does not do that; it
goes down and away, so it occupies a **corner**.

I reproduced his frame before changing anything (`/tmp/w63-arm-before.png`,
1280 × 958, spawn room, pitch −1.25, clock 13:35 — his shot reads 13:36 on
mine only because a minute turned). It is his picture: the band runs x 0…930
with a dead-straight top edge, the same flesh tone end to end.

**He is not retracting his second report** (*"i would like the rest of the arm
(to the left) rendered as well"*), and this does not remove a pixel of it.
Steepening shortens the arm's APPARENT length while the continuation is all
still there — it now leaves through the bottom edge instead of the left one.

## What changed, all in `src/proto/ct/hud.ts`

| | |
|---|---|
| `WATCH_TILT` | **−5° → −18°** |
| `WATCH_DROP` | new, **30 px** |
| forearm shape | one `fillRect` → a **tapering** column staircase |
| recede ramp | `rgba(0,0,0,0.18)` → **0.32** |

**The tilt was in THREE places and one of them had never worked.** `WRAP_CSS`
said `rotate(-6deg)`; `hud.watch()` wrote `rotate(-5deg)` in two string
literals. `watch()` overwrites `transform` on the first frame the player looks
down, so the CSS `-6` had been dead since the day it was typed — and both
readings looked deliberate, which is why nobody caught that they disagreed. One
`WATCH_TILT` and one `watchTransform(shown)` now (BUILDER-BRIEF §8).

**`WATCH_DROP` is the price of the tilt, and I found it by looking.** The pivot
sits at the wrist, so rotating swings the far end down — which is the point —
and swings the HAND end **up** by the same rule: 21 px at 5°, 75 px at 18°. The
fist then left the bottom-right corner and stood in the middle of the floorboards
as a squared-off block with world on three sides. `/tmp/w63-arm-t18.png` is the
frame where I saw it. **My first fix was wrong**: I derived the drop as
`WATCH_PIVOT × sin(tilt)` = 75 px, which is exactly right for the fist and much
too much for the watch — the watch is *at* the pivot, so it never rose, and
dropping the element pushed the LCD half off the bottom of the screen
(`/tmp/w63-arm-t18d.png`, and the time is unreadable in it). 30 px is what puts
the hand back on the bottom edge while the LCD stays fully legible.

**The taper is the other half of "plank".** A band of one thickness for its
whole length has no foreshortening in it, and the top edge is a ruler line. It
narrows 26 canvas px over 300 now — anatomically backwards, since a real forearm
is thicker at the elbow, and perspective wins by a mile at this range. Drawn
**column by column** so the slope is a texel staircase: this canvas is upscaled
2.75× with `image-rendering:pixelated`, and a `lineTo` diagonal would be
antialiased first and then magnified into the one soft edge in a world drawn
entirely in hard texels.

**The recede ramp had to deepen because the arm got shorter.** 0.18 was spread
over a forearm that crossed the whole frame; at 18° the visible run is about a
quarter of that, so the same ramp read as flat in it.

## Measured, in his posture and his room

`scripts/probes/w63-arm-angle.mjs`. It hides the renderer's canvas before
counting, because the apartment floor is a brown very close to skin and a colour
test over the live frame counts floorboards as forearm — the instrument-not-the-
world failure BUILDER-BRIEF §7 puts at half of all "defects" here. A second,
ordinary screenshot is taken for looking at.

| 1280 × 958 | before | after |
|---|---|---|
| bottom edge of the screen covered | **65.5 %** | **42.6 %** |
| HUD share of the frame | **11.5 %** | **6.2 %** |
| top-edge angle over the visible run | **6.2°** | **20.7°** |
| leftmost x the arm reaches | 0 | 274 (it exits through the BOTTOM now) |

**Identical numbers on the built bundle** (4191): 42.6 % / 6.2 % / 20.65°.
Same behaviour at 1920 × 1080 (`/tmp/w63-arm-after1920.png`).
`scrollWidth === clientWidth === 1280` — the 2.1 kpx element still makes no
sideways scroll.

`scripts/probes/w57-watch.mjs` (w57's own) reports the LCD's texel box as
`638…681 × 21…43`, **unchanged** — the watch face itself is not redrawn.

## Proof

| | |
|---|---|
| `scripts/probes/w63-arm-stow.mjs` | 5/5 on the **built bundle** — comes up looking down, **stows clear of the frame looking up**, slides rather than swings, one tilt in both states |
| ↳ watched failing | stow set to `translateY(10%)` → `2 FAILED`, exit 1, on exactly the two stow lines (GOTCHAS §27) |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, no new console errors |
| `node scripts/health.mjs` | WORLD OK, exit 0, build `fa606ff1e` |
| `scripts/K-no-panel-traps.mjs` | all good — every panel in the world still closes, `hud.ts` is the file they all live in |
| `npx tsc --noEmit` | clean |

**`fp`/`fpdiff` is not quoted and must not be**: this change is entirely DOM and
CSS on a HUD overlay, so a scene fingerprint measures nothing about it either
way. The right instrument for "apparent proportion" is the rendered frame, which
is what the item says.

## My own verdict on the after-images

`/tmp/w63-arm-after.png` against `/tmp/w63-arm-before.png`.

**Before:** he is right, and it is worse than "too much arm" — it is not read as
an arm at all. A flat plank of one flesh tone spans the frame with a straight
top edge, no elbow, no taper, no sense of the far end being further away.

**After:** it enters low on the left, climbs to the wrist, thins and darkens as
it goes back, and the hand is cut by the bottom edge the way it always was. It
reads as a forearm below your own eyeline. The watch is about 30 px lower and
`13:36` is fully legible; `CROSSTOWN QUARTZ` under it is now partly cut by the
frame, which it very nearly was before.

**Honest reservations.** The hand's outboard edge is still a hard vertical line
at x ≈ 925 with floor to the right of it — it does not run off the right of the
frame. That was true before this change and I did not touch it. And 42.6 % of
the bottom edge is still not a small number; it is a forearm at arm's length, so
some of that is correct, but if he says "still too much" the next step is
`WATCH_TILT` and nothing else, which is now one line.

## Found and NOT fixed — for the desk to queue

1. **`scripts/probes/w57-watch.mjs` asserts nothing and exits 0 whatever it
   prints.** It ends with `armLeftEdge … (viewport 0..1280)` for a reader to
   judge — the `<- must be true` shape GOTCHAS §27 names by example. Its stated
   goal, *"the arm must run to x = 0"*, is also **superseded by this item**: the
   arm deliberately leaves through the bottom edge now. Somebody should re-point
   it or retire it, and it is not my file.
2. **Nothing runs either of my probes.** `w63-arm-stow.mjs` is a real guard with
   a watched mutation and it belongs in `scripts/checks.mjs` with a `canfail`
   case. `scripts/checks.mjs` is not named by item 165.
3. **`WATCH_ARM = 600` is now mostly off-frame in a new way.** It was sized so
   the arm reaches the LEFT edge of a 3840 viewport; with an 18° tilt the arm
   exits through the BOTTOM after ~250 canvas px on any normal screen, so most
   of the 600 is never drawn anywhere visible. Harmless — it costs a 776 × 72
   canvas repainted once a minute — but the comment above it now over-states
   what the number is for.
