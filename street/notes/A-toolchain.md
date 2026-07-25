# Builder A — two hazards in the harness, both closed

No world change in either of these. `scripts/` only.

## The queue was already done

I rebased and re-read `notes/queues/A-shared.md`; it is byte-identical to last
session and all six boxes are work that has landed. I verified each against the
tree rather than trusting my own memory of it:

| item | evidence in the current tree |
|---|---|
| (a) window lattice | `const lit = litAt(f, c)`; the old formula survives only in a comment |
| (b) tree alpha | notch centres `1.0 + r() * 0.14`; the interior sky-holes loop is gone |
| shopfronts | all five painters in `tex-world.ts`, four depth helpers, `street.ts` down to the import + 3 dispatch lines |
| pattern #1 | `masonry()` exported, used 12× in `street.ts` and 7× in `civic.ts` |
| build stamp | `ct-stamp` in `hud.ts`, `virtual:build-stamp` in `vite.config.ts` |
| artifact | **was missing** — see below |

**The desk still needs to tick the file**, or replace it. Five of six were
genuinely complete; the sixth had quietly come undone.

## 1. The artifact was destructible, and had destroyed itself

`dist/artifact.html` was gone again. `vite build` wipes `dist/` and does not
re-pack, so any later build deletes it — which is what happened to the copy I
handed over last session, twice, and I documented it as a footnote instead of
fixing it. That was the wrong call: a footnote does not survive contact with the
next person, and the artifact's entire job is to be able to say which build
somebody is looking at.

`scripts/pack-artifact.mjs` now:

- **builds first** unless given `--no-build`, so one command always produces a
  correct artifact; `--no-build` errors on an empty `dist/` rather than crashing
- **reads the build stamp back out of the bytes it just wrote**, not out of git —
  git reports the tree, and the question the artifact answers is what is in the
  *bundle*. It exits non-zero if the stamp is not in there, rather than handing
  over an artifact that cannot identify itself.
- fails loudly if the module-tag replacement no-ops, which it would do silently
  if `dist/index.html` ever changed shape

**`street/dist/artifact.html` is rebuilt and verified** at `499892c7`: 702,788
bytes, 1131 objects, zero failed requests from `file://`, no errors. Still
unpublished — that is the desk's step.

## 2. Every screenshot in this repo could be a white page

This environment drops the WebGL context periodically (`CONTEXT_LOST_WEBGL` is in
most sweeps). A lost context screenshots as a **white page with the DOM overlay
still drawn on it** — title card, build stamp and all. Playwright reports
success. The script prints "done". The PNG proves nothing, and it looks like a
real capture, which is why it gets through.

`scripts/shotguard.mjs`, added rather than edited into anyone's script:

- `ensureAlive(page)` — probes four points of the framebuffer and retries.
  Import it before a capture in any new script.
- `node scripts/shotguard.mjs shots/` — audits PNGs already on disk, needs no
  dev server, so it can be run over **someone else's output after the fact**.
  It ignores the bottom 18% of the frame, because the title card and stamp are
  DOM and render over a dead canvas — masking exactly the thing being looked for.

Run over my 102 PNGs it found three. Two I had already caught by eye. The third
is the one that matters: **`stamp-full.png` had been blank since the build-stamp
session and I never noticed**, because I only ever opened the cropped corner
versions of it. It sat in `shots/` looking like evidence.

`bug-*`, `v-*` and `seam2-*` all came back clean, so the existing evidence base
is sound. Nothing was checking it, though. My `shots/` is now 101 PNGs, zero
blank.

## For the desk

- **Adopt `ensureAlive` in `verify.mjs`, `bugsweep.mjs` and `seams*.mjs`.** They
  are other agents' scripts so I have not touched them. Until then,
  `node scripts/shotguard.mjs shots/` after a sweep catches it at the door — it
  exits non-zero, so it chains.
- **The artifact is waiting on you** at `499892c7`. Rebuilding it yourself is
  now safe and one command; the stamp will just move to your sha.
- **My queue is empty.** Six items, all verified landed.
