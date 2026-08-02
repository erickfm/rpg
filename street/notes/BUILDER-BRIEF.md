# Standing brief — read this once, then take work from the queue

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

---

## 1. The loop: take one item, finish it, take the next

1. `./scripts/claim.sh <your-name>` — claims the top unclaimed item **atomically**
   and prints it. Two builders cannot get the same one.
2. Do it. **Commit as you go.**
3. `./scripts/done.sh <your-name> "<one line on what you did>"` — releases the
   claim and marks it for the desk to verify.
4. Repeat. When `claim.sh` says the queue is empty, say so and stop.

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

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<port>/   # 000 = free
```

Anything other than `000` means **take a different port** — any free one in
4180–4199 — and **say which one you used** in your handoff. The desk has been
assigning these blind and cannot tell from here.

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
- **Screenshots are for LOOKING, never for PROVING a change didn't move the world.** Two runs of identical code differ ~20% of pixels. Use `npm run fp before` → change → `npm run fp after` → `npm run fpdiff`; textures and structure must match, 4–6 pigeons drifting is the noise floor.
- **Press `V` for the collision overlay.** Wireframe boxes, red where a gap under 0.95 m could trap a player. It is how the user found two real bugs on its first day.
- **Verify on the BUILT bundle** (`npx vite preview`), not only on dev. The panel/keydown class of bug has shipped differently than it renders in dev.
- Finish with `node scripts/bugsweep.mjs` — **zero STATION MISS**, no new console errors. It covers all 12 rooms and 3 sites.
- **The 2 m sidewalk lane is sacred.** Indoors too: a person should be able to walk past a shelf without brushing it.

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
