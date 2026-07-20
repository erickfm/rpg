import type { GameState } from './types';
import type { Rng } from './rng';
import { STAT_CAP } from './state';

export const DAY_LENGTH_CHOICES = [
  { label: 'Quick game', days: 15, blurb: '15 days (hard)' },
  { label: 'Standard', days: 40, blurb: '40 days (medium)' },
  { label: 'Marathon', days: 100, blurb: '100 days (easy)' },
  { label: 'Eternity', days: null, blurb: 'Unlimited days' },
] as const;

export const CHEAT_NAME = 'HEYZEUS!!!!';

export function newGame(name: string, dayLimit: number | null, rng: Rng): GameState {
  const cheat = name === CHEAT_NAME;
  const roll = () => 1 + Math.floor(rng() * 6); // 1d6 per stat, like the intro dice
  const stats = cheat
    ? { strength: STAT_CAP, intelligence: STAT_CAP, charm: STAT_CAP }
    : { strength: roll(), intelligence: roll(), charm: roll() };
  const s: GameState = {
    version: 2,
    name: name.trim() || 'Stick',
    dayLimit,
    day: 1,
    minute: 8 * 60,
    cash: cheat ? 10_000 : 100,
    bank: 0,
    loan: 0,
    hp: 0, // set below once stats exist
    stats,
    karma: 0,
    inventory: {},
    furniture: [],
    furnitureUsed: [],
    home: 'apartment',
    jobRank: -1,
    shiftsAtRank: 0,
    hasSkateboard: false,
    hasCar: false,
    punkSmokes: 0,
    punkDead: false,
    cityVisits: {},
    stockPrices: { XGEN: 50, STIK: 20, DIME: 5 },
    stockOwned: { XGEN: 0, STIK: 0, DIME: 0 },
    messages: [],
    titleOffered: false,
    title: 'none',
    dead: false,
    deathCause: null,
    ended: false,
    seed: Math.floor(rng() * 0xffffffff),
  };
  return { ...s, hp: 20 + s.stats.strength };
}
