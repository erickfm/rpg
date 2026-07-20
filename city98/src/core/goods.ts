import type { ActionResult, GameState } from './types';

/**
 * Things you can own. Records build a music collection you play on the home
 * stereo; a few apartment goods are one-off upgrades. All titles are
 * invented — this is a fictional 1998, not a real catalog.
 */

export type GoodKind = 'record' | 'upgrade';

export interface Good {
  id: string;
  kind: GoodKind;
  name: string;
  by?: string; // fictional artist
  price: number;
  /** For records: which radio-style station mood it plays (see audio). */
  mood?: number;
  blurb: string;
}

export const RECORDS: Good[] = [
  { id: 'rec_neon', kind: 'record', name: 'Neon Overpass', by: 'The Tuesday Committee', price: 14, mood: 1, blurb: 'Synth-pop. Every song is about a parking garage at night.' },
  { id: 'rec_gravel', kind: 'record', name: 'Gravel Road Anthems', by: 'Denim Thunder', price: 12, mood: 0, blurb: 'Bar-band rock. Comes with a free guitar-pick smell.' },
  { id: 'rec_midnight', kind: 'record', name: 'Midnight Rotary', by: 'Cole Vesper Trio', price: 16, mood: 2, blurb: 'Smoky late-night jazz for staring out a rainy window.' },
  { id: 'rec_static', kind: 'record', name: 'Basement Static', by: 'Fuzz Committee', price: 11, mood: 3, blurb: 'College-radio fuzz. Recorded in an actual basement, allegedly.' },
];

export const UPGRADES: Good[] = [
  { id: 'up_stereo', kind: 'upgrade', name: 'Component Stereo', price: 120, blurb: 'A real hi-fi. Now your records have somewhere to live.' },
  { id: 'up_plant', kind: 'upgrade', name: 'Resilient Houseplant', price: 18, blurb: 'It survives you. A small green vote of confidence.' },
  { id: 'up_lamp', kind: 'upgrade', name: 'Lava Lamp', price: 24, blurb: 'Ambiance in a bottle. Mesmerizing after a double shift.' },
  { id: 'up_umbrella', kind: 'upgrade', name: 'Golf Umbrella', price: 16, blurb: 'Enormous, plaid, indestructible. Laughs at rain.' },
];

export const ALL_GOODS: Good[] = [...RECORDS, ...UPGRADES];

export function goodById(id: string): Good | undefined {
  return ALL_GOODS.find(g => g.id === id);
}

export function owns(s: GameState, id: string): boolean {
  return s.goods.includes(id);
}

export function ownedRecords(s: GameState): Good[] {
  return RECORDS.filter(r => s.goods.includes(r.id));
}

export function hasStereo(s: GameState): boolean {
  return s.goods.includes('up_stereo');
}

export function hasUmbrella(s: GameState): boolean {
  return s.goods.includes('up_umbrella');
}

/** Remove a good (used when a quest consumes a record). count<0 removes. */
export function addItem(s: GameState, id: string, count: number): GameState {
  if (count < 0) return { ...s, goods: s.goods.filter(g => g !== id) };
  return owns(s, id) ? s : { ...s, goods: [...s.goods, id] };
}

export function buyGood(s: GameState, id: string): ActionResult {
  const good = goodById(id);
  if (!good) return { ok: false, state: s, msg: 'They don’t carry that.' };
  if (owns(s, id)) return { ok: false, state: s, msg: `You already own ${good.name}.` };
  if (s.cash < good.price) return { ok: false, state: s, msg: `That’s $${good.price}. Not today.` };
  return {
    ok: true,
    state: { ...s, cash: s.cash - good.price, goods: [...s.goods, id] },
    msg: good.kind === 'record'
      ? `Bought "${good.name}". Give it a spin at home.`
      : `Bought the ${good.name}. Adds a little life to the place.`,
  };
}
