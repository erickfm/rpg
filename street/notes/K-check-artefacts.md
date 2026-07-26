# The check suite's artefacts — five named classes, measured, from one night in it

For the open desk row *"the full check suite kills the preview server, and ~half
its 52 failures are artefacts."* It is not my row. This is the evidence I
happened to collect while writing eight checks and chasing four of my own false
reds, offered so the triage starts shorter.

---

## 1. The biggest class is not a failure at all: **exit 3 after a rebase**

Measured just now, same four checks, same server, same minute:

```
                      before npm run build      after
K-pocket-loop            exit 3                 exit 0
K-pocket-panel           exit 3                 exit 0
K-tyre-has-arch          exit 3                 exit 0
K-no-panel-traps         exit 3                 exit 0
```

A preview serves `dist/`. **Rebase and every check in the suite exits 3** —
"MEASURING THE WRONG WORLD", which GOTCHAS §32 is explicit about: *exit 3 means
the check never ran, and nothing at all follows about the world.*

`checks.mjs` already maps status 3 to `WRONG WORLD` rather than `FAILED`, which
is right — so if the 52 are being counted as failures, **check how many of them
say WRONG WORLD first.** On a merge train where every builder rebases constantly,
this is the class I would expect to dominate, and it costs one `npm run build`
before the suite to remove entirely.

## 2. I could **not** reproduce the preview server dying from the checks

Eight consecutive check runs against one preview, polling the port after each:

```
exit=3 server=200 · exit=3 server=200 · exit=3 server=200
exit=0 server=200 · exit=0 server=200 · exit=0 server=200 · exit=0 server=200
```

**It survived all eight.** And `checks.mjs` runs its checks **sequentially**
with `spawnSync`, so the suite is not putting concurrent load on the server
either.

My preview *did* die three times tonight, and each death was **silent** — the
log ends at the startup banner, no crash, no stack, nothing in `dmesg` about
OOM, and 32 GB free at the time. So it exits rather than crashing. **I would not
go looking in the checks for it**; on my evidence the cause is outside them, and
the row's two halves are probably two different problems.

## 3–5. The artefact classes I found in my own checks, all one root

Every one of these was a **false red on working code**, all mine, and all the
same mistake: **a wall clock or a fixed count standing in for render-loop
progress** (GOTCHAS §30, and §43 — the sim runs at about 0.66× wall time in a
headless browser).

| | what it did | measured | the fix |
|---|---|---|---|
| **a distance-per-second bar** | asserted "walks > 2 m in 2.6 s" | read **1.54 and 1.87 m** under load, 2 reds in 5 | walk **until** you get there or stop making progress |
| **a sample count** | wanted 4 readings part-way through a fade | got **3 of 4** from a starved sampler, 2 reds in 4 concurrent | measure **milliseconds**, which starvation can only make look longer |
| **a keydown that never arrived** | held W and read 0.00 m | 1 run in 3 under 4-way load | **retry**, so a red means the keys really are not arriving |
| **a prompt read after a warp** | read the `[E]` prompt 200 ms after warping | still the **previous location's** prompt at 200 ms *and* 600 ms; correct only by 1200 ms | wait for `__ct.pos()` to **stop moving** |

The fourth is the dangerous one and it has its own note —
`notes/K-stale-prompt-after-warp.md` — because it produces **false positives in
station sweeps**: the stale value is exactly the previous square's prompt.
Fifteen scripts in `scripts/` have that shape. It nearly cost me a filed report
that a player at a casino slot is teleported into their apartment.

## The rule I would put on the wall

**A control that fails spuriously is the worst kind of red** — it discredits the
real verdict standing beside it, and a suite with a few of them trains everyone
to read the whole board as noise. Every one of the four above was in a *control*
or a *population* assertion rather than in the thing under test.

And the cheap tell for all of them: **run the check four times at once.** Three
of the four were invisible on an idle machine and reproduced immediately under
concurrent load.

```sh
for i in 1 2 3 4; do (node scripts/<yours>.mjs > /tmp/c$i.log 2>&1) & done; wait
```

— K
