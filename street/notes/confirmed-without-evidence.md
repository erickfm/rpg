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

## CORRECTION: rows disappearing is NOT a one-off

I swept 150 commits after the payphone row was deleted and reported the exposure
as **bounded and a one-off**. **That was wrong.** A second CONFIRMED row —
E's *"what is the shadow geometry here?"* — vanished upstream within the day,
found by `scripts/ledger-lost.py` and restored. An auditor evidence cell was
dropped separately in the same window.

**Three record losses in one day, of three different kinds:**

| what was lost | how it was found |
|---|---|
| a CONFIRMED row (payphone) | noticed by hand while verifying it |
| a CONFIRMED row (E, shadow geometry) | `ledger-lost.py`, routinely |
| an evidence cell (sleep-fade) | fingerprint check in `rebase-safe.sh` |

The lesson is not that anyone is careless — it is that **this file is edited
concurrently by eleven agents and nothing in the process notices a deletion.**
`ledger-lost.py` should run on a schedule, not after an incident.

## The general shape, which is the session's recurring one

A confirmation, a guard and a screenshot all fail the same way: **they keep
looking exactly like themselves after they have stopped meaning anything.**
Related: [[street-parallel-agents]], `notes/stale-preview.md`,
`notes/check-integrity.md`.

## One I tried and dropped: "block protruding from wheels on all vehicles"

I built a predicate — *no solid may stick out past its own tyre's outer face* —
and it reported **83 of 87 tyres failing**, with protrusions of 1.7 m and 3.1 m.

Those are **car body panels**. A car's bodywork extends far past its wheels along
the car's length, so my rule flagged every vehicle in the world. The tell was the
rate: **a 95% failure rate indicts the tool**, and applying the rule I wrote
yesterday — *ask what a PASS would look like* — a pass here would require a car
with no bodywork near its wheels. **The predicate could not go green.**

Left with no evidence rather than a wrong measurement. What it needs is a rule
that distinguishes a small block AT the wheel from the body it is attached to,
and I do not have one that does not also depend on knowing which meshes belong to
which car — the same identity problem that `userData.tyre` would solve.

## ESCALATION: five row losses in one day, and I cannot exonerate myself

| # | row | status when lost | how found |
|---|---|---|---|
| 1 | payphone — "we gotta move this phone thing" | CONFIRMED | by hand |
| 2 | E — "what is the shadow geometry here?" | CONFIRMED | `ledger-lost.py` |
| 3 | E — same row, **a second time**, after I restored it | CONFIRMED | `ledger-lost.py` |
| 4 | C — "i want the tv black" | OPEN | `ledger-lost.py` |
| 5 | C — "tv off unless i sit down to watch it pls" | **LANDED** | `ledger-lost.py` |

Number 5 is the worst kind: **a builder had done the work and was waiting for a
verifier**, and the row stopped existing. Nobody would have chased it.

**I cannot rule out my own rebase as the cause.** My resolver iterates mainline's
rows, keeps every one, and appends only rows unique to my side — by inspection it
cannot drop anything. But five rows have vanished from a file I rebase every few
minutes, and *"by inspection it should not"* is precisely the confidence this
session keeps punishing: the wall that could not pool, the predicate that could
not go green, the guard that could not see a swap.

**So the deletion source should be treated as UNKNOWN, not as somebody else's.**
What I can say with certainty is only that the rows were present at a named
revision and absent from `add-stick-and-city98` afterwards.

### SETTLED: it is not the rebase, and here are the two commits

`scripts/ledger-blame.py` walks mainline commit by commit and names the first
commit each row is missing from. Over 90 commits, **exactly two dropped rows,
and neither is mine** — my commits are all prefixed `Audit:`.

```
  856d62122  Every interior moved +80 m in x — stations across the ledger
        lost: [E] what is the shadow geometry here?

  e62112945  VERIFY C's TV row: confirmed — and one number in it cannot b…
        lost: [C] tv off unless i sit down to watch it pls     (LANDED)
        lost: [E] what is the shadow geometry here?
        lost: [C] the tv bezel looks good but i think i want the tv black
        lost: [C] how do i stop watching the tv
```

**Both are BULK EDITS to the ledger** — one rewriting stations across every row
after the interior belt moved, one a verify pass. That is the shape: an agent
rewriting many rows programmatically drops some, and nothing notices because the
file still parses and still looks like a ledger.

**Six rows in one day**, the sixth (`how do i stop watching the tv`) found only
by this tool. I have restored all six.

**My rebase is exonerated by evidence rather than by argument**, which is the
only way I was willing to take it — I had written that it should be treated as
unknown until something tested it.

### What would settle it

- **Run `scripts/ledger-lost.py` on every land**, not after an incident. It takes
  one command and it has now caught four of the five.
- **If it fires immediately after an AUDIT merge**, the cause is me and I should
  stop resolving this file by script.
