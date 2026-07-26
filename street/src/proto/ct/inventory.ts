import * as THREE from 'three';
import { BUILD, type CtxBuild, type Spot } from './ctx';
import type { Hud, Purse } from './hud';

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
   * Paint the thing, in a 24 × 24 box with the origin at its top left.
   *
   * Optional, and the fallback is a plain wrapped parcel rather than a guess at
   * what an unknown id might look like — an honest generic beats a confident
   * wrong picture, which is the same argument `ctx.Spot.obj` makes about the
   * selection outline drawing a dumb box when nobody said what the spot is
   * about.
   */
  icon?: (g: CanvasRenderingContext2D) => void;
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
const box = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

// The things that exist today. Deliberately few — the desk's instruction was
// *"propose the item list — do not invent twenty"*, and a table of things you
// cannot actually obtain is worse than a short one.
defineItem({
  id: 'NEWSPAPER', name: 'folded newspaper', stack: 2,
  blurb: 'yesterday’s, and somebody has stood on it.',
  // ct/props.ts's own newsprint: #9d9483 weathered, #3a352d masthead ink
  icon: (g) => {
    box(g, '#9d9483', 3, 5, 18, 15);
    box(g, '#3a352d', 5, 7, 12, 3);                    // masthead
    for (let y = 12; y < 19; y += 2) { box(g, '#6a6459', 5, y, 6, 1); box(g, '#6a6459', 13, y, 5, 1); }
    box(g, '#544e44', 3, 13, 18, 1);                   // the fold, its darkest line
    box(g, '#7d7668', 3, 5, 18, 1);
  },
});
// Already purchasable at the bodega counter (ct/int-bodega.ts) and already in
// the starting purse, so these two are declared rather than introduced.
defineItem({
  id: 'CEREAL', name: 'box of cereal', stack: 4, blurb: 'the birds prefer it to you.',
  icon: (g) => {
    box(g, '#c8862e', 5, 3, 14, 19);                   // the carton, stood up
    box(g, '#e0a94a', 5, 3, 14, 2);
    box(g, '#f0e6cc', 7, 7, 10, 6);                    // the label panel
    box(g, '#8a5a1e', 8, 9, 8, 1); box(g, '#8a5a1e', 8, 11, 6, 1);
    box(g, '#a8681f', 7, 16, 10, 3);
  },
});
defineItem({
  id: 'SODA', name: 'can of soda', stack: 4, blurb: 'warm. It has been on that shelf a while.',
  icon: (g) => {
    box(g, '#b9bcc2', 8, 4, 9, 17);                    // aluminium
    box(g, '#8f9298', 8, 4, 2, 17);                    // the shaded side
    box(g, '#d0d3d8', 8, 3, 9, 2);                     // the lid
    box(g, '#b03a2e', 8, 9, 9, 6);                     // the band
    box(g, '#e8e2d0', 10, 11, 5, 2);
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
export const PACKAGE_TABLE: string[] = [
  defineItem({
    id: 'VHS', name: 'video tape', stack: 2, blurb: 'no label. Somebody taped over something.',
    icon: (g) => {
      box(g, '#1e2024', 2, 6, 20, 13);                 // the shell
      box(g, '#34383e', 2, 6, 20, 1);
      box(g, '#c8c2ac', 4, 8, 16, 4);                  // the write-on label, blank
      box(g, '#0d0e10', 6, 14, 12, 3);                 // the window
      box(g, '#5a5f66', 7, 15, 3, 1); box(g, '#5a5f66', 14, 15, 3, 1);
    },
  }).id,
  defineItem({
    id: 'TRAINERS', name: 'pair of trainers', stack: 1, blurb: 'two sizes too big, and white.',
    icon: (g) => {
      box(g, '#e4e2da', 3, 9, 18, 8);                  // upper
      box(g, '#c6c3b8', 3, 15, 18, 3);                 // midsole
      box(g, '#8f8c83', 3, 18, 18, 1);                 // outsole
      box(g, '#e4e2da', 12, 6, 9, 4);                  // the ankle
      box(g, '#b03a2e', 6, 11, 9, 2);                  // the stripe, which is the whole read
      box(g, '#ffffff', 13, 7, 6, 1);
    },
  }).id,
  defineItem({
    id: 'TOASTER', name: 'toaster', stack: 1, blurb: 'a toaster. You have stolen a toaster.',
    icon: (g) => {
      box(g, '#b6b9bf', 3, 7, 18, 12);                 // chrome slab
      box(g, '#d6d9de', 3, 7, 18, 2);                  // the top highlight
      box(g, '#8c8f95', 3, 17, 18, 2);
      box(g, '#26282c', 6, 5, 5, 3); box(g, '#26282c', 13, 5, 5, 3);   // two slots
      box(g, '#5a5f66', 20, 10, 2, 5);                 // the lever
      box(g, '#7a5a2e', 21, 14, 2, 6);                 // and the flex, going off
    },
  }).id,
  defineItem({
    id: 'CHEQUES', name: 'book of cheques', stack: 4, blurb: 'someone else’s name on every one.',
    icon: (g) => {
      box(g, '#c9d6cc', 3, 7, 18, 11);                 // bank green
      box(g, '#eef1ec', 3, 7, 18, 2);
      box(g, '#7d8a80', 5, 11, 10, 1); box(g, '#7d8a80', 5, 14, 8, 1);
      box(g, '#4a5a4e', 15, 13, 5, 3);                 // the amount box
      for (let x = 4; x < 21; x += 3) box(g, '#9aa79d', x, 18, 1, 2);  // the perforation
    },
  }).id,
  defineItem({
    id: 'SOCKS', name: 'pack of tube socks', stack: 4, blurb: 'six pairs, tube, white.',
    icon: (g) => {
      for (const y of [5, 13]) {
        box(g, '#eceade', 3, y, 18, 6);                // a rolled tube
        box(g, '#d2d0c4', 3, y + 5, 18, 1);
        box(g, '#b03a2e', 16, y + 1, 2, 4);            // the two bands at the top
        box(g, '#2f4a8a', 19, y + 1, 2, 4);
      }
    },
  }).id,
  defineItem({
    id: 'CATALOGUE', name: 'mail-order catalogue', stack: 2, blurb: 'the thing that sells the things.',
    icon: (g) => {
      box(g, '#8a7a58', 4, 3, 16, 18);                 // the block of pages, edge on
      box(g, '#d8cfae', 4, 3, 15, 18);                 // the cover
      box(g, '#b03a2e', 4, 3, 15, 4);                  // the masthead band
      box(g, '#6a5a3c', 6, 9, 11, 7);                  // the photograph
      box(g, '#9a8c68', 7, 11, 4, 4);
      box(g, '#6a5a3c', 6, 17, 8, 1);
    },
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
export const POCKETS = 6;

/** The kinds you are actually carrying, in the order you first picked them up. */
export function slots(p: Purse): string[] {
  return Object.keys(p.inv).filter((k) => (p.inv[k] ?? 0) > 0);
}

/** How many more of `id` you could take right now. 0 means full FOR THAT ITEM. */
export function roomFor(p: Purse, id: string): number {
  const have = p.inv[id] ?? 0;
  if (have > 0) return Math.max(0, itemOf(id).stack - have);
  return slots(p).length >= POCKETS ? 0 : itemOf(id).stack;
}

/** Are all six pockets in use? Ask this to WORD A PROMPT before offering. */
export function pocketsFull(p: Purse): boolean {
  return slots(p).length >= POCKETS;
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
 *     import { giveRandom, pocketsFull } from './inventory';
 *     …
 *     label: () => (pocketsFull(ctx.purse)
 *       ? 'pockets full — you cannot carry it'
 *       : 'steal the package'),
 *     act: () => { const got = giveRandom(ctx); if (got.taken) removeThePackage(); },
 *
 * Gate the LABEL on `pocketsFull` as above so the refusal is readable before
 * the key is pressed, and gate whatever the act consumes on `got.taken`, so a
 * refused steal does not silently destroy the package it could not fit.
 */
export function giveRandom(ctx: CtxBuild, table: string[] = PACKAGE_TABLE): { id: string; def: ItemDef; taken: boolean } {
  const id = table[Math.floor(Math.random() * table.length)];
  const def = itemOf(id);
  const taken = give(ctx.purse, id, 1) > 0;
  ctx.refreshWallet();
  if (taken) note(`${def.name} — ${def.blurb}`);
  else note(`no room — ${POCKETS} of ${POCKETS} pockets full`);
  return { id, def, taken };
}

// ── the screen ────────────────────────────────────────────────────────────
//
// Set by `makeHud()`. Held as a module local rather than threaded through every
// call because a takeable is registered at BUILD time and posts its line at
// PLAY time, and the caller registering it has no business holding the HUD.
let HUD: Hud | null = null;
export function bindHud(h: Hud): void { HUD = h; }
function note(text: string): void { HUD?.note(text); }

// ── THE PANEL ─────────────────────────────────────────────────────────────
//
// Your pockets, held open in front of you. A view onto exactly the same
// `Purse.inv` the wallet's left leaf lists — two views, one set of pockets.
//
// WHY IT IS CLOTH AND NOT A MENU. The wallet was a corner popup once and the
// user replaced it with an object you hold: *"an open bifold gripped in both
// thumbs, centred and sliding up into first-person view"*. This is that idiom
// applied to cloth — six sewn pockets, the same thumbs on the near corners, the
// same slide, cut by the bottom of the frame so it reads as YOURS. A grid of
// squares floating in a corner would be a different game's furniture.
//
// WHY ITS OWN KEY AND NOT THE WALLET'S. The desk asked me to decide and say
// which. They are two different questions — *how much money have I got* and
// *what am I carrying* — and making one a second press of the other turns a
// glance into a sequence. So: **right-click is the wallet, `i` is the pockets**,
// one gesture each. They cannot fight for the screen because they are MUTUALLY
// EXCLUSIVE: opening either closes the other. Both are drawn centred at the
// bottom of the frame, so two open at once would simply be one on top of the
// other, and "hold two objects up in front of your face at the same time" is
// not a thing hands do anyway.
//
// WHY THE MOUSE WHEEL SELECTS. Every key is spoken for: `main.ts` spends every
// DIGIT switching prototypes, and the rig has WASD, E, C, shift, space, the
// arrows, Z, X, `[` and `]`. The wheel is genuinely unused anywhere in `src/`,
// it survives pointer lock, and picking from a row by scrolling is the idiom
// this borrows from anyway.

// The caption gets its OWN band under the grid rather than sharing the last
// row's space. First cut put it at the foot of the cloth and the item name
// printed straight across the bottom row of pockets — legible in a still, a
// mess the moment a pocket under it had something in it.
const PANEL_W = 200, PANEL_H = 168;
const COLS = 3;                              // 3 × 2 = POCKETS
const CELL_W = 52, CELL_H = 42, GAP = 6;
const GRID_X = 16, GRID_Y = 14;
const CLOTH_X = 12, CLOTH_Y = 8, CLOTH_W = 176, CLOTH_H = 130;

let panelWrap: HTMLDivElement | null = null;
let panelCv: HTMLCanvasElement | null = null;
let panelOpen = false;
let sel = 0;
/** the purse the panel is a view onto. Set by `register`. */
let PURSE: Purse | null = null;

function buildPanel(): void {
  if (panelWrap) return;
  const found = document.getElementById('ct-pockets') as HTMLDivElement | null;
  if (found) {
    panelWrap = found;
    panelCv = found.firstChild as HTMLCanvasElement;
  } else {
    panelWrap = document.createElement('div');
    panelWrap.id = 'ct-pockets';
    // Same construction as the wallet in ct/hud.ts, deliberately: same z-index
    // band, same transition, same translateY parking spot off the bottom. A
    // sibling should move like its sibling.
    panelWrap.style.cssText = 'position:fixed;left:50%;bottom:-10px;z-index:11;pointer-events:none;'
      + 'transform:translateX(-50%) translateY(150%) rotate(-1.5deg);transition:transform .18s ease-out;';
    panelCv = document.createElement('canvas');
    panelCv.style.cssText = 'width:378px;height:317px;image-rendering:pixelated;display:block;';
    panelWrap.appendChild(panelCv);
    document.body.appendChild(panelWrap);
  }
  panelCv.width = PANEL_W; panelCv.height = PANEL_H;
}

function paintPanel(): void {
  if (!panelCv || !PURSE) return;
  const g = panelCv.getContext('2d')!;
  const p = PURSE;
  g.clearRect(0, 0, PANEL_W, PANEL_H);

  // the cloth. Canvas duck, worn, with a stitched border — not leather, so it
  // cannot be mistaken for the wallet at a glance from the same position.
  const cx0 = CLOTH_X, cy0 = CLOTH_Y, cw = CLOTH_W, ch = CLOTH_H;
  box(g, '#2a2620', cx0 - 3, cy0 - 3, cw + 6, ch + 6);          // edge shadow
  box(g, '#7a7360', cx0, cy0, cw, ch);                          // duck
  box(g, '#8a8370', cx0, cy0, cw, 3);                           // top light
  box(g, '#5f5947', cx0, cy0 + ch - 4, cw, 4);
  g.strokeStyle = 'rgba(222,210,180,0.20)'; g.setLineDash([3, 3]);
  g.strokeRect(cx0 + 4.5, cy0 + 4.5, cw - 9, ch - 9); g.setLineDash([]);

  const held = slots(p);
  for (let i = 0; i < POCKETS; i++) {
    const gx = GRID_X + (i % COLS) * (CELL_W + GAP);
    const gy = GRID_Y + Math.floor(i / COLS) * (CELL_H + GAP);
    // the pocket: a patch sewn on, so it sits PROUD of the cloth rather than
    // being a hole cut in it — a hole would read as a slot in a menu. It has to
    // be a good two tones off the cloth or the six of them merge into one
    // rectangle, which is what the first cut did.
    box(g, '#3f3b2e', gx, gy, CELL_W, CELL_H);                  // the seam
    box(g, '#4e4939', gx + 1, gy + 1, CELL_W - 2, CELL_H - 2);  // the patch
    box(g, '#6d6754', gx + 1, gy + 1, CELL_W - 2, 2);           // the hem, catching the light
    const id = held[i];
    if (id) {
      const def = itemOf(id);
      g.save();
      g.translate(gx + (CELL_W - 24) / 2, gy + (CELL_H - 24) / 2 + 1);
      (def.icon ?? PARCEL)(g);
      g.restore();
      const n = p.inv[id] ?? 0;
      if (n > 1) {                                              // the count, bottom right
        g.fillStyle = '#1e1b16'; g.font = 'bold 8px monospace'; g.textAlign = 'right';
        g.fillText(`${n}`, gx + CELL_W - 3, gy + CELL_H - 3);
        g.fillStyle = '#e8e2d0';
        g.fillText(`${n}`, gx + CELL_W - 4, gy + CELL_H - 4);
      }
    }
    if (i === sel) {
      // The selection. Two nested strokes, dark outside and pale inside — the
      // SAME two-tone trick `hud.highlight` uses on the world, so "selected"
      // means one thing whether it is a door out there or a pocket in here.
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1;
      g.strokeRect(gx - 1.5, gy - 1.5, CELL_W + 3, CELL_H + 3);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.strokeRect(gx - 0.5, gy - 0.5, CELL_W + 1, CELL_H + 1);
    }
  }

  // the caption — its OWN band, under the grid, on a darker strip so the text
  // is never read against a pocket
  const bandY = GRID_Y + 2 * CELL_H + GAP + 4;                  // 14 + 84 + 6 + 4 = 108
  box(g, '#5f5947', cx0 + 6, bandY, cw - 12, 24);
  box(g, '#4e4939', cx0 + 6, bandY, cw - 12, 1);
  const id = held[sel];
  g.textAlign = 'center';
  if (id) {
    const def = itemOf(id);
    g.fillStyle = '#f0ead6'; g.font = 'bold 8px monospace';
    g.fillText(def.name.toUpperCase(), PANEL_W / 2, bandY + 10);
    g.fillStyle = '#c2ba9f'; g.font = '7px monospace';
    // SAY IT BEFORE THE KEY, not after. Only a thing that came off the ground
    // has an object to put back — a cereal box bought over a counter never had
    // one — and the first cut let you select it, press G, and be told no. That
    // is the same fault as an ungated "steal the package" prompt on full
    // pockets, and it gets the same fix: the refusal is in the caption you are
    // already reading. Found by K-pocket-panel, which could not write its own
    // discriminating test until this was visible.
    g.fillText(canDrop(id) ? def.blurb || 'G to drop it' : 'nothing to put it back as', PANEL_W / 2, bandY + 20);
  } else {
    g.fillStyle = '#c2ba9f'; g.font = '8px monospace';
    g.fillText(held.length ? 'empty pocket' : 'your pockets are empty', PANEL_W / 2, bandY + 10);
    g.fillStyle = '#9a927e'; g.font = '7px monospace';
    g.fillText('scroll to choose · G to drop', PANEL_W / 2, bandY + 20);
  }
  // NO "n/6" NUMBER HERE, and that is the point of the thing being physical:
  // six pockets are DRAWN, two with something in them and four plainly empty.
  // The wallet carries the figure because a list of what you have cannot show
  // you what you have not. Printing it here as well put it on the same line as
  // the blurb, and the fix is to delete it rather than find it another corner.

  // Thumbs on the near corners — the wallet's own gesture, its own skin tones.
  // Run OFF THE BOTTOM of the canvas rather than stopping short of it: a limb
  // cut by the frame reads as your own, and one floating with air under it
  // reads as a disembodied thumb. Same reasoning as the watch's forearm.
  const thumb = (tx: number) => {
    box(g, '#c9946a', tx, cy0 + ch - 22, 26, PANEL_H - (cy0 + ch - 22));
    box(g, '#d8a67d', tx, cy0 + ch - 22, 26, 3);
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(tx + 7, cy0 + ch - 14, 12, 14);
  };
  thumb(cx0 - 8); thumb(cx0 + cw - 18);
}

/** Repaint if it happens to be out. Called from `hud.refreshWallet()`, which is
 *  the one signal in the world that says "the purse changed" — one signal, both
 *  views, so the panel cannot drift from the wallet. */
export function refreshPockets(): void { if (panelOpen) paintPanel(); }

/** Put the pockets away. `ct/hud.ts` calls this when the WALLET opens. */
export function closePockets(): void {
  if (!panelOpen || !panelWrap) return;
  panelOpen = false;
  panelWrap.style.transform = 'translateX(-50%) translateY(150%) rotate(-1.5deg)';
}

export function togglePockets(): void {
  if (!panelWrap || !PURSE) return;
  panelOpen = !panelOpen;
  if (panelOpen) {
    HUD?.closeWallet();                        // mutually exclusive, see above
    sel = Math.min(sel, POCKETS - 1);
    paintPanel();
  }
  panelWrap.style.transform = panelOpen
    ? 'translateX(-50%) translateY(0) rotate(-1.5deg)'
    : 'translateX(-50%) translateY(150%) rotate(-1.5deg)';
}

export function pocketsOpen(): boolean { return panelOpen; }

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
    ok: () => !held && (o.ok ? o.ok() : true),
    label: () => (roomFor(ctx.purse, o.id) > 0
      ? `take the ${def.name}`
      : `pockets full — no room for the ${def.name}`),
    act: () => {
      if (give(ctx.purse, o.id, 1) < 1) {
        note(`pockets full — ${slots(ctx.purse).length} of ${POCKETS}`);
        return;
      }
      o.obj.visible = false;                       // it LEAVES THE GROUND
      held = true;
      ctx.refreshWallet();
      note(def.blurb ? `${def.name} — ${def.blurb}` : `pocketed the ${def.name}`);
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
  note(`dropped the ${itemOf(t.id).name}`);
  return true;
}

// ── wiring ────────────────────────────────────────────────────────────────

let keysBound = false;

export function register(ctx: CtxBuild): void {
  PURSE = ctx.purse;
  buildPanel();

  // I opens the pockets, G drops. Chosen because `ct/../main.ts` already spends
  // every DIGIT on switching prototypes and W A S D E C SHIFT SPACE Z X [ ] on
  // the rig, so the free keys are few — and these two are the ones every other
  // game in this genre uses, which is worth more than cleverness.
  if (!keysBound) {
    keysBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') { togglePockets(); return; }
      if (k === 'escape' && panelOpen) { closePockets(); return; }
      if (k !== 'g') return;
      // WITH THE POCKETS OPEN, G DROPS WHAT YOU CHOSE; with them shut it drops
      // the last thing you picked up. Same key, and the difference is visible
      // on screen at the moment you press it — which is the only kind of modal
      // key that is not a trap.
      if (panelOpen) {
        const id = selected(ctx.purse);
        if (id) { if (dropId(ctx, id)) paintPanel(); }
        else note('that pocket is empty');
      } else dropLast(ctx);
    });
    // Selection. `passive: false` because the page must not scroll under the
    // panel; outside it the wheel is left entirely alone, since nothing else in
    // this world uses it and swallowing it would be taking something for nothing.
    window.addEventListener('wheel', (e) => {
      if (!panelOpen) return;
      e.preventDefault();
      sel = (sel + (e.deltaY > 0 ? 1 : POCKETS - 1)) % POCKETS;
      paintPanel();
    }, { passive: false });
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
