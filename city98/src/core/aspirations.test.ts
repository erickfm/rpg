import { describe, expect, it } from 'vitest';
import { ASPIRATIONS, allDone, checkAspirations, isDone, progress } from './aspirations';
import { newGame } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });

describe('life goals', () => {
  it('a new game has none done', () => {
    expect(progress(fresh())).toEqual({ done: 0, total: ASPIRATIONS.length });
    expect(checkAspirations(fresh())).toBeNull();
  });

  it('completing a goal pays its reward exactly once', () => {
    const s = fresh({ cash: 0, savings: 5000 }); // Rainy Day Fund
    const r = checkAspirations(s)!;
    expect(r.ok).toBe(true);
    expect(isDone(r.state, 'nest')).toBe(true);
    expect(r.state.cash).toBe(250);
    // re-checking the same state yields nothing new
    expect(checkAspirations(r.state)).toBeNull();
  });

  it('several goals can complete in one check', () => {
    const s = fresh({ cash: 0, car: 'sedan', savings: 5000 });
    const r = checkAspirations(s)!;
    expect(isDone(r.state, 'wheels')).toBe(true);
    expect(isDone(r.state, 'nest')).toBe(true);
    expect(r.state.cash).toBe(100 + 250);
  });

  it('finishing the last goal declares victory', () => {
    // satisfy everything at once
    let s = fresh({
      car: 'pickup',
      savings: 5000,
      goods: ['rec_neon', 'rec_gravel', 'rec_midnight', 'up_stereo', 'up_lamp', 'up_plant'],
      shiftsWorked: { video: 0, office: 12 },
      day: 14,
      debt: 0,
      home: 'loft',
    });
    const r = checkAspirations(s)!;
    expect(allDone(r.state)).toBe(true);
    expect(r.state.wonAt).toBe(14);
    expect(r.msg).toContain('made it');
  });

  it('does not re-win or double-count on a later check', () => {
    let s = fresh({ car: 'sedan' });
    s = checkAspirations(s)!.state;
    const before = s.cash;
    expect(checkAspirations(s)).toBeNull();
    expect(s.cash).toBe(before);
  });
});
