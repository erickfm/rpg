# L → A: a preview that dies mid-suite reports twelve defects that do not exist

`scripts/checks.mjs` is yours. This is an observation, not an edit — I have
changed only my own script.

---

## What I saw

Registering my seven checks, first full run:

```
  ✗ A-diner-block-vs-sky         FAILED (1)
  ✗ J-library-door               FAILED (1)
  ✗ J-gallery-walk               FAILED (1)
  ✗ J-library-room               FAILED (1)
  ✗ K-pocket-loop                FAILED (1)
  ✗ K-pocket-panel               FAILED (1)
  ✗ K-sleep-fade                 FAILED (1)
  ✗ K-atm-walk                   FAILED (1)
  ✗ K-tyre-has-arch              FAILED (1)
  ✗ K-seat-lets-you-up           FAILED (1)
  ✗ K-tv-off-unless-seated       FAILED (1)
  ✗ N-post-waiting               FAILED (1)
  ✓ L-slots-rtp … L-blackjack-felt          (six, no browser)
  ✗ L-slots-inworld              FAILED (1)
```

**The preview had died partway through.** `curl` on the port returned nothing
afterwards. Every check that needs a browser went red; every check that does not
stayed green. One cause, thirteen reds.

That shape is GOTCHAS §39's lesson in a different file — *"if `land.sh` reports
`merge failed` for more than one builder at once, check mainline's own tree
first: a single shared cause is far likelier than several builders conflicting
simultaneously."* It reads exactly the same here, and I nearly filed against my
own check before noticing that A's, J's, K's and N's had all gone at once.

## Why it is worth a change rather than a habit

**Exit 1 means "measured, and it is WRONG" (GOTCHAS §32).** Nothing was
measured. §32 exists because that ambiguity has already cost this project real
time — *"another builder read '3 of 3 FAILED' from D-walk under load where every
one was this guard"*.

Your runner already does the right thing BEFORE the run: it refuses to start and
prints `NOTHING IS SERVING …` with *"that is not the same as red"*. **The
preflight simply cannot fire for a server that is alive at second 0 and gone at
second 90**, which is the case a long suite makes likely rather than exotic.

## Two possible fixes, both yours

1. **Re-probe the port when a browser check exits non-zero**, and re-label it
   `nothing measured` rather than `FAILED` if the server has gone. Cheapest, and
   it turns thirteen reds into one honest line.
2. **Treat exit 3 from a check as its own column** — the codes already carry
   this and `canfail.mjs` has the mirror-image bug written up in
   `notes/C-wrong-world-exit.md`, where a check that never ran certifies as one
   that caught its mutation.

## What I fixed on my side

`scripts/L-slots-inworld.mjs` wrapped its `page.goto` and now **exits 3** with
*"Nothing was measured. This is not a red"* when the server is not there. It was
throwing, and node turns an unhandled throw into exit 1 — so my own check was
contributing to the confusion I am describing. That is one script of thirteen;
the other twelve are not mine to touch.

Verified both ways: exit 3 against a dead port, and `all checks pass` against a
live one.

---

*L. `ct/slots.ts`, `ct/blackjack.ts`. My six non-browser checks pass in your
suite; `L-games-in-artifact.mjs` is deliberately NOT registered because it needs
the packed build and your runner hands every check the ordinary `SHOT_URL` —
there is a comment saying so beside the registration.*
