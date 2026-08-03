# Item 106 — the sit pose FIXED (9 of 10 benches, 0.080 m). The texture half LEFT.

**Worker eightynine, 2026-08-03.** Port 4450, built bundle `90e5a7fb0`.

The user: *"[screenshot] bench texture is off **and sitting looks
nonsensical**."* Two halves. **I fixed the sit pose and I am leaving the
texture** — §4 says exactly what I found there so it is not re-investigated
from scratch.

---

## 1. The root cause, in one line

**Both bench families registered the MIDDLE of the seat slat as the seat, not
its top face** — so the player sat inside the woodwork.

## 2. Measured before assuming — and the row told me to

The row's own header warns that the benches moved 0.55–0.67 m in item 170 and
says *"RE-CHECK THE SIT POSE AGAINST THE NEW POSITIONS before assuming the pose
is what is wrong."* Fair, and it is not what was wrong: the defect is in the
height, not the plan position, and it is independent of where the benches stand.

`probes/w89-item106-sit-on-the-bench.mjs` sits on **all ten** benches that offer
*"sit on the bench"* and reads the eye back. Before:

```
9 of 10 benches sank the player 0.080 m into the slats, identically
```

`ct/park.ts:1393` — `SEAT_Y = 0.45` is the **frame** height; the leg and the seat
rail are built off it. The slats then sit `0.055` proud of that and are `0.05`
thick, so what a person rests on is `0.45 + 0.055 + 0.025 = 0.530`, and
`ctx.seat` registered **a hand-typed `0.45` that was not even `SEAT_Y`.**

`ct/civic.ts:1021` — the same defect at **0.025 m**, from the same cause.

**This is the third occurrence of a documented family.** `ct/int-church.ts`
records a pew whose top face was 0.50 against a registered 0.54, and
`ct/int-casino.ts`'s `STOOL_TOP` comment says it in capitals: *THE SEAT IS THE
TOP FACE, NOT THE CENTRE OF THE CUSHION.* Both of those were found the same way
— by sitting down.

## 3. The fix, and the second term that only one bench needed

`SLAT_T` / `SLAT_Y` / `SEAT_TOP` are now derived **once** in each file and used
by both the slat geometry and `ctx.seat`, so the two cannot drift again.

Then one more term, and it is the interesting half. `h` is measured from the
ground under the **player** (`fp.ts:486` adds it to `sgy`), but a park bench
**group** is parked at `y0` — deliberately the *lowest* of three ground samples,
so a bench on a slope rests on the ground instead of hovering at one corner. On
flat grass those agree and the term is zero; on the park's relief they differ by
**0.034 m**. Without it, nine benches were right and the tenth was the only one
still wrong — which is exactly the shape of bug that gets called fixed.

```
before   9 of 10 wrong, worst 0.080 m
after    0 of 10 wrong (threshold 0.02 m)
```

**Residual, stated rather than hidden:** the seven flat park benches still read
**0.010 m**. That is `parkY` vs `groundPick` disagreeing by a centimetre at the
lawn edge — a different thing from this item, an order of magnitude under what
anyone could see, and I did not chase it.

## 4. THE TEXTURE HALF — what I found, and why I stopped

**Neither bench family has a texture at all.** Every part of both is a flat
colour:

- `ct/park.ts:1294-96` — `woodM`, `woodM2`, `ironM` are
  `MeshBasicMaterial({ color })`, no `map`.
- `ct/civic.ts:1005-1010` — the ends and the slats likewise, `SLAT[i % 2]`.

So the usual reading of *"texture is off"* — BUILDER-BRIEF §7b, a density wrong
for the face it lands on — **cannot be the defect here, because there is no map
to have a density.** Either he means the benches look wrong *because* they are
untextured next to a world where everything else is painted, or his screenshot
was of a bench I have not identified.

**That is a design call on his words, and it is exactly the kind the desk should
not guess at.** The row is `[DIAGNOSIS LOST]` and points at
`FEATURE-REQUESTS.md:2543`; **the screenshot is what settles it.** I did not
invent a wood grain for two bench families on my own reading of one word.

## 5. What I did not touch

- **`ct/civic.ts` and `ct/park.ts` are not named in the item's file column** —
  which is garbled, carrying item 170's warning text where the paths should be.
  The item names *"the bench (texture + the sit pose)"* and these two files are
  where every bench in the world is built. Flagging it rather than hiding it.
- **Item 88 is the same bench family** and the row says to check before both
  move it. I changed only seat *height* and the derivation of the slat constants
  — no bench moved in x or z, so item 170's 0.51 m clearance is untouched.

## 6. Inherited state

`npm run sweep`: **0 STATION MISS, 0 COVERAGE**, no console errors.
`node scripts/health.mjs`: **WORLD OK**, exit 0, build `90e5a7fb0`.
`npx tsc --noEmit`: clean. Probe: 10 of 10 sat, 0 console errors.
