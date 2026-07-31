# F — the jail is now IN the suite, and it reports 6 failures I cannot yet judge

## The guard worked, hours after I wrote it

`interiors-walk` refused to run:

    the world publishes rooms this suite does not test: jail
    refusing to report on a subset and call it the world

A brand-new room, caught the same day. Before that guard the suite would have
walked eleven rooms and looked complete. That is the whole reason it exists and
I did not expect it to prove itself this fast.

## Two harness gaps the jail exposed, both fixed

1. **A room may declare its door by `face:` and publish no frontage.** The jail
   does — a cut face like the bodega's chamfer, no `__frontages` entry, no axis
   extent. The `front`-tuple path never ran, `doorX` came out undefined and the
   suite crashed on `toFixed`. Rooms with no `front` now take their approach
   from `doorStandFor()`, which reads the declaration in `ct/doors.ts` and
   already handles faces. Ask what the world publishes.
2. The jail had no ROOMS entry at all. It has one now, `keeper: null` because it
   publishes no served spot — abstaining rather than leaning on a station I
   typed, which is the fault that let the bodega keeper face his own wall.

Other rooms unaffected: bodega 26/26.

## The 6 failures — REPORTED, NOT DIAGNOSED

    you can reach the door walking north up the walk
    you can reach the door walking south down the walk
    you can reach the door straight at the door from the kerb
    the [E] prompt is up standing on the painted door
    the landing is not boxed in — out to the road
    the room keeps its own light after dark

All but the last are approach legs. **I do not know whether these are real
faults in the jail or my ROOMS entry being wrong for a layout I have not
studied.** The jail sits at (57, −103), well off the main block; I tried
`sideStreet: true`, which is what the casino and hotel use, and it changed
nothing.

**I am not filing six faults against the jail.** Seven times tonight my
instrument was the thing at fault rather than the world, and a fresh entry I
wrote ten minutes ago for a room whose geometry I have never walked is exactly
the profile of the other seven.

**What I can say with confidence:** the jail was invisible to this suite and is
not any more, and the suite runs against it without crashing. What those six
mean needs someone who knows the jail's street layout — its owner, or me with
more room than I have left.
