# What is worth pocketing — the proposed item list

Queue item 3. The desk asked for a **short** list of things in the world a
person would actually pocket, one line each on why, with the adoption **routed
to their owners rather than reached into their files**. I publish the call, they
add the line.

The call is one line and it is already in mainline's path:

```ts
import { takeable } from './inventory';
takeable(ctx, { obj: theThing, id: 'CUP' });      // that is the whole contract
```

The object disappears when it is taken and comes back where the player drops
it, its `[E]` follows it, and its trigger is its own position. `ct/props.ts`'s
newspapers are wired this way and **nothing in `props.ts` was edited to do it** —
so none of the six below is blocked on me.

---

## The six

| | item | owner | file | why this one |
|---|---|---|---|---|
| 1 | **folded newspaper** | B | `ct/props.ts` | **DONE** — adopted by tag, four of them. The user picked it himself out of a comparison rig: *"coffee cup is good, i like newspaper as well"*. |
| 2 | **coffee cup** | B | `ct/props.ts` | The other half of that same sentence. One in the world, under the Tony's Pizza bench — and a cup is the thing a person on a street is most often actually holding. |
| 3 | **leaflet** | G | `ct/int-hotel.ts` | The rack's own comment says *"leaflets nobody has taken"*. An object that is already described as untaken is a verb waiting to be attached; this is the cheapest character in the list. |
| 4 | **gig flyer** | C | `ct/apartment.ts` | *"a photocopied gig flyer, off a lamp post, on acid-green copy paper"* — it has a **date** on it, which is the only item here that could ever mean something later. |
| 5 | **library book** | J | `ct/int-library.ts` | The one item with a reason to **give it back**. Everything else here is yours the moment you have it; a borrowed book is the first object in this world that could carry a rule, and there is a librarian standing right there to carry it. |
| 6 | **what you buy at the bodega** | F | `ct/int-bodega.ts` | **Already works** — cereal and soda go into the same pockets. Nothing to do; listed because it is the proof the model was extended and not replaced. See the limit below. |

That is six, and the sixth is free. I would ship 2 and 3 first: both are one
line, both are objects the user has already looked at, and neither needs a new
drawing.

## What I am NOT proposing, and why

Restraint is most of the value of a short list, so these are named rather than
quietly omitted:

- **The milk crate** (3 in the world). It is the one piece of street litter that
  is not rubbish and you really would take one — but it is a crate, and *"it is
  pockets, not an RPG bag"* is a rule I would rather keep than bend on the
  first interesting exception. If crates ever become carryable it should be a
  different verb, held in your hands, not a pocket.
- **The fountain cup.** B tuned cup frequency down to exactly one of each after
  the user reported *"cups too common and too big"*. Making the rarest object on
  the block collectable would turn a fixed complaint into a scavenger hunt.
- **Flattened cardboard, chip bags, the 40oz.** Making every piece of litter
  takeable turns the street into a bin round. The list is short because the
  point is that a few things are worth having, not that everything is.

## Two limits worth the desk's eye

**A bought item cannot be dropped.** Only a thing that came off the ground has
an object in the world to put back; cereal bought over a counter never had one.
The panel now says so in its caption — *"nothing to put it back as"* — before
you press the key rather than after. That is honest, and it is also a small
asymmetry a player may notice. Closing it properly means each item having a
world model of its own to spawn, which is real work in four other people's
files, so I am recording it rather than starting it.

**Carrying is not yet DOING.** Today you can take, look at, and drop; cereal
additionally feeds the birds, which predates all of this. Every item above is
worth having on that basis alone — the wallet and the pockets are things to
look at, and this world is largely a thing to look at. But the moment somebody
wants a verb per item (read the newspaper, drink the soda, hand the book back),
that is a separate request and a bigger one, and it should be asked for rather
than assumed. **A list of items is not a list of verbs**, and I would rather the
desk chose which of the two the user actually asked for.

## If you are one of the five owners

Add the line, run `node scripts/K-pocket-loop.mjs` to see the pattern working on
the newspaper, and pick an `id` that reads in the wallet's narrow left leaf —
it prints the raw id, so `CUP` and `LEAFLET` fit and `LIBRARY_BOOK_HARDBACK`
does not. Declare it with `defineItem({ id, name, stack, blurb, icon })` from
your own file if you want it to say something when it is pocketed; skip that and
it still works, and shows as a wrapped parcel.

— K
