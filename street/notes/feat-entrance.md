# feat/entrance — builder C handoff (queue round)

Worktree `../rpg-entrance`. Owns `ct/apartment.ts` and `resGroundTex` in
`ct/tex-world.ts`. Queue: `notes/queues/C-entrance.md`.
Previous round's note is in `notes/archive/feat-entrance.md`.

---

## QUEUE STATUS — all six items are done

Rebased on `add-stick-and-city98` before each item, as the queue requires.

| queue item | commit |
|---|---|
| `## Now` Hermit: clipped and too clean | already landed (`bd3a241`, verified again this round) |
| Paper-thin walls | already landed (`bd3a241`) |
| 301 has no door | already landed (`bd3a241`) |
| Ceiling lamps | already landed (`28b521d`) |
| Move `[E]` spots out of `crosstown.ts` | **`0e2e29f`** |
| Furnish room 301 | **`1ce9cf5`** |

The first four were committed just before the desk wrote the queue file, so it
never saw them. I re-verified each against the working tree rather than
trusting the log, because the `citizenAtlas` options-object migration landed
underneath them and `OWNERSHIP.md` records that a builder "lost a feature
(`grime`) to the resolution" — that was this hermit. **It survived.** The
desk's migration kept `grime` and added `cut: 'long'` and `build: 1` on top.

**My queue is empty.**

---

## The next item exists but is NOT in my queue, and should wait

`notes/interior-audit.md` finding 5 (medium) names `ct/apartment.ts`. It is
the reconciliation I flagged twice and it is now unblocked — `ct/interior.ts`
and `ct/int-diner.ts` exist. It is **not** in `C-entrance.md`, so I have not
taken it. Measured against my own source rather than quoting the audit:

| | apartment | kit |
|---|---|---|
| structural wall | `WALL_T = 0.14` | `0.18` |
| floor density | `repeat(w/1.8)` on 64 px → **35.6 px/m** | `repeat(round(W/1.6))` on 32 px → **18.6–20** |

So the genuine mismatch is two numbers: **0.14 → 0.18** and a floor roughly
**2 : 1** too fine. The audit's "eight different wall thicknesses" also counts
the casing trim (0.028), the door leaves (0.045) and the stair core (0.12) —
those are not walls and should stay different; a door leaf is not a partition.

**It should not start yet.** Audit findings 1 and 2 are *high* against the kit
itself: its floor and walls disagree 1.55 : 1 inside every room, and its floor
density swings ±33 % with room size because `round(W/1.6)` rounds the intent
away. Harmonising 301 to 18.6 today means redoing it when F fixes those, since
fixing them necessarily changes the number I would match. **Order: F fixes kit
findings 1 and 2, then C reconciles the apartment.**

Also: finding 5 spans `ct/bodega.ts` and `ct/apartment.ts`, which are two
different owners. It needs splitting before it can be queued to either.

## Three things the desk should know

### 1. The hermit is unshaven-less, and I did not fix it

The queue asks for "unshaven". The desk's rewrite of the `grime` block covers
the collar, the pits and the food stains down the front, but the stubble that
was in the original is gone. It is a five-line addition inside the existing
`if (grime > 0)` block in `ct/citizens.ts`:

```
g.fillStyle = `rgba(58,44,34,${0.34 * grime})`;
g.fillRect(cx - 5, oy + 15, 10, 5);      // days unshaven, under the hair
```

I did **not** make that edit. `ct/citizens.ts` is `DESK` in `OWNERSHIP.md`,
and that file is emphatic that a non-owner drive-by on a shared leaf module is
what caused three separate merge conflicts and lost this exact feature once
already. Doing it again to fix the damage from the last time would be a
strange choice. Please route it to whoever owns `citizens.ts`.

### 2. `ct/interior.ts` and `ct/int-diner.ts` do not exist

The 301 item says to read the shared kit and the reference interior and match
their conventions. Neither is on any branch — builder F has not landed them,
so there was nothing to read.

I built 301 against the **walk-up's** conventions instead, which is the more
relevant reference for a room inside the walk-up and which 301 already shared
by construction: 0.14 m walls with jamb reveals and casing, the 2.55 m
ceiling, and now the same flush-mount fixture as the landing outside its door.
If F's kit lands with different conventions, **301 is the room to reconcile**.

### 3. "You can already sleep here" is not true

The 301 item says the furnishing must not block the bed interaction. There is
no bed interaction: no sleep spot exists in any module — I grepped every one.
Nothing to block, so nothing was avoided; the bed is left clear and
approachable anyway. If sleeping is meant to exist, it is unbuilt.

---

## What the two new commits did

### `0e2e29f` — the `[E]` spots move into this module

Both spots the walk-up owns are registered through `ctx.spot` from inside
`ct/apartment.ts` and deleted from the `SPOTS.push` block. The entry point no
longer knows what they are.

`ownership.sh` flags `crosstown.ts` as out of bounds for C on this commit.
That is expected rather than ignored: the queue item explicitly says to delete
them from that block, and it is a pure deletion of this module's own two
entries — no signature and no behaviour change to shared code.

Two long-standing bugs lived inside those spots and became this module's to
fix the moment they moved:

- **The prompt said `enter THE WHITMORE`.** The building has had no name since
  the nameplate came off; the gold 227 on the transom is its only
  identification. This was the last place the dead name was on screen, in the
  string the player reads at the door. It says `enter No. 227` now.
- **The lobby exit did not work.** It dropped you at `FACE - 1.1`, 0.65 m from
  the enter spot's 1.05 m radius — you landed *inside* the trigger and one
  held E ping-ponged you back into the lobby. Reported for several rounds as
  pre-existing. It lands at `FACE - 1.8` now, 1.35 m clear, which is the same
  fix the bodega exit already carries.

Verified by pressing E, not by warping: `doortest.mjs` passes all three legs,
and standing where the exit drops you there is now no prompt at all and
pressing E again keeps you outside.

### `1ce9cf5` — 301 furnished

A specific person's room. Frame and mattress that were never bought for each
other (the mattress is 6 cm narrower and shoved to one end so it overhangs at
the foot), the blanket thrown back in a heap, a dresser whose middle drawer has
never shut, a portable TV on a milk crate because there is no table, a
cast-iron radiator under the window, a poster, a full ashtray, yesterday's
clothes over a chair.

**The window now agrees with where the building stands.** No. 227 is on the
east side of the street with its face turned west, so from the third floor you
see the far pavement, the facades opposite and — almost straight ahead — the
mouth of the alley. One window lit, because somebody else is up late.

**Circulation:** furniture is against the north and south walls and the middle
is clear. The band z 2.80 → 4.40 is open the full width — 1.60 m against a rig
that needs 0.72. Walked a 6 × 12 grid of the whole floor: level everywhere,
biggest step 0.000.

Three bugs caught while shooting it, all the same shape — a textured face
pointing at the wall it stands against. The radiator wore its ribs on its two
little end caps instead of its long faces; the TV screen and the dresser
drawer fronts both faced into the north wall.

---

## Standing checks

`npm run build` clean · `npm run sweep` 48 shots, no page errors ·
`node scripts/health.mjs` OK · `scripts/verify.mjs` passing ·
`scripts/doortest.mjs` all three legs.

Shots: `shots/interior-301/r301-*.png` (10 angles of the room),
`shots/interior-walls/`, `shots/interior-cellar/`, `shots/interior-rail/`.
`scripts/interior.mjs` is mine — 58 interior angles.

## Note on the port

The queue header says port 4180. **4180 is held by a stale `vite preview` from
a different repo** (`/home/erick/projects/rpg`), which silently served me the
wrong world until I caught it. I run on **4190 with `--strictPort`** so it
fails loudly instead of drifting. Worth correcting in the queue file or
killing the squatter.

## `fpdiff` false positives — worth a flag on the script

Any change that adds a texture shifts the seeded `Math.random()` stream, so
every texture created afterwards gets different dither grain. An entrance
change of mine reported 68 structure diffs when the real count was 6 removed /
4 added. Strip `/\d+x\d+:[0-9a-f]+/` from the structure signatures and re-diff
as multisets. Worth folding into `scripts/fpdiff.mjs` as a `--geom` flag.
