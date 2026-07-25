# Builder G — prep while blocked on F

Worktree `../rpg-interiors2`, branch `feat/interiors2`, port **4186**.
Rebased onto mainline `c7135dd`. `tsc --noEmit` clean, `scripts/health.mjs`
says WORLD OK on 4186.

My queue is the casino, the hotel lobby, the pawn shop and the tax office, and
all four wait on F's `ct/interior.ts`. **Nothing in `src/` has been touched** —
the kit is not landed, so a room shell of my own would be thrown away. What
follows is the work that does not depend on the kit: the street-side numbers
every one of my four rooms needs, walked and verified, plus what I found
reading the kit.

---

## 1. The casino can omit its window. No kit change needed.

This was the explicit test in my queue. Answer: the kit already handles it.
`RoomSpec.window` is optional and the front-wall hole loop only opens a window
when `win && wW > 0`, so omitting the key leaves the front wall solid apart
from the doorway. GOLDEN ACES gets no daylight for free.

(Checked twice, against F's working copy before and after F hardened that loop
with `addHole` validation — the guard survives the rewrite. `interior.ts` is
still uncommitted and moving, so everything I say about it below is by symbol
rather than line number, and is worth re-checking against whatever F lands.)

## 2. What I will need from F, in the order it matters

**a. The room lights are not configurable, and two of my four rooms are about
their light.** The kit hard-codes the glow colour `rgba(255,235,190,·)`, puts
the lamps on the room's centreline, and picks the count as `round(D / 3.5)`
(the `── the light ──` block). The casino brief is "a warm dim light that is nothing
like the flat civic daylight everywhere else"; the hotel brief is "one lamp
out". Neither is reachable today — I can add my own glow planes with
`room.put`, but I cannot recolour or suppress the kit's.

Smallest thing that unblocks both: `light?: { color?, count?, size?, y? } | false`
on `RoomSpec`, defaulting to exactly today's behaviour. **F's call, F's file** —
I have not touched it.

**b. Each room still needs two lines in `crosstown.ts`, which I must not
write.** The kit registers the [E] spots itself, but `buildDiner(ctx)` is still
called from `crosstown.ts` and its return value spread into `colliders`. My four
rooms need the same, and my queue says never to edit that file. So F (who owns
the interior-belt wiring) has to add them, or the kit changes to use
`ctx.obstacle()` — already on `CtxBuild` (`ctx.ts:74`), registers a collider
*and* makes citizens steer around it — at which point a room self-registers its
walls and adding one is a single call.

**c. Not a blocker:** the kit's floor is a fixed 2×2 lino checker tinted by
`palette.floor`, and my carpet/tile floors cannot replace it. The diner already
solves this by laying its own plane at `y = 0.012` over the kit's (the
`── the checker floor ──` block), which is the house pattern now and what I will copy.
Flagging it only so nobody "fixes" the kit floor on my account.

## 3. The street-side numbers for my four doors

An interior's [E] spot has to land on the world position of the door *painted*
on the facade, not near it. These are derived from the rosters in `street.ts`
and then **walked** — `scripts/G-approach.mjs` stands the player back on the
walk and walks them into each facade, because `__ct.warp` does no collision
resolution and warping onto a spot proves nothing (GOTCHAS §8).

| building | roster span | painted door | [E] spot | step-out lands | yaw | gy |
|---|---|---|---|---|---|---|
| GOLDEN ACES | x ∈ [45.45, 57.00] | x = **51.29** | (51.29, −97.0) | (52.8, −97.3) | 0 | KERB_H |
| HOTEL ORPHEUS | x ∈ [33.45, 45.45] | x = **39.51** | (39.51, −97.0) | (41.0, −97.3) | 0 | KERB_H |
| A-1 TAX | z ∈ [−22.0, −9.0] | z = **−15.25** | (6.55, −15.25) | (5.9, −16.6) | −π/2 | KERB_H |
| PAWN | z ∈ [−65.0, −53.0] | *none painted* | — | — | −π/2 | KERB_H |

Walked result — the capsule stops 0.67–0.69 m off all four facades at
gy = 0.14, so every spot is inside the default r = 1.05 and reachable:

```
GOLDEN ACES (casino)       z= -96.67   0.14   REACHABLE (0.67 m off the facade)
HOTEL ORPHEUS              z= -96.67   0.14   REACHABLE (0.67 m off the facade)
A-1 TAX                    x=   6.31   0.14   REACHABLE (0.69 m off the facade)
PAWN                       x=   6.32   0.14   REACHABLE (0.68 m off the facade)
```

Two things fell out of this that are worth having written down:

**The step-out point must be offset along the frontage, not away from it.** The
north side-street walk is only the 2 m band z ∈ (−98, −96), and the building
collider eats down to −96.3, so there is about 1 m of standing room — you
cannot put the landing 1.05 m further out without stepping into the road. So I
offset ~1.5 m *along* the walk instead, which is what the bodega already does
(`crosstown.ts:366`, `jumpTo(11, -97.3, 0, KERB_H)`). Worth noting that the
diner's step-out is 0.65 m from its own entry spot, i.e. inside the r = 1.05
trigger — you land still being offered the way back in.

**yaw for the side street is 0.** `fp.ts:86` is `fwd = (sin yaw, 0, −cos yaw)`,
so yaw 0 faces −z, which on the north side-street walk is out across the street
and away from the facade — the same value the bodega exit uses.

## 4. PAWN has no door painted on it — needs D before I can build that room

`pawnFront` (`street.ts:121-149`) paints a board, a barred window from texel 5
to W−5, and a stallriser. There is no door rect anywhere in it — unlike
`burgerFront` (`W*0.44`), `taxFront` (`W*0.5`) and the default `shopfrontTex`
(`W*0.48`), which all paint one. So the whole frontage is glazing and there is
no world position for a door to be at.

`street.ts` is D's. I am not touching it. The pawn shop is in my `## Next`, not
my `## Now`, so this is not blocking me yet — but it wants routing to D early
so the door exists by the time I get there. My room will be built to whatever
position D paints it at.

## 5. For F: which way the facade textures map to world, measured

F's queue says to work the burger barn's door out from the WEST roster rather
than guess it. The trap is that **the two sides of the street map their
textures in opposite directions**, because the west facade is the box's +x face
and the east facade is its −x face:

- **west** (DINER, BURGER BARN, THRIFT): u = 0 is the **high-z** end, so
  `door z = z_high − u·w`
- **east** (A-1 TAX, PAWN): u = 0 is the **low-z** end, so
  `door z = z_low + u·w`
- **side street north** (HOTEL, ACES): u = 0 is the **high-x** end, so
  `door x = x_high − u·w`

Measured, not assumed: looking at the barn from the road, its menu board
(u ≈ 0.66) renders right of centre and its door (u = 0.44) left of centre, and
screen-right is −z from that camera. So for **BURGER BARN**, spanning
z ∈ [−37, −21] with the door at `W*0.44` of a 128-texel front:

> **door z = −21 − 0.44 × 16 = −28.04**, not −29.96 and not the centre −29.

Roster arithmetic independently checks out: it puts No. 227's centre at
z = −44, which is the number `tex-world.ts:281` states on its own.

## 6. Unrelated, for the desk: the walks are pinched to 0.23 m at every lamp

Found while walking the approaches, pre-existing, and in B's file so I have
left it alone. The bishop-crook lamps stand at `bx = ROAD_HALF + 0.55 = 5.55`
with a `±0.2` collider (`props.ts:280`); the building wall collider starts at
`FACE − 0.3 = 6.7`. That is 0.95 m of clear walk past a lamp against a 0.72 m
capsule, so the player's centre has to thread a **0.23 m** band.

Verified rather than computed — walking dead straight down the east walk,
lanes x = 5.40, 5.90, 6.10 and 6.30 all stop at the lamp at z = −23, and only
x = 6.22 gets through. It is passable, so this is not a wall, but on a street
whose standing rule is that the 2 m lane is sacred it is worth someone
deciding it is intentional. Lamps sit at z = −23, −51, −79 on the east side and
−9, −37, −65 on the west; none of them is near my doors.

## Tools left behind

- `scripts/G-approach.mjs` — walks into each of my four facades, reports how
  close the capsule gets and the ground height there.
- `scripts/G-lane.mjs` — walks every lane across a walk's width to tell a
  pinch apart from a blockage.

Both take `SHOT_URL`, default `http://localhost:4186/`.

## Next, the moment F lands the kit

1. Re-read my queue (the desk may have reordered it), rebase on mainline.
2. GOLDEN ACES: `buildRoom` with no `window`, low ceiling, the numbers in §3.
3. Walk it before committing — in, out, and the lane between the slot banks —
   and only then look at it.
