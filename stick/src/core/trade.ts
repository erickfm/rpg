import type { ActionResult, CityId, GameState } from './types';
import type { Rng } from './rng';
import { addItem, addKarma, itemCount } from './state';
import { jumpDays } from './time';

export interface City {
  id: CityId;
  name: string;
  fare: number;
  priceMin: number;
  priceMax: number;
  base: number; // base success chance
}

/** Fares from the wiki; pricier destinations pay better and bust more. */
export const CITIES: City[] = [
  { id: 'detroit',  name: 'Detroit, MI',    fare: 100, priceMin: 450, priceMax: 600, base: 0.55 },
  { id: 'la',       name: 'Los Angeles, CA', fare: 100, priceMin: 450, priceMax: 620, base: 0.55 },
  { id: 'brooklyn', name: 'Brooklyn, NY',   fare: 115, priceMin: 500, priceMax: 700, base: 0.5 },
  { id: 'chicago',  name: 'Chicago, IL',    fare: 115, priceMin: 500, priceMax: 700, base: 0.5 },
  { id: 'camden',   name: 'Camden, NJ',     fare: 130, priceMin: 600, priceMax: 900, base: 0.4 },
  { id: 'vegas',    name: 'Las Vegas, NV',  fare: 130, priceMin: 600, priceMax: 900, base: 0.4 },
];

export const BOTTLE_SALE_PRICE = 45;
export const COCAINE_BUST_LIMIT = 50; // grams

/** Buses leave first thing — you must be up before 6 AM (alarm + caffeine territory). */
export function canBoard(s: GameState): boolean {
  return s.minute < 6 * 60;
}

export function busTrip(s: GameState, cityId: CityId, rng: Rng): ActionResult {
  const city = CITIES.find(c => c.id === cityId)!;
  if (!canBoard(s)) {
    return { ok: false, state: s, msg: 'The buses leave before 6 AM. You’d need an alarm clock and caffeine pills.' };
  }
  if (s.cash < city.fare) return { ok: false, state: s, msg: `The fare to ${city.name} is $${city.fare}.` };

  const grams = itemCount(s, 'cocaine');
  const bottles = itemCount(s, 'bottle');
  const hasGun = itemCount(s, 'gun') > 0 && itemCount(s, 'ammo') > 0;
  const visits = s.cityVisits[cityId] ?? 0;

  let next: GameState = { ...s, cash: s.cash - city.fare };
  next = { ...next, cityVisits: { ...next.cityVisits, [cityId]: visits + 1 } };

  const done = (state: GameState, msg: string, extraDays = 0): ActionResult => ({
    ok: true,
    state: jumpDays(state, 1 + extraDays),
    msg,
  });

  if (grams === 0 && bottles === 0) {
    return done(next, `You ride to ${city.name} with nothing to sell, watch pigeons, and ride home. −$${city.fare}.`);
  }

  if (grams > COCAINE_BUST_LIMIT) {
    let busted = addItem(next, 'cocaine', -grams);
    busted = addItem(busted, 'gun', -itemCount(busted, 'gun'));
    busted = addItem(busted, 'ammo', -itemCount(busted, 'ammo'));
    busted = addKarma(busted, -15);
    return done(
      busted,
      `${grams}g doesn’t fit in a sock. The police confiscate everything and you serve 5 days.`,
      5
    );
  }

  if (!hasGun && rng() < 0.85) {
    const lost = next.cash;
    let robbed = addItem({ ...next, cash: 0 }, 'cocaine', -grams);
    return done(robbed, `Unarmed in ${city.name}. They take your $${lost} and every gram. You were in no position to argue.`);
  }

  if (s.stats.strength < 200 && rng() < 0.5) {
    const lost = next.cash;
    let robbed = addItem({ ...next, cash: 0 }, 'cocaine', -grams);
    return done(robbed, `They size you up and don’t like the math. You lose $${lost} and the product.`);
  }

  const successChance =
    city.base + Math.min(visits, 5) * 0.03 + (itemCount(s, 'cellPhone') > 0 ? 0.1 : 0);

  if (rng() < successChance) {
    const perGram = city.priceMin + Math.floor(rng() * (city.priceMax - city.priceMin + 1));
    const haul = grams * perGram + bottles * BOTTLE_SALE_PRICE;
    let sold = addItem(next, 'cocaine', -grams);
    sold = addItem(sold, 'bottle', -bottles);
    sold = { ...sold, cash: sold.cash + haul };
    if (grams > 0) sold = addKarma(sold, -5);
    const detail = [
      grams > 0 ? `${grams}g at $${perGram}/g` : '',
      bottles > 0 ? `${bottles} bottles at $${BOTTLE_SALE_PRICE}` : '',
    ]
      .filter(Boolean)
      .join(' + ');
    return done(sold, `A buyer in ${city.name} takes everything: ${detail}. +$${haul}.`);
  }

  if (rng() < 0.15) {
    const lost = Math.floor(next.cash / 2);
    let burned = addItem({ ...next, cash: next.cash - lost }, 'cocaine', -grams);
    return done(burned, `The deal goes sideways. You escape, minus the product and $${lost}.`);
  }

  return done(next, `No buyer shows in ${city.name}. A day and $${city.fare} gone.`);
}
