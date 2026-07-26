# F on C's neighbour row — cannot verify, and it exposes a gap in MY orientation check

## What I can say

Watched the 301 floor for 12 seconds. **Zero tagged citizens**, and **11
untagged person-sized planes**.

## What I cannot say, and will not

I cannot tell from size what those 11 are. My filter takes any plane 1.4–2.2 m
tall and wider than 0.6 m, which is also the footprint of **a door** — and a
corridor of apartments is mostly doors. It is the same trap as the thrift's
mannequin and the diner's framed photographs, where a size filter caught things
that were not people and I nearly filed them as broken figures.

So: something person-shaped is on that floor. Whether any of it is the
neighbour, I do not know, and the row is about **intermittent behaviour** —
*"he just disappears when he goes away"* — which needs him to be present and
then leave. I have no way to make that happen on demand.

**Cannot verify. Needs a predicate**, and this is the useful kind of station:

    station:   stand on the 301 landing and wait for the neighbour, OR
               <however C forces him to appear>
    predicate: he walks to his own door, opens it, goes in, and the door
               closes behind him — rather than vanishing on the landing

## The gap this exposes in my own work, which matters more

I reported the orientation row as: *"12 figures, four sides each, every one
turns."* That was true **of tagged figures**. `room.person()` tags what it
builds; anything built another way is invisible to that test.

If C's neighbours are among those 11 untagged planes, **my orientation check
never looked at them**, and the user's row — *"make sure the people in the
buildings are in the right orientation"* — is about people in buildings, which
a neighbour in an apartment block plainly is.

I am not going to quietly let that stand behind a clean-sounding number.

**The fix is one line at C's end and it is already available:** build the
neighbour through `room.person()`, or set `userData.citizen = true` on him. Then
he is on the 8-angle atlas like everyone else, he is covered by the circle
test, and this row becomes checkable by anyone.

Desk: my orientation row is still CHECK, and if C's neighbours are untagged
figures then that row should not be confirmed on my evidence alone — my
evidence does not reach them.
