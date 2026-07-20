import type { GameState } from './types';
import { weekdayName } from './sim';
import { weatherAt, skyLabel, isWet } from './weather';
import { seasonInfo, holidayFor, dayOfYear } from './calendar';
import { CITIZENS, citizenById, FRIENDS_THRESHOLD } from './citizens';

/**
 * The CITY HERALD — a daily paper generated deterministically from the day's
 * state: a lead tied to the holiday/weather, tomorrow's forecast, a community
 * note about a citizen, a classified tip, a horoscope, and the ever-present
 * Y2K panic as New Year's Eve nears. Pure and testable; the UI just renders it.
 */

export interface Edition {
  masthead: string;
  date: string;
  price: string;
  lead: string;
  story: string;
  forecast: string;
  community: string;
  tip: string;
  horoscope: string;
  y2k: string | null;
}

/** Deterministic pick from an array, varied by day + a salt. */
function pick<T>(arr: T[], day: number, salt: number): T {
  return arr[(((day * 2654435761) >>> 0) + salt) % arr.length];
}

const RAIN_LEADS = [
  'DELUGE SNARLS DOWNTOWN', 'CITY REACHES FOR ITS UMBRELLAS', 'STORM ROLLS OVER THE VALLEY',
];
const CLEAR_LEADS = [
  'MAYOR DECLARES "A FINE DAY"', 'RECORD TURNOUT AT FARMERS MARKET', 'POTHOLE ON 3RD FINALLY FILLED',
  'LOCAL CAT RESCUED FROM SECOND TREE THIS MONTH', 'CITY COUNCIL DEBATES BENCH PLACEMENT',
];
const STORIES_CIVIC = [
  'Officials urge calm and, as ever, patience with the parking situation.',
  'Sources describe the mood downtown as "cautiously ordinary."',
  'The Herald reminds readers that rent is due Mondays. It is always due Mondays.',
  'Residents are encouraged to enjoy it while it lasts.',
];
const TIPS = [
  'CLASSIFIED: Big Ray\'s Autos — "everything runs when I park it." Trade-ins welcome.',
  'CLASSIFIED: Spin City Records has a fresh crate of imports. Cash only, no returns.',
  'TIP: Odd jobs posted at the park payphone. Beat the clock, pocket the cash.',
  'TIP: First Federal pays interest overnight. Money that sleeps, earns.',
  'CLASSIFIED: Neon Dragon Arcade — new high scores posted. Someone named DALE remains smug.',
  'TIP: The Gas-N-Go stocks a Golf Umbrella. Your knees will thank you.',
];
const HOROSCOPES = [
  'Today\'s lucky number is a busy signal.',
  'The stars advise: rewind the tape before you return it.',
  'Venus is in your corner. So is a decent bowl of diner soup.',
  'Avoid arguments with vending machines. You will not win.',
  'A small windfall approaches. Possibly loose change in the couch.',
  'Mercury retrograde. Save your work. Save it again.',
];

export function dailyEdition(s: GameState): Edition {
  const today = weatherAt(s);
  const tomorrow = weatherAt({ ...s, day: s.day + 1 });
  const holiday = holidayFor(s.day);

  let lead: string;
  let story: string;
  if (holiday) {
    lead = holiday.name.toUpperCase();
    story = holiday.greeting;
  } else if (isWet(today)) {
    lead = pick(RAIN_LEADS, s.day, 1);
    story = 'The Herald advises galoshes, a good attitude, and staying off the avenues if you can.';
  } else {
    lead = pick(CLEAR_LEADS, s.day, 2);
    story = pick(STORIES_CIVIC, s.day, 3);
  }

  const forecast = `Tomorrow: ${skyLabel(tomorrow.sky)}${isWet(tomorrow) ? ' — pack a coat.' : '.'}`;

  const c = CITIZENS[s.day % CITIZENS.length];
  const isFriend = (s.friends[c.id] ?? 0) >= FRIENDS_THRESHOLD;
  const community = isFriend
    ? `COMMUNITY: Your friend ${c.name} was spotted ${citizenById(c.id)!.schedule[0].label}, in good spirits.`
    : `COMMUNITY: ${c.name}, a familiar face around town, ${c.lines[0].replace(/^"|"$/g, '').toLowerCase().replace(/\.$/, '')}.`;

  const seasonLine = `The ${seasonInfo(s.day).name.toLowerCase()} air suits the city.`;

  return {
    masthead: 'THE CITY HERALD',
    date: `${weekdayName(s.day)} · Day ${s.day}`,
    price: '50¢',
    lead,
    story: `${story} ${seasonLine}`,
    forecast,
    community,
    tip: pick(TIPS, s.day, 5),
    horoscope: `HOROSCOPE: ${pick(HOROSCOPES, s.day, 7)}`,
    y2k: y2kLine(s.day),
  };
}

/** The Millennium panic, keyed to how close we are to New Year's Eve (day-of-year 14). */
export function y2kLine(day: number): string | null {
  const doy = dayOfYear(day);
  const daysTo = (14 - doy + 28) % 28;
  if (doy === 14) return 'Y2K WATCH: The Bug arrives at midnight. Fill the bathtub. Trust nothing with a clock.';
  if (daysTo >= 1 && daysTo <= 7) return `Y2K WATCH: ${daysTo} day${daysTo === 1 ? '' : 's'} until the Millennium. Experts remain divided on everything.`;
  if (doy === 15 || doy === 16) return 'Y2K WATCH: The world did not end. The toasters are fine. Analysts express mild disappointment.';
  return null;
}
