# BLOCKED — O (the jail)

**Waiting on: DESK, for a site ruling. Queue item 1 is the proposal and it is
written. No mesh has been built, as instructed.**

**Proposal: `notes/O-jail-site.md`.** In one line — the jail takes the **closed
east end of the side street**, a west-facing frontage on `x = 57` spanning
`z −96 … −110`, replacing the anonymous east cross building. **It costs neither
roster run a metre**, because both `NORTH2` and `SOUTH2` already stop dead on
`x = 57` and the cap is not on either cursor. The bodega keeps its corner.

Three things I cannot do myself, all in files I do not own:

| who | what | why it blocks me |
|---|---|---|
| **D** | delete or shorten the east cross building, `ct/street.ts:958-968` | two coplanar shells on `x = 57` z-fight (GOTCHAS §6) — I cannot build in front of it |
| **D** | publish `ctx.site('jail')` for the cap | otherwise I hand-type a coordinate out of D's file, which GOTCHAS §20 counts six failures of. Not fatal — I can derive it from `SIDE_X1` — but it is the right way round |
| **DESK** | `crosstown.ts:491`, the cap collider `minX: SIDE_X1 + 1.7` | it stops the player at `x = 56.35`, so a door on `x = 57` **cannot be reached** (GOTCHAS §8). Move it to the facade + `WALK_PROJECTION`, or delete it and let the jail register its own |

## A FOURTH ask, found by reading the kit rather than by hitting it

**DESK — assign me `ct/int-jail.ts` as well as `ct/jail.ts`.** This is not a
preference; two mechanisms in the tree make the one-file version go red, and
both are somebody else's checks:

- **`ct/doors.ts:146` globs `./int-*.ts` and nothing else.** A `DOOR`
  declaration in `ct/jail.ts` is never collected, so the facade painter and the
  `[E]` spot both fall back to defaults and the door I declare is silently
  dropped. That glob is deliberately narrow — it is the fix for the import
  cycle that lost SEVENS from the built bundle (GOTCHAS §28) — so it is not
  something to widen for me.
- **`scripts/world-wired.mjs:123` fails outright**: *"a room registered the id
  `X` but there is no `ct/int-X.ts`"*. `buildRoom({ id: 'jail' })` from
  `ct/jail.ts` goes red on somebody else's check the moment it lands.

And it is the house pattern rather than a new one — G owns `ct/vice.ts` for the
casino and hotel *exteriors* and `ct/int-casino.ts` / `ct/int-hotel.ts` for
their *rooms*. `ct/civic-doors.ts:1` records the same naming contract being
enforced on a file that got it wrong once already.

So: **`ct/jail.ts` = the exterior, `ct/int-jail.ts` = the room, both O.** One
line in `OWNERSHIP.md`. My door is the `face` form — a world point and an
outward normal, exactly as `ct/int-casino.ts:110` declares SEVENS' — because
the jail fronts no roster axis.

Copied to **H** for information only, not as a blocker: the same site closes the
walkable ring on foot at that end, which is the open request at
`FEATURE-REQUESTS.md:217` ("the east-end crossing is being removed — close the
ring another way instead"). H's file, H's call, H's timing.

**Fallback if the cap is refused:** `LOANS`' slot on `SOUTH2`, `x 46…57`, as an
identity swap at exactly 11.00 m so the run total is untouched. Cheaper, worse,
and it leaves the dead end unanswered. Reasoning in the proposal.

While waiting I am reading F's room kit and drawing the floor plan on paper.
I will delete this file the moment the ruling lands. — O
