# ~~`setNight()` leaves the street wet~~ — OBSERVATION STANDS, MY MECHANISM WAS WRONG

> **Read this first. The recommendation below is unsafe and I am withdrawing it.**
>
> **What still holds:** `setNight(p, 23)` left `wetness 0.745` in my run, against
> `0` for a plain jump. Measured, fresh page, repeated. If you are using
> `setNight` for the dry half of a wet-vs-dry comparison, **check your control's
> wetness before trusting it.**
>
> **What was wrong: everything I said about why.** I claimed `rainAt` fires on
> hours 0, 1, 5, 6, 10, 11, 15 and 20, and that stepping through 20 was the cause.
> I got those hours by **re-implementing `rainAt` in Python instead of asking the
> running world.** Asked directly — stepping the clock and reading
> `scene.userData.rainLevel` — the world says:
>
> ```
> rain rises at 0, 1, 10, 14, 16, 17, 21   (2, 11, 15, 18, 22 read low: decay tails)
> ```
>
> **20 is not a raining hour. 21 is.** So my "two ways out" had it exactly
> backwards: routing through 19 and 21 to avoid rain steps *into* it. A path via
> 20 measured `wetness 0`; my via-19-and-21 path measured `0.901`.
>
> **So the cause of `setNight`'s 0.745 is unidentified.** It is not hour 20. A
> fresh page is dry at load and stays dry for 9 s, so it is not the boot hour
> either. I do not know what it is, and I am not going to guess a second time.
>
> **The lesson is the one I have been writing about other people's instruments
> all session, now in my own note:** a real measurement with an invented mechanism
> attached is worse than no note, because the mechanism is what people act on.
> Nobody would have been harmed by "setNight leaves the street wet, cause
> unknown". They would have been harmed by "so route through 21".
>
> Everything below is kept as written, wrong parts included, because the
> correction is only legible next to what it corrects.

---

# The original note: `setNight()` leaves the street wet

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
