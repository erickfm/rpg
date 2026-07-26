# F grading B's alley — reached, and the detail row holds

Previously handed back twice as unreachable. That was wrong — it is tagged
(`alley2`, 79 parts) — and this is the grade I owed.

    station:   stand at (19.88, -54.01) facing west, pitch +0.10
               (computed by viewof.mjs from the tag centroid, not guessed)

## The row: "add some detail to this alley, like a gutter pip some vent stuff on the ground"

`shots/f-verify-alley2.png`. Looking down the alley:

- **a gutter downpipe** running the full height of the right-hand wall and
  curving out to discharge at ground level — the row's first named item
- **vent boxes on both walls**, at two heights, with an air-conditioning unit
  above
- **a drain grate** set into the paving where the fall would take the water,
  which is the "vent stuff on the ground" half
- a **washing line** strung across the gap overhead
- brick to both sides with genuine variation in the coursing, and daylight with
  a lit shopfront at the far end so it reads as a through-route rather than a
  dead end

**Both named items are there and the alley reads as an alley.** No reservations
on this row.

## One thing I got wrong on the way, worth recording

My first attempt stood *at the tag centroid* and got a nose-full of brick. The
centroid of 79 scattered parts is not a place to stand — its z-span is only
2.5 m, so it is a cluster of fittings, not the alley's axis. **`viewOf` handles
exactly this and I bypassed it**, having built it an hour ago for this reason.

The computed viewpoint worked first time.

## Still not graded

The other three alley rows — the lighting ones and *"alley is better but i
dont l..."* — are reachable from the same station and I have not judged them.
The lighting rows need a night pass; this frame is 13:00.

---

# Night pass — measured, but the rows are TRUNCATED so I cannot judge them

    station:   same as above, (19.88, -54.01) facing west
    alley luminance   day 79.6    night 24.6    (69% darker)

`shots/f-verify-alley-night.png`.

## What the night frame actually shows

The alley goes properly dark — 69% down, against 81% for the open road, which
is the right relationship: a slot between two buildings keeps a little more
sky-glow than open tarmac does at head height.

**It carries no light of its own.** What light there is comes from two places:
spill from the lit shopfront at the far end, and one warm upper window on the
building across the gap. The downpipe, vents and drain are all visible in
silhouette rather than lit.

## Why that is a measurement and not a verdict

The two rows are `'...' lighting on this alley back` and `'...' why does the
lighting catch`, both cut off in `live.sh`. **I do not know whether the
complaint is that the alley is too dark, that something is wrongly lit, or that
a light catches a surface it should not.** A 69% figure is compatible with all
three.

This is the second row tonight I have had to hand back for truncation — the
kerb was the first — and it is a different problem from a missing station: the
subject is reachable, the measurement is taken, and the *claim* is unreadable.

**What I would need:** the full row text, or the screenshot filename the user
attached. Either resolves it in one pass from a station I have already
computed.
