# Where this stands — pickup snapshot

**Written 2026-07-30 at the close of the sixteen-agent run.** Read this before
`queues/`, before `LEDGER.md`, before anything. It is the one file that says
what is unfinished and who has it. (The previous snapshot, written at the close
of the earlier session, is in git history at this path.)

---

## The headline

**The fleet is down — all sixteen agents — and it was stopped on purpose.**
Running sixteen concurrent builders exhausted the account's usage. The tmux
session `crosstown` is gone and the health monitor died with it (exit 144).
This is a budget outcome, not a crash to recover from. **Do not respawn sixteen
agents.** See "Fleet policy" below.

**Nothing was lost.** Every worktree was checked at close: the two unlanded
commits and all seven dirty files are **notes, status lines and verification
scripts**. No world code is stranded. Every headline feature the user asked for
this run is CONFIRMED in the ledger and reachable in the world, with one
exception, named below.

**Ledger at close: 214 CONFIRMED · 1 LANDED · 14 OPEN · 2 VOID** (231 rows).

**Seven of the user's asks are outstanding.** The other 8 open rows are
internal housekeeping — verification debt and instrument faults — and the 2
VOID rows are explicit duplicates. The seven are: blackjack, interior people,
exteriors-match-interiors, the used auto lot, gravity, the pickup tyre clip,
and the church pillars (LANDED, awaiting a check). All seven are listed with
their owners under "Open work" below.

**Counting caveat, learned the hard way.** Do not reconcile
`FEATURE-REQUESTS.md` against `LEDGER.md` by string matching — it inflates the
outstanding count every time, because **the ledger paraphrases**: the user's
*"atm needs a bit more detail… a bit lower to the ground"* is filed as *"ATM
inlaid, slanted, lower, more detail"*. Three separate attempts reported 67, 44
and 26 phantom missing asks. The ledger's own OPEN/LANDED rows are the
authoritative count of what is outstanding.

---

## The one thing to fix first

**Blackjack is built, checked, and a player cannot reach it.** It needs
**one `ctx.seat()` call, from G, and nothing else** — L built the interface and
verified it in-world, but no seat in the casino opens it, so the user has never
been able to play the thing he asked for. Ledger row is `OPEN | L`; the note is
`notes/L-for-DESK-seat-opens-a-game.md`.

It is a one-line change in G's file. It should not wait for a fleet.

---

## Fleet policy going forward — THIS IS THE CHANGE

**Hard ceiling: 5 concurrent agents. Normal shape: 4 — three builders plus one
auditor.** Rationale and standing rules in `PARALLEL-WORKFLOW.md` §10.

The rule that matters more than the number:

> **An agent exists only while it holds an item.** Queue empties → shut it down.
> Do not park idle agents in tmux.

When the fleet died, **11 of 16 agents were reporting DONE with empty queues**
and were still alive, still burning. That was the cost — not sixteen agents
working, sixteen agents *existing*.

---

## Disk layout after the 2026-07-30 clean-up

Everything below **landed** — all 16 feature branches are fully merged into
`add-stick-and-city98`, so nothing is stranded anywhere.

**Three worktrees remain**, the ones a restart needs first:

| worktree | branch | for |
|---|---|---|
| `rpg` | `add-stick-and-city98` | the desk, and the base everything merges into |
| `rpg-interiors2` | `feat/interiors2` | **slot 1 — G**, the blackjack seat |
| `rpg-audit` | `audit/seams` | **slot 2 — AUDIT**, the verification debt |
| `rpg-live` | `live` | the integration world on 5177 |

**The other 14 worktrees were removed. Their branches were not** — `feat/alley`,
`feat/bankint`, `feat/civic`, `feat/civicint`, `feat/entrance`, `feat/ground`,
`feat/interiors`, `feat/inv`, `feat/jail`, `feat/lot`, `feat/slots`,
`feat/split-2b`, `feat/tenancy`, `feat/traffic` all still exist and all are
merged. Recreate any of them in one command:

```sh
git worktree add ../rpg-<name> feat/<name> && (cd ../rpg-<name> && npm install)
```

Do not recreate more than the cap allows. Slots 3–5 want **fresh** worktrees
scoped to their item, not fourteen resurrected ones.

Also cleaned: `.git` packed from 355 MB to 52 MB; `street/=`, an empty file a
shell typo committed back in the sleep-fade verify run, deleted; N's scratch
moved out of `street/` root into `archive/scratch-n/`. **`street/shots/` (50 MB)
was deliberately left alone** — ledger evidence cites those screenshot paths by
name, so clearing it would hollow out CONFIRMED rows.

---

## What was loose before the clean-up (all now committed and landed)

| worktree | agent | state |
|---|---|---|
| `rpg-jail` | O | 1 unlanded commit (`d698d7a08`, status line only) + dirty `status/O`, untracked `O-verify-E-lancets.mjs` |
| `rpg-tenancy` | N | 1 unlanded commit (`2b6ff0c56`, repairs 11 dead commit citations in its own notes) + untracked `scratch-n/` |
| `rpg-split2b` | A | **dirty `LEDGER.md` — 6 rows changed, uncommitted.** Read that diff before committing or discarding it; it is evidence text. Untracked `A-citations-point-somewhere.mjs` |
| `rpg-bankint` | M | untracked `M-verify-church-lancets.mjs` |
| `rpg-civic` | E | modified `E-seatreach.mjs` |
| `rpg-ground` | B | untracked `B-verify-church.mjs` |
| `rpg-live` | — | 7 commits ahead; disposable integration branch, ignore it |

No worktree is mid-rebase. Every other worktree is clean and fully landed.

---

## Open work, by owner — the full list, nothing omitted

### Routed, blocked on one line (1)
- **L — blackjack.** Built and checked. Needs one `ctx.seat()` from G. *See above.*

### Verification debt, owner AUDIT (3)
- verify the ledger
- verify the eight LANDED rows
- confirm the remaining LANDED rows

### AUDIT against itself (1)
- **54 of 176 build SHAs cited in its own evidence — 31% — do not resolve for
  anyone else.** The evidence exists but cannot be re-checked from the citation.

### Adoption, owner F+G (1)
- **interior people: 0 of 10 `int-*.ts` files call `citizenSprite`.** The
  capability landed; nothing adopted it. Same failure class as GOTCHAS 49.

### Unrouted — owner literally "desk", i.e. **nobody** (7)

**These are the actual cracks.** Every one was filed by the auditor after
finding it untracked, and four are things the user said out loud that never got
a row at all.

| row | why it is here |
|---|---|
| **make the exteriors match the interiors** | *the user has asked this FIVE times and it has never had a row* |
| **what happened to the used auto lot?** | untracked; the lot exists and has been walked, the request was never logged |
| **make gravity a tiny bit stronger** | untracked; a movement-feel change with nobody assigned |
| **the inner tyre clipping on the pickup** | untracked — and the user's own words are *"was never fixed"*, so it had been reported before that, too |
| ~15 CONFIRMED rows cite interior coordinates that now name a different room | interiors moved +80 m when `int-bank.ts` was inserted; these rows *look* evidenced |
| the full check suite kills the preview server | ~half its 52 failures are artefacts of that, not real defects |
| seampairs: 103 brick seam disagreements | sample dominated by the new jail block |

Plus one explicit **do not route**: `D-outline-debug-only` fails on stale
stations, not on a regression. Sending D after it wastes an agent.

### LANDED, awaiting a check (1)
- **E — church pillars blocking the windows.** This request also had no ledger
  row until E filed one itself (`FEATURE-REQUESTS.md:1085`).

---

## Every headline request the user made, and where it actually is

| request | status |
|---|---|
| watch TV on the bed, nonsensical ads | CONFIRMED (C, K) |
| ad-format diversity | CONFIRMED (C) |
| getting up from the TV seat | CONFIRMED (C) — this was the modal-input trap |
| slots interface and a working game | CONFIRMED (L) |
| **blackjack interface** | **OPEN — built, unreachable, needs one seat call** |
| ATM interface | CONFIRMED (K) |
| player inventory + package stealing | CONFIRMED (K, A) |
| bank interior | CONFIRMED (M) |
| apply for a loan | CONFIRMED (M) |
| rent + landlord letters at the mailboxes | CONFIRMED (N) |
| the jail | CONFIRMED (O) |
| sleep fade to black | CONFIRMED — but see GOTCHAS 49; it read CONFIRMED once while unwired |

---

## Is the list of the user's asks complete? (reconciled 2026-07-30)

**Yes — nothing was lost.** Checked both directions:

- `FEATURE-REQUESTS.md` is **1,686 lines and has only ever grown** — line count
  verified at every commit that touched it. Never truncated.
- **246 asks** are recorded there as bullet quotes. **229 carry an inline
  `→ **builder**`**; the other 17 are routed either on a continuation line or by
  their `## Done — routed to X` section heading. **Zero are unrouted.**
- Reverse direction: of **226 distinct LEDGER request texts**, three were the
  user's own words and were **missing from the log** — the bank interior, the
  bank loan, and the diner facade *"looks really bad rn"*. All three were built
  and are CONFIRMED; only the log entry was absent. **Backfilled.** The other 60
  unmatched rows are internal desk/auditor findings and belong to the ledger
  only.

**But the two records are NOT in sync, and neither is complete alone.** The
ledger is not a superset of the request log: early asks (2026-07-24/25) were
tracked in the log's own `## Done` sections before the ledger existed, so a
2026-07-24 ask can be finished, correct, and have no ledger row at all. Do not
read "no ledger row" as "never done" for anything from those two days.

One live disagreement to be aware of: **"make the exteriors match the
interiors"** is marked ✅ done in the log (`FEATURE-REQUESTS.md:1063`, for A's
four facades) *and* is an OPEN ledger row. Both are true — A's four are done,
the general request is not, and the user has asked five times.

---

## Documentation defects — know these before you trust a file

1. **Queue checkboxes are not maintained.** K reports *"queue closed, all four
   items done"* while `queues/K-inventory.md` still shows 4 unticked boxes.
   Same for most queues. **The ledger is the source of truth for WHETHER; the
   queue is only HOW.** Never read an unticked box as open work.
2. **`notes/` was 394 files in one flat directory — now 45.** The other 349
   were finished handoff and verification notes and moved to `archive/`
   (2026-07-30), which now has 359 files and an `archive/INDEX.md` listing every
   one with its heading. Nothing was deleted. **A note at the top level of
   `notes/` is live; one in `archive/` is history.** Keep it that way: when a
   note's work is done, move it down.
3. **31% of AUDIT's build SHAs don't resolve.** A citation is not evidence if
   the reader cannot reach it.
4. **CONFIRMED is neither permanent nor proof.** GOTCHAS 49: a row can be
   CONFIRMED and untrue. 28 CONFIRMED rows were found naming nobody and nothing;
   one rested on 8 characters.

---

## The structural bug that has cost the most, still only partly fixed

**Ten times** a builder finished work that could not reach the world, because
the one line that wires it lives in a desk-owned file: casino, hotel, tax
office, park, car lot, pawn shop, the library floor picker, `civicSeats`, the
church footprint, the park bounds. Each was complete, committed, and invisible.

**Blackjack is the eleventh.** It is the same bug, today, on the user's most
recent game request.

F's automatic module incorporation (`import.meta.glob` over `ct/*.ts`, plus
named sites the roster publishes) is the fix and it is partly landed. **If you
do one structural thing next, finish it** — everything else here is cheaper
than this bug has been.

---

## If you are restarting the fleet

Read `PARALLEL-WORKFLOW.md` §10 first. **Five is the ceiling.** Route through
`route.sh`, **never** by direct `tmux send-keys` — GOTCHAS 47: the desk's own
direct dispatches go unlogged, which is how four user requests went missing.
Shut each agent down when its queue empties.

**The five slots are already allocated. Nothing above is unassigned any more —
this is where each open row goes.**

| # | slot | takes | why this order |
|---|---|---|---|
| 1 | **G** — `ct/casino.ts` | **the blackjack `ctx.seat()` call**, then the F+G `citizenSprite` adoption | one line closes the last outstanding user request. Do this before spawning anything else; it may not even need a second agent |
| 2 | **AUDIT** | the 3 verification-debt rows, then its own 54 unresolvable SHAs | it gates whether 214 CONFIRMED is a real number. Runs the whole time; never shut down |
| 3 | **builder — exteriors** | **"make the exteriors match the interiors"** (asked FIVE times, never had a row), then **the used auto lot** | the oldest unanswered user request in the file. Highest user-visible value of anything left |
| 4 | **builder — feel** | **gravity a tiny bit stronger**, then **the pickup's inner tyre clipping** | both are small, both are the user's own words, both were reported and dropped. Cheap and they close cleanly |
| 5 | **builder — instruments** | the check suite killing the preview server, the ~15 dead-coordinate CONFIRMED rows, the 103 seampairs disagreements | do this last: it fixes the *measuring*, not the world. Half of the suite's 52 failures are artefacts and will evaporate |

Explicitly **not** in any slot: `D-outline-debug-only` — it fails on stale
stations, not on a regression. Do not send an agent after it.

If fewer than five are wanted, cut from the bottom: slot 5 is invisible to the
player, slot 4 is small enough for the desk to do inline, and slots 1–3 are the
ones the user would actually notice.
