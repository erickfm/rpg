import { holidayFor, type Holiday } from './calendar';

// What's happening in the sky and on the lampposts tonight. Pure and keyed off
// day + minute so it's testable; the render layer turns it into fireworks and
// colored streetlights.

export interface Festivity {
  holiday: Holiday | null;
  festiveLights: boolean; // colored streetlights on any holiday night
  fireworks: boolean; // the big Y2K show
}

/** Evening/overnight — when lights and fireworks read. */
export function isNightMinute(minute: number): boolean {
  return minute >= 19 * 60 || minute < 5 * 60; // 7pm–5am
}

export function festivityFor(day: number, minute: number): Festivity {
  const holiday = holidayFor(day);
  const night = isNightMinute(minute);
  return {
    holiday,
    festiveLights: !!holiday && night,
    fireworks: !!holiday && holiday.name.includes('Y2K') && night,
  };
}
