# Item 182 — `SERVER DIED` was a lie, and `curl` was never a free-port test

Worker sixtyseven, 2026-08-02. Port **4230** (proved free with `ss -ltn`, held
for the whole session). Builds `ea8a7919f`, `8c36b6d67`.

---

## The headline: the item's stated cause is wrong, and the symptom is real

The row says **"`npm run build` while a preview is serving KILLS the preview"**.

**It does not.** The preview process never stops listening. Measured on this
tree, polling a live `vite preview` on 4230 flat out across one `npm run build`
(`scripts/probes/w67-does-build-kill-preview.mjs`):

```
HTTP 200   5760 polls   0.03s .. 2.44s
HTTP 404   1175 polls   0.67s .. 0.89s
           zero refused connections; still listening afterwards
```

**Root cause in one line: `vite build` empties `dist/` before it writes, `vite
preview` serves `dist/` statically, so a perfectly healthy server has no page to
hand back for about 220 ms — and `checks.mjs` asked `response.ok`, which is
false for that 404 exactly as it is false for ECONNREFUSED.**

Two consequences, and the second is the expensive one:

1. The message named the wrong thing. A builder is told the server died, so they
   restart a server that never stopped — or, per the row, go looking at their
   own change.
2. **`serverDied` was a latch that was never re-tested.** One 220 ms blink
   condemned every remaining check of a twelve-minute run to
   `SERVER DIED (unmeasured)`. That is a plausible share of the
   "~half its 52 failures are artefacts" row in the LEDGER.

This matters beyond the message: **the old code could not distinguish a
recoverable blink from a permanent death, so no wording would have been correct.**
Fixing the sentence alone — which the item offered as the acceptable cheap
option — would have left the latch throwing away good runs.

## What changed

**`scripts/lib/server-state.mjs` (new).** The classifier, extracted from
`checks.mjs` so a probe can drive the real code rather than a retyped copy
(BUILDER-BRIEF §8). Three answers instead of a boolean:

| answer | meaning | what to do |
|---|---|---|
| `ok` | 2xx | there is a world there |
| `empty` | socket answered 4xx/5xx | **process is alive, `dist/` is gone.** Build running, or a build failed after emptying it. Wait, or `npm run build` |
| `dead` | fetch threw | nothing on the port. The real death (LEDGER: 200 → 000, 33 leaked chromiums) |

`probeWithRecovery()` adds a fourth, **`recovered`** — it was empty and healed.
Retries for 6 s, thirty times the measured 220 ms window, and costs a healthy run
nothing because it is only reached after something has already failed.

**`scripts/checks.mjs`.**
- Pre-flight now separates "alive but `dist/` is empty" from "nothing is
  serving", and the 404 branch says *do not start a second preview*.
- The mid-run latch stores **why** (`dead` / `empty`), not just *that*.
- A `recovered` marks that one check `BUILD RACE (unmeasured)` and **the run
  carries on** rather than latching.
- Three footers, one per cause, each naming the fix. The `BUILD RACE` footer
  prints the exact re-run command for each casualty, and points at
  `live-integrate.sh` rebuilding every 15 s as the likely culprit.

**`notes/BUILDER-BRIEF.md` §4** — the `curl … %{http_code}` recipe replaced with
`ss -ltn`, with the demonstration below. §10 gains a bullet on the build race so
a builder who hits it is not sent to their own diff.

**`notes/GOTCHAS.md` 81** — gains the demonstration; its second half is
**retracted as 81a** with the measurements, because it asserted the build kills
the preview and that is false.

**`scripts/reap-servers.sh`** — its free-port count used the same wrong recipe,
so **the script whose whole job is keeping ports available was itself reporting
bound ports as free.** One `ss` call replaces twenty `curl`s and ~20 s of
timeouts.

## Why `curl` was never a free-port test

`000` does not mean *free*. It means *nothing spoke HTTP to me* — and a socket
can be bound and LISTENING without doing that. Bare TCP listener on 4239 that
never answers:

```
ss  : LISTEN 0  511  127.0.0.1:4239  0.0.0.0:*
curl: 000                                        ← "free", said the old recipe
```

That is exactly how worker sixtyone lost 4183: `curl` said `000`, `--strictPort`
then refused to bind partway into the run.

**It is still a race and no tool fixes that** — a port free when you look can be
taken before you bind — so the brief now also says to bind with `--strictPort`
and let it fail loudly, rather than let vite walk to the next port and hand you a
world at an address you are not measuring.

## How it is proved

`scripts/probes/w67-server-state-cases.mjs` — **12 cases, all green.** Six drive
the classifier through every answer against a scratch server whose mode I
control; six drive `checks.mjs` end to end and assert the **text a builder
actually reads**, on both the dead-port and the 404 branch.

**It can fail.** Under two mutations — the pre-flight 404 branch disabled, and
`'empty'` reclassified as `'dead'` — it went **red on 7 of 12**, naming each
wrong answer. Both files restored byte-for-byte afterwards (`git diff` clean on
`server-state.mjs`). Every case asserts the *specific* answer, never that a
count is non-zero (GOTCHAS 79's vacuous-selftest corollary).

**A trap I fell into and left documented in the probe.** My first version used
`spawnSync` to run `checks.mjs` while the scratch server lived in the same
process. `spawnSync` blocks the event loop, so the server could never accept the
connection, and `checks.mjs` reported `NOTHING IS SERVING (TimeoutError)` — a
perfect false negative that looked exactly like the fix not working. Four cases
were red for a reason that had nothing to do with the code under test.

Also run, all against 4230 on build `8c36b6d67`:
`npm run typecheck` exit 0 · `node scripts/health.mjs` exit 0, `WORLD OK` ·
`npm run sweep` exit 0, **96 shots, 0 STATION MISS, 0 COVERAGE**.

## Found and NOT fixed — for the desk to queue

- **`scripts/guards.sh:26` probes ports with a `/dev/tcp` connect.** That is
  sound (a connect to a listening socket succeeds, so it does not have curl's
  blind spot) and I left it alone, but it is a third method for one question.
  Worth hoisting a single shared free-port helper so there is one answer.
- **`reap-servers.sh --dry` exits before printing the free-port count** (line
  65), so the count only ever appears on a live run that kills servers. I did
  not change the control flow — it is outside this item and someone may rely on
  it — but it means the number is hard to read safely. I verified my rewrite by
  running the block standalone: **17 of 20 free** against ground truth
  4186/4190/4191 taken.
- **`reap-servers.sh` thinks a live agent worktree is "gone".** Run from inside
  an isolated agent worktree, `git rev-parse --show-toplevel` returns *that*
  worktree, so `$ROOT/.claude/worktrees/agent-<id>` does not exist and it
  reported *my own live preview* as reapable. Not in my item and I did not touch
  it, but a desk running this from the wrong directory would kill working
  builders' servers.
- **Port 4186 currently answers HTTP 404.** That is another builder's preview
  with an empty `dist/` — i.e. this exact bug, live on the fleet right now.

## Shared file, and the merge

`scripts/checks.mjs` was shared with **worker sixtysix (item 161)**, which
registers `texdensity.mjs` and `masonry --selftest`.

**No conflict occurred in `checks.mjs`, because item 161 had not landed when I
merged** (mainline's last commit touching the file is `9d446a944`, and
`texdensity` is still unregistered there — I confirmed by running
`checks-registered.mjs`, which is red for exactly that reason). Our edits are in
disjoint regions: mine are the import at line 35, the pre-flight 404 branch, the
classifier call sites in the loop body and the footers; **its are the `CHECKS`
array (lines ~143–1010), which I did not touch at all.** They should auto-merge,
but **sixtysix merges after me, so it is the one that will see the conflict** —
whoever resolves it should keep both, and the desk should verify `texdensity`
ends up registered *and* `probeWithRecovery` still called at both sites.

The merge did conflict in **`notes/GOTCHAS.md`**: mainline appended a new §82
(queue rebuilds must preserve claims) while I was rewriting §81's tail into 81a.
**Resolved keeping both** — §81 + my 81a retraction, then mainline's §82
verbatim. Zero conflict markers remain and the section order reads 80, 81, 81a,
82.

## Verified after the merge, on build `75d0767db`

- `npm run typecheck` exit 0
- `npm run build` exit 0
- `scripts/probes/w67-server-state-cases.mjs` **12/12 green**
- `node scripts/health.mjs` exit 0 — `WORLD OK`
- `npm run sweep` exit 0 — 96 shots, **0 STATION MISS, 0 COVERAGE**
- Full fast-tier `npm run checks` (pre-merge, build `8c36b6d67`): **158 rows —
  91 ✓, 17 ✗, 50 skipped, and ZERO `SERVER DIED` / `dist/ EMPTY` /
  `BUILD RACE` / `TREE MOVED`.** The change is status-neutral on a healthy
  world and invents no false positives.
- **All 17 reds are pre-existing and belong to other items.** I ran the three
  that could plausibly have been mine: `checks-registered` is red *only* on
  `texdensity.mjs` being unregistered (that is item 161, sixtysix's job);
  `checks-can-fail` is red on `w40-bed-vs-door` having no failing path;
  `mutations-quote-real-source` is red on 4 dead mutation cases in
  `ct/bank.ts` and `ct/props.ts` — world files I never opened.
- **My own preview on 4230 survived four `npm run build`s during this session**,
  which is the finding restated as an accident.
