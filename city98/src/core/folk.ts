import type { Rng } from './rng';
import { mulberry32 } from './rng';

// A citizen's physical archetype — everything that makes one passer-by look like a
// different person than the next, drawn deterministically so a given seed is always
// the same individual. Pure data; the render layer turns it into geometry.

export type Build = 0 | 1 | 2; // slim, average, stocky
export type HairStyle = 0 | 1 | 2 | 3 | 4 | 5; // short, side-part, bald, long/bob, ponytail, receding
export type Outfit = 'pants' | 'skirt' | 'longcoat';
export type Bag = 'none' | 'shoulder' | 'backpack';

export const HAIR_STYLES = 6;
export const BUILD_WIDTH: Record<Build, number> = { 0: 0.86, 1: 1.0, 2: 1.2 };

export interface Folk {
  build: Build;
  height: number; // whole-body scale, ~0.88–1.12
  width: number; // lateral scale from build
  hairStyle: HairStyle;
  glasses: boolean;
  outfit: Outfit;
  bag: Bag;
}

/** Draw one archetype from a PRNG stream. Advances the stream deterministically. */
export function folk(rng: Rng): Folk {
  const build = (rng() < 0.28 ? 0 : rng() < 0.72 ? 1 : 2) as Build;
  const height = 0.88 + rng() * 0.24;
  const hairStyle = Math.floor(rng() * HAIR_STYLES) as HairStyle;
  const glasses = rng() < 0.22;
  const o = rng();
  const outfit: Outfit = o < 0.6 ? 'pants' : o < 0.82 ? 'skirt' : 'longcoat';
  const b = rng();
  const bag: Bag = b < 0.62 ? 'none' : b < 0.84 ? 'shoulder' : 'backpack';
  return { build, height, width: BUILD_WIDTH[build], hairStyle, glasses, outfit, bag };
}

/** A stable archetype for a fixed identity (a named citizen), keyed off a string id. */
export function folkFromId(id: string): Folk {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return folk(mulberry32(h >>> 0));
}

/** The average, unremarkable build — used for the player's own avatar. */
export function plainFolk(): Folk {
  return { build: 1, height: 1, width: 1, hairStyle: 0, glasses: false, outfit: 'pants', bag: 'none' };
}
