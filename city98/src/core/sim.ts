import type { ActionResult, GameState, JobId } from './types';
import { applyInterest } from './bank';
import { defaultAppearance } from './appearance';

export const MINUTES_PER_DAY = 24 * 60;
export const WAKE_MINUTE = 7 * 60;
export const RENT = 120; // due every Monday morning
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// needs drain per game hour, while awake
export const ENERGY_DRAIN = 2;
export const HUNGER_DRAIN = 4;

export function newGame(seed: number): GameState {
  return {
    version: 1,
    minute: WAKE_MINUTE + 30,
    day: 1,
    cash: 140,
    energy: 90,
    hunger: 70,
    debt: 0,
    shiftsWorked: { video: 0, office: 0 },
    car: 'beater',
    gig: null,
    goods: [],
    savings: 0,
    look: defaultAppearance(),
    doneGoals: [],
    wonAt: null,
    home: 'studio',
    friends: {},
    storyStage: 0,
    favors: [],
    messages: ['Welcome to the city. Rent is $120, due every Monday.'],
    seed,
  };
}

export function weekdayName(day: number): string {
  return WEEKDAYS[(day - 1) % 7];
}

export function isWeekday(day: number): boolean {
  return (day - 1) % 7 < 5;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** True when either need is low enough to drag your feet. */
export function isSluggish(s: GameState): boolean {
  return s.energy <= 20 || s.hunger <= 20;
}

function collectRent(s: GameState): GameState {
  if (weekdayName(s.day) !== 'Monday') return s;
  if (s.cash >= RENT) {
    return {
      ...s,
      cash: s.cash - RENT,
      messages: [...s.messages, `Rent day. $${RENT} slid under the landlord's door.`],
    };
  }
  return {
    ...s,
    debt: s.debt + RENT,
    messages: [
      ...s.messages,
      `Rent day and you're short. The landlord "adds it to your tab" ($${s.debt + RENT} owed). His smile is not friendly.`,
    ],
  };
}

/** Advance the clock; needs drain, days roll over, Monday collects rent. */
export function passTime(s: GameState, minutes: number): GameState {
  const mins = Math.max(0, Math.round(minutes));
  let next: GameState = {
    ...s,
    energy: clamp(s.energy - (ENERGY_DRAIN * mins) / 60),
    hunger: clamp(s.hunger - (HUNGER_DRAIN * mins) / 60),
  };
  let minute = next.minute + mins;
  while (minute >= MINUTES_PER_DAY) {
    minute -= MINUTES_PER_DAY;
    next = applyInterest(collectRent({ ...next, day: next.day + 1 }));
  }
  return { ...next, minute };
}

/** Sleeping ends the day: wake at 7:00 AM tomorrow, rested but hungrier. */
export function sleep(s: GameState): ActionResult {
  let next = applyInterest(collectRent({ ...s, day: s.day + 1 }));
  next = {
    ...next,
    minute: WAKE_MINUTE,
    energy: 100,
    hunger: clamp(next.hunger - 25),
  };
  return { ok: true, state: next, msg: 'You crash hard and wake at 7:00 AM.' };
}

// ---------- food ----------

export interface MealDef {
  id: string;
  name: string;
  price: number;
  hunger: number;
  energy: number;
  minutes: number;
}

export const DINER_MENU: MealDef[] = [
  { id: 'coffee',  name: 'Bottomless Coffee',   price: 2,  hunger: 5,  energy: 15, minutes: 10 },
  { id: 'stack',   name: 'Pancake Stack',       price: 6,  hunger: 40, energy: 5,  minutes: 25 },
  { id: 'special', name: 'The Big Slam Special', price: 11, hunger: 70, energy: 10, minutes: 35 },
];

export const GAS_MENU: MealDef[] = [
  { id: 'jerky',  name: 'Gas Station Jerky', price: 3, hunger: 15, energy: 0,  minutes: 5 },
  { id: 'burrito', name: 'Microwave Burrito', price: 4, hunger: 30, energy: 0, minutes: 8 },
  { id: 'cola',   name: 'Cold Cola',          price: 2, hunger: 5,  energy: 10, minutes: 5 },
];

export function eat(s: GameState, meal: MealDef): ActionResult {
  if (s.cash < meal.price) return { ok: false, state: s, msg: `You need $${meal.price}.` };
  if (s.hunger >= 98 && meal.hunger > 10) return { ok: false, state: s, msg: 'You are completely stuffed.' };
  let next: GameState = {
    ...s,
    cash: s.cash - meal.price,
    hunger: clamp(s.hunger + meal.hunger),
    energy: clamp(s.energy + meal.energy),
  };
  next = passTime(next, meal.minutes);
  return { ok: true, state: next, msg: `${meal.name}: exactly what the moment required.` };
}

// ---------- work ----------

export interface JobDef {
  id: JobId;
  place: string;
  title: string;
  hours: number;
  pay: number;
  energyCost: number;
  openFrom: number; // earliest clock-in minute
  openTo: number; // latest clock-in minute
  weekdaysOnly: boolean;
}

export const JOBS: Record<JobId, JobDef> = {
  video: {
    id: 'video',
    place: 'Video Palace',
    title: 'Rental Clerk',
    hours: 4,
    pay: 44,
    energyCost: 22,
    openFrom: 9 * 60,
    openTo: 19 * 60,
    weekdaysOnly: false,
  },
  office: {
    id: 'office',
    place: 'Datacorp',
    title: 'Data Entry Associate',
    hours: 8,
    pay: 104,
    energyCost: 38,
    openFrom: 8 * 60,
    openTo: 10 * 60,
    weekdaysOnly: true,
  },
};

export function canWork(s: GameState, job: JobDef): { ok: boolean; why?: string } {
  if (job.weekdaysOnly && !isWeekday(s.day)) return { ok: false, why: 'Closed on weekends.' };
  if (s.minute < job.openFrom || s.minute > job.openTo) {
    return { ok: false, why: `Shifts start ${fmtClock(job.openFrom)}–${fmtClock(job.openTo)}.` };
  }
  if (s.energy < job.energyCost) return { ok: false, why: 'You are too exhausted to work.' };
  return { ok: true };
}

export function workShift(s: GameState, jobId: JobId): ActionResult {
  const job = JOBS[jobId];
  const check = canWork(s, job);
  if (!check.ok) return { ok: false, state: s, msg: check.why! };
  let next: GameState = {
    ...s,
    cash: s.cash + job.pay,
    energy: clamp(s.energy - job.energyCost),
    shiftsWorked: { ...s.shiftsWorked, [jobId]: s.shiftsWorked[jobId] + 1 },
  };
  next = passTime(next, job.hours * 60);
  return {
    ok: true,
    state: next,
    msg: `${job.hours} hours at ${job.place}. +$${job.pay}.`,
  };
}

/** A free breather (park bench, arcade loitering). */
export function rest(s: GameState, minutes: number, energyGain: number, msg: string): ActionResult {
  const passed = passTime(s, minutes);
  return { ok: true, state: { ...passed, energy: clamp(passed.energy + energyGain) }, msg };
}

// ---------- wheels ----------

export interface CarModel {
  id: string;
  name: string;
  kind: string; // render kind: sedan | hatch | wagon | pickup
  color: number;
  price: number;
  resale: number;
  top: number; // max forward speed
  accel: number;
  blurb: string;
}

export const CAR_MODELS: Record<string, CarModel> = {
  beater: {
    id: 'beater', name: "'89 Cricket", kind: 'hatch', color: 0xc87830,
    price: 0, resale: 50, top: 26, accel: 11,
    blurb: 'Your faithful rust bucket. Smells like french fries.',
  },
  wagon: {
    id: 'wagon', name: 'Timberline Estate', kind: 'wagon', color: 0x3c6a4a,
    price: 650, resale: 325, top: 28, accel: 10.5,
    blurb: 'Wood paneling. Seats eight regrets comfortably.',
  },
  sedan: {
    id: 'sedan', name: 'Regalia LX', kind: 'sedan', color: 0x7a2f3f,
    price: 850, resale: 425, top: 31, accel: 13.5,
    blurb: 'Executive burgundy. The LX stands for luxury, allegedly.',
  },
  pickup: {
    id: 'pickup', name: 'Bronx 1500', kind: 'pickup', color: 0x3c5a8c,
    price: 1100, resale: 550, top: 29, accel: 12.5,
    blurb: 'Haul anything. Mostly hauls attitude.',
  },
};

export function carModel(s: GameState): CarModel {
  return CAR_MODELS[s.car] ?? CAR_MODELS.beater;
}

/** Buy from Big Ray — your current car goes in as trade credit. */
export function buyCar(s: GameState, id: string): ActionResult {
  const model = CAR_MODELS[id];
  if (!model || model.price === 0) return { ok: false, state: s, msg: 'Ray squints. "That one\'s not for sale."' };
  if (s.car === id) return { ok: false, state: s, msg: 'You already drive one of those.' };
  const tradeIn = carModel(s).resale;
  const due = model.price - tradeIn;
  if (s.cash < due) return { ok: false, state: s, msg: `With trade-in that's $${due}. Ray doesn't do layaway.` };
  return {
    ok: true,
    state: { ...s, cash: s.cash - due, car: id },
    msg: `The ${model.name} is yours for $${due} after trade-in. Ray salutes.`,
  };
}

// ---------- debt ----------

export function payDebt(s: GameState): ActionResult {
  if (s.debt <= 0) return { ok: false, state: s, msg: 'You owe nothing. Feels good.' };
  const amount = Math.min(s.cash, s.debt);
  if (amount <= 0) return { ok: false, state: s, msg: 'You have nothing to pay with.' };
  return {
    ok: true,
    state: { ...s, cash: s.cash - amount, debt: s.debt - amount },
    msg: s.debt - amount === 0 ? 'Debt cleared. The landlord almost smiles.' : `Paid $${amount} toward the tab.`,
  };
}

// ---------- formatting & saves ----------

export function fmtClock(minute: number): string {
  const h24 = Math.floor(minute / 60);
  const m = minute % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(raw: string): GameState | null {
  try {
    const s = JSON.parse(raw);
    if (
      s &&
      s.version === 1 &&
      typeof s.minute === 'number' &&
      typeof s.day === 'number' &&
      typeof s.cash === 'number' &&
      typeof s.energy === 'number' &&
      typeof s.hunger === 'number' &&
      s.shiftsWorked
    ) {
      if (typeof s.car !== 'string') s.car = 'beater';
      if (s.gig === undefined) s.gig = null;
      if (!Array.isArray(s.goods)) s.goods = [];
      if (typeof s.savings !== 'number') s.savings = 0;
      if (!s.look || typeof s.look.name !== 'string') s.look = defaultAppearance();
      if (!Array.isArray(s.doneGoals)) s.doneGoals = [];
      if (s.wonAt === undefined) s.wonAt = null;
      if (s.home !== 'studio' && s.home !== 'loft') s.home = 'studio';
      if (!s.friends || typeof s.friends !== 'object') s.friends = {};
      if (typeof s.storyStage !== 'number') s.storyStage = 0;
      if (!Array.isArray(s.favors)) s.favors = [];
      return s as GameState;
    }
  } catch {
    // corrupt save
  }
  return null;
}
