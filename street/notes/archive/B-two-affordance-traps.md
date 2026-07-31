# Two affordance traps, found verifying, worth more than the rows they came from

Both turned up while checking C's TV work. The rows they came from have since
been consolidated out of the ledger, but these are facts about the *tools*, not
about those rows, and either one will bite the next person who reaches for them.

## 1. `props.ts`'s `addLamp` has no removal, and that gap is mine

C registered the television as a light through `scene.userData.addLamp`, and
then had to **delete the registration entirely** rather than switch it off,
because `lampHeads` is a build-time list and nothing takes an entry out of it.
The set pooled light on the boards of 301 all night.

That fights *"make the unilluminated stuff darker, it should feel scarier at
night"* directly — a request the user has now made four times — and it did so in
a room he sleeps in.

**C's workaround is right and the gap is mine.** Measured from the other end to
confirm it is really gone: **544 meshes in the 301 belt, 0 carrying `poolLit`**
at 23:10. Nothing pools in that room now.

**If anyone needs a light that goes out — a TV, a sign on a timer, a torch — say
so and I will add removal rather than have you work around it.** The registry is
`lampHeads` in `ct/props.ts`; taking an entry out is small, and the reason it
does not exist is that every light in the world so far has been permanent.

## 2. `__ct.warp()` does not clear `seated`, and that will fake a fault

This one nearly cost me a false report against C.

The TV's `on` state is derived from whether the player is seated. I warped out
of the seat and `on` stayed **true**, which looks exactly like a toggle
remembering a state it should have dropped — the precise failure C's row said it
had avoided.

It is not. `__ct.seated()` **still returns the seat pose after the warp**:

```
  after E (seated)      seated {"x":197.9,"z":-15.58,...}   on true   pos [197.9, -15.6]
  after warp away       seated {"x":197.9,"z":-15.58,...}   on true   pos [-6, -40]
```

The player is at (−6, −40) on the street and logically still sitting on the bed
in 301. `on` is true because the state it derives from is true. **The machine is
working; the affordance is lying.**

**So: any probe that warps out of a seat and then asserts on seat-derived state
is measuring the affordance, not the world.** Same shape as the other traps this
project has collected — `people()` returning speeds when you wanted positions,
`page.evaluate` awaiting a promise you meant to fire, a bounding box standing in
for a density.

**The open question, which is not mine to answer:** if a *real* respawn shares
that code path, then a claim like C's *"after a respawn the set is off"* is at
risk for real. C measured it and I could not reach it. That is a question for C
or for F, who owns the seat registry — flagged rather than guessed.

## The general lesson, since this is three in one session

Every one of these was a tool telling me something confidently wrong, and in
each case the tell was the same: **the result was too clean.** A toggle that
fails exactly the case its author said it handled. A fade that never once went
black. A pit finder that found zero pits and passed.

When a measurement lands squarely on the most interesting possible answer, check
the instrument before writing the finding down.
