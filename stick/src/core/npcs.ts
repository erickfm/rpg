import type { ActionResult, GameState } from './types';
import { addItem, addKarma, addStat, itemCount } from './state';

export const HAROLD_HANDOUT = 10;

export function giveToHarold(s: GameState): ActionResult {
  if (s.cash < HAROLD_HANDOUT) return { ok: false, state: s, msg: 'You don’t even have $10.' };
  let next: GameState = { ...s, cash: s.cash - HAROLD_HANDOUT };
  next = addKarma(next, 2);
  next = addStat(next, 'charm', 1);
  return { ok: true, state: next, msg: '"Bless ya." Harold looks at you like you hung the moon. +1 Charm.' };
}

export function giveBottleToHarold(s: GameState): ActionResult {
  if (itemCount(s, 'bottle') < 1) return { ok: false, state: s, msg: 'You have no bottles.' };
  let next = addItem(s, 'bottle', -1);
  next = addKarma(next, 1);
  return { ok: true, state: next, msg: 'Harold cradles the 40 like a newborn.' };
}

/** How many packs the Punk survives — fixed per run, 4 to 6. */
export function punkDeathThreshold(s: GameState): number {
  return 4 + (s.seed % 3);
}

export function giveSmokesToPunk(s: GameState): ActionResult {
  if (s.punkDead) return { ok: false, state: s, msg: 'The spot where he used to skate is very quiet.' };
  if (itemCount(s, 'smokes') < 1) {
    return { ok: false, state: s, msg: '"You got smokes or not? I left my I.D. at home, I swear."' };
  }
  let next = addItem(s, 'smokes', -1);
  next = { ...next, punkSmokes: next.punkSmokes + 1 };
  if (next.punkSmokes === 1) {
    next = { ...next, hasSkateboard: true };
    next = addKarma(next, -1);
    return {
      ok: true,
      state: next,
      msg: '"Sweet. Here, take my old board." You got a SKATEBOARD!',
    };
  }
  if (next.punkSmokes >= punkDeathThreshold(next)) {
    next = { ...next, punkDead: true };
    next = addKarma(next, -30);
    next = {
      ...next,
      messages: [
        ...next.messages,
        'Detective McHolland: "The kid by the road died of smoke inhalation. Witnesses mention a generous stranger. I’m watching you."',
      ],
    };
    return {
      ok: true,
      state: next,
      msg: 'He takes the pack, coughs once... and keels over. Oh no.',
    };
  }
  next = addKarma(next, -2);
  return { ok: true, state: next, msg: '"You’re alright, you know that?" His cough is getting worse.' };
}

export const HOTWIRE_INT = 350;

export function hotwireCar(s: GameState): ActionResult {
  if (s.hasCar) return { ok: false, state: s, msg: 'It’s already "yours".' };
  if (s.stats.intelligence < HOTWIRE_INT) {
    return {
      ok: false,
      state: s,
      msg: 'A tangle of wires stares back at you. You have no idea where to even start.',
    };
  }
  return {
    ok: true,
    state: { ...s, hasCar: true },
    msg: 'Two sparks and a cough — the yellow car lives! You can drive now.',
  };
}
