# w36 — item 74: repack the published artifact so the reachable roof is in it

**Root cause, one line: nothing in the world was broken — the published artifact
predates `e539b2fa9`, so the roof the desk announced was the `roofY 1.50` one
that clears by exactly zero. The fix was already in mainline; only the packed
file was stale.**

Port **4190** (proved free: `curl` returned `000` before I started; 4186 was
already serving somebody else's world and I did not take it).

## What I checked before changing anything

The item's premise held, and I confirmed it rather than assuming it:

- `src/proto/ct/cars.ts:148` reads `roofY: 1.415` at HEAD `e539b2fa9`. w33's fix
  is in the tree.
- `dist/` did not exist in this worktree at all, so there was no artifact here to
  compare against — the stale file is the *published* one, which a builder cannot
  see. What I could prove is the positive: the roof in the file I packed is
  1.415, measured out of the artifact's own `__ct.colliders()` (below), not
  grepped and not typed here.

## What I did

`node scripts/pack-artifact.mjs` — it builds *and* packs, which is why packing
last satisfies GOTCHAS 63 in one step. `npx tsc --noEmit` was clean beforehand.
I ran **no bare `npm run build` afterwards**, so nothing wiped `dist/`.

The artifact is also staged at `street/artifact/artifact.html` (gitignored) so it
outlives this worktree, per GOTCHAS 63.

## The acceptance run — ON THE PACKED FILE, NOT ON DEV

`vite preview --port 4190 --strictPort` serves `dist/`, so `artifact.html` is
reachable at `http://localhost:4190/artifact.html`. **I checked the served bytes
were my packed bytes** (`curl … | md5sum` equals `md5sum dist/artifact.html`)
before believing a single measurement — an instrument aimed at the wrong world
is BUILDER-BRIEF §4, and "the preview is serving a different file than the one I
packed" is the same trap wearing a third hat.

1. **`check-artifact.mjs` passes** from `file://`: `__ct` initialised, 7783
   meshes, mean luminance 64.8, zero page errors. **Mutation-tested**:
   `--selftest` corrupts a copy on disk and the check goes red and says so
   (`__ct NEVER APPEARED`). The detector can fail.

2. **`bugsweep.mjs` on the built bundle**: exit **0**, 96 shots,
   **0 STATION MISS**, 0 COVERAGE. It reports `build e539b2fa9` — it measured the
   bundle, not a dev server. Console output is warnings only (deprecated
   `THREE.Clock`, `willReadFrequently`, GL ReadPixels stalls) — all pre-existing
   and none of them errors.

3. **I CLIMBED IT, inside the artifact.** `SHOT_URL=…/artifact.html node
   scripts/w21-roof-climb.mjs` — **PASS**, exit 0. The full route on the first
   attempt every time:

   ```
   pickup-cab-roof  {... "maxY":1.415}          ← read from the ARTIFACT's colliders
   flat tops on a freshly built pickup: 0.5, 0.6634, 0.72, 0.76, 0.84, 0.94, 0.97, 1.415
   ok  start: on the pavement   feet 0.140
   ok     down in the road      feet 0.000
   ok  1. bed floor             feet 0.500
   ok  2. bed rail              feet 0.970
   ok  3. CAB ROOF              feet 1.415
   ok  4. hood                  feet 0.940
   ok  5. back down on the street feet 0.000
   ok  6. flank is still a wall on foot
   ok  7.forward / 7.back / 7.left / 7.right   — off the roof all four ways
   ```

   That `maxY: 1.415` is the item's real evidence: it is the *packed file's own*
   collider, so the shipped artifact now contains the reachable roof. Up **and
   back down**, which is the clause the item asks for.

4. **The frame margin survived in the artifact too**, and this is the number w33
   settled the argument with: held **0.515 m** off the roof face, a walk covers
   **0.165 m per frame**, so **4 frames needed, 5 available** above 1.335 —
   **1 spare frame**, and the throttled hop actually landed. On the old
   `roofY 1.50` this quantity was zero.

### The throttle, stated honestly (GOTCHAS 68)

`w21-roof-climb.mjs` sets `Emulation.setCPUThrottlingRate: 8` itself, and
**x8 did survive on this box for this run** — the browser did not die and section
8 produced real numbers. I am reporting that as an observation about tonight's
load, **not** as a rebuttal of GOTCHAS 68: the entry says x8 kills the browser
here and a builder measured it doing so. One clean run is not evidence that it
cannot. I did not touch the rate.

## Numbers

- **Absolute path**: `/home/erick/projects/rpg/.claude/worktrees/agent-ac38daef94b002567/street/dist/artifact.html`
- **Staged copy**: `…/street/artifact/artifact.html`
- **Size, from `ls -la` and not from the script**: **1,121,715 bytes**
  (`pack-artifact.mjs` printed the same figure — the UTF-16 undercount in
  GOTCHAS 63 really is fixed)
- **md5**: `ef4aeab5f070efd0de14cbac0bfd8999`
- **build stamp**: `e539b2fa9` = HEAD at pack time

**Note on the second pack.** This note is a commit, so committing it moves HEAD
past the stamp above, and `checks.mjs` exits 2 on a `dist`-vs-HEAD mismatch —
which would abort the next person's entire suite before a single check ran. So I
repack **after** this commit, from byte-identical `src/` (only the stamp
changes), and re-run `check-artifact` and the full climb against that final file.
**The delivered file's size and md5 are the ones in my `done.sh` line**; the pair
above belongs to the run transcribed here. Both files were packed from the same
source and both were walked to the roof.

## What I did NOT do

- **I have not published, and must not.** PARALLEL-WORKFLOW §4: one artifact URL,
  and the desk owns it. Two publishers means Erick playtests a build nobody can
  name. The desk publishes `dist/artifact.html` (or the staged copy).
- **Pages is not deployed by this item.** It auto-deploys on push to mainline, so
  it follows whenever the merge train lands.
- **`dist/` is gitignored**, so this commit contains only this note. The artifact
  itself cannot be committed and the staged copy is the only thing keeping it
  alive past worktree cleanup.

## Found, not fixed — for the desk to queue

- **`scripts/w21-roof-climb.mjs` ends with `process.exit(allOk ? 0 : 1)` twice**
  (lines 492 and 493, the last two in the file). Harmless — the second is unreachable — but it is
  a duplicated line in the file that decides whether the roof works, and it will
  confuse the next reader. One-line delete; I did not touch it because the item
  named `street/dist` and `scripts/pack-artifact.mjs`, and w21's file is neither
  (BUILDER-BRIEF §9).
- **The `INEFFECTIVE_DYNAMIC_IMPORT` warnings at build time are real.**
  `ct/hud.ts` is dynamically imported by `blackjack.ts`, `library-pc.ts` and
  `slots.ts` while also statically imported by ten other modules, and
  `ct/slots.ts` likewise. The dynamic imports therefore buy nothing — the chunk
  never splits — and the bundle is a single >500 kB chunk. It works, and for a
  single-file artifact one chunk is arguably right, but somebody wrote those
  `import()`s expecting code-splitting and is not getting it.
