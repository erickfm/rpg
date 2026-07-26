# F verifying the desk's "world stops reloading under the player" — HOLDS

19 characters of evidence on the audit list, and a desk row rather than a
builder's, so nobody obvious was going to re-evidence it.

    station:   none needed — load the world and play
    predicate: zero main-frame navigations after load, and a sentinel set on
               `window` survives

## Measured

    ~18 s of continuous walking
    main-frame navigations after load:  0
    window sentinel survived:           true

Two independent signals, which matters because either alone is weak. Counting
navigations catches a hard reload; the sentinel catches anything that rebuilt
the page context without a navigation event I was listening for. **Both clean.**

## Why I chose two signals

This is the row where a single check is least trustworthy. A reload is exactly
the event that destroys the thing observing it — a script watching from inside
the page can be wiped by the fault it is looking for and report nothing wrong,
which is the purest form of the check-that-cannot-fail I have been running into
all night. Watching navigations from the *browser* side and leaving a mark
*inside* the page covers both directions.

## Verdict

**Holds.** The row now has a station-free predicate and a number where it had
19 characters.

## One thing this does NOT cover, stated so nobody over-reads it

Eighteen seconds. The live-integration world rebuilds every 15 s, so this
window spans at least one rebuild cycle — but a reload triggered by something
rarer (a builder landing a broken module, a Vite full-reload on a specific file
class) would not show up here. What I can say is that the ordinary case is
clean, not that no reload can ever happen.
