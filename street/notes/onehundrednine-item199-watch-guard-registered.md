# Item 199 — the watch/panel guard is registered, and it now has a population floor

Worker **onehundrednine**, 2026-08-03. Port **4650** (`ss -ltn` said free;
`--strictPort`). Verified on the **built bundle** via `npx vite preview`, build
`d336fa2fa`.

## What the item asked, and what it got

> DONE WHEN: the guard is registered, it has a population floor, and reverting
> item 189s fix turns the suite red.

All three, and the third is demonstrated through `checks.mjs` itself rather than
through the bare script:

```
SUITE_EXIT=1
  ✗ watch-vs-panel  FAILED (1)   (25s)
```

## 1. Registered — and that meant MOVING it

`scripts/probes/w68-watch-vs-panel.mjs` → **`scripts/watch-vs-panel.mjs`**.

Not tidiness. `scripts/checks.mjs` spawns `node scripts/<name>.mjs`, and it
carries a startup guard (added after a `scripts/` reorganisation left 45% of the
suite exiting `MODULE_NOT_FOUND` and printing `FAILED (1)`, which is the row a
real defect prints) that **refuses to start** if a registered name is not on disk
at that path. A row pointing into `probes/` would have stopped the whole suite.

BUILDER-BRIEF §7a says a probe graduates out of `probes/` when something calls
it. Registering it is that call. Its three `../lib/` imports became `./lib/`.

Registered as:

```js
['watch-vs-panel', 'does the wristwatch stand down while a cabinet is up?', ['watch-over-panel']],
```

Default tier, not `--slow`: it warps rather than walks, **24 s** against a
preview, well inside the 180 s ceiling.

## 2. The population floor — phase 5

**The check named two panels by hand, in a world that grows panels.** That is
precisely how `masonry.mjs` came to examine zero faces (GOTCHAS 79). Its own
author wrote that the fault "will hit the mail (155) and the library PC (157)" —
**both of those panels now exist**, and phases 1–4 would never have noticed them
arriving.

So the population is the world's **own roster**, `__hud.panels()`, and every
member is accounted for. Nothing in phase 5 is a typed list of ids; a new panel
joins on the next run with no edit to the file.

Measured 2026-08-03 (`scripts/probes/w109-panel-roster.mjs`), roster = **7**:

| panel | raises from anywhere? | pitch with it up, DOWN requested |
|---|---|---|
| `ct-pockets` | yes | **-1.25** — the warp wins (screen-space) |
| `ct-loan` | yes | **-1.5707** — the pose is already straight down |
| `ct-library-pc` | yes | **-1.25** — the warp wins |
| `ct-atm` | yes | -0.1419 — the focus lock holds the eye |
| `ct-letter` | yes | 0 — the focus lock holds the eye level |
| `ct-slots` | **no** | machine-bound |
| `ct-blackjack` | **no** | machine-bound |

`ct-slots` and `ct-blackjack`: `openPanel` returns `true`, but the panel is not
up on the very next evaluate and never becomes up — polled at 0 ms, 250 ms and
1000 ms, **zero console errors**, so it is not the `resolving the diegetic
surface threw` path. Their own per-frame "you are up while you are sitting here"
hook re-closes them. Deliberate, and not this check's business. They are
**EXCUSED, not skipped**.

Five floor assertions, which fail for five different reasons:

1. the world publishes a roster at all
2. every member was swept or excused — `raised + refused === roster`
3. **no panel has silently stopped raising** (`refused ⊆ MACHINE_BOUND`)
4. **the excusal is not stale** (`MACHINE_BOUND ⊆ refused`) — 3 and 4 are the two
   signs of one fact and they fail apart, so they are not one `deepEqual`
5. the at-risk count is **not 0** — the only way phase 5 could sweep seven panels
   and assert nothing

## 3. MY OWN CHECK WAS WRONG FIRST, AND THE WORLD WAS RIGHT

My first cut of phase 5 asserted `pitch < -0.95` for all five raised panels — the
same per-panel precondition phases 2 and 3 carry. **It failed `ct-atm` (-0.1419)
and `ct-letter` (0).**

That is the check being wrong (BUILDER-BRIEF §7). A panel with a diegetic focus
lock does not let you point the head where you like: `crosstown.ts` holds the eye
on the face's own pose and **`__ct.warp`'s pitch argument loses**. Those two
cannot put the player's head down while they are up, so the watch was never going
to rise over them and there is nothing here to defend.

**But the naive repair — dropping the pitch floor and asserting STOWED anyway —
is worse than the bug.** With the head not down, the watch is stowed for the
*honest* reason, so the assertion passes while proving nothing and **counts as
coverage it is not**: the vacuous pass this phase exists to prevent, wearing the
opposite hat. It would have gone green on a completely reverted item 189.

So each panel is **classified by what the world actually did** — at-risk vs
pose-safe — and only the at-risk ones carry the assertion. 3 of 5 today.

## 4. Both mutation cases, and they fail apart

`watch-over-panel` proves the **verdict** can go red. It cannot prove the
**population under** it can — `masonry.mjs`'s own flag sailed through the entire
period it was examining zero faces, because with no faces there was nothing to
break. So there are two, the fourth `*-blind` pair in `canfail.mjs` after
`footprint-blind`, `glow-blind` and `masonry-blind`.

| case | file | mutation | watched red |
|---|---|---|---|
| `watch-over-panel` | `crosstown.ts:2002` | drop `&& !panelUp()` | **6 of 32** fail; **14,897.4 px²** of the loan form under the watch |
| `watch-panel-blind` | `ct/hud.ts` | `panels: () => []` | **4 of 26** fail, **all of them `5. FLOOR:`**; phases 1–4 stay green |

`14,897.4 px²` reproduces worker sixtysix's original figure to the decimal.

The blind case empties **only the test hook** — all seven panels are still there
and still open. Every assertion about the watch still passes. That is the point:
the two cases cannot cover for each other.

```
2/2 checks caught their mutation
every mutated file restored byte-for-byte
```

The needle for `watch-over-panel` quotes the **whole `hud.watch(...)` statement**,
not the bare `&& !panelUp()` term: a fragment is what a refactor re-wraps, and a
needle that stops matching guards nothing while looking exactly as green as one
that does. Five stale needles this week.

## 5. Numbers

| | |
|---|---|
| assertions, before / after | 20 → **32** |
| five consecutive runs | **32/32, exit 0, all five** — population identical every run (7 published, 5 raised, 2 machine-bound, 3 at risk, 2 pose-safe). **Zero spread.** |
| runtime | 23.9 s / 24.7 s / 25 s / 26 s (registered row) |
| `--selftest` through `checks.mjs` | exit 0, 52 s |
| typecheck | clean |
| `npm run sweep` | **0 STATION MISS, 0 COVERAGE**, findings: none |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `checks-registered.mjs` | exit 0 |
| console errors | **0** in every run |

Inherited warnings only: `willReadFrequently`, `CONTEXT_LOST_WEBGL`, GL
ReadPixels stalls — all documented (GOTCHAS 80).

## 6. Found and NOT fixed — for the desk to queue

1. **`ct-atm` and `ct-letter` have no watch guard that can prove itself.** Their
   focus lock pins the pitch, so nothing this check does can create the
   dangerous configuration for them. They are currently safe *by pose*, not by
   the `!panelUp()` term — if either is ever re-posed onto a horizontal face
   they become at-risk and phase 5 will start asserting on them automatically.
   No action needed today; recording it so nobody reads "5 raised" as "5
   defended".
2. **`ct-slots` and `ct-blackjack` are never swept**, because they refuse to
   raise away from their stool. Sweeping them needs the player seated at the
   machine, which is a walk-and-sit and a bigger job than this item. The floor
   asserts the excusal in both directions so it cannot rot silently.
3. **The wallet is still untested against a panel** — worker sixtyeight flagged
   this and it is still open. It is a bottom-centre DOM element in the same
   corner as the watch. Opening it calls `closePanels()`, so wallet-then-panel is
   safe; **panel-then-wallet was not tested by sixtyeight and is not tested by
   me.** Outside this item's named files.
4. **`ghosts.mjs`, batched here by `notes/onehundred-item84-three-checks.md`, is
   already done.** `checks-registered.mjs` exits 0 and does not mention it;
   `prompt-not-a-ghost` was registered by w85 on item 236. Nothing to do.

## 7. Files

- `scripts/watch-vs-panel.mjs` — moved from `scripts/probes/w68-watch-vs-panel.mjs`, phase 5 added
- `scripts/checks.mjs` — one row
- `scripts/canfail.mjs` — two cases
- `scripts/probes/w109-panel-roster.mjs` — the sizing measurement behind the table above
- `scripts/probes/w109-five-runs.sh` — the five-run spread

Values derived, not retyped: the roster comes from `__hud.panels()` at runtime,
the raised/at-risk counts from what the world did, and the excusal is asserted
rather than assumed. `MACHINE_BOUND` is the one hand-written list, and both
directions of it are checked so it cannot go quietly wrong.

**On arrival:** my worktree was checked out at the **initial commit**
(BUILDER-BRIEF §0 — now at least 15 agents). Reset to `add-stick-and-city98` +
`npm install`.
