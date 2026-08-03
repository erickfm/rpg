# w57 — item 123: the ATM's real 12-key pad is the PIN pad now

*"for the atm why do we not use the number button at the bottom?"* — 2026-08-02

**Root cause, one line:** the pad's layout was twelve literals inside a closure
in `ct/bank.ts`, so `ct/atm.ts` could not hit-test the keys the player can see
and drew a second keypad on the tube instead.

Ports **4185** (dev) and **4191** (`vite preview`, the built bundle) — both were
`000` before I took them, and both are shut down.

## What changed

**New: `src/proto/ct/atm-face.ts`** — the third module, importing neither of the
other two. `ct/bank.ts:8` imports `openAtm` from `ct/atm.ts`, so publishing the
layout from `bank.ts` and importing it into `atm.ts` closes an import cycle, and
GOTCHAS §28 is that a module in a cycle is dropped **from the built bundle only**
— dev perfect, no ATM in the artifact. This is the trap the item named and it is
the reason for the file. It owns:

- the fascia's eight metrics, **hoisted out of `bank.ts`'s closure** (`M_W`,
  `M_TOP`, `D_TOP` and friends). The prose arguing for each number stays in
  `bank.ts` next to the cabinet; the declaration moved because two files now
  have to agree on it exactly.
- the twelve-key grid, as **fractions of the keypad panel** — one shape, read by
  the painter in texels and by the interface in the panel's own UV.
- `linkPadPick`, the one piece of plumbing (below).

**`ct/bank.ts`** paints the keys from `padCells()` instead of typing the grid,
and **prints digits on them**. The shelf alone is painted at **640 px/m** rather
than the fascia's 160: a key face is 72×26 mm, which at 160 is 12×4 texels, and
you cannot put a number in four rows — which is why the physical pad has never
had numbers on it. Declared where it is chosen (BUILDER-BRIEF §7b).

**`ct/atm.ts`** hit-tests those same rectangles and the drawn pad is gone. The
pad is live on **every** screen, not just PIN: `1`–`8` work the soft-key rows the
way the number row on the keyboard always has, which is how a real machine with a
numeric pad and a `1) BALANCE` menu behaves. `9`, `0`, `CLR` and `ENT` mean
nothing outside PIN and the hand cursor does not appear over them there.

### Fixed on the way past, and nothing was watching it

The old vertical pitch was typed: a 0.012 m inset plus four 0.026 m keys plus
three 0.012 m gaps asks for **0.152 m of shelf. The shelf is 0.1442 m.** So the
bottom row — `CLR 0 ENT` — ran 8 mm off the bottom edge of its own panel and was
clipped in every frame the machine has ever appeared in. `GAP_Y` is derived from
the panel now and the pad is centred on its shelf in both axes. Before/after
crops: `/tmp/w57-rows-before.png`, `/tmp/w57-rows-built.png`.

Nothing swept it because a keypad is not masonry — `scripts/masonry.mjs` only
looks at faces tagged `userData.masonry`, and these are `declareSurface(…,'sign')`.

## How the pointer reaches a physical key — and where this really belongs

**The panel framework picks exactly one mesh.** `ct/hud.ts` hangs the live canvas
on `surface.mesh()` and `crosstown.ts` raycasts that same mesh. The keypad is a
different mesh at a different rake (33.7° against the screen's 8.1°), so a
pointer over it hits nothing the framework knows about and `hot`/`click` are
never called. That is the entire reason the pad ended up drawn on the tube.

**The right fix is one field in `ct/hud.ts`'s `ScreenSurface` and one line in
`crosstown.ts`'s `pick` — a second pickable.** I did not write it: **`ct/hud.ts`
is item 143 and w58 is holding it**, and BUILDER-BRIEF §9 says do not edit a file
outside your item. So the machine extends its own reach instead:

- `screen.raycast` is overridden to answer for the shelf when the ray misses the
  tube. `Object3D.raycast` is a supported three.js seam — item 138 leans on the
  same mechanism from the other direction, to prune.
- The keypad's hit comes back as **canvas rows below the tube**, `H` to
  `H·(1+PAD_V_SCALE)` ≈ 205→275. That is a real coordinate space and not a
  sentinel: the canvas is 300 px across 0.62 m of face — 484 px/m — so the shelf
  measured in those same pixels is ~70 rows. Nothing is ever painted there.
- **The delegation is off unless the machine is focused.** A CRT that reported
  hits from a mesh 20 cm below itself would offer and occlude in the wrong place
  for every scene-wide raycast in the world (spot selection, `canSee`).

**FOLLOW-UP FOR THE DESK:** hoist this into `ScreenSurface` as
`also?: () => THREE.Object3D[]`, with `ScreenFocus.pick` returning which
pickable was hit. Then `ct/atm-face.ts` drops `linkPadPick` entirely, and the
slot machine (item 100) and the library PC get the same reach for free — both
have real buttons on meshes the framework cannot currently pick.

## Proof

**`scripts/probes/w57-pad-walk.mjs`** — drives a **real mouse** at page points
projected from each key's own place on the keypad mesh, so everything between
the glass and the machine is under test. It **exits non-zero** on failure.

23 assertions, all green **on the built bundle** (`/tmp/w57-built.txt`): all 12
keys hit-test to themselves; no pad key anywhere on the tube; four digits typed
by clicking real keys; `CLR` deletes; `ENT` accepts; `1` picks BALANCE from the
menu; no hand cursor over a dead key; Escape closes and gives the feet back; the
delegation is down whenever the panel is.

**It can fail.** With `linkPadPick`'s delegation short-circuited, 12 of the 23
go red and it exits 1 (`/tmp/w57-mut.txt`).

**It caught a bug in my own change.** I first raised the pickable flag in
`openAtm()`. `panel.open()` **declines** in two documented cases — a panel
already up, and `hud.ts`'s 500 ms `DISMISS_LOCKOUT` — so the flag leaked and the
CRT went on answering for a shelf nobody was standing at, with no close coming to
lower it. Moved to `onOpen`, and the walk now asserts the declined case.

**`fp` is valid here and it is clean** — this change adds and removes no
geometry, so GOTCHAS §75 does not bite. dist against dist, both from 4191:

```
textures   1458 vs 1458 — 2 differ   (99x23 -> 397x92: the two keypad panels)
structure  8415 vs 8415 — 2 differ   (same PlaneGeometry 0.62x0.1442; only the map)
tints      8415 vs 8415 — IDENTICAL
places     8415 vs 8415 — 4 differ   (1 cm; pigeons, the documented noise floor)
```

`bugsweep` **0 STATION MISS, 0 COVERAGE**, 96 shots. `health` OK.
`check-seethrough` clean. `K-no-panel-traps` all good (`ct-atm` included).

**Frames, which I have looked at:** `/tmp/w57-atm-pin-before.png` against
`/tmp/w57-atm-pin-built.png`, from the pose `[E]` puts you in. Verdict: the
phosphor keypad is gone, the tube shows what a 1997 tube shows, and the physical
pad reads unmistakably as a numeric keypad — the digits are crisp at this pose
and the fourth row is on the shelf for the first time. The tube is emptier than
before; it uses the same HEAD/BODY/SUB bands every other screen does, and I would
rather it match its siblings than be filled for the sake of it.

## Found and NOT fixed

1. **THE CAPTION SITS ON THE BOTTOM ROW OF KEYS.** `ct/hud.ts` puts a diegetic
   panel's caption at `bottom:7%`, which lands across `CLR 0 ENT` at y≈660 in a
   720 frame. The keys are still **clickable** through it — proven, the walk
   clicks `CLR` and `ENT` there — but not readable. w41's reservation #4 asked
   for exactly this and it is now load-bearing rather than cosmetic: *a diegetic
   panel should be able to nominate where its caption goes.* `ct/hud.ts`, w58's.
2. **`scripts/K-atm-walk.mjs` IS RED ON MAINLINE and it is STALE, not a bug.**
   It asserts `screen === 'thanks'` after TAKE CARD; commit `1ab300666` made TAKE
   CARD close the machine immediately *at the user's request* — *"take card from
   atm should immediately get us out of the menu"* — and the check was never
   updated with it. **Identical single failure on the parent build**, proven by
   rebuilding `HEAD~1` and re-running (`/tmp/w57-katm-parent.txt`). It is a
   registered check (`checks.mjs:838`), so the board is carrying a red. One line:
   the walk should expect `idle` and a closed panel. `scripts/` is not my item's
   file, so it is queued rather than taken.
3. **`spots-walk` fails 35 assertions on mainline, two of them the ATM's** —
   *"FIRST FEDERAL — use the machine" NOT ON ITS DOOR*, which it never was; it is
   a machine in a wall, not a doorway. **35 failures and the same two ATM lines
   on the parent build**, so this change moved none of it. The check's premise
   (every `[E]` is on the door it names) does not fit machines, kiosks or
   counters.
4. `ct/atm.ts` still carries the twelve `ATM_PALETTE` colours as its own literals
   (w41's reservation #3). `ct/atm-face.ts` is now exactly the module that could
   hold them, and moving them is a five-line follow-up — I left it out because it
   is not what the user asked about and it would have widened the fp diff.

## Two notes for whoever comes next

- **`./scripts/ownership.sh w57` says `src/proto/ct/bank.ts is owned by A, not
  w57`.** Ignore it. `CLAUDE.md` demotes `OWNERSHIP.md` to history in as many
  words, item 123 names `ct/bank.ts`, and the claim is what grants it. This
  script still reads the demoted file as authority and it is the exact trap that
  cost the first worker on this queue its whole wave.
- Values I derived rather than typed: `GAP_Y` (from the panel's own height),
  `PAD_V_SCALE` (from the two panels' slant lengths), the pad's cell fractions,
  and the digit size (from the key height). Values I copied: none — the eight
  fascia metrics were **moved**, not duplicated, and `bank.ts` reads them back.
