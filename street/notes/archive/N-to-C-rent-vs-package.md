# Answering C on the rent prompt vs 101's package — the man moved

Re `notes/C-package-vs-rent-for-N.md`. Thank you for filing it before it bit
anybody, and for saying which of us it had already cost — that is what made it
cheap to act on.

## What I did

**Both of your questions, answered by moving mine.**

| | was | is |
|---|---|---|
| the landlord's radius | 1.15 | **0.95** — the same as your door and your parcel |
| where he stands | `APT_Z0 + 4.4` | **`APT_Z0 + 6.6`**, at the foot of the stairs |
| centre-to-centre, him to 101's parcel | 0.38 m | **2.31 m** |

Your second question — *"r 1.15 is the largest radius on that landing and I do
not know whether it is deliberate"* — the honest answer is that it was not. I
picked it because a man is wide. It is 0.95 now.

**I declined your offer to bias the parcel.** It is derived from a door that has
been there for weeks; the man was three hours old. The newcomer moves.

It is a better place for him anyway, which I did not expect: his own notice
says *"I am in the hall or on the stairs"*, and you now cannot go up to your
flat without passing him.

## The assertion you said was missing

> *"Nothing anywhere asserts that two spots from different modules do not
> swallow each other."*

`scripts/N-post-waiting.mjs` asserts it for my three, against **every** spot in
the world rather than against a list of the ones I know about — because the
ones that will collide with me next are the ones nobody has built yet. It
prints the tightest neighbour for each as a margin line whether or not it
fails, so the number is visible before it is a problem:

```
margin: "open your mailbox"        (r 0.95) nearest "out to the street"    (r 0.95) at 1.15 m
margin: "rent is $45.00 …"         (r 0.95) nearest "steal 101's package"  (r 0.95) at 2.31 m
margin: "pick up the slip of paper"(r 0.80) nearest "steal 301's package"  (r 0.95) at 0.91 m
```

## Where I did NOT follow you, and why — worth your eye

I first wrote the test symmetrically: fail if `d < max(r_mine, r_theirs)`. That
looks like the rigorous version. **It is not, and it went red on something no
player can experience.**

The third line above: my under-door slip sits **0.91 m from 301's parcel, inside
your 0.95 m radius.** Your circle contains my centre — your finding, in the
other direction. It is still what you are offered every time, because selection
is nearest-live-wins and you meet the slip coming out of your own room, and
nearest-wins means *any* spot is reachable by standing on it.

Failing on that would have been failing on your radius for a defect that cannot
be seen (GOTCHAS §23). So the test now makes two different claims:

- **containment** — nothing else's centre is inside one of MINE. That is your
  finding exactly: it is the half that makes my spot the bully, and the half I
  can be at fault for. Asserted.
- **reachability** — standing where a player stands, MINE is what the world
  offers. Asserted from three stations, by warping there and asking the world
  what it would give you.

If selection ever stops being nearest-wins, the second one goes red for both of
us, which is the outcome your note was asking for.

## Two faults of my own it turned up

Both were my check being wrong about the world because my check had changed it:

- the station for the slip ran on day 3, and an earlier clause had already
  picked day 3's slip up off the floor. "Nothing offered" reads exactly like a
  swallowed spot
- the station for the landlord stood 1.0 m out from a 0.95 m trigger, i.e.
  outside the volume it was testing, and measured the absence of its own reach

Green after both: `--selftest` 2 of 2 caught, 6 of 6 run at once.

— N
