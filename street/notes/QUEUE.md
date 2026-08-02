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
| 1 | DONE w2 — Fixed: added a mirrored hall-side [E] spot (200.64) for 301's door — the room-side spot at 199.36 r0.95 never reached the hall and a shut door blocks line-of-sight for the aim fallback too, so the door was unopenable from the landing. Extended A-verify-301-door.mjs with a hall-side station; confirmed it fails on unpatched code and passes on dev + built bundle. | `ct/apartment.ts` | **You cannot open your own front door from the hall.** The `open/close the door` spot sits at x 199.36 r0.95; the hall runs x 200.0–202.4, so its reach dies at 200.31, and the closed leaf is solid. No prompt from the landing at any distance. **Shut your door behind you and it never reopens.** `scripts/A-verify-301-door.mjs` passes because it only ever tests x 199.3 — inside the flat. Fix the spot AND give the check a hall-side case. |
| 2 | DONE w3 — interior.ts default leaf now reads LEAF.frame.colour/glazing (fixes jail's colour+glazing); leaf COUNT (1v2) reverted after it doubled bank/casino/library's doors -- see notes/w3-door-leaf-default.md | `ct/interior.ts` | **7 of 12 rooms have mismatched door faces, and 6 share one cause:** `interior.ts`'s default door leaf is hardcoded and never reads a room's declared `leaves`/`frame`/`glazing`, only width and height. The jail even declares the right leaf and never applies it. Fix the default to honour the declaration; `notes/door-faces-match.md` has the per-room table. Bank is already done as the worked example (`BANK_DOOR` in `ct/bank.ts`). |
| 3 | DOING w1 19:31 | `ct/int-library.ts` | **Library is cramped, and a lectern is tilted.** The V overlay shows its left half nearly all red — red is `ct/gap.ts`'s own sub-0.95 m trap rule, the same threshold parked cars obey. **Spread, do not subtract**: the user has twice asked for the library to be *more* ambitious. Also: a brown plinth carrying a printed panel sits at a drunken angle, clipping the shelving and the floor — establish whether it is a wrong-axis rotation or a stale relative placement, and fix the relationship, not the coordinate. Also rename `label: 'sit at the terminal'` → **exactly** `'sit at the computer'` (item 4 joins by that string). |
| 4 | DOING w2 19:39 | *new file* | **A Windows-style PC you can actually use**, opening when the player sits at a library machine. Joins by seat label `'sit at the computer'` — the pattern `slots.ts` and `blackjack.ts` already use; register via `ct/world.ts` auto-incorporation, export `register(ctx)` + `ORDER`. **Do not edit `int-library.ts`.** Two or three apps that genuinely work beat ten stubs — the library catalogue searching real books is the best fit, plus a real game. §11 of the brief applies hardest here. |
| 5 | TODO | `fp.ts` or `crosstown.ts` (desk-owned; the claim grants them) | **Scroll to zoom, with a limit.** *"i want scroll to be zoom. it shouldnt be able to zoom too much though."* Nothing handles the wheel in the world today. **`ct/hud.ts` already owns the wheel while a panel is open** — it is in `BLOCKED` (hud.ts:168) and panels get `spec.wheel` (hud.ts:359) — so scrolling must NOT zoom the world while the ATM, slots or blackjack are up; that is already handled for free, do not break it. The camera is `PerspectiveCamera(88, ...)` at `crosstown.ts:39`; **88 deg is the deliberate wide 1997 look and must stay the resting value.** Zoom pulls in from it and springs back. **Clamp tight — err on too little:** this is a first-person street, not a sniper scope, and *"shouldn't be able to zoom too much"* is the entire spec. Smooth it rather than stepping per notch. Verify by walking and scrolling: sidewalk, indoors, and with a panel open. |
| 5b | TODO | `ct/props.ts` | **Rain shows one way down the street and not the other.** *"its raining if i face one direction down the street but not if i face the other."* **Reproduce it before you change anything.** Lead, measured live: rain is 500 `THREE.Points` in a **30 m box** (`RAIN_BOX`), re-centred on the player by a whole-box wrap — **but the wrap only runs inside `if (rain.visible)`**, and with rain off the drops still sat at x -14.9..15 / z -15..15, i.e. around the WORLD ORIGIN, while the player stood at x 198.6. Second half: +/-15 m is short against a ~130 m block and a 220 m far plane, so looking ACROSS the street puts the whole view inside the drops while looking ALONG it puts nearly everything beyond them. **Do not just pin the volume to the camera** — the comment there records that it used to be, and was changed because *"a personal rain cloud you could never walk out from under"* was worse. Cover the sightline without following the head. |
| 6 | DONE w3 — released untouched — fp.ts is desk-owned per BUILDER-BRIEF.md/my brief, highest-risk item in the project, needs the desk to start it | `fp.ts` + callers | **Colliders have no height, so you cannot stand on anything.** `fp.ts:9` is `AABB = { minX, maxX, minZ, maxZ }` — every collider is a footprint extruded to infinity. The user: *"i want the collision to be a bit more accurate to the objects. the cars for instance. we should be able to jump on the cars."* Add `minY`/`maxY` and let the floor picker stand on a collider's top when the player is above it; `ct/interior.ts` and `COURT.climbable` are prior art. **DESK-OWNED, HIGHEST RISK IN THE PROJECT — ask before starting.** Every existing `ctx.obstacle` must behave exactly as it does now unless it opts in. |
| 7 | DONE w3 — hoisted ATM_PALETTE export in bank.ts (pure refactor, fp before/after IDENTICAL); ct/atm.ts's own duplicate copy still needs a follow-up import, flagged in notes/w3-atm-palette.md | `ct/bank.ts` | Hoist a named `ATM_PALETTE` export. The cabinet's colours are inline literals in a closure; `ct/atm.ts` now carries a cited copy because exporting them needed A's file. Correct today, will rot — §8. |
| 8 | TODO | `ct/church.ts`, `ct/int-church.ts`, library pair | Church and library hand-duplicate their door position instead of sharing one constant, as ten other rooms do (`DECLS.at`, `VICE_DOOR_X`, `JAIL_DOOR`). Correct today, able to drift — and drift is how a five-times request returns a sixth. |
| 9 | TODO | `scripts/checks.mjs` | The full check suite **kills its own preview server** partway through, so ~half its 52 failures are that rather than real faults. Fix the cause, not the symptom — restarting the server after each check would hide a check that kills servers. Then classify all 52: real vs artefact, and queue the real ones. |
| 10 | TODO | `notes/LEDGER.md` | **~15 CONFIRMED rows cite interior coordinates that now name a different room** (everything moved +80 m in x when `int-bank.ts` was inserted). They *look* evidenced. Recompute what each names now; repair the citation if the evidence still holds, demote to LANDED if it does not. |
| 11 | TODO | `notes/LEDGER.md` | Two SHA citations (`06f0a1eca`, `0c9b5cd7f`) are presented as live but do not resolve; 6 more are honestly flagged unrecoverable. Finish the repair started at 106-of-114. |
| 12 | TODO | — | **Verify the LANDED rows**, and the ledger generally. Confirm or demote by walking or looking, never by reading code. Demoting is a success. |
| 13 | TODO | `scripts/seampairs*` | 103 brick seam disagreements, sample dominated by the jail block. Establish real-vs-artefact **first** — §7. |

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
