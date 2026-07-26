# Walked the failure, not the prompt — and the world has moved under it

**The escape hatch shipped first and alone**, as the desk asked, before any of
this. `fp.ts` now listens for Escape **itself, in the capture phase, at
construction**, and sets one boolean the update loop honours. It does not go
through `input.keys`, so it survives the thing that would kill everything else.

## What I could and could not reproduce

The desk named **commit dd35b833e** on port 5177. The live world has rebuilt
since: its stamp reads **e7c71873a**. So the build he was stuck on is gone and
I cannot get at it. Said plainly rather than reported as "fixed".

On 5177 **as it stands now**, walking the failure rather than the prompt —
sit, then move, look, jump, E, Escape:

```
  after E (sat)   seated=true
    move W        seated=true   moved=false      (correct: a seat blocks movement by design)
    jump          seated=true   moved=false      (correct)
    E             seated=false  moved=true       HE GETS UP
    Escape        seated=false  moved=true       HE GETS UP
```

And the sequence I thought most likely to trap him — **sleep (which raises a
fade and calls `blockInput`) and then sit to watch** — also comes back clean:

```
  slept, fade rose and cleared      seated=false  fade 0.00
  sat to watch                      seated=true
  E                                 seated=false
```

## On the desk's correction, honestly

The correction is right that *"anything I do"* rules out a proximity contest,
and right that a prompt can be drawn by a live code path while the input path
is dead. One thing to correct back, because it changes what is still unknown:
**my 45-of-45 test measured the ACTION as well as the prompt** — it pressed E
and read `__ct.seated()` afterwards, and he stood up every time. So the prompt
was not the only thing measured.

## The one mechanism that kills EVERYTHING at once, and it is real

`ct/hud.ts:175` — `swallow` uses `stopImmediatePropagation()` on **window, in
the capture phase**, for `keydown`, `mousedown`, `mousemove` and `wheel`. While
that gate is up, nothing downstream sees any input at all: not E, not Escape,
not movement. That is the only thing I have found in this world that matches
*"ANYTHING i do"*.

It is raised by **panels** and by **`screenFade`**. Panels are covered — `gate`
forces Escape to close any panel. **A fade is not**: if one is raised and never
resolves, input stays dead with no key that can recover it.

**And it reproduces today, on a casino slot stool** (`notes/C-modal-traps-URGENT.md`):
sitting opens `#ct-panelback`, and with it up neither E nor Escape reaches the
world — verified with held keys, not taps.

## What is left, and whose

- **Mine, done:** the seat exit is a state exit (no selection), `standLabel`,
  and the capture-phase escape hatch. `scripts/C-seatexit.mjs` and the other
  agent's `scripts/seatexit.mjs` are both green.
- **Not mine:** the `blockInput` gate having no recovery path when a fade does
  not resolve, and the slots panel swallowing E and Escape. Both are
  `ct/hud.ts` and the panel owner's.

If he gets stuck again, the first thing to ask for is a screenshot of whether
the screen is **black** (a fade left up) or **normal** (a panel or something
else). Those two point at different files and I could not tell them apart from
the report.
