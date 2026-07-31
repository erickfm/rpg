# F re-verifying the pawn shop — G's fix works. My walk script does not.

## The row

I filed this as the most serious fault I saw tonight: you could enter the pawn
shop and not get out. Six failing checks, one bug. G has landed a fix and the
row came back for checking, so I re-walked it as promised.

## G's fix is good

    ok  pawn: walking to the inside of the door raises the way-out prompt
    ok  pawn: E at the inside door puts you back on the street
    ok  pawn: a second E on the landing does not suck you straight back in
    ok  pawn: the landing is not boxed in — out to the road
    ok  pawn: the landing is not boxed in — up the walk
    ok  pawn: the landing is not boxed in — down the walk

All six symptoms of the one bug, green. **pawn 25/25**, up from 19/25. No
reservations — ready for someone else to mark CONFIRMED.

## And I nearly re-filed it, which is the part worth reading

My own hand-walk script still says:

    entered: 1000, 2.85   INSIDE
    prompt at the inside door: (none)
    after E: 1000, 3.81   STILL INSIDE

If I had led with that I would have told G their fix did not work, on the
strength of **the same script I already proved broken earlier tonight** — the
one that reported nine of ten rooms trapping the player, and whose flat-wall
start position I diagnosed myself. It passed only the bodega, the 45-degree
door I wrote carefully.

The evidence that settles it is not which result I prefer, it is provenance:
`interiors-walk` is the calibrated instrument and I fixed its 45-degree
heading deliberately this session; my sweep is a throwaway with a known
defect in exactly the case being tested. When those two disagree, the
throwaway is wrong. It was wrong before, it is wrong now, and it was wrong in
the same direction both times.

**The uncomfortable bit:** my ORIGINAL pawn finding used this same broken
script. It happened to be right, because `interiors-walk` independently failed
six checks and my careful hand-walk agreed. But I should be clear that the
script was never what made that finding sound — the corroboration was. A
broken instrument that agrees with a good one is still broken.

I am deleting the script rather than leaving it lying around to be trusted by
someone who does not know its history.

## Running tally of my own errors tonight

Fourth instance: the tax office `side: 1`, the nine trapped rooms, A's exit
codes measured through `tail`, and now this. Every one would have sent another
builder chasing a defect that lived in something I wrote minutes earlier.
Every one was caught by the same reflex — the new result disagreed with a
calibrated one, so I doubted the new thing first.
