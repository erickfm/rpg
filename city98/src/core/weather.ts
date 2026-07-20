import type { GameState } from './types';

/**
 * Deterministic weather. Each day draws a condition from the run seed, and
 * within a day the intensity eases in and out so mornings and evenings can
 * differ from midday. Pure — the renderer reads `weatherAt` every frame.
 */

export type Sky = 'clear' | 'overcast' | 'rain' | 'storm';

export interface Weather {
  sky: Sky;
  /** 0..1 precipitation intensity right now (0 for clear/overcast). */
  intensity: number;
  /** 0..1 how grey/wet the world looks (rises with overcast and rain). */
  gloom: number;
}

const ORDER: Sky[] = ['clear', 'overcast', 'rain', 'storm'];

/** The day's headline condition — deterministic per run + day. */
export function skyForDay(seed: number, day: number): Sky {
  const r = hash(seed ^ (day * 0x9e3779b1));
  // clear is common, storms rare
  if (r < 0.5) return 'clear';
  if (r < 0.78) return 'overcast';
  if (r < 0.94) return 'rain';
  return 'storm';
}

/** A 0..1 envelope over the day so weather builds and fades. */
function envelope(minute: number, seed: number, day: number): number {
  // peak time wanders a little per day
  const peak = 660 + (hash(seed ^ (day * 2246822519)) - 0.5) * 360; // ~9am–3pm
  const width = 420;
  const d = Math.abs(minute - peak) / width;
  return Math.max(0, 1 - d * d);
}

export function weatherAt(s: GameState): Weather {
  const sky = skyForDay(s.seed, s.day);
  const env = envelope(s.minute, s.seed, s.day);
  switch (sky) {
    case 'clear':
      return { sky, intensity: 0, gloom: 0 };
    case 'overcast':
      return { sky, intensity: 0, gloom: 0.35 + env * 0.25 };
    case 'rain':
      return { sky, intensity: 0.35 + env * 0.5, gloom: 0.6 + env * 0.2 };
    case 'storm':
      return { sky, intensity: 0.6 + env * 0.4, gloom: 0.75 + env * 0.2 };
  }
}

export function isWet(w: Weather): boolean {
  return w.sky === 'rain' || w.sky === 'storm';
}

/** Extra energy drained per game-hour when caught out in the wet, unsheltered. */
export function soakDrainPerHour(w: Weather, sheltered: boolean): number {
  if (sheltered || !isWet(w)) return 0;
  return 4 + w.intensity * 8; // a downpour is genuinely miserable
}

export function skyLabel(sky: Sky): string {
  switch (sky) {
    case 'clear': return 'Clear skies';
    case 'overcast': return 'Overcast';
    case 'rain': return 'Rain';
    case 'storm': return 'Thunderstorm';
  }
}

/** Rank helper for tests: later in ORDER = worse weather. */
export function severity(sky: Sky): number {
  return ORDER.indexOf(sky);
}

function hash(n: number): number {
  let a = n >>> 0;
  a = Math.imul(a ^ (a >>> 15), 1 | a);
  a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}
