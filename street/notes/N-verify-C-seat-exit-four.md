# VERIFY C's four-claim seat-exit row — all four hold, and claim 1 has quietly closed claim 4

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. Built bundle on 4195, HEAD `09f7dcbb7`.
`scripts/C-seatexit.mjs` exits 0, 4 of 4, on my build.

## The four, measured rather than re-read

**1. The escape hatch is where C says it is, and that is why it works.**
`src/proto/fp.ts:94-96`:

```js
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && this.seat) this.forceUp = true;
}, true);          // <- capture
```

Capture phase, at construction, one boolean, not routed through the polled
`input.keys`. C's reasoning — *"it survives the one mechanism that kills
everything else"* — is exactly right and it is the whole of the fix.

**2 and 3** I measured in the item before this one: one distinct prompt
(`[E] stop watching TV`) across 30 look directions, and E leaving the seat 18 of
18 with a re-seat between each.

**4. "Could not reproduce"** — I could not either, and neither of us has tried
the live world at 5177 where he actually plays. Two negatives from two builders
is not the same as knowing it cannot happen.

## The finding: two parts of this row now disagree

Claim 4's own text, printed by `C-seatexit.mjs` as it passes:

> *"seat (675.0, 14.2) opens a MODAL (`#ct-panelback`) and hud.ts blocks keydown
> while one is open, **so E and Escape never reach the world.** NOT the seat exit
> — filed for the panel owner."*

**Escape reaches the world.** At that exact seat and seven others across the
casino floor:

```
ONE press of Escape from a slot stool:  out 5 · STILL STUCK 0 · never sat 3
```

`E` is still swallowed — I measured that too, and hud.ts:168 still lists
`keydown` in `BLOCKED`, so claim 4 is right about E. But **Escape was never
downstream of that block**, and claim 1 of this same row is the reason: `fp.ts`
listens in capture, so `hud`'s gate cannot swallow it.

So **C's claim 1 closed the trap that C's claim 4 files as still open**, and the
assertion text has not caught up. It is the same staleness I recorded against
K's slot-modal row (`notes/N-verify-K-slot-modal-trap.md`) — that row's
conclusion, *"a player who sits at a slot machine cannot leave by any key, and
reloading is the only exit"*, has the same author-side fix sitting one row away.

**This is GOTCHAS §44 with a check attached rather than a note:** the
measurement was true when written, the fix landed in the same row, and the
sentence is still in the present tense. It is worth more than a note because
`C-seatexit.mjs` prints it every time it passes, so the stale claim is
re-published on every green run.

## What I am not claiming

**Movement and jump do not free a seated player** — W and A leave you seated.
C's station says *"try E, Escape, movement and jump"*, but none of the four
assertions is about movement, so this is not a failure against the row, and
staying in a chair when you press W is the correct behaviour anyway. Recording
it only so the next reader does not test it as a claim.

**My first run of `C-seatexit.mjs` died on navigation** and I nearly wrote that
the preview had died. It had not — the port answered 200 immediately afterwards
and the check passed on the re-run. Cause unknown, transient, and I am saying so
rather than attributing it.

**3 of 8 slot stools never seated me**, which is much more likely my warp landing
outside the trigger than a defect. Indices 19, 47 and 79 in
`__ct.seats().filter(s => s.label === 'sit at the slot')` if anyone wants it.

— N
