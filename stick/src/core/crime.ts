import type { ActionResult, GameState } from './types';
import type { Rng } from './rng';
import { addHp, addItem, addKarma, itemCount } from './state';
import { jumpDays } from './time';

function armed(s: GameState): boolean {
  return itemCount(s, 'gun') > 0 && itemCount(s, 'ammo') > 0;
}

function confiscateContraband(s: GameState): GameState {
  let next = addItem(s, 'gun', -itemCount(s, 'gun'));
  next = addItem(next, 'ammo', -itemCount(next, 'ammo'));
  next = addItem(next, 'cocaine', -itemCount(next, 'cocaine'));
  return next;
}

/** Mid-day stickup at the Funkytown Five-O. Needs the handgun and a round. */
export function robStore(s: GameState, rng: Rng): ActionResult {
  if (!armed(s)) return { ok: false, state: s, msg: 'You’d need a gun and ammo for that.' };
  if (s.minute < 10 * 60 || s.minute >= 16 * 60) {
    return { ok: false, state: s, msg: 'The register’s only worth it mid-day (10 AM – 4 PM).' };
  }
  let next = addItem(s, 'ammo', -1);
  if (rng() < 0.6) {
    const haul = 100 + Math.floor(rng() * 301);
    next = addKarma({ ...next, cash: next.cash + haul }, -10);
    return { ok: true, state: next, msg: `You clean out the register: $${haul}. The owner memorizes your face.` };
  }
  next = confiscateContraband(next);
  next = addKarma(next, -10);
  next = jumpDays(next, 2);
  return {
    ok: true,
    state: next,
    msg: 'A cop was buying nachos. Two days in the county lockup, and they keep your hardware.',
  };
}

/** The big one. Three ways it goes, none of them wise. */
export function robBank(s: GameState, rng: Rng): ActionResult {
  if (!armed(s)) return { ok: false, state: s, msg: 'Rob the bank with what, harsh language?' };
  let next = addItem(s, 'ammo', -1);
  const r = rng();
  if (r < 0.35) {
    const haul = 2000 + Math.floor(rng() * 6001);
    next = addKarma({ ...next, cash: next.cash + haul }, -25);
    return { ok: true, state: next, msg: `The vault opens. You walk out with $${haul}. This town has a wanted poster now.` };
  }
  if (r < 0.75) {
    const fine = Math.min(next.cash, 500);
    next = confiscateContraband({ ...next, cash: next.cash - fine });
    next = addKarma(next, -15);
    next = jumpDays(next, 5);
    return {
      ok: true,
      state: next,
      msg: `Silent alarm. Five days in prison, a $${fine} fine, and they keep your gear.`,
    };
  }
  next = addKarma(next, -10);
  next = addHp(next, -60, 'Shot by a bank guard.');
  return {
    ok: true,
    state: next,
    msg: next.dead
      ? 'The guard was faster.'
      : 'The guard wings you on the way out — you escape empty-handed, bleeding.',
  };
}
