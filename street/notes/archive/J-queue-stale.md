# J — `queues/J-civic-int.md` is STALE. All six rows are built and CONFIRMED.

`scripts/live.sh J` says the thing that prompted this note:

```
=== J — 0 live, 0 awaiting a check ===
  nothing live. If your queue file still lists work, it is STALE —
  say so in a note rather than building it again.
```

It still lists six, all unticked. **Every one is built, landed, and CONFIRMED
by somebody other than me** — the auditor or C, never the builder that did the
work. This note exists so the next reader of that file does not build any of
them a second time.

The queue file is the desk's to write and I have not touched it.

## The six, and where each was settled

Checked against the ledger rather than from memory — I had this wrong in the
first draft of this note and attributed all of it to the auditor:

| queue row | ledger row | verified by |
|---|---|---|
| 1. remove the internal partition | 22-05-35 | **VERIFIER (C)** |
| 2. the librarian is wrong on both axes | 22-04-43 | **VERIFIER (C)** |
| 3. computers | 22-04-43 (same row) | **VERIFIER (C)** |
| 4. the entrance must read as civic from inside | 22-05-14 | **VERIFIER (C)** |
| Then: adopt `citizenSprite` | delivered with row 3 | — |
| Then: flat colour | delivered | — |

Two rows arrived after that file was cut and are also CONFIRMED: the
discontinuous stair railing (**C**, build `2b0b5881b`) and *"whjats going on
here in the library"*, the periodicals (**C**).

The one row the AUDITOR confirmed rather than C is the older *"put this
librarian behind the desk"*, and it is worth reading: it was rejected twice
before it was confirmed, once on a frame error the auditor corrected itself on
— *"the entrance is at +z … she was behind it the whole time and I was standing
beside her."*

There is one live thread and it is not mine to close: **row 2's ledger entry
carries a note from C that it could not verify my head-clearance figure from
outside**, because it needs a walk. That is now measured inside
`scripts/J-gallery-walk.mjs` and reads 0.59 m across the rake — see
`notes/J-library.md`.

## What the queue file's last line still buys, and I have kept doing it

> *"Take your own screenshots, walk both floors, and grade them skeptically
> before reporting."*

That instruction has outlived the six rows and it is the only part of the file
still worth acting on. Four defects came out of it AFTER the routed rows were
finished, and none of them was found by a check:

- the **reading table standing inside the staircase** — invisible from every
  camera because the deck's soffit hides it; the only symptom was a player
  climbing the west side stopping dead partway up
- the **stair with no stringers**, which read as twelve planks in mid-air from
  the one angle a stair is looked at from
- the **issue desk's west return** not reaching the counter — a 0.36 m hole you
  could see through
- the **card catalogue facing the front wall**, so from the body of the room it
  was a featureless dark box

So: not a request for more rows. If nothing is routed, this room's remaining
value is in that one line, and I will keep working it.

## What the desk still owes me

1. **There is no `J` row in `OWNERSHIP.md`.** `src/proto/ct/int-library.ts` is
   not in that table under any name, so `scripts/ownership.sh J` passes **by
   default rather than by decision** — the precise failure that file's own text
   describes (*"a blank in this table costs a day"*). It wants
   `src/proto/ct/int-library.ts = J`. I have not added it: that table is a
   routing decision and its last six rows were explicitly assigned BY THE DESK.

2. **`notes/J-seat-dispatch.md`** — 126 of 229 seats in the WORLD fail
   `seats-walk` on a rule in DESK-owned `src/proto/fp.ts`. Filed, not touched,
   and I have not tuned the library's seat radii to make somebody else's check
   go quiet.

3. **The port.** The queue file says 4191; builder I's dev server was already
   listening on it when I started, so everything of mine has been measured on
   **4192**. Worth a line wherever ports are assigned — `ss -ltn` before
   claiming one, or two builders measure each other's worlds (GOTCHAS §26).

— J, 2026-07-26
