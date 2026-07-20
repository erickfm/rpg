import type { ActionResult, GameState, ItemId } from './types';
import { addHp, addItem, addKarma, addStat, itemCount, maxHp } from './state';

export interface ItemDef {
  id: ItemId;
  name: string;
  price: number;
  soldAt: 'store' | 'pawn' | 'street';
  count?: number; // units per purchase (ammo comes in 5s)
  usable: boolean;
  blurb: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  slushee:    { id: 'slushee',    name: 'Slushee',          price: 1,   soldAt: 'store',  usable: true,  blurb: '+3 HP of pure syrup' },
  candy:      { id: 'candy',      name: 'Candy Bar',        price: 2,   soldAt: 'store',  usable: true,  blurb: '+5 HP' },
  nachos:     { id: 'nachos',     name: 'Nachos',           price: 4,   soldAt: 'store',  usable: true,  blurb: '+8 HP, questionable cheese' },
  smokes:     { id: 'smokes',     name: 'Smokes',           price: 10,  soldAt: 'store',  usable: true,  blurb: '+1 Charm, −10 HP' },
  caffeine:   { id: 'caffeine',   name: 'Caffeine Pills',   price: 45,  soldAt: 'store',  usable: false, blurb: 'Wake at midnight (with alarm clock)' },
  bottle:     { id: 'bottle',     name: '40 oz Bottle',     price: 30,  soldAt: 'street', usable: false, blurb: 'Tradeable booze' },
  cocaine:    { id: 'cocaine',    name: 'Cocaine (1g)',     price: 400, soldAt: 'street', usable: false, blurb: 'Highly illegal merchandise' },
  ammo:       { id: 'ammo',       name: 'Ammo (5)',         price: 10,  soldAt: 'pawn',   count: 5, usable: false, blurb: 'Rounds for the handgun' },
  knife:      { id: 'knife',      name: 'Switchblade',      price: 100, soldAt: 'pawn',   usable: false, blurb: 'Beefs up your punch' },
  alarmClock: { id: 'alarmClock', name: 'CD Alarm Clock',   price: 200, soldAt: 'pawn',   usable: false, blurb: 'Wake at 6:00 AM' },
  cellPhone:  { id: 'cellPhone',  name: 'Cell Phone',       price: 200, soldAt: 'pawn',   usable: false, blurb: 'Contacts in other cities' },
  gun:        { id: 'gun',        name: 'Handgun',          price: 400, soldAt: 'pawn',   usable: false, blurb: 'For business trips and robbery' },
};

const UNIQUE: ItemId[] = ['knife', 'alarmClock', 'cellPhone', 'gun'];

export function buyItem(s: GameState, id: ItemId): ActionResult {
  const def = ITEMS[id];
  if (UNIQUE.includes(id) && itemCount(s, id) > 0) {
    return { ok: false, state: s, msg: `You already own a ${def.name.toLowerCase()}.` };
  }
  if (s.cash < def.price) return { ok: false, state: s, msg: `You need $${def.price}.` };
  const next = addItem({ ...s, cash: s.cash - def.price }, id, def.count ?? 1);
  return { ok: true, state: next, msg: `Bought ${def.name} for $${def.price}.` };
}

/** Consumables usable from the inventory at any time. */
export function useItem(s: GameState, id: ItemId): ActionResult {
  if (itemCount(s, id) < 1) return { ok: false, state: s, msg: 'You have none left.' };
  const consumed = addItem(s, id, -1);
  switch (id) {
    case 'slushee':
      return heal(consumed, 3, 'Brain freeze. +3 HP.');
    case 'candy':
      return heal(consumed, 5, 'Chocolate courage. +5 HP.');
    case 'nachos':
      return heal(consumed, 8, 'The cheese fights back, but you win. +8 HP.');
    case 'smokes': {
      let next = addStat(consumed, 'charm', 1);
      next = addHp(next, -10, 'Smoked yourself to death.');
      return { ok: true, state: next, msg: 'You look cooler. Your lungs disagree. +1 Charm.' };
    }
    default:
      return { ok: false, state: s, msg: 'You can’t use that directly.' };
  }
}

function heal(s: GameState, amount: number, msg: string): ActionResult {
  if (s.hp >= maxHp(s)) return { ok: false, state: s, msg: 'You’re already at full health.' };
  return { ok: true, state: addHp(s, amount), msg };
}

/** Cocaine from the Red-Headed Stick, $400/g, karma-free until you sell it. */
export function buyCocaine(s: GameState, grams: number): ActionResult {
  const cost = grams * ITEMS.cocaine.price;
  if (grams < 1) return { ok: false, state: s, msg: 'How many grams?' };
  if (s.cash < cost) return { ok: false, state: s, msg: `That’s $${cost}. You don’t have it.` };
  const next = addItem({ ...s, cash: s.cash - cost }, 'cocaine', grams);
  return { ok: true, state: next, msg: `${grams}g changes hands. −$${cost}.` };
}

export function buyBottle(s: GameState): ActionResult {
  if (s.cash < ITEMS.bottle.price) return { ok: false, state: s, msg: 'You need $30.' };
  const next = addItem({ ...s, cash: s.cash - ITEMS.bottle.price }, 'bottle', 1);
  return { ok: true, state: next, msg: 'One 40 for the road. −$30.' };
}

export { addKarma };
