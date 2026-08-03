# Item 210 — the jail's cell slots were never getting dark

Worker **seventyone**, 2026-08-02. `src/proto/ct/int-jail.ts` only.

---

## ⚠ THE ROW'S PREMISE IS FALSE IN EVERY CLAUSE — read this before the fix

The row says: *"a **diffuser** marked selfLit is being **DIMMED** at night… `selfLit`
means the night grader must not touch this… **find why the grader is reaching
this material despite the flag**… two shapes to consider: the flag may be set on
the mesh where the grader reads it off the material, or the material may be
**shared** with something that legitimately dims."*

Measured, not argued:

1. **It is not a diffuser.** It is the **daylight slot window** in the back wall
   of every cell — `int-jail.ts:748`, a 0.04 × 0.44 × 0.80 box behind four bars.
   It is a hole to the sky, not a light fitting.
2. **The grader is not reaching it.** `props.ts:977` is
   `if (Math.abs(wp.x) > 100) return;  // interiors keep their own light`, and
   this room sits at world x ≈ 1006. The probe already said so and nobody read
   it: **`userData.graded = false`** on the offending material in every run.
3. **It is not shared.** One material, one purpose, 8 instances of the same slot.
4. **It is SUPPOSED to dim.** The line directly above it has said so since it was
   written: *"It DIMS WITH THE WORLD — a bright window at two in the morning is
   the tell that a room is a set."*

So neither of the two shapes the row offered is the cause, and the answer to
*"was it the flag or a shared material"* is **neither**. The material dims
**itself**, from its own `ctx.onFrame`, on purpose.

**And the row's DONE WHEN would have shipped a bug.** *"The diffuser keeps its
colour after dark"* means: make the jail's cell windows glow white at 2 a.m.
That is precisely the defect the author guarded against, and I did not do it.

---

## The real defect is the OPPOSITE: it was not getting dark ENOUGH

```
02:00, before:  #f0f3f6  ->  #b3b7ba
```

**`#b3b7ba` is a light grey.** At two in the morning the slot was the brightest
thing in the cell — the exact "tell that a room is a set" the code was trying to
prevent. The intent was right and the value never arrived.

**The cause is the wrong night quantity.** `int-jail.ts:752` read the frame's
`night`:

| | what it is |
|---|---|
| `f.night` | the hud's raw wash curve. **`NIGHT_STOPS` (`ct/hud.ts:1225`) tops out at 0.58**, and at 02:00 sits flat on `[0, 0.58]` — it never reaches 1 |
| `scene.userData.nightFactor` | *"0 broad day … 1 fully night"*, published by `props.ts:1340` for exactly this purpose |

**It reproduces to the byte.** The old formula was
`setRGB(0.87 - 0.72 * night, …)`; at `night = 0.58` that is **0.4524 linear**,
which is **sRGB 0xb3** — the measured value. The slot only ever travelled **58%
of the way** to the darkness the code already asked for.

**`ct/int-library.ts:677-686` documents this exact trap**, having paid for it:
*"READ `scene.userData.nightFactor`, NOT the frame's `night`. They are two
different quantities with almost the same name — GOTCHAS §25's shape — and I
shipped the wrong one for one build."* Its daylight panel is the precedent this
now follows. **The library's warning was written down and the jail was written
against the wrong one anyway** — which is worth the desk's attention, because the
note that would have prevented it existed and was in the neighbouring file.

## The change

```ts
const SLOT_DAY   = new THREE.Color(0xf0f3f6);
const SLOT_NIGHT = new THREE.Color(0x6c6f76);
ctx.onFrame(() => {
  const n = (ctx.scene.userData.nightFactor as number) ?? 0;
  slotM.color.copy(SLOT_DAY).lerp(SLOT_NIGHT, n);
});
```

**sRGB endpoints lerped, not `setRGB` arithmetic** — the library's *second*
documented trap at `:687`: `setRGB` writes a **linear** value, so hand-computed
coefficients render brighter than they read. `Color.set(hex)` converts sRGB →
working space and `lerp` runs there, so this is the same interpolation the
library does.

**The endpoints are the OLD FORMULA'S OWN, evaluated properly** — day is it at
`n = 0` (`#f0f3f6`, byte-identical to what noon already showed, so **daylight
does not move**) and night is it at `n = 1` (`#6c6f76`). **Derived from the code
that was there, not chosen by me** (BUILDER-BRIEF §8).

**`userData.selfLit` KEPT.** It is inert here — `dimWorld` never reaches this
room — but it is the standing declaration that this surface grades itself, and it
would matter a great deal on the day interiors move inside |x| < 100. Removing a
flag that is currently doing nothing, in order to satisfy a diagnosis that was
wrong anyway, is how a latent bug gets planted.

## Proof

| | before | after |
|---|---|---|
| slot at 13:20 | `#f0f3f6` | **`#f0f3f6`** (unchanged) |
| slot at 02:00 | `#b3b7ba` | **`#6c6f76`** |

- `scripts/probes/w64-jail-dimmed.mjs` (sixtyfour's, unmodified) — the room's
  other **96 materials are steady across both hours**, before and after. Only
  this one moves, and it is meant to.
- `scripts/probes/w71-jail-slot-look.mjs` — **looked at it, at night, from inside
  the jail**, which is what the row asked for. Standing in the corridor level
  with the cell: *before*, the slot is a pale panel **lighter than the wall
  around it** — it glows; *after*, it reads as a dark opening, and **the rest of
  the frame is identical**. Shots at `shots/w71-jailslot-{day,night}-y3-{before,after}.png`.
  Yaw is **swept**, not assumed — worker sixtyeight lost five routes to guessing
  that convention, so the probe shoots every quarter turn and the pick is made by
  looking.
- `npx tsc --noEmit` clean; `node scripts/health.mjs` `WORLD OK`, exit 0.

---

## ⚠ WHAT I DID NOT DO, AND IT IS THE HALF THE ROW CARES ABOUT

**The jail still reads 1 of 97 on `interiors-walk.mjs` leg 6, and it always
will, and that is correct.** The item's *"the jail reads 0 of 97 rather than 1"*
**cannot be satisfied in the world** — only by making a window ignore nightfall.

**Leg 6 is wrong about windows.** Its rule (`interiors-walk.mjs:1149-1220`) is
*"no interior material may differ in colour between noon and 02:00"*, excluding
only materials that move **within** a held hour. A surface that legitimately
tracks the world clock is steady at each hour and different between them, so it
is indistinguishable from the defect the leg is hunting.

**The library escapes it by accident, not by design.** `int-library.ts`'s
daylight panel does exactly the same thing, and leg 6 scores the library
**0 dimmed** — because the panel is parked at `hd + T + 0.55`, outside the
sampler's `|wp.z| > 8` window. Measured, not assumed:
`W64_ROOM=library …/w64-jail-dimmed.mjs` → *"75 steady materials at noon, 0
dimmed"*. The jail's slots are **inside** the room, so they are sampled. Same
pattern, opposite verdict, decided by geometry.

**`ct/int-jail.ts:752` and `ct/int-library.ts:604,709` are the only three
world-following surfaces in any interior** (`grep -rn "night" src/proto/ct/int-*.ts`),
so this is a rare pattern that the check has simply never met.

**The fix belongs in `scripts/interiors-walk.mjs`, which item 210 does not name,
so I stopped and am reporting it** (BUILDER-BRIEF §9). Nobody holds that file —
192 landed and 209 is in *three other* probes. **The change it needs:** leg 6
should judge only surfaces that claim to be room lighting, and skip those that
declare they follow the world clock. There is no flag for the latter today;
`userData.selfLit` is the nearest vocabulary and means something else. **Suggested
row: give `props.ts` a `userData.followsWorld` (or let leg 6 read
`nightFactor`-driven materials via a registry), set it on the three surfaces
above, and have leg 6 exclude them while asserting the exclusion list stays
small.** Until then the jail's 1/97 is a **known-good red** and should not be
chased again — that is the third time this material would have been investigated.

## "No other room regresses" — measured, and it turned up three more things

`interiors-walk.mjs` owns that sentence but it walks all twelve rooms through
their doors and **exceeded 25 minutes twice** on this machine, and it cannot run
against a built preview at all (item 164). So I wrote
`scripts/probes/w71-allrooms-dimmed.mjs`, which measures **exactly leg 6's
quantity** — materials steady at each held hour and different between noon and
02:00 — for every room, **against the built bundle**. It replaces one leg, not
the suite: it cannot walk a door or open a panel.

```
room        judged  dimmed
bank           148       0
bodega          66       0
burger          56       0
church          86       0
diner           66       0
hotel           58       2   <- FLAKY, see below
casino          71/68    2 then 0   <- FLAKY
jail            97       1   #f0f3f6 -> #6c6f76   (this item; by design)
library         75       0
pawn            59       0
tax             56       0
thrift         136       0
apt301         156       1   #ffffff -> #3c3c3c   <- NEW, and invisible today
```

**No room regressed.** Nothing outside the jail changed, and the jail's one entry
is the slot, deliberately.

### ⚠ 1. `interiors-walk` leg 6 is BLIND to `apt301`, and it is a one-line bug

Leg 6 and `w64-jail-dimmed.mjs` both sample `Math.abs(wp.z) > 8` — **they assume
every room sits on z = 0.** True for the twelve belt rooms; **false for
`apt301`**, which is `belt: false` at **cz −16.25, y 5.4**. Measured:

```
meshes within ±8 m of (cx, 0)   :   1
meshes within 40 m of (cx, cz)  : 440
```

So that leg has been judging **one mesh** of a patch of empty slab beside the
walk-up. GOTCHAS 79's exact shape. My probe inherited the rule by copying it,
which is how I found it; my copy now centres on the room's own `(cx, cz)`.
**Fix belongs in `scripts/interiors-walk.mjs` — not named by item 210.**

### ⚠ 2. …and with the sampler fixed, apt301 shows a REAL candidate defect

Stable across two runs: a **0.28 × 0.26 × 0.34 box at (202.15, 8.23, −17.32)**,
`userData.mod = "walkup"`, **`graded: true`, `selfLit: false`**, going
**`#ffffff` → `#3c3c3c`** — an 87% darkening. `graded: true` means `props.ts`
took it through the `register()`/lamplight path (`:792`/`:1121`), not `dimWorld`
(which skips |x| > 100 and this is at 202).

**This is the thing item 210 was supposed to be about, and it is in a different
room.** I did **not** establish whether that box is inside room 301 or on the
building outside its window — that decides whether it is a defect or correct —
and `ct/apartment.ts` is not my file. **Worth its own row, and it needs the
sampler fix first or nothing will ever see it.**

### 3. The marquee chase still beats a 4-sample filter

casino read **2 dimmed then 0** on two consecutive runs, and the hotel's 2 are a
**pair swapping in opposite directions** (`#7a6438→#fff0bc` *and*
`#fff0bc→#7a6438`, 0.42 m apart) — the signature of alternating bulbs caught at
different phases, not the night sweep. My probe samples 4 × 450 ms (1.35 s span);
`interiors-walk` uses 4 × 500 ms (1.5 s). **Item 192's flake is not fully dead —
it is only slower than the sampler.** I did not chase it; recording it because
192's own note says four samples over ~1.5 s were enough, and at 1.35 s they are
not. Anything reading my probe's hotel/casino numbers should re-run before
believing them.

## Found and not fixed

1. **The check-vs-window problem above.** Not my file. Highest value of anything
   here, because leg 6 will keep producing this false positive.
2. **`#6c6f76` is the author's number, not necessarily the right one.** A window
   showing the night sky could reasonably go much darker — the world's own sky at
   02:00 is `SKY_STOPS[0]` = `#0d1018` (`ct/hud.ts:1218`). I deliberately kept the
   author's endpoint rather than substituting my taste, and the library's method
   (derive the tint from the world surface the panel depicts) would argue for
   something nearer the sky colour. **If the user says the cells are still too
   bright at night, `#0d1018` is the number to move toward** — a one-line change
   to `SLOT_NIGHT`.
3. **The `f.night` / `nightFactor` trap has now bitten twice** in two different
   files, with a full write-up sitting in the second one. It is a GOTCHAS
   candidate in its own right — the library's comment is excellent and completely
   invisible to anyone not already reading `int-library.ts`.
