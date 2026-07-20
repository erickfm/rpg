import type { ActionResult, GameState } from './types';

/** Character looks. Palettes are indices into the render-side color arrays. */
export const SHIRT_COLORS = [0x9c2f2f, 0x2f6a9c, 0x3c8a5a, 0x8a3c8a, 0xd8a83c, 0x4a9c9c, 0xd86a2f, 0x30323a];
export const HAIR_COLORS = [0x2c2018, 0x4a3320, 0x8a6a3a, 0xb8b0a0, 0x1c1c20, 0xa03c3c];
export const SKIN_COLORS = [0xe8c49c, 0xc89670, 0x9c6a48, 0x7a4f34, 0xf0d4b0];

export interface Appearance {
  name: string;
  shirt: number; // index into SHIRT_COLORS
  hair: number;
  skin: number;
}

export function defaultAppearance(): Appearance {
  return { name: 'Sam', shirt: 1, hair: 0, skin: 0 };
}

const wrap = (i: number, len: number) => ((i % len) + len) % len;

export function cycleShirt(s: GameState, dir = 1): ActionResult {
  const shirt = wrap(s.look.shirt + dir, SHIRT_COLORS.length);
  return { ok: true, state: { ...s, look: { ...s.look, shirt } }, msg: 'You try a different shirt.' };
}

export function cycleHair(s: GameState, dir = 1): ActionResult {
  const hair = wrap(s.look.hair + dir, HAIR_COLORS.length);
  return { ok: true, state: { ...s, look: { ...s.look, hair } }, msg: 'A bold new hairstyle. Well, color.' };
}

export function cycleSkin(s: GameState, dir = 1): ActionResult {
  const skin = wrap(s.look.skin + dir, SKIN_COLORS.length);
  return { ok: true, state: { ...s, look: { ...s.look, skin } }, msg: 'You consider yourself in the mirror.' };
}

export function setName(s: GameState, name: string): ActionResult {
  const clean = name.trim().slice(0, 16);
  if (!clean) return { ok: false, state: s, msg: 'A name of some kind, please.' };
  return { ok: true, state: { ...s, look: { ...s.look, name: clean } }, msg: `Hello, ${clean}.` };
}
