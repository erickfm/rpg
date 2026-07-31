# Builder A — the structure fingerprint does not match itself

Landed in **`c073ccfc`**, `scripts/scenedump.mjs` + `scripts/fpdiff.mjs` +
six un-exports in `ct/tex-world.ts`.

**This one is for the desk, because it is about the rule everybody follows.**
`CLAUDE.md`: *"To prove a change didn't move the world: `npm run fp before` →
change → `npm run fp after` → `npm run fpdiff`. Textures and structure must
match."*

Structure does not match. Six dumps of **identical** code:

```
9ad3c4ce   9ad3c4ce   c0a3f42e   9ad3c4ce   c0a3f42e   c0a3f42e
```

## How it surfaced, which is the part worth keeping

I un-exported six internal names and fingerprinted to prove the no-op. Structure
differed. **My first thought was that I had broken something** — and the change
was six `export` keywords, which cannot move a mesh.

So I ran the control: three more dumps of unchanged code. The "before" hash came
back on its own. The tool was wrong, not the change.

`fpdiff` then named the culprits exactly: **three of the car lot's 196 festoon
bulbs**, which alternate between a lit `#fff2c0` and an unlit `#6a5a3a`. Same
geometry, same position, different colour — they animate, so the hash depends on
the instant the dump was taken.

## Two fixes, and one of them did not work

**`scenedump` now pins the clock at 13:00** before dumping — the same hour
`check-seethrough` pins, so the two tools describe the same world. That removes
a real source of variance.

**It does not fix the bulbs.** Six more dumps still flip, because the twinkle
runs on its own frame accumulator and pinning the world hour does not stop it.
Recorded here so the next person does not spend the same twenty minutes
discovering that the obvious fix is not enough.

**`fpdiff` now classifies the difference** rather than printing a bare count.
Derived from the pairs themselves, not from a hardcoded list of things to
ignore — a list would be the stale-constant habit again:

| key | verdict |
|---|---|
| structure | same geometry, colour only → **animated colour, not structural** |
| structure | geometry differs → **this IS a structural change** |
| places | all within 5 cm → **drift** (walkers, pigeons) |
| places | further → **something was placed differently** |

**Proven both ways**, because a classifier nobody has watched fail is not a
classifier. On two dumps of identical code it says animated colour and drift. On
a fingerprint with one geometry parameter and one position deliberately mutated,
it says structural change and moved.

## Why this mattered more than three bulbs

A bare "3 differ" invites two wrong readings:

1. *You broke something* — which is where I started, on a six-keyword no-op.
2. *It always says that, so a difference is noise* — which is where anyone ends
   up who runs it a few times.

The second is the dangerous one. It converts the project's only structural proof
into a formality, and it does so quietly, exactly when someone is relying on it
to ship a change they believe is a no-op.

## The real fix, and my first one was wrong (`9866dd32`)

`1746b2f0` diagnosed this properly and routed it to whoever owns
`scenedump.mjs`, which is me.

I found `structure` flipping on identical code, traced it to three animated
bulbs, and pinned the clock. **That bought stability and not correctness.** The
casino/hotel chase recolours three shared phase materials off **frame** time,
not the world clock, so the hash still encoded which frame the dump landed on.
It only *looked* pinned because startup timing was consistent — and that round
proved it by adding a module that creates **nothing** and watching the hash
move, because the extra import delayed the first frame.

**A proof that reacts to a module which builds nothing is not a proof** — and it
is the proof `CLAUDE.md` tells every builder to rely on.

So the question is split rather than patched:

- **`structure`** — geometry and material *identity*: type, texture, blend flags
- **`tints`** — colour, on its own, reported and never a verdict

```
five dumps, identical code, BEFORE:  structure flipped between two values
five dumps, identical code, NOW:     ee5bb559 ×5
```

`tints` still varies, which is *correct* — those materials really are being
recoloured. `places` still varies, which is walkers.

My clock pin stays. It removes a real second source of variance and costs
nothing; it just was never the one that mattered. **I had the right symptom, the
right three objects, and the wrong cause** — and the thing that exposed it was
somebody else changing something that could not possibly have mattered, and
noticing that it did.

## For the desk

`CLAUDE.md`'s wording — *"Textures and structure must match"* — is now wrong in
the strict sense. **Textures do match**, run after run, and remain the reliable
half. Structure matches only up to animated colour. Suggested replacement:

> Textures and structure must match exactly. `tints` and `places` are expected to
> differ — animated colour and walkers. Read `fpdiff`'s verdict line, not the
> hashes.

*(Updated after `9866dd32`: structure IS now exact, so the original wording is
right again — it just was not true when it was written.)*

I have not edited `CLAUDE.md`; it is not mine.

## Also in that commit

Six names un-exported from `ct/tex-world.ts` — `dinerFront`, `thriftFront`,
`facadeWindows`, `DP`, `Band`, `WALL_PPM` — none referenced anywhere outside
that file. `uAt` and `Frontage` deliberately kept: `uAt` is the conversion
helper offered to F in `A-glazing-handoff.md`, and `Frontage` goes wholesale
when F is across.
