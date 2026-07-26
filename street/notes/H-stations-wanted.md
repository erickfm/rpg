# Seven LANDED rows name no station — for the desk

**H, verifier.** The pile is down to these. I am not guessing at them: five
generic filters earlier today gave me five wrong sets and zero real faults,
and every one of my 28 confirmations came from standing somewhere named or
running an instrument the row already published. Guessing costs three passes
and produces a confident wrong answer, which is worse than an open row.

**Per the standing process, naming the builder and the row so the desk can get
the station from them:**

1. **G** — `'Screenshot from 2026-07-25 20-53-34.png' library interior is better b`
2. **G** — `'Screenshot from 2026-07-25 21-59-46.png' hotel looks so bad, rugs all`
3. **G** — `'Screenshot from 2026-07-25 22-00-33.png' need a bit of space on entry`
4. **A** — `'Screenshot from 2026-07-25 22-03-52.png' i like the atm, maybe add an`
5. **B** — `'Screenshot from 2026-07-25 22-07-32.png' why does the lighting catch`
6. **G** — `'Screenshot from 2026-07-25 23-27-45.png' whats wrong with this plant`
7. **G** — `'Screenshot from 2026-07-25 23-30-58.png' hotel textures are buggy`

## What I need from each, in one line

Not a paragraph — one of these two things is enough:

- **where a verifier should STAND** (a position and what they should be looking
  at from it), or
- **a PREDICATE that settles it** (a runnable command, or a claim of the form
  "X is true of Y" that can be measured).

The rows that closed fastest today gave me the second: `I-clip.mjs`,
`D-paving-vs-trim.mjs`, `packages.mjs`, `respawn.mjs`. Each was one run.

## Two of these look like they may be cheap to station

Offered as a suggestion to the builders, not as a ruling:

- **G's `whats wrong with this plant`** and **G's `hotel textures are buggy`**
  are both screenshot reports of a *specific object*. The station is wherever
  the user's screenshot was taken from — G reproduced that pose to fix it, so
  G already has the camera. Publishing that pose IS the station.
- **B's `why does the lighting catch...`** is likely settleable the way I just
  settled the alley lamp: from source, by whether a call exists, rather than
  from a brightness profile. Worth B saying which.

## One row I could not confirm and left LANDED deliberately

Not a station problem — the fault is real and still in the world:

- **F**, the bodega keeper. B's station works and I reproduced it. The defect is
  `ct/int-bodega.ts:672`, `facing: Math.atan2(CTR_X - KEEP_AT, 0)`, which is the
  constant +pi/2 because `KEEP_AT = CTR_X - 0.55` one line above. Details on the
  row.
- **B**, the alley back door. B's half is in (`scene.userData.addLamp` is a live
  function); D's call does not exist anywhere in `src/proto` — three grep hits,
  all definition or comment. Details on the row.

— H
