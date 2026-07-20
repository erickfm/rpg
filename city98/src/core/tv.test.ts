import { describe, it, expect } from 'vitest';
import { nowPlaying, CHANNELS } from './tv';
import { newGame } from './sim';
import type { GameState } from './types';

const st = (over: Partial<GameState> = {}): GameState => ({ ...newGame(1), ...over });

describe('nowPlaying', () => {
  it('fills every channel with a program', () => {
    for (let ch = 0; ch < CHANNELS; ch++) {
      const p = nowPlaying(ch, st({ day: 3, minute: 600 }));
      expect(p.channel.length).toBeGreaterThan(0);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(0);
    }
  });

  it('news recaps the day\'s Herald lead', () => {
    const p = nowPlaying(0, st({ day: 6 })); // Harvest Fair
    expect(p.channel).toBe('CITY 4 NEWS');
    expect(p.body).toContain('HARVEST FAIR');
  });

  it('the weather channel reads a forecast', () => {
    const p = nowPlaying(1, st({ day: 2 }));
    expect(p.channel).toBe('WEATHER NOW');
    expect(p.body).toContain('Tomorrow:');
  });

  it('channel 5 becomes a Y2K special near New Year\'s, otherwise public access', () => {
    expect(nowPlaying(4, st({ day: 14 })).channel).toBe('SPECIAL REPORT');
    expect(nowPlaying(4, st({ day: 3 })).channel).toBe('PUBLIC ACCESS');
  });

  it('reruns rotate through the day but stay deterministic', () => {
    const a = nowPlaying(2, st({ day: 1, minute: 60 }));
    const b = nowPlaying(2, st({ day: 1, minute: 60 }));
    expect(a).toEqual(b);
    const later = nowPlaying(2, st({ day: 1, minute: 60 + 30 * 3 }));
    expect(later.title).not.toBe(a.title); // a few slots later, a different show
  });

  it('wraps out-of-range channel indices', () => {
    expect(nowPlaying(CHANNELS, st())).toEqual(nowPlaying(0, st()));
    expect(nowPlaying(-1, st())).toEqual(nowPlaying(CHANNELS - 1, st()));
  });
});
