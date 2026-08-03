# Item 280 — SHIPPED. The seat that eats the legs gets an offset; the table that hides them does not

Worker **onehundredthirteen**, 2026-08-03. Port **4690**, built bundle
(`ss -ltn` clean before binding, `--strictPort`). Commits `03cd655d1`,
`2d67a99cb`, `d0af03ce5`.

The user: *"people sitting still looks bad because they have no legs??"*

I start from `notes/onehundredeight-item272-scoping.md` and
`notes/onehundredeleven-item280-seated-legs.md`. Their diagnosis is right and I
did not re-litigate it: the flag is set, the sitter is not too high, **the seat
eats the legs**, and no redraw fixes a billboard standing inside a box.

**Their prescription is wrong, and 14 photographs say so.** That is the finding.

---

## 1. THE ROW'S FIX, APPLIED GLOBALLY, WOULD HAVE REGRESSED FOUR ROOMS

The row and both scoping notes describe one `SEAT_FWD` applied to every seated
sprite in `citizenSprite`. I photographed all 14 seated figures from a normal
standing vantage before touching anything, and **six of them are occluded by a
DESK, a TABLE or a SLOT MACHINE, not by their seat**:

| figure | occluder | verdict |
|---|---|---|
| bank loan officer (444.4) | his desk | **correct as-is** |
| library readers ×3 (1074, 1078, 1083) | the reading table | **correct as-is** |
| church pew sitter (676.6) | the pew back in front | **correct as-is** |
| casino slot players ×4 (870–879) | the slot machine | **correct as-is** |

A blanket offset drives every one of those torsos *into* the furniture they are
sitting at. That is the *"fixes the diner and floats the church"* regression the
row warned about — the mechanism is not floating, it is that **hiding a seated
person's legs behind a table is what sitting at a table looks like.**

So `seatFwd` is **opt-in**, and only the rooms where the SEAT ITSELF is the
occluder pass one.

## 2. AND ONE VALUE COULD NOT HAVE SERVED ANYWAY

`scripts/probes/w113-280-seat-census.mjs` derives, per sitter, the distance
forward along its own facing to the edge of the box it sits on. Measured off the
built world:

```
fwdToEdge   min 0.115   max 0.920   over the 8 sitters whose seat is a box
```

An eightfold spread. `SEAT_FWD = 0.30` would have left the diner 2.5 cm short,
overshot the casino bench by 18 cm and left the jail bunk 62 cm inside a
mattress. **Every adopted value is now derived from the constant its own room
already owns** (BUILDER-BRIEF §8), and they all express one rule: *put the hip on
the front lip of the seat, measured along the way the sitter faces.*

| room | expression | metres |
|---|---|---|
| diner, both booths | `BENCH_W / 2` | 0.275 |
| jail lobby bench | `BENCH_D / 2` (hoisted from a literal `0.42`) | 0.210 |
| jail bunk | `occupiedCell.bunkL / 2` | 0.960 |
| casino lounge bench | `BENCH_D / 2 - SIT_OFF` | 0.115 |

The casino's 0.115 agrees with the world census to the millimetre, which is the
check that the constant and the geometry have not drifted apart.

## 3. THE PREVIOUS CENSUS MISSED SIX SITTERS

`notes/onehundredeleven-…` reports **eight** seated figures across five rooms.
**There are fourteen**, and the missing six include *the diner's two* — the room
the user photographed. My census filters on nothing at all; a census is an
AUTHORING question and `visible` is a rendering fact (GOTCHAS 79/79b).

## 4. WHAT I CHANGED

- **`ct/citizens.ts`** — `citizenSprite` takes `seatFwd?: number`, applied in
  `update()` from a `base` captured once. Cannot accumulate: every frame writes
  `base + offset`.
- **`ct/interior.ts`** — `room.person` takes `seatFwd` and forwards it.
- **`ct/int-diner.ts`, `ct/int-jail.ts`, `ct/int-casino.ts`** — the four
  adoptions above. `int-casino.ts`'s `sitter()` bypasses the kit, so `seatFwd` is
  the fourth thing it passes by hand; its own comment already lists the other
  three.
- Untouched on purpose: `int-bank.ts`, `int-library.ts`, `int-church.ts`.

**Files I edited that the item does not name: `ct/int-jail.ts` and
`ct/int-casino.ts`** (BUILDER-BRIEF §9). The row authorises "(b) … walk EVERY
room that calls it"; these are two of those rooms, and without them the jail's
two figures — the worst in the world — stay broken.

## 5. VERIFICATION

**Both signs, on the same 14 figures.** 5 moved by exactly their declared offset;
**9 moved by exactly 0.000 m**. A check that only proves motion cannot catch an
offset leaking into the rooms that must not have one.

**Item 93 holds.** The 219-entry seat-offer vector is **byte-identical** before
and after (`shots/w113-280-census-{before,after}.json`).

**The row's casino figures are STALE.** It states 87 registered / 83 offered / 4
suppressed. Measured from *inside* the room — which is the only place the
casino's `room.inside() && !seatTaken(...)` can be read at all — it is
**123 / 111 / 12**, identical on both builds, coordinate for coordinate. The
church's 18/17/1 is correct and was reproduced exactly; the church is the easy
one because its seats carry no `inside()` term.

**The negative case, which passed twice before it failed.**

```
attempt 1  += sin(facing)*seatFwd right after citizenSprite()   PASSED  (useless)
attempt 2  the same line, hard 0.5 m, same place                PASSED  (useless)
attempt 3  0.5 m between put() and claimSeat()                  FAILED  exit 1
```

The first two were erased by `put()`, which sets position absolutely on the next
line — **a mutation upstream of an absolute write tests nothing**, and it looked
exactly like a green check. Attempt 3 dropped the lounge seat out of the
suppressed set, 12 → 11.

**Which corrects the scoping note's headline.** At the sizes actually shipped, a
BUILD-time offset would also have been safe: the casino's is 0.115 m against
`seatTaken`'s 0.30 m tolerance, and the diner registers its booths with
`ok: room.inside` and **never consults `seatTaken` at all**. The 2.5 cm margin
that stopped worker onehundredeleven is real arithmetic about a room that does
not use the mechanism. The `update()`-time ordering is **defensive for the next
adopter**, not load-bearing today — it starts mattering at 0.30 m.

**Sat on all 33 affected seats: 33/33 sit, 33/33 stand back up** (BUILDER-BRIEF
§11). `scripts/seats-walk.mjs` full run: **104/219 pass, 115 fail — byte-identical
to the documented baseline** in `notes/ninetysix-item255-seats-walk-artifact.md`.

`npm run sweep` and `node scripts/bugsweep.mjs`: **0 STATION MISS, 0 COVERAGE**,
96 shots, no new console errors. `npx tsc --noEmit` clean. Five runs of the
item-93 check: 123/111/12 every time, **zero spread**.

## 6. MY OWN VERDICT ON THE AFTER-IMAGES

I looked at all 14 pairs.

- **Diner** (`shots/w113-280-{before,after}-02-x761.png`) — the user's own room.
  Before: two torsos cut dead level with the red vinyl. After: **both have legs
  and both have feet on the floor.** This one is decisive.
- **Casino lounge** (`…-08-x879.png`) — trousers and shoes now clear the bench
  front. Good.
- **Jail lobby bench** (`…-09-x994.png`) — the slat used to pass through the
  middle of her legs, shins in front and thighs behind. Now whole.
- **Jail bunk** (`shots/w113-280-bunk-{before2,after3}.png`) — was the worst
  figure in the world, a torso floating on a blanket. Now sits at the foot with
  his legs down. **I first shipped `BUNK_L/2 - 0.26` and the photograph refused
  it**: 26 cm short of the lip leaves the bunk's own end face between him and the
  corridor, which is the only place a player can stand, so the offset bought
  nothing. Corrected to the full half-length in `2d67a99cb`.
- **Bank and library** (`…-00-x444.png`, `…-11-x1074.png`) — unchanged, as
  intended.

**Note the 14-camera after set frames the bunk badly** (`…-after-10-x995.png`):
that camera stands 1.8 m from each sitter's ORIGINAL spot, and he moves 0.96 m
toward it, so he is cropped. `w113-280-bunk-look.mjs` is the one to look at.

## 7. WHAT I FOUND AND DID NOT FIX

1. **The row's casino item-93 figures (87/83/4) are stale** — the world reads
   123/111/12. Worth correcting wherever else that pair is quoted.
2. **The casino's own cell of the census shows 7 suppressed seats at x 887–889**
   (blackjack and table games) that no sitter occupies. They are suppressed for
   some other reason; I did not chase it, and it is unrelated to this item.
3. **`scripts/probes/w111-280-fixed-camera.mjs`'s diner warp still does not
   land.** I did not use it — mine anchors elsewhere — so I left it alone.
4. **The church pew sitter reads head-and-shoulders over the pew in front.** I
   judged that correct and deliberately passed no offset. If the user disagrees,
   the fix is *not* `seatFwd` — it would push him into the next pew — it is the
   pew back's height.

## 8. INSTRUMENTS LEFT BEHIND

- `scripts/probes/w113-280-seat-census.mjs` — all 14 sitters, no filters, plus
  the derived per-seat `fwdToEdge`. Writes a JSON dump for diffing.
- `scripts/probes/w113-280-shoot-sitters.mjs` — 14 fixed cameras, cached to
  `shots/w113-280-cams.json` so before and after are the same vantage.
  **Its first run shot 14 frames of empty room**: this world's forward is
  `(sin y, 0, -cos y)`, so aiming at a target needs `atan2(dx, -dz)`, and
  `atan2(dx, dz)` turns the camera exactly 180°.
- `scripts/probes/w113-280-item93-inside.mjs` — the seat-suppression assertion,
  from inside the casino, against a measured baseline. Carries the negative case.
- `scripts/probes/w113-280-sit-affected.mjs` — sits on and stands up from all 33
  seats near a moved sitter.
- `scripts/probes/w113-280-bunk-look.mjs` — the bunk, framed to hold him whole.
  `CAM_D`/`CAM_DZ` because the cell door's bars will otherwise run straight down
  the figure.
