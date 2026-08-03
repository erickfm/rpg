# w60 — item 153, the jail door's two faces

**Port used: 4184.** Built bundle, sha-matched by `bugsweep.mjs`'s world guard.

## The decision the item asked me to make, stated

**Keep the jail's interior leaves ajar. Do not close them, and do not open the
street pair.** Nothing in `ct/int-jail.ts` changed.

Because **the mismatch is not the jail's.** Every interior front door in
CROSSTOWN that has been given its own leaves hangs them ajar while its street
face is shut:

| room | interior leaves | |
|---|---|---|
| bank | `leafPair(… 0.55 …)` | `int-bank.ts:244` |
| casino | `leafPair(… 0.55 …)` | `int-casino.ts:382` |
| **jail** | `OPEN = 0.55` | `int-jail.ts:318` |
| hotel | `OPEN = 0.50` | `int-hotel.ts:264` |
| library | `OPEN = 0.85` "matching the kit" | `int-library.ts:736` |

`int-jail.ts:318`'s own comment already says the 0.55 is *"the casino's and the
bank's"* — it was copied deliberately, from a convention, not invented here.

So closing the jail's alone would make **the jail the only building in the world
whose inside door is shut** — which is the opposite of the consistency the user
has asked for three times. And opening the street pair means editing
`ct/jail.ts`, which this item does not name, to contradict a detail the item
itself calls meaningful (*"a jail's street doors being shut is meaningful"*).
Either way the real question is world-wide and belongs to the user:

> **Should every building's interior front door be shut, matching its street
> face — or is a door standing open the intended "this is the way you came in"?**
> It is one line in five files, and it is his call, not mine.

## The item's stated risk is void

> *"the exterior fix moved the whole assembly forward by one leaf thickness off
> a new `LEAF_FRONT`, and the interior must not now collide with it."*

It cannot. **The interior is 565 m from the exterior.** The street pair stands at
`x 61.5, z −103`; the interior pair at `x 999.3 / 1000.7, z 12.6`. They are
different places, and the world's region cull removes the exterior from the
scene entirely while you are inside — measured, 7 jail-textured meshes in scene
on the pavement, 5 once through the door. Nothing w59 did to `ct/jail.ts` can
reach `ct/int-jail.ts`.

## The interior face, photographed — the part that was NOT cleared

The previous attempt could not frame it; its camera landed inside a wall. It is
framed now, and the camera position is not computed: the world is asked for the
way in, `[E]` is pressed, and **the press is proved by watching the player move
946 m**. Whatever the door spot hands you is by construction somewhere a player
can stand; the camera then turns around on the spot.

`shots/w60-jail-inside-{atdoor,back2m,back4m}.png`, at 0.7 m, 2.7 m and 4.7 m.

**My verdict on them:** the interior pair is *good*, and it matches. Two
pressed-panel steel leaves with kick plates and pull handles, hinged at the
outer edges and swung into the lobby, against green tile wainscot — visibly the
same door as the street face, which is exactly what item 105 set out to do. The
"one flat blue-grey slab with a single 3-pixel handle" the user complained about
is gone.

**State and appearance, measured:**

- appearance: **agrees.** Both faces are the same `24 × 64` `jailLeafTex()` — one
  memoised `THREE.Texture`, not a copy — and both are 2 leaves.
- state: **differs.** Exterior yaw `0°` (shut), interior yaw `±31.5°` (ajar).
  That is the whole of the disagreement, and it is the world-wide one above.

## Things the item suspected that are NOT true

- **The kit's generic leaf is correctly hidden.** `int-jail.ts` finds it by its
  `32 × 64` canvas and sets `visible = false`; I confirmed the mesh is present
  and hidden, and that the file's own `[interior:jail] expected 1 kit door leaf`
  warning **did not fire**. I had suspected this was the pale slab visible
  between the ajar leaves. It is not.
- **`doormatch12` does not regress — the jail passes it.** Its jail row reads
  `2x24x64` inside, `2x24x64 …` outside, verdict **"its own door"**.

## Found and NOT fixed

- **`doormatch12.mjs` is RED on mainline: `FAIL — 4 of 12 rooms`** (burger,
  diner, tax, thrift still show the kit's generic leaf). Pre-existing, unrelated
  to the jail and to anything I touched. It **exits 1 correctly** — I checked,
  see below.
- **The interior doorway opens onto nothing.** Beyond the jambs at `z 13.09`
  there is no mesh at all, so the gap between the ajar leaves shows a flat pale
  void that reads as daylight if you are generous and as a blank slab if you are
  not. **This is only visible BECAUSE the leaves are ajar** — shut leaves would
  cover it. So it is an argument on the "close them" side of the decision above,
  and whichever way that goes, the opening wants something behind it. It is
  almost certainly true of the other four rooms too; I did not check them,
  because their files are not named by this item.
- I did not touch `ct/jail.ts`, `ct/vice.ts`, or the other four `int-*.ts`.

## A trap I fell into and the brief warned about

`node scripts/doormatch12.mjs | tail -20; echo $?` printed **`0`**, and I nearly
recorded "the check passes". **`$?` after a pipeline is `tail`'s status.** Run
properly — redirect, then read `$?` — `doormatch12` exits **1**. The check is
honest; my measurement of it was not. This is the exact failure the brief lists,
and it took me one try to walk straight into it.

Two more of my own, both caught before they reached a conclusion:

- the first cut of `w60-jail-both-faces.mjs` **pressed `E` from 3.4 m away**,
  nothing happened, the player never moved, and it filed three frames of the
  *outside* of the door as "the interior". Nothing in its output said so. It now
  refuses to continue unless the press moved the player more than 5 m.
- the same probe averaged the door's `z` over **every** mesh the leaf-texture
  signature matched — including the interior pair 1000 m away and a third door
  at `x 434` — putting its scan at `z −27` and reporting *"never found a position
  offering the way in"* about a door it had never approached. w59's note already
  warns that `24×64` is not a fingerprint for a place; this is that warning
  wearing a third hat.

## Verification

- No source change, so `npm run typecheck` and `bugsweep` results from the
  previous item stand (**0 STATION MISS, 0 COVERAGE**).
- `scripts/probes/w60-jail-both-faces.mjs` — both faces, states, separation.
- `scripts/probes/w60-jail-kitleaf.mjs` — the kit leaf is hidden; what is at the doorway.
- `scripts/probes/w60-jail-findspot.mjs` — where the world offers the way in.
- `node scripts/doormatch12.mjs` — jail "its own door"; exits 1 for four other rooms.
