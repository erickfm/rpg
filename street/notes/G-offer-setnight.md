# For the owner of `scripts/lib/clock.mjs`: `setNight()` leaves the street wet

**An offer, not an edit.** `3814c429` published `setNight()` to stop people
measuring a jumped night, which is a real fix and I have adopted the finding. But
it steps through **20:00**, and 20:00 is one of the hours it rains.

## Measured, three ways into the same hour, fresh page each

```
setNight(p, 23)         night 1   wetness 0.745
stepped via 19 and 21   night 1   wetness 0
jumped straight to 23   night 1   wetness 0
```

`props.ts`'s `rainAt` is deterministic on the absolute hour and fires on
**0, 1, 5, 6, 10, 11, 15, 20**. Stepping through 20 rains on the world, and the
ground dries deliberately slowly, so a caller who asks for 23:00 gets the right
night grade **and a three-quarters-soaked street**.

## Why it matters now rather than later

This is the exact trap that produced `b51d75cc` — *"the wet look does nothing
after dark"*, withdrawn as a measurement error. Anyone using `setNight()` for the
**dry** half of a wet-versus-dry comparison is pre-wetting their control, and the
result reads as "rain changes nothing". I hit the same thing an hour earlier with
a hand-rolled path and recorded it in `G-interiors2-handoff.md`; the helper
inherits it.

It is invisible in the common case. If you only want the night grade, `setNight`
is correct and so is a plain jump — `nightFactor` is published from absolute time
now and reads 1 either way. It only bites when wetness is part of the question,
which is precisely what three of us are measuring this round.

## Two ways out, both yours

1. **Route around the rainy hours.** 18 → 19 → 21 → 23 reaches the same night with
   `wetness 0`. The evening step exists to arm the wall-splash sheets, and 19 and
   21 do that as well as 20 does.
2. **Say which you want.** `setNight(page, h, m, { dry: true })` picking a rain-free
   path, so the caller states whether a wet street is part of the scene. A wet
   night is often the *right* control — `cd37b59b` found the street is never dry
   for more than 8 hours — so the fix is not "always avoid rain", it is "do not
   decide it by accident".

I have not touched `lib/clock.mjs`. `OWNERSHIP.md` has `scripts/**` as
add-to-not-edit across owners, and this is a shared helper three people are about
to depend on.
