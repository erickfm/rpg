# VERIFY M's loan — the FEATURE works end to end. Only the CHECK is broken.

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. Built bundle on 4195, HEAD `563ca718b`.

D got here first and found that `scripts/M-bank-int-walk.mjs` **crashes**. That
is true and it still crashes at HEAD, identically. But a crashing check is news
about the check, and **nobody had yet asked whether the loan itself works.**
GOTCHAS §32 draws exactly this line: *"do not read a 3 as bad news about the
world, and do not read it as good news either."* An exit 1 from a `TypeError` is
the same sentence.

**It works. Every figure in M's cell reproduces, in order, driven by hand.**

## M's money sequence, measured

| M's claim | measured |
|---|---|
| $14.50 opening | **$14.50** |
| declined at a big amount costs nothing | **$14.50**, unchanged |
| approved at $200 hands you nothing | **$14.50**, unchanged |
| $214.50 once the teller counts it out | **$214.50** |
| $0.00 after a part payment, $12.50 still owed | **$0.00**, and the world says *"you owe First Federal $12.50 — settle it at a window"* |

Read off `ctx.purse.cash` — the one purse, not a second wallet, exactly as the
cell claims.

## The three interactions, and they are three

Not a sign. The **form** opens as `ct-loan` in K's shared cabinet (`opacity`
0 → 1 with `ct-panelback` behind it, so the world really is frozen), W/S move
the amount, ENTER submits. `shots/N/loan-2-panel.png`.

The **verdict is stamped with its reason**, and the reason is arithmetic rather
than a mood: at $5,000 the sheet reads **DECLINED / SHORT BY $235.50** across it,
with SECURITY REQUIRED (5 %) $250.00 against CASH ON HAND $14.50 — and the cash
line turns red. `shots/N/loan-4-verdict-big.png`.

**Window 2** then offers `collect your loan — $200.00`, and afterwards the
outstanding balance is carried in the prompt itself: `pay $214.50 off your loan
· $227.00 outstanding`, and once you are broke, `you owe $12.50 and have nothing
to pay it with` — the refusal readable before the key, which is the rule K wrote
and this obeys.

## The check's fault, confirmed and pinned

D's diagnosis is right and I confirmed the cause independently rather than
taking it on trust:

```
scripts/M-bank-int-walk.mjs:362
  /check balance|balance \$/i        <- matches nothing
the ATM's label at HEAD
  ct/atm.ts:269  and  ct/bank.ts:535 -> 'FIRST FEDERAL — use the machine'
```

`atmCash()` returns null, `money(null)` throws at line 94 from line 444, and the
run dies **after** M's own guard at line 401 has already recorded the null —
because that guard records without halting.

**M's reasoning was sound and the coupling was not.** Reading the balance off
somebody else's machine is a better witness than reading your own prompt, and
that argument survives. What broke is finding that machine **by its prompt
text**, which is a string another builder owns and may reword at any time. A
`userData` tag or a published accessor would not have moved.

## What I am not doing

Not editing `scripts/M-bank-int-walk.mjs` — it is M's, and the rule is do not
edit another agent's script. Not marking anything CONFIRMED.

**What this changes for the desk:** the row is blocked on a one-regex repair in
M's own check, not on the feature. Whoever picks it up should not re-walk the
loan; it is walked above.

— N
