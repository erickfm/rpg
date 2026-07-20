import type { ActionResult, GameState } from './types';
import { itemCount, addItem, maxHp, hasFurniture } from './state';
import { repriceStocks } from './stocks';

export const MINUTES_PER_DAY = 24 * 60;
export const DAILY_INTEREST = 0.01; // bank credit at midnight
export const LOAN_INTEREST = 0.02; // the bank always wins

export type WakeMode = 'normal' | 'alarm' | 'caffeine';
export const WAKE_MINUTE: Record<WakeMode, number> = {
  normal: 8 * 60,
  alarm: 6 * 60,
  caffeine: 0,
};

/** Everything that happens when the clock passes midnight. */
function rollDay(s: GameState): GameState {
  let next: GameState = { ...s, day: s.day + 1 };
  next = { ...next, bank: next.bank + Math.floor(next.bank * DAILY_INTEREST) };
  if (next.loan > 0) next = { ...next, loan: Math.ceil(next.loan * (1 + LOAN_INTEREST)) };
  next = repriceStocks(next);
  if (next.dayLimit !== null && next.day > next.dayLimit) next = { ...next, ended: true };
  return next;
}

/** Advance the clock; day rollovers apply interest, stock moves, and the day limit. */
export function passTime(s: GameState, minutes: number): GameState {
  let minute = s.minute + Math.max(0, Math.round(minutes));
  let next: GameState = s;
  while (minute >= MINUTES_PER_DAY) {
    minute -= MINUTES_PER_DAY;
    next = rollDay(next);
  }
  return { ...next, minute };
}

/** Days that vanish wholesale (prison, bus trips). Ends at 8:00 AM. */
export function jumpDays(s: GameState, days: number): GameState {
  let next: GameState = { ...s };
  for (let i = 0; i < days; i++) next = rollDay(next);
  return { ...next, minute: 8 * 60 };
}

export function availableWakeModes(s: GameState): WakeMode[] {
  const modes: WakeMode[] = ['normal'];
  if (itemCount(s, 'alarmClock') > 0) modes.push('alarm');
  if (itemCount(s, 'alarmClock') > 0 && itemCount(s, 'caffeine') > 0) modes.push('caffeine');
  return modes;
}

/**
 * Sleeping always ends the day — you wake on day+1 at the mode's wake time.
 * Without the Coma-Snooze bed you're on the floor and only partly recover.
 */
export function sleep(s: GameState, mode: WakeMode): ActionResult {
  if (!availableWakeModes(s).includes(mode)) {
    return { ok: false, state: s, msg: 'You don’t have the gear for that wake-up call.' };
  }
  let next: GameState = s;
  let note = '';
  if (mode === 'caffeine') {
    next = addItem(next, 'caffeine', -1);
    next = { ...next, hp: Math.max(1, next.hp - 20) }; // pills hurt, but never kill in bed
    note = ' The caffeine pills rattle your skeleton.';
  }
  next = rollDay(next);
  next = { ...next, minute: WAKE_MINUTE[mode], furnitureUsed: [] };
  const restored = hasFurniture(next, 'bed')
    ? maxHp(next)
    : Math.max(next.hp, Math.floor(maxHp(next) * 0.6));
  next = { ...next, hp: restored };
  const where = hasFurniture(next, 'bed') ? 'the Coma-Snooze' : 'the floor';
  return {
    ok: true,
    state: next,
    msg: `You crash on ${where} and wake at ${formatClock(WAKE_MINUTE[mode])}.${note}`,
  };
}

export function formatClock(minute: number): string {
  const h24 = Math.floor(minute / 60);
  const m = minute % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}
