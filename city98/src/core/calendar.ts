// The city's calendar: a 28-day year of four week-long seasons, plus a handful
// of holidays. Pure and keyed only off the day number, so it's fully testable;
// the render layer turns a season into foliage colors, sky tint, and snow.

export type Season = 'autumn' | 'winter' | 'spring' | 'summer';

// Day 1 opens in autumn (warm, colorful trees from the first minute); a season
// is one in-game week, so a two-week playthrough carries you into winter snow.
export const SEASONS: Season[] = ['autumn', 'winter', 'spring', 'summer'];
export const SEASON_LEN = 7;
export const YEAR_LEN = SEASONS.length * SEASON_LEN; // 28

export interface SeasonInfo { season: Season; name: string; emoji: string; }

const META: Record<Season, { name: string; emoji: string }> = {
  autumn: { name: 'Autumn', emoji: '🍂' },
  winter: { name: 'Winter', emoji: '❄️' },
  spring: { name: 'Spring', emoji: '🌷' },
  summer: { name: 'Summer', emoji: '☀️' },
};

export function seasonFor(day: number): Season {
  const idx = Math.floor((day - 1) / SEASON_LEN) % SEASONS.length;
  return SEASONS[((idx % SEASONS.length) + SEASONS.length) % SEASONS.length];
}

export function seasonInfo(day: number): SeasonInfo {
  const season = seasonFor(day);
  return { season, ...META[season] };
}

export interface Holiday { name: string; emoji: string; greeting: string; }

// Keyed by day-of-year (1..28) so holidays recur every calendar year.
const HOLIDAYS: Record<number, Holiday> = {
  6: { name: 'Harvest Fair', emoji: '🍂', greeting: 'Cider stands and pumpkins downtown.' },
  13: { name: 'First Snow', emoji: '❄️', greeting: 'The first real snow of the year is falling.' },
  14: { name: "New Year's Eve — Y2K!", emoji: '🎉', greeting: "Everyone's arguing about the Millennium Bug." },
  20: { name: 'Spring Fair', emoji: '🌷', greeting: 'The park is full of tulips and kites.' },
  27: { name: 'Midsummer', emoji: '☀️', greeting: 'The longest, laziest day of the year.' },
};

export function dayOfYear(day: number): number {
  return ((day - 1) % YEAR_LEN + YEAR_LEN) % YEAR_LEN + 1;
}

export function holidayFor(day: number): Holiday | null {
  return HOLIDAYS[dayOfYear(day)] ?? null;
}
