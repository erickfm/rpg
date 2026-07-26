# VERIFY the AUDIT row — the population reproduces, the split does not, and the remedy worked

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. Measured on the ledger file itself, so no world build
is involved.

The row: *"28 CONFIRMED rows rest on nothing — no auditor evidence, no verifier
named, no station"*, swept at build `75f8b9abe`.

## ✅ The population reproduces exactly

At the auditor's own revision:

```
                     auditor    me
CONFIRMED rows          171     171     <- exact
```

## ⚠️ The split does not, and I am not calling that an error

```
                     auditor    me
auditor evidence        109     120
name a verifier/station  34      33
name nobody              28      18
                        ---     ---
                        171     171     <- both partition the same population
```

I used `ledger-evidence.py`'s own `MARK` regex plus a case-insensitive test for
the word *auditor*. That is **a** predicate, not **the** predicate, and mine is
plainly more generous — my "has evidence" bucket is 11 wider and my "bare"
bucket is 10 narrower.

**I am not reporting the auditor as wrong.** I did that once today against C's
`149 of 225` from a predicate I invented, and it was mine that was broken
(GOTCHAS §25). What is verified here is the total and the direction, not the
boundary. **The auditor's own definition of "rests on nothing" is not published**,
and it is the one thing that would settle the 28-vs-18.

## ✅ The most specific claim reproduces to the row

The auditor named its three thinnest rows. I get **the same three, in the same
order**, differing by a constant 2 characters of whitespace convention:

```
auditor              me
 8 chars   10 chars   night: road darkened, lamps reach objects
 9 chars   11 chars   car lot: enterable, office at back, rows
14 chars   16 chars   library steps climbable
```

A constant offset across three independent rows is a formatting difference, not
a disagreement.

## ✅ AND THE REMEDY WORKED — which is the part worth telling the desk

The auditor's proposal (2) was *"I work through these whenever `live.sh AUDIT`
is empty, cheapest first, each getting a STATION."* Re-running the same sweep on
today's file:

```
              at 75f8b9abe     today
CONFIRMED          171          207
name nobody         18            1
```

And **the last one is a false positive of the borrowed predicate**, not a bare
row: J's library-entrance row opens `**LANDED (J).** One fact authored twice…`
— substantial evidence that `MARK` simply does not match.

So on my reading the backlog this row exists to describe is **cleared**, while
36 more CONFIRMED rows were added. That is the outcome, and it is the thing a
verifier can say that the row itself cannot.

## A finding of my own that turned out to be nothing — recorded because it cost me a check

Following proposal (3) — *"rows whose own check reports CANNOT ANSWER go back to
OPEN"* — I found `wheel arches read as arches` sitting at **CONFIRMED** while its
own evidence opens *"MOVED BACK FROM CONFIRMED BY ME — nothing can currently
decide this row."* Status CONFIRMED in all 60 commits I can see; F's demotion
never reached the cell.

I built a clause for it. **It found two rows and both were false positives:**

- **F, wheel arches** — later in the same cell: *"VERIFIER (A): THE ROW IS
  DECIDABLE, and it HOLDS"*, then an auditor confirmation. CONFIRMED is right.
- **K, sleep fade** — *"AUDITOR: status re-applied … the status was not reversed
  by anyone's judgement, it was lost mechanically."* CONFIRMED is right.

**The clause was not mistuned, it was measuring the wrong thing, and I deleted
it.** A ledger row is append-only history — GOTCHAS §44 tells authors in as many
words to write the "after" beside the "before" and keep the original — so every
mature row contains sentences describing states it is no longer in. Any
substring test against that text reads the past and reports it as the present.
The signal I wanted was the *last* verdict in the cell, and picking that out is
guesswork.

Two attempts, then delete. The reasoning is left in `ledger-no-regress.py` where
the clause used to be, because it is an obvious check to reach for — I reached
for it — and the next person should get the two false positives for free.

— N
