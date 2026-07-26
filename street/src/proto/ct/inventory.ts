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
  return { id, name: id.toLowerCase(), stack: 4, blurb: '' };
}

// The things that exist today. Deliberately few — the desk's instruction was
// *"propose the item list — do not invent twenty"*, and a table of things you
// cannot actually obtain is worse than a short one.
defineItem({
  id: 'NEWSPAPER', name: 'folded newspaper', stack: 2,
  blurb: 'yesterday’s, and somebody has stood on it.',
});
// Already purchasable at the bodega counter (ct/int-bodega.ts) and already in
// the starting purse, so these two are declared rather than introduced.
defineItem({ id: 'CEREAL', name: 'box of cereal', stack: 4, blurb: 'the birds prefer it to you.' });
defineItem({ id: 'SODA', name: 'can of soda', stack: 4, blurb: 'warm. It has been on that shelf a while.' });

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
  defineItem({ id: 'VHS', name: 'video tape', stack: 2, blurb: 'no label. Somebody taped over something.' }).id,
  defineItem({ id: 'TRAINERS', name: 'pair of trainers', stack: 1, blurb: 'two sizes too big, and white.' }).id,
  defineItem({ id: 'TOASTER', name: 'toaster', stack: 1, blurb: 'a toaster. You have stolen a toaster.' }).id,
  defineItem({ id: 'CHEQUES', name: 'book of cheques', stack: 4, blurb: 'someone else’s name on every one.' }).id,
  defineItem({ id: 'SOCKS', name: 'pack of tube socks', stack: 4, blurb: 'six pairs, tube, white.' }).id,
  defineItem({ id: 'CATALOGUE', name: 'mail-order catalogue', stack: 2, blurb: 'the thing that sells the things.' }).id,
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
    const t = TAKEN[i];
    if ((ctx.purse.inv[t.id] ?? 0) < 1) continue;   // spent it, or never had it
    TAKEN.splice(i, 1);
    takeOne(ctx.purse, t.id);
    t.restore(ctx.player.x(), ctx.player.z(), ctx.player.gy());
    ctx.refreshWallet();
    note(`dropped the ${itemOf(t.id).name}`);
    return true;
  }
  note(TAKEN.length || slots(ctx.purse).length
    ? 'nothing in hand you could put down'
    : 'your pockets are empty');
  return false;
}

// ── wiring ────────────────────────────────────────────────────────────────

let keysBound = false;

export function register(ctx: CtxBuild): void {
  // G to drop. Chosen because `ct/../main.ts` already spends every DIGIT on
  // switching prototypes and W A S D E C SHIFT SPACE Z X [ ] on the rig, so the
  // free keys are few and G is the one every other game in this genre uses.
  if (!keysBound) {
    keysBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'g') dropLast(ctx);
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
  };
}
