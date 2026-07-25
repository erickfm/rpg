# Builder A — the build stamp

Branch `feat/split-2b`. Three files: `vite.config.ts`, `src/vite-env.d.ts`,
`src/proto/ct/hud.ts`. No signature changed, no caller touched.

The corner of the frame now reads `5190769+ 18:38` — short sha, then the build
time. A trailing `+` means the worktree was dirty when the bundle was served, so
the sha alone will not reproduce what you are looking at.

## Why it is not a `define`

The brief suggested `define`, and for `vite build` that would have been fine.
It is wrong for the world the user actually plays.

`:5177` is a **dev server that is never restarted**. `scripts/live-integrate.sh`
`reset --hard`s the `live` worktree underneath it every 15 s and lets HMR reload
the page. A `define` is evaluated once, when vite loads its config — so the
stamp would show whatever sha was checked out when the server first booted, and
keep showing it all day. That is worse than no stamp: it would confidently
mislead the exact people it exists for.

So the sha comes from a virtual module (`virtual:build-stamp`) whose `load()`
shells out to git, invalidated on **every document request** so the next page
load re-runs git.

**My first attempt at this was wrong, and testing it is the only reason I
know.** I hooked `handleHotUpdate`, which fires when a *watched source file*
changes. That looked right and reads plausibly. But HEAD can move without any
watched file changing — a docs-only commit, an amend, a rebase that lands
notes — and the stamp then keeps reporting the previous sha:

```
HEAD 5190769  → stamp "5190769+"
   (commit 4c667bb — notes/ only, server untouched)
HEAD 4c667bb  → stamp "5190769+"      ← WRONG, a commit behind
```

A stamp that is silently one commit behind is the precise failure this task
exists to prevent, so the hook moved to a dev middleware on document requests:
one `git rev-parse` per page load, no way to miss a move.

```
HEAD 4c667bb  → stamp "4c667bb+"
   (commit <next> — notes/ only, server NOT restarted)
HEAD <next>   → stamp "<next>+"       ← correct
```

In the live worktree `HEAD` is the throwaway `live` merge commit, which is
exactly the right thing to show: it identifies the *integration* on screen, and
`git log` on it names every builder that went into it.

## Placement

Bottom-right, 10 px monospace, 50 % opacity with a hard text-shadow. Checked
against a day frame and a 23:30 night frame (`shots/stamp-corner.png`,
`shots/stamp-night.png`) — legible in both, clear of the controls card
bottom-left. Set once and never touched again: it has to survive a screenshot,
so it does not fade, move or hide.

`ct/hud.ts` is shared, so this is an **addition only** — one div created next to
the existing `ct-prompt` block, following the same `getElementById`-then-create
pattern. No change to the `Hud` interface; nothing restructured.

## Also in this commit: `strictPort: true`

While verifying the stamp I spent several minutes testing against **the wrong
world**, and the page looked entirely plausible.

Vite silently walks up from a taken port. Builder E's dev server was launched
with `--port 4182`, found 4182–4187 busy, and settled on **4188** — my assigned
port. My own preview then bounced to 4189 while I kept pointing the harness at
4188. The symptom was bizarre and cost real time: `ct-prompt` existed in the DOM
but `ct-stamp` did not, and the string was provably in my bundle.

`strictPort: true` makes a busy port a hard startup error instead. START-HERE
says "never share one"; this makes that true rather than aspirational.

**This changes the failure mode for every builder** — a busy port now fails
loudly rather than moving. That is the point, but the desk should know it
landed, because the next agent whose server refuses to start will want to know
why. The fix for them is to pick a free port, not to remove the flag.

## Verification

Fingerprint before/after, around the whole change:

```
objects    626 → 626    identical
textures   287 → 287    IDENTICAL
structure  626 → 626    IDENTICAL
places     626 → 626    9 differ  (pigeons — the noise floor)
```

A DOM-only addition cannot move the scene graph, and it did not. `npm run build`
clean, `node scripts/health.mjs` OK, `npm run sweep` — 48 shots, no page errors,
only the standing THREE.Clock deprecation and WebGL warnings.

## For the desk

- **The stamp travels with the artifact.** `pack-artifact.mjs` inlines the built
  bundle, so the sha is baked in — which directly serves the next queue item:
  you will be able to see at a glance whether the published artifact is behind.
- **Port collisions are silent today.** Beyond `strictPort`, it may be worth
  having `scripts/queues.sh` report which port each builder is actually serving
  on, since the assigned port and the real one can differ.

## Next in my queue

Republish the playable artifact — not started. Per the queue I will build it and
hand `street/dist/artifact.html` back rather than publishing it myself.
