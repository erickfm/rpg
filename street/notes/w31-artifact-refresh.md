# w31 — item 60: the playable artifact, repacked on the collision work

**Port used: 4192** (proved free with `curl` → `000`; `ss -ltn` showed 4180,
4181, 4187, 4188, 4193, 4194 held by other builders). Everything aimed with an
explicit `SHOT_URL`. Servers shut down at the end.

**There was no root cause to find — this item is a refresh, not a repair.** The
world source is untouched: `git diff <pack build>..HEAD -- src/` is empty. What
changed is that the artifact now carries w24's collider rotation, the
`groundPick` storey fix, `seat-facing` as a standing guard, and the canfail
restore fix.

---

## The artifact

```
/home/erick/projects/rpg/.claude/worktrees/agent-a1f8b52d50550c3c4/street/dist/artifact.html
```

staged (per GOTCHAS 63, so it outlives the worktree) at:

```
/home/erick/projects/rpg/.claude/worktrees/agent-a1f8b52d50550c3c4/street/artifact/artifact.html
```

| | |
|---|---|
| bytes, **from `ls`** | **1,117,520** |
| bytes, from `pack-artifact.mjs` | 1,117,520 — **they agree** |
| md5 (both copies identical) | `73c2bdfc96ae9ad9a3171c54e7d1061b` |
| build stamp in the bundle | **`df0f27deb`** — equal to HEAD |

Packed **after** the final commit, so `dist/` matches HEAD and the stamp is the
honest answer to "which build is this?". No build was run afterwards.

**The byte counts agreeing is itself a result.** GOTCHAS 63's tail records
`pack-artifact.mjs` printing `out.length` — UTF-16 code units — under the label
"bytes", a 210-byte undercount on a 1.1 MB file. That is fixed
(`pack-artifact.mjs:56` uses `Buffer.byteLength(out, 'utf8')`), and the item's
instruction to take the number from `ls` is what confirms it rather than
assuming it. Nobody needs to keep distrusting that number.

**I did not run a build after packing** (GOTCHAS 63): the artifact is intact and
byte-identical in both locations, re-checked after every subsequent step.

## `check-artifact.mjs`

```
artifact: __ct initialised, 7775 meshes, mean luminance 64.8
  it opens standalone and draws                                  EXIT 0
```

and it can fail — `--selftest` corrupts a **copy** and was caught:

```
selftest: wrote a deliberately broken copy — this MUST now fail
artifact: __ct NEVER APPEARED — it does not open
SELFTEST PASSED — an artifact drawing nothing was caught               EXIT 0
```

`dist/artifact.html`'s md5 was unchanged by the selftest, and the temporary
`dist/artifact-selftest.html` was cleaned up.

## `bugsweep` on the built bundle

`SHOT_URL=http://localhost:4192/ node scripts/bugsweep.mjs` — **exit 0, 0 STATION
MISS**, 96 shots. Console output is the pre-existing warning set only
(THREE.Clock deprecation, Canvas2D `willReadFrequently`, WebGL driver stalls); no
errors.

## WALKED: the bodega chamfer, in the artifact

`scripts/probes/w24-chamfer-walk.mjs` (w24's own acceptance test) aimed at
`file://…/dist/artifact.html` — **ALL CHECKS PASS**:

- **the chamfer is ONE rotated collider** (`rot 0.7854`), among 5 boxes
  overlapping the corner — the user's *"not just a bunch of separate rectangles"*;
- **collision surface FLAT to 0.0 mm** — 21 stations, `perp` 0.3590 at every one;
- **walked into it at 17 stations, stop distance 0.425 m at every one, spread
  0 mm** — the staircase used to saw between 0.343 and 0.425;
- **the diagonal walk clears the corner** (3.48 m along a 2.83 m face) and
  hugging the face never puts you inside it.

**Sections 3 and 3b (the V-overlay red, via `ct/gap.ts`'s own `trapAgainst`)
report `SKIPPED — this is a BUILT bundle; gap.ts is not served as source here`.**
That is the probe being honest rather than a gap in the evidence: those two need
a dev server that serves TypeScript source, and w24 already measured them
(red on the chamfer: 3 → **0**). The two `CORS`/`ERR_FAILED` console lines in
that run are the probe's own blocked `import()` of `gap.ts` from `file://` — the
instrument, not the world.

### ONE RUN IN FIVE WENT RED, AND IT IS THE PROBE'S CLOCK, NOT THE CHAMFER

I am not reporting a clean sweep, because I did not get one. Across **five runs
on artifacts whose world bytes are identical** (only the build stamp differs),
section 4a's *"cleared the corner"* verdict gave:

| run | cleared | verdict |
|---|---|---|
| 1 | 3.48 m | ok |
| 2 | 4.63 m | ok |
| 3 | **2.58 m** | **FAIL — did NOT clear the corner** |
| 4 | 8.41 m | ok |
| 5 | 8.32 m | ok |

A 3.3x spread on the same world means the number is not a property of the world.
4a walks for a **fixed number of held-key steps**, so what it measures is how
many frames this machine rendered in that wall-clock window — the trap the brief
names as *"a fixed wall-clock wait truncates what you measure under load"*. Five
other builders were running when run 3 happened.

**The verdicts that describe the collision surface passed in every one of the
five runs**, and they are the ones with no clock in them:

- the chamfer is ONE rotated collider (`rot 0.7854`);
- surface FLAT to 0.0 mm across 21 stations;
- no walk ended up inside the wall;
- riding and hugging the face never puts you inside it.

So the chamfer is sound and **4a's pass/fail threshold is load-dependent**. For
the desk: 4a wants to walk until it stops making progress, or to normalise by
frames rendered, rather than to assert a distance after a fixed number of steps.
w24's own note already records `interiors-walk.mjs bodega` as flaky; this is the
same shape in the same area. I did **not** re-tune it — it is w24's file and
tuning a metric until it agrees with me is what the brief forbids.

## SAT AT A GAME, in the artifact — `scripts/probes/w31-artifact-sit-at-a-game.mjs`

**219 seats, 117 of them at a game.** Sat at `"sit at the slot"`, three
consecutive green runs:

- **walked in on held W** — ~2.0 m on foot from a standoff behind the stool,
  closing 1.2 m → 0.76 m. Not a warp onto the approach point: had the aisle been
  walled, this notices and a warp would not;
- prompt on arrival `[E] sit at the slot`; a **held** `[E]` seats the player
  (a tap can begin and end inside one frame — BUILDER-BRIEF §5);
- **you get back up.** Escape stands the player up from the slot, confirmed via
  `__ct.seated()` and by reading the position back. This is §11's clause and the
  user's *"i can't get up anything i do once i sit down"*;
- 0 page errors beyond the `file://` import noise.

**Mutation-tested:** holding `q` instead of `e` for the sit turns the run red
(`FAIL pressing [E] seats the player`, exit 1), and the mutation changed bytes.
The probe is load-bearing, not decorative.

## Two instrument errors of my own, recorded rather than quietly fixed

Both are in the probe's header, because they are the useful part.

1. **I "measured" `fp.ts`'s forward convention and got it backwards.** I placed a
   standoff, held W, and flipped the offset when the distance to the seat grew.
   A casino aisle is narrow, both standoff points were inside collision, and what
   the probe observed was the player being **shoved out of a wall** — not the
   direction of travel. It duly inverted a calculation that had been correct.
   The convention is `fwd = (sin yaw, 0, -cos yaw)` — **`src/proto/fp.ts:477`,
   with `:480` binding W to it** — cited rather than re-derived (§8).
   *Reading the source settled in one line what an experiment had got wrong.*
2. **A 0.25 m landing tolerance I invented was flaky** — the same warp landed
   0.15, 0.30 and 0.68 m off across runs, because citizens stand in the aisle.
   The run that landed 0.30 m out walked in and sat down perfectly well. I
   **deleted the proxy rather than loosening it**: the walk and the sit are
   judged, the shove is reported. A threshold tuned until it agrees with you is
   the thing BUILDER-BRIEF forbids.
3. Also demoted: my **panel-detector selector found nothing**, so asserting on it
   would have been a check that cannot fail. It prints `selector UNPROVEN —
   reported, not judged`, and the verdict rests on `__ct.seated()`, which the
   world publishes.

## Found and NOT fixed

- **`scripts/probes/w24-chamfer-walk.mjs` has a bare default URL** —
  `process.env.SHOT_URL ?? 'http://localhost:4210/'` — rather than going through
  `lib/aim.mjs`. Run without `SHOT_URL` it measures port 4210 and says nothing
  about having guessed, which is GOTCHAS 48 exactly. It is w24's file and one
  line to fix (`const URL = aim('http://localhost:4210/')`). I aimed it
  explicitly every time, so nothing here is affected.
- **The three stale `health.mjs` docs from my item 61** are still outstanding and
  are listed precisely in `notes/w31-health-canary-exit-code.md` — chiefly
  `CLAUDE.md` line 103, which still tells every new agent not to trust an exit
  code that now works.

## Which build, and what publishing still needs

The packed artifact's stamp is **`df0f27deb`, equal to HEAD** — it was packed
after the final commit of this item, so there is no gap to reason about. (The
only thing committed after the pack is this paragraph.)

**I did not publish it.** Item 60's DONE WHEN stops at the packed, checked and
walked file, and republishing to the existing artifact URL is the desk's step:

```
cd street && npm run build && node scripts/pack-artifact.mjs
# then publish street/dist/artifact.html to the EXISTING artifact URL
```

Note the ordering trap for whoever does it: that `npm run build` **before** the
pack is fine, but a bare `npm run build` **after** it wipes `dist/` and takes
`artifact.html` with it (GOTCHAS 63). The staged copy at `street/artifact/`
survives that.
