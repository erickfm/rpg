# BLOCKED — F — I cannot tell a live queue item from a delivered one

Not blocked on code, a dependency, or another builder. Blocked on **knowing
what to build.** Six consecutive items off `queues/F-interiors.md` have turned
out to be already delivered, and I only discover that by spending most of a
pass verifying each one.

## The six, each checked by running the user's own test

1. **Tax `[E]` spot** — all ten entry spots sit exactly 0.75 m from their
   declared door and on the door's own axis. `doorStandFor`'s standoff; none
   hand-typed.
2. **Handedness** — burger, diner, tax and thrift all mirror correctly. See
   the correction in `F-doorside-tax.md`: I briefly reported tax as broken and
   it is not.
3. **Flip the authority** — already room → facade. Rooms populate `DECLS`,
   `publishDeclaredDoors()` pushes to the painter, the mirror lives once.
4. **Church steps and entry** — walked 2.73 m up, gy 0.14 → 0.55, and back
   down. `interiors-walk church` 25/25 in and out.
5. **Diner seating** — perpendicular continuous booth run; 8.65 m of clear
   aisle walked end to end; sat and stood in two booths without landing inside
   a table.
6. **Stuck protection** — `fp.ts:191` defines `unstick(dt)` and line 282 calls
   it every frame.

Verified in passing: ten rooms in the world (not seven), 151 seats with 151
matching sit prompts, park and car lot both registered, zero console errors.

## Why this is worth stopping on rather than pushing through

The standing rule is that a user request outranks verification work, always.
Right now the queue is routing me into *pure* verification: every item I take
turns into an exercise in proving finished work is finished. That is precisely
the over-rotation the rule was written to prevent, and it is happening because
the queue describes a world several days older than the one that is running.

It also carries real risk. On item 2 the stale framing led me to report the
tax office as broken and to name `int-tax.ts`'s `side: 1` as the cause. That
sign is correct — tax and the thrift are on opposite sides of the street — and
I only caught it because I measured the street geometry before asking builder
G to act. A stale queue plus a confident builder is how a working room gets
"fixed".

## What I need

**Re-cut `queues/F-interiors.md` against the world as it stands.** I do not
need it prioritised or explained, just made true.

If it is faster for the desk, invert it: tell me the user's most recent
unmet complaints in their own words and I will find the work myself. What I
cannot do is keep guessing which of the remaining items — the glob
generalisation, the 8-angle citizens in rooms, jump and gravity feel, deriving
door and window from the facade, re-anchoring the diner — are live.

## What I am doing meanwhile

Per the protocol I am not idling on this note. The bodega brief is finished to
the user's own grading standard, and the remaining known-unfinished work I own
is the one thing I flagged myself and did not resolve:

- the dark angular shape centre-left in `shots/f-bodega-counter2.png`. I
  dumped every mesh within 3.2 m and ruled out the keeper (his sprite is
  feet-anchored, so the `y = 0` in the dump is correct). Most likely the
  counter or register at close range. It is open, not fixed, and I will not
  write it up as anything else until I have proven which.

That is a real item in a room the user complained about, so it outranks
anything else I could invent.
