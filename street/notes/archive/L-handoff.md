# L — the casino games: slots DONE, blackjack maths done

Two games, one file each, one shared everything-else.

---

## THE NUMBERS, which is what was asked for first

| | slots | blackjack |
|---|---|---|
| **return to player** | **92.834%** | **99.546%** |
| how it was got | exact enumeration of all 10,648 stop combinations | 2,000,000 hands played by basic strategy |
| confirmed by | 100,000 simulated spins, agreeing to 0.391% | four degraded strategies, each losing by its published amount |
| hit rate | 19.00% — 1 in 5 spins pays | 4.748% naturals against a textbook 4.75% |
| the check | `node scripts/L-slots-rtp.mjs all` | `node scripts/L-blackjack-rtp.mjs all` |

**The two numbers mean opposite things and that is deliberate.** The slot
machine's strips were designed BACKWARDS from a number I wanted, so 92.8% is a
target that was hit. Blackjack is a solved game, so 99.5% is a TEST: it is what
those rules are worth to anyone who looks them up, and a wrong implementation
would have produced 97% and I would not have been allowed to adjust a pay rule
until it agreed. There is no tuning parameter in `ct/blackjack.ts` at all.

The gap between them is the point, and it is asserted rather than remarked on.
The user: *"that difference is why a casino floor has both."*

---

## SLOTS — playable, in the world, now

Walk into SEVENS, sit at any of the 96 stools, and the machine opens because you
SAT — not on a second `[E]`. `SPACE` spins, `B`/`M` bet, `I` feeds a $5 note,
`C` cashes out, `ESC` leaves and pays you out on the way.

**The feel, measured rather than described:**

```
reel 1 rests at 1.33 s   reel 2 at 2.70 s   reel 3 at 3.27 s
gaps 1.37 s and 0.57 s, and the ORDER is a guarantee, not a coincidence
free speed 26.0 stops/s, down to 7.7 by the end of the brake
the detent overshoots by 0.157 of a stop and is pulled back
a live spin holds reel 3 0.98 s longer and crawls it — on 539 of 539 live spins
the 250 jackpot takes 2.78 s to count up; a 2-credit cherry takes 0.18 s
```

**The near misses are honest.** Every stop is 1 in 22 and the strips are the
whole truth — no virtual reels, which is the standard-by-1997 trick that is what
people mean when they say a slot machine lies. Reel 3 is the SHORT REEL: one
seven against two on each of the others, so SEVEN–SEVEN–something is 21 times
likelier than the jackpot, and that ratio is just how many sevens are printed on
the tin. You can count them.

**I played it twenty spins**, which the queue asks for by name: 5 hits, ended on
99 credits from 100, biggest win 8. That is *"sit and play a while, win
sometimes, and drift down slowly"* felt rather than computed.

---

## WHAT I TOOK RATHER THAN BUILT

Not one line of the machinery is mine, and that was the instruction:

- **K's `makePanel`** (`ct/hud.ts`) — the cabinet, the world frozen behind it,
  ESC, one bezel and one typeface. I built no window, no open/close, no input
  freeze and no exit. Blackjack will use the identical call.
- **K's wallet** — `ctx.purse`, the one account, with `ct/int-bodega.ts` as the
  only precedent for spending from it. **There is no second wallet.** The credit
  meter exists only between sitting down and standing up, and `onClose` cashes
  it out, so *"what you win is in your wallet when you stand up"* is true by
  construction rather than by remembering to press a button. Proposed rate:
  **1 credit = $0.25**, a quarter machine, which puts the 250x jackpot at $62.50
  — a good night on this street rather than a life change.
- **G's seats** — I never touched `ct/int-casino.ts`.
- **F's `ct/world.ts` glob** — `register()` is found automatically, so there is
  no line in `crosstown.ts` to add and none to forget.

---

## THE ONE THING THAT NEEDS CHASING

**Blackjack has nowhere to sit.** Asked in
`notes/L-for-G-which-seat-is-which-machine.md` §4 and repeated in
`notes/L-for-DESK-blackjack-file.md`.

The felt table at `TX = -2.6, TZ = -13.0` is the only game on that floor with a
dealer standing at it, and the only one shaped like dealer-versus-player —
roulette is round, craps is long and high-sided, poker seats six against each
other. My read is that it IS the blackjack table. **It registers no seats at
all**, so today the one table that is already a blackjack table is the one you
cannot sit at.

I cannot bridge it the way I bridged the slots: those stools publish
`'sit at the slot'`, which is unambiguous, while every table stool on that floor
publishes `'sit at the table'` — so bridging on it would open blackjack at the
roulette wheel. **It needs three or four seats on the felt table's player side,
and they are G's to place.**

Two other asks are open and NEITHER is blocking:

- `notes/L-for-DESK-seat-opens-a-game.md` — `onSit`/`onStand` on `Seat`. The
  slots ship without it, bridged on G's published label. Granting it deletes the
  bridge from **both** games.
- `notes/L-for-K-money-and-the-panel.md` §2 — K to rule on the credit rate.
  Mine is one constant, `CREDIT` in `ct/slots.ts`; if the answer is a different
  number it is a one-line change in one place.

---

## THE CHECKS, and what each of them can see

Four for the slots, one for blackjack. Every one names the claim it makes rather
than the subject it looks at (GOTCHAS §24), refuses an unknown mode instead of
exiting 0 (§34), asserts its population before its absences (§34), and has a
`--selftest` that breaks the thing on purpose and requires a red (§27).

```
scripts/L-slots-rtp.mjs        the machine returns 92.834%        4 / 4 CAUGHT
scripts/L-slots-feel.mjs       reels stop one at a time           9 / 9 CAUGHT
scripts/L-slots-glass.mjs      the glass shows the machine        6 / 6 CAUGHT
scripts/L-slots-inworld.mjs    you can sit down and play it       16 OK, needs SHOT_URL
scripts/L-blackjack-rtp.mjs    the table returns 99.546%          6 / 6 CAUGHT
```

Three run in node with no browser, because the game logic draws nothing and
imports nothing — which is the whole reason the *feel*, normally the part you can
only check by looking, is arithmetic here.

`L-slots-glass.mjs` is the one worth knowing about: GOTCHAS §1 says screenshots
prove nothing in this project, so `paintMachine` is handed a **recording 2D
context** and the call list is asserted. Its strongest verdict is that all 54
reel/row cells draw exactly the symbol that reel's strip has at that position,
compared pixel for pixel against the same painter drawing that symbol alone.
Everything else can be right and the player still be shown the wrong reel.

That only works because the panel is a deterministic function of `(view, t)`
with no unseeded grain in it — which is itself one of the verdicts, so the day
somebody speckles the reel cream with `Math.random` the file goes red rather
than quietly stopping being able to check anything.

---

## BUGS THIS FOUND, and the one lesson behind most of them

Fourteen real defects, of which these are the ones somebody else can learn from:

**The brake lurched.** A cubic ease-out over the remaining distance is the
obvious thing and is wrong: `1-(1-k)³` is steepest at k=0, so the reel jumped to
90.9 stops/s the instant the brake came on against a 26 stops/s free run. It read
as the reel being kicked. Constant deceleration is velocity-continuous with the
free spin, which is the actual requirement.

**Every reel rested 0.16 of a stop past its detent, for ever** — the scheduler
measured to where the brake AIMS rather than to where the reel RESTS. A permanent
five-pixel offset on every symbol: too small to name from a screenshot, wrong in
every frame, and invisible to the maths because `stop` was always correct.

**`dt` was clamped to 0.05**, copied from `main.ts:107` where it is right for a
reason that does not apply — the world clamps so a long frame cannot teleport a
body through a wall, and a reel has nothing to collide with. At 15 fps the
machine ran at 75% speed. Position is a pure function of schedule time now: 60
fps and 15 fps land on the same symbol at 3.27 s, to 0.00 s.

**ESC was dead.** It closed the panel and the frame hook reopened it next frame,
because sitting is what opens it and you are still sitting.

### The lesson, which cost me five separate rounds

**Five times, a mutation applied, broke nothing, and certified as a working
check.** Every one was the same shape: the mutation replaced an exported binding
while the code that mattered closed over the module's own. `simulate()` inside
`ct/slots.ts` could not see a mutated `spin`; `paintReel` could not see a mutated
`symAt`; `playRound` could not see a mutated `BLACKJACK_PAYS`, `dealerDraws` or
`value`.

GOTCHAS §27 warns about this in one sentence — *"a mutation that does not
actually break the thing proves nothing, and looks exactly like a check that
works"* — and I hit it five times anyway, because the failure is silent and
looks like success.

**Two things came out of it that are worth copying:**

1. **A rule the game reads THROUGH is a rule a check can bend.** `FEEL` in
   `ct/slots.ts` and `RULES` in `ct/blackjack.ts` are exported mutable tables for
   exactly this reason — and both earn their keep anyway, because they are the
   thing a tuner wants and the thing the felt prints.
2. **Where a mutation cannot reach, assert the fact directly.** All-aces-eleven
   cannot be injected into `playRound`, so `value()` is asserted against eight
   known hands instead — two aces are 12 and not 22, an ace demoted by a bust
   gives a HARD 15. That is a better check than a mutation: it says what a hand
   is WORTH rather than only that something changed.

And one where a band was the wrong instrument: the dealer hitting soft 17 is a
REAL rule worth 0.2%, so a table that quietly switched to it still lands inside
99.0–99.8% and looks fine. Tightening the band until 0.2% shows would be brittle
against sampling noise and is the tolerance-by-argument §27 warns about. The
dealer's rule is asserted behaviourally now, on every total it can hold, and
against the sentence the felt prints.

### And three times my own PROBE was the thing that was wrong

Worth its own heading because in each case I was one step from "fixing" working
code:

- **A twenty-spin playtest reported the anticipation never firing**, on three
  spins that were live. It sampled at the instant reel 2 came to rest; the crawl
  starts a median 0.38 s after that and up to 0.81 s, because reel 3 can only
  rest at moments one revolution apart. GOTCHAS §48's stride problem in time
  rather than in space. Settled two ways: 539/539 live spins in node, 14 of 60 in
  the browser against an 18% live rate.
- **`L-slots-inworld.mjs` went 8-red under load and green idle**, on a world that
  had not changed — a 250 ms sleep after a warp is plenty on an idle machine and
  not enough right after a build and three suites. Every fixed sleep standing in
  for something the render loop drives is a wait for the event now, and it is
  verified the way GOTCHAS §30 says to verify this class: three concurrent
  copies, 3/3 green.
- **The glass check measured braking speed as "the slowest in the last 0.1 s"**
  and got −1.9 stops/s. That window is the CLUNK, where the reel is pulled BACK,
  so the assertion passed on a negative number and would have passed on a reel
  with no brake at all.

---

## WHERE TO STAND, for whoever verifies this

**Slots.** Any stool in SEVENS. Ask the world rather than typing a coordinate —
every one of them publishes itself:

```js
window.__ct.seats().filter(s => s.label === 'sit at the slot')   // 96 of them
```

Warp to `.at`, press `E`, and the panel must open with no second press. Then:
`I` to feed it, `SPACE` to spin, and `ESC` — the wallet must go up by exactly
`credits × 0.25` and the meter must read 0.

```bash
npm run build && npx vite preview --port <yours> --strictPort &
SHOT_URL=http://localhost:<yours>/ node scripts/L-slots-inworld.mjs all
```

**It must be checked against `vite preview`, not the dev server** (GOTCHAS §28,
§37): `ct/slots.ts` reaches `ct/hud.ts`, which is exactly the shape that drops a
module to an undefined namespace in the Rollup bundle while working perfectly in
dev. That is how GOLDEN ACES shipped missing. It is reached by a DYNAMIC import
for that reason — and, separately, because `ct/hud.ts` imports
`virtual:build-stamp`, which does not exist outside the bundler, so a static
import would have made the whole file unloadable by node and cost three checks to
save one line.

And do not let the script pick a port: it refuses to run without `SHOT_URL`
rather than defaulting to one, because a default port is a live server belonging
to whoever started it (GOTCHAS §26, §48). My own assigned 4193 was already taken
by another agent, which is precisely how that goes wrong.

**Blackjack.** Nothing to stand at yet — see THE ONE THING THAT NEEDS CHASING.
`node scripts/L-blackjack-rtp.mjs all` needs no world at all.

---

*L. `ct/slots.ts` and `ct/blackjack.ts`; `ownership.sh L` clean on every commit.
`ct/blackjack.ts` is not in OWNERSHIP.md yet — asked, not assumed.*
