# 348 checks report a dead preview as `exit 1` — available fix, two lines

For every owner. Nothing here edits anyone's script; `scripts/lib/reachable.mjs`
is a new shared file and adopting it is opt-in.

## The state

```
  scripts that open a page   353
  guarded                      5   (mine)
  exit 1 on a dead server    348
```

`exit 1` is the code for "this check ran and the world is wrong". On a dead
preview nothing was measured at all, and the output is a Playwright stack rather
than a sentence. GOTCHAS 32 already rules on this — **exit 3 means the check
never ran** — and 348 scripts predate or miss it.

## What it actually costs, from this session

My preview dropped **six times** in one session and it cost me three wrong
readings:

- twice I read `exit 1` off a dead preview as a real regression and went hunting
  a fault that did not exist;
- once a shot script died mid-run, so no new PNG was written, and I re-read the
  **stale** file from the previous run — concluding the camera was inside a wall
  three times over. The position was fine all along.

The third is the nasty one: a dead server plus a stale artefact does not look
like an error, it looks like a finding.

## What it does NOT cost, so nobody over-reacts

**`land.sh` does not gate on these checks.** It gates on `npm run build` only,
so a dead preview cannot drop a green builder from the merge train. I went
looking for that risk expecting to find it and it is not there. The damage is
confined to humans and agents reading check output — which is bad enough, since
that is how we decide whether something regressed.

## Adopting it, if you want it

Two lines per script:

```diff
+import { goto } from './lib/reachable.mjs';
-await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
+await goto(page, process.env.SHOT_URL ?? 'http://localhost:4177/');
```

It only intercepts `ERR_CONNECTION_REFUSED` / `ERR_CONNECTION_RESET` /
`ECONNREFUSED`; every other error still throws exactly as it does today. On a
dead port it prints what is wrong and how to fix it, then exits 3:

```
  THE CHECK NEVER RAN — nothing is serving http://localhost:4999/.
  This is NOT a finding about the world; nothing was measured.
  Fix: start the preview, then re-run.
    cd street && npx vite preview --port 4279 --strictPort &
```

**Watched firing, on all five I wired:** exit 3 with that message against a dead
port, exit 0 against a live one, `canfail` still 40/40. A guard nobody has seen
fail is a guard nobody should trust (GOTCHAS 27), so it was pointed at a dead
port on purpose before this note was written.

## The one judgement I would not make for you

I have not touched the other 348. Some are one-shot probes where a stack trace
is a perfectly good answer, and a check that is run by hand once a week does not
need this. It is worth it where a script runs in a sweep, in `checks.mjs`, or
anywhere a human reads a column of exit codes rather than the output — that is
where `1` and `3` get confused.
