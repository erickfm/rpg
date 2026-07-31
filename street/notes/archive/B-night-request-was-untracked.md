# The night request was done and nobody could tell

Queue item 1 is "your own findings, ranked by the desk", and item 2 is a
refactor. Neither is a user request in the user's own words, so under the desk
directive I went looking for one that is. There was one, routed to **B**, sitting
in FEATURE-REQUESTS with **no ledger row of any kind**:

> *"make street light a bit more broad in their emitted light (like a wider beam)
> and make the unilluminated stuff darker. it should feel scarier at night i want
> to be able to see stars sometimes"*

All three parts are already built in `ct/props.ts`. The work was done; the
tracking never happened, so `ledger.sh` — the command we are told to run before
telling the user anything is finished — showed nothing. Walked all three on
build 98042722a and filed the row as LANDED.

| part | what is there | evidence |
|---|---|---|
| wider beam | `LAMP_R` 7.0, full-strength core to 1.8 m | pools still fall 2.4 m short of each other at 16.4 m head spacing — wider, not continuous |
| darker unlit | per-surface night floors | 0.5278 under a head vs **0.0450** mid-block, 11.7x (side street 12.6x) |
| stars | dome present, player-anchored, no parallax | `shots/night-stars.png` |

**"Sometimes" is honoured literally, and that is the nicest part.** Stars are
gated on the weather rather than faded by it — `clear = max(0, 1 - rainLevel*2.4)`
— so cloud means no stars, not dimmer ones. I watched it rather than reading it:
at a rainy night hour, outdoors, rainLevel **0.942** → dome `visible: false`,
opacity 0.0038.

I nearly filed the opposite. My first measurement said the dome was *visible at
0.72 opacity in a storm*, because I sampled before warping and the spawn is room
301 at x 198.6 — indoors, where rain is cut to zero. That is the same trap that
nearly had me report "rain is broken" several rounds ago, and it caught me again
in a new costume. **Warp outdoors before asking the weather anything.**

## One queued item should be dropped rather than done

The desk ranked my own finding **"lamp spacing leaves the middle of the block
dark — worth fixing, the user has asked about night four times"** as the second
item in my queue.

**The user is asking for the opposite.** Their words are "make the unilluminated
stuff darker… it should feel scarier at night". The dark middle of the block is
the feature. `LAMP_R` is deliberately held at 7 m for exactly this reason, and
the comment in `props.ts` says so: past 8 m "the street becomes continuously lit,
which is the opposite of what was asked for".

So that finding is not a defect and I have not fixed it. It is the only item in
my queue I have declined outright, and this is the reason. The desk should strike
it — otherwise the next builder to pick it up will brighten the street and undo a
request the user made in their own words.

## Also cleared from queue item 1 while I was in there

- **C, "the bus stop frontage should be red kerb and is not"** — done. It is
  RULE 3 in `ct/tex-ground.ts`, `STOP_CLEAR = 9.0` either side of the flag at
  z −33.5, sized off the 42's 9.1 m so a bus can pull in parallel.
- **E, "tree pits overhang the kerb chamfer by ~6 cm"** — done, and asserted on
  every run: `footprint` reports the walk between chamfer and pit edge at
  **0.117 m** at every pit, identical at all seven.

That leaves only **D, "parking varies but never re-rolls"**, which the desk
itself ranks lowest and calls cosmetic, and the `[E]`-spot refactor.
