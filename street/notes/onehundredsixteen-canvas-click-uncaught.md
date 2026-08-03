# Item 284 — the canvas click's uncaught pointer-lock rejection

Worker onehundredsixteen, 2026-08-03. Port **4720** (`ss -ltn` clean before
binding, `--strictPort`). Verified on the **built bundle** via `vite preview`.

## What was wrong, in one line

`requestPointerLock()` returns a **Promise** and throws nothing synchronously,
so the `try/catch` around the world's only click-to-lock (`src/main.ts:32`)
caught **nothing** — and wherever the lock is refused, the rejection surfaced as
an **uncaught pageerror on every canvas click**.

The desk's diagnosis was **right**, which is worth recording because it usually
is not: the mechanism, the file, the line and the prescribed fix all checked out
against the source.

## The numbers

Measured with `scripts/probes/w116-canvas-click-uncaught.mjs` — the built
bundle inside an iframe sandboxed **without `allow-pointer-lock`**, which is the
published artifact's real runtime condition.

| build | clicks | `requestPointerLock` calls | uncaught pageerrors |
|---|---|---|---|
| before (`HEAD~1`) | 5 | 5 | **5** |
| after | 5 | 5 | **0** |

**Five runs each sign** (`scripts/probes/w116-five-runs.sh`):

```
before   0/5 clean, 5/5 failed   — 5 pageerrors every run, no spread at all
after    5/5 clean, 0/5 failed   — 0 pageerrors every run, no spread at all
```

One uncaught error per click, exactly as the row said.

The red side is not a mutation — it is `git show HEAD~1:./src/main.ts` rebuilt
and re-measured, then reverted. **The call count is pinned at 5 on both sides**,
which is the point: the green cannot be a handler that quietly stopped firing.

## Refusing the easy green

"0 uncaught errors" is trivially true on a world where the click never asked for
a lock, where `pointerLock` is false on the proto, or where the sandbox quietly
*allowed* the lock. So three floors run before the assertion:

- the world **paints** in the sandbox (`__ct.painted()`, not `afterFrames` — GOTCHAS 78/80)
- the sandbox **really refuses** the lock, established by a separate call this probe owns
- the click **actually called** `requestPointerLock` — counted through a wrapper

⚠ **The counter must not attach a rejection handler.** `r.catch(…)` *even only
to observe* marks the promise handled and suppresses the very pageerror under
test — it would have turned the red case green. The wrapper returns the original
promise untouched.

## The other sign

`scripts/probes/w116-plain-page-locks.mjs`: on an ordinary top-level page the
lock is still **GRANTED** after the fix, with **0** uncaught errors. A `.catch()`
cannot swallow a fulfilment, but that is an argument and this project measures.

**One leg was removed rather than loosened, and this is the part to read.** Two
cuts tried to assert mouselook-while-locked and both failed on a world that is
fine — first as net yaw, then as sampled Σ|Δyaw|, each reading exactly `0.0000`.
It is the instrument (BUILDER-BRIEF §7). Once Chromium holds the lock it pins the
cursor and Playwright's synthetic mouse carries no real delta:

```
93 locked mousemove events
SIGNED   Σ movementX = -400      ← one warp to centre, then nothing
ABSOLUTE Σ|movementX| = 12360    ← ± pairs inside single frames, net zero
first deltas: [-400, 0, 0, 0, 0, 0, 0, 0, 0, 0, …]
```

`main.ts` zeroes `input.mouseDX` every frame, so deltas cancelling inside one
frame can never reach the camera. **Dropping the threshold until it went green
would have been a check that cannot fail.** Nothing in this item touches
mousemove handling; what the fix could have broken is the lock being granted,
and that is leg 3. Drag-look — the path the sandboxed artifact actually runs on
— is leg 4 of the sandbox probe and still turns the camera (yaw 1.571 → 0.999).

## Regression

- `scripts/pointer-returns.mjs` — **82 assertions, 0 failures, 0 console errors** (item 277 intact)
- `scripts/probes/w109-iframe-fallback.mjs` — **8/8 PASS**; its 3 remaining console lines are the browser's own note, not uncaught, exactly as item 277 documented
- `node scripts/health.mjs` — `WORLD OK`
- `node scripts/bugsweep.mjs` — 96 shots, **0 STATION MISS, 0 COVERAGE**; only the pre-existing `THREE.Clock`/`willReadFrequently`/`CONTEXT_LOST_WEBGL` warnings
- `npx tsc --noEmit` — clean

## ⚠ FOUND AND NOT FIXED — `dist/artifact.html` DOES NOT BOOT AT ALL

The item's DONE WHEN includes *"the artifact is clean"*, so the artifact had to
be loaded to answer it. **It is not clean; it is dead.**
`scripts/probes/w116-artifact-boots.mjs`:

```
http://localhost:4720/artifact.html   __ct false · __lab false · canvases 0
    REQFAILED: http://localhost:4720/three.core-erZvyR2f.js   (404)
    ARTIFACT DOES NOT BOOT
http://localhost:4720/index.html      __ct true · canvases 10 · 142 frames / 982 tris
    0 errors — ARTIFACT BOOTS
```

So the world is fine and the **packaging** is broken. One line,
`scripts/pack-artifact.mjs:25`:

```js
const js = readdirSync('dist/assets').filter((f) => f.endsWith('.js'))[0];
```

**The first JS file in directory order.** That was the only chunk once. The build
now emits four —

```
hud-CTaUuEXP.js     19,442      ← this is what [0] returns, and what gets inlined
index-CTrp1GJ5.js  957,533      ← this is what dist/index.html actually loads
slots-BLWTLvkT.js   20,338
three.core-...js   187,796
```

— so the packer inlines the **HUD chunk**, and the artifact is a 20 KB file whose
`import … from "./three.core-…js"` resolves next to `artifact.html` rather than
inside `assets/`, and 404s. `grep -o requestPointerLock dist/artifact.html`
returns **1**, not 2, for the same reason: `main.ts` was never in the file.

**Both of the packer's own guards pass on this.** The module tag really was
replaced, and the build stamp really is baked into the hud chunk too — a textbook
check that cannot fail (GOTCHAS 58/79).

The extra chunks come from `import('./hud')` in `blackjack.ts`, `slots.ts` and
`library-pc.ts`. `git log -S "import('./hud')"` dates the first of those to
**2026-07-26** — `hud-*.js` sorts before `index-*.js`, so the packer has been
capable of producing a dead artifact since then. I have **not** established how
long the *published* artifact has been affected; the desk should check the live
URL rather than assume.

**Scope, per BUILDER-BRIEF §9:** item 284 names `src/main.ts` and nothing else,
so I did not touch `scripts/pack-artifact.mjs`. The fix is one line — select the
chunk `dist/index.html` actually references, rather than `[0]` — and it wants a
check that the packed file **boots**, which `w116-artifact-boots.mjs` already is.
**Queue it; it is more serious than the item I was given.** The GitHub Pages
deploy serves `dist/` with `assets/` intact and is unaffected.

**What this means for my own DONE WHEN.** I could not run the fix inside
`artifact.html`, because that file does not run. I verified it instead under the
exact runtime condition the artifact represents — the built bundle in a frame
where pointer lock is refused — which is the same code by a different wrapper.
Saying so rather than claiming the artifact leg is the honest answer.

## Files

- `src/main.ts` — the fix (the `try` is kept; an older browser can still throw synchronously, and the older DOM signature returns `undefined`, hence the `typeof` test)
- `scripts/probes/w116-canvas-click-uncaught.mjs` — the sandbox check, 4 floors + the assertion
- `scripts/probes/w116-five-runs.sh` — the spread
- `scripts/probes/w116-plain-page-locks.mjs` — the other sign
- `scripts/probes/w116-artifact-boots.mjs` — the side-finding

Derived, not retyped: the fix's shape is read from `ct/hud.ts:1446` (item 277)
rather than reinvented; the chunk sizes and names are read out of `dist/`.
