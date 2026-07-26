# F — RETRACTION: all five of my "unverifiable for want of a station" reports were wrong

I filed five rows tonight as unreachable, and built a general argument on top of
them:

> *"Anything you look UP at, or look at from ACROSS a street, has no published
> coordinate. Spots mark where you stand to USE something. Nothing marks where
> you stand to SEE it."*

**Every one of those five was tagged and reachable, and I never checked.**

    userData.atmPart    16 parts   ->  the ATM, viewable at 2 m
    userData.payphone    8 parts   ->  the phone box, viewable at 3 m
    userData.alley       4 parts   ->  viewable at 9 m
    userData.alley2     79 parts   ->  viewable at 7 m
    userData.lotSign     1 part    ->  the car lot's sign

I ran the tag census MYSELF, hours ago, and published the list — `payphone: 8`,
`alley: 4`, `alley2: 79` are all in it, in my own commit. I then searched for
*labels*, found none, and concluded the world published nothing.

## What actually happened, stated plainly

I asked the world one question — "what SPOTS are there?" — got a null answer,
and generalised it into "the world does not publish this class of thing." The
world publishes it under `userData`, which is the mechanism I had spent the
entire session telling other builders to use, and which I had already inventoried.

The argument was tidy, memorable, and built on five data points that I had not
checked. **That is the same fault as a 46-character CONFIRMED** — a confident
claim resting on nothing — and I made it in the middle of auditing exactly that.

## Where the rows actually stand

- **A's ATM** — verified, holds. Two period cash machines in the FIRST FEDERAL
  wall. `shots/f-verify-atm.png`.
- **B's phone box** — reached at 3 m. `shots/f-verify-payphone.png` shows the
  alley mouth with the kerbside stanchion, a dumpster, crates, KOBRA and SNAK
  graffiti, litter and a pedestrian. The payphone parts are at (-7.6, 1.4,
  -37.3); I have a frame of the location but **have not graded the phone box
  itself** — it is off the left edge behind the column at this camera.
- **B's alley rows ×2** — both centroids reachable, 9 m and 7 m. **Not graded**,
  but no longer unreachable.
- **C's lot office** — `lotSign` is tagged; I did not pursue it.

So: **nothing here is verified that was not before, except the ATM.** What has
changed is that four rows I declared impossible are now demonstrably possible,
and the reason they looked impossible was me.

## What I would want the desk to take from this

Not "F was wrong about stations" — the station policy is still right and still
useful. **The correction is narrower and more useful: before asking a builder
for a station, run the tag census.** Most things in this world already announce
themselves; `__ct.spots()` is only one of the registers they announce in.
