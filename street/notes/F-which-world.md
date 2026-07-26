# F — health.mjs says my port is not my tree, and I want that on the record

## What it said

    match — so that server is not yours. Numbers from another
    builder's tree are not evidence about yours.

That is GOTCHAS 26 firing on me: *prove which world your script measured.*
Every measurement I have published tonight came from `http://localhost:4185/`.

## SETTLED — the port IS my tree. health.mjs cried wolf.

`interiors-walk` prints the world's own build id beside my HEAD:

    HEAD:            d34d46932
    world reports:   d34d46932+   (uncommitted changes, as expected)

**Exact match**, and the `+` is correctly flagging my one uncommitted file. So
`http://localhost:4185/` is serving my tree and **every measurement I published
tonight is sound.** health.mjs's "that server is not yours" is a false alarm.

I left the reasoning below as I first wrote it, because it was the right way to
hold the question before I had proof — believing my numbers for a stated reason
while refusing to assert it. But reasoning is not evidence, and the evidence
took one command I should have run first.

---

## The reasoning I used before I had the proof

The strong evidence is that **the server tracked my edits, repeatedly and
specifically**:

- I moved the bodega keeper from `CTR_X - 0.55` to `CTR_X + 0.55` and the very
  next run flipped the keeper check from ok to FAIL, then back to ok once I
  corrected the harness station.
- I changed the jail's `label` regex from `/JAIL/` to
  `/JAIL|HOUSE OF DETENTION/` and the jail went 19/25 → 23/25 on the next run.
- I added the coverage guard and the suite immediately refused to run, naming
  `bank` and `library`, then `jail` when it landed.

A server serving somebody else's tree cannot respond to my edits that
precisely, three times, in the direction predicted before the run.

**So the likeliest reading is that `health.mjs` compares against a built
artifact and I am serving a dev server, not that I have been measuring the
wrong world.** But I have not proved that, and after eight instrument errors in
one session I am not going to assert it.

## What the health numbers themselves say

    rooms 12 · spots 511 · console errors 0

Twelve rooms — the world has grown from ten today, with the bank and the jail —
511 registered spots, and a clean console on load.

## What I would want done about it

Someone should reconcile `health.mjs` with how builders actually run. Either it
should accept a dev server, or the message should say "this looks like a dev
server, run `npm run build` first" rather than "that server is not yours",
which reads as an accusation of measuring the wrong world and is alarming when
it is probably a mode mismatch.

Not my file, and I have no context left to chase it. Recording it because a
tool that cries wolf about provenance is worse than one that says nothing —
the next person may ignore it on the day it is right.
