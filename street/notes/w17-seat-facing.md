# w17 — a check that fails when a seat faces the wrong way

Queue item 8. `scripts/seat-facing.mjs`, plus the three authoring bugs it found.

## Root cause, one line

**Three modules typed a seat yaw that was MIRRORED in z** — right wherever
`cos = 0`, backwards everywhere else — and nothing in the suite ever asked a
seat what it was looking at.

## What I changed

| file | what |
|---|---|
| `scripts/seat-facing.mjs` | NEW. The check. Exit 1 if any seat faces the wrong way. |
| `src/proto/ct/int-casino.ts` | slot stool yaw inverted; `gameStool` yaw + approach mirrored; slot stools standing inside the pit |
| `src/proto/ct/int-library.ts` | reading-chair yaw 180° out |

Result: **105 seats red → 0**, and 3 unreachable seats → 1.

## The check

Two rules, both indoor-only, over every seat `__ct.seats()` publishes.

- **A. nose to the wall** — the first solid ahead is the seat's own room wall
  inside 1.20 m. The wall distance is *derived* from `roomDims()` (`w/d/cx/cz`),
  so no wall thickness is retyped. This is the tax-office / lot-chair class.
- **B. turned away from your own furniture** — substantial furniture within
  0.80 m *behind* you and nothing substantial nearer in front.

Rule B's thresholds came from measurement, not taste, and both bounds are in
the file's header. The one that matters: "substantial" is `min(w, d) >= 0.80 m`,
because the deepest thing legitimately behind a seat in this world is a car-lot
tyre stack at 0.72 m and the shallowest real offender is the library table at
1.00 m. That is an 11% margin on one side — **if a prop lands between 0.72 and
1.00 m deep, add a second dimension rather than nudging the number.**

It is the **comparison** in rule B that makes it decidable. My first draft
failed any seat whose *nearest* furniture was behind it and reported fifteen
casino stools that were correct — the floor is crowded enough that a roulette
player has a slot bank 0.65 m at his back while the wheel is 0.40 m in front.
Nearest-thing-behind is a fact about the room; nearer-behind-than-in-front is a
fact about the seat.

## Mutation test — the check can fail

Each fix was deliberately re-broken and the check confirmed red:

| mutation | result |
|---|---|
| library chairs back to `yaw: 0` | 4 seats red |
| slot stools back to the inverted yaw | 83 seats red |
| `gameStool` back to `a + PI` | 4 seats red (roulette + poker) |
| a tax-office waiting seat turned to `PI` | 3 seats, *"nose to the wall: 0.58 m"* |

The last one is rule A firing on exactly the bug the item was written about.

## The three bugs

1. **Casino slot stools (96 of them).** `yaw: face > 0 ? PI : 0`, exactly
   inverted: every stool sat you with your back 0.37 m from the machines,
   looking at the far wall. The decisive confirmation is in the same file —
   `int-casino.ts:830` places the seated NPCs on those banks *facing the
   machines* (citizen convention, where 0 = +z). So a player sat down looking
   the opposite way from the man on the next stool.
2. **`gameStool`.** Stools placed at `C + R*(sin a, cos a)` were given
   `yaw = a + PI`. The right answer is `atan2(dx, -dz)`. It is correct for the
   four craps stools (`cos a = 0`) and wrong for the five roulette and six poker
   ones, which is why it survived — the craps stools looked fine and nobody sat
   at roulette. Replaced with `faceAt(gx, gz, tx, tz)`, **derived** from the two
   positions, and the pit centres hoisted to one `PIT` declaration read by both
   the tables' own `solid()` calls and the stool loop. A fourth table cannot now
   be added facing the wrong way. The same mirror was in the approach term and
   had been putting the craps approach points inside the craps table.
3. **Library reading chairs.** `yaw: 0` against a table at higher z. The chair's
   own geometry had said so all along — the backrest is drawn at `cz - 0.20`,
   which is behind a `+z`-facing sitter — so you sat with your nose 0.20 m from
   your own backrest and the table at your shoulder blades.

## The item's named file was already correct

The row names `ct/int-tax.ts`. **The tax office is fine** — w9 fixed it under
item 5f and the check agrees. I changed nothing there. What the check adds is
that the same bug cannot come back silently: mutation M4 above turns a tax
waiting seat round and rule A reports it at 0.58 m.

## Found and NOT fixed — for the desk to queue

1. **`scripts/seatface.mjs` is blind indoors.** It filters colliders to
   `Math.abs(c.minX) < 500` and the interior belt starts at x ≈ 600, so it has
   never seen a single interior wall, table or machine. It reported "222 of 228
   seats look at open ground for 6 m or more" on a world where 105 seats were
   facing backwards. Either delete it or lift the filter — it is a trap for the
   next person who runs it.
2. **One unreachable seat remains: the roulette place directly north of the
   wheel** (casino local ≈ (-3.1, 1.75)). It sits in an 0.08 m sliver between
   the felt and the last slot bank and has no legal approach point in any
   direction — standing room runs out four centimetres either side. **It was
   unreachable before I touched anything**; my yaw fix moved which solid its
   approach lands in, not whether it lands in one. Fixing it means moving the
   wheel or the bank, which is a layout call, not a seat call. I removed the
   nine slot stools that had the same problem in the other direction (their
   approach points were inside the craps and roulette tables, and two of them
   had nowhere to stand at all) but deliberately stopped short of deleting
   roulette places — that would have left the wheel with two stools out of five.
3. **Outdoor seats are not covered by rule B, and cannot be as written.** On the
   street the thing behind a seat is a building: a bus bench backs onto a shop
   front at 0.62 m and a car-lot chair onto the portacabin at 0.55 m, and both
   are correct, because "back to a wall, looking out" is what a bench *is*. An
   AABB cannot tell that bench from the same bench turned round. **The park
   benches in the five-bug list therefore remain unguarded.** Guarding them
   needs the seat to declare what it is meant to look at — a change to
   `ctx.seat`, not to this file.
4. **Seated NPCs are still unguarded.** Three of the five named bugs were
   *people*, not player seats, and `citizenSprite` keeps its `facing` in a
   closure — there is no `userData` to read it from. `interiors-walk.mjs`
   decodes it from the rendered sprite for shop keepers only. Publishing the
   facing on the mesh would let this check cover figures too, cheaply.
5. **A convention trap worth a GOTCHAS entry.** `ctx.seat` yaw is the CAMERA
   convention (`0 = -z`); `citizenSprite` facing is `atan2(vx, vz)`
   (`0 = +z`). They are 180° apart. Copying a seat's yaw into the person
   sitting on it is a silent mirror, and it is very plausibly where several of
   these five came from.
6. **`checks.mjs` does not know about this check.** I did not register it —
   `scripts/checks.mjs` was being edited by another builder while I worked and
   is not a file item 8 names. One line for whoever owns it.

## Verdict on the after-images

`shots/w17/` (gitignored), taken by **actually sitting** — approach point, held
`E`, seated confirmed.

- **casino-slot** — reels dead centre, filling the frame. Unambiguous.
- **casino-roulette** — straight across the green felt at the wheel. Correct.
- **tax-waiting** — down the room at the preparer's desks, preparer facing back.
  Confirms 5f and confirms rule A abstains where it should.
- **library-table** — the tabletop in the lower third, then 1.2 m of floor and
  the library's front wall 2.5 m off. Bare, but it is a wall-side reading table
  and the chair's own backrest says this is the way it faces. Not pretty; not
  wrong.
- **casino-craps** — the table's rail across the bottom, floor beyond. Fine.

**One image was my instrument, not the world.** My first pass warped to the
seat pose and passed the seat-top as the *ground* height, so the camera floated
a standing eye-height above the pan and looked over the table at the wall — it
reported the library chair as facing brick. Sitting properly answered it. Half
of all defects here are the instrument; this one was.

**A second instrument artifact worth knowing:** sitting at a slot opens the
machine panel, and `hud.ts` blocks keydown while a panel is open — so the panel
from one seat covered every screenshot after it until I pressed Escape between
seats. Escape does close it from that screen (BUILDER-BRIEF §11 holds here).

## Derived or copied?

Everything derived. `faceAt` derives yaw from two positions; `PIT` is one
declaration read by both the tables and the stool loop; rule A derives the wall
distance from `roomDims()`. No number in the check is a second hand-typed copy
of a number the source owns.

## Two process notes against myself

- **I committed two of w16's in-flight files by accident.** `git add -A
  street/src street/scripts` from the shared checkout swept `props.ts` and four
  `w16-rain*.mjs` scripts into commits `68005744a` and `645774796` (now
  `2bb64f49f` / later). **Nothing was lost or broken** — w16 has since committed
  on top and the build is clean — but those two commit messages do not describe
  everything in them, so do not read their diffs as mine. I used explicit paths
  afterwards.
- **Port 4196 was assigned to me and was already held** by a stale server from
  an earlier session (pid 1912311, a different worktree). I used **4189**. All
  instrument runs in this note are `SHOT_URL=http://localhost:4189/`.

## How to re-run

```sh
SHOT_URL=http://localhost:4189/ node scripts/seat-facing.mjs   # exit 0
```
