# item 121 — ALREADY SATISFIED, both halves, measured not read

Worker ninetynine, 2026-08-03. Port **4560**, built bundle, build `60f0b8caf`.
**I changed no world code.** BUILDER-BRIEF §6: a queue item is a hypothesis, and
if the world already satisfies it that is a success, not a failure.

## The user's sentence has two clauses and the row says to take both

> *"casino sign still a lil janky. maybe we get rid of the one on the side
> here? add more flair to the bulbs themselves instead?"*

The row: *"He proposes a specific trade: drop the side sign, put the effort into
the bulbs. Take the trade."* **Item 132 (`ec4753445`, "remove the SEVENS blade,
and make the bulb chase a program") already took it** — both clauses, one commit.

## Clause 1 — "get rid of the one on the side here"

`scripts/probes/w99-item121-blade-census.mjs` (new). Counts blade-shaped objects
on the vice side elevation — tall > 6 m, narrow < 2.5 m in x, standing 0.5–2.5 m
proud — and splits them by building.

```
  SEVENS  (x > 46):  0 blade(s)     <- the one the user asked to go
  ORPHEUS (x <= 46): 3 blade(s)     <- must remain; POSITIVE CONTROL
  objects topping out at the removed blade's 21.4 m: 0
```

The ORPHEUS hits are the mast at x 44.35 and its two neon faces, spanning
y 5.0…19.2 — which is `HB_Y0 = 5.0, HB_Y1 = 19.2` in `ct/vice.ts:1605`, so the
probe is reading real objects and is **not simply blind**. That control is the
point: "I found nothing" from a probe that can find nothing is worthless.

## ⚠ MY OWN PROBE'S FIRST ANSWER WAS "3 BLADES STILL STANDING ON SEVENS"

It exited 1 and it was wrong, and the row's own text is what disproved it. With
the predicate written as *proud > 0.5 m* it swept in:

```
  x 51.0 / 51.2 / 51.5   y 19.4..26.0   d 6.8..7.2   <- THE ROOFTOP BOARD
  x 45.2                 y 7..24        d 26, 22     <- wall slabs seen end-on
```

**The rooftop board is the thing the item itself names** — *"the blade is 21.4 m
and the rooftop board is 26.0 m"* — and it measures 26.0 exactly. It is 7 m deep
because its faces point along x, and `ct/vice.ts` is explicit that it **stays**:
it is what took over the long view when the blade went. Depth is what separates
a blade from a board, so the predicate is now a band, `0.5 ≤ d ≤ 2.5`, and the
rejects are **printed** so the filter is auditable rather than trusted.

The clean confirmation: **nothing on that elevation tops out at 21.4 m any more**,
the removed blade's own height.

## Clause 2 — "add more flair to the bulbs themselves instead"

`ct/vice.ts:831` answers it in the user's own words, and the answer is a chase
**program** rather than per-bulb detail — at 8 px/m a bulb is one or two texels,
so the only thing a sign at this resolution can vary is what the light *does*.
Five modes on one clock: `chase`, `alt`, `flash`, `back`, `on`, 13.2 s end to
end.

`scripts/probes/w51-chase-program.mjs` (item 132's, not mine) reads the light off
one real physical run of sockets for a full loop. Run against this build:

```
  bulbs in the world: 268
  run read: 46 sockets at y 4.42, z -98.08, x 33.64..56.81
  samples: 313 over ~17 s
  comet 173 · alt 62 · allOn 28 · allOff 13 · other 37
  comet travelled: 39 steps forward, 14 steps BACKWARD
  PASS — every mode in the program was observed on a real run of sockets
```

Exit 0, no console errors. The backward steps matter: they are the `back` mode,
which is the one thing a single-direction chase cannot fake.

## My verdict on the frame, which I looked at

`shots/item121-sevens-night.png`, shot from **the user's own station** —
`(53.6, −103.2), yaw π, pitch 0.62`, copied with a citation from
`scripts/probes/w51-frontage-without-blade.mjs:19`, whose comment for it is
literally *"his frame"*. Also `shots/item121-sevens-day.png` at 13:00.

The elevation reads as **one lit rectangle**: ORPHEUS over CASINO, 777 between
two chevrons, LOOSEST SLOTS, and the `$2 BLACKJACK 24 HRS` marquee — bulb runs
framing the name panel, the marquee and the parapet, with nothing laid across
the left third. The cyan blade at the right of frame is HOTEL ORPHEUS' own, on
its own building. This is the composition the tombstone says the blade was
standing in front of, and I agree with it.

(Instrument fault, mine, caught before it became a finding: my first guess at
where to stand put the camera **inside a wall** — this facade faces −z and I had
assumed +z. That is why the station is cited rather than invented.)

## The one thing that is NOT done, and why I did not do it

`ct/vice.ts:1163` says:

> *ITEM 121 IS STILL LIVE. It gives HOTEL ORPHEUS' blade the same leading-edge
> fix.*

**That is a builder's re-scoping, not the user's request, and I am handing it
back rather than acting on it.** The same comment concedes the case against
itself: *"ORPHEUS is a different building on a different frontage, **the user has
not commented on it***". BUILDER-BRIEF §6a — the user's quote outranks the
desk's diagnosis — and his quote is about the casino sign and its bulbs, both of
which are done.

It is a real gap: the hotel mast (`ct/vice.ts:1609`) is plain `boardM` with no
lit leading edge, while the removed SEVENS blade had one from item 97. **If the
desk wants it, it is a new row for a thing the user never asked for** — cheap,
one mesh — and it should say so in its own words rather than inherit a closed
item's number. I did not invent the work (CLAUDE.md: a builder that runs out of
queue says so and does not invent work).

## Also noticed, not fixed, not mine

`ct/vice.ts:1600` still narrates *"SEVENS burning red at 46.4 and ORPHEUS burning
cyan at 44.35, two metres apart, both running from the canopy to above the
roofline"* — describing **two** blades, in the present tense, one of which no
longer exists. It sits directly above the hotel-blade code, so it is the first
thing the next reader of that block will believe. One-line comment fix; worth a
row because this file's stale comments have already misled once today (see
`notes/ninetynine-item252-tyre-vertex.md` on the jacked car's lift).
