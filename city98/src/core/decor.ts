import { seasonFor, holidayFor, type Season } from './calendar';

// What downtown is dressed in today: a seasonal theme that's always up, plus a
// holiday banner on special days. Pure and keyed off the day; the render layer
// toggles the matching decoration set.

export interface DecorPlan {
  theme: Season; // pumpkins / evergreen+wreaths / flowers / bunting
  banner: string | null; // holiday banner text, or null
}

export function decorFor(day: number): DecorPlan {
  const holiday = holidayFor(day);
  return {
    theme: seasonFor(day),
    banner: holiday ? holiday.name.replace(/\s*—.*$/, '').toUpperCase() : null,
  };
}
