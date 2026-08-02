# w26 — `groundPick` was a query that moved the player (item 49)

**Root cause, one line:** every return in `groundPick` went through
`apt.setGy`, the walk-up's storey picker — so *asking* where the floor is
rewrote which storey the player was recorded as standing on, and `canSee` asks
once per candidate `[E]` spot **every frame** at the SPOT's coordinates.

Ports used: **4190** (dev) and **4191** (built bundle, `vite preview`). Both
proved `000` before use; both shut down at the end.

---

## What was actually wrong

`apt.gy()` read 0.00 at the kerb edge while the ground there is 0.14 and the
camera — which was right — sat at 1.76. The desk's diagnosis on this one was
**correct**, and w25's cause survived contact: the drift is not in
`ct/apartment.ts`. `setGy` stores exactly what it is handed. What disagreed was
*which coordinate wrote last*.

`groundPick` has three callers. Only one — FPRig's per-frame `groundY`
(`fp.ts` 146, 390, 495, all at `this.pos.x/z`) — passes the player's own
position. The other two are the `__ct.groundAt` test affordance and `canSee`,
and `canSee` runs at spot coordinates on every rendered frame. On the pavement
the last spot probed happened to sit at 0.14 and nothing looked wrong; at the
kerb edge it was a road-level spot at 0.00.

It survived for weeks because **the damage and its repair are one frame
apart** — the next frame's rig update writes the player's own ground back — so
anything sampling across two frames sees a clean world. That is exactly what
made w25's own first test report "pure read, OK".

## The fix

Both halves of the chain now take a `commit` flag, defaulting to a pure read:

- `crosstown.ts` — `groundPick(x, z, commit = false)`. One local
  `put()` is the only place the side effect can happen.
- `ct/apartment.ts` — `aptGround(wx, wz, commit = false)`, because the
  walk-up's picker is stateful and **assigns `lastGy` itself** from its own
  hysteresis. A pure wrapper around it in `crosstown.ts` would still have
  leaked for every `x > 100` coordinate. `lostAbove` is raised only on a
  committing call too — it is a fact about where the player is, and a question
  asked about somewhere else is not evidence about that.

**Exactly one call site passes `true`:** `groundY: (x, z) => groundPick(x, z, true)`.
Anything else that means to *move* the player between storeys still says so out
loud through `apt.setGy` — `jumpTo` and `__ct.warp` both do, unchanged.

`Apartment.ground`'s interface signature gained the optional third argument;
that is the whole API change.

## Verdict, personally checked

- `scripts/probes/w25-kerb-gy.mjs` — **2 FAILED → all green, exit 0.** The kerb
  edge now reports `apt.gy()` 0.140 against `groundAt` 0.140, and a `groundAt`
  about the road leaves 0.140 alone in the same tick.
- `scripts/probes/w26-storey-query-pure.mjs` — **new, and it covers what the
  kerb probe structurally cannot**: the `x > 100` path into `aptGround`. It
  enters No. 227 through the door with a held `[E]`, finds flight A by
  *sweeping* for a ground height that is not a storey multiple (nothing about
  the staircase is typed), proves a query about the stairs leaves the storey at
  0.000, and then **walks up** — 0.000 → 1.350 m through 37 intermediate
  heights.
- `bugsweep.mjs`, 96 shots: **zero STATION MISS**, no new console output (the
  four pre-existing warnings only: THREE.Clock deprecation, three getImageData
  and GL ReadPixels stalls).
- `tsc --noEmit` clean; both probes green on the **built bundle** at 4191 as
  well as dev.
- **The world did not move.** `scenedump` before/after, both from built
  bundles on 4191: `textures=44c087f0` and `structure=b9c8813c` **identical**.
  `fpdiff` reports 3 tint differences (the casino/hotel chase, i.e. which frame
  the dump landed on) and 10 places, of which 7 moved more than 5 cm — all
  walkers on the pavement between −20 and −60, which is the documented noise
  floor. Nothing structural changed, as expected: this touches no geometry.
- **`npm run checks`, fast tier, against my built bundle.** Seven real reds,
  and I attributed every one:
  - `D-outline-debug-only` — "close the door" gets no prompt. **Pre-existing.**
    Baselined by checking `crosstown.ts` and `ct/apartment.ts` back out to
    4d35e1b1b, rebuilding, and re-running: **18 pass / 2 fail, the identical two
    lines.** This was the one that could plausibly have been mine — it is the
    upper-floor `[E]` that depends on `canSee`'s storey-aware eye — so it is
    the one I spent a build proving.
  - `door301` — "E from inside the swing DOES shut it: false". **A flake.** It
    goes green on re-run against the same build, unchanged: "the door holds:
    opens, shuts, blocks the doorway, never refuses, and pushes you clear."
  - `mirror-walk` (PAWN/THRIFT door sides), `spot-coverage` (the standing
    inventory of 281 registered spots with no check), `floaters-walk` (props
    with air under them), `checks-registered` (three scripts in no tier),
    `hashes-resolve` (189 rebased commit hashes cited across `notes/`) — all
    unrelated standing reds.
  - Every `WRONG WORLD` in that run is **my own commits landing mid-run** — the
    runner says so itself: "THE TREE MOVED UNDER THIS RUN: 820377126 →
    567d9f0b5". Not a finding.

  Worth knowing for the next builder: `scripts/probes/` is **not** flagged by
  `checks-registered`, so BUILDER-BRIEF §7a's instruction to put one-shot
  probes there does not fight that check.

### Mutation-tested, bytes confirmed, both halves separately

| mutation | diff | result |
|---|---|---|
| `crosstown.ts` `put()` always commits | 1 line | kerb probe **2 FAILED, exit 1** |
| `ct/apartment.ts` `lastGy = best` unguarded | 1 line | walk-up probe query check goes **0.000 → 0.184, exit 1**, while the climb stays green |

The second row is the one that matters: it discriminates the two directions, so
the probe cannot pass by simply refusing to write.

## Found and NOT fixed — for the desk to queue

1. **`scripts/jump-walk.mjs` in this checkout is still the pre-item-42
   version** and its three storey rows (`inside, ground floor` / `the apartment
   stairs` / `upstairs`) all report `gy 0.00 -> 0.00`. They are at
   `(104/112/120, -16)`, which is in no room — the walk-up is at x 200. It
   passes green while testing nothing about the storey picker. That is items 42
   and 50, already known and in flight; noting only that it was **useless to me
   as a regression test** for the picker, which is why I wrote a probe instead.

2. **The stairwell has a central spine you can wedge against.** My first walk
   started at the lobby drop point, `AX(1.2)` = the boundary between flight A
   (west half) and flight B, held W, and stopped dead **0.37 m short of the
   bottom step** at z −11.97 — 5 seconds of walking into something. Stepping to
   the middle of the run (x 200.60) climbs cleanly. I did not investigate
   whether a player walking straight in from the door hits it, and it is
   outside this item. Worth one walk: **the door drops you on the one x that
   does not climb.**

3. **`scripts/door301.mjs` is flaky.** It failed "E from inside the swing DOES
   shut it" inside `npm run checks` and passed on an immediate re-run against
   the byte-identical build. One of the two runs is lying and neither is
   loosened by me. Given §5 (a held `[E]` is read once per rendered frame) and
   the machine's load, my guess is its keypress hold or its settle, not the
   door — but that is a guess and it wants measuring, not a tolerance bump.

4. `groundPick`'s pure path is now called ~once per candidate spot per frame
   and does slightly less work than before (no `setGy`), so nothing here is a
   cost regression. No pixel change is expected or was observed — this is
   bookkeeping only.

## Derived vs copied

Nothing was retyped. The probe takes the entrance from the world's own
`__ct.spots()` list by label, and finds flight A by sweeping `groundAt` for a
height that is not a storey multiple. `fp.ts`'s yaw convention
(`fwd = (sin yaw, 0, −cos yaw)`, `fp.ts:416`) is cited rather than restated. The
only constant in the probe is the *shape* of the test, not a coordinate.
