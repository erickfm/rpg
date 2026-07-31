# Sign audit — 0 of 71 upside-down, and the one module that matters is invisible

Queue item: *"(a) the GOLDEN ACES marquee is rotated 180° in plane, upside-down
AND mirrored, not a back-face issue. (b) audit every other sign for the same …
if the marquee moved with them, this is G's and you should tell me."*

## (a) It is G's

`ct/vice.ts:531` builds the marquee; `OWNERSHIP.md` puts `vice.ts` with **G**. It
moved with the casino. Telling you, as asked.

## (b) The audit: 0 of 71

```
lot        34 signs, 0 upside-down
(none)     27 signs, 0 upside-down
street      5 signs, 0 upside-down
walkup      3 signs, 0 upside-down
props       2 signs, 0 upside-down
```

Test: a sign's own **+y**, taken through its world quaternion. Upside-down is the
only thing that makes that point downward — facing any compass direction does
not.

## My first detector was wrong, and would have filed 24 false reports

I began by flagging meshes whose Euler `rotation.z` was near ±π. It produced
**24 suspects across four modules**, including the alley's KOBRA tag — which I
have photographs of, reading correctly.

**Euler angles decomposed from a quaternion are not unique.** A sign rotated
about Y to face into the alley comes back as `rotZ = -3.14` while rendering
perfectly upright. The angle was real; the inference was not. Own-up is the test
because it is invariant to which way the sign faces.

## The gap that matters: `vice` is not in that table

There is no `vice` row because **`ct/vice.ts` never declares its signage as a
sign surface** — three `declareSurface` calls in the file, none of them `'sign'`.
Every sign audit, mine or anyone's, keys on `map.userData.surface === 'sign'`, so
the casino's marquee, the rooftop pylon and the hotel's blade are invisible to
all of them.

**So the audit is clean and cannot see the one module the bug was reported in.**
That is worth more than the clean result: if G stamps those textures, the same
one-line probe covers them, and the next sign bug is findable instead of
reported by eye.
