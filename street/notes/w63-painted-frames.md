# w63 — item 181: a probe can ask whether a frame was actually drawn

Ports **4190** (dev) and **4191** (`vite preview`, the built bundle); both proved
`000` before I bound them.

## The headline is not the fix — it is that the fault did not reproduce

The row's premise is *"shooting the built bundle returns black"*. **It does not,
here.** Seventeen attempts against the built bundle, three recipes each on a
**cold browser context** (so the bundle is re-fetched and re-parsed), plus six
concurrent copies per GOTCHAS §30:

| recipe | black | when |
|---|---|---|
| `waitForFunction(() => __ct)` and shoot immediately | **0.0 %** | `__ct` answered at 281–355 ms |
| `__ct` + `afterFrames(2)` — what GOTCHAS 78 prescribed | **0.0 %** | 485–797 ms |
| `waitPainted()` — this item's | **0.0 %** | 516–701 ms |

By the moment `__ct` first answered, the renderer already reported **13–15
frames drawn, 982 triangles, 144 draw calls**. `/tmp/w63-painted-A0-ctonly.png`
is the shot taken at that instant and it is a fully painted bedroom.

So: **the mechanism the row describes is real and the guard is worth having, but
it is not established that it was the cause of sixtyone's eight black frames.**
Written into GOTCHAS 80 rather than left in this note, because the next person to
get a black frame will read that entry and needs to know it is not a settled
diagnosis. Things not ruled out and at least as likely:

- **`CONTEXT_LOST_WEBGL`** — `bugsweep` logs it on this machine today. A lost GPU
  context paints black however long you wait, and **no frame counter can see it**:
  `info.render.frame` keeps counting.
- **A genuinely cold `vite preview`** — sixtyone measured the first painted frame
  at 1136 ms; every one of mine was around 300.
- **Viewport** — sixtyone shot 1280 × 720, I shot 1000 × 640.

The first bad instrument was mine and I nearly published it: the first cut used
`browser.newPage()` for all three recipes, which **shares the HTTP cache**, so
recipes 2 and 3 measured a warm bundle. A cold-start race measured against a warm
cache reports itself absent, confidently. Fresh `newContext()` per recipe now,
and it is commented at the call site.

## What landed

**`src/proto/crosstown.ts` — `__ct.painted()`**, beside `cullInfo()` and
`busInfo()`. Returns `{ frames, triangles, calls }` off `renderer.info.render`,
or `null` before `configure()` has run.

The row said *"publish the renderer"*. **I published the numbers instead**, and
that is deliberate: every caller reads this through `page.evaluate`, which
serialises, and a `WebGLRenderer` does not survive that in any form you can
assert on. The root cause is one line — `__ct` is assigned inside `make()`, and
`src/main.ts` calls `configure(renderer)` and the first `frame()` *afterwards* —
so `window.__ct` existing is a statement about `crosstown.ts`, not about the
screen.

**`scripts/lib/painted.mjs`** — two exports:

- `waitPainted(page, {frames = 2, capMs = 20000})` waits for the frame count to
  advance **with `triangles > 0`**. Frames alone is still a half-answer: a render
  call that drew nothing advances the counter and leaves a black screen, which is
  the same shape of half-answer that made rAF unsafe. It **throws** rather than
  warning — a wait that degrades to no wait is worse than the sleep it replaced,
  and that is precisely `afterFrames`'s failure mode.
- `blackFraction(page, pngBuffer)` — so a probe can refuse to report on the void.
  The last line of defence is still looking at the image.

**`notes/GOTCHAS.md` §78 rewritten.** It listed `afterFrames` as one of three
honest ways to wait, and it is not one. It now names `waitPainted`, gives the
call, and says why `afterFrames` is still right for its own job — letting the
SIMULATION advance a tick after a warp, where rAF is the thing that drives it.
The two waits look identical at the call site and are different questions.

**§80 updated** with the landing and with the non-reproduction above.

## Proof

| | |
|---|---|
| `scripts/probes/w63-painted.mjs` | 5/5 on the **built bundle**: the affordance exists, reports the right shape, B is a picture not the void, B waited for real geometry, **and `waitPainted` throws on a build with no `__ct.painted`** |
| ↳ watched failing (§27) | `delete window.__ct.painted` → *"the renderer never drew 2 frames in 1500 ms"*, thrown, not warned |
| `scripts/probes/w63-painted-load.sh 6` | six at once, GOTCHAS §30's own harness: 0 failures, 0 black |
| `node scripts/health.mjs` | WORLD OK, exit 0 |
| `npx tsc --noEmit` | clean |

I also **adopted it in my own shooting probe** (`w63-arm-angle.mjs`, item 165 —
one of the two rows the desk named where looking is the only proof). It now
waits for a painted frame and **exits 3** if the frame is over 90 % black: that
is "measured nothing", not "measured bad", which is GOTCHAS §32's own convention.

## Found and NOT fixed — for the desk to queue

1. **100 shooting scripts still wait only on rAF.** Measured:
   `grep -rl screenshot scripts/ --include=*.mjs | xargs grep -l afterFrames |
   xargs grep -L painted` → **100 of the 347 that screenshot**. Each is a
   one-line change (`await waitPainted(page)` before the shot) and none of them
   is my file. This is the audit the row asked me to "consider"; I did it and
   counted it rather than editing a hundred other builders' scripts.
2. **`scripts/probes/w61-doorflush.mjs` has a hand-rolled version of this** —
   it polls `page.screenshot()` and treats a PNG under 12,000 bytes as black,
   every 400 ms. It works, it is sixtyone's own workaround, and it should be
   replaced by `waitPainted` now that there is one. Not my file.
3. **A lost WebGL context still defeats every counter here**, including mine.
   If a probe reports frames advancing with triangles in them and the picture is
   still black, that is the case, and nothing in this tree detects it. A
   `renderer.domElement.addEventListener('webglcontextlost')` flag on `__ct`
   would; it is one line in `crosstown.ts` and belongs with whoever takes that up.
4. **`waitPainted` is not registered in `scripts/checks.mjs`** and neither is
   `w63-painted.mjs`, which is a real check with a watched mutation.
   `checks.mjs` is not named by item 181.
