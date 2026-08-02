# The queue

**One ranked list. Builders take from the top and keep going.**
Rules for *how* to do the work are in `notes/BUILDER-BRIEF.md` — read that once.

- `./scripts/claim.sh <name>` — atomically takes the top unclaimed item
- `./scripts/done.sh <name> "what you did"` — releases it for the desk to verify
- **Never edit this file by hand while builders are running.** The scripts lock it.

Ranking is the desk's judgement about what the user actually cares about.
**Take from the top; do not shop.** The only reason to skip is `file:` collision
with an item another builder already holds.

| # | state | file(s) | what |
|---|---|---|---|
| 1 | TODO | `ct/apartment.ts` | **You cannot open your own front door from the hall.** The `open/close the door` spot sits at x 199.36 r0.95; the hall runs x 200.0–202.4, so its reach dies at 200.31, and the closed leaf is solid. No prompt from the landing at any distance. **Shut your door behind you and it never reopens.** `scripts/A-verify-301-door.mjs` passes because it only ever tests x 199.3 — inside the flat. Fix the spot AND give the check a hall-side case. |
| 2 | TODO | `ct/interior.ts` | **7 of 12 rooms have mismatched door faces, and 6 share one cause:** `interior.ts`'s default door leaf is hardcoded and never reads a room's declared `leaves`/`frame`/`glazing`, only width and height. The jail even declares the right leaf and never applies it. Fix the default to honour the declaration; `notes/door-faces-match.md` has the per-room table. Bank is already done as the worked example (`BANK_DOOR` in `ct/bank.ts`). |
| 3 | TODO | `ct/int-library.ts` | **Library is cramped, and a lectern is tilted.** The V overlay shows its left half nearly all red — red is `ct/gap.ts`'s own sub-0.95 m trap rule, the same threshold parked cars obey. **Spread, do not subtract**: the user has twice asked for the library to be *more* ambitious. Also: a brown plinth carrying a printed panel sits at a drunken angle, clipping the shelving and the floor — establish whether it is a wrong-axis rotation or a stale relative placement, and fix the relationship, not the coordinate. Also rename `label: 'sit at the terminal'` → **exactly** `'sit at the computer'` (item 4 joins by that string). |
| 4 | TODO | *new file* | **A Windows-style PC you can actually use**, opening when the player sits at a library machine. Joins by seat label `'sit at the computer'` — the pattern `slots.ts` and `blackjack.ts` already use; register via `ct/world.ts` auto-incorporation, export `register(ctx)` + `ORDER`. **Do not edit `int-library.ts`.** Two or three apps that genuinely work beat ten stubs — the library catalogue searching real books is the best fit, plus a real game. §11 of the brief applies hardest here. |
| 5 | TODO | `fp.ts` + callers | **Colliders have no height, so you cannot stand on anything.** `fp.ts:9` is `AABB = { minX, maxX, minZ, maxZ }` — every collider is a footprint extruded to infinity. The user: *"i want the collision to be a bit more accurate to the objects. the cars for instance. we should be able to jump on the cars."* Add `minY`/`maxY` and let the floor picker stand on a collider's top when the player is above it; `ct/interior.ts` and `COURT.climbable` are prior art. **DESK-OWNED, HIGHEST RISK IN THE PROJECT — ask before starting.** Every existing `ctx.obstacle` must behave exactly as it does now unless it opts in. |
| 6 | TODO | `ct/bank.ts` | Hoist a named `ATM_PALETTE` export. The cabinet's colours are inline literals in a closure; `ct/atm.ts` now carries a cited copy because exporting them needed A's file. Correct today, will rot — §8. |
| 7 | TODO | `ct/church.ts`, `ct/int-church.ts`, library pair | Church and library hand-duplicate their door position instead of sharing one constant, as ten other rooms do (`DECLS.at`, `VICE_DOOR_X`, `JAIL_DOOR`). Correct today, able to drift — and drift is how a five-times request returns a sixth. |
| 8 | TODO | `scripts/checks.mjs` | The full check suite **kills its own preview server** partway through, so ~half its 52 failures are that rather than real faults. Fix the cause, not the symptom — restarting the server after each check would hide a check that kills servers. Then classify all 52: real vs artefact, and queue the real ones. |
| 9 | TODO | `notes/LEDGER.md` | **~15 CONFIRMED rows cite interior coordinates that now name a different room** (everything moved +80 m in x when `int-bank.ts` was inserted). They *look* evidenced. Recompute what each names now; repair the citation if the evidence still holds, demote to LANDED if it does not. |
| 10 | TODO | `notes/LEDGER.md` | Two SHA citations (`06f0a1eca`, `0c9b5cd7f`) are presented as live but do not resolve; 6 more are honestly flagged unrecoverable. Finish the repair started at 106-of-114. |
| 11 | TODO | — | **Verify the LANDED rows**, and the ledger generally. Confirm or demote by walking or looking, never by reading code. Demoting is a success. |
| 12 | TODO | `scripts/seampairs*` | 103 brick seam disagreements, sample dominated by the jail block. Establish real-vs-artefact **first** — §7. |

**Not queued, deliberately:** `D-outline-debug-only` fails on stale stations, not
a regression. Do not send anyone after it.

---

## For the desk

- Add items **in rank order**, not at the end. Rank is the whole value of this file.
- Every item names its **file(s)** so collisions are visible before they happen.
- An item should be one builder's work. If it needs three, it is three items.
- When a builder marks something done, **verify it against the source yourself**
  before moving the LEDGER row. Every agent this week has made at least one claim
  that did not survive checking.
