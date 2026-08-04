# rpg — CROSSTOWN '97

A hand-authored Three.js/TypeScript 3D city street set in 1997. All work is in
`street/`. **This file is the whole orientation.**

## How work happens

**Erick asks. One builder edits `street/src/` in this checkout. Erick looks at
http://localhost:5177/.** That server is a plain `vite` dev server on this
checkout serving `src/` over HMR, so an edit is on his screen in milliseconds.

**No worktrees, no feature branches, no merge train, no landing step.** Those
existed to move work from somewhere else into the tree he watches. The work is
already in that tree. Cut 2026-08-04, at his instruction, after measuring: the
median change is **62 lines of `src/`**, only **11%** of everything written was
the world, and **51%** of `src/` commits touch the trunk, where by the rule below
only one agent can ever be anyway.

**ERICK IS THE CHECK.** *"i am a better check than any code or agent, lets just
use me."* Build it, tell him it's live, he looks. **Do not write a probe or a
check to prove ordinary work** — that was 47% of every line written here and he
reviews regardless. The one exception he named: **mass quality control**, where
the question is about *every* instance — every door, every seat, every texture.
A sweep across the whole world is worth writing. A probe proving your one change
is not.

**THE DESK ROUTES AND VERIFIES. IT DOES NOT CODE.** Not because it is bad at it —
because the desk has enough of its own work that it cannot also be the thing
fixing what Erick asked for. It keeps **at least one builder warm**: already
oriented on this project, carrying no previous task's context, standing by for
the next ask.

**THE DESK DOES NOT DIAGNOSE EITHER.** Measured over 35 items: the desk's stated
cause was wrong 6 times and a builder caught it 6 out of 6; over a later session,
28 rows said the desk's cause was wrong against 5 that said it was right. So an
ask goes to a builder as **the symptom, Erick's words verbatim, and the
screenshot path** — never a guessed cause or a guessed filename.

**ERICK'S WORDS OUTRANK ANY DIAGNOSIS, INCLUDING HIS OWN EARLIER ONE.** When the
brief and his quote disagree, the quote wins, and saying so is the most valuable
thing a builder does here.

## The rules that still bite

**ONE AGENT IN THE TRUNK. EVER.** `src/proto/fp.ts`, `src/proto/crosstown.ts`,
`src/proto/ct/apartment.ts` and the spot picker are where every room meets — one
player body, one selection predicate, one collision system. On 2026-08-03 the
calendar fix broke the door and the door fix broke the calendar, both in there.
Rooms, props and interiors parallelise freely; the trunk never does.

**At most 5 agents at once**, and only when the work is genuinely independent —
five different rooms, not five passes at one predicate. A sixteen-agent run
exhausted the account's usage on 2026-07-30 and took everything down. Agents are
for **breadth**, not speed: one ask is faster served by one builder than by a
fleet plus the coordination to keep it from colliding with itself.

**Several agents in this one checkout means `git add -A` sweeps up someone
else's in-flight work.** Stage the files you touched, by name.

**Movement, collision, floors and seats are never small, and are verified by
WALKING them** — press `V` for the collision overlay. **The 2 m sidewalk lane is
sacred**, indoors too.

**Screenshots are for LOOKING, never for PROVING.** Two runs of identical code
differ ~20% of pixels.

**A panel you cannot close is the worst bug this project ships.** `hud.ts` blocks
keydown while a panel is open, and Erick was once trapped in a TV seat. Anything
modal: Escape closes it from every screen, and standing up closes it too.

**Interactions need a HELD keypress** — `press('e')` can begin and end inside one
frame and never be observed. `keyboard.down('e')`, wait 90 ms, `keyboard.up('e')`.

## Files

`street/FEATURE-REQUESTS.md` — **every request in Erick's own words, dated, and
the spine of this project.** It stays true when summaries rot. Log every request
here and say who it went to when you reply.

`street/notes/GOTCHAS.md` — landmines. **Reference, never a read-through.** Read
its ranked index; search the rest when you touch that area.

`street/notes/BUILDER-BRIEF.md` — the long how-to. Sections are cited by ~200
comments in `src/`, so shorten a section, never renumber it.

`street/notes/QUEUE.md` — kept as the record of what was done. It is no longer
the dispatch path: an ask goes straight to the warm builder. `claim.sh`,
`done.sh`, `add.sh` and `supersede.sh` still work if several agents are running
at once. (Its header tells you to run `./scripts/release.sh`, which has never
existed — it is `claim.sh --release`.)

## Running it

`npm run dev` serves 5177 from this checkout — that is Erick's window, leave it
up. Any *second* server you start for an instrument gets its own port (4178+),
proven free with `ss -ltn | grep ":<port> "` (`curl` is not a free-port test),
bound with `--strictPort`, and **killed when you finish** — 33 orphaned vite
servers were found listening on 2026-08-03.

Instruments default to port 4177 and must be aimed: `SHOT_URL=http://localhost:<port>/`.
An instrument aimed at the wrong world reports a catastrophe it cannot see.

There is a published artifact and a GitHub Pages deploy
(https://erickfm.github.io/rpg/, auto-deploys on push). Republish with
`cd street && npm run build && node scripts/pack-artifact.mjs`, then publish
`street/dist/artifact.html` to the existing artifact URL.

## Commands

| | |
|---|---|
| `node scripts/health.mjs` | does the world initialise. **`0` initialised, `1` measured and broken, `3` nothing measured** — that last one means your server was not up, not that the world is broken |
| `npm run checks` | the 143 registered world checks. **Currently red and abandoning 108 of them** — a QC sprint is scheduled |
| `npm run sweep` | 48-shot world sweep, reports console errors |
| `./scripts/reap-servers.sh` | kill orphaned vite servers |

**Deleted 2026-08-04** (git history holds all of it): 25 shell scripts —
`desk.sh`, `land.sh`, `queues.sh`, `ownership.sh`, `board.sh`, `live.sh`,
`live-integrate.sh`, `pull-latest.sh`, `unstick.sh`, `rebase-safe.sh`,
`route.sh`, `ledger.sh`, `builder.sh` and 12 one-off archaeology scripts. They
drove worktrees, a merge train and a fleet that no longer exist, and several
pointed at files deleted a day earlier. **Deleted 2026-08-03:** `SESSION-STATE.md`,
`LEDGER.md`, `STATUS.md`, `OWNERSHIP.md`, `notes/status/`, `notes/archive/`.
