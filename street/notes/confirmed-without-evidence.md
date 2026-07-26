# 28 CONFIRMED rows have nothing under them

**For the desk.** `LEDGER.md` is the file you read before telling the user
something is finished, and the project's own rule is that *a wrong CONFIRMED in
it is worse than an OPEN* — because nobody is looking at a CONFIRMED any more.

I swept all 171 CONFIRMED rows for what their status actually rests on.

```
  CONFIRMED rows                                                171
    carrying auditor evidence                                   109
    no auditor evidence, but naming a verifier or a station      34
    naming NOBODY and NOTHING                                    28
```

The 34 are fine: they say *"CONFIRMED by E, 22:40, STATION: …"* or carry a
`CHECK FROM` line or a desk ruling. Someone can be asked, and a verifier knows
where to stand.

**The 28 are a status with nothing behind it.** By owner: D 5, B 5, E 4, J 3,
F 2, C 2, desk 2, A 2, G 1, I 1, H 1. Several rest on under fifty characters:

```
  [B] night: road darkened, lamps reach objects        8 chars of evidence
  [C] car lot: enterable, office at back, rows         9
  [E] library steps climbable                         14
  [D] bodega entry blocker                            16
  [D] burger barn red + beige                         17
  [desk] world stops reloading under the player       19
  [F] library courtyard benches sittable              25
  [E] park not a yard                                 27
  [G] casino + hotel blades read correctly            32
  [E] church steps + churchyard                       35
  [E] park lit                                        43
  [C] TODAY ONLY board removed                        44
  [F] wheel arches read as arches                     46
```

**This is not an accusation that they are wrong.** Most are early rows from when
the ledger was a checklist rather than a record, and the work behind them was
probably done. It is an accusation that **nothing would tell us if they stopped
being true** — which is the same shape as the guards that had stopped guarding,
and as my own float CONFIRMED that a crowd regression quietly falsified today.

## Spot-checks: two of the thirteen, and they came out differently

- **`burger barn red + beige` — HOLDS.** `scripts/looks.mjs` re-run: *frontage
  found, 13 materials on the shopfront band, PASS — no yellow.*
- **`wheel arches read as arches` — ITS OWN CHECK CANNOT DECIDE IT.** The same
  script reports *"86 tyres · highest tyre top 0.858 m · arch line 0.72 m —
  **CANNOT ANSWER**: world-space tyre top vs a car-local arch line."* The row is
  CONFIRMED; the only check that addresses it says it cannot tell. That is
  exactly a status resting on nothing.

## What I suggest, in preference order

1. **Do not mass-reopen them.** That would bury the real OPEN rows and cost more
   than it finds.
2. **When `live.sh AUDIT` is empty I work through these** rather than idling —
   the queue already says that when I have no LANDED rows I become a verifier.
   Cheapest first, and each gets a STATION so the next person can repeat it.
3. **Rows whose own check says CANNOT ANSWER should go back to OPEN** — that is
   a smaller set than 28 and it is unambiguous. `wheel arches` is one.

## The general shape, which is the session's recurring one

A confirmation, a guard and a screenshot all fail the same way: **they keep
looking exactly like themselves after they have stopped meaning anything.**
Related: [[street-parallel-agents]], `notes/stale-preview.md`,
`notes/check-integrity.md`.
