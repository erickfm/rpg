# Verifying "the people in the buildings are in the right orientation"

K, verifier, queue empty. Build `3379a583c`. **I have not changed the row's
status** — only the desk or the auditor may set CONFIRMED — and I am not filing
a rejection either. What follows is what I saw, what I could not see, and the
one line that would close this row permanently.

## Why a fourth reading was worth taking at all

Three people have measured this and got three answers, and the row itself names
the cause: *"the keeper needs to be identifiable … rather than leaving it to
whoever measures next to guess."* H decoded sectors, the auditor's finder took
*"the first atlas-framed figure in the room"* and photographed a diner customer,
E measured a billboard's quad normal and withdrew it. Every one of those is a
POPULATION or a FRAME problem, not a measurement problem.

So I guessed at nothing:

- **The station comes from the world** — the room's own service `[E]` (`buy`,
  `order`, `till`), which is where a customer demonstrably stands.
- **The keeper is found BEHAVIOURALLY.** An atlas figure is a billboard and
  turns to face you; a door does not. Read every candidate's yaw from one place,
  move, read it again — what turned is a person.
- **The verdict is a picture**, because "facing away" is a thing you see.

## First: B's coordinates on this row are STALE

`notes/LEDGER.md` sends the next reader to *"(441.50, 0.40) in the bodega,
facing the counter"* with the keeper at (442.35, −0.70). **Those are now inside
the BANK.** The bodega's buy spots are at **x 521.75** on this build; the room
has moved since B measured at `9be2fe407`. Standing at B's station puts you in a
different building, and the method B used was right — it is only the numbers it
produced that rotted (GOTCHAS §20, and §44 on measurements read as open faults).

## What I saw, from stations the game validates

| room | station | what the frame shows |
|---|---|---|
| **bodega** | `[E] buy cereal — $2.50` live | **FACING THE CUSTOMER.** Face, both eyes, nose, mouth, square on, behind the counter. `shots/K-keeper/bodega.png`, `bodega-close.png` |
| **burger** | `[E] order a barn burger — $1.89` live | **FACING THE CUSTOMER.** Cap, face, eyes, behind the counter under the menu boards. `burger.png` |
| **pawn** | nearest person, no service spot | face visible over the counter, looking out. `pawn.png` |
| **thrift** | `[E] buy a coat at the till — $4.00` live | **I COULD NOT SEE A PERSON AT ALL** — see below |

**The bodega is the room this row is actually about, and on this build the
reported fault is not in it.** That contradicts B's *"the keeper is showing his
BACK … dark hair filling the whole head silhouette, no face, no ear"* and the
auditor's *"profile … not dead away"* alike. Whether it was fixed after B
measured or whether B was standing in the bank, I cannot say from here — but
what a customer sees today is a man looking straight at them.

## The one thing worth someone's attention: the thrift keeper is not on screen

Three attempts, from the till and from four metres back, with
`[E] buy a coat at the till — $4.00` up the whole time: **no figure in any
frame.** `shots/K-keeper/thrift.png`, `thrift-back.png`.

The scene graph says otherwise. There is a person-sized billboard at
**(1242.20, −4.75)** that turns when I move, with the same signature as the
three keepers that do render:

```
              base      top     visible  opacity  floor
bodega       −0.119    1.781     true      1        0     renders
burger       −0.119    1.781     true      1        0     renders
pawn         −0.119    1.781     true      1        0     renders
thrift       −0.113    1.692     true      1        0     NOT SEEN
```

**I am filing this as a LIMIT, not as a fault**, because I cannot tell occlusion
from displacement without owning the room: the keeper sits 0.05 m outside the
declared inner depth, hard against a back wall carrying a full run of shelving,
so "standing inside the shelf unit" and "painted foot displaced" both fit. The
second is not hypothetical — the auditor found exactly it on the librarian
(*"11 figures whose painted foot is up to 1.903 m off the ground"*). Whoever
owns `ct/int-thrift.ts` should stand at the till and look.

## And the structural finding, which is the row's real answer

**Only 3 of 11 rooms publish a service `[E]`** — bodega, burger, thrift. For the
other eight there is no way to know who serves the room, and "the nearest
person" is not the same claim. My own diner frame proves it: the nearest turning
figure is a customer standing at a booth with their back to me
(`shots/K-keeper/diner.png`). That is the auditor's trap, reproduced exactly,
by a better instrument. **A better instrument does not fix a missing
declaration.**

So the row's own conclusion is right and I can put a number on it: this is
decidable in 3 rooms and undecidable in 8, and it will stay that way. **One line
where the keeper is placed — `keeper.userData.keeper = <room id>` — makes it
decidable in all eleven, forever, and stops the next person guessing.** It is
the same ask F already made about the tyres, and the same one C's door-face
check answered by asserting on `userData.plate`.

`node scripts/K-keeper-faces-you.mjs` — no exit-code verdict on purpose. It
gathers the stations and the portraits; the verdict is the pictures, because a
sector number is the thing three people have disagreed about.

**Three faults of my own, in case they save someone the round:** my first
keeper-finder tested the figure's base against the floor, which threw away every
real keeper and kept a shelf card — the quads do not share one origin
convention, which is the auditor's own lesson on this row. My second found the
tax office's keeper on the *pavement outside*, through the wall. My third
shadowed the room's width with the geometry's and rejected 11 of 11 in silence.
All three are the same shape as the failure this row is about.

— K
