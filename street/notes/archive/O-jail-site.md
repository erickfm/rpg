# SITE PROPOSAL — the jail

**Builder O · queue item 1 · awaiting a DESK ruling. No mesh has been built.**
**Copied to D** (`ct/street.ts`, the rosters and the east cap) **and to H**
(`ct/crowd-net.ts`, the walkable graph at that end).

> *"also we need a jail. the jail should be extremely try hard and should be
> somewhere it makes sense. probably over by the casino tbh lol"*

---

## The proposal in one line

**The jail takes the CLOSED EAST END of the side street** — a west-facing
frontage on the `x = 57` plane, spanning `z −96 … −110`, which is the exact
width of the street's section. **It costs neither roster run a single metre.**

```
                     N
   z = −96   ┌──────────────────────────── SEVENS  x 45.45…57 ──────┐
             │  north walk 2 m                                      │
   z = −98   ├────────────────────────────────────────────────┐     │
             │                                                │  J  │  x 57 … 69
             │  side street carriageway, 10 m                 │  A  │
             │                                                │  I  │  ← facade
   z = −108  ├────────────────────────────────────────────────┘  L  │     faces
             │  south walk 2 m                                      │     WEST
   z = −110  └──────────────────────────── LOANS   x 46…57 ─────────┘
                              x = 55  kerb        x = 57  facade
```

You walk 60 m east down the side street, past the casino, and the building you
have been walking toward the whole way is the jail. That is the site.

---

## Why here

**1. The user's instinct is right and it is right twice over.** The casino
(`SEVENS`, `x 45.45…57`) is the jail's immediate northern neighbour — they
share the `x = 57` corner. "Over by the casino" is satisfied literally, and a
1997 city lock-up sharing a corner with a slots parlour is the kind of joke the
block already tells about itself.

**2. It fixes the dead end this project has been arguing about for two days.**
The record, in order:

- H found the walkable graph running **ten metres up the open carriageway** at
  this end (`notes/H-for-D-second-alley.md:36`).
- The desk ruled, in H's own queue: *"It is a closed end of a minor side
  street, not a frontage; there is nothing there to walk to… I would rather not
  add pavement to justify a node"* (`notes/queues/H-traffic.md:188`).
- B painted a crossing instead; it landed and was confirmed (`LEDGER.md:230`).
- The user has now asked for that crossing **removed**, and for the ring to be
  closed another way (`FEATURE-REQUESTS.md:217`).

The desk's ruling was right on its own terms — *there is nothing there to walk
to.* **A municipal building is a thing to walk to.** The jail does not justify
a pavement; it makes the pavement obvious, and the ring then closes on foot at
the east end with no carriageway crossing at all. That is the "another way"
the request is asking for, and it arrives as a place rather than as a graph
patch.

**3. It replaces the most anonymous surface in the world.** `shots/O-end-vista-20m.png`
is the terminating vista of the side street from 20 m out: the whole centre of
the frame is a blank brown brick slab with a window grid — the unnamed east
cross building (`ct/street.ts:958`). `shots/O-end-strip-north.png` is the same
object from the pavement at its foot: **a dead brick flank, floor to sky, no
door, no window, no detail, running the full 14 m width of the street.** It is
filler doing the job of a backdrop, and the jail is a better answer to the same
problem — it still closes the street, and it closes it with something.

---

## What it costs the rosters: NOTHING

This is the load-bearing claim, so here it is against the world rather than
against the comments. Measured with `scripts/O-eastend-survey.mjs`, against
this worktree's **built bundle** on port 4297 (build `d6d313ed7+`, GOTCHAS §28):

```
── SOLID EAST OF x=50 ───────────────────────────────────────
  x 45.45…57      z −96.3…−82        SEVENS      (NORTH2, ends dead on 57)
  x 46…57         z −127.8…−109.88   LOANS       (SOUTH2, ends dead on 57)
  x 56.7…64       z −112…−92         the anonymous east cross building
```

Both runs already stop on `x = 57`. `ct/street.ts:249` says why that matters —
*"Widths are load-bearing… every roster below is balanced to hit it"* — and the
whole point of this site is that **it is not on either run.** The east cap is
placed directly, outside both cursors, so nothing before it moves and nothing
after it moves. The bodega keeps its corner.

The `NORTH2` cursor lands on 57 exactly (`16.45 + 6 + 11 + 12 + 11.55`) and
`SOUTH2` lands on 57 exactly (`−7 + 9.5 + 8.5 + 12 + 12 + 11 + 11`). Neither
sum changes under this proposal because neither list is touched.

---

## What is already there, measured

The ground across the closed end, sampled from `__ct.groundAt`:

```
along the street centre, z = −103
  x  52…55  ground 0.000        carriageway
  x  55.5…64 ground 0.140       KERB_H — raised pavement, already continuous east

across the end, x = 56
  z  −96.5 … −114  ground 0.140  unbroken from the north walk to the south walk
```

So **the pavement across the closed end already exists and is already paved** —
slabs, kerb and gutter, visible in `shots/O-end-strip-north.png`. It is not a
patch of grey; it is the same walk section as the rest of the street, and it
already joins the two pavements. What it lacks is a reason and a frontage.

And the strip is currently **narrower than the sacred 2 m** (GOTCHAS §9),
because the cap's collider stands 0.30 m proud of the wall it describes:

```
HOW FAR EAST CAN A 0.36 m CAPSULE GET
  north walk   stopped at x = 56.35
  centre       stopped at x = 56.35
  south walk   stopped at x = 56.35
```

Quoted the way this project quotes clearances — **raw gap, capsule not
subtracted** (GOTCHAS §29): the pavement at the closed end is **1.70 m of walk
against a 0.72 m capsule** (kerb `x = 55` to collider face `x = 56.7`).
Putting the jail's facade on `x = 57` with the modern `WALK_PROJECTION = 0.12`
cushion instead of the legacy `0.30` gives **1.88 m** — the same 0.18 m per
facade that `ct/street.ts:196` calls *"the single biggest encroachment on the
block"* and gave back everywhere else. The jail arrives and the walk gets
wider, which is not the usual direction.

---

## What I need, and from whom

Three asks. None is large; all three are in files I do not own, so **none of
them is a drive-by** (START-HERE: *never edit another agent's file to unbreak
your own change*).

**1. D — `ct/street.ts:958-968`, the anonymous east cross building.**
The jail replaces it. Two coplanar shells on `x = 57` would z-fight (GOTCHAS
§6), so it cannot simply be built in front. Either D deletes that block and I
take the whole cap, or D keeps it as backdrop mass and shortens it east of
`x = 63` so my shell abuts rather than overlaps. **I would rather D deleted it**
— it is 6 × 13.6 × 24 of filler, and the jail is a heavier and better-sited
piece of the same wall.

**2. D — publish the site.** `ct/world.ts` says the contract is
`ctx.site('jail')`, and `ct/street.ts:161` already says *"THE ROSTER PUBLISHES
ITS OWN SITES"* precisely so a builder never hand-types a coordinate out of
somebody else's file (GOTCHAS §20 counts six that were). One entry —
`x0 = 57`, frontage `z −96 … −110`, facing `−x` — and I never write 57 down.
If D would rather not, say so and I will derive it from `SIDE_X1` and
`SIDE_Z0/Z1`, which is second best but still not hand-typed.

**3. DESK — `crosstown.ts:491`, the cap's collider.**

```js
{ minX: SIDE_X1 + 1.7, maxX: SIDE_X1 + 9, minZ: -112, maxZ: -92 },  // east end
```

That is desk-owned and it is what stops the player at `x = 56.35`. With a door
on `x = 57` it has to move to the facade plus `WALK_PROJECTION`, or **the jail's
door cannot be reached** — which is exactly GOTCHAS §8, a collider eating an
`[E]`. Better still: delete it and let the jail register its own footprint, the
way every building on the block now does (`ct/street.ts:188`, *"whoever draws it
registers it"*). I will register it either way; I just cannot remove that one.

**4. H — the graph, once the ruling lands.** Not a blocker on me and not
something I would touch: `ct/crowd-net.ts` is H's. But the `s-east → ne-corner`
edge is flagged `road: true` with a crossing's 1.30 m lateral allowance
(`LEDGER.md:174`), and with a 1.88 m pavement across a frontage that edge can
become an ordinary walk edge with `road: false`. That closes the ring on foot
and lets the crossing come out, which is what the user asked for. **H's call,
H's file, H's timing** — flagged here so the two requests are visibly the same
request.

---

## What this does NOT need

- **No `rnd()` insertion in the middle of anybody's build.** `ct/jail.ts`
  self-registers through `ct/world.ts` with its own `ORDER`, and I will put it
  at the END of its band so every draw it makes lands after every existing one
  (GOTCHAS §2). I will prove it with `npm run fp before` / `after` and report
  the diff, not assert it.
- **No interior compromise.** `ct/interior.ts:41` gives each room an 80 m slab
  at `x ≥ 400`, and new slabs are claimed in **path sort order** — `jail.ts`
  sorts after every existing `int-*.ts` and after `interior.ts` and
  `inventory.ts`, so it takes the last slab and moves no existing room. The
  exterior's 12 m of depth constrains the cells not at all, which is GOTCHAS §45
  working the way it is supposed to: *"Take the room you need."*
- **No crime system.** Per the desk: the place, not the consequence.

---

## The alternative, if the cap is refused

**LOANS' slot — `x 46 … 57` on `SOUTH2`, facing north, directly across the
street from the casino's marquee.** It is an *identity* swap, not a slot move,
so like `DINER`/`LAUNDRY` (`ct/street.ts:257`) it costs the run total nothing
if the jail is exactly 11.00 m wide.

I am not recommending it, for three reasons:

1. It makes the jail a **shopfront-shaped box in a row of shopfront-shaped
   boxes**, entered off a 2 m pavement like the smoke shop. The east cap gives
   it a whole elevation and a 60 m approach.
2. It **consumes a tenant.** `LOANS` is a lit, named, painted frontage today.
3. It does **nothing for the dead end**, so the crossing request stays open and
   somebody still has to answer it separately.

It is genuinely cheaper if D cannot give up the cap, and I will build it well
if that is the ruling.

---

## Evidence

| | |
|---|---|
| `scripts/O-eastend-survey.mjs` | the measurements above — colliders, ground profile, capsule reach. Aimed with `SHOT_URL`, refuses to run unaimed (GOTCHAS §48) |
| `scripts/O-eastend-look.mjs` | the six stations below, from standing eye height |
| `shots/O-end-vista-40m.png` · `-20m` | the terminating vista from 40 m and 20 m — what the jail replaces |
| `shots/O-end-strip-north.png` | the blank flank at the closed end, from the pavement at its foot |
| `shots/O-end-strip-west.png` | standing where the jail's door would be, looking back down the street |
| `shots/O-end-close.png` · `-endwall.png` | the cap from the casino pavement, and squarely |

Both scripts print the build stamp and are aimed by `SHOT_URL` with no default
(GOTCHAS §26, §48). Both are named for what they LOOK AT with an owner prefix,
because they are investigations and not assertion suites (GOTCHAS §24) — the
jail's checks will be named for the claims they make when there is something to
claim.

---

**Status: BLOCKED on the desk's ruling. Nothing built.** `notes/BLOCKED-O.md`
carries the one-line version. — O
