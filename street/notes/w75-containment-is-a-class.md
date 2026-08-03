# Item 215 — the containment sweep, made a class, and what it found

Queue worker **seventyfive**, 2026-08-02. Port **4310** (`ss -ltn` clean before
binding; `--strictPort`).

> The item, quoting item 175's author: *"this is a class, not an instance …
> making it take a site name and running it over `park`, `lot` and `jail` is a
> small change and probably the highest-value follow-up on the board."*

It was not a small change, and the reason is the finding below.

---

## What shipped

| | |
|---|---|
| `scripts/w75-site-contained.mjs` | the sweep, taking site names; **with none it sweeps every site `__ct.sites()` publishes** |
| `scripts/w67-jail-contained.mjs` | **deleted** — superseded; keeping both would be two copies to hold in step |
| `scripts/checks.mjs` | one row → **three rows**, one per site, each with its own `extra: ['<site>']` |
| `scripts/canfail.mjs` | `jail-forecourt-open` retargeted at the class version, handed `jail` |
| `scripts/reap-servers.sh` | **never reaps the worktree it was invoked from** |

Probes, in `scripts/probes/`: `w75-list-sites.mjs`, `w75-floor-under.mjs`,
`w75-look-north-of-lot.mjs`.

---

## THE DESK'S ROW WAS RIGHT ABOUT THE SHAPE AND WRONG ABOUT THE PREDICATE

The item says to take item 175's sweep and give it a site name. **Item 175's
escape predicate does not survive being pointed at a second site, and I only
know that because I ran it rather than reading it.**

Item 175 defines an escape as *past the frontage plane and off the site's z
span*. That is **true of the jail**: the side street's flanking buildings stop
at the frontage, so a metre outside the jail's z span really is sky. It is
**false of the car lot**: the street carries on north past `maxZ` 14.20, and
there is real pavement out to **z 16.75**.

Run verbatim, the generalised sweep reported **21 escapes at the lot**, the
first several of which were the player **standing on the street**:

```
e.g. {"from":[12.2,13.8],"yaw":3.14,"to":[12.2,16.8]}
```

I walked out there and photographed it rather than arguing about it —
`shots/w75-escape-z17.png`: buildings, chain-link fence, the lot's cars, the
library, ground underfoot. Not an escape.

**A site rectangle is a claim about who OWNS ground, not about where the world
ENDS.** Generalising the predicate as written would have shipped a check that
goes red on a world that is fine, which is the more expensive of the two
failures — a red nobody believes gets loosened, and then it never fires again.

## So the assertion is now the thing the user actually said

> *"allow for out of bounds."*

**THE PLAYER MUST NEVER STAND WHERE THERE IS NO FLOOR.**

`groundAt()` cannot answer that, and this is worth writing down because it is
the first thing anyone reaches for. `groundPick` (`crosstown.ts:1263`) falls all
the way through to

```ts
return put(Math.abs(x) > ROAD_HALF && Math.abs(x) < FACE + 0.3 ? KERB_H : 0);
```

— it never returns `null`. It names a height for **every point in R²**, void
included. That is exactly why item 175 could say, correctly, *"this was never a
floor hole"*: the picker is continuous over the emptiness as well as over the
city.

So the floors come from the **scene**: every `Mesh`, its geometry bounding box
taken through its `matrixWorld` **by its eight corners** (a floor is a
`PlaneGeometry` rotated −90° about X, so only the transformed box is flat in Y —
doing the corners is what makes the rotation irrelevant), keeping the ones that
are thin in Y and at least a metre across in both ground axes. 359 of them.

**This needs no per-site envelope table, and that is the point.** An authored
envelope is a list of places somebody thought of — the precise failure this file
exists to replace.

## The predicate self-tests on both signs, before a leg is walked

A "no floor here" predicate that finds no floors anywhere goes red on a sealed
world; one that finds a floor everywhere goes green on a hole. Both are silent,
and this repo has shipped both shapes. So:

| control | must read | measured |
|---|---|---|
| the middle of the road (0, 0) | FLOORED | 11 floor meshes |
| 60 m past the world's own south clamp (0, −170) | VOID | 0 |
| the scene as a whole | ≥ 100 floor meshes | 359 |

Get any of them wrong and the run **exits 3 without producing a verdict**. It
was also validated against the two holes already known: the jail slot at
(60, −112) reads 0 floors, and the lot centre, park centre, jail forecourt and
side street all read floored (`scripts/probes/w75-floor-under.mjs`).

---

## Results, per site

All three fills **saturated** — none hit its budget, none left a place queued.

| site | walks / budget | places (in-site) | **escapes** | off the site rect | lane | time | verdict |
|---|---|---|---|---|---|---|---|
| jail | 136 / 720 | 17 (7) | **0** | 0 | 13.50 m | 2m47s | contained |
| park | 624 / 1792 | 78 (47) | **0** | 0 | 26.75 m | 12m52s | contained |
| lot | 368 / 1232 | 46 (27) | **10** | 21 | 22.75 m | 7m25s | **RED — real hole** |

Note the two right-hand columns disagreeing at the lot: **21 walks left the
site's rectangle, 10 of them were actually off the world.** That gap is the
finding of this item in one line.

### THE LOT IS OUT OF BOUNDS AT ITS NORTH END — a new, real defect

**10 of 368 walks finished with no floor under the player**, at
**x 7.93…15.26, z 16.93…19.00**. The east pavement's ground ends at **z ≈ 16.6**
(`scripts/probes/w75-floor-under.mjs` scans it at 0.5 m: 3 floor meshes at
z 16.5, zero at z 17.0) and **nothing stops the player walking past it.**

The chain is all walking, no teleporting: inside the lot at (12.2, 13.9) → walk
north to (12.2, 16.95) → walk again to (14.3, 19.00).

I looked: **`shots/w75-escape-z19-look-s.png`** is the player at (12, 19) facing
south — grey void filling the frame, with the road's yellow centre line visible
as a thin sliver far off to the right. Standing on nothing.

**This is the same class as the jail's forecourt flanks**, which is the whole
premise of the item, and it is the first thing the class version found that the
instance version could not have.

**I did not fix it.** It is a change to `src/proto/ct/street.ts`, which item 215
does not name (BUILDER-BRIEF §9). **It needs its own queue row** — see below.

---

## Things I changed that the item did not literally name

- **`scripts/reap-servers.sh`.** The item flagged it and said *"fix it or work
  around it, and say which"* — **fixed.** With no arguments it spared everything
  outside an agent worktree and everything named on the command line; a builder
  running it from inside its own worktree is neither, so the default invocation
  killed the caller's own preview. Measured both signs from this worktree with a
  live server on 4310: pre-fix `--dry` printed two lines naming our own vite
  pids; post-fix it prints `sparing pid … — agent a91f20f8750a20ba9 is US`.
  One line: derive our own id from `$PWD` and add it to `LIVE`.
  **The sweep's dead-server guard stays regardless** — a server can die for
  reasons no script owns.

## Design decisions, and why

- **Three check rows, not one that sweeps all three.** One row is ~25 minutes,
  which blows `SLOW_MS` and reads as `TIMED OUT` rather than as a verdict;
  `--only` could then not run just the site you are working on; and a table that
  names the SITE is a report where `FAILED (1)` is a thing you go read stdout
  for. The script still takes any number of sites.
- **Budget derived from the site** (`cells × DIRS`) rather than item 175's
  constant `700`. That constant was right for an 18×14 jail and would have
  **silently truncated the 32×30 park**, whose ceiling is 1792.
- **Frontage derived, not typed.** `street.ts:655` writes the street edge as
  `XB = side * FACE` with the depth running away from it, so the frontage is
  whichever X face is nearer x = 0 — park `maxX −7`, lot `minX 7`, jail
  `minX 57` (`street.ts:981`, *"the frontage: the shell's old west face"*). All
  three derive correctly and the sweep prints which face it chose.
- **…and guarded rather than trusted.** Guess the frontage wrong and the fill
  seeds against a sealed back wall, walks the pavement, finds nothing and passes
  vacuously. The `entered and stood in` assertion requires **≥ 4 places inside
  the site**. Four, not one: one in-site place is what a fill gets by
  overshooting the frontage on a single lucky leg.
- **Scope reduced from item 175's 12 m outside the frontage to 4 m.** At 12 m
  the park's box swallows the whole carriageway — 64 extra road cells, ~512
  extra walks, ~18 minutes measuring a road nobody asked about. **It does not
  narrow the assertion:** walks that leave the box are still checked, they are
  simply not pushed back as frontier.
- **Three seeds across the frontage, not one.** A single centre seed is itself a
  route someone thought of, and on a site whose middle is blocked it can fail to
  get in at all.
- **3 m cells and 900 ms legs inherited unchanged from item 175**, with its
  measurements, because they are validated by the mutation rather than by
  argument.

## Population floors, all of which must FAIL on "I measured nothing"

1. `__ct.sites()` empty → exit 3. Not hypothetical: the jail spent a commit
   published-by-nobody because `publishSite` is optional in `street.ts`'s params
   (`street.ts:995`).
2. A named site that does not exist → exit 3, listing what is published.
3. The floor predicate's two controls and its 100-mesh floor → exit 3.
4. Any site that walked **zero legs** → FAIL.
5. Any site with **< 4 in-site places** → FAIL.
6. Budget exhausted **with frontier left** → FAIL (kept from item 175, including
   its distinction between "spent the budget" and "stopped with work left").
7. The world stopped serving during the run → FAIL, every result unmeasured.

---

## FOR THE DESK — what I found and did not fix

1. **`npm run checks` is now RED on `w75-site-contained` for the lot, and that
   red is correct.** The check is right and the world is wrong (BUILDER-BRIEF
   §7). **Do not loosen it.** Queue the world fix:

   > **The player can walk off the world at the north end of the car lot.**
   > Ground ends at z ≈ 16.6 on the east side; nothing stops you walking to
   > z 19. Reached by walking from inside the lot, 10 of 368 walks.
   > Repro: `SHOT_URL=… node scripts/w75-site-contained.mjs lot`.
   > Evidence: `shots/w75-escape-z19-look-s.png`.
   > Done when that command reports 0 escapes at the lot **and** the lot's own
   > 2 m lane assertion still passes.

2. **The same question has never been asked of the ROAD or the pavements.** The
   sweep is seeded per *site*; the north end of the street is only in this
   report because the lot's fill happened to reach it. A world-wide fill seeded
   on the street — no site at all — is the obvious next instrument, and it is
   now cheap: the floor predicate needs no envelope, so it works anywhere.
   `scripts/probes/w75-floor-under.mjs` already shows the road's own floor mesh
   runs north past z 19 while the pavement beside it stops at 16.6.

3. **`O-jail-walk.mjs` and `w15-jail-walk.mjs` are still route-based.** Item 175
   left them and so did I; they are not wrong, they are narrow.

4. **`checks.mjs`'s summary table prints three rows all reading
   `w75-site-contained`** and does not show which site each one is. The `extra`
   args are what distinguish them and the table never shows `extra`. A one-line
   fix exists — use `extra.length ? `${name} ${extra.join(' ')}` : name` as the
   row LABEL while `name` keeps resolving the file — but it is inside the shared
   loop over all 137 rows, which item 215 does not name, so I left it.
   `--only` matching is unaffected either way.

5. **The jail's fill stands in only 7 in-site places** against the park's 47.
   The jail's building occupies most of its own site, so there is genuinely
   little to stand on — and the `jail-forecourt-open` mutation is still CAUGHT
   at that coverage, which is what licenses it (settings validated by mutation,
   not by argument). Worth knowing before anyone reads 7 as thin.

---

## Verified

- `scripts/w75-site-contained.mjs jail` — **all contained**, 0 escapes / 136 walks.
- `scripts/w75-site-contained.mjs park` — **all contained**, 0 escapes / 624 walks.
- `scripts/w75-site-contained.mjs lot` — **1 FAILED**, 10 escapes / 368 walks.
  The check is right; the world is wrong. See item 1 above.
- `canfail jail-forecourt-open` — **CAUGHT**, file restored byte-for-byte.
  Run **twice**: once against the site-rect predicate and again after the
  predicate was replaced, because a rewritten assertion that is no longer able
  to see the bug it inherited is the whole risk of this item.
- `scripts/reap-servers.sh --dry` from this worktree, both signs — pre-fix names
  our own two vite pids as reapable, post-fix prints `… is US`.
- `npm run typecheck` 0 · `npm run build` 0 · `node scripts/health.mjs` 0
  `WORLD OK` · `npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE**, no new
  console errors (the `[interior:hotel] NO BUILDING NAME` warning is the known
  standing one).
- `node scripts/checks.mjs --only w75-site-contained` resolves **3 of 137 rows**.
