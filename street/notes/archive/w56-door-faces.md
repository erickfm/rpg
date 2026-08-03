# w56 — item 105: the inside door does not match the outside

Port used: **4184** (4183 was already serving another builder's world).
Verified on the **built bundle** via `npx vite preview`, not the dev server.

**Root cause, one line:** `DoorDecl.leaf` publishes a door's *colour* and
*glazing* and nothing else, so the interior kit paints a correctly-coloured
**flat slab** — no panels, no reveal, no second leaf — in buildings whose facade
has a real panelled door; and the check that was supposed to catch this
**compared nothing and exited 0**.

---

## 1. The check. The desk's premise was false, and that is the headline

The item said:

> the check compares POSITION and reports a match while the user judges
> APPEARANCE.

**It did not compare position either. It compared nothing.**

`scripts/doormatch12.mjs`, as it stood, fetched `__ct.doors()`, used exactly one
field of the result (`chamfer`), and filled its verdict column from `SOURCE` — a
hand-typed map of prose conclusions a builder reached by reading the source
weeks earlier. There was no assertion and no `process.exit` anywhere in the
file. So:

- the LEDGER's **"MEASURED 12 OF 12 MATCH"** is a count of rows *printed*,
- the check could not have gone red if every door in the world had been replaced
  by a hole,
- and it is BUILDER-BRIEF §7's *"one compared the world against its own retyped
  copy of itself"* — this was that one.

The distinction from the desk's version is load-bearing. **"It measures the
wrong axis" invites tightening the axis.** The repair needed was to make it
measure at all.

### What it asks now

> **Does this room show the kit's generic leaf, or its own building's door?**

`ct/interior.ts` gives every room the same door unless the room hangs its own:
one flat `PlaneGeometry` leaf textured from a **32×64** canvas that is a solid
fill, an optional glass rect and a 3-pixel handle. The **32×64 signature is not
a guess** — it is exactly how `ct/int-bank.ts:203-210` finds that leaf in order
to hide it, and int-casino, int-hotel, int-pawn, int-library and now int-jail do
the same.

**Exit codes: 1 fail, 0 pass, 2 unmeasurable world. Both branches proven** —
5 of 12 RED today, and a mutant with an impossible signature prints PASS and
exits 0.

### What it deliberately does NOT assert, and why

Not the exterior leaf, as pass/fail. Each reason was measured, not assumed:

1. **Ten facades paint their doors rather than build them.** The church's
   doorway — a 5.5 m pointed arch in three recessed orders with two timber
   leaves — is a canvas (`ct/civic.ts`, `DOOR_W = 5.5`). Only the jail builds
   leaves as meshes. A leaf-count assertion would false-red ten buildings.
2. **Region culling hides facades.** A scene walk from spawn finds **zero**
   exterior leaves for all twelve. The check now warps to each building's own
   published `stand` point first; without that it would have confidently
   reported a world with no doors in it. This nearly shipped as a finding.
3. **Nothing publishes what a door looks like.** `__ct.doors()` returns
   building, chamfer, point, stand, widthM — not the leaf.

The exterior column is printed as **observation**, labelled as such.

---

## 2. Current output — 5 of 12 RED

```
room       building         inside leaves            outside (observed only)   verdict
bank       FIRST FEDERAL    2x24x56 1x32x43          1x60x82                   its own door
bodega     BODEGA           2x32x31                  2x45x67 1x52x94           its own door
burger     BURGER BARN      1x32x64                  none (painted facade)     THE KIT'S GENERIC LEAF
casino     SEVENS           2x24x56                  none (painted facade)     its own door
church     ST BRIGID        1x32x64                  none (painted facade)     THE KIT'S GENERIC LEAF
diner      DINER            1x32x36 1x32x64          none (painted facade)     THE KIT'S GENERIC LEAF
hotel      HOTEL ORPHEUS    2x24x56 1x32x40 1x16x64  none (painted facade)     its own door
jail       JAIL             2x24x64                  2x24x64 2x11x60 2x32x32   its own door
library    LIBRARY          4x16x48                  none (painted facade)     its own door
pawn       PAWN             1x24x56                  none (painted facade)     its own door
tax        A-1 TAX          1x32x33 1x32x64          none (painted facade)     THE KIT'S GENERIC LEAF
thrift     THRIFT           1x32x64                  none (painted facade)     THE KIT'S GENERIC LEAF
```

The jail row is the proof of the fix: **`2x24x64` inside and `2x24x64` outside —
the same texture, because it is literally the same `THREE.Texture`.**

**This check is RED and must stay RED.** BUILDER-BRIEF §7: never fix a failing
check by loosening it until it passes. The world is wrong on five rooms.

---

## 3. The jail — fixed

`ct/jail.ts` hoists the sally-port leaf drawing into an exported
**`jailLeafTex()`**, and `ct/int-jail.ts` asks the same function for the room's
leaves.

**Memoised, and that is load-bearing twice.** The rust pass draws 90
`Math.random()` values, and `scripts/scenedump.mjs` seeds `Math.random` globally
(GOTCHAS §2): a second call would draw 90 more and repaint every dithered
texture built after it. Returning the cached texture means the room's leaf costs
**zero** new draws, and the two faces are the *same texture object* — as
single-sourced as this gets.

**Density (§7b):** 24×64 px over a leaf 1.20 m × 3.06 m → 20.0 px/m across,
20.9 px/m up. The room's leaves are `DW/2 − gap` × `DH − 0.06`, the same face
within a centimetre, so the shared canvas lands at the same density on both
sides. That is why one texture is *correct* here, not merely convenient.

The room then uses the recipe `ct/interior.ts:1343` names **for this exact
room**: hide the kit's one leaf, hang `leafPair`'s two.

**Derived vs copied:** `leafPair` builds its leaves and returns nothing, so the
pull-handle placement **copies** its leaf arithmetic (`ct/vice.ts:181-190`) with
the citation in-line. **Follow-up for the desk:** have `leafPair` return its two
meshes so that block reads them instead. That edits `ct/vice.ts`, which item 105
does not name.

### The clock — it really was on the door

Not a viewing angle, and **not parented wrongly**. It sat at `lx: 0` — which is
`door.at` — on the front wall, spanning **y 2.31…2.79 inside an opening that
runs y 0…3.06**. A disc floating in the doorway.

It **cannot** go above the head: the room is 3.3 m, the opening 3.06, leaving
0.24 m of wall for a 0.48 m clock. So it moved along the wall to `lx: -2.2`,
0.76 m clear of the reveal.

---

## 4. Verified

- **Frames from the player's own standing position**, `shots/w56/` (gitignored),
  via `scripts/probes/w56-doorframes.mjs`. Exterior points are **derived** from
  `__ct.doors()`'s own `point`/`stand` pair — the first cut typed them and shot
  the sky.
- **My verdict on the after-frames, having looked at them:** the jail's two faces
  now read as the same door — two pressed-panel steel leaves, kick plate, pull
  handles at the free edges, same colour and same panel proportions inside and
  out. The clock is clear of the reveal on open wall. The exterior is unchanged.
- `node scripts/bugsweep.mjs` — **0 STATION MISS, 0 COVERAGE**, no new console
  errors (only the pre-existing THREE.Clock and willReadFrequently warnings).
- `node scripts/w15-jail-walk.mjs` — **all legs passed**, 0 page errors. The
  leaves use `put`, not `solid`, so they carry no collider and nothing about
  walking through that door changed.
- `npx tsc --noEmit` clean.
- **`fp`/`fpdiff` NOT used, deliberately** — this change adds meshes, and
  GOTCHAS 75 / BUILDER-BRIEF §10 say that tool reports a catastrophe that is not
  there. The exterior was verified unchanged by eye against the before-frame.

---

## 5. FOUND AND NOT FIXED

### 5a. The church — the user's live report, and I could not take it

**`ct/int-church.ts` is not named by item 105**, and BUILDER-BRIEF §9 says to
stop and report rather than edit a file the item does not grant. Item **145**
(TODO, unclaimed) names that file for a different reason.

**It is worse than a missing `leaf`: the church never reaches `doorLeafFor` at
all.** Its interior leaf's base colour is `#3a2c22`, which is the
`?? 0x3a2c22` branch in `ct/interior.ts:1347` — reached only when `LEAF` is
`null`. `bName = spec.building ?? fr?.name ?? null`, and the church's
`buildRoom` spec passes **no `building`**, while a chamfer room publishes no
frontage. So `ST BRIGID`'s own `DoorDecl` is never consulted for the leaf.

Outside: a 5.5 m pointed arch, three recessed orders, two tall timber leaves
with ring handles. Inside: a **1.4 m brown domestic door with a big grey pane**
— a back door. `shots/w56/church-{inside,outside}.png`.

**The fix, for whoever takes it:**
1. add `building: 'ST BRIGID'` to the church's `buildRoom` spec — one line, and
   it makes the declaration reachable;
2. add a `leaf` to `DOOR` in `ct/int-church.ts`;
3. then the same recipe as the jail — hide the 32×64 kit leaf, hang a pair from
   the drawing `ct/civic.ts` paints the arch's leaves with.

Step 1 alone is worth queueing on its own: **any chamfer room that passes no
`building` silently loses its own door declaration**, and the check cannot tell
that apart from "declared nothing".

### 5b. Four more rooms on the same generic leaf

`burger`, `diner`, `tax`, `thrift` — all `1x32x64`. The user has not reported
these, and a plain timber leaf is arguably right for a thrift store; but they
are the same latent class and the check now names them every run.

### 5c. `scripts/interiors-walk.mjs` cannot run against a built bundle

It does `import('/src/proto/ct/doors.ts')`, which only resolves on the dev
server. Against `vite preview` it dies with `Failed to fetch dynamically
imported module`. Anything that verifies on the built bundle — which
BUILDER-BRIEF §10 requires — cannot use it.

### 5d. `scripts/lib/which-world.mjs` reports a stale build and exits 0

It printed a full **MEASURING THE WRONG WORLD** banner and the run still exited
0. Same family as the six checks found last night. Not fixed — it is nobody's
item and it is in shared `scripts/lib/`.

---

## 6. Files

| file | what |
|---|---|
| `scripts/doormatch12.mjs` | rewritten: asks the appearance question, exits 1/0/2 |
| `src/proto/ct/jail.ts` | `jailLeafTex()`, memoised; `JAIL_STEEL` |
| `src/proto/ct/int-jail.ts` | hides the kit leaf, hangs `leafPair`'s two + handles; clock moved |
| `scripts/probes/w56-doorframes.mjs` | both faces of a door, from derived stand points |
| `scripts/probes/w56-leafscan.mjs` | what the scene holds at all 12 doors — sizing up the assertion |
