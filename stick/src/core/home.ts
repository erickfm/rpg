import type { ActionResult, FurnitureId, GameState, HomeTier } from './types';
import { addKarma, addStat, hasFurniture } from './state';
import { passTime } from './time';

export interface FurnitureDef {
  id: FurnitureId;
  name: string;
  price: number;
  blurb: string;
}

/** The Fine Line Furnishings catalog, prices from the wiki. */
export const FURNITURE: FurnitureDef[] = [
  { id: 'bed',          name: 'Coma-Snooze Bed',             price: 500,   blurb: 'Sleep restores full HP' },
  { id: 'encyclopedia', name: 'Stick-O-Pedia Xgenica',       price: 2000,  blurb: 'Read daily: +1 INT' },
  { id: 'computer',     name: 'Circuit-Breaking 5000',       price: 2000,  blurb: 'Browse daily: +1 INT' },
  { id: 'tv',           name: 'Behemoth-Vision TV',          price: 2500,  blurb: 'Watch daily: +1 CHA' },
  { id: 'freezer',      name: 'Deep Freeze',                 price: 2500,  blurb: 'Food heals 50% more' },
  { id: 'satellite',    name: 'Stickchoice Satellite',       price: 3000,  blurb: 'Surf daily: +1 CHA' },
  { id: 'treadmill',    name: 'Stick-Fitness Treadmill',     price: 3500,  blurb: 'Run daily: +1 STR' },
  { id: 'minibar',      name: "Suds'N'Bubbles Minibar",      price: 5000,  blurb: 'Pour daily: +2 CHA' },
];

export const FURNITURE_CAPACITY: Record<HomeTier, number> = {
  apartment: 1, // the original apartment only fits the bed
  bigger: 4,
  castle: 8,
};

export function furnitureCapacity(s: GameState): number {
  return FURNITURE_CAPACITY[s.home];
}

export function buyFurniture(s: GameState, id: FurnitureId): ActionResult {
  const def = FURNITURE.find(f => f.id === id)!;
  if (hasFurniture(s, id)) return { ok: false, state: s, msg: `You already own the ${def.name}.` };
  if (s.furniture.length >= furnitureCapacity(s)) {
    return {
      ok: false,
      state: s,
      msg: s.home === 'apartment'
        ? 'Your apartment only fits one piece — a bed. Upgrade at the bank.'
        : 'No room left — you need a bigger place.',
    };
  }
  if (s.cash < def.price) return { ok: false, state: s, msg: `The ${def.name} runs $${def.price.toLocaleString()}.` };
  return {
    ok: true,
    state: { ...s, cash: s.cash - def.price, furniture: [...s.furniture, id] },
    msg: `Delivered same-day: ${def.name}. −$${def.price.toLocaleString()}.`,
  };
}

/** Daily-use furniture: each piece works once per day (reset on sleep). */
export function useFurniture(s: GameState, id: FurnitureId): ActionResult {
  if (!hasFurniture(s, id)) return { ok: false, state: s, msg: 'You don’t own that.' };
  if (s.furnitureUsed.includes(id)) return { ok: false, state: s, msg: 'Once a day is enough.' };
  const used = (st: GameState): GameState => ({ ...st, furnitureUsed: [...st.furnitureUsed, id] });
  switch (id) {
    case 'tv': {
      const next = passTime(used(addStat(s, 'charm', 1)), 60);
      return { ok: true, state: next, msg: 'An hour of trash TV. Weirdly educational. +1 Charm.' };
    }
    case 'satellite': {
      const next = passTime(used(addStat(s, 'charm', 1)), 60);
      return { ok: true, state: next, msg: '400 channels of 2D content. +1 Charm.' };
    }
    case 'computer': {
      const next = passTime(used(addStat(s, 'intelligence', 1)), 60);
      return { ok: true, state: next, msg: 'You read the entire 2D internet. +1 Intelligence.' };
    }
    case 'encyclopedia': {
      const next = passTime(used(addStat(s, 'intelligence', 1)), 60);
      return { ok: true, state: next, msg: 'Volume XIV: Quills to Rope. +1 Intelligence.' };
    }
    case 'treadmill': {
      const next = passTime(used(addStat(s, 'strength', 1)), 60);
      return { ok: true, state: next, msg: 'You run nowhere, impressively. +1 Strength.' };
    }
    case 'minibar': {
      let next = addStat(s, 'charm', 2);
      next = addKarma(next, -1);
      next = passTime(used(next), 45);
      return { ok: true, state: next, msg: 'Home is where the bar is. +2 Charm.' };
    }
    default:
      return { ok: false, state: s, msg: 'It mostly just sits there, majestically.' };
  }
}
