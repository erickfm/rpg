import { describe, it, expect } from 'vitest';
import { dailyEdition, y2kLine } from './news';
import { newGame } from './sim';
import type { GameState } from './types';

const day = (d: number, over: Partial<GameState> = {}): GameState => ({ ...newGame(1), day: d, ...over });

describe('dailyEdition', () => {
  it('fills every section', () => {
    const e = dailyEdition(day(3));
    for (const v of [e.masthead, e.date, e.price, e.lead, e.story, e.forecast, e.community, e.tip, e.horoscope]) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
    expect(e.masthead).toBe('THE CITY HERALD');
    expect(e.date).toContain('Day 3');
  });

  it('leads with the holiday on a holiday', () => {
    expect(dailyEdition(day(6)).lead).toBe('HARVEST FAIR');
    expect(dailyEdition(day(14)).lead).toContain("NEW YEAR");
  });

  it('is deterministic for the same day', () => {
    expect(dailyEdition(day(9))).toEqual(dailyEdition(day(9)));
  });

  it('forecasts tomorrow\'s weather (deterministic from seed+day)', () => {
    const s = day(2);
    const e = dailyEdition(s);
    expect(e.forecast.startsWith('Tomorrow:')).toBe(true);
  });

  it('personalizes the community note for a friend', () => {
    const plain = dailyEdition(day(1));
    const c = day(1).day % 4; // which citizen runs on day 1
    const withFriend = dailyEdition(day(1, { friends: { gloria: 3, marcus: 3, rosa: 3, dale: 3 } }));
    expect(withFriend.community).toContain('Your friend');
    expect(plain.community).not.toContain('Your friend');
    void c;
  });
});

describe('y2kLine', () => {
  it('counts down in the week before New Year\'s Eve', () => {
    expect(y2kLine(10)).toContain('4 days');
    expect(y2kLine(13)).toContain('1 day');
    expect(y2kLine(13)).not.toContain('1 days');
  });

  it('announces the night itself and the anticlimax after', () => {
    expect(y2kLine(14)).toContain('arrives at midnight');
    expect(y2kLine(15)).toContain('did not end');
  });

  it('is silent when the Millennium is far off', () => {
    expect(y2kLine(1)).toBeNull();
    expect(y2kLine(20)).toBeNull();
  });
});
