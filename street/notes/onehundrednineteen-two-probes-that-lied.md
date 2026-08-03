# Item 281 — two probes that reported success without measuring, and one that photographed the wrong room

Worker onehundrednineteen, 2026-08-03. Port **4750**, built bundle.
Files changed: `scripts/probes/w105-rail-vantage.mjs`,
`scripts/probes/w85-item230-party-threshold.mjs`, `notes/GOTCHAS.md`.

**Scope cut mid-item by the desk, at the user's instruction, and I agree with the
cut.** The `interiors-walk` re-run is dropped: ~20 minutes of pure test cost over
a change already verified by direct measurement. I had started it and killed it.
The item is now the two probes plus two lines of prose.

---

## (3) `w105-rail-vantage.mjs` — it was photographing the HOTEL and captioning it "casino"

**Not fragile. Wrong, today, on this tree**, and the world says so in the probe's
own first two lines of output:

```
casino {"id":"hotel", ...}          ← it printed the hotel under the label "casino"
hotel  {"id":"casino", ...}
party  {"rooms":["hotel","casino"],"at":-9,"west":"casino","east":"hotel"}
```

The probe did `{ casino: by(pw.east), hotel: by(pw.west) }` — it **typed the
answer to the question item 268 made the world derive**. `pw.east` is the
*hotel*. So every default run stood in the hotel at x 884.38, said "Stand back in
the casino", and `SIDE=hotel` stood in the casino. Item 267 was a LOOKING item
about *"standing in the casino"*, so its frames are of the wrong room.

The camera survived by luck: the hotel's low-x face happens to be the party wall,
so `wallX = c.cx - c.w/2` landed near 880 anyway. **Under the other hand it would
have put the camera four metres inside solid masonry**, and the black-frame guard
would have caught that — but nothing was ever going to catch "right wall, wrong
room".

**Repaired rather than deleted**, because the repair is smaller than the
explanation and it is the row's literal ask ("re-point it at the published
pair"):

- the sides keep the world's own names — `east`/`west` from `party()`, never
  renamed;
- `SIDE` names a **room** and is resolved against `pw.west`/`pw.east`, so
  `SIDE=casino` stands in the casino whichever hand the world solves. **The
  default is now `casino`**, which is where the user was standing;
- the standing side, the yaw and the step-back sign are all derived from which
  side `SIDE` resolved to;
- **the party wall is taken from BOTH rooms** — the midpoint of their facing
  edges — instead of assumed to be one room's low-x face;
- every shot is named for the room it was taken in, so a frame cannot be filed
  under the wrong caption again;
- an unknown `SIDE` **exits 3** with "nothing was measured", not 0.

Measured after: `party wall at x 880.000` — against the sills
`w85-item230-party-threshold.mjs` independently finds at **879.91 / 880.09**, so
the derivation lands on the boundary to the millimetre. `SIDE=casino` stands at
**x 875.80**, inside the casino (874.32 ± 5.5). `SIDE=bodega` → **exit 3**.

New frames, and I have looked at them: `shots/w105-rail-casino-{head-on,oblique,close}-w119.png`
is the velvet rope, the gold, the casino carpet, and the party doorway dead
ahead — the user's actual vantage, for the first time.
`shots/w105-rail-hotel-*-w119.png` is the other side.

## (2) `w85-item230-party-threshold.mjs` — the 0/0 hole, closed with a population floor

The row says it exits 0 when it refuses to measure. **Running it as it stood, it
does measure** — 351/351, two sills, both walks — so the row is not describing
today. But the hole is real and is one edit away from firing:

> the headline assertion is `inDoorFloored === inDoor`, and **that is vacuously
> true when `inDoor` is 0**.

`inDoor` cannot be 0 today only because the sample bounds are typed literals. The
moment anyone derives them from the world — which is the right thing to do, and
which this probe's own sill check already does — a world with no party wall gives
`0 === 0`, prints PASS and exits 0.

So the population is now checked **first**, and a refusal exits **3** — not 0,
and not 1, because 1 is what a real hole in the threshold exits with and telling
those apart is the whole point of GOTCHAS 32.

The census now carries `tris` (horizontal triangles found) and `nearWall` (meshes
within 2 m of x 880 — the cheapest possible answer to "are these two rooms even
here"). Live: **93,451 triangles, 378 meshes at the wall, 351 sample points.**

**`--selftest` is a pure function of the census**, so it runs in milliseconds
with no second browser — §10a's "cheap and deterministic". Four refusal cases and
one acceptance, all green:

```
ok  a null census                              -> the census returned nothing at all
ok  no triangles                               -> no horizontal triangles anywhere in the world
ok  an EMPTY doorway sample — the 0/0 hole     -> ...so 0/0 would have "passed"
ok  no meshes at the party wall                -> the rooms are not in this world
ok  the REAL census is accepted                -> yes
```

**I did not touch the two walk legs.** They exist, they pass, and removing them
is a judgement call for whoever owns the doorway — but note for §10a purposes
that they are the failure-prone half of this probe (twenty 220 ms keyboard holds
each) and the census half is the deterministic one.

## The capacity lesson: `notes/GOTCHAS.md` 92

*"`interiors-walk` goes SILENT for many minutes, and that is it WORKING."* Its
kill stack (`lightLeg:1626` at `steadyAt:1612` from the room loop at `:1503`,
floor predicate already cleared) proves the silence was progress: the per-room
light legs print nothing until a leg completes. **Judge it by browser CPU, never
by output**, with the `ps` line to do that. Plus the capacity half — five
concurrent headless browsers starve one another — and the instruction to report
"could not measure" rather than a partial pass, because a 4-of-12 result reads as
coverage. `gotchas-numbers` green: 77 entries, 1…92, unique and in order.

## Verification

| | |
|---|---|
| `w105-rail-vantage.mjs` (default = casino) | **0**, wall derived at x 880.000, stood at 875.80 |
| `w105-rail-vantage.mjs SIDE=hotel` | **0**, stood at 884.20 |
| `w105-rail-vantage.mjs SIDE=bodega` | **3** — "nothing was measured, so this is not a pass" |
| `w85-item230-party-threshold.mjs` | **0**, `threshold holds`, census printed |
| `w85-item230-party-threshold.mjs --selftest` | **0**, 4 refusals caught + the real census accepted |
| `scripts/gotchas-numbers.mjs` | **0** |
| `scripts/checks-registered.mjs` | **0**, 173 registered — it scans `scripts/*.mjs` only, so a `--selftest` in `probes/` needs no registry row and adds no suite time |

No world code was changed by this item, so no rebuild, sweep or health run is
implicated — these are instruments only.

## FOUND AND NOT FIXED

1. **Item 267's frames are of the wrong room.** `shots/w105-rail-head-on-*.png`
   and its siblings were shot standing in the hotel while the item is about
   standing in the casino. The item is closed and the LOOKING verdict on it rests
   on those frames. **Worth a row**: re-open the look with
   `SIDE=casino` (now the default) and check the gold band against the user's
   actual complaint.
2. **`scripts/note-hashes.mjs` exits 1** on this tree. Pre-existing — the clean
   full suite earlier today reported it `WRONG WORLD` with *"0 commit citations
   across 2 notes"*, i.e. it finds nothing to check, which is GOTCHAS 34 in the
   guard for GOTCHAS 34. Not mine and not this item's.
3. **The two walk legs in the threshold probe** are the flaky half; see above.
4. **`interiors-walk`'s 12-room result is still an open gap** — dropped on
   purpose, not forgotten. GOTCHAS 92 records why and what it would cost.
