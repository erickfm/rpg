import type { ActionResult, GameState } from './types';
import { weatherAt, isWet } from './weather';

/**
 * A small recurring cast. Each citizen follows a daily schedule of spots and
 * has context-aware greetings. Talking builds a friendship counter; at a
 * threshold they do you a small favor. All pure and testable.
 */

export interface Spot { x: number; z: number; }

export interface ScheduleSlot { until: number; spot: Spot; label: string; }

export interface Citizen {
  id: string;
  name: string;
  shirt: number; hair: number; skin: number;
  schedule: ScheduleSlot[]; // sorted by `until` (minutes); last covers the rest of the day
  lines: string[]; // rotating small talk
}

export const CITIZENS: Citizen[] = [
  {
    id: 'gloria', name: 'Gloria', shirt: 4, hair: 3, skin: 1,
    schedule: [
      { until: 9 * 60, spot: { x: -20, z: 30 }, label: 'walking to work' },
      { until: 17 * 60, spot: { x: 6, z: -47 }, label: 'outside Datacorp' },
      { until: 24 * 60, spot: { x: -6, z: 60 }, label: 'in the park' },
    ],
    lines: [
      '"Twenty-two years at Datacorp. The coffee has never once been good."',
      '"You look like someone with somewhere to be. Must be nice."',
      '"My kid wants a computer. In the house! Can you imagine."',
    ],
  },
  {
    id: 'marcus', name: 'Marcus', shirt: 1, hair: 0, skin: 3,
    schedule: [
      { until: 11 * 60, spot: { x: 14, z: -30 }, label: 'grabbing breakfast' },
      { until: 20 * 60, spot: { x: -26, z: -20 }, label: 'by the video store' },
      { until: 24 * 60, spot: { x: 12, z: 30 }, label: 'outside the record shop' },
    ],
    lines: [
      '"They finally got the new releases in at the Palace. Big weekend."',
      '"You into records? Spin City just got a whole crate of imports."',
      '"City\'s changing, man. Used to know every face on this block."',
    ],
  },
  {
    id: 'rosa', name: 'Rosa', shirt: 2, hair: 1, skin: 0,
    schedule: [
      { until: 14 * 60, spot: { x: 50, z: -6 }, label: 'at the gas station' },
      { until: 24 * 60, spot: { x: 4, z: 57 }, label: 'on the park bench' },
    ],
    lines: [
      '"Rain\'s coming. My knee never lies about the weather."',
      '"Sit a minute. The pigeons put on a whole show around four."',
      '"You young people. Always running. Where to, that\'s what I ask."',
    ],
  },
  {
    id: 'dale', name: 'Dale', shirt: 6, hair: 4, skin: 4,
    schedule: [
      { until: 12 * 60, spot: { x: 60, z: 30 }, label: 'at the car lot' },
      { until: 24 * 60, spot: { x: -12, z: 20 }, label: 'near the arcade' },
    ],
    lines: [
      '"Ask me about the Regalia. Go on. I dare you."',
      '"High score on Gutter Racer is mine. Has been since \'96."',
      '"Everybody needs a hobby. Mine\'s telling people about mine."',
    ],
  },
];

export const FRIENDS_THRESHOLD = 3;

export function citizenById(id: string): Citizen | undefined {
  return CITIZENS.find(c => c.id === id);
}

/** Where a citizen should be at a given minute. */
export function citizenSpot(c: Citizen, minute: number): { spot: Spot; label: string } {
  for (const slot of c.schedule) {
    if (minute < slot.until) return { spot: slot.spot, label: slot.label };
  }
  const last = c.schedule[c.schedule.length - 1];
  return { spot: last.spot, label: last.label };
}

/** A greeting: a stable small-talk line, colored by weather/friendship. */
export function talkLine(c: Citizen, s: GameState, minute: number): string {
  const friend = s.friends[c.id] ?? 0;
  if (friend >= FRIENDS_THRESHOLD) return `${c.name}: "Always good to see a friendly face. You take care now."`;
  if (isWet(weatherAt(s))) return `${c.name}: "Some weather, huh? Get inside before you catch your death."`;
  const idx = (friend + minute) % c.lines.length;
  return `${c.name}: ${c.lines[idx]}`;
}

/** Talking builds friendship; crossing the threshold pays a one-time favor. */
export function befriend(s: GameState, id: string): ActionResult {
  const c = citizenById(id);
  if (!c) return { ok: false, state: s, msg: '...' };
  const count = (s.friends[id] ?? 0) + 1;
  const friends = { ...s.friends, [id]: count };
  if (count === FRIENDS_THRESHOLD) {
    return {
      ok: true,
      state: { ...s, friends, cash: s.cash + 20, messages: [...s.messages, `${c.name} considers you a friend now.`] },
      msg: `${c.name} slips you $20. "For a friend. Don\'t make it weird."`,
    };
  }
  return { ok: true, state: { ...s, friends }, msg: talkLine(c, s, s.minute) };
}
