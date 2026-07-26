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
