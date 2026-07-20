import type { GameState } from './types';
import { carModel } from './sim';
import { ownedRecords } from './goods';
import { CITIZENS, FRIENDS_THRESHOLD } from './citizens';
import { FAVORS } from './favors';

/**
 * The "you made it" epilogue — a life in the city, reflected back. Pure and
 * derived entirely from the final state, so it's testable; the UI just prints it.
 */

export interface Epilogue {
  title: string;
  lines: string[];
  closing: string;
}

const homeName = (h: string) => (h === 'loft' ? 'the Skyline Loft' : 'Maple Court, Apt 3B');

export function epilogue(s: GameState): Epilogue {
  const friends = CITIZENS.filter(c => (s.friends[c.id] ?? 0) >= FRIENDS_THRESHOLD);
  const favorsDone = s.favors.filter(id => FAVORS.some(f => f.id === id)).length;
  const records = ownedRecords(s).length;

  const lines = [
    `Days in the city — ${s.day}`,
    `Home — ${homeName(s.home)}`,
    `Ride — ${carModel(s).name}`,
    `In the bank — $${s.savings.toLocaleString()}`,
    `Records on the shelf — ${records}`,
    `Friends made — ${friends.length}${friends.length ? ` (${friends.map(f => f.name).join(', ')})` : ''}`,
    `Favors repaid — ${favorsDone} of ${FAVORS.length}`,
  ];

  const warmth = friends.length >= 2
    ? 'People wave when they see you now. That took a while, and it was worth every day.'
    : 'You kept your head down and made it work. The city noticed anyway.';

  return {
    title: `You made it, ${s.look.name}.`,
    lines,
    closing: `${warmth} The century's almost up, the lights are on, and Maple Court still smells like rain and coffee. Whatever comes next — it starts here, and it's yours.`,
  };
}
