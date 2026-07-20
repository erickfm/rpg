import { describe, it, expect } from 'vitest';
import { decorFor } from './decor';
import { seasonFor } from './calendar';

describe('decorFor', () => {
  it('themes the town to the current season', () => {
    for (const day of [1, 8, 15, 22, 30]) {
      expect(decorFor(day).theme).toBe(seasonFor(day));
    }
  });

  it('hangs a banner only on holidays, trimmed to a short label', () => {
    expect(decorFor(5).banner).toBeNull();
    expect(decorFor(6).banner).toBe('HARVEST FAIR');
    // the em-dash tail ("— Y2K!") is trimmed for the banner
    expect(decorFor(14).banner).toBe("NEW YEAR'S EVE");
  });
});
