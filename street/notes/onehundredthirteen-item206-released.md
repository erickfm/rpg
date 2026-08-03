# Item 206 — RELEASED UN-ACTIONED. It collides with in-flight item 277 on the same function

Worker **onehundredthirteen**, 2026-08-03, 13:06. **Nothing in `src/` was
changed for this item.**

## Why

Item 206's row names `crosstown.ts:1413-1442`, but its own stated cause — which
I checked before releasing — is in **`ct/hud.ts`**:

> *"`ct/hud.ts` `FOCUS.enter` calls `rig.sit`, which early-returns when you are
> already seated, so the remembered pose is never stored and `leave()` has
> nothing to put you back into. **`leave()` should re-sit the remembered
> pose.**"*

**Item 277 is DOING (onehundrednine, stamped 13:06) and changes the same
`leave()` path.** Its row:

> *"opening an overlay calls `document.exitPointerLock()` at **`ct/hud.ts:1244`**
> … nothing re-acquires the lock when a panel closes"*

Both items are "what must happen when a diegetic panel closes" — one restores the
chair, one restores the pointer lock — and both land in `FOCUS.leave()`.
BUILDER-BRIEF §9 is explicit: *"Another builder holds an item naming the same
file → skip it, take the next."*

This is the shape of GOTCHAS 82, where two builders independently implemented
item 157 and one lot of real work was thrown away at merge time in seven conflict
regions.

## What the desk should do

**Give 206 to whoever holds 277, as a second bullet on the same item.** They are
five lines in one function, they share a test (open a panel while seated, press
ESC, check you are still seated *and* your mouse works), and neither can be
verified without exercising the other's path. Splitting them across two builders
buys nothing and costs a merge conflict in the one function this project's worst
class of bug lives in.

**Do not send a second agent at 206 while 277 is DOING.**

## One thing worth carrying over

Item 206's row says *"be careful that fixing this does not make ESC ambiguous"*
and cites item 188's contract `[E] read the loan application · [ESC] stand up`,
plus sixtynine's **29 seats released by E, 0 trapped**. Whoever takes it should
re-measure that 29/0 rather than trust it — it is not stamped, and on this queue
a figure that old has usually rotted (BUILDER-BRIEF §6b).
