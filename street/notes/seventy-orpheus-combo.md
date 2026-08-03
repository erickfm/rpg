# seventy — item 196, the Orpheus hotel-and-casino combo

> *"make it a combo orpheus hotel and casino. connect them internally and
> outside. i should be able to walk from one into the other."*
> — the user, 2026-08-02 (`FEATURE-REQUESTS.md:2974`)

**Built and walked.** Port **4260** (dev) and **4261** (`vite preview`, built
bundle). Everything below was measured on 4261 unless it says otherwise.

---

## 1. Inside: it is a real doorway, not an [E] that jumps you

Worker sixtythree handed 176 back having proved the two rooms were **229 m of
dead ground apart** with the church and the diner parked between them, and
recommended dressing an `[E]` teleport up as an interior door. **The desk
overruled that and asked for the rooms to be moved. The desk was right and it
was cheaper than either of us expected** — but not the way the row described it,
because *adjacent slabs are not adjacent rooms*: an 11 m room centred in an 80 m
slab still leaves **69 m** to its neighbour.

So `ct/interior.ts` gained one concept, `PARTY`, declared once for the pair:

1. **`beltOrder()`** lifts the east room out of the path sort and re-inserts it
   directly after its partner, so the two take **consecutive slabs**.
2. Each is **shoved to the shared slab boundary** instead of sitting centred,
   leaving exactly `WALL_T` — so their flank walls meet back to back and the
   party wall is one **0.36 m** thickness standing *on* the boundary. That
   detail is load-bearing: `interiorGround` dispatches on the slab a point falls
   in, so with the seam buried in the masonry each room answers for its own
   floor right up to the wall.
3. One opening is cut through **both** flanks — mesh runs, header, jambs, head
   trim and colliders, all from the same numbers.

**It is a PAIRING, not a per-room setting, on purpose.** An opening is a single
fact shared by two rooms; authored once in each file it is BUILDER-BRIEF §8's
two-authorings defect, and the failure mode is a hole in one room facing solid
plaster in the other. `int-casino.ts` and `int-hotel.ts` say nothing about it
and cannot disagree.

### the numbers

```
before   hotel cx 920      casino cx 680     walls 229.0 m apart
after    hotel cx 874.32   casino cx 885.68  walls   0.36 m apart
```

`hotel` west of `casino` is **not arbitrary.** On the pavement the casino wing
runs x 45.45…57.00 and the hotel 33.45…45.45, so facing the property the casino
is on your **left** — and a room is its facade seen from behind (`localOf`'s
mirror), so what is on your left outside is on your right inside. Get this
backwards and it is invisible in a screenshot and wrong in exactly the way the
user has complained about four times.

`at: -9.0` is **measured, not chosen.**
`scripts/probes/w70-party-wall-clearance.mjs` projects every collider within
1.6 m of each flank onto z and intersects the gaps:

```
casino west flank   CLEAR z -18.00 .. -4.85   (13.15 m)   + five 1-2 m slivers
hotel  east flank   CLEAR z -13.00 ..  1.35   (14.35 m)   + two
CLEAR IN BOTH       -13.00 .. -4.85 (8.15 m)  <- the only run that takes a door
                                                 and a 2 m lane either side
```

−9.0 is its middle. A 2.6 m opening leaves 2.7 m and 2.1 m of clear wall.

Only **church, diner, hotel and casino** change slab. The church is the control:
it moved 760 → 680 and is **25/25** on `G-rooms-walk`.

---

## 2. Outside: one canopy, and the name

Two adjacent buildings read as one establishment when something crosses the
party line **at eye level**. Signs do not do it — both of these already had
signs and both still read as separate addresses in every shot I took.

So the porte-cochère (7.8 m over the hotel door) and the marquee (6.0 m over the
casino door) are now **joined by three link runs at the porte-cochère's own
section**, from the same hoisted constants:

```
33.45 ─ link ─ 35.61 ── PORTE-COCHÈRE ── 43.41 ─ link ─ 48.29 ── MARQUEE ── 54.29 ─ link ─ 57.00
```

One unbroken 23.55 m soffit, one bulb run on one chase, one continuous spill on
the pavement. The marquee is 0.6 m lower and 0.57 m taller than the canopy so it
stands *through* the run, which is what a real entrance marquee does — **nothing
existing had to move.**

**No collider.** The soffit is at 4.30 m against a 1.62 m eye, and nothing this
adds touches the ground, so the walking lane the porte-cochère's own columns
were carefully sized around is untouched.

The fascia is now the **property's** painter rather than the hotel's. Its old
grey-green was deliberate — *"the older building still pretending to be
respectable"* — and that reasoning held while these were two addresses. It is
painted at a **declared 24 px/m with the canvas derived per run**
(BUILDER-BRIEF §7b): the old fixed 112 × 14 canvas reused for a 2.16 m run would
have drawn its sockets at 52 px/m beside the porte-cochère's 14.

### copy

| where | was | is |
|---|---|---|
| casino elevation, category line | `CASINO` | `ORPHEUS` |
| casino elevation, name board | `SEVENS` | `CASINO` |
| rooftop pylon (skyline mark) | `SEVENS` / `OPEN ALL NITE` | `ORPHEUS` / `HOTEL & CASINO` |
| the street `[E]` prompt | `into SEVENS` | `into the ORPHEUS CASINO` |

`HOTEL ORPHEUS` does not fit the category line and that is **arithmetic, not
taste**: 92 texels for 11.55 m, a `W*0.66` tracked span, 13 letters at a
5.1-texel pitch under a 6-texel glyph. HOTEL is carried by the hotel wing's own
bulb fascia and by the pylon, which are the two places it can be read.

The pylon change is **text only** — item 121 owns that sign's geometry and a
rename must not pre-empt it.

**`SEVENS` stays** as the `ct/street.ts` roster key, the `vice.VICE` member, the
`VICE_DOOR_X` key and `int-casino.ts`'s `building:`. Renaming those is the
break-dressed-as-a-rename worker sixtythree warned about: `placeShell` dispatches
on `nm`, and a miss rebuilds the casino as a generic shopfront with no sign.

---

## 3. Proof

`SHOT_URL=http://localhost:4261/ node scripts/probes/w70-orpheus-walk.mjs`
— **12/12, exit 0**, against `vite preview` (GOTCHAS 28), after merging mainline.

```
hotel -> casino: walked through the opening            rest x 885.84
casino -> hotel: walked back through it                rest x 874.20
hotel: the party wall is solid 3.3 m off the opening   stopped 879.42, wall 879.82
casino: solid from its side too                        stopped 880.56, west face 880.18
the opening passes a body -0.9 m off its centreline    rest x 886.05
the opening passes a body +0.9 m off its centreline    rest x 886.07
hotel / casino: exactly one 'out to the street' live, and it is this room's
HOTEL ORPHEUS: [E] on the pavement puts you INSIDE     landed 874.32, 11.85
HOTEL ORPHEUS: [E] inside puts you back on the street  landed  41.56, -97.25
SEVENS:        [E] on the pavement puts you INSIDE     landed 885.68, 16.85
SEVENS:        [E] inside puts you back on the street  landed  53.34, -97.25
```

**Watched red twice**, because a check nobody has seen fail is a check you will
argue with (GOTCHAS 27):

- opening moved to z −14 → 4/8;
- the flank collider forced solid → 4/8, on exactly the traverse legs.

**And the first version of it passed a mutation it should have failed** — worth
more than the green run. At z −14 the kit *correctly* refused to cut the opening
(past the hotel's own back wall) and built the flank solid, and the probe still
walked "through", because z −14 is dead ground *behind* the room where there is
no wall to stop anyone. The walk was real; it was not in the rooms. Every leg now
asserts the traverse stays inside both rooms' depth.

Other evidence, all on the built bundle after the mainline merge:

| | |
|---|---|
| `scripts/health.mjs` | `WORLD OK`, exit 0 |
| `npm run sweep` / `bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, 0 console errors |
| `L-blackjack-reachable.mjs` | **ALL CHECKS PASS** — deal, stand, chips, negative controls |
| `L-slots-inworld.mjs` | pass (see flake below) |
| `G-vice-walk.mjs` | 17/18 (see §4) |
| `w70-orpheus-frontage.mjs` | **23.55**, exit 0 |
| typecheck | clean |

Shots, which I have looked at: `shots/w70-pavement-day.png`,
`w70-pavement-night.png`, `w70-pavement-close.png`, `w70-pavement-along.png`,
`w70-doorway-from-hotel.png`, `w70-doorway-in.png`,
`w70-doorway-from-casino.png`. My own verdict: by day the canopy and its socket
run carry the eye straight across the seam and it reads as one address; at night
the two wings burn together on one chase. From the hotel lobby the opening shows
the casino floor and its rail through a gold-trimmed reveal; from the casino it
shows the hotel's deep red and a pendant. The one thing still saying "two
buildings" is the shopfront glazing below the canopy — brown on the casino,
grey-cream on the hotel — which I left, because a hotel wing and a gaming wing
being different at street level is true of the real thing.

---

## 4. What I found and did NOT fix

**1. Two harnesses locate a room by the slab formula.** Now GOTCHAS 83, with the
isolation runs. `interiors-walk.mjs:676` and `G-rooms-walk.mjs:424` both compute
`400 + floor((x-400)/80)*80 + 40` and get the hotel 34.32 m wrong. One line each
— read the `cx` that `roomDims()` already publishes and that both files already
fetch. **Not done: `interiors-walk.mjs` is held by item 192, and
`G-rooms-walk.mjs` is outside this item (BUILDER-BRIEF §9).**

```
G-rooms-walk   party wall OFF   113/114     party wall ON   62/65
interiors-walk hotel 17/29   casino 13/29   church (moved slab, centred) 25/25
```

**2. Three harnesses identify the casino by the string `SEVENS` in its [E]
label**, so the rename costs three legs. Every one of them reports the prompt is
up and E works:

```
scripts/G-vice-walk.mjs:353       ['SEVENS', SVN.px, /SEVENS/]      17/18
scripts/G-rooms-walk.mjs:30       label: /SEVENS/                    2 legs
scripts/interiors-walk.mjs:197    label: /SEVENS/                    (held by 192)
scripts/casinodoor.mjs:29,36      /SEVENS/i — unregistered, exits 0 whatever it finds
```

**I kept the rename deliberately.** The row says *"Orpheus wins the name; SEVENS
becomes the casino wing"*, and a prompt naming an address that no longer appears
on the elevation above it is the facade/interior contradiction the user has
raised four times. Reverting it to keep three regexes green would be fixing the
world to suit the check (BUILDER-BRIEF §7). One line each.

**3. `ct/apartment.ts:2638` still advertises the old name** — a matchbook in room
301 reading `['SEVENS', 'FREE BUFFET', 'MUST BE 21']`. Outside this item; it
wants to say ORPHEUS.

**4. `L-slots-inworld.mjs` is FLAKY, same family as item 192.** The leg *"the
reels are actually turning on the world's own clock"* measured **0.5 stops in
220 ms** on one run and **1.4 stops** on the next, unchanged source, and 0.5
fails the threshold. Nothing in this item touches slots or timing.

**5. `[interior:hotel] NO BUILDING NAME` is unchanged** — inherited, item 194,
prints on every bugsweep, and it is the single pre-existing red in the 113/114
baseline.

**6. `casinodoor.mjs` cannot fail** — it prints `SEVENS spots registered: 0` and
exits 0 regardless. Same family as GOTCHAS 65.
