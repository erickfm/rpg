# Item 180 — the pawn shop fences what you steal, and my own probe agreed with a broken world twice

Worker onehundredthree. Commits `8d63d8a97`, `e731be855`. All measurement on the
**built bundle**, `vite preview --port 4590 --strictPort`, port proved free with
`ss -ltn`.

The user: *"it should also serve as a fence for the stuff you steal from
neighbors."*

---

## The dependency the row told me to check first — satisfied, and its own text stale

Item 180 says in bold: *"CHECK WHETHER 178 IS DONE BEFORE YOU CLAIM THIS."*
**178 is DONE** (worker sixtyfour, `notes/archive/QUEUE-done-2026-08-02.md:30`).
The row's supporting claim is stale the same way 178's own row was: it says
`PACKAGE_TABLE` and `rollPackage()` have *"zero consumers in all of src/"*, and
`ct/apartment.ts:24` imports `giveRandom` and calls it from two parcel spots.
There is plenty to fence.

## The design choice, which the row asked me to make and state

**The broker takes stolen goods and ONLY stolen goods, asks nothing, and pays
badly.** Of the three games the row listed, this is *"pays less than an honest
sale"* + *"only takes certain goods"*, and deliberately **not** *"pays well but
carries risk"* — a risk game needs heat, a chase or a cop, and the row's own
instruction is not to build a reputation system nobody asked for. What is left
fits in one prompt line and is testable in one keypress.

**"Only certain goods" is what makes him a fence rather than a shop**, and it
cost nothing: the price table is keyed on `PACKAGE_TABLE` ids, so *"will he take
it?"* **is** *"did you steal it?"*. Your cereal is not in it. Neither is the
newspaper you picked up off the pavement.

## Protecting the joke, which the row was explicit about

`PACKAGE_TABLE` weights the disappointment by repeating it — SOCKS and CATALOGUE
are **2 of 8 entries each**, so **half of everything you steal is worth 25–50
cents**.

| | |
|---|---|
| mail-order catalogue | **$0.25** |
| pack of tube socks | **$0.50** |
| video tape | $2.00 |
| toaster | $4.00 |
| pair of trainers | $5.00 |
| book of cheques | $8.00 — the one thing a fence genuinely wants |

Nothing is worth more than a cheap meal. Prices live in `ct/inventory.ts` beside
the loot table they have to stay keyed against; `int-pawn.ts` **imports**
`fencePrice`/`bestFence` rather than carrying a second copy (§8).

## What was built: one spot, no geometry

No mesh, no collider, no panel — the row's own note is that *"a pawn counter may
not need a screen at all"*. **That matters twice over here:** this room's
original user complaint was *"i immediately hit a counter"*, so a fence that put
anything on the customer floor would reopen the bug it is built next to. The
spot is **derived from the counter** (`CTR_ZC + CTR_D / 2 + 0.55`) so it cannot
strand itself if the counter moves. `no-import-cycles` 0, `globorder` 0.

---

## ⚠ MY OWN PROBE PASSED AGAINST A BROKEN WORLD. TWICE.

This is the part worth reading.

`__ct` publishes **no purse accessor** — no cash, no inventory. `crosstown.ts`
is not named by item 180, so per §9 I did not add one. Instead I measured cash
through a comparator the world already publishes: `int-bodega.ts:762` words its
own prompt off the wallet (`cash >= 2.50` → *"buy cereal"*, else *"you're
short"*), and `__ct.spots()` publishes every label. Drain the wallet with the
bodega's own buy spot until it flips, then fence something and watch it flip
back.

**First failure — a branch that agrees with the bug.** The first cut stole one
package, sold it, asserted the till read whatever `cash + price` predicted, and
went green **five runs running**. I called that "both signs exercised". Then I
mutated the world — `ctx.purse.cash += paid` → `+= 0`, a fence that takes your
goods and pays **nothing** — and the probe reported **16/16 PASSED**. That run
had drawn a $0.25 catalogue, whose predicted outcome is *"still short"* — and a
fence paying nothing also leaves you short.

> **A branch whose expected answer is the same as the broken world's answer is
> not evidence.** Only a CROSSING discriminates: "short" → "buy" cannot happen
> unless money actually arrived.

So the "negative sign" was never a second half of the check; it was the
**non-discriminating** half, and treating the pair as coverage was exactly the
self-deception the brief warns about. Fixed with a **population floor on the
discriminating case**: keep stealing and selling until the wallet crosses, and
**fail if a run never gets there**.

**Second failure — a floor derived from the prediction.** I wrote that floor as
`if (expectBuy) crossed = true`. Re-mutated: the sale assertion went red and
**the floor still reported green**, because a floor computed from the prediction
cannot fail when the prediction is what is wrong. GOTCHAS 58's sleeping guard,
in my own check, in the same hour. Now set from what was **observed**.

### After both fixes

```
mutated (cash += 0)   EXIT 1   14/17   3 red, including the floor
clean, five runs      15/15  17/17  15/15  15/15  15/15   all exit 0
```

The **17** is the interesting one: that run drew a catalogue, did not cross on
the first sale, and went back for a second package. That is the floor working,
visible in the score.

---

## A bonus I did not expect: pawn's customer station is CLOSED

`interiors-walk.mjs:1431` hunts for a spot labelled
`/buy|order|serve|till|counter/i` and, finding none, falls back to the keeper
pair authored in the same file — which it rightly refuses to trust: *"a station
I authored, checked against a keeper I authored, in a room I authored, agrees
with itself whatever the player sees. That is not a test, it is a mirror."*
**pawn is one of the four rooms item 251 recorded as failing this way.**

I had just added the thing it hunts for. `scripts/probes/w103-pawn-served-spot.mjs`
measured why it still did not qualify: with no loot in your pockets the label
was *"the broker doesn't want anything you're carrying"* — so **even widening
the regex to `sell|fence|pawn` would not have matched.** A station that only
names itself while you happen to be holding stolen goods is a station the
harness sees only sometimes.

Both wordings now name the counter, which is better player-facing text anyway
(the house habit — *"out to the street"*). **This is the world publishing what
the check hunts for, not the check being loosened** (§7): `interiors-walk.mjs`
is untouched.

```
interiors-walk pawn    29/30 exit 1   ->   30/30 exit 0
```

### And I checked the other assertion against a CONTROL rather than assuming

A later pawn run failed *"the landing is not boxed in — down the walk"* at
0.70–0.75 m, having passed at 0.99 m earlier. Rather than call it a flake, I
rebuilt the **pre-fence commit** (`84d3d2cc8`) and ran it: **the control fails
the same assertion at 0.78 m, scoring 28/30.** So it is pre-existing and
marginal, my change did not cause it, and my change fixes the other of the
control's two failures. **Worth a row** — an assertion that lands at 0.7–0.99 m
against its bar is going to keep costing people control runs.

## Green, on the bundle at `e731be855`

| | |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run build` | **0** |
| `node scripts/health.mjs` | **0** — `build e731be855`, `WORLD OK` |
| `node scripts/bugsweep.mjs` | **0** — 0 STATION MISS, 0 COVERAGE |
| `interiors-walk pawn` | **30/30, exit 0** |
| `no-import-cycles` / `globorder` | **0 / 0** |
| `w103-fence-loop` × 5 | 15, 17, 15, 15, 15 — all exit 0 |
| negative case | `cash += 0` → **exit 1**, 3 red including the floor |

## Found and NOT fixed — for the desk to queue

1. **`__ct` publishes no purse accessor.** Every future check about money,
   buying, selling or the pockets has to reconstruct it from prompt text the way
   this one does. One line beside `roomDims()` — `purse: () => ({ cash,
   inv: { ...inv } })`, a copy for the same reason `party()` is a copy. **This
   is the single thing that would most improve testability here**, and
   `crosstown.ts` is not named by item 180.
2. **`forcePackages` is implemented but not published.** `apartment.ts:3776` has
   it; `__ct` exposes `hermit` and not this. My probe therefore advances days
   until the roll gives it a parcel, which is slower and flakier than it needs
   to be.
3. **`interiors-walk pawn`'s *"landing is not boxed in — down the walk"*** sits
   right on its bar (0.70, 0.75, 0.78, 0.99 m measured across four runs
   including the control). Pre-existing.
4. **The other three `customer station` rooms** — casino, hotel, tax — are still
   falling back to the authored pair. The pawn fix shows the shape: give the
   room a real served spot whose label names the place in **every** state.

## Derived vs copied

`CEREAL = 2.5` and `START_CASH = 14.5` are **copied into the probe with
line-number citations** (`int-bodega.ts:773`, `crosstown.ts:309`) because a
`.mjs` probe cannot import a `.ts` module at runtime — the same constraint that
made `interiors-walk` dev-only until item 251. Every coordinate the probe uses
is **read from `__ct.spots()`**, never typed: the parcel, the counter and the
till are all found by matching their own published label text, so the probe
cannot strand itself against a counter that moved.
