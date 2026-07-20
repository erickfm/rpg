import type { ActionResult, GameState } from './types';

/** Where you live. The loft is the aspirational upgrade. */
export type HomeTier = 'studio' | 'loft';

export interface HomeDef {
  id: HomeTier;
  name: string;
  price: number;
  /** which interior room to load */
  room: 'home' | 'loft';
}

export const HOMES: Record<HomeTier, HomeDef> = {
  studio: { id: 'studio', name: 'Maple Court Studio', price: 0, room: 'home' },
  loft:   { id: 'loft',   name: 'Skyline Loft', price: 3500, room: 'loft' },
};

export function homeDef(s: GameState): HomeDef {
  return HOMES[s.home];
}

/** Which interior the home door should open. */
export function homeRoom(s: GameState): 'home' | 'loft' {
  return HOMES[s.home].room;
}

/** Buy the loft. Paid from cash on hand (withdraw from savings first). */
export function buyHome(s: GameState, tier: HomeTier): ActionResult {
  const def = HOMES[tier];
  if (s.home === tier) return { ok: false, state: s, msg: `You already live at the ${def.name}.` };
  if (def.price === 0) return { ok: false, state: s, msg: 'That one is not for sale.' };
  if (s.cash < def.price) {
    return { ok: false, state: s, msg: `The ${def.name} needs $${def.price.toLocaleString()} down — in cash. Hit the ATM.` };
  }
  return {
    ok: true,
    state: { ...s, cash: s.cash - def.price, home: tier },
    msg: `The keys to the ${def.name} are yours. Welcome home.`,
  };
}
