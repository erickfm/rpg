# `vite preview` serves the build, not your source

**Anyone measuring against a port that runs `vite preview` is measuring whatever
was last built there, however long ago. It never reloads from source.**

## What happened

Port 4184 — the auditor's — was running:

```
node .../vite preview --port 4184 --strictPort     started 22:11, build c41170c7a
```

`vite preview` is a static server for `dist/`. Editing `src/` changes nothing;
rebasing changes nothing; restarting the *dev* server changes nothing. Only
`npm run build` changes what it serves. I took three confirmations against it
after HEAD had moved on.

Two things made it hard to notice:

- **The build stamp in the shot corner was honest and I misread it.** Shots said
  `c41170c7a` while HEAD said `8e78016c9`. I saw a hash that was a real commit in
  my own branch and read it as "recent" instead of "not HEAD". A stamp only helps
  if you *compare* it: `git rev-parse --short=9 HEAD`.
- **My restart silently did nothing.** `pkill -f "vite --port 4184"` does not
  match `vite preview --port 4184`. The old server stayed up, the port stayed
  answering, and `curl` said "up" — so the restart looked successful. If you kill
  a server, verify the PID died, not that the port responds.

## What actually caught it

Not a screenshot and not a measurement — an **impossibility**. `__ct.debugSpots`
is declared at `crosstown.ts:682`, inside the same object literal as
`advanceClock` (line 685) and `highlightParity` (line 765). The running object
had the other two and not `debugSpots`.

**Two adjacent keys of one object literal cannot disagree within a single
build.** That is not a measurement that came out oddly; it is a contradiction,
and a contradiction points at the world rather than at the value.

Worth generalising: *a surprising number invites you to explain it; an impossible
one tells you what to check.* Every number I took on the stale build was
internally consistent — the citizens agreed with the floors, the geometry agreed
with the shots. **A stale build does not produce incoherent results. It produces
perfectly coherent results about the past.**

## What to do

```sh
# before trusting anything measured through a port:
ps -p "$(ss -lptn "sport = :PORT" | grep -o 'pid=[0-9]*' | cut -d= -f2)" -o args=
```

If that says `vite preview`, run `npm run build` first. If it says `vite`
(dev), source changes are picked up and you are fine.

And read the stamp against HEAD every time, rather than glancing at it. The
project rule already says rebuild before verifying a row that landed after the
last build; this is the failure mode that rule exists to prevent, and it caught
me anyway because I never checked *which server* I was talking to.

## Blast radius, stated

Three of my confirmations were taken after 22:11 and re-run on HEAD afterwards:
park **bench backs** (identical: 0 of 9), the three **room 301 window** rows
(identical geometry), and **"this guy is floating"** — the only one that moved,
and it moved because the newer build has seated casino figures the older one did
not. See the row for the correction.

Related: [[street-parallel-agents]], and GOTCHAS 26.
