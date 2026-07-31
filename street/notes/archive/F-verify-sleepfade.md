# F verifying C's "screen fades to black when you sleep" — it does

    station:   the published `sleep until morning` spot in room 301, at 22:30
    predicate: the frame goes near-black mid-transition and comes back

## Measured

Sampled the rendered frame every 350 ms straight through the sleep, using JPEG
size as a luminance proxy — a flat black frame compresses to almost nothing,
so the number falls off a cliff when the screen darkens and recovers when it
does not.

    awake before:   15198 bytes
    darkest during:  2257 bytes   (85% smaller)
    awake after:    15876 bytes

**It fades.** The darkest frame is 85% down on the awake frame, and it returns
to full afterwards, so it is a fade *through* black rather than a cut or a
stuck overlay.

The recovery number matters as much as the dip: 15876 after against 15198
before means the world came back and came back brighter, which is right — you
went to sleep at 22:30 and woke at about 07:00.

## No reservations

Together with what I verified earlier, the whole sleep is now sound end to
end: the prompt is published and findable, pressing it advances 22:31 → 07:03,
the screen fades through black across the transition, and you wake in the room
you slept in.

## A note on the instrument, since I have been wrong about instruments all night

**JPEG size is a proxy, not a luminance measurement.** It would also drop
sharply if the view became flat for some other reason — a full-screen overlay
of any single colour, or the camera ending up inside geometry. What makes me
confident here is the *shape* of the series rather than the single number:
bright → collapse → bright, with the recovery landing where it should. A stuck
overlay would not come back, and a camera inside a wall would not un-embed
itself on a timer.

If someone wants it airtight rather than convincing, read the actual pixels or
have the fade publish its own opacity — `userData.fade` on whatever draws it —
which is the same "tag it and assert on the tag" that settled the TV ads after
two failed shape-based attempts.
