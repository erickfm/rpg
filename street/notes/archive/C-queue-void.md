# What is left in my queue file that I am not going to build

`notes/queues/C-entrance.md` says: *"If your queue file lists something that is
not here, it is finished or void. File a one-line note naming it; do not build
it a second time."* This is that note. `scripts/live.sh C` reads **0 live, 3
awaiting a check**, and the queue file still carries eight unticked items.

## Void — the car lot went to builder I

Seven of the eight. `OWNERSHIP.md:59` reads `src/proto/ct/lot.ts = I`, split
off C on 2026-07-25, and `notes/queues/I-lot.md` says *"The lot is yours."*

| queue line | item |
|---|---|
| 57 | the office chairs face the wall |
| 76 | the left row of cars faces the wrong way |
| 104 | fix the floating signs, let me walk in, lay the lot out |
| 185 | register any seats in the car lot with `ctx.seat()` |
| 198 | the car lot must MAKE SENSE, and then be properly sleazy |
| 258 | the car lot: deeper, and go all-in on the detail |
| 299 | build the used car lot |

**The queue file contradicts `OWNERSHIP.md` on this and the queue file is the
stale one.** Its DESK RULINGS header still says *"`ct/lot.ts` is YOURS.
Recorded in `OWNERSHIP.md`, not just in practice"* — true when written, and
superseded by the load change that created builder I. Anyone reading only the
queue file would build the lot twice. One line struck from the header would
settle it; the file is the desk's, so I have not touched it.

## Done, and waiting on a check that is not mine to sign

| queue line | item | ledger |
|---|---|---|
| 149 | let me close the 301 door, and the poster reads as nothing | CHECK |

Both halves shipped. Alongside it, `live.sh C` lists two more of mine at CHECK:
spawn + respawn in room 301, and the door-handing row I landed today.

## So my queue is empty

Nothing routed and unbuilt. My verifier assignment — E's park and civic rows —
is finished too: twelve of twelve, the last one confirmed today.

**The one thing I would take next if the desk wants to route it** is not mine
to start: `notes/C-los-storey.md`, a one-line regression in D's line-of-sight
test that makes every `[E]` above the ground floor unselectable. It is the most
user-facing thing I know of that is currently broken — you cannot open your own
apartment door in the live world — and the patch is written and tested. It
needs D, or a mandate.

## Cross-checked against the inbox, not just against `live.sh`

`live.sh` reads `LEDGER.md`. If a request were routed to C in
`FEATURE-REQUESTS.md` and never given a ledger row, it would be invisible to
`live.sh` and I would sit idle holding real work — which is exactly what
happened to this queue before, for about twenty rounds. So "empty" is checked
from the other end too:

```
  every request in the Inbox routed to C, matched by screenshot name
    23-08-52  door needs to open the other way   1 row   LANDED
    22-02-53  remove the horiz stripes           1 row   CONFIRMED
    21-53-27  window frame graphics glitchiness  1 row   CONFIRMED
    21-45-18  3rd floor neighbour floating       1 row   CONFIRMED
```

Four for four, nothing orphaned. **Match on the screenshot filename, not on
the request wording** — `LEDGER.md` truncates the request cell at ~72
characters, so grepping for "stripes on the walls" returns 0 rows for a row
that is right there reading "can we remove the horiz stri". I did that a
moment ago and briefly thought I had found an orphaned request. The timestamp
in the filename is the only part of a request that survives into both files
intact.
