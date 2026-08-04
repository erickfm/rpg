# Standing brief — how to work here. The queue says *what*; this says *how*.

You are a builder on **CROSSTOWN '97**, a hand-authored Three.js/TypeScript 3D
city street set in 1997. Work only inside `street/`.

**Section numbers are permanent.** ~200 comments across `src/` and `scripts/`
cite them (`BUILDER-BRIEF §8`, `§5`, `§7b`). Shorten a section, never renumber it.

> ## ⚡ SMALL CHANGES: BATCH THEM, BUILD ONCE, SKIP THE REST OF THIS FILE.
>
> **The user's rule: five small changes is fifteen minutes, not five hours.** A
> colour, a size, a position, a label — make all the edits, build **once**, one
> commit each, look at it, `tsc`, hand back. No probes, no harness, no notes.
> Collision, floors, seats and the sidewalk lane are never small.

---

## 0. Are you on this project?

`git log --oneline -3` — do you see recent CROSSTOWN work? If not,
`git reset --hard add-stick-and-city98` then `(cd street && npm install)`; the
reset drops the `node_modules` symlink and the failure looks nothing like the
cause (GOTCHAS 54, 13).

`npm install|build|dev|live` and bare `npx vite` **refuse to run in the shared
checkout** (`/home/erick/projects/rpg/street`) if you walked there out of your own
worktree. The refusal prints the worktree to go back to — do that, don't argue.
It fails open, and a bare `node scripts/*.mjs` still goes round it.
`CT_ALLOW_SHARED=1` opts out; say so in `done.sh` if you use it.

## 1. The loop

1. `./scripts/claim.sh <your-name>` — takes the top item atomically and prints it.
   **Run it; do not read it.**
2. Do it. **Commit as you go.**
3. `./scripts/done.sh <your-name> "<one line>"`. Then claim again. Empty queue →
   say so and stop. Never invent work.

**Between items, with a clean tree**, pull mainline in — your worktree is a
snapshot cut when you started and does not move:
`git merge --no-edit add-stick-and-city98`. Never mid-item.

**If an item runs long, `./scripts/claim.sh --touch <your-name>` after each
commit** — claims are reaped after 150 minutes and the reaper cannot tell your
slow item from a corpse.

**You do not wait to be told what to do next, and you do not pick items out of
order** — the queue is ranked, and the ranking is the desk's judgement.

## 2. Commit early, commit often

**Five agents have been killed mid-flight by session limits. Only the ones that
had committed kept their work.** One burned 245,000 tokens and delivered nothing.
An uncommitted result is a lost result. This repo commits freely — do not ask.

## 2a. DO NOT SPEND MORE THAN THE CHANGE IS WORTH

**The user's hard budget:** *"tests should not take longer than the work to code
itself."* Check it FIRST. If the fix is a one-line constant and the proof is a
forty-minute harness, the item is upside down.

**Four ways this project has burned hours. Do none of them:**

- **Never establish a "before" by reverting your change and re-running the
  suite.** That doubles the most expensive part of the item to learn what git
  already knows. If a check fails, read the failure to see whether it fails *for
  your reason*.
- **Never poll a long run.** One blocking call with a `timeout`, then read the
  result once. Twelve `sleep`/`until grep` calls around one ten-minute walk is
  twelve turns of context for one fact.
- **Never `cat` a script to learn how to use it.** Run it with no arguments, or
  read its first six lines.
- **Orient in ONE pass**: the claim output, the GOTCHAS *index* (not the file),
  and the file you are about to edit. Not `git log -30`, not a 400-line
  `git show`, not the whole of `FEATURE-REQUESTS.md`.

## 3. Run everything synchronously

**An agent that launches a suite and waits to be woken never comes back** —
twice, at ~250k tokens each. If a run is slow, make it smaller, not asynchronous
(GOTCHAS 55).

## 4. Aim your instruments at YOUR world

Instruments default to port **4177**, usually somebody else's server. **Always
pass `SHOT_URL=http://localhost:<your port>/`**, and prove the port is free with
`ss -ltn | grep ":<port> "` — **`curl` is not a free-port test**; it reads a bound
socket that isn't answering yet as free, which is how worker sixtyone lost 4183
(GOTCHAS 81). Bind with `--strictPort` so it fails loudly rather than letting vite
walk to a port you are not measuring. Say which port you used in your handoff.

> An instrument aimed at the wrong world reports a catastrophe it cannot see —
> or a clean bill of health it did not earn. (GOTCHAS 48.)

## 4a. THERE IS NOT ONE TEST SURFACE. THERE ARE ELEVEN.

Reaching for the wrong one does not throw — it hands you `undefined` and your
probe reasons from it (queue item 249, three lost detours).

Facts about **the world** — position, collider, floor, spot, seat, door, clock,
traffic, people — are on **`__ct`** (54 members, `crosstown.ts:1573`). Facts about
**the chrome over the world** — which panel is up, the fade, the keypress latch —
are on **`__hud`** (8, `ct/hud.ts`). Each machine owns its own: `__inv`, `__atm`,
`__rent`, `__slots`, `__blackjack`, `__librarypc`, `__frontages`, `__lab`.

**`__ct` is not a superset** — it does not know a panel is open, and `__hud` does
not know where you are standing. Re-enumerate with
`scripts/probes/w119-249-test-surfaces.mjs` rather than trusting any list, and
wait with `p.waitForFunction(() => window.__ct !== undefined)`, never a sleep — a
surface for a room you have not entered may not exist yet.

## 5. Interactions need a HELD keypress

```js
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
```

`press('e')` can begin and end inside one animation frame, and the `[E]` dispatch
is an edge read **once per rendered frame** — so the tap is never observed. This
made a fully working feature report three false failures.

## 6. Check whether the work is already done

**A queue item is a hypothesis, not a finding.** Measure before you change. If it
is already satisfied, **say so and mark it done** — three items in one session
were already done, and finding that out is a complete contribution (GOTCHAS 57).

### 6a. THE USER'S QUOTE OUTRANKS THE DESK'S DIAGNOSIS

Measured: **28 rows said the desk's stated cause was wrong against 5 that said it
was right.** The desk reads a screenshot; you are standing in the world with
instruments. When the item's diagnosis and the user's quoted words disagree,
**the words win** — say so in your `done.sh` line.

- *"this door is making it a little too cramped"* → filed against the door leaf;
  entrance leaves carry **no collider at all**. It was a newspaper stand.
- *"seats in the tax office are reversed"* → filed as a yaw; `yaw:0` was already
  right and the backrest mesh was on the wrong side.
- *"get rid of the overlay descriptions"* → filed against `ct/hud.ts`, which does
  not build that text. It is in `main.ts` and `index.html`.

**Reporting "the stated cause is wrong, here is the real one" is the single most
valuable thing a builder does here.** It is never a failure to hand back.

### 6b. A ROW'S NUMBERS EXPIRE. ITS QUOTE DOES NOT.

Rows end with `⟨desk numbers measured YYYY-MM-DD HH:MM⟩`. **If that stamp is over
an hour old, re-measure before you start** — the commonest failure is a number
that rotted, not a guess that was bad. One row navigated by three figures had all
three wrong, including a face that no longer existed.

## 7. Half of all "defects" here are the instrument, not the world

Measured: **7 real defects against 6 instrument artifacts.** When a measurement
surprises you, **find the number in the source before you believe it** — a script
is a hypothesis about the source; the source is the answer. `WELL_IN = 0.66`
against a tyre spanning 0.70–0.94 settled a week-old argument in one line.

**Never fix a failing check by loosening it until it passes.** A check that cannot
fail is worse than one that is wrong. If the check is right and the world is
wrong, say so and queue the world fix (GOTCHAS 58).

### 7a. Your one-shot probe goes in `scripts/probes/`

`scripts/` reached 797 files, of which about thirty were ever run twice. A script
written to answer one question once goes in `scripts/probes/`, named for the
question. It graduates to `scripts/` only when something *calls* it. Commit it —
the note citing it is worth much less without it.

### 7b. A TEXTURE'S DENSITY COMES FROM THE FACE IT LANDS ON. ALWAYS.

The user, on the jail interior: *"why aren't we catching these? do we need to set
a rule against them?"* **This is the rule.** Every textured surface **declares**
its density and **derives** its repeat from its own dimensions — `declareSurface`
and `masonry(w, h, …).ppm` / `ppmW` / `ppmH` exist for exactly this. Never accept
the default repeat; never type one by hand.

Fixed four times in two days: a texture painted for 4 m stretched over a **14 m**
jail wall; 0.2 m end caps wearing a 9.65 m run at 770 px/m; five trim boxes
sharing one canvas; a bench tiling as blocks. `scripts/masonry.mjs` only sweeps
faces tagged `userData.masonry` — a pillar, door, bench or floor tile is not
masonry, **so nothing checks it**, and the user finds those by eye.

## 8. Derive, never retype

A second hand-typed copy of a number is the single most expensive habit in this
codebase — it is how `bedcavity.mjs` spent a week measuring a truck that no
longer existed, and how `doorside2.mjs` failed a door that was fine. **Import
it.** If you cannot without editing a file you do not own, copy it **with a
line-number citation** and queue a follow-up to hoist a shared export.

## 9. Claiming an item makes its files yours

The queue is the authority. Every item names the file(s) it touches, and holding
the item grants you those files — that is what the claim is for.

- **The item names a file → it is yours. Do the work.**
- **You need a file the item does NOT name → stop and report it in `done.sh`.**
  That is the real boundary, and reporting it is a success.
- **Another builder holds an item naming the same file → skip it, take the next.**

Editing outside your claimed item is what broke the live world and corrupted a
third worktree. A queued one-liner costs a minute; a cross-builder conflict costs
ten plus a broken world.

## 10. How to prove it

- **Movement, collision, floors and seats: WALK them.** A screenshot cannot prove
  you are not wedged. **Press `V`** for the collision overlay — red where a gap
  under 0.95 m could trap a player; it found two real bugs in the user's hands on
  its first day.
- **Screenshots are for LOOKING, never for PROVING.** Two runs of identical code
  differ ~20% of pixels.
- **`fp`/`fpdiff` is a PURE-REFACTOR tool ONLY.** `scenedump.mjs:26` seeds
  `Math.random` globally and three's `generateUUID()` draws four values per
  object, so **adding or removing any geometry repaints every dithered texture
  after it** — one builder saw 294/1461 textures differ on a change that moved
  nothing. If your change touches geometry, compare `places` as a multiset
  (`scripts/probes/w44-placediff.mjs`). Dumping the same build twice differs on 5
  of 8,612 entries — puddle planes drifting 1–3 cm — so **the noise floor is 5**.
- **Verify on the BUILT bundle** (`npx vite preview`), not only dev — the
  panel/keydown class of bug ships differently than it renders. There is no
  exemption left: `interiors-walk.mjs` runs on the built bundle too, and if it
  aborts with **exit 3 a hook is missing, not the rooms** (GOTCHAS 32).
- **A build against the tree your preview serves blinds it ~0.2 s. It does not
  kill it.** `npm run checks` tells the cases apart: `BUILD RACE` (re-run that
  check), `dist/ EMPTY` (re-run the build), `SERVER DIED` (the port really is
  refusing). **Do not start a second preview on that port.**
- Finish with `node scripts/bugsweep.mjs` — **zero STATION MISS**, no new console
  errors. It covers all 12 rooms and 3 sites.
- **The 2 m sidewalk lane is sacred.** Indoors too: a person should be able to
  walk past a shelf without brushing it.

### 10a. CHEAP CHECKS YES, FLAKY CHECKS NO — AND THE USER REVIEWS ANYWAY

*"keep tests that are cheap but stay away from tests that are failure prone. i
will be reviewing anyway yknow?"*

**VERIFYING** during your item is unchanged — §10 stands. **ENSHRINING** that
verification as a standing check everyone pays for forever is a decision you
justify. The test: *if this goes red six weeks from now, will it be because the
world broke — or because the world is a world?*

**Keep:** numbers read off `__ct`; counts of colliders, spots, rooms, materials;
geometry-signature multisets; anything answering in milliseconds off a built
bundle without a camera or a clock.

**Do not enshrine:** anything timed (a game day is 24 real minutes, so sampling a
moving world at a wall-clock instant is a coin toss); anything needing N runs to
mean something (that is a measurement — take it, write the number in your
handoff, assert on the *stable* thing you learned); anything pixel-derived; a new
long browser walk kept purely as regression insurance.

**A check that cries wolf is worse than no check** — it trains five builders and a
desk to scroll past red, and this board has already lost items to exactly that.
When you genuinely cannot make a cheap check for something important, **say so
and leave it unchecked rather than flaky.** An honest gap is auditable; a red
everyone ignores is not.

## 11. A panel you cannot close is the worst bug this project ships

`hud.ts` blocks keydown while a panel is open. The user was once trapped in a TV
seat: *"no im telling you i can't get up anything i do once i sit down"* — three
rounds to fix. **If you build or touch anything modal: Escape must close it from
every screen inside it, and standing up must close it too. Prove both.**

## 12. What to hand back

**In your `done.sh` line. Do NOT write a notes file** — `notes/` reached 206 files
of per-worker handoffs and git history already holds all of it.

1. What you changed and **the root cause in one line** — not "adjusted the value"
   but *why it was wrong*.
2. What you verified, as numbers rather than "all green", and your own verdict on
   anything you looked at.
3. Anything you found and did **not** fix, precisely enough for the desk to queue.
4. Whether you derived a value or copied it, and why.

**Reporting something you could not do is worth more than a silent workaround.**
