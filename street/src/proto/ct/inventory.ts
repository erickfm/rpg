import * as THREE from 'three';
import { BUILD, type CtxBuild, type Spot } from './ctx';
import {
  hudNote, makePanel, onPurseChange, registerHeldObject, setPocketInfo, UI,
  type Panel, type Purse,
} from './hud';
// `ct/wardrobe.ts` imports NOTHING, which is why this is safe to reach for from
// the store — see the leaf-module note at the top of that file.
import { bagWorn } from './wardrobe';

// ── POCKETS ───────────────────────────────────────────────────────────────
//
// The player's inventory. *"ok i want the player to have an inventory"*.
//
// This is NOT a second model. `ct/hud.ts` has held the pockets since the wallet
// shipped — `interface Purse { cash, inv }`, with the bifold as *"a view onto
// this, nothing more"* — and everything here reads and writes that same object.
// The bodega already puts what you buy into it. What was missing was everything
// around it: a way to take something OFF THE STREET, a table of what a thing
// IS, a limit, and an answer to "what happens when you are full".
//
// Three rules the desk set before any of this was written, and they are load
// bearing rather than decoration:
//
//   1. THE VERB GOES THROUGH `ctx.spot()`. A module offers a takeable the same
//      way it offers a seat or a door — one line, in its own file. Nothing here
//      needs an edit to `crosstown.ts`, and no owner has to ask the desk to
//      make their own object pocketable.
//   2. IT IS POCKETS, NOT AN RPG BAG. Six slots, no weight, no crafting, no
//      sorting. This is a 1997 street.
//   3. TAKING SOMETHING CHANGES THE WORLD. The object leaves the ground when it
//      goes in your pocket and comes back when you drop it. A pickup that
//      leaves a ghost behind is worse than no pickup.
//
// Nothing in this file draws anything at build time and nothing draws from
// `rnd()`, so adding it moves no tree and no pigeon (GOTCHAS §2). Taking and
// dropping MOVE an object that already exists; they never create one.

export const ORDER = BUILD.PROPS + 5;   // after ct/props.ts has laid its litter

// ── what a thing IS ───────────────────────────────────────────────────────

export interface ItemDef {
  /** the key in `Purse.inv`. SHORT and upper case — the wallet prints it raw. */
  id: string;
  /** how a prompt says it: "take the folded newspaper". Lower case, no article. */
  name: string;
  /** how many fit in one pocket. Bulky things get 1–2, small things 4. */
  stack: number;
  /** one line you get when you pocket it. The character lives here. */
  blurb: string;
  /**
   * WHAT "USE" MEANS FOR THIS THING, if it means anything.
   *
   * *"on click on item i want options for it … options could be like drop,
   *  use, etc"*   (2026-08-05)
   *
   * **NOTHING DECLARES ONE YET, AND THAT IS DELIBERATE.** The bag offers only
   * the verbs an item actually supports, so a pack of tube socks shows DROP and
   * EXAMINE and no third button that does nothing — a dead option is worse than
   * a missing one, because it teaches the player the menu lies.
   *
   * The field is here so that a use is ONE LINE at the item's own declaration
   * rather than a switch somewhere else that has to know about every id. What
   * it still needs before anything can declare one: most real uses touch the
   * WORLD (eat the cereal and your hunger moves, feed the birds and the birds
   * react, play the tape and the TV changes), and an `ItemDef` is built at
   * module scope with no `ctx` in reach. So the caller passes what the act
   * needs, or the act is registered later by whoever owns that system —
   * `ct/int-bodega.ts` for food, `ct/props.ts` for the birds. That is the piece
   * that is not built, and it is a real one.
   */
  use?: {
    verb: string;
    /**
     * Do the thing. Return an id to REPLACE this item with, or nothing to
     * consume it outright — "using a thing may turn it into another thing" is
     * the general shape, and the parcel is its first tenant.
     */
    act: (p: Purse) => string | void;
  };
  /**
   * Paint the thing, in a 24 × 24 box with the origin at its top left.
   *
   * Optional, and the fallback is a plain wrapped parcel rather than a guess at
   * what an unknown id might look like — an honest generic beats a confident
   * wrong picture, which is the same argument `ctx.Spot.obj` makes about the
   * selection outline drawing a dumb box when nobody said what the spot is
   * about.
   */
  icon?: (g: CanvasRenderingContext2D) => void;
  /**
   * ══ THE THING ITSELF, IN THE WORLD ═══════════════════════════════════════
   *
   * *"when i said add depth to the item i didnt mean add depth to the sprite. i
   *  meant lets make sure theres a real world item for these items so when we
   *  drop them in the world they exist in it as they would."*  (2026-08-05)
   *
   * ⚠ I BUILT THE WRONG THING AND HIS CORRECTION IS EXACT. `472096eb` gave a
   * dropped item a `thick` and extruded its ICON into a slab — the sprite with
   * depth, which is precisely what he says he did not ask for. Two letters on a
   * hallway floor read as two printed tiles standing on edge.
   *
   * SO AN ITEM MAY DECLARE A REAL OBJECT: a few flat-shaded boxes at REAL SIZE
   * in the world's own idiom. A folded newspaper is 30 cm long, a soda can is
   * 66 mm across and 115 tall, a VHS is a 188 x 104 x 25 slab. A BUILDER rather
   * than a mesh, so every drop gets its own instance and nothing is shared into
   * a scene it can be taken out of again.
   *
   * IT SAMPLES THE ICON'S OWN PALETTE, which is what stops the sprite in his bag
   * and the object on his floor being two different objects. The icons were
   * already built from "the PALETTE OF THE THING IT IS"; these take the same
   * hexes.
   *
   * OPTIONAL, AND THE FALLBACK IS HONEST: an item with no model still drops as
   * the textured box, so a new item works before anybody models it. `thick` is
   * kept for exactly that path.
   */
  model?: () => THREE.Object3D;
  /**
   * ── TOO BIG TO POCKET ────────────────────────────────────────────────────
   *
   * *"dont like that i can take the toaster through all the floors of the apt"*
   *   (2026-08-05)
   *
   * HE SAID IT THE MOMENT THE THINGS BECAME REAL OBJECTS, and that is not a
   * coincidence. While a toaster was a 16 cm printed tile it could go in a bag
   * without anyone minding; the model above is 28 x 17 x 16 cm of chrome, and
   * carrying it up three flights inside a shoulder bag is the kind of thing you
   * only notice once you can see it.
   *
   * A BULKY ITEM IS CARRIED, NOT STOWED. It takes the HANDS — `HAND_SLOTS`, the
   * one-slot inventory he specified himself (*"if you have no bag you hold one
   * thing in your right hand"*) — so you may have exactly one at a time and a
   * bag does not help. He can still take the toaster; he has to carry it, and
   * he cannot take anything else while he does.
   *
   * ⚠ USING HIS OWN RULE RATHER THAN INVENTING A WEIGHT SYSTEM. There is no
   * encumbrance model here and there should not be one: one number on one item,
   * and the hands slot already existed for exactly this shape of thing.
   */
  bulky?: boolean;
  /**
   * HOW THICK IT IS ON THE FLOOR, in metres.
   *
   * *"items dropped sometimes have no height and so they look graphically
   *  weird on the ground. pls give height. no collision needed"*  (2026-08-05)
   *
   * A dropped thing used to be a 0.16 m PLANE lying flat, and he is right about
   * what that looks like: seen at a grazing angle it thins to a line and then
   * to a decal painted on the carpet. It is a box now, and this is its depth.
   *
   * IT VARIES BY ITEM, because "give it height" and "make everything a cube"
   * are different instructions. A chequebook is 20 mm and a cereal box is 110,
   * and one number for both would make the flat things look wrong in the other
   * direction. The default is a middling 0.05 — an unknown id still gets a
   * solid, and the same argument the `icon` fallback makes: an honest generic
   * beats a confident wrong picture.
   *
   * ⚠ VISUAL ONLY. He said "no collision needed" and there is none — no
   * collider, no `maxY`, nothing standable. Dropping something on the floor
   * must not build a step.
   */
  thick?: number;
}

const ITEMS = new Map<string, ItemDef>();

/** Declare an item. Any module may — you do not need this file to own yours. */
export function defineItem(d: ItemDef): ItemDef {
  ITEMS.set(d.id, d);
  return d;
}

/**
 * What is `id`?
 *
 * Never null. An id nobody has declared still has to be carryable and still has
 * to be printable, because `Purse.inv` predates this table and other modules
 * write to it directly — so an unknown id gets a plain, honest entry rather
 * than a crash or a blank. GOTCHAS §34 in miniature: the fallback is what stops
 * "the panel showed nothing" being indistinguishable from "you have nothing".
 */
export function itemOf(id: string): ItemDef {
  const d = ITEMS.get(id);
  if (d) return d;
  return { id, name: id.toLowerCase(), stack: 4, blurb: '', icon: PARCEL };
}

// ── the icons ─────────────────────────────────────────────────────────────
//
// Painted at 24 × 24 and shown at 2× in the panel, so ~12 px of real drawing
// per thing. That is the same order as the world's own ~8 px/m and it is
// deliberate: an icon set at a finer density than the street would read as
// having come from a different game. One silhouette, two or three tones, no
// dither — a 24 px square is exactly the surface GOTCHAS §4 says cannot hold
// fine detail, one level down.
//
// Every one of them is drawn from the PALETTE OF THE THING IT IS, not from an
// icon palette: the newspaper takes ct/props.ts's own newsprint greys so the
// picture of it matches the object you just picked up off the pavement.
// ── THE MODEL KIT ──────────────────────────────────────────────────────────
//
// Three helpers and nothing else. Flat `MeshBasicMaterial`, because this world
// is unlit by construction and a shaded material here would be the only lit
// thing in the room. Every part is positioned about the object's OWN BASE, so
// `dropLoose` can sit it on the floor without knowing what it is.
const mBox = (w: number, h: number, d: number, c: string,
              x = 0, y = 0, z = 0, ry = 0): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ color: c }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
};
// 10 sides: the count the ceiling rose uses, which is what makes a cylinder in
// this world read as faceted rather than as something imported.
const mCyl = (r: number, h: number, c: string): THREE.Mesh => new THREE.Mesh(
  new THREE.CylinderGeometry(r, r, h, 10),
  new THREE.MeshBasicMaterial({ color: c }),
);
const mOf = (...parts: THREE.Object3D[]): THREE.Group => {
  const g = new THREE.Group();
  for (const p of parts) g.add(p);
  return g;
};

const box = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

// The things that exist today. Deliberately few — the desk's instruction was
// *"propose the item list — do not invent twenty"*, and a table of things you
// cannot actually obtain is worse than a short one.
defineItem({
  id: 'NEWSPAPER', name: 'folded newspaper', stack: 2,
  thick: 0.035,   // folded, and somebody has stood on it
  blurb: 'yesterday’s, and somebody has stood on it.',
  // ct/props.ts's own newsprint: #9d9483 weathered, #3a352d masthead ink
  icon: (g) => {
    box(g, '#9d9483', 3, 5, 18, 15);
    box(g, '#3a352d', 5, 7, 12, 3);                    // masthead
    for (let y = 12; y < 19; y += 2) { box(g, '#6a6459', 5, y, 6, 1); box(g, '#6a6459', 13, y, 5, 1); }
    box(g, '#544e44', 3, 13, 18, 1);                   // the fold, its darkest line
    box(g, '#7d7668', 3, 5, 18, 1);
  },
  // A FOLDED TABLOID, 30 x 22, face up with the fold standing proud along its
  // spine. Newsprint greys off its own icon.
  model: () => mOf(
    mBox(0.30, 0.022, 0.22, '#9d9483', 0, 0.011, 0),
    mBox(0.30, 0.010, 0.030, '#7d7668', 0, 0.027, -0.095),
    mBox(0.20, 0.002, 0.055, '#3a352d', -0.02, 0.023, -0.045),
  ),
});
// Already purchasable at the bodega counter (ct/int-bodega.ts) and already in
// the starting purse, so these two are declared rather than introduced.
defineItem({
  id: 'CEREAL', name: 'box of cereal', stack: 4, blurb: 'the birds prefer it to you.',
  thick: 0.11,   // a carton, the tallest thing in the table
  icon: (g) => {
    box(g, '#c8862e', 5, 3, 14, 19);                   // the carton, stood up
    box(g, '#e0a94a', 5, 3, 14, 2);
    box(g, '#f0e6cc', 7, 7, 10, 6);                    // the label panel
    box(g, '#8a5a1e', 8, 9, 8, 1); box(g, '#8a5a1e', 8, 11, 6, 1);
    box(g, '#a8681f', 7, 16, 10, 3);
  },
  // A CARTON ON ITS SIDE, which is how a box lands: 28 long, 19 on its face,
  // 7 deep — a real cereal box, fallen.
  model: () => mOf(
    mBox(0.28, 0.19, 0.07, '#c8862e', 0, 0.095, 0),
    mBox(0.28, 0.19, 0.002, '#e0a94a', 0, 0.095, 0.036),
    mBox(0.17, 0.055, 0.004, '#8a5a1e', -0.03, 0.125, 0.038),
    mBox(0.28, 0.030, 0.072, '#a8681f', 0, 0.176, 0),
  ),
});
defineItem({
  id: 'SODA', name: 'can of soda', stack: 4, blurb: 'warm. It has been on that shelf a while.',
  thick: 0.09,   // a can on its side is a 66 mm cylinder; 90 upright
  icon: (g) => {
    box(g, '#b9bcc2', 8, 4, 9, 17);                    // aluminium
    box(g, '#8f9298', 8, 4, 2, 17);                    // the shaded side
    box(g, '#d0d3d8', 8, 3, 9, 2);                     // the lid
    box(g, '#b03a2e', 8, 9, 9, 6);                     // the band
    box(g, '#e8e2d0', 10, 11, 5, 2);
  },
  // A CAN ON ITS SIDE — 66 across, 115 long — because a dropped can does not
  // stand up. The label is a second cylinder a hair proud of the shell.
  model: () => {
    const c = mCyl(0.033, 0.115, '#b9bcc2'); c.rotation.z = Math.PI / 2; c.position.y = 0.033;
    const l = mCyl(0.0335, 0.062, '#b03a2e'); l.rotation.z = Math.PI / 2; l.position.y = 0.033;
    return mOf(c, l);
  },
});

/**
 * What an item nobody has declared looks like: a small parcel, still wrapped.
 *
 * Honest rather than clever. `Purse.inv` is written directly by modules that
 * predate this table, so an unknown id is a normal thing to meet and not an
 * error — and a generic that is obviously generic beats a confident guess, the
 * same argument `ct/ctx.ts` makes about a `Spot` with no `obj` drawing a plain
 * box instead of "the largest plausible mesh near these coordinates".
 */
const PARCEL = (g: CanvasRenderingContext2D) => {
  box(g, '#a8916c', 4, 6, 16, 13);
  box(g, '#c0a880', 4, 6, 16, 2);
  box(g, '#6a5a3c', 11, 6, 2, 13);                     // the string, both ways
  box(g, '#6a5a3c', 4, 11, 16, 2);
};

// ── what is in a stolen package ───────────────────────────────────────────
//
// The second consumer of this model, and it arrived while the model was still
// being written, which is the best time for a consumer to arrive: builder C is
// putting packages on the walk-up landings, and *"if you steal you get a random
// item and then it goes in your inventory"*.
//
// So the roll needs a TABLE and not a hardcoded newspaper — the whole point of
// a stolen package is that you do not know what is in it. 1997 mail order: a
// videotape, a pair of trainers, a small appliance, and the disappointment,
// which is the joke and is worth more entries than the prizes.
/**
 * ── THE PARCEL YOU STOLE, UNOPENED ─────────────────────────────────────────
 *
 * *"when i steal a package i want a package in my bag … i want to be able to
 *  open the package and it becomes the item at random in that moment"*
 *
 * **THE RANDOMNESS MOVES FROM STEALING TO OPENING, AND THAT IS THE POINT.**
 * Taking a parcel used to roll its contents on the spot, so the theft and the
 * reveal were one event and there was nothing to decide. Carrying a sealed box
 * makes it a decision: open it now, keep it, or fence it unopened and never
 * know.
 *
 * IT IS A FRESH ROLL, NOT THE DOOR'S SEEDED ONE, deliberately.
 * `ct/apartment.ts`'s `pkgRoll` is seeded on (door, day) so a parcel's SIZE and
 * which side of the mat it lies on stay put while you walk past — a thing you
 * can SEE has to stop changing. Contents are not a thing you can see, and his
 * words are *"at random in that moment"*: the surprise is the opening. A seeded
 * roll would also make two parcels from one door on one day hold the same
 * thing, which reads as a bug rather than as fate.
 *
 * ITS `use` NEEDS NO `ctx`, WHICH IS WHY IT IS DECLARED INLINE — and that is
 * the pattern. The obstacle flagged when the field was added (an `ItemDef` is
 * built at module scope with nothing from the world in reach) does not bite for
 * a verb that only moves things between containers this file already owns.
 * **Declare it inline when it can be; register it from the module that owns the
 * system when it cannot.** Eat-the-cereal will still need `ct/int-bodega.ts` to
 * hand it a hunger model.
 */
export const PACKAGE = defineItem({
  id: 'PACKAGE', name: 'parcel', stack: 2,
  thick: 0.10,   // a small parcel, matching the landing boxes
  blurb: 'somebody else\u2019s. It has not been opened.',
  use: { verb: 'open', act: () => rollPackage() },
  icon: (g) => {
    box(g, '#9d7f57', 3, 4, 18, 17);                   // brown paper
    box(g, '#8a6f4a', 3, 4, 18, 2);                    // its folded top
    box(g, '#6b5636', 11, 4, 2, 17);                   // the string, both ways
    box(g, '#6b5636', 3, 11, 18, 2);
    box(g, '#e8e4d8', 5, 14, 8, 5);                    // the label
    box(g, '#7d7668', 6, 16, 6, 1);                    // written on, unreadably
  },
  // THE PARCEL, the same object as the ones on the landings: brown paper and a
  // cross of string, at the size a hand carries.
  model: () => mOf(
    mBox(0.22, 0.16, 0.18, '#a98d63', 0, 0.08, 0),
    mBox(0.226, 0.035, 0.186, '#8a7049', 0, 0.08, 0),
    mBox(0.035, 0.166, 0.186, '#8a7049', 0, 0.08, 0),
    mBox(0.075, 0.002, 0.055, '#e8e4d8', 0.05, 0.161, 0.04),
  ),
});

export const PACKAGE_TABLE: string[] = [
  defineItem({
    id: 'VHS', name: 'video tape', stack: 2, blurb: 'no label. Somebody taped over something.',
    thick: 0.03,   // a cassette is a 25 mm slab
    icon: (g) => {
      box(g, '#1e2024', 2, 6, 20, 13);                 // the shell
      box(g, '#34383e', 2, 6, 20, 1);
      box(g, '#c8c2ac', 4, 8, 16, 4);                  // the write-on label, blank
      box(g, '#0d0e10', 6, 14, 12, 3);                 // the window
      box(g, '#5a5f66', 7, 15, 3, 1); box(g, '#5a5f66', 14, 15, 3, 1);
    },
      // A CASSETTE at its real 188 x 104 x 25, label up, two reel windows.
    model: () => mOf(
      mBox(0.188, 0.025, 0.104, '#1e2024', 0, 0.0125, 0),
      mBox(0.150, 0.002, 0.062, '#c8c2ac', 0, 0.026, -0.008),
      mBox(0.030, 0.003, 0.030, '#34383e', -0.042, 0.0265, 0.030),
      mBox(0.030, 0.003, 0.030, '#34383e', 0.042, 0.0265, 0.030),
    ),
}).id,
  defineItem({
    id: 'TRAINERS', name: 'pair of trainers', stack: 1, blurb: 'two sizes too big, and white.',
    thick: 0.08,   // two sizes too big and tied together
    icon: (g) => {
      box(g, '#e4e2da', 3, 9, 18, 8);                  // upper
      box(g, '#c6c3b8', 3, 15, 18, 3);                 // midsole
      box(g, '#8f8c83', 3, 18, 18, 1);                 // outsole
      box(g, '#e4e2da', 12, 6, 9, 4);                  // the ankle
      box(g, '#b03a2e', 6, 11, 9, 2);                  // the stripe, which is the whole read
      box(g, '#ffffff', 13, 7, 6, 1);
    },
      // TWO SHOES, not one — *"pair of trainers"* — at angles to each other the way
    // a pair lands.
    model: () => {
      const shoe = (x: number, z: number, ry: number) => mOf(
        mBox(0.26, 0.030, 0.095, '#e4e2da', x, 0.015, z, ry),
        mBox(0.235, 0.055, 0.085, '#c6c3b8', x - 0.008, 0.055, z, ry),
        mBox(0.090, 0.062, 0.088, '#8f8c83', x - 0.075, 0.070, z, ry),
        mBox(0.070, 0.010, 0.090, '#b03a2e', x + 0.02, 0.070, z, ry),
      );
      return mOf(shoe(0, -0.055, 0.18), shoe(-0.02, 0.055, -0.12));
    },
}).id,
  defineItem({
    id: 'TOASTER', name: 'toaster', stack: 1, blurb: 'a toaster. You have stolen a toaster.',
    // ⚠ THE ONLY BULKY THING IN THE TABLE, and it is the one he named. 28 x 17
    // x 16 cm of chrome does not go in a shoulder bag. See `ItemDef.bulky`.
    //
    // NOTHING ELSE IS FLAGGED, deliberately. The CEREAL box (28 x 19 x 7) and
    // the CATALOGUE (21 x 27 x 3) are the only other candidates and both are
    // things a person genuinely does put in a bag — a cereal box is what a bag
    // of shopping is FOR. If he wants either to join, it is one word each.
    bulky: true,
    thick: 0.10,   // a block, and the joke is that he carried it
    icon: (g) => {
      box(g, '#b6b9bf', 3, 7, 18, 12);                 // chrome slab
      box(g, '#d6d9de', 3, 7, 18, 2);                  // the top highlight
      box(g, '#8c8f95', 3, 17, 18, 2);
      box(g, '#26282c', 6, 5, 5, 3); box(g, '#26282c', 13, 5, 5, 3);   // two slots
      box(g, '#5a5f66', 20, 10, 2, 5);                 // the lever
      box(g, '#7a5a2e', 21, 14, 2, 6);                 // and the flex, going off
    },
      // A TWO-SLOT TOASTER: chrome body, the slots recessed into a lit top plate,
    // the lever down one side. 28 x 17 x 16 — the biggest thing in the table.
    model: () => mOf(
      mBox(0.28, 0.165, 0.16, '#b6b9bf', 0, 0.0825, 0),
      mBox(0.28, 0.012, 0.16, '#d6d9de', 0, 0.171, 0),
      mBox(0.085, 0.014, 0.105, '#26282c', -0.065, 0.176, 0),
      mBox(0.085, 0.014, 0.105, '#26282c', 0.065, 0.176, 0),
      mBox(0.020, 0.055, 0.030, '#5a5f66', 0.152, 0.115, 0.04),
      mBox(0.055, 0.030, 0.004, '#7a5a2e', -0.04, 0.055, 0.082),
    ),
}).id,
  defineItem({
    id: 'CHEQUES', name: 'book of cheques', stack: 4, blurb: 'someone else’s name on every one.',
    thick: 0.02,   // a chequebook, the thinnest
    icon: (g) => {
      box(g, '#c9d6cc', 3, 7, 18, 11);                 // bank green
      box(g, '#eef1ec', 3, 7, 18, 2);
      box(g, '#7d8a80', 5, 11, 10, 1); box(g, '#7d8a80', 5, 14, 8, 1);
      box(g, '#4a5a4e', 15, 13, 5, 3);                 // the amount box
      for (let x = 4; x < 21; x += 3) box(g, '#9aa79d', x, 18, 1, 2);  // the perforation
    },
      // A CHEQUEBOOK, 152 x 70, closed, the bound stub showing along one edge.
    model: () => mOf(
      mBox(0.152, 0.012, 0.070, '#9aa79d', 0, 0.006, 0),
      mBox(0.152, 0.006, 0.070, '#eef1ec', 0, 0.015, 0),
      mBox(0.030, 0.014, 0.070, '#4a5a4e', -0.061, 0.007, 0),
    ),
}).id,
  defineItem({
    id: 'SOCKS', name: 'pack of tube socks', stack: 4, blurb: 'six pairs, tube, white.',
    thick: 0.05,   // a soft pack that slumps
    icon: (g) => {
      for (const y of [5, 13]) {
        box(g, '#eceade', 3, y, 18, 6);                // a rolled tube
        box(g, '#d2d0c4', 3, y + 5, 18, 1);
        box(g, '#b03a2e', 16, y + 1, 2, 4);            // the two bands at the top
        box(g, '#2f4a8a', 19, y + 1, 2, 4);
      }
    },
      // A PACK OF TUBE SOCKS: a soft slab in a wrap with a card band round it.
    // Softer proportions than a box, because a bag of socks holds no edge.
    model: () => mOf(
      mBox(0.185, 0.075, 0.115, '#eceade', 0, 0.037, 0),
      mBox(0.190, 0.038, 0.120, '#d2d0c4', 0, 0.037, 0),
      mBox(0.060, 0.078, 0.118, '#2f4a8a', 0.045, 0.038, 0),
    ),
}).id,
  defineItem({
    id: 'CATALOGUE', name: 'mail-order catalogue', stack: 2, blurb: 'the thing that sells the things.',
    thick: 0.02,   // the thing that sells the things, and it is a magazine
    icon: (g) => {
      box(g, '#8a7a58', 4, 3, 16, 18);                 // the block of pages, edge on
      box(g, '#d8cfae', 4, 3, 15, 18);                 // the cover
      box(g, '#b03a2e', 4, 3, 15, 4);                  // the masthead band
      box(g, '#6a5a3c', 6, 9, 11, 7);                  // the photograph
      box(g, '#9a8c68', 7, 11, 4, 4);
      box(g, '#6a5a3c', 6, 17, 8, 1);
    },
      // FOUR HUNDRED PAGES IS A SLAB — 21 x 27 and 30 thick, page edges showing
    // along the open side. The one item you could prop a door with.
    model: () => mOf(
      mBox(0.21, 0.030, 0.27, '#d8cfae', 0, 0.015, 0),
      mBox(0.21, 0.004, 0.27, '#b03a2e', 0, 0.032, 0),
      mBox(0.012, 0.026, 0.27, '#8a7a58', 0.099, 0.015, 0),
      mBox(0.012, 0.030, 0.27, '#6a5a3c', -0.099, 0.015, 0),
    ),
}).id,
  // …and the disappointment is weighted, because it should be the likeliest
  // single outcome without being the only one. Repetition is the weight; a
  // table of six with one entry twice is easier to read and to change than a
  // table of six with a number beside each.
  'SOCKS',
  'CATALOGUE',
];

/**
 * Roll one item id out of a package.
 *
 * `Math.random()`, deliberately NOT `ct/rng.ts`'s seeded stream: that stream's
 * ORDER is load bearing at BUILD time (GOTCHAS §2) and drawing from it when a
 * player presses `[E]` would make every tree in the world depend on whether
 * somebody stole a package. This roll happens at play time, where unseeded is
 * both correct and what the paint layer already does.
 */
export function rollPackage(): string {
  return PACKAGE_TABLE[Math.floor(Math.random() * PACKAGE_TABLE.length)];
}

// ── what the pawn shop pays for it ────────────────────────────────────────
//
// *"it should also serve as a fence for the stuff you steal from neighbors."*
//
// THE DESIGN CHOICE, stated because the user did not make it and the row asked
// for a decision rather than a system: **the broker takes stolen goods and only
// stolen goods, asks nothing, and pays badly.** Of the three games the row
// listed — pays less than an honest sale, takes only certain goods, pays well
// but carries risk — this is the first two and deliberately not the third.
// A risk game needs heat, a chase or a cop, and the row's own instruction is
// not to build a reputation system nobody asked for. What is left is legible in
// one prompt line and testable in one keypress.
//
// **"Only certain goods" is what makes him a FENCE rather than a shop**, and it
// costs nothing to express: this table is keyed on `PACKAGE_TABLE` ids, so the
// question "will he take it?" is exactly "did you steal it?". Your cereal is
// not in here. Neither is the newspaper you picked up off the pavement.
//
// ⚠ THE PRICES ARE THE JOKE AND THEY MUST STAY MEAN. `PACKAGE_TABLE` weights
// the disappointment by repeating it — SOCKS and CATALOGUE appear twice in
// eight entries, so **half of everything you steal is worth 25–50 cents**.
// Pricing that generously kills the gag: the point of stealing a package is
// that it is a toaster. Nothing here is worth more than a cheap meal, and the
// two prizes are only prizes next to a pack of tube socks.
//
// Derived, not retyped: `int-pawn.ts` imports `fencePrice`/`bestFence` rather
// than carrying a second copy of these numbers (BUILDER-BRIEF §8).
const FENCE: Record<string, number> = {
  CATALOGUE: 0.25,   // he already has a stack of them by the till
  SOCKS: 0.50,       // six pairs, tube, white
  VHS: 2.00,         // no label — he cannot know what it is either
  TOASTER: 4.00,
  TRAINERS: 5.00,
  CHEQUES: 8.00,     // the one thing in the table a fence genuinely wants
};

/** What the broker pays for one `id`, or 0 if he will not take it at all. */
export function fencePrice(id: string): number {
  return FENCE[id] ?? 0;
}

/**
 * The most valuable thing in your pockets the broker would take, or null.
 *
 * ONE item at a time, and one keypress each, on purpose: the row's own note is
 * that a pawn counter may not need a screen, and a "sell all" would hide the
 * pricing behind a single total — which is where the joke lives. You watch him
 * give you fifty cents for the socks.
 *
 * Ties break by id so the prompt cannot flicker between two equal items from
 * one frame to the next; `slots()` returns insertion order, which changes.
 */
export function bestFence(p: Purse): string | null {
  let best: string | null = null;
  for (const id of slots(p)) {
    if (fencePrice(id) <= 0) continue;
    if (best === null) { best = id; continue; }
    const d = fencePrice(id) - fencePrice(best);
    if (d > 0 || (d === 0 && id < best)) best = id;
  }
  return best;
}

// ── the pockets themselves ────────────────────────────────────────────────

/**
 * How many pockets you have. Six.
 *
 * A slot is a KIND, not a thing: three cereal boxes are one pocket, and a
 * pocket holds up to that item's `stack`. Six is small on purpose — *"if it
 * needs a scrollbar, it is too big"* — and it is what makes "what happens when
 * you are full" a real question with a real answer rather than a theoretical
 * one.
 */
// ══ THE DRESSER DRAWER ═════════════════════════════════════════════════════
//
// *"we need to figure out inventories. so user inventory, bag inventory, anmd
//  dresser inventory … idk if theres anyway to diagetic this"*  (2026-08-04)
//
// **THE DRAWER'S CONTENTS LIVE HERE, WITH EVERYTHING ELSE ABOUT ITEMS.** It is
// a different CONTAINER from your pockets — that is the whole point, a drawer
// and a bag and your pockets are not the same object — but it is not a second
// item system: it holds `ItemDef` ids from the same table `Purse.inv` does, so
// what a thing IS is stated once and every container agrees about it.
//
// A PLAIN COUNT PER ID, because a drawer is a heap and not six ordered pockets.
// `POCKETS` and `stack` do not apply: what bounds a drawer is how much fits in
// it, which `ct/drawer.ts` answers by laying the stacks out and running out of
// floor. Capacity is physical.
//
// WHAT IS IN IT TO BEGIN WITH is the flat's own junk, from the table already
// declared below: a pack of tube socks, a couple of taped-over video tapes, and
// somebody else's cheque book. Rough, and a starting state he can judge — the
// interesting question is whether the VIEW works, not what the drawer holds.
const DRAWER: Record<string, number> = { SOCKS: 4, VHS: 2, CHEQUES: 1 };

/** What is in the dresser drawer: ids in lay-out order, with their counts. */
export function drawerStock(): { id: string; n: number }[] {
  return Object.keys(DRAWER).filter((k) => DRAWER[k] > 0).map((id) => ({ id, n: DRAWER[id] }));
}

/** Take one out of the drawer. False if there is none. */
export function drawerTake(id: string): boolean {
  if ((DRAWER[id] ?? 0) < 1) return false;
  DRAWER[id] -= 1;
  if (DRAWER[id] === 0) delete DRAWER[id];
  return true;
}

/** Put one back in. */
export function drawerPut(id: string): void { DRAWER[id] = (DRAWER[id] ?? 0) + 1; }

// ══ THE BAG ════════════════════════════════════════════════════════════════
//
// *"with looking down, right click should toggle between inventory (bag),
//  watch, and nothing"*   (2026-08-05)
//
// **A THIRD CONTAINER, AND DELIBERATELY NOT A COPY OF THE OTHER TWO.** Your
// pockets are six slots you carry always; the drawer is furniture that stays in
// the room; the bag is a thing you WEAR, so it exists only while one is on your
// back and its size is the bag's own. Three containers that behave differently
// is what makes this a place rather than a menu — and the item vocabulary is
// still this one table, so `ItemDef` says what a thing IS exactly once.
//
// ══ THERE WAS A SECOND STORE, AND IT IS GONE ══════════════════════════════
//
// *"how come i dont see my inventory in the bag. its like picking stuff up
//  send its to a sep inventory?"*   (2026-08-05)
//
// HE IS EXACTLY RIGHT AND IT WAS EXACTLY THAT. This file used to hold
//
//     const BAG: Record<string, number> = { NEWSPAPER: 1, SODA: 2 };
//
// a module-level record with its own put/take/stock, and the bag view drew from
// it. Every entry point in the world writes to the PURSE instead — `give(ctx.
// purse, …)` — and that is all of them, checked one by one:
//
//     picking litter off the ground   inventory.ts, the `takeable` spot
//     stealing a parcel               givePackage  -> give
//     opening a parcel                giveRandom   -> give
//     taking from the dresser         drawer.ts    -> roomFor + give
//
// NOTHING IN THE WORLD EVER WROTE TO `BAG`. The only three callers of `bagPut`
// were inside `ct/bag.ts` itself, all of them putting back something that had
// just come out. So the bag showed a newspaper and two sodas that were typed
// here as a seed, for ever, and everything he actually picked up went somewhere
// with no view onto it. "user inventory, bag inventory, and dresser inventory"
// was answered as three STORES when it should have been two stores and two
// VIEWS of one of them.
//
// ONE STORE NOW: the purse. The four `bag*` functions below are a THIN VIEW
// over it — they take a Purse and forward to `slots`/`give`/`takeOne` — kept as
// names rather than deleted because `ct/bag.ts` reads in bag vocabulary and the
// indirection is where the "the bag is a view, not a container" fact is
// written down. There is no second table left to drift.

/** What he is carrying: ids in pick-up order, with their counts. */
export function bagStock(p: Purse): { id: string; n: number }[] {
  return slots(p).map((id) => ({ id, n: p.inv[id] ?? 0 }));
}
/** Take one out. False if there is none. */
export function bagTake(p: Purse, id: string): boolean { return takeOne(p, id); }
/** Put one back. Cannot fail while a bag is worn — see `roomFor`. */
export function bagPut(p: Purse, id: string): boolean { return give(p, id, 1) > 0; }

/**
 * ── HOW MANY SLOTS ────────────────────────────────────────────────────────
 *
 * *"give all bags the same space of 12 slots. if you have no bag you hold one
 *  thing in your right hand it functions as a one slot inventory."*
 *   (2026-08-05)
 *
 * TWO NUMBERS, AND WHICH ONE APPLIES IS THE ONLY THING THE BAG DECIDES. Capacity
 * stopped varying by bag one instruction ago and stopped being infinite with
 * this one; what is left is the cleanest version of the rule this has been
 * circling all session — a bag is twelve, a bare hand is one, and choosing
 * BETWEEN bags is now purely about how it looks and how it is carried.
 *
 * ⚠ A SLOT IS A THING, NOT A KIND, and that is a real change rather than a
 * rewording. This used to count `slots(p).length` — the number of distinct ids —
 * so twelve kinds could be forty objects if they stacked. But the bag DRAWS one
 * cell per thing (`laid()` expands a stack of two sodas into two squares), so
 * the picture said forty and the limit said twelve. He can see twelve squares;
 * twelve is what it means. `carried()` counts what he can count.
 */
export const BAG_SLOTS = 12;
/** *"if you have no bag you hold one thing in your right hand"* */
export const HAND_SLOTS = 1;
/**
 * @deprecated the six-pocket rule is gone — a bare hand holds ONE. Kept as a
 * name only because two comments in `ct/wardrobe.ts` still point at it; nothing
 * reads it.
 */
export const POCKETS = HAND_SLOTS;
/** how many things he can carry right now — the bag decides, and only this */
export function carrySlots(): number {
  return bagWorn().kind === 'none' ? HAND_SLOTS : BAG_SLOTS;
}

/** The kinds you are actually carrying, in the order you first picked them up. */
export function slots(p: Purse): string[] {
  return Object.keys(p.inv).filter((k) => (p.inv[k] ?? 0) > 0);
}
/** How many THINGS he is carrying, counting a stack of two as two — the same
 *  count the bag view draws squares for. */
export function carried(p: Purse): number {
  return Object.keys(p.inv).reduce((t, k) => t + (p.inv[k] ?? 0), 0);
}

/**
 * How many more of `id` he could take right now. 0 means no room FOR THAT ITEM.
 *
 * TWO CEILINGS AND THE LOWER ONE WINS: what the stack allows, and what the
 * space allows. The second is back — it was neutered when capacity went
 * infinite and `carrySlots()` returned 999 — so every refusal in this file can
 * fire again, and every caller that words a prompt from `roomFor` starts
 * telling the truth again without being touched.
 */
export function roomFor(p: Purse, id: string): number {
  const byStack = Math.max(0, itemOf(id).stack - (p.inv[id] ?? 0));
  // ⚠ A BULKY THING IS IN YOUR HANDS, SO A BAG DOES NOT HELP — see
  // `ItemDef.bulky`. Its ceiling is HAND_SLOTS whatever is on your back, and it
  // counts everything you are already carrying, so you cannot hold a toaster
  // and a full bag's worth of anything else.
  const ceiling = itemOf(id).bulky ? HAND_SLOTS : carrySlots();
  const bySpace = Math.max(0, ceiling - carried(p));
  return Math.min(byStack, bySpace);
}

/** is he carrying something too big to stow? Ask this to WORD A PROMPT. */
export function handsFull(p: Purse): boolean {
  return slots(p).some((id) => itemOf(id).bulky);
}

/** Is there nowhere left to put anything at all? Ask this to WORD A PROMPT
 *  before offering, never to decide — `give` is what decides. */
export function pocketsFull(p: Purse): boolean {
  return carried(p) >= carrySlots();
}
/**
 * WHY he cannot take it, in his own vocabulary.
 *
 * A refusal has to name the thing that is full, and after this change that is
 * two different objects: a bag on his back, or the one hand he has free. One
 * phrase for both would be wrong in one of the two cases every time, and the
 * callers should not each be deciding which — so they ask.
 */
export function fullWhy(p: Purse): string {
  // the bulky case first, because it is the surprising one: a bag with room in
  // it that still cannot take this
  if (handsFull(p)) return 'your hands are full';
  if (!pocketsFull(p)) return '';
  return bagWorn().kind === 'none'
    ? 'your hands are full'
    : `your bag is full — ${carried(p)} of ${BAG_SLOTS}`;
}

/**
 * Put `n` of `id` in your pockets. Returns how many actually went in.
 *
 * WHEN THE POCKETS ARE FULL WE REFUSE, and that is a decision rather than an
 * omission. The alternative on the table was dropping the oldest item to make
 * room, and it is worse: it destroys something the player chose to carry, in
 * response to an action whose whole point was to gain something. A refusal is
 * legible — you still have what you had, and the prompt told you why before you
 * pressed the key.
 *
 * Refusing is only honest if it is VISIBLE, so every caller in this file words
 * its own prompt from `roomFor()` and posts a line via `hud.note()` on the
 * refusal. A silent no is the same bug as a silent yes.
 */
export function give(p: Purse, id: string, n = 1): number {
  const took = Math.min(n, roomFor(p, id));
  if (took > 0) p.inv[id] = (p.inv[id] ?? 0) + took;
  return took;
}

/** Take one out. Deletes the key at zero so the slot is genuinely freed. */
export function takeOne(p: Purse, id: string): boolean {
  const have = p.inv[id] ?? 0;
  if (have < 1) return false;
  if (have === 1) delete p.inv[id]; else p.inv[id] = have - 1;
  return true;
}

/**
 * ONE CALL, for a consumer that has something to give and no object to hand:
 * a stolen package, a found wallet, a prize.
 *
 * Rolls, pockets it, tells the player what they got — or that they had no room
 * — and refreshes the wallet. The caller states intent and nothing else:
 *
 *     import { giveRandom, fullWhy } from './inventory';
 *     …
 *     label: () => (pocketsFull(ctx.purse)
 *       ? fullWhy(ctx.purse)
 *       : 'steal package'),
 *     act: () => { const got = giveRandom(ctx); if (got.taken) removeThePackage(); },
 *
 * Gate the LABEL on `pocketsFull` as above so the refusal is readable before
 * the key is pressed, and gate whatever the act consumes on `got.taken`, so a
 * refused steal does not silently destroy the package it could not fit.
 */
/**
 * STEAL A PARCEL — and you get the PARCEL, not what is in it. The roll waits
 * for `PACKAGE.use`. `giveRandom` below is untouched for any caller that still
 * wants contents outright; nothing does today.
 */
export function givePackage(ctx: CtxBuild): { id: string; def: ItemDef; taken: boolean } {
  const taken = give(ctx.purse, PACKAGE.id, 1) > 0;
  if (taken) ctx.refreshWallet();
  else note(fullWhy(ctx.purse));
  return { id: PACKAGE.id, def: PACKAGE, taken };
}

export function giveRandom(ctx: CtxBuild, table: string[] = PACKAGE_TABLE): { id: string; def: ItemDef; taken: boolean } {
  const id = table[Math.floor(Math.random() * table.length)];
  const def = itemOf(id);
  const taken = give(ctx.purse, id, 1) > 0;
  ctx.refreshWallet();
  // ⚠ NO LINE ON SUCCESS. *"i dont want descriptors for the items you pick
  // up"* — the note line stays for rent, the neighbour and the landlord, and
  // stops narrating what he can already see in his own bag. The REFUSAL stays:
  // that is not a descriptor, it is the reason nothing happened.
  if (!taken) note(fullWhy(ctx.purse));
  return { id, def, taken };
}

// ── the screen ────────────────────────────────────────────────────────────
//
// A takeable is registered at BUILD time and posts its line at PLAY time, and
// the module registering it has no business holding the HUD — so the line goes
// through `hudNote`, which ct/hud.ts publishes for exactly this.
const note = hudNote;
// ── THE PANEL ─────────────────────────────────────────────────────────────
//
// Your pockets, held open in front of you. A view onto exactly the same
// `Purse.inv` the wallet's left leaf lists — two views, one set of pockets.
//
// *"i also want an atm interface and an inventory interface. equally try hard."*
// This is the second ask on it, and the word in it is INTERFACE: it was a grid
// with a caption, and what it owes is items drawn as OBJECTS, a layout you read
// at a glance, and one thing you can look at closely.
//
// IT IS BUILT ON `makePanel` FROM ct/hud.ts, the same cabinet the ATM and the
// slots machine stand in — so the freeze, the one-at-a-time rule, ESC and the
// typeface are the shared ones and cannot drift from theirs. What is different
// is the material: `chrome: 'cloth'`, because this is not a machine you walk up
// to, it is canvas you are holding, and the wallet established that idiom when
// the user replaced a corner popup with an object gripped in both thumbs.
//
// WHY ITS OWN KEY AND NOT THE WALLET'S. Right-click is the wallet, `i` is the
// pockets — one gesture each, because "how much money have I got" and "what am
// I carrying" are two questions and making one a second press of the other
// turns a glance into a sequence.
//
// WHY THE WHEEL SELECTS. `src/main.ts` spends every DIGIT switching prototypes
// and the rig has WASD E C shift space arrows Z X [ ]. The wheel is unused
// anywhere in src/, survives pointer lock, and picking along a row by scrolling
// is the idiom this borrows from anyway.

const COLS = 3;                                  // 3 × 2 = POCKETS
const CELL = 56, CELL_H = 48, GAP = 6;
const GRID_X = 8, GRID_Y = 8;
const GRID_W = COLS * CELL + 2 * GAP;            // 180
const PANEL_W = 310, PANEL_H = 150;
/** the pane on the right where one thing is held up to the light */
const LOOK_X = GRID_X + GRID_W + 10, LOOK_W = PANEL_W - LOOK_X - 8;

let panel: Panel | null = null;
let sel = 0;
/** the purse the panel is a view onto. Set by `register`. */
let PURSE: Purse | null = null;

/** draw an item's 24 px icon at `k`× — crisp, because everything in the icons
 *  is an integer `fillRect` and the scale is an integer too. */
function icon(g: CanvasRenderingContext2D, id: string, x: number, y: number, k: number): void {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  (itemOf(id).icon ?? PARCEL)(g);
  g.restore();
}

function paintPanel(g: CanvasRenderingContext2D): void {
  const p = PURSE!;
  const held = slots(p);

  // ── the six pockets, read at a glance ──
  for (let i = 0; i < POCKETS; i++) {
    const gx = GRID_X + (i % COLS) * (CELL + GAP);
    const gy = GRID_Y + Math.floor(i / COLS) * (CELL_H + GAP);
    // a patch SEWN ON, sitting proud of the cloth rather than a hole cut in
    // it — a hole reads as a slot in a menu. Two tones off the cloth, or the
    // six of them merge into one rectangle, which is what the first cut did.
    box(g, '#3f3b2e', gx, gy, CELL, CELL_H);
    box(g, '#4e4939', gx + 1, gy + 1, CELL - 2, CELL_H - 2);
    box(g, '#6d6754', gx + 1, gy + 1, CELL - 2, 2);            // the hem
    const id = held[i];
    if (id) {
      icon(g, id, gx + (CELL - 36) / 2, gy + (CELL_H - 36) / 2, 1.5);
      const n = p.inv[id] ?? 0;
      if (n > 1) {
        g.font = UI.font(8, true); g.textAlign = 'right'; g.textBaseline = 'alphabetic';
        g.fillStyle = '#1e1b16'; g.fillText(`${n}`, gx + CELL - 4, gy + CELL_H - 5);
        g.fillStyle = UI.ink; g.fillText(`${n}`, gx + CELL - 5, gy + CELL_H - 6);
      }
    }
    if (i === sel) {
      // the SAME two-tone stroke `hud.highlight` puts round a door out in the
      // world, so "selected" means one thing whether it is out there or in here
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeRect(gx - 1.5, gy - 1.5, CELL + 3, CELL_H + 3);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.strokeRect(gx - 0.5, gy - 0.5, CELL + 1, CELL_H + 1);
    }
  }

  // how full you are. The six pockets are drawn, so the empties are already
  // the information — this is only the number for the wallet to agree with.
  g.fillStyle = UI.dim; g.font = UI.font(7); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(`${held.length} of ${POCKETS} pockets`, GRID_X + 1, GRID_Y + 2 * CELL_H + GAP + 12);

  // ── the pane where you LOOK AT ONE THING ──
  //
  // The half that makes this an interface rather than a grid: the selected
  // thing held up on its own, three times the size it is in the pocket, with
  // what it is and what you can do with it under it.
  const ly = GRID_Y;
  // FULL HEIGHT, not the grid's. At the grid's height the wrapped blurb printed
  // straight over "G put it down" — two lines of prose and a verb competing for
  // the same eight pixels, which is the sort of thing that reads as broken
  // rather than as tight.
  const lh = PANEL_H - 2 * GRID_Y;
  box(g, '#3f3b2e', LOOK_X - 1, ly - 1, LOOK_W + 2, lh + 2);
  box(g, '#5a5443', LOOK_X, ly, LOOK_W, lh);                  // a lighter inner lining
  box(g, '#665f4c', LOOK_X, ly, LOOK_W, 2);

  const id = held[sel];
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (id) {
    const def = itemOf(id);
    icon(g, id, LOOK_X + (LOOK_W - 72) / 2, ly + 8, 3);
    g.fillStyle = UI.shout; g.font = UI.font(8, true);
    g.fillText(def.name.toUpperCase(), LOOK_X + LOOK_W / 2, ly + 96);
    // the blurb, wrapped by hand — two short lines beat one clipped one
    g.fillStyle = UI.dim; g.font = UI.font(7);
    const words = (def.blurb || '').split(' ');
    let ln = '', row = 0;
    for (const w of words) {
      const t = ln ? `${ln} ${w}` : w;
      if (g.measureText(t).width > LOOK_W - 8 && ln) {
        g.fillText(ln, LOOK_X + LOOK_W / 2, ly + 108 + row * 9); ln = w; row++;
        if (row > 2) break;
      } else ln = t;
    }
    if (row <= 2) g.fillText(ln, LOOK_X + LOOK_W / 2, ly + 108 + row * 9);
    // SAY IT BEFORE THE KEY, not after. Only a thing that came off the ground
    // has an object to put back — a cereal box bought over a counter never had
    // one — and the first cut let you select it, press G, and be told no.
    g.fillStyle = canDrop(id) ? UI.ink : '#8d8672';
    g.font = UI.font(7, canDrop(id));
    // Short enough to FIT: "nothing to put it back as" is 25 characters and the
    // pane is 104 px, so it printed clipped at both ends. A caption that runs
    // off its own box reads as a rendering bug rather than as an explanation.
    g.fillText(canDrop(id) ? 'G  put it down' : 'cannot be put back',
      LOOK_X + LOOK_W / 2, ly + lh - 8);
  } else {
    g.fillStyle = '#8d8672'; g.font = UI.font(8);
    g.fillText(held.length ? 'empty' : 'nothing', LOOK_X + LOOK_W / 2, ly + 52);
    g.fillStyle = '#7a7460'; g.font = UI.font(7);
    g.fillText('pocket', LOOK_X + LOOK_W / 2, ly + 62);
  }
}

/** Repaint if it is out. Driven by `onPurseChange`, the one signal in the world
 *  that says the purse moved — so the pockets cannot drift from the wallet. */
export function refreshPockets(): void { panel?.repaint(); }

/** Put the pockets away. The HUD calls this when the wallet or a cabinet opens. */
export function closePockets(): void { panel?.close(); }

export function togglePockets(): void { panel?.toggle(); }

export function pocketsOpen(): boolean { return panel?.isOpen() ?? false; }

/** Which pocket is chosen, and what is in it (null if that pocket is empty). */
export function selected(p: Purse): string | null { return slots(p)[sel] ?? null; }

// ── taking things off the ground ──────────────────────────────────────────

/** What a takeable remembers so it can be put back exactly as it was found. */
interface Stashed { id: string; restore: (x: number, z: number, gy: number) => void }

/** Most recently pocketed FIRST when you drop. A stack, because putting things
 *  down in the reverse of the order you picked them up is what hands do. */
const TAKEN: Stashed[] = [];

/**
 * Make an object in the world pocketable. THE PUBLISHED CALL — one line, in
 * your own file, no edit here and none to the entry point:
 *
 *     import { takeable } from './inventory';
 *     takeable(ctx, { obj: myCup, id: 'CUP' });
 *
 * `obj` is the thing that disappears when it is taken and reappears where you
 * drop it. It must already be positioned in the world; the `[E]` lands on its
 * own coordinates, so a takeable cannot be registered against a spot the object
 * is not actually at.
 */
/**
 * PUT A THING ON THE GROUND THAT WAS NEVER ON IT — and make it takeable again.
 *
 * *"should be able to drop items by just drag dropping them out of the bag. the
 *  item should then exist on the ground."*   (2026-08-05)
 *
 * `dropId` above can only put back what it PICKED UP: `TAKEN` holds a `restore`
 * closure captured from the object that was lifted, so a thing bought over a
 * counter or handed out of a package has no mesh to give back and it says so.
 * A bag full of things you never found on the floor needs the other half —
 * something that BUILDS the object.
 *
 * IT IS A PLANE LYING FLAT ON THE BOARDS, painted with `ItemDef.icon`: the same
 * art the bag and the pockets draw, so the thing you dropped is visibly the
 * thing you were holding. 0.16 m square, which is litter-sized against a 2 m
 * lane, and flat rather than standing because a dropped object has fallen over.
 *
 * AND IT REGISTERS THROUGH `takeable`, so picking it back up is the same code
 * path as every other piece of litter on this street — `roomFor` refuses when
 * you are full, `give` is the only way it enters a purse, and `TAKEN` gets its
 * `restore` so it can be put down again. One store, one route in, one route out.
 */
/**
 * ── A DROPPED THING IS A SOLID ────────────────────────────────────────────
 *
 * *"items dropped sometimes have no height and so they look graphically weird
 *  on the ground. pls give height. no collision needed"*   (2026-08-05)
 *
 * IT WAS A PLANE. `ce0c3025` dropped a 0.16 m quad lying flat with the icon on
 * it, and at a grazing angle a quad has no thickness to show — it thins to a
 * line, then to a decal painted on the carpet. A box has sides, so it has a
 * silhouette from anywhere in the room.
 *
 * THE TOP CARRIES THE ART AND THE SIDES DO NOT, which is the lesson the landing
 * parcels paid for four commits ago: one texture on six faces gave two labels at
 * right angles and string that stopped at every edge. The top is what he sees
 * looking down, so it gets the icon; the four sides and the underside take the
 * ART'S OWN DOMINANT COLOUR, read back off the canvas that was just painted
 * rather than typed — so a red soda can has red sides and a grey toaster grey
 * ones, and nobody has to keep a second palette in step with the icons. The
 * sides go 22% darker than the top, which is the only shading a flat-shaded
 * world gets and is what says "this face is not the lit one".
 *
 * FLUSH ON THE FLOOR AT EVERY STOREY. The origin sits half a thickness up, so
 * the base lands on `gy` whatever the item is, plus 2 mm of daylight against
 * the boards — the same trick the old plane used at 6 mm, and the smallest gap
 * that keeps a coplanar pair from z-fighting.
 *
 * ⚠ NO COLLIDER, NO `maxY`, NOTHING STANDABLE. He was explicit, and it is the
 * right call twice over: dropping something must not build a step you can climb
 * on, and a solid you can walk through is a smaller lie than a floor tile that
 * grew.
 *
 * AND TWO DROPS DO NOT STACK. Both used to land at exactly the player's feet,
 * so the second was inside the first. Each drop steps round a small ring and
 * takes its own yaw off the same counter — deterministic, so nothing jitters
 * per frame, and the yaw is the difference between things somebody dropped and
 * things somebody arranged.
 */
let dropN = 0;
export function dropLoose(ctx: CtxBuild, id: string, x: number, z: number, gy: number): boolean {
  const def = itemOf(id);
  // ── THE REAL OBJECT, IF THE ITEM HAS ONE ────────────────────────────────
  //
  // *"lets make sure theres a real world item for these items so when we drop
  //  them in the world they exist in it as they would."*
  //
  // A model's parts are built about ITS OWN BASE, so it sits on the floor by
  // being placed at `gy` — no half-thickness, no lift, nothing to keep in step
  // with a size the model owns. 2 mm of daylight against z-fighting, the same
  // clearance the old box used.
  if (def.model) {
    const obj = def.model();
    // A HAND DOES NOT SET THINGS DOWN SQUARE. The yaw is off the drop counter
    // rather than random, so it is deterministic and nothing spins per frame.
    obj.rotation.y = (dropN * 1.107) % (Math.PI * 2);
    const k = dropN++;
    const a = k * 2.39996;                             // the golden angle
    const rad = k === 0 ? 0 : 0.10 + 0.02 * (k % 4);
    obj.position.set(x + Math.cos(a) * rad, gy + 0.002, z + Math.sin(a) * rad);
    obj.name = `dropped-${id}`;
    ctx.scene.add(obj);
    // ⚠ `lift` IS 0.002 AND NOT HALF A THICKNESS. The model's origin IS its
    // base, so picking it up and dropping it on another storey lands it flush
    // there too without anyone re-deriving a height.
    takeable(ctx, { obj, id, lift: 0.002 });
    return true;
  }
  // ── AND THE FALLBACK, FOR AN ITEM NOBODY HAS MODELLED YET ────────────────
  //
  // The textured box `472096eb` built: the icon on top, the art's own dominant
  // colour on the sides. It is not what he asked for and it is not a lie
  // either — an unmodelled thing is honestly a printed carton — so it stays as
  // the path a NEW item takes before somebody gives it a shape. `ItemDef.thick`
  // exists only for this branch.
  const cv = document.createElement('canvas');
  cv.width = 48; cv.height = 48;
  const g = cv.getContext('2d');
  if (!g) return false;
  g.save(); g.scale(2, 2);
  try { def.icon?.(g); } catch { /* an item with no art still drops */ }
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  let r = 0, gg = 0, b = 0, n = 0;
  try {
    const px = g.getImageData(0, 0, 48, 48).data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] > 128) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++; }
    }
  } catch { /* a tainted canvas is not a reason to refuse a drop */ }
  const dim = 0.78;
  const side = n > 0
    ? new THREE.Color(r / n / 255 * dim, gg / n / 255 * dim, b / n / 255 * dim)
    : new THREE.Color(0x6a6459);
  const sideM = new THREE.MeshBasicMaterial({ color: side });
  const topM = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
  const th = def.thick ?? 0.05;
  const obj = new THREE.Mesh(new THREE.BoxGeometry(0.16, th, 0.16),
    [sideM, sideM, topM, sideM, sideM, sideM]);
  const k = dropN++;
  const a = k * 2.39996;
  const rad = k === 0 ? 0 : 0.10 + 0.02 * (k % 4);
  obj.rotation.y = (k * 1.107) % (Math.PI / 2);
  const LIFT = th / 2 + 0.002;
  obj.position.set(x + Math.cos(a) * rad, gy + LIFT, z + Math.sin(a) * rad);
  obj.name = `dropped-${id}`;
  ctx.scene.add(obj);
  takeable(ctx, { obj, id, lift: LIFT });
  return true;
}

export function takeable(ctx: CtxBuild, o: {
  obj: THREE.Object3D;
  id: string;
  /** trigger radius. Default 0.7 — litter is small and you stand over it. */
  r?: number;
  /** live right now? (right floor, right room). Defaults to always. */
  ok?: () => boolean;
  /**
   * How far the object's origin sits ABOVE the ground it rests on, so dropping
   * it somewhere else does not bury it or float it. Defaults to whatever
   * `userData.groundY` says — `ct/props.ts` stamps that on every piece of
   * litter it places — and to 0 for anything that does not carry the tag.
   */
  lift?: number;
}): void {
  const def = itemOf(o.id);
  const lift = o.lift ?? (typeof o.obj.userData.groundY === 'number'
    ? o.obj.position.y - (o.obj.userData.groundY as number) : 0);
  let held = false;
  const s: Spot = {
    x: o.obj.position.x, z: o.obj.position.z, r: o.r ?? 0.7,
    obj: o.obj,
    // ⚠ AIM AT THE THING, NOT AT ITS FLOOR MARKER — the bug fixed on 301's door
    // and on the calendar today. For litter the two coincide horizontally, so
    // this changes nothing YET and is declared anyway: the moment a takeable
    // object is offered from a stand-point that is not on top of it, an
    // undeclared aim measures to the patch of floor instead of the object.
    aimX: o.obj.position.x, aimZ: o.obj.position.z,
    ok: () => !held && (o.ok ? o.ok() : true),
    label: () => (roomFor(ctx.purse, o.id) > 0
      ? `take the ${def.name}`
      : `${fullWhy(ctx.purse)} — no room for the ${def.name}`),
    act: () => {
      if (give(ctx.purse, o.id, 1) < 1) {
        note(fullWhy(ctx.purse));
        return;
      }
      o.obj.visible = false;                       // it LEAVES THE GROUND
      held = true;
      ctx.refreshWallet();
      TAKEN.push({
        id: o.id,
        restore: (x, z, gy) => {
          o.obj.position.set(x, gy + lift, z);
          o.obj.visible = true;
          s.x = x; s.z = z;                        // …and the [E] follows it
          held = false;
        },
      });
    },
  };
  ctx.spot(s);
}

/**
 * Put the last thing you picked up back on the ground, at your feet.
 *
 * At your feet and not in front of you because `ctx.player` publishes x, z and
 * the floor height but no facing, and a drop point derived from a heading this
 * file cannot read would be a guess. Look down and it is there — which is also
 * the only place a dropped thing can be that is certainly reachable, since you
 * are standing in the trigger that offers it back.
 *
 * Only things you TOOK can be dropped: a cereal box bought over a counter never
 * had an object in the world, so there is nothing to put back. That limit is
 * real and it is stated rather than hidden — the prompt says so.
 */
export function dropLast(ctx: CtxBuild): boolean {
  for (let i = TAKEN.length - 1; i >= 0; i--) {
    if ((ctx.purse.inv[TAKEN[i].id] ?? 0) > 0) return putDown(ctx, i);
  }
  note(slots(ctx.purse).length
    ? 'nothing in your pockets came off the ground'
    : 'your pockets are empty');
  return false;
}

/**
 * Is there an object in the world to put this back AS?
 *
 * Only things that were TAKEN have one. Bought over a counter or handed to you
 * out of a package, there is nothing to restore — so this is what the panel's
 * caption reads before you press the key, rather than a refusal after.
 */
export function canDrop(id: string): boolean {
  return TAKEN.some((t) => t.id === id);
}

/** Drop a PARTICULAR thing — what the panel's selection asks for. */
export function dropId(ctx: CtxBuild, id: string): boolean {
  if ((ctx.purse.inv[id] ?? 0) < 1) return false;
  for (let i = TAKEN.length - 1; i >= 0; i--) if (TAKEN[i].id === id) return putDown(ctx, i);
  // Bought over a counter, or handed to you out of a package: there is no
  // object in the world to put back, so there is nothing honest to do. Said
  // rather than swallowed — a key that does nothing and explains nothing is how
  // a player concludes the whole feature is broken.
  note(`the ${itemOf(id).name} did not come off the ground — nothing to put back`);
  return false;
}

function putDown(ctx: CtxBuild, i: number): boolean {
  const t = TAKEN[i];
  TAKEN.splice(i, 1);
  takeOne(ctx.purse, t.id);
  t.restore(ctx.player.x(), ctx.player.z(), ctx.player.gy());
  ctx.refreshWallet();
  // and no line for putting one down either — the same instruction. He can see
  // it leave his hand and land on the floor; saying so is narration.
  return true;
}

// ── wiring ────────────────────────────────────────────────────────────────

let keysBound = false;

export function register(ctx: CtxBuild): void {
  PURSE = ctx.purse;

  // THE CABINET IS THE SHARED ONE. Everything about being on screen — the
  // freeze behind it, one thing out at a time, ESC, the typeface — comes from
  // `makePanel` and is identical to the ATM's and the slots'. Only the material
  // is ours: canvas, because this is not a machine you walk up to.
  panel = makePanel({
    id: 'ct-pockets', w: PANEL_W, h: PANEL_H, scale: 2, chrome: 'cloth',
    title: 'POCKETS',
    hint: () => 'scroll  choose   ·   G  put it down',
    draw: (g) => paintPanel(g),
    key: (k) => {
      if (k === 'i') { panel?.close(); return; }
      if (k !== 'g') return;
      const id = selected(ctx.purse);
      if (id) dropId(ctx, id);
      else note('that pocket is empty');
      panel?.repaint();
    },
    wheel: (dir) => {
      sel = (sel + (dir > 0 ? 1 : POCKETS - 1)) % POCKETS;
      panel?.repaint();
    },
  });

  // The wallet and the pockets are both things in your hands, so each puts the
  // other away; the framework closes registered held objects whenever anything
  // comes out. And the wallet's own "n/6 pockets" line reads from here rather
  // than ct/hud.ts importing this file — see the note above `setPocketInfo`.
  registerHeldObject(() => panel?.close());
  setPocketInfo(() => ({ used: slots(ctx.purse).length, max: POCKETS }));
  onPurseChange(() => panel?.repaint());

  // `i` OPENS IT, and that binding lives out here because a panel that is shut
  // hears nothing — the framework's gate only runs while something is up. G
  // outside the panel drops the last thing you picked up; inside it drops what
  // you chose, and the difference is on screen at the moment you press it,
  // which is the only kind of modal key that is not a trap.
  if (!keysBound) {
    keysBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') togglePockets();
      else if (k === 'g') dropLast(ctx);
    });
  }

  // ── adopting the newspapers ─────────────────────────────────────────────
  //
  // The folded newspaper is the first takeable because it already exists, the
  // user picked it himself out of a comparison rig (*"coffee cup is good, i
  // like newspaper as well"*), and it is the obvious thing to pocket.
  //
  // It lives in `ct/props.ts`, which is builder B's, so this is an ADOPTION and
  // not an edit: `props.ts` stamps `userData.litter = <name>` on every piece it
  // places — a tag it already publishes for `scripts/trash.mjs` — and this asks
  // for the ones that are newspapers. B can replace all of it with one
  // `takeable(ctx, { obj, id: 'NEWSPAPER' })` beside the placement whenever it
  // suits; nothing here has to change when that happens, the count just drops.
  //
  // ORDER puts this after `buildProps`, so the litter is on the ground by now.
  // Counted rather than assumed, and LOUD at zero: an adoption that silently
  // finds nothing is indistinguishable from one that works, which is exactly
  // the failure GOTCHAS §34 is about.
  const papers: THREE.Object3D[] = [];
  ctx.scene.traverse((o) => { if (o.userData?.litter === 'folded newspaper') papers.push(o); });
  if (!papers.length) {
    console.warn('[inventory] no folded newspapers in the scene — nothing is takeable. '
      + 'ct/props.ts stamps userData.litter; either it has not built yet (check ORDER) '
      + 'or the piece has been renamed.');
    return;
  }
  for (const p of papers) takeable(ctx, { obj: p, id: 'NEWSPAPER' });

  // Test affordance, the same shape and for the same reason as `__ct` in the
  // entry point: the pockets are a plain object held in a closure and there is
  // no other way to read them from outside. `scripts/K-pocket-loop.mjs` asserts
  // on this. Read-only — a probe that could WRITE the pockets could make its
  // own assertions come true.
  (window as unknown as { __inv: unknown }).__inv = {
    pockets: () => ({ ...ctx.purse.inv }),
    cash: () => ctx.purse.cash,
    slots: () => slots(ctx.purse),
    limit: POCKETS,
    roomFor: (id: string) => roomFor(ctx.purse, id),
    items: () => [...ITEMS.values()],
    packageTable: () => [...PACKAGE_TABLE],
    /** how many takeables were adopted — the population floor, GOTCHAS §34 */
    takeables: () => papers.length,
    /** the panel's chosen pocket. Whether it is ON SCREEN is deliberately NOT
     *  here: a probe should read the element's own rectangle for that, because
     *  a boolean flipping is not the same claim as a thing being visible. */
    sel: () => sel,
    selected: () => selected(ctx.purse),
    canDrop: (id: string) => canDrop(id),
  };
}
