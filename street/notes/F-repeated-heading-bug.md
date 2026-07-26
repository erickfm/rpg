# F — I reintroduced a bug I fixed hours ago, and it is a signal to stop

## What happened

Verifying D's `bodega entry blocker`, I warped to the street outside the
bodega's cut-corner door and walked at it. The result:

    walked 201.94 m of 4.5 · ended 205.27 m from the door
    prompt: (none)

Two hundred metres in 2.4 seconds is impossible at walking speed. The
screenshot shows me outside the world, a brick corner against blank sky.

## The cause, which is the embarrassing part

I set the heading with `Math.atan2(nx, nz)`.

**It should be `Math.atan2(-nx, nz)`.** For a flat-wall door where `nx = 0` the
two are identical, which is why it looks right. For the bodega's 45-degree cut
face — `nx = nz = −0.707` — it points you along the street instead of at the
door.

**I diagnosed that exact bug in `interiors-walk.mjs` earlier tonight, fixed it,
wrote it up, and explained why it only bites at 45 degrees.** Then I typed the
broken form into a fresh throwaway script and got the same wrong answer from
the same room.

## D's row: NOT verified

`bodega entry blocker` is untouched by this. My probe never approached the
door. Someone else should take it, or I should with a heading I have checked.

## Why I am recording this rather than just retrying

This is my fourteenth instrument error of the session and the first that is a
straight **repeat** of one I had already found and fixed. The earlier ones were
new mistakes; this one is the same mistake twice, which is a different signal.

The corrected knowledge was in a note, in a commit message, and in the fixed
script — and none of that stopped me retyping the broken line, because I wrote
the throwaway from memory rather than from the fixed source.

**The fix that would actually hold: the heading belongs in `viewof.mjs` or
beside it, as a function.** `approachHeading(doorPoint)` — one place, already
correct, impossible to retype wrong. Every one of tonight's durable wins was
exactly this shape: tag the thing, publish the spot, export the helper. Every
repeat failure was me re-deriving something by hand that existed correctly
somewhere else.

---

# The heading is now exported and correct — and my probe STILL failed

`approachHeading(door)` and `exitHeading(door)` are in `scripts/lib/viewof.mjs`,
unit-checked against both cases:

    flat door (nx 0, nz -1)          -> [-0, 1]           outward = +z      OK
    cut door  (nx -.707, nz -.707)   -> [0.707, 0.707]    outward           OK
    cut door  exit                   -> [-0.707, -0.707]  inward            OK

Including the 45-degree case that broke me twice. The function is right.

**And the very next probe still walked 204 m**, landing at (199.43, −15.47) —
which is **room 301's respawn point**. I did not walk anywhere; I fell out of
the world and was returned to the bed.

## So the heading was never the whole fault

I computed the start position as `door − normal × 4.0`. That is arithmetic, and
it put me on ground that does not hold you up. **`doorStandFor(building)`
publishes the standing position for every door in the world**, handles cut faces,
and is the call `interiors-walk` uses — which is why `interiors-walk` walks that
same door correctly and my throwaway does not.

**Two guesses in one line of code**, and fixing the first only revealed the
second.

## What this actually establishes

- The exported helper is correct and now impossible to retype wrong.
- **D's `bodega entry blocker` is still not verified by me.** Two attempts, two
  different faults, both mine.
- The rule holds without exception tonight: **every position, heading,
  population and identity I derived by hand was wrong, and every one the world
  publishes was right.**

The next person should write this probe as `doorStandFor()` for the position and
`approachHeading()` for the heading — two published answers, no arithmetic — and
it will work first time.
