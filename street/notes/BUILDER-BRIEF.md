# Standing brief — read this once, then take work from the queue

> ## ⚡ SMALL CHANGES: BATCH THEM, BUILD ONCE, SKIP THIS FILE.
>
> **The user's rule: five small changes is fifteen minutes, not five hours.** If
> your item is a batch of small ones — a colour, a size, a position, a label —
> read the GOTCHAS index only, make all the edits, build **once**, one commit
> each, look at it, `tsc`, hand back. No probes, no notes, no harness. Collision,
> floors, seats and the sidewalk lane are never small; those read the rest.

You are a builder on **CROSSTOWN '97**, a hand-authored Three.js/TypeScript 3D
city street set in 1997. The repo root contains `street/`. Work only inside it.

**This file is every rule that used to be copy-pasted into each individual
brief.** A task in `notes/QUEUE.md` says only *what* to do; this says *how*.
Read it once at the start of your session and you never need it again.

---

## 0. Before anything: are you even on this project?

**Thirteen agents out of thirteen have been handed a worktree checked out at the
repo's initial commit, or at `origin/main` — 3,299 commits behind.** An agent
that misses this builds confidently against an empty repo and reports success.

```sh
git log --oneline -3                      # do you see recent CROSSTOWN work?
git reset --hard add-stick-and-city98     # if not
(cd street && npm install)                # the reset deletes the node_modules symlink — NOT optional
```

That `npm install` is the part people skip; the hard reset removes the
`node_modules` symlink and the dev server then fails with an error that looks
nothing like the cause. (GOTCHAS 54, 13.)

### …and there is a GUARD now, so expect to be refused rather than to be lucky

The manual check above is the *first* line, not the only one. **`npm install`,
`npm run build`, `npm run dev`, `npm run live` and even a bare `npx vite` refuse
to run if you are standing in the SHARED CHECKOUT
(`/home/erick/projects/rpg/street`) having travelled there out of your own
worktree.** It prints the worktree it wants you to go back to. Do that; do not
argue with it.

```
  REFUSED: npm run build in THE SHARED CHECKOUT.
  ...
  FIX: go back to YOUR OWN worktree and run it there.
      cd /home/erick/projects/rpg/.claude/worktrees/agent-<your-id>/street
```

`scripts/guard-shared-checkout.mjs` fronts `scripts/lib/shared-checkout.mjs`;
`scripts/probes/w94-guard-selftest.mjs` is its 30-assertion self-test. Read the
lib's header before you touch it — in particular, **do not "improve" it back
into an environment-variable test.** The desk's shell and yours carry byte-
identical `CLAUDE_CODE_CHILD_SESSION`, `AI_AGENT` and `CLAUDE_PID`; they are the
same process. That mistake is queue item 247 and it blocked the desk's artifact
republish for a session.

**Two things it deliberately does not do.** It never touches the read-only
measurement scripts (`sweep`, `fp`, `checks`, `capture`) — their problem is
reading the wrong world, which has its own instrument. And it **cannot see an
agent that was never given a worktree at all**; that agent has no worktree to
have come from and looks exactly like the desk. If you were spawned without
isolation, the guard will not save you and §0's manual check is all you have.

**It still does not replace the check above.** It hooks four `package.json`
scripts plus `vite.config.ts`. **Any bare `node scripts/*.mjs` still goes round
it.** Run `git log --oneline -3` first anyway.

**It fails open on every uncertain answer**, because it sits on `preinstall` and
a bug there would brick the most-run command on the project.

`CT_ALLOW_SHARED=1` opts out. It is not a normal thing for a builder to want —
if you use it, say so in your `done.sh` line. **It is no longer the desk's
routine escape hatch:** until item 247 the guard refused the desk too, because
the desk and every builder share **one `CLAUDE_CODE_SESSION_ID` and one
environment** (worker ninetythree measured **50 of 50** agent processes carrying
`CLAUDE_CODE_CHILD_SESSION=1`, the desk's own tool shells included). The guard no
longer asks *who you are* — it asks *where your shell was standing*, which is the
one thing that does differ.

---

## 1. The loop: take one item, finish it, take the next

1. `./scripts/claim.sh <your-name>` — claims the top unclaimed item **atomically**
   and prints it. Two builders cannot get the same one.
2. Do it. **Commit as you go.**
3. `./scripts/done.sh <your-name> "<one line on what you did>"` — releases the
   claim and marks it for the desk to verify.
4. Repeat. When `claim.sh` says the queue is empty, say so and stop.

**BEFORE EACH CLAIM, PULL MAINLINE IN — YOUR WORKTREE IS A SNAPSHOT.**

```sh
git stash list >/dev/null; git merge --no-edit add-stick-and-city98   # tree must be clean first
```

Your worktree was cut when you started and **does not move**. Other builders
land work the whole time you are running, and by your third item mainline can be
hours ahead of what you are standing in.

This is not hypothetical. One builder reported two items **BLOCKED** because
"`fp.ts:9` defines `AABB` as `{minX, maxX, minZ, maxZ}` — colliders have no
height, so there is nothing to stand on." It proved it properly, by standing on
six cars rather than by grepping, and it was **right about its own checkout and
wrong about the world**: collider height had landed hours earlier. It refused to
run the 20+ "clean" roof-exit runs the item asked for, on the grounds they would
have passed by measuring nothing — which was exactly the right instinct, spent
on a problem that did not exist.

Do it **between** items, with a clean tree — never mid-item.

**If your item runs long, run `./scripts/claim.sh --touch <your-name>` after each
commit.** Claiming now reaps any item held for 150 minutes without a touch —
twice today an item froze because the agent holding it had died, for 85 and 136
minutes, and nobody noticed. The reaper cannot tell your slow item from a corpse;
`--touch` is how you tell it. One line after a commit, and your claim is safe.

**You do not wait to be told what to do next, and you do not pick items out of
order** — the queue is ranked, and the ranking is the desk's judgement about
what the user cares about.

---

## 2. Commit early, commit often

**Five agents have been killed mid-flight by API session limits. Only the ones
that had committed kept their work.** One burned 245,000 tokens across two
wake-ups and delivered nothing.

An uncommitted result is a lost result. The repo commits freely — do not ask.

---

## 3. Run everything synchronously

**The dev server may be a background process. Your test runs may not be.**

An agent that launches a suite and waits to be woken will never come back — this
has happened twice, at ~250k tokens each. If a run is slow, make it smaller, not
asynchronous. (GOTCHAS 55.)

---

## 4. Aim your instruments at YOUR world

Instruments default to port **4177**, where somebody else's server is usually
running. **Always pass `SHOT_URL=http://localhost:<your port>/`.**

**A PORT THE DESK ASSIGNED YOU IS A SUGGESTION, NOT A FACT — PROVE IT IS FREE.**
Three builders in a row were handed a port already serving another builder's
world. It answers HTTP 200, so nothing looks wrong: you measure someone else's
street and report confidently about it. One builder lost 20 minutes to this
tonight, and it is the same failure as GOTCHAS 48 wearing a different hat.

**USE `ss -ltn`. `curl` IS NOT A FREE-PORT TEST AND NEVER WAS.**

```sh
ss -ltn | grep ":<port> " && echo TAKEN || echo free
```

```sh
ss -ltn | awk '{print $4}' | grep -oE '[0-9]+$' | sort -un   # everything taken
```

A hit means **take a different port** — any free one in 4180–4199 — and **say
which one you used** in your handoff. The desk has been assigning these blind
and cannot tell from here.

**Why the old `curl … %{http_code}` recipe was wrong, demonstrated rather than
asserted.** It read `000` as free. But `000` only means *nothing spoke HTTP to
me*, and a socket can be **bound and listening** without doing that — a vite
server still starting up, a process holding the port for its own reasons. Bind
a bare TCP listener on 4239 that never answers, and the two tools disagree
outright:

```
ss  : LISTEN 0  511  127.0.0.1:4239  0.0.0.0:*
curl: 000                                        ← "free", said the old recipe
```

That is precisely how worker sixtyone lost port 4183: `curl` said `000`, and
`--strictPort` then refused to bind, partway into a run. `ss -ltn` reads the
kernel's listen table, so it sees a bound socket whether or not anything is
answering on it. (GOTCHAS 81.)

**It is still a race, and no tool fixes that** — a port free when you look can be
taken before you bind. So bind with **`--strictPort`** and let it fail loudly,
rather than letting vite silently walk to the next port and hand you a world at
an address you are not measuring.

> An instrument aimed at the wrong world reports a catastrophe it cannot see —
> or a clean bill of health it did not earn. (GOTCHAS 48.)

---

## 5. Interactions need a HELD keypress

```js
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
```

`p.keyboard.press('e')` can begin and end inside a single animation frame, and
the `[E]` dispatch is an edge read **once per rendered frame** — so the tap is
never observed. This made a fully working feature report three false failures.

---

## 6. Check whether the work is already done

**A queue item is a hypothesis, not a finding.** Measure the current world before
you change it. If the item is already satisfied, **say so and mark it done** —
that is a success, not a failure.

A row once claimed *"0 of 10 files call citizenSprite"*; all twelve did, three
builders had already reported it stale, and it cost a fourth builder anyway.
(GOTCHAS 57.)

### 6a. THE USER'S QUOTE OUTRANKS THE DESK'S DIAGNOSIS

Measured across the 35 items of 1 August: **the desk's stated cause was wrong on
6 of them, and the builder caught it 6 times out of 6.** The desk reads a
screenshot; you are standing in the world with instruments. On this particular
step you are simply better than it is.

So when the item's diagnosis and the user's quoted words disagree, **the words
win** and you say so in your `done.sh` line. That is exactly how the three
recoveries happened:

- *"this door is making it a little too cramped"* → filed against the door leaf.
  Entrance leaves carry **no collider at all** and cannot trap anyone; the real
  cause was a newspaper stand centred in a 0.75 m strip.
- *"seats in the tax office are reversed"* → filed as a yaw. `yaw:0` already
  faced correctly into the room; the backrest mesh was on the wrong side.
- *"get rid of the overlay descriptions"* → filed against `ct/hud.ts`, which does
  not build that text. It lives in `main.ts` and `index.html`.

**Reporting "the stated cause is wrong, here is the real one" is the single most
valuable thing a builder does here.** It is never a failure to hand back.

---

## 7. Half of all "defects" here are the instrument, not the world

Measured over 31 July – 1 Aug: **7 real defects, 6 instrument artifacts.**

So when a measurement surprises you, **find the number in the source before you
believe it**. A script is a hypothesis about the source; the source is the answer.

- `WELL_IN = 0.66` against a tyre spanning 0.70–0.94 settled a week-old argument in one line.
- `PlaneGeometry(0.09, 5.0)` killed a false "12 flat slabs" finding in one line.
- `int-hotel.ts` importing the same constant `vice.ts` places the door from settled twelve rooms at once.

**Never fix a failing check by loosening it until it passes.** A check that
cannot fail is worse than one that is wrong, and this project has a documented
family of guards that "slept". If the check is right and the world is wrong, say
so and queue the world fix. (GOTCHAS 58.)

---

## 7a. Your one-shot probe goes in `scripts/probes/`

`scripts/` reached **797 files**, of which about thirty were ever run twice. The
rest were one-shot measurements — every agent writes two or three — and the cost
is that nobody can find the real instruments any more.

So: **a script you wrote to answer one question once goes in
`scripts/probes/`**, named for the question. It graduates to `scripts/` only when
something *calls* it: a `package.json` entry, a shell wrapper, another script's
import, or a standing instruction in `notes/`.

Committing it is still right — the note that cites it is worth much less without
it. Just put it where it belongs.

---

## 8. Derive, never retype

A second hand-typed copy of a number is the single most expensive habit in this
codebase. It is how `bedcavity.mjs` spent a week measuring a truck that no longer
existed, and how `doorside2.mjs` failed a door that was fine.

**If you need a value another module owns, import it.** If you cannot import it
without editing a file you do not own, **copy it with a line-number citation and
queue a follow-up to hoist a shared export.** Do not silently duplicate.

---

## 9. Ownership — CLAIMING AN ITEM MAKES ITS FILES YOURS

**Read this carefully; the first worker to use this queue got it wrong and
released every item as "not mine".**

`notes/OWNERSHIP.md` names historical owners — `C`, `F`, `J` and so on. **You are
not competing with them. They are not running.** Those letters record which agent
last held a file, not a permission list you must match your name to.

**The queue is the authority now.** Every item names the file(s) it touches.
**Claiming the item grants you those files for as long as you hold it** — that is
exactly what the claim is for, and why the lock matters.

So:

- **The item names a file → it is yours. Do the work.**
- **You discover you also need a file the item does NOT name → stop, and report
  it in your `done.sh` line.** That is the real boundary, and reporting it is a
  success.
- **Another builder holds an item naming the same file → skip it, take the next.**

Editing a file *outside your claimed item* is what broke the live world and
corrupted a third worktree — not editing a file whose historical owner was a
different letter. A queued one-liner costs a minute; a cross-builder conflict
costs ten plus a broken world. (PARALLEL-WORKFLOW §11.)

---

## 10. How to prove it

- **Movement, collision, floors and seats: WALK them.** A screenshot cannot prove you are not wedged.
- **THE `fp` TEXTURE HASH CANNOT SURVIVE ADDING OR REMOVING A MESH — it is a PURE-REFACTOR tool only.**
  `scripts/scenedump.mjs:26` seeds `Math.random` globally so dithering is reproducible, and three's
  `generateUUID()` draws four random values per object, geometry and material. So **six new meshes shift
  the stream and repaint every dithered texture built after them** — one builder saw `294/1461 textures
  differing` on a change that moved nothing. `fpdiff`'s counts are positional too, so inserting a mesh
  inflates them. **If your change adds or removes geometry, `fp`/`fpdiff` will report a catastrophe that
  is not there.** Compare `places` as a multiset instead (`scripts/probes/w44-placediff.mjs` does this),
  or diff only what you did not touch. Use `fp` as proof ONLY when you changed no geometry at all.
- **Screenshots are for LOOKING, never for PROVING a change didn't move the world.** Two runs of identical code differ ~20% of pixels. Use `npm run fp before` → change → `npm run fp after` → `npm run fpdiff`; textures and structure must match, 4–6 pigeons drifting is the noise floor — **and the real figure is now measured: dumping the SAME build twice differs on 5 of 8,612 entries, and they are PUDDLE PLANES drifting 1–3 cm, not pigeons. So the floor is 5.** Assert on the geometry-signature multiset rather than on a `places` hash, which will never reproduce (worker onehundredtwo, 2026-08-03)..
- **Press `V` for the collision overlay.** Wireframe boxes, red where a gap under 0.95 m could trap a player. It is how the user found two real bugs on its first day.
- **Verify on the BUILT bundle** (`npx vite preview`), not only on dev. The panel/keydown class of bug has shipped differently than it renders in dev.
- **THERE IS NO LONGER AN EXEMPTION. `scripts/interiors-walk.mjs` runs on the
  built bundle** as of item 251 — it was the one check that could not, and the
  contradiction of a rule enforced by a suite that broke it is gone. It read its
  declarations out of the TypeScript sources at runtime (four sites,
  `import('/src/proto/ct/doors.ts')` ×3 and `.../ct/interior.ts` ×1), which
  `vite preview` 404s. Three of those were already redundant against
  `__ct.doors()` — `doorStandFor`/`doorPointFor` agree **12/12 and 12/12**,
  `roomWidthFor` fed an `r.W` **read nowhere**, and `declaredDoors().at` fed a
  fallback that **never fires because 13/13 rooms publish their own `door`**.
  The only real gap was `PARTY`, now published as **`__ct.party()`** — a
  per-element copy, because a probe must not be able to mutate world state
  through a test hook. **If it ever aborts with exit 3 it means a hook is
  missing, not that the rooms are broken** (GOTCHAS 32).
- **A build against the tree your preview is serving blinds it for about a fifth
  of a second. It does NOT kill it.** `vite build` empties `dist/` before writing
  and `vite preview` serves `dist/` statically, so the healthy server has no page
  to hand back for that window — measured on this tree at **1175 of 6935 polls
  returning 404, 0.67 s–0.89 s into the build, with zero refused connections**
  (`scripts/probes/w67-does-build-kill-preview.mjs`). Any check that reaches for
  the world in that window fails through no fault of yours. `npm run checks` now
  tells the three cases apart and says which one you are in — `BUILD RACE` (it
  healed, re-run that one check), `dist/ EMPTY` (the build is still going or it
  failed; re-run `npm run build`), `SERVER DIED` (the port really is refusing
  connections). **Do not start a second preview on that port; the first one is
  alive.** If you were running builds and checks against one tree at the same
  time, the red is the race, not your change.
- Finish with `node scripts/bugsweep.mjs` — **zero STATION MISS**, no new console errors. It covers all 12 rooms and 3 sites.
- **The 2 m sidewalk lane is sacred.** Indoors too: a person should be able to walk past a shelf without brushing it.

---

## 10a. CHEAP CHECKS YES, FLAKY CHECKS NO — AND THE USER REVIEWS ANYWAY

**The user's instruction, 2026-08-03:** *"in general i think we should keep tests
that are cheap but stay away from tests that are failure prone. i will be
reviewing anyway yknow?"*

**And the budget, from the same conversation:** *"in general tests should not
take longer than the work to code itself."*

**THAT IS A HARD BUDGET AND IT IS THE FIRST THING TO CHECK.** Before you build
the instrument, ask what the fix itself costs. If the fix is a one-line constant
and the proof is a forty-minute harness, **you have the item upside down** — and
that is not hypothetical here: item 291's fix is expected to be a single number
in `apartment.ts`, and the desk wrote it a "done when" demanding five browser
walks across three distances. That is the desk getting it wrong, not the builder.

If proving it honestly would cost more than building it, do the cheap version of
the proof, say plainly in your handoff what you did and did not cover, and move
on. **Do not spend an hour of the fleet's budget insuring a five-minute change.**
If you think an item genuinely warrants more proof than code, say so and hand it
back — that is a ranking decision, and ranking is the desk's job, not yours.

**This does not lower the bar on proving your work. It changes what you LEAVE
BEHIND after you have proved it.** Those are two different acts and this project
has been conflating them:

- **VERIFYING** is what you do during your item: walk it, press `V`, drive the
  built bundle, run it five times. §10 above stands unchanged. Movement,
  collision, floors and seats still get WALKED — a screenshot still cannot prove
  you are not wedged.
- **ENSHRINING** is committing that verification as a standing check everyone
  pays for forever. **That is now a decision you have to justify, not a reflex.**

**The test to apply before you commit a check: if this goes red six weeks from
now, will it be because the world broke — or because the world is a world?**

Cheap and deterministic, so keep them: reading numbers out of `__ct`; counting
colliders, spots, rooms, materials; asserting a geometry-signature multiset;
type-level checks; anything that answers in milliseconds off a built bundle
without a camera or a clock.

Failure-prone, so do NOT enshrine them — verify with them, report the number,
and let the check you commit be the cheap consequence:

- **Anything timed.** A game day is 24 real minutes; crowds, traffic and lights
  all move. A check that samples a moving world at a wall-clock instant is a
  coin toss with extra steps.
- **Anything that needs N runs to mean something.** If it needs five runs it is
  a measurement, not a check. Take the measurement, write the number in your
  handoff, commit an assertion on the *stable* thing you learned.
- **Anything pixel-derived.** Already banned by §10 and this is why.
- **Long browser walks kept purely as regression insurance.** `interiors-walk`
  and `bugsweep` earn their keep and stay. A new twenty-minute suite leg does
  not automatically.

**Why this is not a licence to skip proof: the user reviews.** He plays the
build at localhost:5177 and he finds things — the `V` overlay caught two real
bugs on its first day *in his hands*. He is the backstop, and he is a good one.
What he cannot do is tell a flaky red from a real one at 3 a.m. in a suite he
did not write. **A check that cries wolf is worse than no check**, because it
trains five builders and a desk to scroll past red — and this board has already
lost items to exactly that: `w72` sat red on a rule that had been superseded,
and item 287 spent a whole item declaring four standing reds nobody trusted.

**So: one cheap assertion that fails only when the thing actually breaks beats
five expensive ones that fail on Tuesdays.** And when you genuinely cannot make
a cheap check for something important — say so in your handoff and leave it
unchecked rather than leaving it flaky. An honest gap is auditable. A red that
everyone ignores is not.

---

## 11. A panel you cannot close is the worst bug this project ships

`hud.ts` blocks keydown while a panel is open. The user was once trapped in a TV
seat and his words were *"no im telling you i can't get up anything i do once i
sit down"* — three rounds to fix.

**If you build or touch anything modal: Escape must close it from every screen
inside it, and standing up must close it too. Prove both.**

---

## 12. What to hand back

In your `done.sh` line and your handoff note at `notes/<name>-<topic>.md`:

1. What you changed, and the **root cause in one line** — not "adjusted the value" but *why it was wrong*.
2. Your own verdict on the after-images, which you have personally looked at.
3. Anything you found and did **not** fix, precisely enough for the desk to queue it.
4. Whether you derived a value or copied it, and why.

**Reporting something you could not do is worth more than a silent workaround.**

---

## 7b. A TEXTURE'S DENSITY COMES FROM THE FACE IT LANDS ON. ALWAYS.

The user, 2026-08-02, on the jail interior: *"why aren't we catching these? what's
causing them and do we need to set a rule against them so they aren't created?"*

**Yes. This is the rule.**

Every textured surface **declares** its density and **derives** its repeat from
its own dimensions. Never accept the default repeat, and never type a repeat by
hand. `declareSurface` and `masonry(w, h, …).ppm` / `ppmW` / `ppmH` exist for
exactly this — use them.

**What it costs when you don't.** Fixed four separate times in two days:

- a texture painted for 4 m stretched over a **14 m** jail wall — 4.57 px/m against a declared 16
- 0.2 m screen-wall end caps wearing a **9.65 m** run — 770 px/m
- five trim boxes sharing one 1 m canvas — an 0.08 m sill drawing at 200 px/m
- a bench's boards tiling as repeated blocks

**Why it keeps reaching the user.** `scripts/masonry.mjs` only sweeps faces
tagged `userData.masonry`. A pillar, a door, a bench, a floor tile is not
masonry, so **nothing checks it**. And the world holds **343 texture creations
against 267 declarations** — about 76 surfaces have no declared density at all,
so there is nothing to check them against.

**So: if you create a texture, declare its density. If you apply one, derive the
repeat.** A surface that cannot state its own px/m is a surface no check can ever
defend, and the user finds those by eye — he has now done so five times.

## §6b — A ROW'S NUMBERS EXPIRE. ITS QUOTE DOES NOT.

Every queue row now ends with `⟨desk numbers measured YYYY-MM-DD HH:MM⟩`.

**If that stamp is over an hour old, re-measure before you start.** Not as
diligence theatre — as the first task of the item. In the 2026-08-02/03 session,
of the rows that commented on the desk's stated cause, **28 said it was wrong
against 5 that said it was right**, and the commonest failure was a number that
had rotted rather than a guess that was bad. One row navigated by three figures
had **all three wrong**: the backlog was 168 not 188, the worst category 14 not
39, and **the face it named as the place to start no longer existed**.

Three items in that session turned out to be **already satisfied** and were
closed with no code change at all. Finding that out and saying so is a complete
contribution — it is cheaper than the work, and it is the only way a stale row
ever gets retired.

**What does not expire is the user's verbatim quote.** When his words and the
desk's diagnosis disagree, he is right (§6a). Every time that was tested in that
session, the row was wrong and he was not.

