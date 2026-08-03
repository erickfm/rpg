# onehundredone / item 190 — one wrapped row, two false findings

**DONE.** `checks-can-fail.mjs` parsed `checks.mjs`'s registry with a **per-line
regex**, `/^\s*\['(name)',\s*(.*)$/gm`. It reads to end-of-line, so a row whose
selftest column wrapped onto a continuation line was read as an **empty column**
and accused of having no way to go red.

Root cause in one line: **a line-based parser over a multi-line data structure.**

---

## It was worse than the item knew — the same regex invented a check

`w40-bed-vs-door` is the accused row:

```js
['w40-bed-vs-door',  'does aim beat proximity in 301 — at BOTH ends of the knob?',
  ['w40-near-outright', 'w40-looked-dominant'], [], true],
```

**The regex also matched the SECOND line as a registry row** — a check called
`w40-near-outright` that does not exist. And because the text after that "name"
begins with a quote, the old shape test read it as **declaring a failing path**,
so the phantom sailed through silently.

So the guard's headline number was wrong too: **145 registered checks was 144
plus a phantom.** One wrapped row produced a false accusation *and* a false
citizen, and nobody had noticed the second because it never went red.

**The registry had been formatted around the bug**, which is the part worth
keeping. `checks.mjs:346`:

> *"ON ONE LINE ON PURPOSE, AND THAT IS A BUG IN A GUARD, NOT A STYLE CHOICE.
> `checks-can-fail.mjs:95` parses this registry with a per-LINE regex… Reported
> for a follow-up row; until the parser is fixed, keep the column on line one."*

An auditor that makes the thing it audits change shape to suit it has stopped
being an auditor.

---

## What it is now

A **bracket- and comment-aware scan**. `topLevel(s, open, close, sep)` splits on
top-level separators while skipping strings (with escapes), `//` and `/* */`.
The registry is split into rows on top-level commas, each row into columns the
same way. **Line breaks stop meaning anything**, which is the only way "keep the
column on line one" stops being a rule anyone has to follow.

The declaration test reads the third column as `checks.mjs` itself does —
`false` skips, **anything else declares** — rather than enumerating shapes. The
previous author had already been caught once accepting only `true` and `[` and
accusing the six rows that use a bare string; "not false" cannot repeat that.

**And it is unforgiving**, which the item asked for by name, after sixtysix's
`--only <name>` that exits 2 on a typo rather than producing an empty green run.
Every uncertain answer is `exit 2` with the reason:

- no `const CHECKS = [` in the file
- the array never closes
- a row whose first column is not a quoted name
- a row with fewer than three columns
- **fewer than 100 rows parsed** — a population floor, because a verdict built
  by filtering a population passes for free when the population collapses

---

## ⚠ THE POPULATION FLOOR CAUGHT MY OWN MISPARSE ON THE FIRST RUN

`parsed only 61 rows, floor is 100`. Splitting on top-level commas puts the
comment block that **precedes** a row into that row's chunk — and this registry
is mostly comment, often twenty lines per row — so `chunk.trim().startsWith('[')`
was false for every *documented* row and true only for the terse ones. **61 of
145, silently, and the shape of the answer would have looked plausible**: a
shorter list of undeclared checks reads like an improvement.

That is the same quiet under-count as the per-line regex I was replacing. The
fix is `stripLead`, which drops leading whitespace *and* leading comments.

---

## Proof — `node scripts/checks-can-fail.mjs --selftest`, 8 cases, exit 0

Every case mutates the **real** registry source and asserts a **named row**,
never a count. A count passes on this registry whatever the mutation does; that
is the trap `texdensity.mjs`'s selftest documents and this one avoids the same
way.

```
  OK   a WRAPPED row is read as declaring — w40-bed-vs-door
  OK   a continuation line is NOT mistaken for a row — no phantom w40-near-outright
  OK   the mutation actually changed the source — check-wiring
  OK   check-wiring declared BEFORE the mutation
  OK   a row set to `false` reads as UNDECLARED — check-wiring
  OK   a source with no CHECKS registry exits 2
  OK   a registry that never closes exits 2
  OK   a registry under the population floor exits 2, rather than passing on 1 row
```

Cases 3–5 are the item's *"a deliberately-undeclared row still turns it red"*.
**My first attempt at them failed loudly and that is why they are three cases and
not one**: the mutation was built from the victim's name inside a template
literal, the backslashes were wrong, and it matched nothing — a vacuous mutation
(GOTCHAS 90). `the mutation actually changed the source` exists to make that
impossible to miss again.

---

## ⚠ THE RED DOES NOT GO AWAY, AND THE ITEM'S PREMISE IS STALE

> *"it is the entire current red of this guard, so the guard is crying wolf."*

**It was 1 of 5, and it is now 0 of 4.** The false accusation is gone. What
remains is **real debt that landed after the item was filed** — four rows whose
selftest column is literally `false`:

| row | |
|---|---|
| `w75-site-contained` (park) | the script declares `jail-forecourt-open` on its **jail** row; these two legs declare nothing |
| `w75-site-contained` (lot) | same |
| `world-contained` | registered 2026-08-03 (w85, item 230) with `false` |
| `prompt-not-a-ghost` | registered 2026-08-03 (w85, item 236) with `false` |

The two `w75-site-contained` legs are now **annotated** —
*"the same script DOES declare one on another row — this LEG does not"* — so a
reader can tell that class from `world-contained`, which nothing has ever
watched fail. **It does not clear them**, deliberately: a mutation proven on
`--site jail` says nothing about whether the park leg can go red, and refusing
an argument of that shape is the entire point of this guard.

So `checks-can-fail` still exits 1 — **for four right reasons instead of one
wrong one.**

---

## Verification

| | |
|---|---|
| `node --check scripts/checks-can-fail.mjs` | clean |
| `node scripts/checks-can-fail.mjs --selftest` | **8/8**, exit 0 |
| `node scripts/checks-can-fail.mjs` | exit 1, `w40-bed-vs-door` **gone**, 144 rows |
| row count vs the old parser | 145 → **144**, and the missing one is the phantom, identified by name |
| `node scripts/checks-registered.mjs` | exit 1 **before and after** — pre-existing, `scripts/ghosts.mjs` is written and unregistered |

I quoted an exit code after a `| tail` once during this and got `0` for a run
that exited 2. Every exit code above is taken from the command itself.

---

## FOUND AND NOT FIXED — for the desk

1. **`scripts/checks.mjs:346-353` still tells authors to keep the selftest column
   on line one "until the parser is fixed".** It is fixed; that comment is now a
   stale instruction and the next author to obey it will cramp a row for no
   reason. **`checks.mjs` is not this item's file** (BUILDER-BRIEF §9) and it is
   a hot file other builders register into, so I did not touch it. It is a
   two-line comment edit for whoever holds a `checks.mjs` row next.
2. **`checks-can-fail` is EXEMPT in its own EXEMPT list** — *"this file — a guard
   over the registry, with no world state to mutate"*. That was true this
   morning and **is not any more**: it now has a `--selftest` with eight cases.
   Its own registry row could carry `true` instead. Same file-ownership reason
   for not doing it here.
3. **`world-contained` and `prompt-not-a-ghost` have no failing path at all** —
   two checks registered yesterday that nothing has watched fail. That is the
   item-70 debt register's business and they are not on it.
4. **`scripts/ghosts.mjs` is written, has a `--selftest`, and is in no tier** —
   `checks-registered` has been red about this independently of anything here.
