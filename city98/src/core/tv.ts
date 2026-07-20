import type { GameState } from './types';
import { dailyEdition, y2kLine } from './news';
import { weatherAt, skyLabel } from './weather';
import { fmtClock } from './sim';

/**
 * What's on the apartment TV — five channels of late-'90s programming that flex
 * with the day: local news recaps the Herald, the weather channel reads the
 * forecast, reruns and the movie rotate by half-hour slot, and channel 5 becomes
 * a Y2K special as New Year's nears. Pure and testable; the panel flips channels.
 */

export interface Program { channel: string; title: string; body: string; }
export const CHANNELS = 5;

const wrap = (ch: number) => ((ch % CHANNELS) + CHANNELS) % CHANNELS;
const pick = <T,>(arr: T[], n: number): T => arr[((n % arr.length) + arr.length) % arr.length];

const SITCOMS = [
  ['"Cul-de-Sac"', 'The neighbors mistake a casserole for a marriage proposal. (laugh track)'],
  ['"Data Entry"', 'Todd jams the copier and blames the new intern, who does not exist. (laugh track)'],
  ['"Two Rooms & a Fridge"', 'The roommates argue over the last soda for a full 22 minutes. (laugh track)'],
  ['"Uncle Motel"', 'Uncle Ray insists the waterbed was always leaking. (applause)'],
];
const MOVIES = [
  ['THE MIDNIGHT MOVIE: "Chrome Vengeance"', 'A cop with nothing to lose and one working headlight.'],
  ['MATINEE: "Loveletter, Idaho"', 'She left for the city. He kept the diner. The pie waits.'],
  ['THE MIDNIGHT MOVIE: "Space Cop 3"', 'Every copy is checked out at the Palace. You get the broadcast cut.'],
  ['MATINEE: "The Long Commute"', 'Two hours of a man missing his bus. Critics called it "relatable."'],
];
const PUBLIC_ACCESS = [
  ['PUBLIC ACCESS: "Fret Not"', 'A man teaches the same three guitar chords he taught last week.'],
  ['PUBLIC ACCESS: "Ask the Locksmith"', 'Tonight: callers who have locked themselves out of themselves.'],
  ['PUBLIC ACCESS: "Pigeon Hour"', 'Rosa from the park guest-hosts. It is oddly moving.'],
];

export function nowPlaying(channel: number, s: GameState): Program {
  const ch = wrap(channel);
  const slot = Math.floor(s.minute / 30) + s.day; // rotates through the day
  switch (ch) {
    case 0: {
      const e = dailyEdition(s);
      const y2k = y2kLine(s.day);
      return {
        channel: 'CITY 4 NEWS',
        title: `CITY 4 NEWS at ${fmtClock(s.minute)}`,
        body: `TOP STORY: ${e.lead}${/[.!?]$/.test(e.lead) ? '' : '.'} ${e.story}${y2k ? `\n\nBULLETIN: ${y2k}` : ''}`,
      };
    }
    case 1: {
      const today = weatherAt(s);
      const e = dailyEdition(s);
      return {
        channel: 'WEATHER NOW',
        title: 'WEATHER NOW — your all-day forecast',
        body: `Right now: ${skyLabel(today.sky)}.\n${e.forecast}\nStay tuned, stay dry, stay tuned.`,
      };
    }
    case 2: {
      const [title, gag] = pick(SITCOMS, slot);
      return { channel: 'RERUN NETWORK', title, body: gag };
    }
    case 3: {
      const [title, log] = pick(MOVIES, slot);
      return { channel: 'CHANNEL 9 MOVIES', title, body: log };
    }
    default: {
      const y2k = y2kLine(s.day);
      if (y2k) {
        return {
          channel: 'SPECIAL REPORT',
          title: 'Y2K: COUNTDOWN TO CHAOS?',
          body: `A grave anchor stands before a wall of clocks.\n\n${y2k}`,
        };
      }
      const [title, blurb] = pick(PUBLIC_ACCESS, slot);
      return { channel: 'PUBLIC ACCESS', title, body: blurb };
    }
  }
}
