# ATM — evidence, not a fourth attempt

The desk: *"three have missed and each one changed something different, which
means nobody knows which variable is wrong."* Correct, and my own fault in a
specific way: I wrote *"looked at attempt three, and it holds"*, which is a
builder confirming its own work. The ledger's rule exists for exactly that.

**Nothing in the object was changed to produce this note.** Every number is
measured from the built world, not read from source constants.

## Photographs, at the player's real eye height

| shot | camera |
|---|---|
| `shots/atm-eye-front.png` | dead in front, 1.5 m out |
| `shots/atm-eye-left30.png` | 30° to the left, 1.5 m out |
| `shots/atm-eye-right30.png` | 30° to the right, 1.5 m out |

All three at eye **1.760 m world = 1.62 m above the pavement**, pitch −14.2°
(aimed at the fascia centre).

## Measured

```
wall face (facade plane)      x -7.000
pavement (KERB_H)             0.14 m

RECESS DEPTH                  0.170 m      wall face to back of niche
  deepest fascia point        0.150 m      behind the wall face
  nearest fascia point        0.010 m      behind the wall face

FASCIA WIDTH                  0.620 m
FASCIA HEIGHT                 0.680 m      top 1.580, bottom 0.900 above pavement
OPENING (the cut)             0.780 w x 0.860 h

RAKE screen                    8.1° up     normal (0.990, 0.141, 0)
  screen centre               1.370 m above pavement   (spans 1.16–1.58)
RAKE keypad                   33.7° up     normal (0.832, 0.555, 0)
  keypad centre               1.100 m above pavement   (spans 1.04–1.16)
RAKE apron                   −45.0°        the underside, running back to the wall

PLAYER EYE                    1.620 m above pavement
  above screen centre by      0.250 m   -> looks DOWN 9.5° at it from 1.5 m
  above keypad centre by      0.520 m   -> looks DOWN 19.1° at it from 1.5 m
```

## Against what was asked

| asked | measured | |
|---|---|---|
| recess "about 0.15 m deep" | **0.170 m** | ✓ |
| "a little larger than the machine" | opening 0.78 × 0.86 vs fascia 0.62 × 0.68 | ✓ 0.08 m reveal all round |
| "top edge sits further back than the bottom" | screen +8.1°, keypad +33.7° | ✓ both, normals out-and-up |
| "keypad closest to horizontal, screen closer to vertical" | 33.7° vs 8.1° | ✓ |
| screen centre "around 1.35 m" | **1.370 m** | ✓ |
| keypad "around 1.05–1.15 m" | **1.100 m** | ✓ |
| bottom of unit "near 0.9 m" | **0.900 m** | ✓ |
| fascia "roughly 0.6–0.7 m wide" | **0.620 m** | ✓ |
| fascia **"about 1.0 m tall"** | **0.680 m** | ✗ **32% short** |

## Two candidates, and I am not guessing between them

**1. THE FASCIA IS A THIRD TOO SHORT.** 0.68 m against the ~1.0 m asked for, and
it is the only dimension that misses. It is short because I pinned three heights
that were each given as a target — bottom 0.90, keypad 1.10, screen centre 1.37 —
and the height fell out of them as a remainder rather than being set. Taking the
bottom at 0.90 and the height at 1.0 puts the top at 1.90, which is *above* the
1.58 the screen currently reaches. So either the top rises and the screen sits
lower within a taller fascia, or the two figures were never meant to hold at
once. **That is a question for the user, not for me to split.**

**2. THE MACHINE IS THE SAME TONE AS THE WALL, so the hole cannot read.** This
may be the real reason "inlaid" keeps failing while the geometry is correct:

```
bank precast wall   #9a9ca0   ~156 / 255
ATM machine body    #8d949b   ~146 / 255
```

**Ten levels apart — a 4% difference.** The recess is genuinely 0.17 m deep and
the reveal is genuinely there, but a pale grey machine set into a pale grey wall
has almost nothing to separate it. A real cash machine is a *dark* object in a
pale wall. At 30° the jamb shadow does read (see `atm-eye-left30.png`); head-on
it does not, and head-on is where the user stands.

If that is the fault, it is a palette change, not a geometry change — which
would explain three geometry attempts failing to fix it.

## What I have not done

Not touched the object. Not guessed between the two. The row is REJECTED and
stays that way until someone who is not me says which variable is off.

*Correction inside this note's own making:* the first run reported the eye at
1.48 m because I read `__ct.pos()[1]`, which is the rig **body**. `__ct.camY()`
is the eye and is 14 cm higher. The shots and every number above use `camY`.
