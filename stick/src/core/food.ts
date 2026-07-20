import type { ActionResult, GameState } from './types';
import { addHp, hasFurniture, maxHp } from './state';
import { passTime } from './time';

export interface MealDef {
  id: string;
  name: string;
  price: number;
  hp: number;
}

/** McSticks menu, straight from the wiki. */
export const MCSTICKS_MENU: MealDef[] = [
  { id: 'shake',   name: 'Milkshake',     price: 8,  hp: 12 },
  { id: 'fries',   name: 'Fries',         price: 12, hp: 20 },
  { id: 'burger',  name: 'Cheeseburger',  price: 25, hp: 40 },
  { id: 'triple',  name: 'Triple Burger', price: 50, hp: 80 },
];

export function eatMeal(s: GameState, mealId: string): ActionResult {
  const meal = MCSTICKS_MENU.find(m => m.id === mealId)!;
  if (s.cash < meal.price) return { ok: false, state: s, msg: `The ${meal.name} is $${meal.price}.` };
  if (s.hp >= maxHp(s)) return { ok: false, state: s, msg: 'You’re stuffed and healthy.' };
  const heal = hasFurniture(s, 'freezer') ? Math.round(meal.hp * 1.5) : meal.hp;
  let next: GameState = { ...s, cash: s.cash - meal.price };
  next = addHp(next, heal);
  next = passTime(next, 20);
  return { ok: true, state: next, msg: `${meal.name}: +${heal} HP of pure grease.` };
}
