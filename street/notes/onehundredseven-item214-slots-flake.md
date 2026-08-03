# w107 — item 214, the flaky slots check

Worker **onehundredseven**. Port **4188**, built bundle.
`scripts/L-slots-inworld.mjs` only.

---

## Reproduced before touching anything

Five runs, unchanged source, `sit` mode:

```
reel 1 moved 1.9 stops   OK
reel 1 moved 1.3 stops   OK
reel 1 moved 1.3 stops   OK
reel 1 moved 0.7 stops   FAIL
reel 1 moved 0.9 stops   FAIL
```

**Three green, two red.** Worker seventy reported 0.5 against 1.4; this is the
same spread.

## The cause, named — and it is none of the three the row offered

Not index-matching, not a moving box, not an animation beating against the
sample rate. It was:

```js
const a = await view();
await p.waitForTimeout(220);          // a fixed WALL-CLOCK sleep
const c = await view();
moved = |c.pos - a.pos| > 1           // against a TYPED threshold
```

220 ms is **13 rendered frames on an idle machine and 3 on a busy one**, and
three frames of a reel is under one stop.

**This file already forbade it, eleven lines below, about the very next wait:**

> *"never by sleeping a fixed time — GOTCHAS §30: a spin is driven by frames and
> one frame is 17 ms idle and over a second under load, so any constant here is
> a bet on how busy the machine is."*

That sentence is exactly right and this was the one place the file did not
follow it. Nothing about the world differed between the green runs and the red
ones.

## The fix — count frames, and ask the machine what it expected to do

1. **Sampled on 30 consecutive RENDERED frames**, driven by
   `requestAnimationFrame` inside the page. The window is a frame count, so it
   cannot shrink when the machine is busy — it only takes longer.
2. **The threshold is derived, not typed.** `view()` publishes each reel's own
   `speed` in stops a second (`ct/slots.ts:396`), so the distance the reel
   *should* have covered is that speed integrated over the observed sample times
   by trapezoid. The assertion is that **the position it reached agrees with the
   speed it published** — which is the real claim the check's own sentence makes
   (*"turning on the world's own clock"*), is self-calibrating at any frame rate,
   and reddens if the reel freezes, stutters, or lies about its speed.
3. **Positive deltas only.** A reel position wraps and the modulus is not
   published; rather than guess it, the one negative step is dropped. That can
   only ever **under**-count, so it cannot manufacture a pass.

## Five runs, identical verdict, unchanged source

| run | frames | raw advance | expected | ratio | verdict |
|---|---|---|---|---|---|
| 1 | 30 | 8.17 | 8.03 | **1.02** | OK |
| 2 | 30 | 7.16 | 7.20 | **0.99** | OK |
| 3 | 30 | 15.17 | 15.19 | **1.00** | OK |
| 4 | 30 | 4.24 | 4.40 | **0.96** | OK |
| 5 | 30 | 15.17 / 21.17 | 15.19 / 21.22 | **1.00** | OK |

**The raw advance ranges 4.24 to 21.17 stops over the same 30 frames** — a 5×
spread, because the window lands at different points of the spin's
deceleration — **while the ratio never leaves 0.96–1.02.** That contrast is the
whole fix in one line of evidence: the old check was reading a number that was
never stable, and the new one reads a number that is.

## It has a floor, and it still goes red for its own reason

- **Floor.** Under 12 spinning frames, or under 1 stop of expected travel, it
  prints `ABORTED` and exits **3** — *"NOT a pass and NOT a failure: nothing was
  measured"* (GOTCHAS §32/§34). Proved by forcing `FRAMES` to 4:
  `4 spinning frames (floor 12)`, **exit 3**. Reverted.
- **Negative case.** `CT_FREEZE_REELS=1` makes `view()` keep reporting its speed
  while the positions stop advancing — the **shipped** check, not a copy,
  measuring a broken machine. `observed 0.00 / expected 18.22`, **ratio 0.00,
  FAIL, exit 1.** The healthy run is **exit 0**. Both exit codes read from the
  command, never after a pipe.

## Item 208's machine is what was measured

`all` mode against the rebuilt slots: **19 OK / 0 FAIL, exit 0**, twice. The
reel-rest and detent checks below the repaired block are untouched and still
pass, so the red I found was flakiness and not a regression from 208.

## Found and NOT fixed — for the desk

`scripts/probes/w107-reel-trace.mjs` is the one-shot that got me there, and it
recorded something worth knowing: **calling `__slots.play()` without the panel
open leaves `pos` frozen at 0 while `state` reads `spinning` and `speed` reads
0.18.** The machine only advances while its panel is up. That is almost
certainly correct (nothing should animate behind a closed panel) but it means
**any future probe that drives `__slots` directly, without sitting, will measure
a stationary reel and can only conclude the reels are broken.** Worth a line in
`ct/slots.ts` beside `play()`; it is not my file.
