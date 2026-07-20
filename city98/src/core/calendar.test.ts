import { describe, it, expect } from 'vitest';
import { seasonFor, seasonInfo, holidayFor, dayOfYear, YEAR_LEN, SEASONS } from './calendar';

describe('seasons', () => {
  it('runs a week per season starting in autumn', () => {
    expect(seasonFor(1)).toBe('autumn');
    expect(seasonFor(7)).toBe('autumn');
    expect(seasonFor(8)).toBe('winter');
    expect(seasonFor(14)).toBe('winter');
    expect(seasonFor(15)).toBe('spring');
    expect(seasonFor(21)).toBe('spring');
    expect(seasonFor(22)).toBe('summer');
    expect(seasonFor(28)).toBe('summer');
  });

  it('wraps around after a year', () => {
    expect(seasonFor(29)).toBe('autumn');
    expect(seasonFor(29 + 7)).toBe('winter');
  });

  it('exposes a distinct emoji + name per season', () => {
    const emojis = SEASONS.map(s => seasonInfo(SEASONS.indexOf(s) * 7 + 1).emoji);
    expect(new Set(emojis).size).toBe(4);
    expect(seasonInfo(1).name).toBe('Autumn');
  });
});

describe('day of year', () => {
  it('cycles 1..28', () => {
    expect(dayOfYear(1)).toBe(1);
    expect(dayOfYear(YEAR_LEN)).toBe(28);
    expect(dayOfYear(YEAR_LEN + 1)).toBe(1);
    expect(dayOfYear(YEAR_LEN + 6)).toBe(6);
  });
});

describe('holidays', () => {
  it('lands on the special days and is empty otherwise', () => {
    expect(holidayFor(6)?.name).toBe('Harvest Fair');
    expect(holidayFor(14)?.name).toContain('Y2K');
    expect(holidayFor(20)?.name).toBe('Spring Fair');
    expect(holidayFor(5)).toBeNull();
    expect(holidayFor(1)).toBeNull();
  });

  it('recurs the next year', () => {
    expect(holidayFor(YEAR_LEN + 6)?.name).toBe('Harvest Fair');
  });
});
