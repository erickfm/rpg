# F verifying C's "bezel + stupid 90s ads" — bezel yes, ads PARTLY

    station:   the published `sit on the bed and watch TV` spot in room 301
    predicate: the set has a bezel, and the screen shows period ads

## Bezel: yes

Beige surround with a control panel and dials down the right-hand side, screen
recessed into it. It reads as a 1990s portable television rather than a glowing
rectangle, which is what the row asked for. `shots/f-verify-tvad0.png`.

Worth noting it replaced colour bars — when I verified the TV row earlier
tonight the set showed a test card, so this is a real change and an improvement.

## The ad: yes, and it is exactly the right register

    NO CREDIT — NO PROBLEM
    555-0199

Green screen, phone number, all caps. That is the joke the row is asking for.

## "LOTS of ads": I CANNOT SAY, AND I AM NOT GUESSING

I sampled three frames about 2.6 s apart and **the same ad was on screen for
all ~5 seconds**. That is not evidence of a fault: a real ad break runs 15–30 s
and my window was far too short to see a rotation. It is simply outside what I
measured.

So: **one ad confirmed, plural not confirmed.** The row says *"lots of stupid
looking ads"* and I have seen one.

**The predicate that would settle it**, and it is cheap: sample the screen
texture every 5 s for 60 s and count distinct ones. If the ads are drawn into a
canvas per ad, counting the declared ad textures at build time is even cheaper
and needs no waiting.

**Or — better, and it is the lesson from everything else tonight — tag them.**
`screen.userData.adCount = ADS.length` at build time turns "are there lots?"
from a question you have to sit and watch into one you can assert. Every check
that misled me tonight guessed at its subject; the ones that asked what a thing
declares itself to be never did.

C: no fault found. I am reporting the limit of my own sampling rather than
rounding one ad up to "lots".

---

# ADDENDUM — my 60-second sample measured the wrong mesh. Still unsettled.

I said the predicate was "sample the screen texture every 5 s for a minute and
count distinct ones", so I ran it. It returned **1 distinct texture over 60
seconds**, which would mean the ad never changes.

**I am not filing that**, because I checked what my selector actually caught
before reporting it. My filter — small mapped plane in room 301 — matched **ten
meshes**, and `traverse` leaves the variable holding the LAST one: a 0.55 × 0.55
plane at **y 7.83**, which is a different floor of the building. I sampled a
picture on someone else's wall for a minute and learned that it does not
animate.

Seventh instrument error of the session, same family as all the others: I
identified the subject by shape and got a confident number about the wrong
object.

## And the fix was already there, which is the annoying part

Every one of those ten meshes came back **`tagged: true`**. C has tagged them.
I had the correct method available, ignored it, and wrote a shape filter — the
exact thing I have spent the night telling other builders not to do, including
in the previous section of this very note.

## Where the row actually stands

- **bezel — verified.** Beige surround, control panel, dials, recessed screen.
- **one 90s ad — verified.** `NO CREDIT — NO PROBLEM / 555-0199`.
- **"lots of ads" — STILL UNSETTLED BY ME.** Two attempts, both measuring
  something other than the television.

The check that would settle it is one line and uses C's own tags: find the mesh
whose `userData` says it is the screen, sample *that*, count distinct textures
over a minute. I am out of room to do it properly and would rather hand over a
correct method than a third wrong number.

---

# SETTLED — 20 ads in the pool, and the screen is animating

Third attempt, and this one used C's tag instead of guessing at shape.

There is exactly **one mesh tagged `tv`** in the world. Sampled over 60 s:

    userData.tv = { seg: "crosstown auto", i: 0, left: 2.55, pool: 20 }
    distinct screen frames in 60 s: 601

**The tag answers the row by itself.** `pool: 20` is how many ads there are,
`seg` is the one playing, `i` is its index and `left` the seconds remaining on
it. That is "lots of stupid looking ads" stated as data, and it needed no
watching at all — I could have had it in one query at the start instead of
sampling twice and getting it wrong twice.

**601 distinct frames in 60 s** also settles something I had not asked: the
screen is not a slideshow of 20 stills, it is *animating* — roughly ten unique
frames a second. A 90s ad that moves.

## Verdict on the row: all three parts hold

- **bezel** — beige surround, control panel, dials, recessed screen
- **90s ads** — `NO CREDIT — NO PROBLEM / 555-0199`, and 19 more
- **"lots"** — 20 in the pool, cycling, animating

No reservations. **Station: sit on the bed in 301; predicate: `userData.tv.pool`
is greater than one and `seg` changes as you watch.**

## What this cost me, recorded because it is the lesson

Three attempts. The first sampled 5 seconds and proved nothing. The second
matched ten meshes by shape and measured a picture on another floor. The third
asked the world what the television was and got a complete answer immediately.

C tagged this object. The tag was there for all three attempts. **I wrote two
shape filters while the correct method sat in `userData`** — after spending the
night telling other builders to tag what they build and assert on the tag, and
after being caught by exactly this in four other forms.

Knowing the rule is not the same as reaching for it.
