# Item 288 — ceilings: what I gave one, what I did not, and what already had one

Worker onehundredseventeen, 2026-08-03. Port **4190**, built bundle, from
`3145c4ae0` (mainline merged mid-item, which brought item 206 in).

The row's thesis is right and I did not disprove it: **the suite tests floors.**
But two of the five checks it names as candidates turned out not to need the
work, for two different reasons, and that is most of the value here.

---

## 1. Seated legs — TWO ceilings, and they answer different questions

### 1a. The tight one: `scripts/probes/w117-item288-hip-on-its-seat.mjs` — NEW

This is the check item 286's report asked for by name and it is the centrepiece.
**A ceiling in the strict sense: it can only fail by a sitter being moved TOO
FAR, and nothing in it can be satisfied by moving a citizen further out.**

The assertion is a **band**, derived from `ct/citizens.ts:901`'s own dichotomy
rather than predicted:

```ts
const seatFwd = askedFwd > SEATED_KNEE_M ? askedFwd : 0;
```

A hip displacement is legal at **0** (the redrawn shin already clears the seat
face) and legal **above SEATED_KNEE_M = 0.356 m** (the seat is deeper than the
art can reach). **Landing in between is only possible if both corrections were
applied to the same seat.**

**Self-tested both signs.** With `ct/citizens.ts:902` reverted to the historical
`const seatFwd = askedFwd`, rebuilt (`built in` confirmed, GOTCHAS 77), it goes
red on exactly the seats item 286 named at exactly item 286's numbers:

```
diner  (761.47, 2.02)  d 0.275  BOTH CORRECTIONS APPLIED — hip pushed off its own seat
diner  (762.23, 2.02)  d 0.275  BOTH CORRECTIONS APPLIED — hip pushed off its own seat
casino (879.15, 14.98) d 0.115  BOTH CORRECTIONS APPLIED — hip pushed off its own seat
```

Restored and rebuilt. **This is the check that would have failed on
2026-08-02.**

Coverage: **8 of 14 judged, 6 named and reported** (GOTCHAS 34), not silently
dropped. The pairing is unambiguous rather than marginal — 8 hips read *exactly*
0.000 m, the 6 it cannot match are 1.05–80.8 m from any registered seat
(`w117-hip-vs-seat.mjs` is that reconnaissance).

### 1b. The gross one: a ceiling inside `w112-legs-below-the-seat.mjs`

Derived from the sprite, not chosen: `citizenPlane` puts a seated origin at
HIP_ROW 44 of 64 and the frame is 32 texels across, so **at most 20 × 32 = 640
texels² can exist below a sitter's own seat line.** More than that is not a leg.

**Its scope is stated in the file, because it is deliberately loose**: it does
**not** catch a 0.275 m over-correction, which only moves the count from ~45 to
~110 texels². Two different questions; this one must not be tightened until it
appears to answer 1a's.

---

## 2. Lane clearance — **ALREADY TWO-SIDED. The row is wrong here.**

`scripts/builtlane.mjs:224`:

```js
say(worst.clear < 2.6, 'and the walk is bounded by geometry, not by the band',
  `narrowest ${worst.clear} m against a ${(2.0 + 0.72).toFixed(2)} m unbounded band`);
```

That is a ceiling, and a well-reasoned one — its own comment explains that a
narrowest of 2.72 m means *nothing bounded the walk anywhere along 446
sections*, i.e. the measurement was vacuous. It sits beside a population guard
(`stat.length > 50`) and the two floors (`sealed`, `tight`).

**I added nothing and changed nothing.** Reporting that a named candidate is
already done is cheaper than the work.

---

## 3. Texture density — **DELIBERATELY LEFT ONE-SIDED, and this one is subtle**

`scripts/masonry.mjs` does not need a ceiling **because its constraint is an
enum, not a threshold**: it asserts every declared density is on the world's grid
of **8 or 16 px/m** (`masonry.mjs:13`). A set of two legal values is bounded
above by construction; adding "and not more than N" would be a second, weaker
statement of something already exact.

**And the 770 px/m end caps BUILDER-BRIEF §7b cites could not have been caught by
any ceiling here.** `masonry.mjs` only sweeps faces tagged `userData.masonry`,
and a door, a bench, a pillar or a trim box is not masonry. The brief's own
figure — **343 texture creations against 267 declarations, so ~76 surfaces have
no declared density at all** — says the gap is **coverage, not one-sidedness**.
A ceiling bolted onto this check would look like progress and guard nothing.

That is the row's own warning ("do NOT bolt a ceiling onto everything blindly")
landing on a case it did not anticipate.

---

## 4. Contrast and lamp brightness — **NOT DONE, and I am not guessing about them**

`lamplight.mjs`, `lampbeam.mjs`, `lampfloor.mjs`, `lampcensus.mjs` and the
contrast checks were **not surveyed**. I ran out of session before I could read
them properly, and the one thing this item must not produce is a ceiling written
from a filename. Overshoot in lamp brightness is genuinely user-visible (a blown
-out night is as wrong as a dark one), so **this is the highest-value remaining
piece of item 288** and it should be re-queued rather than assumed done.

---

## 5. A false defect this probe was manufacturing, now fixed

`w112-legs-below-the-seat.mjs` reported **jail (994.02, 10.00) as NO LEG BELOW
THE SEAT** on the merged mainline, before I changed anything. The photograph
(`shots/w117-jail-994-10-checkvantage.png`) shows the man's shin and shoe.
Measured after a clean settle, that sitter reads **11,081 px with 1,391 below**
(`w117-jail-seatrow.mjs`).

**The giveaway is that its "visible 2742" was the pixel count of the sitter
measured in the PREVIOUS iteration**, and across two runs the values 3320 and
2742 swapped between a jail bench and a casino stool — which is not something a
world can do. The vantage had not settled: GOTCHAS 80, since `waitPainted`
proves the renderer drew, not that it drew *this* camera. Now settled on
**stability** (two consecutive calm frames), not on a clock — one calm sample is
not enough, because a room fading in passes through arbitrarily small deltas on
its way.

Two other repairs in the same file:

- **Per-pixel noise mask** replacing count-subtraction. The old form produced
  **−1257.9 and −4640.9 texels²** — a negative area — and deducted 35,700 pixels
  of slot screen from a sprite those pixels never overlapped. It can only
  under-count, which is the safe direction for a floor, and `masked` is printed.
- **Coverage as a fraction with both sides on the same basis.** My own first cut
  divided `judged` (which counts exempt sitters that proved visible) by the
  non-exempt population and reported "8 of 10" from two different populations.

**Coverage went 5 of 10 non-exempt → 6 of 10.** Deterministic across 3
consecutive runs — identical verdict, judged count and coverage.

---

## 6. What I did NOT reach, precisely enough to queue

1. **Contrast and lamp brightness ceilings** — §4. The biggest remaining piece.
2. **`w112-legs-below-the-seat.mjs` still judges 6 of 10 non-exempt, not all
   14.** The floor is a **ratchet at the measured value** (55% against 60%
   achieved) and the file says so plainly so nobody reads it as a target. The
   two casino stools that stay unjudged need the **slot reels frozen for the
   duration of the diff** — that is `ct/slots.ts`, not this probe's to change.
3. **`ct/interior.ts:946` exports `takenSeats()` and nothing consumes it.** It is
   not on `__ct`, so on the built bundle it has **no runtime path at all**. One
   hook would take 1a from 8 judged to 14, and would also give
   `SEATED_KNEE_TEXELS` / `SPRITE_H_M` a runtime path — both are hand-copied with
   line citations in 1a today (BUILDER-BRIEF §8, declared not hidden).
4. **A `__ct.latch()` hook**, from item 283 — `LATCH_ARM`/`LATCH_CLEAR` are
   likewise unreachable and re-typed in a probe.

## 7. The generalisation, since the row asked for the habit and not just the fix

The two ceilings that matter here are **geometric**, not photographic, and that
is not a coincidence. 1a works because the world publishes both the body's
position and the seat's, so "too far" is a subtraction. 1b is loose precisely
because it has to infer position from pixels. **Where a ceiling is worth adding,
look first for two published numbers to subtract** — a pixel budget will usually
be an order of magnitude too slack to catch the overshoot that actually reaches
the user.
