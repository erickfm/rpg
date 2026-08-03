# Item 261 — a purse accessor and `forcePackages` on `__ct`

Worker onehundredfive, 2026-08-03. Port **4611** (`ss -ltn` clean before
binding, `--strictPort`). Everything below measured on the **built bundle**
under `vite preview`, never on dev.

---

## What the row said, and what was actually true

The row's premise — **"`__ct` publishes NO PURSE ACCESSOR"** — is **correct**.
Its stronger claim, *"every money check reconstructs cash from PROMPT TEXT"*,
is **not**, and the difference matters because it changes what the fix is for.

Measured before touching anything:

| what a check uses to read money | which checks |
|---|---|
| `__inv.cash()` (`ct/inventory.ts:772`) | `M-bank-int-walk`, `K-pocket-*` |
| `__atm.cash()` (`ct/atm.ts:831`) | `K-atm-walk` |
| `__slots.cash()` (`ct/slots.ts:2421`) | the slots checks |
| **reconstructed from prompt text + typed literals** | **`w103-fence-loop`, `D-walk`** |
| parses `$` out of the prompt *because the prompt is the subject* | `probes/H-atm-read-repeat` (leave it) |

So the wallet was already published **three times over** — once per feature that
needed it and could not edit `crosstown.ts`. Each of the three carries a comment
saying so in as many words. That is the real shape of the problem: not "nobody
can read the money" but **"four modules each opened their own window onto one
object, and the entry point published none."** Two consequences a reader should
know about:

- **every one of the three only exists once its own module has run.** `__inv` is
  `undefined` until the pockets are built, so a check that opens with a money
  read is racing a module load.
- a probe with only `__ct` — which is what `w103-fence-loop`'s author had — has
  to go round all three.

The three are **deliberately left in place.** They are each other's cross-check,
and `__slots.cash()`'s own comment is right that *"my machine moves THAT money"*
is best asserted through the machine.

---

## What landed

**`src/proto/crosstown.ts`** — two entries on `__ct`, beside `hermit`:

- **`purse()`** → `{ cash, inv, account, card }`. Numbers, `inv` a fresh copy,
  on the `citAvoid()`/`party()` rule that a test hook must not be a handle on
  world state. `account`/`card` are optional on `Purse` (`ct/hud.ts:15`) and are
  **normalised to `null`/`true`** rather than passed through as `undefined` —
  `undefined` does not survive `page.evaluate`, so a probe asking
  `'account' in purse()` would otherwise get a different answer than the world
  has.
- **`forcePackages(v)`** → forwards to `apt.forcePackages`, which
  `ct/apartment.ts:152` has published on its own interface since the packages
  landed and which **nothing outside the module could reach**: the one check
  that drives it, `scripts/packages.mjs:32`, goes in through
  `scene.userData.packages.force()` — a side door through renderer state that
  works only because the apartment happens to hang a handle there.
  Named `forcePackages` and not shortened to `packages` the way `hermit`
  shortens `forceHermit`, because `apt.packages()` is a **report** of what is
  out there — a different question wearing the same short name.

**`scripts/probes/w105-purse-hook.mjs`** — 23 assertions, the self-test for
both hooks. **`scripts/probes/w105-five.sh`** runs it five times.

---

## The two checks converted, and what conversion bought

### `scripts/probes/w103-fence-loop.mjs` — the fence

**Before:** `START_CASH = 14.5` copied from `crosstown.ts:309` and
`CEREAL = 2.5` copied from `int-bodega.ts:773`, plus arithmetic against the
bodega till's threshold prompt. Both literals gone; the price now comes out of
the till's own rendered label and the cash out of `purse()`.

**The assertion got stronger, not just tidier.** The old one needed the wallet
to **cross** $2.50, because a threshold cannot tell a 25¢ sale from a fence that
pays nothing — its own author found exactly that, **16/16 green** against
`ctx.purse.cash += 0`. The new one is

```
cash after  −  cash before  ===  the price the counter NAMED
```

which discriminates on **every** sale. Re-ran that same mutation: the roll handed
over a 50¢ pack of socks first — precisely the old probe's blind spot — and the
run went **red on sale 1** (24/27, one FAIL per sale).

Also: `forcePackages(true)` replaces up to **40** `advanceClock(1440)` calls
hunting for a parcel (**a game day is 24 real minutes**); the floor is derived
from the building's own landing count rather than typed; and one new assertion —
*pressing [E] on a refusal moves no money* — was **not expressible at all**
against a threshold prompt.

### `scripts/D-walk.mjs` — the bodega leg of a registered check

**Before:** `bought >= 5 && bought <= 6`, commented *"$14.50 to start and cereal
is $2.50, so the money runs out on the sixth"*. Two more copies of the same two
literals, and **a count of key presses standing in for a measurement of money**.

> ### ⚠ COUNTING PRESSES IS A REAL FLAKE AND THE CONVERSION FOUND IT
>
> My **first** cut asserted `opening − left === bought × price` and **went red on
> a healthy world.** With the opening purse moved to $20.00 the money lands on
> exactly $0.00, the prompt repaints a frame behind the wallet, and the loop got
> one press past the refusal: **9 presses, 8 boxes.**
>
> **Presses are the harness's bookkeeping; the boxes in your pockets are the
> world's.** The assertion now counts `purse().inv.CEREAL` and the two numbers
> come from one read, so a dropped or duplicated keystroke cannot desynchronise
> them. It also now catches a till that charges you for a box it never hands
> over, which neither the old form nor my first cut could.

---

## Proof

**Five mutations, every one caught by the assertion built for it.** Applied to
the source, rebuilt, run against the bundle, reverted.

| # | mutation | result |
|---|---|---|
| A | `purse()` returns the **live** object instead of a copy | w105 **20/23** — 3 red: tampering moved the real cash to 999999, `inv` accepted a planted key, two calls returned the same object |
| B | `forcePackages` a **no-op** | w105 **20/23** — 3 red; on/off both read 3 of 8 |
| C | `purse().cash` a **frozen literal** | w105 **22/23** — 1 red, the buy delta. ⚠ the `__inv.cash()` cross-check **still passed** (14.5 = 14.5), which is the point: agreement is not proof, only movement is |
| D | `int-pawn.ts:368` `cash += paid` → `+= 0` — **the fence pays nothing** | w103 **24/27** — red on sale 1, a 50¢ item. **The old probe scored 16/16 on this** |
| E | `int-bodega.ts:767` `cash -= price` → `-= price * 0.5` | D-walk red on "every box cost exactly the price on the label" |

**And one scenario that is not a defect**, to show the old checks cried wolf:
opening purse legitimately moved $14.50 → $20.00. **Old D-walk: FALSE RED**
(*"8 x $2.50 against $14.50"*). **New D-walk: green.**

**Clean runs, all on the built bundle at `a56df52f3`:**

- `w105-purse-hook` — **5 runs, 23/23 every time, zero spread.** `packages
  on/off/roll 8/0/3 of 8` identical across all five.
- `w103-fence-loop` — **5 runs, 27/27 every time.** Loot spread: cheques ×3,
  tapes ×4, catalogues ×4, socks ×4, toaster, trainers. **Two runs opened with a
  25¢ catalogue** — the case the old probe had to discard as non-evidence and
  this one asserts on.
- `npm run sweep` — **96 shots, 0 STATION MISS, 0 COVERAGE, findings: none.**
- `node scripts/health.mjs` — **WORLD OK**, exit 0.
- `npx tsc --noEmit` — clean.

---

## Found and NOT fixed — for the desk to queue

1. **`D-walk`: *"and pressing E opens the machine: 3 full-screen panels → 3"*
   fails, and it is NOT mine.** Verified properly rather than assumed: I built a
   bundle with **mainline's `crosstown.ts`** and ran the **pre-change**
   `D-walk.mjs` against it — same FAIL. The ATM prompt fires
   (*"FIRST FEDERAL — use the machine"*) and the panel count does not change on
   a held [E]. It is the only red in the check.
2. **`D-walk`'s cereal-counter search is flaky at roughly 1 run in 10.** The
   counter is found by a spiral out from the shop door (`D-walk.mjs:335`,
   r = 0.75 … 3.75 in 0.75 steps × 16 headings). One run returned *"not found
   within 3.75 m"*; **5 further runs all found it at (522.3, 4.9)**
   (`scripts/probes/w105-dwalk-flake.sh`, `N=5`). A leg I did not touch — the
   money assertions sit below it — but a search that misses a fixed counter one
   time in ten will eventually be read as a defect.
3. **Two [E] spots per package, one per side** (`ct/apartment.ts:2310-2318` and
   `2336-2344`) — 16 registered against 8 landings, `ok()` exclusive on
   `q.side`. **Authored on purpose and documented in place**; recorded only
   because a census that assumes one spot per parcel will double-count. w105
   asserts `2 × landings` rather than `>= landings`, so a world that silently
   lost one side of every pair goes red.
4. **`probes/H-atm-read-repeat.mjs` and `probes/pressall.mjs` still read money
   out of the DOM, and were left alone.** Both are one-shot historical
   investigations *into the prompt/wallet rendering itself* — the text is their
   subject, not their instrument. Converting them would delete what they
   measure.
5. **The three per-module accessors could now be thinned to one**, but each is
   load-bearing for its own check and `ct/slots.ts`, `ct/atm.ts` and
   `ct/inventory.ts` are not named by this item. **Left alone; not a silent
   workaround, a boundary.** (BUILDER-BRIEF §9.)

## Derived vs copied

Everything the world publishes is **read**, not typed. The cereal price comes out
of the till's own rendered label in both converted checks; the package floor out
of `scene.userData.packages.list().length`; the fence price out of the counter's
own label. **`START_CASH = 14.5` and `CEREAL = 2.5` are deleted from
`w103-fence-loop`, and `$14.50`/`$2.50` from `D-walk` — four hand-typed copies
of two numbers, gone.** The only constants remaining in `w103` are the storey
ladder for warping onto an upper landing, and it is a *search* — the world's own
`spot.ok()` decides which candidate is right, and floor 0 needs no candidate at
all since `0 × ST = 0` for any storey height.
