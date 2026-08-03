# w57 — item 111: the watch arm continues to the edge of the frame

*"for the watch i would like the rest of the arm (to the left) rendered as well.
should be simple. just a continuation of the arm."*

Ports **4185** (dev) and **4191** (`vite preview`, the built bundle); both were
`000` before I took them, both shut down.

**Root cause, one line:** `drawWatch` already ran the wrist off `x 0` — **the
canvas ended there**, and it had only ever been widened to the RIGHT, when the
fist arrived.

## Why "simple" was not simple, and the coupling the item did not name

The item listed two coupled numbers and both were real. There is a **third**,
and it is the one that would have moved the thing the user said not to move.

1. **The scale was hidden.** A 176 px canvas displayed at a literal
   `width:484px` is **2.75 CSS px per watch pixel**, a number that appeared in
   neither. Widen the canvas and every pixel silently shrinks. `WATCH_S` is
   named now and the canvas's displayed size derives from `WATCH_W`.
2. **`left: calc(46% + 77px)` was a compensation nobody had labelled.** 77 is
   `(176-120)/2 × 2.75` — the correction for the last time this canvas grew.
   It is derived from `WATCH_ARM` now.
3. **THE ELEMENT IS ROTATED ABOUT ITS OWN MIDDLE.** Widening it moves the pivot,
   and the fist goes from a hand's breadth off the pivot to about a metre — so
   `rotate(-5deg)` would have swung the watch **up by roughly 130 px**. Nothing
   in the CSS says this and no amount of care with `left` fixes it. Pinned with

   ```css
   transform-origin: calc(100% - 242px) 50%;
   ```

   Only the left side grows, so the old middle is always `WATCH_HAND/2` canvas
   px in from the RIGHT edge — the `calc(100% - …)` form stays correct whatever
   `WATCH_ARM` becomes. Work the algebra through with that origin and every term
   in x and y cancels: a pixel that existed before lands on the same screen
   pixel after.

`WATCH_ARM` is derived rather than chosen. The canvas's left edge lands at
`0.46V − 165 − 2.75·ARM` for a viewport `V` wide, so reaching the frame edge
needs `ARM ≥ (0.46V − 165)/2.75` — **155 at 1280, 262 at 1920, 369 at 2560, 583
at 3840**. 600 covers all of them, costs a 776 × 72 canvas repainted once a
minute, and anything past the edge is clipped by the viewport, which is what
"runs off the frame" means. Left overflow never makes a scrollbar; the probe
asserts `scrollWidth === clientWidth`.

## What was drawn

**Everything the user already has is the identical drawing under one
`g.translate(WATCH_ARM, 0)`** — the wrist, the fist, the strap, the case and the
LCD keep their own coordinates and their own order. The thing he liked cannot
have drifted.

**One line was removed:** the 10 px `rgba(0,0,0,0.15)` cap that marked the cut
end. With the arm continuing, that would be a dark stripe across the middle of a
limb — precisely the "reads as two limbs" failure the item warns about. Its tone
is spread over the new length instead, deepest at the elbow.

The recession is a **gradient**, and the pixel art survives it: the canvas is
painted at 1× and upscaled `image-rendering:pixelated`, so it resolves to
one-texel steps shown 2.75 px wide — banded at the same scale as everything
else, with no step big enough to read as an edge, and a fully transparent stop
at the wrist so the join is not a join.

**The ramp is a rate, not a fraction of the canvas, and my first cut got that
wrong.** Spread over all 600 px it reached only alpha 0.07 by the edge of a
1280 frame and the arm read dead flat — I looked at it and it was wrong.
`WATCH_ARM` is sized for a 3840 viewport, so on a normal screen most of it is
off-frame; the shading has to be spent where the player can see it. 240 canvas
px is the 242 that reach the left edge of a 1280 frame.

## Proof

The item's two hard constraints are numeric, so they are **measured**.
`scripts/probes/w57-watch.mjs` finds the LCD's `#9cab8b` — a colour nothing else
in this world uses — and reports its bounding box on the rendered frame:

```
LCD before  (527, 596, 650, 667)  5575 px
LCD after   (527, 596, 650, 667)  5575 px    IDENTICAL
```

Same place ⇒ **the watch face has not moved**. Same pixel count ⇒ **the pixels
are the same size**. (I first diffed the whole watch region and got 1.4% of
pixels differing — that is the world behind the arm, and it is why the check
targets a colour only the watch has. The `#3a3d45` case colour is no good for
this either: the apartment TV is the same grey.)

The wrap's **right** edge is `915.5` before and after; its **left** edge goes
`416.1 → −1227.6`. `scrollWidth === clientWidth === 1280`.

Identical numbers on the **built bundle** (`/tmp/w57-watch-built.png`).
`bugsweep` **0 STATION MISS, 0 COVERAGE**. `K-no-panel-traps` all good.
`w57-pad-walk` (my own ATM work, which lives on the same file's panel
framework) still 23/23 green on the built bundle.

**Frames, which I have looked at:** `/tmp/w57-watch-before.png` against
`/tmp/w57-watch-after2.png`, and the arm crops `/tmp/w57-arm-{before,after2}.png`
at 2×. **My verdict:** before, the arm is a stub that starts in mid-air with a
dark cut end — the user is right that it reads as a disembodied cuff. After, it
runs unbroken off the left of the frame, darkening as it goes back, and it reads
as one limb. The `rotate(-5deg)` carries the far end down toward the
bottom-left corner, which is where a forearm actually goes.

## Found and NOT fixed

1. **`ct/hud.ts` IS ALSO ITEM 133's FILE and w60 was holding it while I worked.**
   `claim.sh` hands out the top unclaimed row and has no way to skip, so
   releasing 111 and claiming again just returned 111. I took it and kept the
   edit inside `WATCH_*`/`drawWatch`/the wrapper CSS — **133 is `ARROW_ART`,
   `HAND_ART` and the cursor hotspots at ~:495–560, about 500 lines away**, so a
   merge should be clean, but the desk should land these two deliberately rather
   than by luck. This is a gap in the queue mechanism, not in either item:
   **BUILDER-BRIEF §9 says "skip it, take the next" and there is no way to do
   that.** Worth a `claim.sh --skip`.
2. **The `else` branch of the watch's element setup was a latent three-bug
   trap** and I fixed it in passing: it resized the canvas but left the
   wrapper's `left`, its pivot and the canvas's displayed size at whatever the
   previous build set, so a second `makeHud` over an existing DOM would have
   shown the new arm at the old scale in the old place. Only reachable on a
   rebuild, which is why nothing had caught it.
3. **The arm is a straight-edged band for its whole length.** A real forearm
   swells toward the elbow. The user asked for *"just a continuation"* and an
   earlier all-at-once redraw was rejected, so I did not taper it — but that is
   the obvious step 3 if he wants one.
4. Beyond a 3840-wide viewport the arm's far end would come back into frame.
   One number (`WATCH_ARM`) and the formula is in the comment above it.
