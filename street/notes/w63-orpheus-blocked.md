# w63 — item 176 handed back: two blockers, both measured

> *"make it a combo orpheus hotel and casino. connect them internally and
> outside. i should be able to walk from one into the other."*

**I did not build this and I am handing it back un-started.** Not because it is
large — because **both halves of it are outside the three files the row names**,
and each is a one-line correction to the row rather than a day of work. Port
**4191** (built bundle).

Nothing is committed against the world. What follows is what the next holder
needs, and `scripts/probes/w63-orpheus-belt.mjs` is committed so they do not
have to re-measure.

---

## Blocker 1 — the EXTERIOR of both buildings is `ct/vice.ts`, which the row does not name

The row names `ct/street.ts + int-hotel.ts + int-casino.ts` and describes
deliverables (1) *one property outside* and (2) *the name*. Neither can be done
in `ct/street.ts`.

`ct/street.ts:913` — the side-street loop — dispatches these two away:

```ts
const vice = buildVice({ scene, flat, solid, KERB_H });
for (const b of NORTH2) {
  sideSpans[b.nm] = [xn, xn + b.w];
  if ((vice.VICE as readonly string[]).includes(b.nm)) { … vice.placeShell(xn, -94.3, b); … }
  else placeBldZ(xn, -94.3, b, -1);
  xn += b.w;
}
…
vice.placeSigns(sideSpans);
```

and its own comment says so in as many words: *"SEVENS and HOTEL ORPHEUS are
built by ct/vice.ts — they are not shopfronts and are not made of shopfront
parts… street.ts still owns where they stand: the roster above and this
cursor."*

So `ct/street.ts` owns **two numbers and two names**. The facades, the frontage
language, the canopy, the hotel's blade sign and the casino's rooftop pylon —
every pixel of *"it should read from the pavement as a single establishment"* —
are in `ct/vice.ts`.

**And a rename in `street.ts` alone is worse than doing nothing.** `SEVENS` is
the key into `vice.VICE`, and `placeSigns(sideSpans)` is keyed by `nm` too.
Change `nm` in the roster and the dispatch above misses, the casino falls
through to `placeBldZ`, and it is rebuilt as a generic shopfront with no sign.
That is a break dressed as a rename.

**→ Item 176 needs `ct/vice.ts` added to its file list. It cannot begin without
it.**

## Blocker 2 — the internal doorway cannot be a doorway, and the cull is not why

The row says the hard part is that *"the region cull hides an interior you are
not standing in"* and to *"work out how the cull treats a player mid-way between
two interiors before you build the door."* **There is no mid-way.** Measured
(`scripts/probes/w63-orpheus-belt.mjs`, against the built bundle):

```
casino   centre x 680   11 x 36 m   spans x 674.5 .. 685.5
hotel    centre x 920   11 x 26 m   spans x 914.5 .. 925.5

centres 240.0 m apart · DEAD GROUND BETWEEN THEIR WALLS: 229.0 m
```

`ct/interior.ts:45` is `const SLAB_X0 = 400, SLAB_W = 80` and every room takes
the next 80 m slab **in build order**. The thirteen rooms come out
bank · bodega · burger · **casino** · church · diner · **hotel** · jail ·
library · pawn · tax · thrift — so the hotel and the casino have *church* and
*diner* parked between them and are 229 m of nothing apart.

**Two rooms that do not touch cannot share an opening**, whatever the cull does.
And the cull is not the obstacle either: `crosstown.ts`'s region cull hides only
top-level children **entirely west of x = 100** while the player stands east of
it — it has no per-room behaviour at all. (GOTCHAS §79 says the cull "hides
every interior you are not currently standing in"; that describes `room.inside()`
gating, not `REGION_X`, and the two get conflated. Worth a correction there.)

### So what "walk from one into the other" actually is

**An `[E]` in each room that jumps you to the other's threshold, dressed as an
interior door** — the identical mechanism every street door in this world
already uses, and it will feel identical to the player, which is the whole
point. That IS buildable inside `ct/int-hotel.ts` and `ct/int-casino.ts`, the
two files the row names, and it is not a large job.

The alternative — giving the pair one slab so they are genuinely contiguous —
means changing the belt's allocation in `ct/interior.ts`, which every one of the
thirteen rooms' addresses depends on. **Do not do that for this item.**

## What I would tell whoever takes it

1. **Get `ct/vice.ts` on the row**, and do the exterior first: it is where
   *"one property"* lives, and the interior connection should be designed to
   match whatever the seam becomes outside.
2. **The width total is genuinely pinned, but not for the reason the row gives.**
   The row cites `ct/apartment.ts` pinning the walk-up's door — that comment is
   about the **EAST** roster on the main block. HOTEL ORPHEUS and SEVENS are on
   **NORTH2**, the side street, whose own constraint is *"Both rosters stop dead
   on x = 57"*. Same conclusion — 12 + 11.55 = 23.55 must not change, redistribute
   freely between them — but if you go looking for the apartment reason on this
   roster you will not find it and will wonder what else the row got wrong.
3. The casino is **36 m deep** against the hotel's 26, and `interiorMaxZ()`
   exists because a room deeper than 26 m used to strand the player short of its
   own front wall. Anything that moves the casino's front wall touches that.
4. **Do not change the games.** `ct/slots.ts` and `ct/blackjack.ts` read their
   palette off `int-casino.ts` — the row is right about this and `slots.ts:818`
   is the line.

## What I actually did

- `scripts/probes/w63-orpheus-belt.mjs` — the belt measurement above, committed,
  so nobody re-derives it. It prints all thirteen rooms and states the verdict.
- Read `ct/street.ts:913-925`, `crosstown.ts`'s region cull, and
  `ct/interior.ts`'s slab allocation. No world file was edited.
