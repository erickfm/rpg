# Item 96 — the hotel lobby: the mass is NAMED, the upholstery has a weave,
# and the obvious next step is one the user has forbidden

Worker ninetysix. Port **4520**, built bundle.

This row has been through three workers before me and each left it better
scoped. Read `notes/ninetyseven-item96-hotel-survey.md` first — it is the survey
and it is still correct. This adds three things: an answer to the one question
it refused to guess at, one landed fix, and **a correction to its own suggested
next step**.

---

## 1. THE MASS IS NAMED — w97's open question, closed

> *"a large untrimmed red mass fills the right ~40% of the frame [of
> `bug-hotel-far.png`] … I did not identify what that mass is and I am not going
> to guess. It is the first thing I would put an instrument on."*

Worker onehundred built that instrument (`w100-hotel-pixel-raycast.mjs`). Run
against today's world, the pixels in the right 40% of the `far` station resolve
to:

```
right-40% mid   t=11.84m  Box 0.18×3.4×26.36 @ 868.73,1.7,0
far right edge  t=10.67m  Box 0.18×3.4×26.36 @ 868.73,1.7,0
```

**It is the room's own west wall** — 0.18 m thick, 3.4 m tall and **26.36 m
long** — seen down the length of the room. Nothing is standing in the lobby; the
"untrimmed mass" is 26 m of bare plaster. That is not a defect to remove, it is
w97's corridor hypothesis showing up as a single object, and it means the two
candidate readings it offered ("the east wall seen very close, or something
standing in the room") resolve to the first.

## 2. WHAT I LANDED — the upholstery was flat colour

Of the 30 largest meshes in the lobby, **7 carried no map at all**, and the
suite and all three chairs were among them. `ct/paint.ts` already has the
argument written down, in `slabTex`'s own docstring: *"an untextured quad has no
grain for the eye to attach to and no joints to give it scale"* — recorded there
as being behind **four separate user complaints** already.

So the sofa, its back, both armchairs and the three mismatched chairs now carry
`slabTex` grain. **Every colour is unchanged** — `slabTex` fills the `base` tone
it is given, and the brief on that function is explicitly *"do not repaint
anyone's approved artwork"*. That mattered more than usual here: the chairs not
matching **is the room's thesis**, and two of those tones are things the user
asked for.

**Verified by LOOKING, because the census cannot see it.** Once a map arrives
the material's own `color` reads `#ffffff` and the tone lives inside the
texture — so `#3f5449 map=.` becoming `#ffffff map=Y` proves a texture arrived
and says nothing about whether the green survived. `shots/w96-hotel-suite.png`
and `shots/w96-hotel-chairs.png` are the proof that it did.

### Two traps, both in the source rather than in taste

- **`grain` must stay under 0.14.** Above it `slabTex` scatters **pebbles** —
  2 px stones, deliberately, because that is what separates a gravel path from a
  poured slab. I asked for 0.17 and the suite came back **covered in bright
  confetti: a velvet sofa wearing gravel.** Caught by photographing it, then
  fixed by *reading the branch* rather than nudging the number.
- **Size the sheet to the LARGEST FACE, not the top.** A backrest's top face is
  a 0.1 m sliver; sizing to that and letting it stretch across the 0.52 × 0.5
  face you actually look at is BUILDER-BRIEF §7b's *"0.2 m end caps wearing a
  9.65 m run"* with the numbers reversed.

## 3. ⚠ THE SURVEY'S SUGGESTED NEXT STEP IS ONE THE USER HAS FORBIDDEN

w97 closed with:

> *"the cheapest real improvement is almost certainly not colour — it is
> furnishing and breaking up the long axis, or shortening it."*

**`int-hotel.ts:538` records the opposite, in the user's own words:**

> *"The user called this room EERIE and asked explicitly not to fill it in:
> 'keep the sense of too much room and too few people; crowding it would destroy
> the thing they just praised'. So every one of these sits against a wall or in a
> corner. The centre of the floor stays empty on purpose, and that is a design
> decision, not an unfinished one."*

So **furnishing the lobby is the one thing this row must not do**, and the next
worker would have reached for it first — w97's note is the most recent, most
authoritative-looking thing on disk and it points straight at it. This is the
fourth time on this row that the obvious move turned out to be undoing something
the user asked for (the chairs, the carpet, the emptiness, and now the long
axis). **My change adds no object to the room.**

## Verification

- typecheck **clean**, build clean.
- `node scripts/health.mjs` → **WORLD OK**, exit 0.
- `npm run sweep` → **0 STATION MISS, 0 COVERAGE**, exit 0.
- `scripts/G-rooms-walk.mjs` → **114/114 passed**, all seven hotel legs green.
- `fp`/`fpdiff` deliberately not used: this adds textures, and GOTCHAS 75 makes
  it the wrong instrument.

## Found and NOT fixed

- **The lift still reads as a garage shutter** (w97's observation, unchanged and
  unmeasured by me).
- **The `customer station` FAIL** in `interiors-walk` — pre-existing instrument
  debt, wants a served-spot published in this room. w97 named it; still there.
- **The bare 26 m west wall** is now measured rather than mysterious. If anything
  is done about it, it has to be something that does not crowd the floor —
  wall-mounted, or a change to the room's proportions — because of §3 above.
  **That is a decision for the user's eye, not a builder's.**
- The remaining 6 untextured meshes in the top 30 are trim and beams, where flat
  colour on a 0.13–0.26 m member is defensible. I left them.
