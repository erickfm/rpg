# Queue item 4 — the fist on the watch wrist — is ALREADY DONE

Reporting rather than building, per the queues README: *"If your queue file
lists something already on mainline, say so plainly and move on — do not redo
it, and do not edit the queue yourself."*

`notes/queues/K-inventory.md` lists, as the last item under `## Now`:

> **The fist on the watch wrist** — transferred with `hud.ts`, still open.

**It is not open.** Three independent things say so:

1. **`scripts/live.sh K` does not list it.** The ledger is the authority on
   *whether*; the queue is only the desk's belief about it.
2. **`notes/LEDGER.md` carries it as CONFIRMED**, against D — *"'Screenshot from
   2026-07-25 20-47-52.png' i want to have a fist on the…"* — with H's
   verification recorded: watched idle, walk, run and jump from the west
   pavement at (−6, −20) looking down.
3. **The code is in the file I now own.** `ct/hud.ts`'s `drawWatch` has
   `g.fillRect(104, 0, 72, 72)` — one box, 72 px against the wrist's 66, butted
   at x 104 where the wrist ends, cut by the bottom of the frame the same way
   the wrist is, carrying the wrist's identical `rgba` shading values so it
   cannot read as a glove. Drawn before the strap and case so it can never
   overlap them. That is exactly the brief, which the user wrote himself and in
   which he said *minimal* twice.

**I re-checked it anyway**, because I have rewritten a great deal of `ct/hud.ts`
since inheriting it and a CONFIRMED row is not permanent (this file's own header
says so). Standing on the west pavement at (−6, −20) with the look held down:
the wrist runs off the left edge, the watch reads the world clock, and the fist
is the wider block butted to the strap's right. `shots/K/watch-fist.png`, taken
against the current build. **The row still holds; nothing I did disturbed it.**

## What IS unfinished in that area, and it is a different thing

`FEATURE-REQUESTS.md`'s "In progress" section describes the watch close-up as an
**incremental rebuild**, and `drawWatch` says so in a comment — *"STEP 1 of an
incremental rebuild (an all-at-once redraw was rejected). Only change so far:
the forearm runs OFF THE LEFT EDGE"*. Step 2 was the fist.

What has never been done is the **sleeve**. `ct/hud.ts` carries a `player`
outfit config with `sleeve: '#3f4a5c'` and `cuff: '#333c4a'` — the seam left for
a real wardrobe — and `drawWatch` **never reads either of them**: it hard-codes
`#c9946a` and the forearm is bare skin all the way off the frame.

That is a small, real, and separate piece of work. **I have not done it**,
because the queue does not ask for it, the ledger has no row for it, and this
project's whole history with that watch is of redraws that were not asked for
being reverted — the arm version and the fist+forearm version both went back.
**It wants a ruling, not an assumption.** If the desk wants it, one line in my
queue and it is twenty minutes.

— K
