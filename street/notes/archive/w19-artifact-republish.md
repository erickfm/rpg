# w19 — the artifact, rebuilt and verified on the BUILT bundle

Queue item 38. **Artifact build `c0ed1559a`** — everything below was measured on
the pack stamped `8ffdc5979`, and it was repacked afterwards so `dist/` matches
HEAD. The only commit between the two is this note; no source changed, and
`check-artifact` and `L-games-in-artifact` were re-run on the repack and both
pass. Left matching on purpose: `checks.mjs` exits 2 when `dist/` was built from
a different commit than HEAD, so a stale stamp would abort the next person's
whole suite before a single check ran.

**Artifact:
`/home/erick/projects/rpg/.claude/worktrees/agent-a1526cd3fb43d34ff/street/dist/artifact.html`**,
1,113,501 bytes. **The desk publishes it** — the item says so and I have not
touched the artifact URL.

**PORTS: 4211, not 4198.** By the time I reached this item every port in
4180–4199 was in use by another builder (`ss -ltn` showed all twenty listening),
so the preview of the built bundle is on **4211**. My dev server for the earlier
items was on 4184.

## Root cause, one line

Nothing was broken — the artifact was simply older than a day's landed work.

## DONE WHEN, clause by clause

| clause | result |
|---|---|
| `npm run build` is clean | ✓ built in 234 ms, no errors. Only the standing `INEFFECTIVE_DYNAMIC_IMPORT` and >500 kB chunk warnings, which every build here prints |
| `check-artifact.mjs` passes | ✓ `__ct` initialised, 7775 meshes, mean luminance 64.6 — "it opens standalone and draws" |
| `bugsweep` on the built bundle, zero STATION MISS | ✓ 93 shots against `vite preview` on 4211, **zero** STATION MISS |
| opened the packed artifact and sat down at one game | ✓ see below |

## Sitting down, which is the clause a screenshot cannot answer

`scripts/probes/L-games-in-artifact.mjs` against
`http://localhost:4211/artifact.html` passes every claim — both games reach the
packed single file (they are built behind a dynamic import of `ct/hud.ts`, a
code-split point the pack has to inline), the slot strips still enumerate
92.834% over all 10,648 stop combinations, and the felt keeps 6 decks and its
rules. **But that drives the games through their API — it never sits down.**

So I walked it, in the artifact, with `scripts/L-slots-inworld.mjs`:

    87 stools publish themselves as 'sit at the slot'
    every stool's sit spot stands 0.75-0.75 m from its stand spot
    sat at the stool at (682.44, 8.18)
    OK    pressing E at the stool actually seats the player
    OK    SITTING DOWN OPENS THE MACHINE — the seat IS the trigger, not a second [E]
    OK    SPACE sets it spinning
    OK    ESC closes the machine
    OK    and it leaves the STOOL too — you cannot be trapped at a machine
    OK    and the world is yours again — held W moves you 0.69 m
    OK    all 69 credits came back to the wallet

Held keypresses, a real seat, and the panel-trap path proved in the build the
user actually opens. Zero console errors.

## Spot-checks on the headline changes this publish carries

Run against the packed artifact, not against dev:

- **`seat-facing`** — 219 registered seats, **219 look at something**. The
  105-seat facing bug the item leads with is genuinely gone from the artifact,
  not just from the source. (This is the check I registered in `npm run checks`
  under item 21, so it will keep being asked.)
- **`rain`** — rains at both hours; per-drop contrast 95.4 of 255 levels by day;
  wet road 0.3090 while raining → 0.5646 after 1.2 s → 0.8241 after 13 s, so
  "make wetness last a lil after it stops raining" holds in the artifact too.

## Found and NOT fixed

**`scripts/checks.mjs:863` gives a command that cannot run.** It documents the
by-hand invocation as

    SHOT_URL=http://localhost:<p>/artifact.html node scripts/L-games-in-artifact.mjs

and the file is at **`scripts/probes/L-games-in-artifact.mjs`** — it moved in the
`scripts/` reorganisation. Copying that line verbatim, as the queue item told me
to, gives `MODULE_NOT_FOUND`. This is the same reorganisation `checks.mjs`'s own
pre-flight guard was written for ("55 of the 121 registered checks moved into
`scripts/probes/`"); that guard covers the CHECKS table, and this is a command
in a comment, which nothing checks. `checks.mjs` is not in this item's files.

**Pages is not deployed by this item.** The item pairs "the artifact and the
Pages deploy are stale". Pages auto-deploys on push to mainline, and my work is
on this worktree's branch — so the deploy follows whenever the merge train lands
it, not from anything I can do here.

## Verdict

I opened the packed artifact myself and it draws a lit street at mean luminance
64.6 with 7775 meshes. No before/after image comparison applies — this is a
republish of already-landed work, not a change to the world; the guard that the
world did not move is that every check above was run against the built bundle
and the packed file rather than against dev.
