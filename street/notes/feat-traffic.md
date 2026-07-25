# Handoff — builder H, `feat/traffic`

**Worktree:** `../rpg-traffic` · **port** 4187 · **base:** `c7135dd` (mainline)
**Owns:** `ct/crowd.ts` (new, this note), `ct/cars.ts` (per queue — see
*Ownership* below)

---

## Done — queue item 1: split the walking sim into `ct/crowd.ts`

**Commit:** `09b8323`

### What the queue asked for vs. what was actually there

The queue says to split the sim "out of `ct/citizens.ts`". It was not there.
`ct/citizens.ts` was **already** only the atlas — `citizenAtlas()` + `viewFor()`,
258 lines of painting, which is the half that is genuinely shared (three modules
paint people through it). The sim was inline in **`crosstown.ts`**: the `CAST`
list and build loop at lines 213–280, and the per-frame walking pass at 484–539.

So the split is `crosstown.ts` → `ct/crowd.ts`, and `ct/citizens.ts` is
**untouched**. The outcome the queue wanted holds either way: the atlas stays
desk-owned and shared, the sim is mine.

`crosstown.ts` 606 → 490 lines.

### What moved

Verbatim, comments and all — the cast list, `strideFor`, the `Citizen` record,
the build loop, `clearAt`, and the whole steering / ghosting pass.

Two invariants had to survive the move, and did:

- **The build call sits at the same point in the sequence.** The atlases paint
  through `pixTex`, off the shared `Math.random` stream. `buildCrowd()` is
  called exactly where the inline `CAST.forEach` was — between the traffic pool
  and the `colliders` array. Move it and every texture painted after it
  re-grains (`GOTCHAS.md` §1). There is a comment at the call site saying so.
- **Run order is unchanged.** The sim registers itself with
  `ctx.onFrame(fn, ORDER.LATE)` rather than being called from `update()`. LATE
  is the last hook order, so it still runs after the props pass, and it still
  reads the cruiser's box from the *end of the previous frame* — same as the
  inline loop, which ran before the traffic pass wrote it.

### Two seams worth knowing about

`buildCrowd(ctx, opts)` takes its own options object instead of widening
`CtxBuild`. `ct/ctx.ts` is desk-owned, and the crowd needs three things that are
not on it: the live `citAvoid` list, a way to register a person's box as solid
to the *player only*, and `props.lit`. A local options object keeps ctx.ts out
of the diff entirely.

`citAvoid` is held as a **live array reference**, not copied. `crosstown.ts`
pushes the cruiser's box onto that list *after* the crowd is built, so a
snapshot would have made the moving car invisible to pedestrians. If anyone
changes the crowd to copy that list, cars stop being avoided and nothing will
fail loudly.

### Verification

**Pure refactor, structurally (`GOTCHAS.md` §1):**

```
npm run fp before / after
textures   282 vs 282 — IDENTICAL   (88364e99)
structure  591 vs 591 — IDENTICAL   (5d8fc4fa)
places     591 vs 591 — 7 differ
```

The 7 are the 6 walkers and one pigeon, all ~0.1 m. **Two runs of the same code
differ in those same 7** — I captured a third fingerprint to confirm it, so that
is the noise floor and not the change. (The `before`/`before2` pair happened to
agree on the walkers exactly, which is luck of load timing, not determinism —
don't read that as a tighter floor than it is.)

**And by walking, not looking** — `scripts/crowd-walk.mjs` (new, mine), drives
the player at a citizen and samples the encounter:

```
OK  six people in the scene
OK  they are walking — 6/6 moved >0.2 m in 1.5 s
OK  all feet planted on the kerb at y=0.14
OK  they walked up to you — closest approach 0.06 m
OK  halted a step short instead of walking through — 1.4 s at 0.8–1.25 m
OK  gave up and squeezed past — never trapped you
OK  west walk still passable — 14.4 m south in 6 s (people, trees and all)
```

The halt plateau measuring 1.4 s is the `stuck > 1.4` timer, observed rather
than asserted from the source. `scripts/people.mjs probe` also passes unchanged
(6 distinct sheets, 6 distinct silhouettes, feet at y=0.140), `npm run build` is
clean, and `npm run sweep` reports no new console errors — only the pre-existing
`THREE.Clock` deprecation and GL readback warnings.

**One thing found while probing, worth writing down** (not a bug, cost me a
detour): the citizens' outer home lanes are `|x| = 6.22` and `6.39`, which is
0.31 m off the facade at `FACE = 7.0`. Fine for a 0.25 m-half body, but the
0.36 m player capsule warped there is *jammed inside the wall collider*
(`maxX = -FACE + 0.3 = -6.70`) and cannot move at all. So **a probe cannot warp
the player into an arbitrary citizen's lane** — only the innermost, `|x| = 6.05`.
The 2 m walkable lane itself is unaffected and still clear.

---

## For the desk

1. **`crosstown.ts` is in my diff and `ownership.sh H` flags it.** Unavoidable —
   there is no way to move code out of a file without touching it, and the
   queue's item 1 is exactly that. Scope was kept to the minimum: delete the
   sim, add one `buildCrowd()` call, repoint `__ct.atlases`/`__ct.people` at the
   module. **No shared signature or behaviour changed**; `ct/ctx.ts` and
   `ct/citizens.ts` are untouched.
2. **`OWNERSHIP.md` is out of date for me.** It has no entry for
   `src/proto/ct/crowd.ts`, and still lists `src/proto/ct/cars.ts = B`, which my
   queue transfers to H. Until that lands, `ownership.sh H` will flag cars.ts as
   B's the moment I start the corner-turning item. Your file, not mine.

## Next up (queue items 2–4, not started)

Cars turn the corner → extend detail down the side street → pedestrian path
graph. The split was deliberately landed on its own first so that if the
behaviour work goes wrong, the refactor is not in doubt.

For the path-graph item, note that the crowd is currently a **1-D ping-pong**:
each person owns a `home` lane on the x axis and walks `dir` along z between
`-L + 4` and `10`. Turning the corner means that `home`-lane-plus-z model has to
become a graph position, and `clearAt` is the only part of the steering that
generalises unchanged.
