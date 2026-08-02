# w25 — item 45: repack the artifact, and the "direct conflict" that is not one

**Root cause, one line: the artifact was never destroyed by a rule conflict — it
was destroyed by a bare `npm run build` run *after* packing, and
`pack-artifact.mjs` already builds-then-packs specifically so that ordering
cannot happen. Packing at HEAD satisfies both hygiene rules at once.**

Port used: **4182** — the only free port in the whole of 4180–4199 (`ss -ltnp`
shows 4177 and 4180–4199 all listening except 4182). Preview started with
`npx vite preview --outDir dist --port 4182 --strictPort`.

## The deliverable

```
/home/erick/projects/rpg/.claude/worktrees/agent-a632953157a295be2/street/dist/artifact.html
```

**1,115,685 bytes**, build stamp = HEAD. It exists on disk and I did not run a
build after packing it.

## DONE WHEN, clause by clause

| clause | verdict |
|---|---|
| `artifact.html` exists at a stated path | yes, above |
| `check-artifact.mjs` passes against it | `__ct initialised, 7775 meshes, mean luminance 64.8 — it opens standalone and draws`, exit 0. Its `--selftest` CAUGHT the broken copy, so the pass is earned |
| opened it and sat down at one game | yes — walked to a slot stool in the packed artifact, held `[E]`, seated, machine opened, and got back up |

## The item's premise is stale, and this is the part worth reading

The item says the two hygiene rules "are in direct conflict and nothing wrote
that down". Both halves are now false:

1. **`pack-artifact.mjs` BUILDS FIRST and then packs** (its header says so, and
   `--no-build` is the opt-out). So the normal invocation leaves `dist/` built at
   HEAD *and* `artifact.html` present, simultaneously. There is no conflict to
   resolve — the ordering is enforced by the tool.
2. **GOTCHAS §63 already wrote it down**, including the escape hatch ("copy
   `artifact.html` somewhere outside `dist/` first").

The only way to lose the artifact is a **bare `npm run build` after packing**.
That is one specific mistake, not a structural contradiction. Item 38 did nothing
wrong except run that one command.

Measured, at the moment of packing: `distSha() == localHead() == 369712937`. The
`checks.mjs` pre-flight compares exactly those two, so it does **not** exit 2.

Two further narrowings of the stated hazard, both from `scripts/checks.mjs:105`:

- The pre-flight only runs when `servingBundle` is true — i.e. `SHOT_URL` points
  at a **preview** serving `dist/`. Against a **dev server**, which is what
  BUILDER-BRIEF §4 tells every builder to use, it never fires at all.
- It is also skipped under `SHOT_WORLD=integration`.

So the blast radius of a stale `dist/` is smaller than the item assumes: it is
one worktree, one mode, and `dist/` is gitignored and per-worktree anyway.

**Standing rule, if you want one sentence:** to refresh the artifact, run
`node scripts/pack-artifact.mjs` **last, after your final commit**, and stop.
Never `npm run build && node scripts/pack-artifact.mjs`'s inverse — the build in
`CLAUDE.md`'s published recipe is redundant (pack builds anyway) but harmless
because pack still comes last.

## What I changed

### 1. `scripts/pack-artifact.mjs` — it was reporting the wrong byte count

`console.log(\`… ${out.length} bytes\`)`. **`out.length` is UTF-16 code units, not
bytes.** This bundle carries enough non-ASCII (em dashes, accents) that the two
genuinely differ:

```
JS string length (UTF-16 units): 1115475
Buffer.byteLength UTF-8        : 1115685
statSync size on disk          : 1115685
```

A **210-byte undercount printed under the label "bytes"** — and the size is
precisely the number you would compare against `ls -la` or an upload dialog to
decide whether the artifact you are holding is the one that was packed. The item
itself quotes item 38's "1,113,501 bytes", which was this same mislabeled
quantity, so the number in the queue is a character count too.

Now `Buffer.byteLength(out, 'utf8')`, derived from the same string that was just
written so it cannot drift from the file. Verified: the printed number and
`ls -la` now agree exactly.

This file is named in item 45's own file list, so it was in scope.

### 2. `scripts/probes/w25-sit-in-artifact.mjs` — new

`L-games-in-artifact.mjs` (in `scripts/probes/`, despite `checks.mjs:857`
citing it as `scripts/L-games-in-artifact.mjs`) proves both games are reachable
in the pack — but it does so by calling `window.__slots.open()`, which is the
module's API, **not the seat**. A game that inlines perfectly and whose stool no
longer seats you passes that check and is unplayable. BUILDER-BRIEF §10 is
explicit that seats are proved by walking them.

So this one warps to a stool's **own published approach point** (never a typed
coordinate — GOTCHAS §20), waits for the world to *offer* the seat, holds `[E]`
for 90 ms (BUILDER-BRIEF §5 — a tap is never observed), and asserts seated +
`ct-slots` panel open. It then asserts you **get back up**, because BUILDER-BRIEF
§11 makes that the worst bug this project ships.

Result against the artifact on :4182 — 87 stools publish `sit at the slot`; sat
at (682.44, 8.18); panel `none` → `ct-slots`; Escape closed it; player stood.
All 8 verdicts OK, 0 page errors.

`--selftest`: **3 / 3 CAUGHT** (`never-seats`, `never-stands`, and the aim guard
which must exit 3 against a non-artifact URL). The check can fail.

## Verification run

- `node scripts/check-artifact.mjs` → passes; `--selftest` → SELFTEST PASSED
- `SHOT_URL=…:4182/artifact.html node scripts/probes/L-games-in-artifact.mjs` →
  all pass. RTP 92.834%, 10,648 combos, 6 decks, blackjack pays 1.5, both games
  take a bet and deal. 0 console errors.
- `SHOT_URL=…:4182/artifact.html node scripts/probes/w25-sit-in-artifact.mjs` →
  all pass, selftest 3/3.

## Found and NOT fixed — for the desk to queue

1. **`scripts/checks.mjs:857` cites `L-games-in-artifact.mjs` at the wrong
   path.** The comment's runnable recipe says `scripts/L-games-in-artifact.mjs`;
   the file is at `scripts/probes/L-games-in-artifact.mjs`. Copy-pasting the
   documented command fails with MODULE_NOT_FOUND. One-line comment fix, but it
   is in `checks.mjs`, which item 45 does not name, so I left it.

2. **The 4180–4199 port range is exhausted — 19 of 20 in use.** `ss -ltnp` shows
   listeners on 4177 and 4180–4199 with only 4182 free, held by ~20 long-lived
   vite processes, several with PIDs old enough to be dead agents' orphans
   (e.g. pid 1772130 on 4186, 1780226 on 4199). BUILDER-BRIEF §4 tells builders
   to pick a free port in that range; the next builder will find **none**. Worth
   a reaper for orphaned preview servers, or the brief needs a wider range.

3. **`check-artifact.mjs` samples luminance but not structure.** Its own header
   admits it "would pass just as happily with the spawn on the street, a door
   gapping, or a whole module missing". `L-games-in-artifact.mjs` and this new
   probe close that for the two casino games only. The other ten rooms have no
   artifact-level check. Not mine to widen.

4. **`dist/` and HEAD drift the moment you commit anything after packing** —
   including committing the handoff note. I handled it by packing *last*, after
   the final commit. If the desk wants a guarantee rather than a discipline, the
   move is for `pack-artifact.mjs` to also drop a copy outside `dist/`
   (GOTCHAS §63's own suggestion), so a later build cannot take the only copy.
   I did not add that: it changes where the deliverable lives, and this item told
   me to report the ordering question rather than decide it.

## Derived vs copied

Everything is derived. The byte count comes from `Buffer.byteLength` of the
string just written; the seat coordinates come from `window.__ct.seats()` at
runtime; the build SHA comes from `which-world.mjs`'s `distSha()`/`localHead()`
rather than being typed. No constant was copied into either file.
