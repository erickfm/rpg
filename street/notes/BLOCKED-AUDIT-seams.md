# BLOCKED — auditor (`AUDIT-seams`)

Both queue items are standing audits with **no new input to audit**. I am not
idle by choice and I am not stuck on a decision — I need other agents' work to
land. Base at time of writing: `5ee8d2cb`.

## What each item needs, and from whom

### `## Now` — walk every interior and audit it as a set

**Needs: a room to land, from F or G.** Seven of ten are written and all seven
are now in the world; three are unwritten. I have measured the set twelve times
and every axis the item names is covered:

| axis | state |
|---|---|
| ceiling heights | measured, 7 rooms, 2.50–3.40 |
| doorway widths / wall thickness / jamb reveals | measured and shot — 0.18 m in all seven |
| floor texel density | measured — 18.3–21.3, anisotropic within rooms |
| light level and colour temperature | measured across all seven from a matched camera (round 12) |
| how you get back out, and where you land | walked in every room that has a door |
| room size vs shopfront frontage | measured against the live roster |
| enterable from a spot a collider swallows | all nine street doors walked |

Nothing here is waiting on a decision. It is waiting on rooms 8, 9 and 10.

### `## Next` — re-verify pattern #1

**Needs: a change to `tex-world.ts`, `ct/street.ts` or `ct/civic.ts`.** Clean on
three consecutive checks; nothing has touched those files since.

## Three open findings that need routing, not more auditing

These are done on my side and are sitting in reports waiting for an owner. If
the desk wants me productive, routing these is worth more than another audit
round.

1. **Six of nine street doors have their `[E]` trigger centre inside solid
   collision.** `notes/interior-audit.md` round 11. The split is geographic —
   every side-street and corner door is reachable, every main-street door is
   blocked, all at 0.21 m except thrift at 0.27 m. Not fixable from the interior
   side: seven rooms have independently placed a door 0.45 m off the facade,
   which is correct, and the main-street facades still register 0.3 m inside
   their own wall. **Wants D** (collision), and the acceptance test is one
   number: the reachable limit should read **±6.64 wherever a facade stands**.

2. **A prop has re-blocked the thrift door** — finding 17, round 8. A 10.5 m run
   of furniture at (−6.82, 0.45, −73.55) took the one fixed door from 1.04 m of
   margin back to 0.78 m. Nobody did anything wrong; **nobody owns the number
   that says whether a door is still reachable.** Wants a build-time assert,
   which is the same shape as the fix that closed finding 10 — and finding 10's
   fix proves the shape works.

3. **`frontageOf(name, wMeters)` is published and unused.** Round 10.
   `b002bea9` gave the interiors exactly the tool this audit asked for in round
   5, and `grep -l frontageOf src/proto/ct/int-*.ts` returns nothing. Room widths
   are still 8.0–12.0 m against frontages of 11.55–16 m with no relationship
   between them. **One import per room away from closed.** Wants F and G.

## What would unblock me fastest

Any one of: a room landing, a masonry change landing, or a new queue item. If
there is audit work the desk wants that is not in my queue — the park, the used
car lot, the night pass, the ground-footprint rule — I have instruments for all
of it and none of it is currently assigned to me.

Delete this file when one of those arrives.
