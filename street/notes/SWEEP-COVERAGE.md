# The sweep now covers the world it claims to — and finding that out found a bug

Written by the builder who extended `scripts/bugsweep.mjs`. The desk had
measured that the routine instrument (`npm run sweep`, 48 shots) photographed
**one of the world's 12 rooms and none of its 3 sites**, and asked for the
instrument to cover the whole world, then be run, then be looked at.

## What changed

`scripts/bugsweep.mjs` now derives stations from the world's own registries —
`window.__ct.roomDims()` (12 rooms: bank, bodega, burger, casino, church,
diner, hotel, jail, library, pawn, tax, thrift) and `window.__ct.sites()` (3
sites: park, lot, jail) — instead of hand-typed coordinates. Per room: an
**entry** station just inside the door facing in, a **far** station in
whichever corner is geometrically farthest from the door (computed, not
guessed) looking back at it, and a **wide** station from room centre facing
sideways to catch furniture along a side wall. Per site: **overview**/**back**
along whichever axis is longer, plus **cross** looking across the short one.

This was deliberate: GOTCHAS records that every interior moved +80 m in x when
`int-bank.ts` was inserted, so any station written as a literal number rots the
same way the 47-line hand-typed list already had. Asking the registries means
the sweep re-derives its own coordinates every run and cannot go stale the same
way twice.

**Naming collision found and fixed while building this:** `jail` is both a
room id (the cells) and a site id (the yard outside it) — same string, two
different things in two different registries. My first pass named both
`<id>-far` / `<id>-wide`, and the site's shots silently overwrote the room's
on disk. Sites are now named `overview`/`back`/`cross` specifically so the two
id spaces can never collide on a filename again.

**Self-check added, and it immediately caught a real bug** (see below):
`verifyLanded()` reads `window.__ct.pos()` after every dynamically-aimed warp
and compares it to the intended target. If a warp landed more than 3 m away,
it's logged as a `STATION MISS` in the sweep's own error output — because a
screenshot that quietly captured the wrong place under the right filename is
worse than a missing one (GOTCHAS §20: "an unread screenshot is not an
observation"). The original 48 stations don't carry this check; they're
established, hand-verified positions on open ground.

The 48 original stations are untouched — same names, same coordinates, same
`shots/bug-*.png` paths other tooling and ledger rows cite.

## Coverage, before vs after

| | before | after |
|---|---|---|
| total shots | 48 | 93 |
| rooms photographed | 1 of 12 (bodega only, 3 shots) | 12 of 12 (3 shots each, bodega keeps its original 3 too — 6 total) |
| sites photographed | 0 of 3 | 3 of 3 (3 shots each) |
| self-verifying stations | 0 | 45 (every dynamically-aimed one) |

## Run

```
Server: npx vite --port 4178 (worktree root: street/)
SHOT_URL=http://localhost:4178/ node scripts/bugsweep.mjs
```

Result: **93 shots**, build `55c7df614+` (dirty tree, this change, as
expected). Two `STATION MISS` lines in the error output — see the jail
finding below; everything else reported clean (the only other console output
is pre-existing browser noise: THREE.Clock deprecation, canvas
`willReadFrequently`, and GPU-stall driver messages, none of which are new).

## Bug found by giving the sites their first photograph: the jail site is almost entirely unwalkable

**This is a real, previously-invisible defect, found only because the sweep
now looks at the site at all.**

`window.__ct.colliders()` shows a single collider `{minX:56.88, maxX:69,
minZ:-110, maxZ:-96}` sitting almost exactly on top of the published jail site
`{minX:57, maxX:75, minZ:-110, maxZ:-96}` — it covers the site's full depth
and about two-thirds of its width, front-to-back, leaving only a ~6 m sliver
walkable at the very back (x 69–75) hard against a wall.

Warping into the covered two-thirds does not error and does not silently
stay put — it's worse than either: `fp.ts`'s own `unstick()` tries to push the
player out for 0.45 s, and when it can't find a way out (this collider
apparently gives it nowhere to escape to), it reverts the **entire move** to
the last position the player legally stood. Reproduced directly:

```
lot pos                              [11.176, 1.62, 2.6, 0.14]
warp(60.24, -103, ...)  — jail site  [11.176, 1.62, 2.6, 0.14]   <- unchanged
warp(65, -104, ...)     — retry      [11.176, 1.62, 2.6, 0.14]   <- still unchanged
```

That's why `shots/bug-jail-overview.png` shows the **used car lot** — the
warp to the jail site silently failed and the camera stayed exactly where the
previous (lot) shot had left it, 113 m away, under a filename that says jail.
`bug-jail-cross.png` also missed, by 5.8 m (partial push, not a full revert —
its target sat right at the collider's edge). `bug-jail-back.png` landed
correctly, in the narrow strip past x 69, hard against a party wall.

Both misses are called out automatically in the sweep's own output now
(`STATION MISS: jail-overview …`, `STATION MISS: jail-cross …`), not just
noticed by inspection. I have not touched `src/` — this is the world's own
collider, reported, not fixed, per the brief.

## Per-room and per-site verdicts — first pair of eyes on eleven of these

**bank** — clean. Teller windows with a barred grille, the vault door open onto
a safety-deposit-box room, a rates board, a loan officer's desk. Nothing wrong
in any of the three angles.

**bodega** — entry looks right (snack aisles, register, a vending machine) and
matches the room this project already knows. **far and wide are clipped into
the shelving** — the camera lands close enough to a shelf run to fill the
frame with it. This is an artifact of my generic far-corner heuristic in a
room whose shelving runs nearly wall-to-wall, not a world defect; flagging
so nobody reads it as "the bodega is broken."

**burger** — clean. Menu boards, red booths, the counter, a clean kitchen
line.

**casino** — clean, and good: slot machine rows with a velvet-rope aisle, a
blackjack table with a dealer figure and stools. No sign of trouble.

**church** — clean. Nave, pews, a run of small stained-glass lancets, a
confessional visible from the far corner. SESSION-STATE flags "church pillars
blocking the windows" as LANDED-awaiting-a-check; none of these three angles
show a pillar in front of a window, but that's not proof for every angle —
just what these three happen to show.

**diner** — entry and wide are clean (checkerboard floor, counter, booth with
two citizens). **far** shows the pastry display case with a hazy, washed-out
white halo around its glass panels — worth a second look, possibly a
transparency-sorting or lighting artifact (GOTCHAS §22 territory).

**hotel** — clean overall: reception desk with mail slots, an elevator,
lounge seating. Each hanging light fixture has an oddly near-black disc
directly above it on the ceiling — most likely just the fixture's unlit
mounting canopy rather than a lighting bug, but worth a glance since it reads
oddly in a still.

**jail (room — the cells)** — clean and good: front desk, a glass partition,
a barred gate, two cells with bunks visible beyond it.

**jail (site — the yard)** — **broken**, see the finding above.

**library** — clean and excellent: checkout desk, dense stacks in the entry
view, a genuinely good aisle shot down the shelving, and a mezzanine with
stairs and a bank of computer desks in the wide view. No clipping despite
being the densest room in the world by floor area.

**pawn** — clean. Instruments on the wall, glass display counters, a "WE BUY
GOLD" sign, barred windows.

**park (site)** — clean, and a real improvement over its history: the church
is visible down a tree-lined avenue between brick party walls dressed with
hedges, lamp posts and benches. Nothing that reads as broken.

**lot (site)** — clean: priced used cars, "DRIVE IT TODAY" / "WE FINANCE
ANYONE" / "TRADE INS WELCOME" signage, a sales booth with a figure in it,
bunting overhead.

**tax** — clean, and one known bug looks fixed: the preparer at the desk
faces the client chair rather than away from it (GOTCHAS §33 named this
exact room as a past facing bug). "APR 15 DUE" signage, a water cooler,
waiting chairs.

**thrift** — mostly clean: coat racks with price cards ("ALL COATS $4",
"BELTS $1 EACH"), a shoe wall, "OPEN CASH ONLY" signage. The dark rack items
(coats/jackets) have a scatter of small white flecks along their bottom hem
that reads as a texture or dither artifact — minor, worth a second look.

## What's still not perfect about the instrument itself

- The **far/wide heuristic can clip into furniture** in densely-packed rooms
  (bodega). It's geometrically correct (a real corner of the room, inset from
  the walls) but doesn't know where furniture stands, because the registries
  it reads (`roomDims`) only publish shell geometry, not contents. Fixing this
  properly would mean either registries the furniture publishes into, or
  giving up on "derive, don't hardcode" for a subset of stations — I left it
  as a documented limitation rather than trade one kind of rot for another.
- `verifyLanded()` only guards the 45 dynamically-aimed stations. The original
  48 are trusted as already-hand-verified; if one of them ever starts missing
  (a building moves under it), nothing here will notice. Worth the same
  treatment eventually, but out of scope for "extend the sweep to the whole
  world."
