import type { FurnitureId, GameState, ItemId, Stats } from './types';

export const STAT_CAP = 999;
export const KARMA_CAP = 100;

/** The original starts a fresh character at 23/23 HP with rolled stats around 3. */
export function maxHp(s: GameState): number {
  return 20 + s.stats.strength;
}

export function clampStat(v: number): number {
  return Math.max(0, Math.min(STAT_CAP, Math.round(v)));
}

export function addStat(s: GameState, key: keyof Stats, amount: number): GameState {
  return { ...s, stats: { ...s.stats, [key]: clampStat(s.stats[key] + amount) } };
}

export function addKarma(s: GameState, amount: number): GameState {
  return { ...s, karma: Math.max(-KARMA_CAP, Math.min(KARMA_CAP, s.karma + amount)) };
}

/** Damage or heal; dropping to 0 HP kills the character. */
export function addHp(s: GameState, amount: number, cause?: string): GameState {
  const hp = Math.max(0, Math.min(maxHp(s), s.hp + Math.round(amount)));
  if (hp === 0 && amount < 0) {
    return { ...s, hp, dead: true, deathCause: cause ?? 'You died.' };
  }
  return { ...s, hp };
}

export function itemCount(s: GameState, item: ItemId): number {
  return s.inventory[item] ?? 0;
}

export function addItem(s: GameState, item: ItemId, count = 1): GameState {
  const next = Math.max(0, itemCount(s, item) + count);
  const inventory = { ...s.inventory };
  if (next === 0) delete inventory[item];
  else inventory[item] = next;
  return { ...s, inventory };
}

export function hasFurniture(s: GameState, id: FurnitureId): boolean {
  return s.furniture.includes(id);
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(raw: string): GameState | null {
  try {
    const s = JSON.parse(raw);
    if (
      s &&
      s.version === 2 &&
      typeof s.day === 'number' &&
      typeof s.minute === 'number' &&
      typeof s.cash === 'number' &&
      typeof s.hp === 'number' &&
      typeof s.karma === 'number' &&
      s.stats &&
      typeof s.stats.strength === 'number' &&
      s.inventory &&
      Array.isArray(s.furniture) &&
      s.stockPrices
    ) {
      return s as GameState;
    }
  } catch {
    // corrupt or old save — treat as absent
  }
  return null;
}
