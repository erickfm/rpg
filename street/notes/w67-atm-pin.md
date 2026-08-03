# Item 184 — the ATM PIN screen: CANCEL, auto-submit, enrolment

Worker sixtyseven, 2026-08-02. Port **4230** (`ss -ltn`, held all session).
Merged build `503136984`.

> *"trying to hit cancel on the pin keypad doesnt work cause its also 5? once you
> enter 4 digits it auto submits please. also the first time you go to the atm it
> saves your pin."*

---

## (1) CANCEL — and the desk's brief was RIGHT but INCOMPLETE

The item says the digit handler at `atm.ts:437` shadows the fascia shortcut. That
is true. **What it does not say is that this broke the MOUSE too, which is
almost certainly what the user was actually doing.**

`clickAt` deliberately routes clicks through `onKey` rather than keeping a second
dispatch — a good rule, and its comment defends it well. But it encoded a soft-key
press as **the string of the button's number**: a click on CANCEL called
`onKey('5')`. So the digit branch ate the click exactly as it ate the keystroke,
and **clicking CANCEL typed a 5 into the PIN**. Meanwhile `hotAt` still offered a
hand cursor over it, because it only asks `rows()` whether a label is there.

**Root cause in one line: one namespace doing two jobs — a soft-key press and a
digit were the same token, and on exactly one screen that is ambiguous.**

The fix keeps the single-dispatch principle and fixes the encoding: `softKey()`
produces `soft0`…`soft7`, `onKey` handles those **first and on every screen**, and
a digit on a menu screen re-enters through the same path instead of carrying a
second copy of the dispatch. CANCEL also now clears the entry — it used to leave
the half-typed digits in `pin`, which was harmless until this same item gave
something else a reason to read them.

**Keyboard CANCEL is CLR on an empty PIN.** CANCEL's number is 5 and 5 is a digit
this screen is entitled to eat; that collision is real and no encoding removes it,
which the user spotted himself. So the escape hatch is the machine's **own** key
rather than an invented letter: period-true, visible on the pad, and it works by
click and by keyboard through the same path as everything else. CLR on a
part-typed PIN still deletes one digit. `padActs` had to stop gating CLR on
`pin.length > 0`, or the one key that escapes the screen would be drawn dead.

## (2) Auto-submit — and why it is 240 ms, not zero

The fourth digit arms a short timer rather than submitting on the keystroke.
**The beat is load-bearing.** `padActs` gates ENT on `pin.length === 4`, so an
instant submit would mean the PIN screen is never once observed holding four
digits — ENT would become a key that can never be live, drawn unlit, refusing the
hand cursor. The item warns against breaking that logic. With the beat, you see
the fourth star land, ENT and CLR are both still meaningful, and if you touch
neither the machine goes on by itself. Under a quarter second reads as "it
submitted", not as a wait.

## (3) Enrolment

`storedPin` is `null` until the first visit sets it; later visits must match. A
wrong PIN clears the entry, says `INCORRECT PIN` in the same orange the withdraw
screen already uses for `INSUFFICIENT FUNDS`, and lets you retry. **No strike
count and no lockout** — the item explicitly warned off one, and the same change
that added enrolment also added the auto-submit that makes a typo unfixable once
the fourth digit lands.

The tube now says **`CHOOSE A PIN` / `THIS WILL BE YOUR PIN`** on the first visit
and **`ENTER YOUR PIN` / `CLR CANCELS`** afterwards. Enrolment that announced
itself only by rejecting you on a later visit would be a silent event.

**Derived vs copied:** `storedPin` is module state, and it BELONGS on `Purse`
beside `account` and `card`. `Purse` lives in `ct/hud.ts`, which this item does
not name, and `account`'s own docstring records the same coordination problem
being solved the same way. Behaviourally identical today — `openAtm` is one module
shared by every ATM, so there is one card and one PIN either way. **Queued, not
taken: hoist `pin?: string` onto `Purse` when someone is next in `ct/hud.ts`.**

## How it is proved

**`scripts/w67-atm-pin.mjs` — 24 assertions, ALL PASS**, driven with the **real
pointer** (`page.mouse.move`/`.click` at a page point projected from each
control's own mesh), because the complaint is about a control that *looked* live
and was not, and only the mouse path catches that. It asks the machine where its
controls are (`__atm.padPoint` / the new `__atm.buttonPoint`) rather than
re-deriving `BTN_Y`/`R_EDGE` here (BUILDER-BRIEF §8), and it hit-tests the CANCEL
point back to the CANCEL row before anything rests on it.

**It can fail, and each fix is caught independently:**

| mutation | result |
|---|---|
| `clickAt` back to `onKey(String(...))` | RED — `screen=pin`, **`pin=3`**: the user's bug reproduced exactly |
| auto-submit removed | RED on the auto-submit assertion, 9 failures |
| enrolment never stores | RED on **only** the two enrolment assertions, 6 failures — CANCEL and auto-submit stayed green, so the assertions are targeted rather than a blanket cascade |

**Registered in `CHECKS`** with the canfail case `atm-cancel-shadowed`, which
restores the original bug in source: `canfail` reports **CAUGHT**, file restored
byte-for-byte. Appended at the far END of the array deliberately, because worker
sixtysix held item 161 in the same file — see below.

**A flaw in my own check, found and fixed.** The first mutation run left the walk
on a screen it did not expect, a `waitForFunction` threw, and node printed a stack
trace instead of the verdict — losing the ten assertions after it and turning a
precise red into "it crashed". Waits are now soft: they record a FAIL naming what
they were waiting for and let the run continue.

**LOOKED at, not just measured** — three of these changes are text on a 236 px
tube, and `shots/w67-atm-*.png` are the five states. My verdict: `CHOOSE A PIN`,
`ENTER YOUR PIN`, `INCORRECT PIN` and `CLR CANCELS` all fit the tube and read
clearly, and `CANCEL ▶` lines up against a lit button 5.

Also: `npm run typecheck` 0 · `npm run build` 0 · `node scripts/health.mjs` 0
`WORLD OK` · `npm run sweep` 0, **96 shots, 0 STATION MISS, 0 COVERAGE** — all
re-run after the merge.

## Found and NOT fixed — for the desk

- **The hint line overlaps the keypad and the `[E] leave` label, and this is
  PRE-EXISTING.** It is visible on the untouched MENU screen with its original
  34-character text: the line is drawn across the bottom of the viewport and runs
  over the CLR/0/ENT key row. My first PIN-screen wording was 74 characters and
  made it markedly worse; I shortened it to 48 after looking at the shot. **The
  underlying fault is that this hint has no width budget** — worth a row, and it
  is not in `ct/atm.ts`.
- **`ct/atm.ts` still duplicates twelve palette literals from `ct/bank.ts`**
  rather than importing `ATM_PALETTE`, because doing so would close an import
  cycle (GOTCHAS 28). The file's own header proposes the fix — a third module
  neither imports. Still outstanding, still fragile, untouched by me.
- **`Purse` wants a `pin?: string`.** See above.

## Shared file with worker sixtysix (item 161)

`scripts/checks.mjs` and `scripts/canfail.mjs`. **No conflict occurred.** Item 161
landed before my final merge, and my merge of it was clean in both files: after
merging, `texdensity` is registered at `checks.mjs:261` (sixtysix's) and
`w67-atm-pin` at `:1116` (mine), and my item-182 classifier is still called at
both sites. Appending my row at the far end of an array sixtysix was editing in
the middle is what made that automatic.

`checks-registered` and `checks-can-fail` were re-run after the merge and show
**only their pre-existing reds** — my check is registered *and* has a declared
failing path, so it added neither.
