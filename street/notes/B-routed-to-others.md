# The weed tufts glow at night — MECHANISM FOUND, and one elimination withdrawn

For C, who owns `ct/weeds.ts`. It affects all three placements: my street five,
C's lot, E's park.

## First, a correction I owe you

I published "341 distinct materials, so the one-per-tone cache is not collapsing
them" as an elimination. **That was wrong, and it was the elimination that
mattered.** My probe stored `m.uuid.slice(0, 8)` and deduped by comparing it
against the full `m.uuid`, so nothing ever matched and every tuft counted as
unique. Measured properly:

```
439 tufts   2 distinct materials   mesh y 0.12 … 0.39   none above 1.0 m
```

The cache is doing exactly what its comment says: one material per tone for the
whole world.

## The mechanism

One material, registered ONCE. `dimWorld` in `ct/props.ts` takes that material's
elevation, its poolability and — since my fix a few rounds ago — its world point
from **whichever tuft it happened to traverse first**. Every other tuft then
wears the result.

That predicts exactly what I measured and could not explain: all five of my
street tufts identical at 0.5278 with nearest lamps of 0.9, 0.9, 0.9, 1.4 and
12.6 m. If the first-registered tuft sits inside a lamp pool — and many do, at
lamp feet and park lanterns — then the pool term is applied to all 439, in the
dark and in the light alike. The tint sits mid-range rather than at full daylight,
which is why no `poolLit` stamp appears: that is only stamped at `mul > 0.995`.

**A shared material cannot carry a per-position grade.** The cache is right for
draw calls and my pool model is right per material; they are simply incompatible,
and nothing in either file says so.

## The one-line fix, if you want it

Mark the tuft material `noLight`:

```ts
const m = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide });
m.userData.noLight = true;
```

`noLight` now means "takes no LAMPLIGHT", not "does not dim" — I corrected that
in `ct/props.ts` earlier, and the night floor still applies. A tuft would then
sit at ambient like the ground it grows out of: 0.045 at night against the walk's
0.045, instead of 0.528.

I have not made the change: it is your file, and setting it from my street
placement would silently change the lot and the park too, because the material is
shared with them.

## I tried the general fix in MY file instead. It costs too much.

Rather than wait on you, I tried fixing the class in `ct/props.ts`: a pre-pass
over the scene marking every material worn at positions more than 4 m apart, and
withholding the lamp term from those. It works — all five street tufts drop to
0.0450, exactly the walk's night value.

**It also flattens the main street's lamp pools, 13.7x to 1.0x.** Under a lamp
and mid-block both read 0.0450: no pooling at all. That is a CONFIRMED
user-facing feature — "light around the light posts to show up on the objects
and entities under the lights" — so I reverted it. I am not trading a confirmed
request for an unconfirmed improvement, and 82 materials share across distance,
so any threshold blunt enough to catch the tufts catches things that are lit
correctly today.

That is the argument for fixing it in `weeds.ts` rather than in the grade: one
line there costs nothing, and there is no threshold in my file that separates
"shared by design for draw calls" from "shared by accident".

## One thing to check AFTER you fix it

`scripts/glow.mjs` samples materials near a lamp against mid-block ones, and my
tufts sit at lamp feet, so **the tufts are currently part of its near-lamp
median** — the 0.5278 it reports under a lamp on the main street is the tuft
tint. The ratio was 13.7x before I placed them and reads 11.7x now.

When the tufts drop to 0.045 that median falls, and glow's main-street ratio will
move again. It has a 3x bar and plenty of headroom, but if it ever goes red just
after a weeds change, this is why — and the fix would be mine, not yours.

---


# Routed by B, still open — the three that are not mine to fix

`notes/BLOCKED-B.md` is deleted: I am not blocked, and a file called BLOCKED
saying "not blocked" is worse than no file. These three were live inside it and
are the only parts anyone else still needs. Everything else in it was my own
working record and is in the commit history.

## 1. The library forecourt patches → CLOSED, fixed by `ct/civic.ts`'s owner

Resolved in `b0b69cb48` ("The park quality pass: the field, the bench, the
shrubs, the forecourt"). Not with `plazaTex` — with their own texture, which is
the right call: it is their surface and their palette.

Measured before and after:

```
before   0 textured, 26 flat, 7 tones, two big flat slabs (3.6x4.1, 3.2x4.1)
after   16 textured, 12 flat, 4 tones, NO flat slab over 3 m2
```

The landing and the flight — the two the user was actually looking at — now carry
a 48 px map. Looked at it from the courtyard mouth: flagstone with legible joints
and tone variation, steps reading as steps, no flat translucent patches. **The
user's complaint is fixed.**

**One measurement handed over, not a complaint.** Those slabs work out at
12.4–13.8 px/m against the 32 px/m every other surface here derives from its real
metres, and `repeat.y` differs across faces of the same box — 0.13, 0.93 and 2.73
— so the joints do not line up face to face. On screen it reads fine, because the
flags are large enough that the joints stay legible, which is why this is a note
rather than a routed fix. If it ever wants tightening, `plazaTex(minX, maxX,
minZ, maxZ)` is still exported and sizes its canvas from real metres at 32 px/m
automatically.

## 2. `lamplight.mjs` and `parking.mjs` can exit 0 having asserted nothing

Still true, checked this round:

```
FAIL lamplight.mjs   exit 0 on --no-such-mode
FAIL parking.mjs     exit 0 on --no-such-mode
```

Still exactly these two, re-checked this round. `laneaudit.mjs` briefly appeared
on the list and was a FALSE POSITIVE of mine, not a fault of theirs: its `mode`
is a loop variable — `for (const mode of ['fixtures','all'])` — and it never
reads `process.argv`, so it cannot be handed a mode it does not know. The check
requires an argv-derived mode now and no longer flags it.

Hand either a mode it does not know and it matches no branch, falls off the end
of the file and exits 0 — a green row for a check that ran nothing. `truck.mjs`
was on this list and its owner has fixed it; these two are the remainder.

Two lines each, and the shared guard is already written:

```js
import { modes } from './lib/modes.mjs';
const mode = modes('lamplight', ['shots', 'probe', 'all']);
const mode = modes('parking',   ['dist', 'probe', 'shots', 'all'], 'probe');
```

`parking`'s default is `probe`, not `all`, so it needs the third argument or the
fix silently changes its no-argument behaviour. `scripts/no-silent-pass.mjs`
guards this and is red until both land — deliberately; `land.sh` does not gate on
`checks.mjs`, so it blocks nobody.

## 3. The ledger is materially behind the inbox → `AUDIT`, which owns "verify the ledger"

I found four user requests to B with no ledger row at all, added them, then
checked whether that was a B quirk. Counting inbox routings against ledger rows
per owner:

```
owner    inbox  ledger    gap
  F         18       8     10
  H         10       2      8
  D         12       7      5
  A          6       3      3
```

**An upper bound, not a list.** It compares line counts and one row can
legitimately cover several inbox lines — my own cups are two lines and one row.
So the claim is "materially behind for F, H, D and A", not a count of missing
requests.

Why it matters: an untracked request never appears in `ledger.sh`, which is the
command we are told to run before telling the user anything is finished. All four
of mine were already DONE, which is exactly why nobody noticed — nothing was
failing.

I have not touched anyone else's rows. Adding one asserts what the work is and
what state it is in, and I can only vouch for mine.
