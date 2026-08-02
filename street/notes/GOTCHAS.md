# Landmines in this codebase

Things that have cost real time. Read before your first change; most are not
discoverable from the code alone.

## RENUMBERED 2026-08-02 — if you are following a citation, read this first

**§51 and §52 were each used TWICE, and the second §51 appeared *after* the
first §52.** Anything appended after that inherited the wrong number, so §59 was
really the 61st entry. Nine entries were renumbered to make the sequence unique
and monotonic. **No entry's text was changed** — only its number, so a citation
that lands on the wrong lesson can be re-pointed with this table:

| was | is now | entry |
|---|---|---|
| 51 *(first)* | **51** *(unchanged)* | The player SPAWNS INSIDE 301 |
| 52 *(first)* | **52** *(unchanged)* | Watch your ERROR RATE |
| 51 *(second)* | **53** | The dangling objects are the only copy of every rejected design |
| 52 *(second)* | **54** | A fresh agent worktree does NOT start on this project |
| 53 | **55** | An agent that backgrounds its own work and waits will never finish |
| 54 | **56** | A silently-undefined field makes a test walk the wrong way |
| 55 | **57** | A false ledger row survived three corrections and then ate a builder |
| 56 | **58** | Bad instruments produce about as many "defects" as the world does |
| 57 | **59** | A shared queue stops double-CLAIMING, not double-DOING |
| 58 | **60** | The queue's own claim pattern could not see most of the queue |
| 59 | **61** | A spawned builder does NOT automatically get its own worktree |

**§1–§50 are untouched**, so the overwhelming majority of citations in this repo
are unaffected. Every live citation of a renumbered entry was updated in the
same commit (`notes/BUILDER-BRIEF.md`, `notes/LEDGER.md`, `notes/QUEUE.md`,
`FEATURE-REQUESTS.md`, `notes/w14-sha-repair-check.md`, `scripts/bedcavity.mjs`,
`scripts/doorside2.mjs`, `scripts/queue-check.sh`, `src/proto/ct/apartment.ts`,
and five cross-references inside this file).

**Two classes were deliberately NOT rewritten**, and both are correct as they
stand:

- **`notes/archive/`** — those notes are historical records written when the
  numbering was what it was. Rewriting them would falsify the record; use the
  table above. Affected: `AUDIT-shadow-geometry.md` (51 → 53),
  `exteriors-match-interiors.md` (55 → 57), `feel-gravity-and-pickup.md`
  (52 → 54), `QUEUE-done-2026-08-01.md` (56 → 58, 58 → 60),
  `vault-and-lot-surfaces.md` (55 → 57), `w2-ledger-sha-repair.md` (51 → 53),
  `w4-junction-crossings-export.md` (56 → 58), `w5-shadow-geometry.md`
  (55/56 → 57/58).
- **`notes/w15-jail-seams.md:142` quotes a real commit subject** —
  `52b7c8a99 GOTCHAS 59: a spawned builder may share your worktree…`. A commit
  message cannot be edited, so changing the quote would misquote git history.
  That commit's "59" is this table's **61**.

§59 also had **no title at all** — just `## 59.` — which is why the desk could
not see it was the third defect. It is now titled from its own opening sentence.

---

## 1. The paint layer uses UNSEEDED `Math.random()`

`dither()` and 13 other paint sites call `Math.random()` directly, so **every
page load paints different grain**. Two runs of identical code differ in ~20% of
pixels.

Consequences:

- **You cannot diff screenshots.** Not "it's noisy" — 173 of 222 textures differ
  every load.
- To prove a change didn't move the world, use the structural fingerprint:
  `npm run fp before` → change → `npm run fp after` → `npm run fpdiff`.
  It seeds `Math.random` in the harness only. Textures + structure must come
  back identical; 4–6 pigeons drifting is the noise floor.
- Screenshots are for **looking**, never for **proving**.

## 2. There is ONE seeded `rnd()` stream and its ORDER is load-bearing

`ct/rng.ts` exports a single LCG. Tree heights and pigeon placement draw from
it at construction. **Inserting a new `rnd()` call anywhere shifts everything
downstream** — every tree height and pigeon position in the world changes.

Rule: append new draws at the END of a module's build, never in the middle.
`ct/props.ts` says so in a comment for exactly this reason.

## 3. Anything lying on the ground must be a top-down DECAL, not a billboard

`board()` creates a billboard that **rotates to face the camera**. A crushed can
drawn in side view therefore stands up on end as a flat card the moment you look
down at it. Ground litter, puddles, paper: draw them viewed from above and place
them as flat planes (`flatDecal`).

## 4. A surface 1–2 texels tall cannot hold detail

The kerb face is 0.14 m ≈ 1–2 texels at this world's ~8 px/m. Any dither, fine
noise or gradient on it **must** alias, and `NearestMipmapNearest` at grazing
angles turns that aliasing into a crawling band. This produced three separate
"the kerb looks bad" reports.

For faces thinner than ~0.3 m: no dither, no fine noise. Only large features
many texels wide, and `minFilter = NearestFilter` so there is nothing to crawl.

## 5. Texture repeat must derive from the surface's REAL METRES

`asphaltTex` once hard-coded `repeat(3, 30)`, tuned for the tall/narrow main
road. Reused on the wide/short side street it stretched each tile to ~21 m × 0.33
m and smeared the whole corner. Always compute repeat from the plane's actual
dimensions so texels stay square.

`ct/tex-ground.ts` is the model to copy: it takes **world extents** in and
returns repeat + offset, which also makes the slab grid continuous across
neighbouring surfaces.

## 6. Coplanar surfaces must ABUT exactly, never overlap

This world z-fights whenever two coplanar faces overlap — it has happened at the
corner roads, the sidewalk corner, and the chamfer. Make surfaces meet edge to
edge. `git log --grep=z-fight` for previous instances.

## 7. Floor height in the apartment comes from a PICKER, not from colliders

`ct/apartment.ts` owns `ground(x, z)` — a floor picker with hysteresis, because
four stacked storeys have to work for a 2D walker. It is the only thing that
knows which floor you are on.

So "add a floor" or "change the stair pitch" means **re-deriving that function**,
not adding a mesh. Get it wrong and you fall through or cannot climb. Always
verify by walking up and back down, never from a screenshot.

## 8. Colliders can silently eat `[E]` triggers

The bodega became un-enterable because the produce crates' collider box was
generous enough to swallow the door's interaction spot. Anything that owns an
`[E]` spot needs its approach corridor treated as reserved space.

## 9. The 2 m sidewalk lane is sacred

The player capsule is `RADIUS = 0.36` (`fp.ts`). The user checks constantly that
he can walk past props. Any new collider must leave a clear lane — walk it to
prove it, do not eyeball it.

Related geometry: building facades sit at x = ±7.0, tree trunks at ±5.4. A tree
canopy wider than ~1.45 m half-width punches into the facade and gets clipped.

## 10. Double-sided planes render MIRRORED from behind

Signs are planes with `side: DoubleSide`. Viewed from the back face the texture
is mirrored — and symmetrical letters (H, O, T, A, M, V, W, X) hide it
completely. A `HOTEL` blade sign shipped mirrored because only the E and L gave
it away. Always verify signage with asymmetric text.

## 11. `crosstown.ts` is the WIRING, and that makes it contended

It is only ~580 lines but it is touched by 23 of the last 120 commits, four
times more than files twice its size. Every prop registers a collider there,
every interactive object registers an `[E]` spot, every module has its update
hook called there.

Treat it as desk-owned. See `PARALLEL-WORKFLOW.md` §15 for the registration
pattern that would fix this properly.

## 12. Interior walls are single planes

Every opening in the walk-up is a hole cut in paper with zero visible depth.
Known issue, partially addressed. If you add an opening, give it a jamb.

## 13. Worktree plumbing

- `node_modules` is a **symlink** per worktree. `.gitignore` needs the
  no-trailing-slash form (`node_modules`) — `node_modules/` does not match a
  symlink, and the symlinks then block every merge.
- A `git reset --hard` in a worktree can delete that symlink and silently break
  its dev server. If a world stops serving, check the symlink first.

## 14. An agent's input box shows HINT text when it is idle

Claude Code renders a greyed-out suggestion in the prompt box of an idle
agent — "do the church move", "keep going, next item in the queue". Captured
from a tmux pane that is indistinguishable from a message somebody typed and
left unsent.

The desk read six idle agents that way, concluded their briefs had failed to
submit, and pressed Enter into six empty boxes. They had been sitting finished
for up to twenty minutes while the desk reported them to the user as working.

**Never infer an agent's state from its input box.** The honest signal is the
spinner / interrupt hint, which only renders while it is actually running —
and match a truncated prefix (`esc to inter`), because narrow panes cut it
mid-word. `scripts/desk.sh` does this; use it rather than eyeballing a pane.

## 15. Finished work is invisible until it LANDS

Eleven commits once sat finished across seven worktrees for the better part of
an hour while mainline had none of them, because nobody ran the merge train.
The user experienced it as the project being slow; every builder had in fact
delivered.

`scripts/desk-watch.sh` now runs `land.sh` on a loop for exactly this reason.
Landing is safe to automate — land.sh refuses to run on a broken mainline,
typechecks after every single merge so a break is attributed to the builder
that caused it, and reverts any builder that breaks the build.

If you are the desk and the watcher is not running, start it:

```bash
nohup street/scripts/desk-watch.sh > /tmp/desk-watch.log 2>&1 &
```

## 16. Sending a brief to an agent can silently fail

Two ways, both of which have happened:

- **Text and Enter in one `send-keys`** — the text lands in the box and the
  Enter does not register. Eight agents once sat with their instructions typed
  but unsent while the desk reported them as briefed. Send the text, sleep,
  then send `Enter` separately.
- **`--permission-mode acceptEdits`** — the agent stalls on a dialog after
  about thirty seconds of work and waits forever. Builders must launch with
  `--permission-mode auto`.

`scripts/builder.sh` handles both and then VERIFIES the prompt is empty before
claiming the agent was briefed. Do not spawn builders by hand.

## 17. Builders stop after ONE item unless told otherwise

A builder that finishes an item, writes a handoff and stops is behaving
reasonably — but with nine agents it means the desk must poll and re-prompt
every one of them, and the user experiences that polling latency as the
project being slow. All nine once went idle within minutes of each other with
fifty items queued between them.

Brief builders to **work the queue continuously** until it is empty or they
are genuinely blocked, and to say WHICH of those it is when they stop.
`scripts/builder.sh` includes this in the brief it sends.

## 18. "Busy" is not "progressing"

An agent grinding on one turn for over an hour looks identical to a healthy one
in any status view that only reports busy/idle. It happened: 74 minutes, 92k
tokens, nothing committed, three rooms the user had asked for still out of the
world — and the desk read the pane as fine.

`scripts/desk.sh` now reads the spinner's own elapsed timer and flags any agent
past 25 minutes on a single turn **with nothing committed**. An agent that is
committing steadily is not stalled however long it has been going, which is why
the check is `time AND no commits`, not time alone.

When you see a STALL, interrupt and ask for the **smallest committable piece**.
Do not ask what it is doing — ask it to ship something.

## 19. Log the request before you dispatch it

`CLAUDE.md` requires every user request to land in `FEATURE-REQUESTS.md`. In a
fast stretch the desk routed roughly twenty asks straight into queue files and
the master log simply stopped. Nothing was lost — every ask was in a queue or
had landed — but the record could not be reconstructed without walking nine
queue files and a hundred commit messages, and the user had to ask "you didn't
lose any of them, did you?" to surface it.

Use `scripts/route.sh <agent> "<user's words>" "<message>"`. It logs, dispatches
and verifies in one command, so the log cannot be the step that gets skipped.

## 20. An unread screenshot is not an observation

The auditor's line, and it earned its place. A verification pass produced
fifteen screenshots and graded seven checks from probes it later found had run
from the wrong position — the walk tests shared player state, so the "car lot"
test stood where the "church" test had finished. It reported those as NOT
CHECKED rather than as failures, which was correct: a confident wrong verdict
would have sent three builders chasing nothing.

Two rules follow:

- **A check must verify it is where it thinks it is** before it presses a key.
  Re-warping is not enough if the previous check moved you.
- **Aim from the source, not from memory.** Every coordinate in that probe was
  hand-typed, which is the same defect this project has now hit five times —
  a stale diner z in a trigger harness, a hand-typed room offset, a hand-typed
  `DZ`. `scripts/doorsweep.mjs` finds things by walking and has never been
  wrong. Copy it.

## 21. If you need a person, CALL THE ATLAS

`ct/citizens.ts` draws people properly — 8 angles, build, skin, hair, garment,
pace, grime — and `citizenSprite(look, {facing, h, w})` returns a ready-to-add
billboarding mesh. **Never hand-draw a figure on a plane.**

Five agents did exactly that before this was written down, because nothing told
them the atlas existed: the diner waitress first, and then the bodega keeper,
the casino, the hotel and the tax office each copied her because she was the
nearest example. The user noticed immediately — *"the people inside these
places are always flat and not like the people on the street"* — and it was
one missing document, not five bad decisions.

Read `notes/CITIZEN-STYLE.md` first. It has the options, the rules that are
easy to get wrong, and a rendered contact sheet so you can SEE the kinds of
person this world has.

## 22. If you set `alphaTest`, do NOT also set `transparent`

A cut-out and a translucency are different things and three.js treats them
differently. `alphaTest` **discards** the fragment — it never blends — so on a
fence, a leaf, a pennant, a sticker, `transparent: true` buys you nothing.

What it costs you moved once already, so read both halves:

- **It moves the mesh into the sorted transparent queue**, where `DoubleSide`
  geometry picks up sorting artifacts it would never have had — the far face
  painting over the near one. This is still true and is now the whole of the
  cost. `ct/vice.ts` documents the same bug making a HOTEL sign read backwards.
- **It used to cost the material its night grading**, and that is how this was
  found: `dimWorld` skipped anything with `transparent`, so a prop that set
  both stood at full daylight brightness at midnight while the block behind it
  went dark. Six materials in `ct/lot.ts` did — chain-link, bunting, banners,
  FTC stickers, weeds.

  **`db76dc26` fixed that at the source**, in `dimWorld`'s own test rather than
  at the call sites: `isGlass = m.transparent && !(m.alphaTest > 0)`. That is
  the better fix — it closed the fault for every author at once instead of
  hunting them one at a time, and it halved the world-wide count on the day it
  landed. So **the dimming half of this entry is history**. It is left here
  because the rule survives its original reason, and because a landmine entry
  that quietly stops being true is worse than one that was never written.

**Genuinely translucent decals are a real exception and still need care.** An
oil stain or a faded bay line has to blend to be a stain at all, so it
correctly carries `transparent` with no `alphaTest`, and `dimWorld` correctly
leaves it alone — but it is painted ON ground that darkens, so an untouched
decal gets *brighter* relative to its surface as the sun goes down. A module
carrying those should dim its own from its `onFrame`, matching the factor the
world is measured applying rather than picking one. `ct/lot.ts` does.

**Check it with `scripts/nightgrade.mjs`, over YOUR OWN box.** The §22 test is
static — no timing, no threshold — and it exits non-zero. Two warnings that
cost real time to learn:

- **World-wide it is a tally, not a verdict.** Intent is invisible from
  outside: `dimWorld` also skips `litSeen` and `wetMats`, and a neon blade or a
  floodlit lot that stays bright at midnight is *correct*.
- **Give it the right box.** The same thirteen faults were filed against
  `ct/lot.ts` twice from a box holding none of it; they were another module's
  neon, ten blocks away. A finding routed to the wrong owner is a finding that
  dies. If your module can publish its own footprint — `ct/lot.ts` exports
  `LOT.bounds` — do that instead of writing coordinates into a document.

**And check before you file.** I reported this twice as a bug in `ct/props.ts`.
It was not: skipping transparent materials was correct, and the flag was mine
both times.

## 23. Real is not the same as visible — triage by what a player sees

<!-- Numbered 23, not 22. It landed as a second `## 22` while the existing §22
     (alphaTest/transparent) was already cited nine times from ct/props.ts and
     scripts/nightgrade.mjs — including in that script's own pass/fail output,
     so a reader following "0 materials break GOTCHAS §22" would have landed
     here instead. Renumbered the newer one because the references all point at
     the older. — C -->

The auditor's own line, after 3,400 lines of reports across five audits:

> **Establishing that a defect is real is not the same as establishing that it
> matters.**

It found this out by nearly routing a builder to fix twelve mirrored pennant
faces that turn out to be symmetric triangles — genuinely flipped, provably
invisible. The severity tables in the individual reports rank by MEASUREMENT
CONFIDENCE, which is a different axis entirely, and the desk had been routing
from them.

`notes/AUDIT-TRIAGE.md` is now the file the desk routes from: every open
finding graded by whether a player can see it, with an explicit **record, do
not route** section for defects that are real and invisible. A latent bug that
is written down costs nothing; a builder-hour spent on one costs a user-visible
fix somewhere else.

## 24. Name a script for what it ASSERTS, not for the subject it looks at

Two scripts were silently lost in one session, and neither loss failed
anything — because **a script that is gone does not go red, it stops being
run.**

- `scripts/curbcut.mjs` was a measurement suite (kerb profile, ramp-not-a-step,
  a control walk 9 m north). I wrote a screenshot script for the same feature
  under the same name; on a rebase mine won and theirs vanished. The curb cut
  could then have been deleted whole with the suite staying green.
- `scripts/wet.mjs` went the same way, and with it the assertion that puddles
  are DARKER than the road — the exact bug that got that feature rejected four
  times.

Both were found only because somebody sat down to break things on purpose
(`a84cf885`) and noticed the checks were not passing, they were absent. Neither
git nor the build says a word: a rebase that takes "theirs" for a path is a
normal, silent resolution.

**`wet`, `rain`, `curbcut`, `lot`, `seams`, `verify` are SUBJECTS**, and more
than one agent will investigate the same subject. Look at `scripts/` — `lot`,
`lot2`, `lotwalk`, `lot-frontage`; `wet`, `wet2`, `wetness`; `seams` through
`seams6`; `verify`, `verify2`, `verify3`. Every one of those pairs is a
collision that happened to be noticed.

**So name the file after the claim it makes, or prefix it with who owns it:**

    kerbcut.mjs        the kerb profile holds        (assertion)
    curbcut-shots.mjs  pictures of the curb cut      (investigation)
    E-park-walk.mjs    E's park is walkable          (owner-prefixed)

Investigations and assertion suites are both worth keeping, and **neither
survives sharing a filename.** If you are about to write a script named after
the thing you are looking at, check `ls scripts/` first — that is the whole
cost of avoiding this.

If you find a name taken, do not "improve" the file that is there. It is
somebody's check, and the fact that you were about to write your own means
you did not know what it asserted.

## 25. A texture now carries TWO declarations. They are not the same one.

Since this week a texture can be stamped twice, by different mechanisms, for
different audits:

| stamp | set by | means | missing means |
|---|---|---|---|
| `userData.masonry` | `masonry().paint()` | the declared px/m grid, `{ ppm, mult, wMeters … }` | **not painted by `masonry()`** — a sign, a decal, a cabin wall |
| `userData.surface` | `declareSurface(t, kind)` | what it IS: `brick`, `sign`, `foliage`, `ground`, `detail` | nobody has said what it is |

`scripts/seampairs.mjs` prints `(decl 16)` / `(decl null)` and the word
`UNDECLARED`. **All of that is the masonry column.** `decl null` on a painted
sign is correct and expected — it is not masonry, and it never claimed to be.

I read that column as the surface declaration and spent a round convincing
myself a tool was reporting my declared faces as undeclared. It was not. Three
faces I checked — an office cabin, a light-pool decal and a ground plane — all
carry `surface`, all correctly carry no `masonry`, and the tool was right about
every one of them.

**Before reporting that a checker is wrong about your module, read what its
column is actually asking.** The near-miss rate on this is high: it would have
been my third false routing this week, in a session where I had already
corrected two other agents for the same thing.

The two stamps answer different questions and both are worth having — *is this
face on the brick grid* and *what kind of thing is this face* — but nothing in
the word "declared" tells you which one a tool means.

## 26. Prove which world your script measured

`24163f69`: 55 of 60 scripts in `scripts/` ran a bare
`p.goto('http://localhost:4184/')`. Port 4184 is the auditor's worktree — a
different commit, a different bundle. Every one of those 55 reads somebody
else's build as your own work, and nothing says so.

**Honouring `SHOT_URL` is only half a fix.** A default port is still a live
server belonging to whoever started it. And there is a second road to the same
failure that no URL discipline catches: **your own preview serving a dist you
built two rebases ago.** I hit that one this week without noticing, in a
session where I was correcting other people for measuring the wrong world.

`ct/hud.ts` paints the build stamp — short SHA, `+` if dirty — into the corner
from `virtual:build-stamp`. So don't infer which world you are in, ask it:

```js
import { reportWorld } from './lib/which-world.mjs';
await reportWorld(page, URL);   // prints the build; throws on a different SHA
```

A dirty tree passes — uncommitted work is what you are testing. A different
commit does not.

Two rules fall out of it:

- **Print the build on every run**, not only on failure. A number with no
  provenance is not evidence, and the cheapest provenance is one line of
  output nobody has to ask for.
- **Rebuild before you measure.** `npm run build` is 200 ms; a stale dist is
  the same class of wrong as a stale document, and the same class as a check
  that has left the tree (§24) — all three fail by being quietly absent rather
  than by going red.

## 27. A check you have never watched fail is a check you will ARGUE WITH

Three times in one day, across two builders, a check saw a real bug and let it
through — not by missing it, but by being **talked out of it**.

- **`seats-walk.mjs`** found the `[E]` dispatch seating players on the wrong
  bench. I wrote a paragraph in the script explaining why that was unavoidable
  geometry (*"any trigger big enough to reach one from the aisle overlaps the
  other… shrinking below 0.34 m would fix the ambiguity by making both
  unreachable"*), loosened the assertion from THE seat to A seat, and moved on.
  Three seats then passed it while seating the player somewhere they had not
  chosen. It was a three-line dispatch bug: the loop said "nearest wins" and
  broke on the first match (`098269aa`).
- **`spots-walk.mjs`** tested "orphaned" as *is anything solid within 3 m*. I
  moved the thrift's declaration onto the park frontage to watch it fire, it
  passed, I wrote that down as a known weakness — and left it in place for
  another round (`095c7d63`).
- **`lotwalk.mjs` and `door301.mjs`** printed their results with `<- must be
  true` beside them and exited 0 whatever they said, which made the READER the
  assertion. Wall the mouth or jam the doorway and both stayed green
  (`3dfe0217`).

The common shape is not carelessness. In each case the author **looked straight
at the failure** and produced a reason it did not count. A check is a claim
about the world, and the moment you start negotiating with it, it is measuring
your patience rather than the world.

**So: never let a check's tolerance be set by an argument. Set it by a
mutation.** `npm run checks -- --selftest` breaks each check on purpose in the
LIVE world — a collider pushed onto `__ct.colliders()`, the same array the
movement code tests — and requires it to go red. If it stays green, the check
is decoration.

Two things that make this less obvious than it sounds:

- **A mutation that does not actually break the thing proves nothing, and looks
  exactly like a check that works.** My first `civic-doors-walk` selftest walled
  the top of the flight; the player still stopped inside the 1.2 m trigger, the
  prompt still fired, and the selftest passed. I had to watch the selftest fail
  to fail before it was worth anything.
- **"I tested it by hand once" is the weakest form of this.** It is exactly what
  I did to `spots-walk`, and the result was a documented weakness rather than a
  fixed one, because nothing re-ran the experiment.

If you add a check, add its selftest in the same commit and register it in
`scripts/checks.mjs`. If a check has no selftest, `npm run checks -- --selftest`
prints `no selftest` next to its name — that column is a to-do list.

## 28. `vite dev` and the built bundle resolve circular imports DIFFERENTLY

<!-- Numbered 28, not 27. It landed as a second `## 27` alongside "a check you
     have never watched fail is a check you will ARGUE WITH", which was there
     first. Same rule as the 22/23 collision: the newer entry renumbers,
     because any existing reference points at the older. — C -->

Same commit, same worktree, same script:

```
vite dev      (unbundled, native ESM)   8 of 8 declared doors arrive
vite preview  (rollup bundle)           7 of 8 — GOLDEN ACES is lost
```

`ct/doors.ts` collects `export const DOOR` from an eager glob. A module in an
import cycle with it can resolve to an **undefined namespace** at collection
time, and its declaration is dropped. Whether that happens depends on module
evaluation ORDER — and a bundler hoists and orders modules differently from the
browser's own loader. So the fault is real in one and absent in the other.

**It is present in the BUILT output**, which is the worst way round: invisible
while you develop, and shipped to the artifact and to Pages.

Two agents measured this and disagreed for a day — 8 of 8 against 7 of 8, both
honest, both reproducible, neither wrong. The disagreement was never about the
world; it was about which build each of us was looking at, and nothing in
either measurement said.

**So:**

- **Verify against `vite preview`, not `vite dev`.** Anything that depends on
  module order, evaluation timing, or a cycle can differ. `npm run checks`
  defaults to the preview port for this reason.
- **Say which mode you measured.** `scripts/doors-declared.mjs` prints
  `mode: BUILT BUNDLE` or `mode: DEV SERVER` and warns on the latter. §26 made
  scripts prove WHICH BUILD they read; this is the same argument one level
  down — the same commit is two different programs.
- **"It works here" is the weakest evidence about a cycle**, and it is worth
  saying even when it is your own result that looks green.

## 29. Say which world your number describes: empty or lived, capsule in or out

<!-- Numbered 29, not 28. It landed as a THIRD colliding number, alongside
     "vite dev and the built bundle resolve circular imports differently".
     Same rule as 22/23 and 27/28: the later commit renumbers, because any
     reference that already exists points at the earlier. scripts/gotchas-
     numbers.mjs now fails on a duplicate so the next one goes red instead of
     living in the file. — C -->

Two clearance figures on this project, quoted the same way, and they are not
the same measurement. Both bit me in one day.

**Is the capsule in it?** The convention everywhere except my own notes is a
RAW GAP, quoted against the player's width:

> *"sign/meter post leaves **0.90 m** of walk … 0.90 m against a 0.72 m capsule
> is the tightest squeeze in the world"* — `AUDIT-TRIAGE.md`
> *"**1.15 m** against a 0.72 m capsule is comfortable"* — builder B

I filed a blocker reporting a 1.15 m gap as *"0.43 m of standing room once the
0.72 m player is subtracted"* and then compared **that** against the auditor's
**0.90 m**. Subtracted on one side, not the other. The comparable figure was
1.15 m — and `AUDIT-TRIAGE.md` records the tightest walk in the world being
raised *to* 1.15 m as the fix that closed the encroachment audit, so the pinch
I was reporting as the worst in the world was exactly the value that audit had
just celebrated reaching. (`ba8dda8a`, and the post had been removed anyway.)

**Empty or lived?** `__ct.colliders()` holds the built world and not the
citizens and cars moving through it, so every figure derived from it describes
a pavement with nobody on it:

```
built lane, movers dropped   1.15 m
lived: best 1.12 · median 0.77 · worst 0.72 · under 0.90 m in 14 of 20
```

Neither is wrong. The empty number is the right one for "is this geometry
sound", because a wall does not move and a pedestrian does — a check that fails
when somebody wanders through is a check people re-run until it goes green.
The lived number is the right one for "what does this feel like to play".

**So say which.** Not as a caveat at the bottom — in the sentence with the
number, because the number gets quoted and the caveat does not. Both of my
blockers were filed as "measured rather than guessed", which was true and not
sufficient: **a measurement compared against the wrong thing is a guess with a
number on it.**

## 30. A fixed sleep for anything the RENDER LOOP drives fails only under load

The clock, a door swing, a car, a walker — none of these advance in
milliseconds. They advance in FRAMES. A frame is 17 ms on an idle machine and
over a second on one running the rest of the suite, so every `waitForTimeout`
standing in for one of them is a bet on how busy the machine is.

The bet is invisible when you make it, because you make it on an idle machine:

|  `door301.mjs`, pressing E and sleeping 950 ms for the leaf | |
|---|---|
| run one at a time | **13 of 13 green** |
| six copies at once | **2 of 6 green** |

Same code, same build, same server, no navigation failures. Four reds on a door
that works perfectly — the collider was read while the leaf was still moving.

The same fault was in `lotwalk.mjs`, which answers "can I walk into the lot":
**3 of 12 green** under load holding W for a fixed 1600 ms, **12 of 12** — and
all twelve agreeing on the same opening span — once it walked until it either
got in or stopped making progress.

Know which way yours fails. `lotwalk` failed safe by luck: entering needs more
travel than being blocked does, so the opening breaks first and takes the check
red with it. A movement check built the other way round — one that concludes
"the fence held" because a starved walker never reached the fence — is a false
GREEN, and nothing will tell you.

**So wait for the event.** `scripts/lib/clock.mjs` does it for the clock
(`setClock(page, h, m)` returns when the grade is actually on screen, and warns
rather than returning quietly if frames stop). For an animation, poll the thing
itself until it stops — but **wait for it to START before you wait for it to
STOP**, or the test is satisfied instantly by the object standing still where
it began. That mistake took the same script to 0 of 10, which was at least
loud.

And the corollary for anyone certifying a script against `159b9c1c`'s candidate
list: **running it twice on a quiet machine cannot find this.** Run N copies at
once.

```sh
for i in 1 2 3 4 5 6; do node scripts/<yours>.mjs "shots/_c$i" >/tmp/c$i.log 2>&1 & done; wait
```

## 31. `fp` compares dev to dev, or dist to dist — NEVER across

CLAUDE.md sends every builder here to prove a change did not move the world:
`npm run fp before` → change → `npm run fp after` → `npm run fpdiff`, and says
textures and structure must match.

Capture one side against a dev server and the other against a preview and you
will get **about 612 texture differences out of 954** on a world you did not
touch, and conclude you destroyed the art.

Nothing is wrong with the art or the tool. `scenedump` seeds `Math.random` so
paint noise is reproducible — a seeded LCG is a **sequence**, and dev and the
bundle draw from it in different amounts before the world is even painted:

```
dev   draws at build-complete: 391067, 391067, 391067      (zero variance)
dist  draws at build-complete: 391037, 391037, 391037
first canvas of 818:  dev at draw 132, dist at draw 104
```

28 draws consumed at module-init in dev and not in the bundle — GOTCHAS 28's
evaluation-order difference again — and every texture painted afterwards gets a
different slice of the sequence.

**Dev and dist build the identical world** — `506bd4d2` proved it by stripping
the grain and comparing what exists: 1070 structure kinds and 253 texture kinds
with 0 unmatched, 3489 objects and 954 textures identical, and the 612 "lost"
textures each having a same-dimension partner among the 612 "gained". A
repaint, not a loss. (The stream is shared with three.js, which spends four
draws per object on `generateUUID`, so grain depends on how many objects
preceded a texture — which is how an offset before the first canvas reaches
everything after it.)

It is not a visual regression: the shipped world leaves `Math.random` unseeded,
so the grain differs on every load anyway. It is only ever an artefact of the
comparison. **So keep both captures on the same kind of server**, and if a
texture diff ever comes back in the hundreds, check that before believing it.

Neither the dump nor `fpdiff` records which kind of server it read, so nothing
can catch this for you today. Recording the mode in the dump and refusing a
cross-mode `fpdiff` would — offered to whoever owns those two, in
`notes/C-texture-hash.md`; `scripts/**` says do not edit another builder's file
and I have not.

## 32. Exit 3 means the check never ran

`reportWorld` aborts with **exit 3** when the server is not serving your build.
It is not a failure of the thing being checked — **no measurement was taken**,
and nothing at all follows about the world.

```
0   measured, and it is fine
1   measured, and it is WRONG
2   usage, or a --selftest that was not caught
3   ABORTED — wrong world, nothing measured
```

Until `BLOCKED-H` asked for it and `ec7aae0d` did it, a wrong-world abort was
an unhandled throw, which node turns into exit 1 — the same code as a real
failure. H lost a red to that ambiguity in a batch that discarded output;
another builder read "3 of 3 FAILED" from D-walk under load where every one was
this guard; I twice reported checks as "red" in front of the user when they had
simply aborted on a stale dist or an empty port.

**So do not read a 3 as bad news about the world, and do not read it as good
news either.** Rebuild, restart your preview, and run it again.

**And 3 is the right code for an EMPTY SUBJECT SET too**, which is the same
sentence from the other end: a check that iterates people, doors, spots or
samples and finds none has not measured the thing it guards, and cannot tell a
world that failed to build it from a read that stopped finding it. See GOTCHAS
34. Four of mine used 1 for this before `4d549f501` reached the same convention
independently — against this entry, which I wrote.

The trap this leaves elsewhere: anything that treats *non-zero* as
"the check noticed" now needs to say *non-zero except 3*. `canfail.mjs` is the
live example — it records CAUGHT on any non-zero exit, so a check that never
ran certifies as one that caught its mutation, which is a false green in the
tool whose whole job is proving checks can fail. Written up for its owner in
`notes/C-wrong-world-exit.md`.

## 33. Anything with a FRONT will end up backwards

Four separate times in one session, and each looked like its own bug:

- interiors disagreeing with their facades — a room and its facade are two
  faces of one wall, so their handedness is opposite by construction
- the casino and hotel blade signs, mirrored because a `DoubleSide` plane
  renders reversed from behind (§10)
- the car lot's far row of cars, and the chairs outside its office — a row on
  the far side of an aisle is a MIRROR of the near row, not a copy, so a
  shared heading with a flipped x offset is backwards by construction
- the tax office preparer, facing away from the client

The common shape: **an object with a front was placed by copying or
translating something, and nothing recomputed which way it should look.**

Rules that would have caught all four:
- express positions in WORLD coordinates, not local offsets or "left/right" —
  those are the terms that make mirroring gettable-wrong
- derive facing from what the object faces (the aisle, the client, the street),
  never as a constant copied from a sibling
- test by standing where a player stands and asking "is it looking at me or
  away from me" — every one of these was obvious the moment someone did

### And a tenth one that OBEYED all three rules and was still backwards

The park benches. Facing was derived from what the bench should face — the
loop's centre, via `atan2` — not copied from a sibling. It was still wrong,
because **this world has two yaw conventions and they differ by a z-flip**:

| | forward direction |
|---|---|
| a MESH at `rotation.y = t` | `( sin t,  cos t )` |
| the PLAYER/camera at yaw `t` | `( sin t, -cos t )` |

three.js cameras look down local −z and meshes are authored facing +z, and
nothing in this codebase reconciles them. **`camera = PI - mesh`.**

`facingIn` returned the MESH value, which was right for the bench body — the
backrest genuinely sat on the wall side. The same number went to `ctx.seat`,
whose yaw is consumed by the camera. So the bench faced the park and the
person sitting on it faced the wall. `civic.ts` had it right; `park.ts` was
the outlier.

Why it survived two "fixed" reports: **`E-benchface` shared the mistake.** It
scored `pose.yaw` with the mesh convention and returned 9/9 green twice.
Correcting the script alone flipped it to *"4 of 9 benches face out"* — and
only four, because the five benches on the park's x sides have `cos ≈ 0` and
are right under either convention. A convention error hides on every axis
where the term it corrupts happens to be zero.

So, added to the rules above:
- **when you compute a heading, say out loud whether it is for a MESH or for
  the CAMERA**, because the same number means opposite things
- a check that derives facing from a yaw is only as good as its convention;
  give it a POSITIVE CONTROL that flips the world and watch it go red (§27)
- and the one that actually found this: **do the player's action.** Sitting on
  the bench showed brick wall filling the frame. Nothing short of sitting in
  it had caught it in three attempts.

## 34. A check can pass because it found NOTHING TO CHECK

§27 says a check you have never watched fail is one you will argue with. This is
the same lesson one layer down: a check you have only watched fail *on a world
that is wrong* may still be unable to fail on a world it cannot see.

Two shapes, and I had both. Six scripts between them, three of them not mine.

**Shape one — the mode word that matches no branch.** Most scripts here take a
mode:

```js
const mode = process.argv[2] ?? 'all';
if (mode === 'probe' || mode === 'all') { ...the entire check... }
if (mode === 'shots' || mode === 'all') { ... }
```

Hand it a mode neither branch matches — `--probe` instead of `probe`, the flag
form most of this suite takes — and it runs nothing, falls off the end of the
file, and **exits 0**. One second, green, zero assertions, identical on the
board to a real pass. Found by mistyping `bus --walk`; five of mine did it, and
`no-silent-pass.mjs` immediately found three more.

Fix: `scripts/lib/modes.mjs`. Name the modes you dispatch on; anything else
exits 2 before `chromium.launch()`.

```js
import { modes } from './lib/modes.mjs';
const mode = modes('bus', ['shots', 'walk', 'bench', 'stop', 'all']);
```

**Shape two — the absence over an empty set.** Most verdicts here are absences:
nothing straddles the kerb, no halo is misplaced, no colour is impossible. All
of them are FREE when the population is empty.

`footprint.mjs` guards the user's tree-pit clearance. Widen the pit plane from
1.0 m to 1.04 and its predicate stops recognising a tree pit — the pits are
still standing in the street, the check simply cannot see them:

```
on the main street: 31 litter meshes, 0 tree pits, 9 water sheets
OK  nothing straddles the kerb line (0)
OK  nothing sits below the ground under it (0)
exit=0
```

The clearance block is wrapped in `if (r.pits.length)`, so it does not even
print. There is no missing output to notice. `glow.mjs` was worse: its
population test is an *equality* (halos paired vs halos stamped), and 0 of 0
satisfies it.

Fix: assert the population before the absences, with a floor you **measured**.

```js
if (halosSeen < 15) { /* FAIL: every verdict below passes for free at zero */ }
```

**Two things this costs you if you skip it:**

*Your mutation probably cannot catch this.* canfail breaks the WORLD and asks
whether the check notices. This class needs a mutation that breaks the CHECK'S
VIEW while leaving the world intact — `footprint-blind`, `glow-blind`. The
existing `footprint-pits` moves `PIT_X`, so the pits still match the predicate
and are still found; a mutation that keeps the population intact proves nothing
about whether the population is checked. And no mutation of any kind reaches
shape one, because canfail invokes every check with the same correct arguments
`checks.mjs` does.

*Positive verdicts resist this, but do not assume they are immune.* I wrote
exactly that here first, from reasoning, and then went and watched. Half of it
held and half did not.

`bus.mjs` is genuinely safe: it locates the stop from `userData.benchAd` and
fails explicitly when that returns nothing, so there is no walk to pass.

`wetness.mjs` was safe against ZERO and not against a COLLAPSE. Retexturing the
puddle sheet 48x32 -> 48x34 leaves every puddle in the street and hides them
from its predicate; the population fell from ELEVEN to TWO and the file did go
red — on "puddles are still filling", because the two survivors happened to
saturate. Right outcome, wrong reason. Had they not saturated, two pools of
eleven would have passed three of its six verdicts, and its one real floor
(`spread.size >= 3`, three distinct depths) only bites below three.

So: prefer asserting what must be TRUE, because it fails on an empty world far
more often than an absence does. Then assert the population anyway, because
"more often" is not "always" and you will not know which one you have until you
break it and look.

**Measure the floor. Do not remember it.** I wrote `pits: 10` from memory and my
new guard failed the unmutated street on its first run — it has seven. That was
in the same commit where I was fixing a check for not measuring.

## 35. Back-to-back planes want the SAME texture, not a mirrored one

§33 says anything with a front ends up backwards. This is the specific repair
that keeps getting mis-stated, and mis-stating it re-creates the very bug it is
meant to fix.

The correct fix for a double-sided sign that reads mirrored from behind (§10) is
**two single-sided planes back to back, a hair apart, facing opposite ways**.
That part is widely written down. What follows it is usually a clause like *"…
with the texture flipped horizontally on the rear one"*, and that clause is
**wrong**. It is currently sitting in at least one queue file — mine — where the
next reader will do exactly as told and re-introduce the mirroring.

**Why the rear plane needs no flip.** `PlaneGeometry` lies in XY with u along
local +x and its normal along local +z. Rotate by `ry = θ` and u maps to
`(cos θ, 0, −sin θ)`, the normal to `(sin θ, 0, cos θ)`:

| `ry` | faces | u runs | viewer's forward | viewer's right = `cross(fwd, up)` |
|---|---|---|---|---|
| `−π/2` | −x | **+z** | +x | **+z** |
| `+π/2` | +x | **−z** | −x | **−z** |

In both rows u increases toward the reader's right, so the same texture reads
left-to-right from both sides. **The rotation has already done the mirroring.**
Flipping the rear texture applies it a second time, and two mirrorings is a
mirror.

The trap is that "the rear face must be mirrored" is true — it is just already
true, paid for by the rotation, and paying again reverses it. This is the same
shape as §33's car-lot row: a mirror the construction already performed, applied
once more by hand.

**How to test it in ten seconds**, which beats deriving it: stand on each side in
turn and read the sign. Not a screenshot from one angle — the whole defect is
that one side is right. If you want it in a check, compare the two planes'
`map.repeat.x`: back-to-back planes that read correctly have the **same sign**,
and a `-1/w` against a `+1/w` is the bug. `G-vice-walk` asserts this both ways,
by pixels and by the transform, so anyone who "fixes" the blades per that clause
gets a red rather than a shipped mirror.

## 36. Cite commit hashes that are ALREADY MERGED

Your own un-merged commits are renamed by the rebase that lands them. A note
citing one is correct while you write it and wrong the moment it is useful to
anybody else — which is the moment somebody else opens the note. Other builders'
landed commits are stable. Waiting costs nothing.

This is not a small leak. `5fae9ec5b` measured **149 of 750 citations across the
project dead to everyone but their author**, and `10006a2ab` re-measured it and
found it was not shrinking, because repair alone re-opens: every builder rebases
on nearly every turn.

**The rule is one line, and so is the check.** Do not use `git cat-file -e` — it
resolves orphaned objects that exist only in your own worktree, which is exactly
how two of us separately published "every citation resolves" about notes that
were broken for everybody else. Ask whether it is reachable:

```sh
git merge-base --is-ancestor "$h" add-stick-and-city98
```

**If you are repairing old citations rather than writing new ones:** match the
dead hash to its landed twin with `git patch-id --stable`, not by commit subject.
Two commits can share a subject; the patch-id is the change itself. `12be9e163`
built the project-wide recovery table this way, and it has a deadline — the
repair needs the old object still readable, and git is already warning about
too many unreachable loose objects.

**Do not do what that warning tells you to do.** It ends *"run `git prune` to
remove them"*, and bare `git prune` removes **every** unreachable loose object
regardless of age — `--expire <time>` only *narrows* it to objects older than
that, it is not a safety default. `git gc` is the safe one: it prunes on
`gc.pruneExpire`, unset in this repo, so git's two-week default protects
anything recent. The presence of `.git/worktrees/<wt>/gc.log` is what is
currently suppressing the automatic run — which is why the same warning repeats
on every commit instead of a gc happening. Deleting that file to make the
warning go away re-arms the thing the table is racing. The mapping in
`notes/AUDIT-hash-recovery.md` survives a prune because it is written down; what
does not survive is the ability to *verify* a mapping by patch-id, and any dead
citation written after that table was built.

*Provenance, since this section is not the work of the hand that typed it.* The
rule is `6ce778e4a`'s, the measurements are `5fae9ec5b` and `10006a2ab`, the
recovery table and the patch-id method are `12be9e163`, and `0a201c46c` is the
routing note that asked for this section and specified its content — correctly
observing that a rule living in one builder's feature handoff cannot stop a
project-wide leak, because nobody reads another agent's handoff before citing a
hash. I wrote it in rather than leaving it queued because `OWNERSHIP.md`'s
actual text is *"`scripts/**` and `notes/**` — anyone may add files. Do not edit
another agent's script or handoff note"*, and this file is neither. If the desk
holds `GOTCHAS.md` as desk-only anyway, then §35 is mine and equally out of
order — revert both, not just this one. My own contribution here is small: 14
dead citations of my own repaired and re-verified by patch-id (`48b9156a6`).

## 37. A dev-server pass says nothing about what SHIPS — and the tool for that is currently broken

Everything the user opens is one of two builds neither of which is the dev
server: the bundle (`npm run build`) and the packed single-file artifact
(`dist/artifact.html`). `notes/BLOCKED-C.md` §0 recorded a whole week of "all
eight doors reach declaredDoors()" claims that described **dev** — the built
bundle was dropping three of them to an undefined namespace at collection time,
and the check said so in its own output.

`scripts/slow-pinned.sh` is the sanctioned way to check against a pinned build.
**It cannot start its server right now** and dies with *"the server never
reported a port"* while Vite has plainly printed one — line 119 matches
`:([0-9]+)/`, but Vite 8 colourises the port, so the raw line is

```
localhost:  ESC[1m  24684  ESC[22m  /
```

and the digits are not adjacent to the slash. It worked until Vite started
bolding the number, then failed for everyone at once. Filed to H; until it
lands, **the whole slow tier is unrunnable and nobody is checking the bundle.**

Do it by hand instead — it is three commands, and every ordinary check works
against both:

```bash
npm run build && npx vite preview --port 4199 --strictPort &
SHOT_URL=http://localhost:4199/ node scripts/door301.mjs

node scripts/pack-artifact.mjs
npx vite preview --port 4201 --strictPort --outDir dist &
SHOT_URL=http://localhost:4201/artifact.html node scripts/door301.mjs
```

**The deep checks run against the artifact**, which is worth knowing because
nothing in the tree does it: `check-artifact.mjs` is the only artifact check and
it stops at *"it opens standalone and draws"* — it would pass just as happily
with the spawn on the street, a door gapping, or a whole module missing.

Related: §31, which is the same trap one level down — capture `fp` against dev
and compare it to dist and you will conclude you destroyed 612 textures you
never touched.

## 38. Continuous integration and playtesting are incompatible

<!-- Numbered 38, not 24. This entry and the four below it (39-42), plus 43,
     were a SECOND run of 24-28 and a second 37 living at the foot of the file:
     43 headings numbering 1..37, which is what scripts/gotchas-numbers.mjs
     had been going red on. The rule this file states three times is that the
     LATER commit renumbers, because any existing reference points at the
     earlier entry — so which of each pair moved was decided by COMMIT TIME,
     not by position in the file:

       tail 24-28  1785019055 .. 1785025469   ->  38-42   (these)
       main 24-28  1784975855 .. 1784986835   ->  unchanged
       37 @1023    1785030023                 ->  43
       37 @842     1785029165                 ->  unchanged

     Nothing that cited 24-28 or 37 changes meaning: those numbers already
     resolved to the main-sequence entries for every reader, so a citation
     aimed at the content below was broken before this and is merely findable
     now. Renumbered by A, whose scripts/checks.mjs run was the one going red;
     the content is the desk's and is untouched. -->

The live world rebuilt every 15 s from every worktree. With one or two builders
that felt like magic. With nine it made the world unplayable, and the user said
so twice in different words — *"the world restarts on a loop"* and *"why does
the game refresh like every minute"*.

Two separate faults sat behind those:

- **Spurious reloads.** `commit-tree` mints a new commit SHA every cycle from
  the timestamp alone, so a signature built from commit hashes never matched
  the previous run and the branch was rewritten even when nothing had changed.
  Sign on TREES.
- **Real reloads, which are not a bug.** Nine agents landing work means the
  world genuinely is different a minute later. A loop that always shows the
  newest world is precisely a loop that never lets you stand still in one.

So: **the integrator loop is OFF during a playtest.** `scripts/pull-latest.sh`
refreshes once, on demand, and the user reloads the tab when they choose. Turn
the loop back on for long unattended runs, at a couple of minutes, not fifteen
seconds.

## 39. A dirty mainline tree silently stops the merge train

`land.sh` refuses to merge into a dirty working tree — correctly, since merging
over uncommitted work would destroy it. But the failure is reported as
`[merge failed]` against the BUILDER, which points at the wrong place entirely.

The desk's own `route.sh` appended each routed request to
`FEATURE-REQUESTS.md` and never committed it. Mainline was therefore dirty
essentially all the time, and nothing landed. It surfaced only when two
builders had **111 commits stranded between them** — hours of finished work
the user could not see, caused by one uncommitted markdown file.

Two rules: anything the desk writes to a tracked file gets committed in the
same breath, and if `land.sh` reports `merge failed` for more than one builder
at once, **check mainline's own tree first** — a single shared cause is far
likelier than several builders conflicting simultaneously.

## 40. A stopped integrator means a STALE world — refresh it after every batch

Turning the integration loop off during a playtest is right (§24). Forgetting
to refresh it is not. The world sat **47 minutes and 226 commits behind** while
the user playtested it and reported faults that had already been fixed — the
bunting, among others, was rebuilt and they were still looking at the old one.

The desk's job when the loop is off:

- run `scripts/pull-latest.sh` **after every batch of fixes lands**, and tell
  the user to reload — they cannot know the world moved
- when a user reports something as still broken, **check the live world's age
  before routing it**. `git -C ../rpg-live log -1 --format=%cr` takes a second
  and prevents a builder being sent to fix what it already fixed.

## 41. Verify BOTH sides of anything mirrored — the mirror is where the bug hides

The user's own diagnosis, and it is better than the one the desk had: *"the
worker doesn't realise they need to confirm the logic independently per side of
the car."*

§23 says anything with a front will end up backwards. This is the verification
half of it: when geometry is mirrored — the two flanks of a vehicle, two rows
either side of an aisle, a room against its facade, a blade sign's two faces —
checking one instance proves nothing about the other. The mirror is precisely
the operation that breaks handedness, so it is precisely where a bug survives a
confident test.

**Check each side independently, and say in the handoff that you did.** Every
one of the session's five facing bugs would have been caught by one extra look
from the opposite side.

## 42. A dead agent looks exactly like an idle one

When a Claude session exits it leaves a bare shell prompt in its tmux window.
Every state check the desk had — spinner, input box, mode line — reads that as
"idle". Two builders' sessions exited during one stretch and the desk kept
routing work to them; one was found by accident an hour later, the other only
when a check was finally written for it.

`scripts/desk.sh` now reports **DEAD** when a window shows a shell prompt and
no Claude mode line, and `desk-watch.sh` restarts it automatically and re-briefs
it from its queue file. That recovery is free precisely because the queue files
exist — the brief was never in the agent's head.

## 43. A DURATION measured in a headless browser reads ~1.5× too long

`src/main.ts:107` clamps the simulation's timestep:

```js
const dt = Math.min(clock.getDelta(), 0.05);
```

That clamp is correct — without it, one long frame teleports everybody through
a wall. But it means **sim time and wall time are not the same clock below
20 fps**, and a headless Chromium running a probe is well below 20 fps.

Measured on this world, headless, with a probe reading `__ct.walkers()` once a
frame: **13.2 fps, mean frame 75.9 ms, 263 of 264 frames over the 50 ms clamp.**
Sim time therefore advances at **0.659 × wall time**. Every in-world duration
stretches by 1/0.659 = 1.52×.

This cost the auditor and me a round trip. `crowd.ts` gives a shop window a
`WAIT.window = [5, 12]` second pause; the audit measured a single uninterrupted
window act at **16–18 s** and flagged it, quite reasonably, as a possible fault.
It is not one: 12 s of sim time is 18.2 s of wall clock at that frame rate, and
the measured 18.6 s matches to within the sampling interval. Nothing was wrong
with the crowd.

**So: never compare an in-world duration against a wall-clock stopwatch.** The
tell is a ratio near 1.5 between what you measured and what the constant says —
if the numbers are 1.5× apart, suspect this before you suspect the code.

Three ways to stay honest, in order of preference:

1. **Measure in sim time.** Read the quantity the world itself is counting
   (`wait`, `jam`, `stuck`) rather than timing it from outside. Those tick in
   `dt`, so they are directly comparable to the constants.
2. **Report the frame rate alongside any duration**, so a 1.5× reading is
   visible as a 1.5× reading rather than as a bug.
3. **Scale**: if you must use wall time, multiply by the measured
   `simTimePerWallSecond` before comparing.

Related to §30, which is the same clock confusion in the other direction: there,
a wall-clock sleep was too SHORT for the render loop; here, a wall-clock
stopwatch reads too LONG for it.

**The gameplay implication is worth someone's attention, and it is not mine to
fix** (`src/main.ts` is not a builder-owned file): a player whose machine dips
below 20 fps does not merely see fewer frames, they see the whole world run in
slow motion — people stand at windows half again as long, traffic crawls. If the
world is ever reported as "sluggish" rather than "choppy", this clamp is the
first place to look.

## 44. A measurement written as a FAULT is read as an open fault forever

We record numbers in comments and notes constantly, and almost always at the
moment something is wrong — that is when anyone bothers to measure. Then the
thing gets fixed, and the measurement stays exactly as it was written, in the
present tense, with no outcome beside it.

**It does not read as history. It reads as an open defect**, because nothing in
it says otherwise, and the next person pays for the whole investigation again.

Five of these in one session, all mine, found only by re-testing my own claims:

| where | what it said | what was true |
|---|---|---|
| `ct/alley.ts` | *"road −58%, alley −6% … the street soaked and the alley stayed dry"* | both −12.1%, fixed by the `wet()` call three lines below it |
| `notes/D-atm-evidence.md` | *"THE FASCIA IS A THIRD TOO SHORT"*, 0.680 m | 0.830 m, after a desk ruling and a user revision |
| `FEATURE-REQUESTS.md` | *"visual half BLOCKED on helpers A has not exported"* | exported long since; my own `BLOCKED-D` had been withdrawn on that basis |
| `FEATURE-REQUESTS.md` | *"built, waiting on D's roster"* | the roster placed it; 491 lot meshes in the world |
| `notes/D-shop-resize.md` | *"the fifth number cannot hold with the other two"* | it can — I had dropped a term from the stack |

**The ATM one is the expensive shape**: the ledger row says *"read
notes/D-atm-evidence.md before touching the object"*, so a record actively routed
people to a note describing a fault that had been ruled on twice. An object with
four attempts and a ruling behind it was one reader away from a fifth attempt.

**And a stale BLOCKED is worse than no entry at all.** A blank makes somebody
ask; *"blocked on A"* tells the desk to route elsewhere and wait.

### What to do instead

- **Write the "after" in the same place as the "before".** Not in the commit
  message, not in a new note — beside the number, where the next reader's eye
  already is. Keep the original: it is the evidence that justified the fix, and
  deleting it loses why the shape is what it is.
- **Past tense for a closed fault.** *"It was a fixed 12.8 m and its neighbours
  are 16–19 m"* cannot be misread; *"the alley stays dry"* cannot be read any
  other way than as now.
- **If you correct a status, correct it everywhere it lives.** I fixed the
  bodega BLOCKED in the ledger and left it standing in `FEATURE-REQUESTS.md` for
  several rounds. Half a correction is most of the way to none, because the two
  files are read by different people for different reasons — and the desk routes
  from the master log, not from the ledger.

### Why a check cannot do this for you

`scripts/citations-resolve.mjs` catches a pointer into a file that no longer has
that line, and `hashes-resolve` catches a commit nobody else can reach. **Neither
can catch a number that is simply no longer true**, because the note is
well-formed and the file it names still exists. The only instrument that finds
these is re-measuring your own claims, which is also how every one of the five
above turned up.

**A worked example of that gap, found while writing this entry.** My own summary
note cited the ATM ruling at `ct/street.ts:810`. Correct when written — and wrong
the moment I split the bank out of that file into `ct/bank.ts`. `citations-resolve`
passes it, because line 810 still exists: it is the EAST roster loop now. A
reader following the citation lands on a `for` loop over the block roster and has
no way to know they were sent somewhere else. **A refactor rots citations INTO
the file it moved code out of, and the pointer that rots is the one that still
resolves.** So after moving code, grep your own notes for the file you moved it
FROM — the check cannot do that half for you.


## 45. "Match the exterior" means WHICH SIDE THE DOOR IS ON — not the dimensions

The user, 2026-07-25, unprompted, after four builders had spent days making
interiors fit their facades:

> *"by matching the exterior i really mean in general positioning. no one is
> going to take a ruler and measure the width of the inner and outer."*

And in the same message, of the church: *"you can make it wider than it
actually is outside too."*

So every "the interior must match the facade" instruction in this project — and
there have been many, because the user has raised it about the bodega three
times, the hotel, the casino and the diner — has always been about **the door's
situation**, and never about area:

- the door is hard right on the facade → it is hard right inside
- the entrance is on a **cut corner** → you walk in diagonally and the two
  walls open away from you left and right
- there are two storeys of windows outside → there is an upstairs

What is NOT constrained: width, depth, ceiling height, floor area. **Take the
room you need.**

The desk enforced dimensional equality that was never asked for, and it cost
the bodega, the casino and the hotel their depth — three rooms the user then
sent back for being cramped, which is the exact opposite of what the constraint
was supposed to protect. It also produced the worst single reversal of the
project: *"instead of doing what i asked which is change the exterior to match
the interior you changed the interior to match the exterior. thats annoying."*

The authority runs **room → facade**. The room declares its door and the
painter follows. If the room needs a chamfered entry, the room declares a
chamfered entry.

One corollary worth keeping, from the auditor's library measurement:
**"cramped" is a statement about SHAPE, not area.** The library doubled from
163 to 326 m² and its median clear aisle *fell* to 2.10 m — the narrowest of
all ten rooms — because the new footprint got cut into strips by stacks. Free
floor was a normal 81%. Measure the largest continuous free run
(`scripts/roomaisle.mjs`), not the square metres, before calling a room fixed.

## 46. A complaint about EXECUTION is not a verdict on the THING

The user said, over several passes: *"gazebo shelter is fucked"*, *"this like
shelter gazebo thing hasw graphics issues abound"*. The desk read that as
patience running out and ruled **"third and final attempt or delete"**. E
deleted it. The user's next message:

> *"also the gazebo shelter type thing in the park is gone, i liked it."*

He was never complaining about the shelter. He was complaining about z-fighting
roof planes, posts that did not meet the deck, and a bin intersecting it — a
**defect list**, delivered in strong language because the defects kept coming
back.

The desk turned a defect list into a verdict, and deleting was the one outcome
that could not be recovered from by trying again. **When a thing has been
rejected repeatedly, the question is whether the DEFECTS are converging, not
whether the user still wants the thing.** If you cannot tell, ask — one
question costs a message; a deletion costs the feature and the pass that built
it.

The same reading error nearly happened twice more:

- **The puddles** were removed after five attempts, and that ruling was right —
  but only because the user had said *"i think these are puddles and they look
  awful honestly"*, which is a verdict on the thing itself.
- **PVBLIC LIBRARY** was the reverse: the desk sat on a defensible detail
  (Roman capitals have no U) waiting for a ruling instead of asking, and the
  user read it as a typo twice before it got fixed.

Strong language about how something looks is a bug report. A statement that the
thing itself is unwanted is a verdict. They are different messages and only the
second one licenses removal.

## 47. The desk's own direct dispatches are the ones that go unlogged

`scripts/route.sh` exists so a request cannot be dispatched without being
logged — it writes `FEATURE-REQUESTS.md`, appends a LEDGER row, sends the brief
and verifies it landed, in one command, precisely because the desk skipped the
logging step during a fast stretch.

It does not help when the desk sends a brief by raw `tmux send-keys`, which is
what happens for follow-ups, rebriefs and re-routes. Four real pieces of work
were dispatched that way in one session and none had a ledger row:

```
B  the printed-signage night opt-out   built, landed, invisible
B  the east-end crossing               built, landed, invisible
B  the new alley's ground              built, landed, invisible
A  the world-wide flat-colour class    routed, never tracked
```

`live.sh B` read **0 live** while B was building three of the user's requests,
and B declared `DONE` truthfully by the only record it had. The same shape as
H reading 0 live with an untracked request in `FEATURE-REQUESTS.md`.

**Rule: raw `tmux send-keys` is for STATUS and RULINGS only** — things already
recorded elsewhere. Anything that asks a builder to make something new goes
through `route.sh`, even when it is the second half of a request already
logged, and even when it is a re-route of existing work to a different owner.
A split request needs a row per half or the half nobody sees never gets
confirmed.

## 48. A probe whose STRIDE is longer than the feature reports smooth ground as a cliff

`D-walk` reported three reds on the church steps for days — *"ground reached
0.45"*, *"1 steps of rise, not one teleport"*, *"1 jumps over 0.34 m"*. They sat
unattributed across a rebase and I was one commit away from routing them to E as
a regression on a **CONFIRMED** row.

The world was never wrong. The churchyard climb is a **continuous 1 m ramp**:
sampling the floor picker at 0.05 m it goes 0 → 0.55 over x 8.1…9.1 in
increments of **0.020–0.021 m**, with no discontinuity anywhere in it. The walk
took its samples between `hold('w', 180)` calls, and **one 180 ms hold covers
more ground than the whole ramp**. So the climb landed inside a single sample,
and a single sample containing the entire rise is indistinguishable — to that
probe — from a teleport off a cliff.

Two of the three reds were the *same* artifact counted twice: "it did not climb
gradually" and "it jolted a riser" are both just "my stride was 1 m and the
feature is 1 m".

**§30 is the same fault with the sign flipped.** There the fixed sleep was too
SHORT and the world had not finished moving; here the stride was too LONG and
the world had finished moving before the next sample. Both make a sound world
fail, which is the expensive direction — a red on someone else's confirmed row
costs them a re-walk and costs you your credibility when it turns out to be
yours.

**The rule:** before asserting on a shape, know the size of the shape, and
sample at least a few times inside it. If the quantity has a source that can be
read directly — the floor picker defines the floor — read the source and assert
on that. Then keep **one** assertion that the player actually experiences it, or
you have proved a fact about your probe and nothing about the game (§34).

`D-walk`'s churchyard block now does exactly that split: two claims measured on
`groundAt` at 0.05 m, and one lived claim that walking really carries you up.

## 49. PUBLISHED is not ADOPTED — and a row can be CONFIRMED and untrue at once

The sleep-fade row read **CONFIRMED**. A went and tried it:

```
CONTROL  window.__hud.fade({ mid })   peak opacity 1.000, 21 of 26 samples black
BED      [E] sleep until morning      peak opacity 0.000,  0 of 25, clock +16.5 h
```

**The capability worked and its only caller never called it.** The clock ramped
sixteen hours with no fade at all. Two verifiers found it independently, and
neither would have if they had checked that the fade *existed* rather than that
*going to sleep faded*.

This project now runs on published capabilities with separate adopters —
`ctx.seat`, `ctx.spot`, `ctx.ground`, `ctx.advanceTime`, `citizenSprite`'s
seated pose, K's pockets, K's panel framework, K's screen fade. **Every one of
them can be built, correct, tested, and reach nobody.** The seated pose sat at
`0 of 10 int-*.ts` for hours while its row read as delivered.

So:

1. **A row is the USER'S SENTENCE, not the capability.** *"when the player goes
   to sleep i want the screen to fade to black"* is only true when going to
   sleep fades the screen. Verify the sentence, from where the player stands.
2. **Split the row when the work splits** — one for the capability, one for the
   adoption, on their own owners. H asked for exactly that split on the seated
   pose and was right: *"as one row it reads as H being late for work in files I
   do not own."*
3. **The publisher's own check cannot see this.** K's fade passed every test K
   could write, because K does not own the bed.

The cheapest guard is the control A took FIRST: prove the capability works
directly, then prove the real path invokes it. If only the first passes, you
have found this bug.

## 50. An instrument aimed at the wrong world reports a catastrophe it cannot see

B ran the mutation suite as a routine regression pass and found **five guards
SLEPT** — the mutation applied, the world deliberately broken, the check passing
anyway. Four confirmed user requests rested on those guards. It refused to patch
them with ten minutes of context left, on the grounds that *"a guard repaired in
a hurry is how you get a check that passes without checking"*.

A then re-ran the same six cases **aimed at a world built from the tree being
mutated**:

```
SHOT_URL=http://localhost:4188/ node scripts/canfail.mjs ...
  6 / 6 CAUGHT
```

**The guards were never asleep.** `canfail` defaults to a port, the default was
not the world under test, and it reported that everything it could not see was
fine.

This is the THIRD instrument of the same family in one session:

| instrument | fault |
|---|---|
| `reach.mjs` | seeded its flood fill outside its own grid, declared the whole world unwalkable — **at exit 0** |
| `footpaint.mjs` | hardcoded `localhost:4184`, so only its author could aim it |
| `canfail.mjs` | defaulted to a world that was not the one being mutated |
| `floaters-walk.mjs` | accepted a room argument and ignored it |

**The shape: an instrument that cannot be aimed will answer about whatever it is
looking at, and say nothing about what you asked.** Worse than a broken check,
because it produces a specific, credible, wrong number.

Two rules, both cheap:

1. **An instrument must refuse to run unaimed** rather than defaulting. A
   default target is a silent wrong answer; an error is a loud right one.
2. **An argument a script accepts and ignores is worse than one it rejects.**

And the human lesson, which is B's: **when a guard reports that other guards
have stopped guarding, do not repair it in a hurry.** Had B "fixed" five working
guards, it would have damaged the only mechanism that can detect this class at
all — while every board stayed green.

## 51. The player SPAWNS INSIDE 301, and a warp that changes STOREY takes ~1.5 s

Two facts that cost me a dozen wrong readings in one sitting, both about the gap
between *telling the world where you are* and *the world agreeing*.

**A fresh page does not start you on the street.** It starts you in room 301 at
`(198.60, −16.30)`, `gy 5.4`. So the very first prompt any probe reads is
whatever is live in the flat — for me, `[E] sit on the bed and watch TV`. Read
that while believing you are outside and it looks like a spot **194 m away** has
won the pick, which is a spectacular-looking bug in the selection code and is
nothing at all.

**And `warp` does not land instantly when it crosses a floor.** The floor picker
has hysteresis (§7), so the storey — and therefore every `ok()` gated on it, and
therefore the prompt — takes about **1.5 s** to settle. Measured, warping from
301 (`gy 5.4`) to the street door (`gy 0.14`):

```
  at load   [E] sit on the bed and watch TV    (198.60, −16.30)  gy 5.4
  +100 ms   ""                                 (5.50, −44.00)    gy 0.14
  +900 ms   ""                                 (5.39, −44.00)    gy 0.14
  +1500 ms  [E] enter No. 227                  (5.39, −44.00)    gy 0.14
```

Position is right after one frame. **The prompt is not.** A 300 ms settle — which
is plenty for a warp *within* one floor, and is what every one of my other
scripts uses — reads the empty string and reports "nothing is offered here". I
concluded that a station in somebody else's row did not work, twice, before
noticing that my own probe was reading a HUD that had not caught up.

**The rule:** after any warp that changes `pos()[3]`, wait for the prompt to
*stop changing* rather than for a fixed time — or at minimum allow 1.5 s. Within
a single floor, 260 ms is fine. This is §30's family — a fixed sleep shorter than
the thing it waits for — and the reason it bites here specifically is that the
delay is invisible: nothing about the position readout suggests the HUD is
lagging behind it.

## 52. Watch your ERROR RATE, not just your errors — and stop when it turns

F stopped itself mid-session and asked to be compacted:

> *"I am producing errors faster than findings. Fourteen instrument mistakes
> this session, and the last one is a straight repeat: I retyped a heading bug —
> `atan2(nx, nz)` where it must be `atan2(-nx, nz)` — that I had diagnosed,
> fixed, and written up a few hours earlier. It walked me 200 m off the map
> while 'verifying' the bodega. The earlier errors were new mistakes and each
> produced something useful once caught. This one produced nothing and cost a
> row."*

**That distinction is the whole entry.** A new mistake that yields a finding is
the cost of working at the edge of what you know. **A repeat of a bug you
personally diagnosed and documented is not a mistake — it is a signal that your
context has degraded**, and everything you produce after it is suspect.

Nobody can see this from outside. `board.sh` sees a spinner and commits; the
ledger sees rows moving. An agent working confidently and wrongly looks exactly
like an agent working well, right up until a verifier or the user finds it.

So: **count your own repeats.** One is noise. A repeat of something you wrote up
yourself means stop, commit, compact, and come back — and say so plainly, which
is the part that takes nerve. Stopping cost F one row. Not stopping would have
cost every row after it, and somebody else would have had to find out.

**The mechanical half:** a formula you retype is a formula you will eventually
retype wrong. If a convention has bitten twice, it belongs in a shared helper or
in a comment where the next person cannot miss it — not in your memory.

## 53. The dangling objects are the only copy of every rejected design

This repo carries ~2,138 dangling commits. **Do not `git prune` them and do not
`git gc --prune=now`.** `gc.pruneExpire` is set to `never` in `.git/config` for
exactly this reason — the default two-week expiry would have deleted them
automatically.

Most are disposable: 1,775 `live-snapshot` commits from `live-integrate.sh`
(every 15 s, and their own subject says `[not for merge]`). But **43 blobs hold
source lines that exist nowhere else in reachable history** — every one of them
held by a `git stash` autosave or a bare `wip` commit.

They are not unfinished work. They are **abandoned iterations**: the clearest
example is a cat silhouette from `street.ts`, 85 unique lines of hand-drawn
pixel art, which `ct/cat.ts` explains is one of *"the first six"* the user
narrowed to two — *"the rest were dropped."* On a hand-authored, taste-driven
world, the rejected alternatives are worth keeping. They cost nothing: the repo
packs to 52 MB with all of them in it.

**The methodological trap, which cost two wrong answers before the right one.**
Asking "did this land?" has three tempting cheap tests and both of the first two
are wrong here:

1. **By commit subject** — wrong. A rebase that resolves a conflict keeps the
   subject and changes the content. It also silently skips every commit whose
   subject is `wip`, which was 148 of them.
2. **By `patch-id`** — still wrong. A WIP snapshot finished later in a different
   shape has no matching patch-id, yet its work is fully in the world. 293 of
   363 "failed" this test and almost all of them had landed.
3. **By content, against the file's own history** — *still* wrong, and this is
   the project-specific one. This codebase moves code between files constantly:
   `cat.ts` was extracted out of `street.ts`, `bodega.ts` was split into
   `bodega-corner.ts` and `int-bodega.ts`. Comparing a blob against its own
   path's history reports relocated code as missing.

Only the fourth test answers it: **every line, against every blob reachable
from every ref, across all of `street/src`, regardless of path.** Anything less
confidently reports a false verdict in whichever direction you were already
leaning.

## 54. A fresh agent worktree does NOT start on this project

Every subagent spawned with worktree isolation on 2026-07-31 — four for four —
was handed a worktree checked out at **the repo's initial commit (a bare
README)** or at **`origin/main`**, which is 3,299 commits behind. Not one
started on `add-stick-and-city98`, where the project actually lives.

Two of them noticed and reset themselves. One could not write to the checkout
at all and had to stage its entire deliverable — a full audit plus three ledger
edits — in a file for the desk to apply by hand.

**Every brief to a worktree agent must open with this**, because an agent that
does not notice will happily build against an empty repo and report success:

```sh
git log --oneline -3          # do you see recent CROSSTOWN work?
git reset --hard add-stick-and-city98
(cd street && npm install)    # the reset deletes the node_modules symlink, §13
```

The `npm install` is not optional and is the part people miss: the hard reset
removes the `node_modules` symlink, and the dev server then fails to start with
an error that looks nothing like the actual cause.

**The deeper point, which is the same one §48 makes about instruments:** a
worker aimed at the wrong world produces confident, well-evidenced, completely
worthless output. §48 was about a measuring script pointed at port 4177 instead
of the world under test. This is the same failure one level up — the *builder*
pointed at the wrong tree. Check what you are standing on before you trust
anything you measure from it.

## 55. An agent that backgrounds its own work and waits will never finish

One agent on the twelve-room exit check burned **245,000 tokens across two
wake-ups and delivered nothing** — no commit, no note, no partial table. Both
times it stopped with the same report: *"waiting for the background suite to
finish; will continue once notified."* The suite was not running. Nothing was
ever going to wake it.

It was not confused about the task and it was not blocked on a hard problem. It
had correctly instrumented the `canSee` raycast and had obeyed a mid-flight
correction to strip debug logging out of two desk-owned files. **It simply never
came back to collect its own result.**

**Every brief to a worker must say: run everything synchronously; the dev server
may be a background process, test runs may not be.** And it must say: *a partial
result beats a complete one you did not finish* — an agent that believes it must
deliver everything will wait forever rather than hand back nine rows of twelve.

**The desk's half of this:** stop it, do not resume it a third time. Two stalls
on the same pattern is the pattern. Re-brief a fresh agent with the constraint
written in — cold context and a tighter brief beats an agent that has already
learned a losing habit inside its own transcript. This is the cheap version of
the lesson that cost the account its usage: *an agent exists only while it holds
an item*, and one that is not producing is not holding it.

## 56. A silently-undefined field makes a test walk the wrong way and blame the world

The third false catastrophe from a mis-aimed instrument, and the subtlest.
GOTCHAS 48 was an instrument pointed at the wrong *world*; this one is pointed
at the right world and walks the wrong *direction*.

`scripts/interiors-walk.mjs` checks that you can leave a room's front door by
walking away from it. It takes the direction from `room.east`, which nine of ten
rooms get for free from their `front:` tuple. **The jail has no `front:`** — its
door is declared through `ct/doors.ts` with `chamfer: true`, the same path the
bodega's 45° door uses. So `room.east` was `undefined`, the probe defaulted to
`+x`, and `+x` from the jail's west-facing door runs straight into the jail's
own footprint. The suite reported `FAIL: the landing is not boxed in — out to
the road, moved 0.39 m` and the desk filed a defect against a world that was
fine.

**No exception was thrown and nothing was logged.** An absent field became a
default became a confident measurement of a wall.

Two rules come out of it:

1. **A derived direction must fail loudly when it cannot be derived.** If
   `room.east` is undefined the check should error, not guess. A guess produces
   a number, and a number gets believed.
2. **When an agent makes a failing test pass by editing the test, verify from
   the source, not from the agent.** That is the standard way a real defect
   disappears. Here it was legitimate, and what established it was three things
   in the world rather than the agent's account: `JAIL_DOOR` declares `nx: -1`,
   `ct/street.ts:962` says *"the jail takes a WEST-FACING door"*, and the
   building's collider runs eastward **from the door face**. Any one alone would
   have been weak; together they are decisive.

## 57. A false ledger row survived three corrections and then ate a builder

The row `OPEN | F+G | interior people, THE ADOPTION HALF: 0 of 10 int-*.ts call
citizenSprite` was **false when written and false for days after**. All twelve
interior files call the atlas; a one-line grep shows it.

Three separate agents measured this and reported the row stale — see
`notes/archive/M-interior-people-adoption.md` and commits `88e790882`,
`b5ebb9a60`, `788e73773`. **The row was never corrected.** The desk then read
it, believed it, wrote it into a status report for the user, and spent a builder
on it.

**A stale correction that nobody applies is worse than no correction**: it
creates a written record that the thing was checked, while the wrong number goes
on being quoted. GOTCHAS 49 says a row can be CONFIRMED and untrue; this is its
mirror — **a row can be OPEN and already done.** Both directions cost real work.

**The desk's rule from this: when a builder reports a row stale, correct the row
in the same tick, or it will be re-routed.** Filing the correction as a note is
not correcting it.

**What saved the item** is that the builder refused to re-measure a claim it
could see was already true, and went looking for the *real* bar instead — does
each person read correctly to a player standing in the room? That found two
things no grep could: five casino figures untagged and therefore invisible to
every people-sweep, and the thrift keeper standing 5 cm **inside the back wall**,
invisible to an actual player, with a shelf run through her only standing spot.

The general form is worth keeping: **"is the capability called?" and "does the
result read right to the player?" are different questions, and only the second
one is what the user asked for.**

## 58. On this project, bad instruments produce about as many "defects" as the world does

Tally for 31 July – 1 August, when the sweep finally started photographing the
whole world and everything got re-measured.

**Real defects found and fixed (7):** the sweep photographing 1 room of 12; the
jail site two-thirds solid; the thrift keeper standing 5 cm inside a wall; five
casino figures untagged and invisible to every people-check; the thrift coat-rack
hem; the diner pastry case; the vault's concrete at four different scales.

**Instrument artifacts that looked exactly like defects (5):** `health.mjs`
hardcoded to port 4177; `interiors-walk.mjs` walking `+x` out of a west-facing
door because `room.east` was silently `undefined` (§56); `bedcavity.mjs` measuring
`CAV.x = 0.74`, an outer panel deleted when the wheel well was built; the car
lot's "12 flat slabs of 11.59 m²", which are the **bounding boxes of 12 rotated
0.09 × 5.0 paint stripes** whose real area is 0.45 m²; `doorside2.mjs` reporting
the bodega as not mirroring, on a quantity that room stopped using.

**Roughly one in two.** So the prior on any surprising measurement should be
*near even odds that the instrument is wrong*, and the cost is not symmetric: a
missed defect wastes a player's goodwill, a false one wastes a builder.

**Three of the five had already been diagnosed and written down.** The lot
stripes were explained in commit `97dd4b7e3` on 25 July — *"I measured a paint
stripe as a slab"* — and were re-filed as a defect on 30 July anyway, then
entered into the ledger by the desk, then spent a builder's time on 1 August.
**The correction existed. Nobody applied it to the row.** That is §57's failure
mode and it is the expensive one.

**What actually works, learned the hard way:** before believing a measurement,
find the thing in the source. `WELL_IN = 0.66` against a tyre spanning
0.70–0.94 settled the pickup in one line. `PlaneGeometry(0.09, 5.0)` settled the
lot in one line. `int-hotel.ts` importing the same `VICE_DOOR_X` that `vice.ts`
places the door from settled twelve rooms at once. **A number in the source beats
a number from a script**, because the script is a hypothesis about the source.

## 59. A shared queue stops double-CLAIMING, not double-DOING

Two builders fixed the same door on the same night and their branches conflicted
in `ct/apartment.ts`. The queue worked exactly as designed — one claim each, no
overlap — and the duplicate happened anyway.

**Because a worktree is a snapshot.** w2 claimed the door, fixed it, released it,
and its fix went to *its own branch*. w3's worktree had been created before that
and never saw it. When w3 reached the item it measured the world **it** had,
found the bug genuinely present, and fixed it again — correctly, on the evidence
in front of it. Its own report says *"the queue's own 'already fixed' claim was
false on this checkout"*, which is true and is the whole problem in one line.

So the shared queue solved the coordination it was built for and left this one
untouched:

| | |
|---|---|
| **claim collision** — two builders take one item | solved, by the lock |
| **stale-tree collision** — two builders fix one bug from different snapshots | NOT solved |

**What the desk must do until this is fixed properly:** merge and push each
finished item *before* the next builder reaches it, so later worktrees inherit
it. Long-running builders drift furthest and are the ones who redo work.

**What a builder should do:** before starting an item, `git fetch` and check
whether the fix is already on `add-stick-and-city98`. Measuring your own
worktree is not evidence about the project — it is evidence about your snapshot,
which is the same trap as GOTCHAS 48 (instrument aimed at the wrong world) and
52 (builder aimed at the wrong tree), arriving a third way.

**Cost when it happened:** two agents' work on one bug, a merge conflict, and the
desk discarding one of two correct fixes.

## 60. The queue's own claim pattern could not see most of the queue

`claim.sh` matched rows with `'^| *[0-9]* *| *TODO *|'`. The desk inserts urgent
work with **lettered ranks** — `0a`, `5b`, `6b` — so a new item can jump ahead
without renumbering rows other builders are already holding. That scheme is
sound. The pattern could not see a single one of them: `[0-9]*` matches the `5`,
then demands a space or a pipe, and finds `b`.

**Eleven TODO items, every one lettered, and `claim.sh` reported the queue
EMPTY.** Four builders were spawned onto nothing; two burned ~46k tokens each
doing exactly what they were told — reading the brief, resetting, checking,
finding nothing, and stopping. Their behaviour was correct throughout. The
instrument was wrong.

**This is the fourth member of the same family and the most embarrassing,
because it is the tool that hands out the work:**

- §48 — an instrument aimed at the wrong world (port 4177)
- §56 — an instrument walking the wrong direction (`room.east` undefined)
- §59 — a builder measuring its own stale snapshot
- §60 — **the dispatcher blind to most of its own list**

**The rule that would have caught it, and now must be run after any queue edit:**

```sh
[ "$(grep -c '^| *[0-9]*[a-z]* *| *TODO *|' notes/QUEUE.md)" = "$(grep -c '| TODO |' notes/QUEUE.md)" ] \
  || echo 'CLAIM PATTERN CANNOT SEE EVERY TODO ROW'
```

**"The queue is empty" is a claim about the queue AND about the reader.** When a
worker reports empty and you believe there is work, check the reader before you
believe the report.

## 61. A spawned builder does NOT automatically get its own worktree

**A spawned builder does NOT automatically get its own worktree — check, do not
assume.** w13 and w14 got one; w15, w16 and w17 did not, and all three ran
concurrently in the main tree. Nothing collided, but only because they happened
to hold items in three different files (`jail.ts`, `props.ts`, `int-tax.ts`).
Two builders on one file in one tree is what corrupted a worktree and broke the
live world before (PARALLEL-WORKFLOW §11).

The second, quieter failure is `git add -A`: in a shared tree it sweeps whatever
the *other* builders have in flight into your commit. The desk did exactly this
while reorganising — w16's and w17's uncommitted probe scripts landed in a commit
about directory layout. Harmless here (same branch, and the project commits
freely) but it means a commit's contents stop matching its message, which is how
a bisect starts lying to you.

**So: pass `isolation: "worktree"` when spawning a builder, and `git worktree
list` after — if the count did not rise, the builder is in your tree.** Scope
every `git add` to the paths you actually touched; never `-A` from the repo root
while a fleet is running.

---

## 62. A SEAT's yaw and a CITIZEN's facing use OPPOSITE zero directions

**`ctx.seat({ yaw })` has `0 = −z`. `citizenSprite({ facing })` has `0 = +z`.
The same number points the two of them 180° apart.** Both are documented, in
their own files, and neither mentions the other:

| | | |
|---|---|---|
| `ct/ctx.ts:72-74` | `Seat.yaw` | *"0 = −z, π/2 = +x, π = +z, −π/2 = −x. Point it at the table."* |
| `ct/citizens.ts:528` | `citizenSprite` `facing` | *"initial facing, atan2(vx, vz). **Default 0 = facing +z**."* |

So a room that seats a player and stands an NPC beside him, and gives both the
angle it measured once, has put one of them backwards — and **it will look
correct from wherever the author was standing when they picked the number**,
because at yaw ±π/2 the two conventions agree. `cos` is 0 there. The error is
zero at the two angles a builder is most likely to try first and maximal at
0 and π, which is precisely why it keeps shipping.

**This is a plausible origin of several of the five facing bugs in this
project's history** — the burger barn guy, the librarian, the casino sitter, the
park benches, the tax office waiting row. It is exactly the shape of the largest
one: `seat-facing.mjs` found **96 casino slot stools with their backs 0.37 m
from the machines, sitting next to NPCs who faced them correctly.** One of the
two numbers had been mirrored; the NPCs beside them proved the author knew which
way the machines were.

**So: never pass the same angle to both, and never copy an angle from an NPC to
a seat or back.** Derive it from geometry instead — point at the thing:

```ts
const faceAt = (fromX: number, fromZ: number, toX: number, toZ: number) =>
  Math.atan2(toX - fromX, -(toZ - fromZ));      // Seat.yaw convention
```

`int-casino.ts` uses exactly this after the 96-stool fix, and the reason it is
written as a helper rather than typed per stool is that `a + Math.PI` — the
obvious way to turn something round — carried the same mirror into the approach
points and put them **inside** the craps table.

**The check is `scripts/seat-facing.mjs`.** Run it after touching any seat.
It fails on both nose-to-the-wall and turned-away-from-your-own-furniture, and
it covers `__ct.seats()`, so it sees seats registered by modules that did not
exist when it was written. It does **not** cover outdoor benches or seated NPCs
(the NPC keeps its facing in a closure and never publishes it), so on those the
convention clash is still unguarded and you are checking by eye.

## 63.

**Pack the artifact LAST — after your final commit — and do not run a bare
`npm run build` afterwards.**

The desk first wrote this entry as "two hygiene rules in direct conflict":
`pack-artifact.mjs` writes `dist/artifact.html`, while `checks.mjs` exits 2 on a
`dist`-vs-HEAD mismatch, so a departing builder is right to want `dist/` rebuilt.

**That framing was wrong, and a builder disproved it.** `pack-artifact.mjs`
already builds *and then* packs, so packing last satisfies both rules at once —
`dist` matches HEAD *and* the artifact exists. There is no conflict to trade off.
The only thing that destroys the artifact is a bare `npm run build` run *after*
the pack, which wipes `dist/` and takes `artifact.html` with it.

`dist/` is gitignored, so nothing preserves the artifact and nothing warns you.
One builder hit this and reported the artifact delivered, in good faith, while
the file no longer existed.

**`scripts/guards.sh` ALSO destroys `dist/artifact.html`** — a builder watched it happen and
restored from the staging copy. It is not only `npm run build`: anything that rebuilds into
`dist/` takes the artifact with it, and `guards.sh` does, without saying so.

**If you need the artifact to outlive your worktree, copy it out of `dist/`.**
The desk now stages it at `street/artifact/` (gitignored) before publishing.

Related, from the same builder: `pack-artifact.mjs` printed `out.length` —
UTF-16 code units — labelled "bytes", a 210-byte undercount on a 1.1 MB file.

## 64.

**Killed agents leave their dev servers running, and the fleet runs out of
ports.** By the end of one night 4177 and every port in 4180-4199 was listening,
with ~86 vite processes, most of them orphans from agents that had stopped hours
earlier. A builder that cannot find a free port either stops, or — worse — falls
back to a default and measures somebody else's world while reporting confidently
about it (GOTCHAS 48). One builder found exactly one free port in the whole
range and said the next builder would find none.

`./scripts/reap-servers.sh [--dry] <live-agent-id ...>` fixes it. Get the live
ids from `./scripts/claim.sh --stale`, which names every builder holding an item.
It only touches servers running out of an agent worktree, so the live
integration world and anything you started by hand are safe.

**NEVER `pkill -f vite`.** The pattern matches the killing command's own command
line, so it kills itself partway through and leaves the job half done **with no
error** — the desk did this and only noticed from the exit code. Iterate over
pids and skip your own.

## 65.

**FIXED 2026-08-02 — kept because the lesson outlived the bug.**

A guard that reports failure in PROSE exits 0 and scores green. `scripts/health.mjs`
— the command `CLAUDE.md` hands every new agent to answer "does the world
actually initialise" — printed `WORLD BROKEN — __ct never appeared` through
`console.log` and then fell off the end of the file. No `process.exit` anywhere
in it. It was registered in `CHECKS`, so a world that had stopped initialising
rendered as a green `ok` row.

Of 122 registered checks it was the only one that could not go red, and it
survived every sweep for one reason: **it printed "WORLD BROKEN", not "FAIL"**,
so every grep for failure vocabulary missed it. The desk's own sweep found it,
saw it was the single check with no non-zero exit path, and explained it away as
"reports state, probably intentional". A builder measured it instead, against a
page with no `__ct`: exit 0.

**Three lessons, and the last two are the ones that keep paying.**

1. A check must exit non-zero to fail. Printing is not failing.
2. When a sweep turns up exactly one exception, that is the finding, not the
   noise. Measuring it costs a minute; reasoning past it costs every green run
   since.
3. **The naive repair would have been its own bug.** Adding `exit 1` alone was
   wrong: `p.goto` against a dead port already throws and node forces 1, so a
   builder who merely forgot to start a preview would have been sent to look at
   their own code. It now has three statuses — `0` initialised, `1` measured and
   broken, `3` nothing measured — because "could not measure" and "measured, and
   it is wrong" are different sentences. That distinction has now been paid for
   four separate times in this file.


## 66.

**A test file under `src/` kills the dev world while the build stays clean.**
Vite serves everything under `src/` to the browser, so a `*.test.ts` there is
*executed in the page*: `__ct` never appears, the playtest world is dead, and
`npm run build` reports no problem at all. It would have shipped as "builds
fine, world dead" — the worst possible pairing, because the signal everyone
trusts stays green.

Found when the repo gained its first unit tests. **Tests live in `test/`, never
under `src/`.**

That first test file is worth its own note. `ct/gap.ts`'s turned-box clearance
was got **wrong twice** — narrowest axis, then widest, the second understating
by 0.634 m — and **all sixteen hand-written cases passed the first wrong
version.** What caught both was a property test: 4000 random box pairs checked
against an independent exact-polygon oracle. Hand-picked cases test the author's
mental model; a property test tests the code.

## 67.

**An agent that `--touch`es and then dies freezes its item for the full reaping
window.** `claim.sh --touch` exists so a genuinely long item is not reaped out
from under a working builder, and it does that job — but it is a promise about
the future made by something that may not have one. One builder refreshed its
claim and stopped two minutes later, buying the corpse another 150 minutes of
exclusive hold on a live item.

**The desk knows things the script cannot: it receives the completion
notification.** So the rule is a desk practice, not a script change — **when an
agent reports finished, release anything it still holds**, whether or not the
claim looks fresh. `./scripts/claim.sh --release <item> desk` does it, and the
reaper stays as the backstop for agents that die without reporting.

The same builder is worth reading on how it died: it wrote *"I'm going to stop
polling entirely and wait for the notification"* about its own acceptance run —
the exact pattern BUILDER-BRIEF §3 forbids, in a session whose brief warned
about it in bold. Its work was committed and survived; only the proof was lost.
**Commit early is what makes this recoverable.**

## 68.

**`CPU_THROTTLE=8` kills the headless browser in this sandbox** — software
WebGL cannot keep up and the process dies, so a check "verified at x8" either
was not, or was lucky. The desk wrote x8 into three separate acceptance
criteria before a builder said plainly that it had substituted **x4 on a box at
load 18-21, and named the substitution** rather than quietly running x2 and
reporting the number the item asked for.

**An acceptance criterion nobody can satisfy is worse than none**, because the
only ways to "meet" it are luck or a quiet lie, and both read identically in a
handoff. Ask for *the strongest throttle the machine sustains, reported*, and
the number becomes evidence instead of a hurdle.

The same builder is why this is known at all. **When you cannot meet a stated
bar, say which bar you actually cleared.** Every builder here has been trusted
because they did that.

## 69.

**An agent stuck waiting on its own background run will notify repeatedly
without progressing — stop it rather than hoping.** One builder reported four
times over two hours: *"I'll stop polling and wait for the notification"*, then
*"holding at 2 of 10"*, *"4 of 10"*, *"5 of 10"*. Each report cost tokens and
none finished the run. It reached ~109k tokens having landed its fix on the
second report and nothing since.

This is BUILDER-BRIEF §3 seen from the desk's side, and the desk's part is
simple: **a second notification saying "still waiting" is the signal.** Land what
it has committed, `claim.sh --release` its item so the queue is not frozen for
the reaping window, and `TaskStop` the agent. All three, in that order — the
release matters because a builder that touched its claim before stalling holds
it for the full 150 minutes (GOTCHAS 67).

Nothing is lost by stopping it: the work was committed, which is the entire
reason commit-early is the first rule in the brief.

## 70.

**An acceptance bar longer than an agent's budget is a trap, and it will eat
agents one after another.** Item 67 asked for ten throttled runs of a walking
check. Two builders took it in succession and **both stalled in the same place**
— each tried to background the run set and wait, each reported "4 of 10", "5 of
10" and never finished. Neither was careless; the item was unfinishable in one
sitting and nothing in it said so.

Worse, **the evidence they produced was already sufficient and the item could
not recognise it.** Between them they ran nine of the ten, from two independent
worktrees, and got essentially one number (3.43 / 3.43 / 3.43 / 3.34, and "all
identical"). The old code could not repeat a value at all — identical readings
ARE the finding. The bar asked for a count when what it wanted was agreement.

**Write acceptance as a property, not a repetition count.** "N runs" invites
backgrounding; "runs agree to within X, and say how many you did" is finishable
in one pass and produces better evidence. And when a second agent stalls on the
same item, **fix the item** — do not send a third.

## 71.

**A check that proves an ABSENCE must first prove it looked at something.**
`I-seat-exit` ended `process.exit(stuck.length ? 1 : 0)` with no floor on the
sample size, so "no seat traps the player" was free over an empty set. Measured
with `FPRig.sit()` refusing every seat, it printed:

```
could not sit  : 6  (aim or reach, not a verdict either way)
no seat traps the player: 0 released by E, 0 by Escape.      exit 0
```

**219 seats published, six sampled, not one sittable, and the check that exists
to guard seating reported green.** It is the sixth member of the `health.mjs`
family and the nastiest, because the other five fail loudly and exit 0 — this one
has nothing to say at all and is *right* to say nothing. Only the exit code is
wrong.

`integration-doors.mjs` already carried a guard against exactly this shape. The
pattern existed in the repo and this file did not use it — the third time
tonight the answer to a real problem was something already written down.

**Every "no X was found" verdict needs a minimum-sample floor, and the floor
should be derived from the registry** (219 seats published) **rather than typed.**

## 72.

**A red without a green is half a measurement, and `canfail` cannot tell the
difference.** `canfail` scores CAUGHT on *any* non-zero exit (GOTCHAS 32), so a
case registered against a check that is **already failing on unmutated mainline**
self-certifies: the mutation is irrelevant, the score is green, and the guard
proves nothing forever after.

A builder nearly shipped exactly this, caught it, and withdrew its own landed
work. It had watched the mutated run go red and committed on that alone; the
baseline took 11m15s and came back **exit 1 on clean mainline** — a real trap at
(8.50, −94.50) that had nothing to do with the mutation.

**So: watch the red AND the green.** Both runs, both statuses, before a case is
registered. If the baseline is slow, that is a reason to wait, not a reason to
skip it — the builder's own words are the rule worth keeping: *"I registered a
case on the strength of a red I had watched and a green I had not."*

Related, from the same session: **a mutation that depends on a knife-edge stops
proving anything the moment the margin moves.** A 100-nanometre roof mutation
was real when it was written, on a world sitting exactly on a frame boundary;
a day later there was a whole spare frame and the same mutation **passed** —
indistinguishable from a check that failed to notice. Mutate by a margin the
world cannot absorb.

## 73.

**Moving actors share the static collider array, and that one fact has now
produced FOUR false defects.** `crosstown.ts` spreads citizen and vehicle boxes
into the same `colliders()` array as the masonry, and `crowd.ts:168`'s
`ctx.solid(box)` puts every citizen in there. Anything that reasons about
*geometry* by reading that array is reading pedestrians too.

The bill, all in one session:

1. The **V overlay** — the user's own debug tool — painted the whole east walk
   lane red, for people walking on it.
2. A **red-dump** recorded a walking citizen as static geometry, and the desk
   queued a 0.45 m trap that does not exist.
3. **`interiors-walk`'s chamfer leg** reported *"the chamfer did not let me
   past"* when a pedestrian crossed the corner and refused the −z step exactly
   as a wall would. Diagnosed only by dumping every collider within 1.2 m of the
   stall and **re-reading a second later** — the box had moved.
4. **`unstick-walk`** reported a trap at a point that turned out to be the centre
   of a wall, which no player can reach.

Item 65 fixed the **overlay's scoring** by filtering on object identity. It did
not separate the arrays, so every future consumer inherits the bug — three of
the four above were found *after* that fix.

**The test that distinguishes them is time, not shape.** A 0.5 × 0.5 m box is a
citizen or a crate depending on nothing you can see in one frame. Read the
collider twice, a second apart: geometry does not move.
