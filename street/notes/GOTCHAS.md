# Landmines in this codebase

Things that have cost real time. Read before your first change; most are not
discoverable from the code alone.

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
