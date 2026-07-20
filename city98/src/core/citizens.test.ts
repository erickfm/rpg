import { describe, expect, it } from 'vitest';
import { CITIZENS, FRIENDS_THRESHOLD, befriend, citizenById, citizenSpot, talkLine } from './citizens';
import { newGame } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });
const gloria = citizenById('gloria')!;

describe('named citizens', () => {
  it('every citizen has a schedule covering the whole day', () => {
    for (const c of CITIZENS) {
      expect(c.schedule.length).toBeGreaterThan(0);
      expect(c.schedule[c.schedule.length - 1].until).toBe(24 * 60);
      // strictly increasing until-times
      for (let i = 1; i < c.schedule.length; i++) {
        expect(c.schedule[i].until).toBeGreaterThan(c.schedule[i - 1].until);
      }
    }
  });

  it('positions a citizen by the current time', () => {
    const morning = citizenSpot(gloria, 8 * 60);
    const afternoon = citizenSpot(gloria, 12 * 60);
    const evening = citizenSpot(gloria, 22 * 60);
    expect(morning.spot).not.toEqual(afternoon.spot);
    expect(afternoon.label).toContain('Datacorp');
    expect(evening.label).toContain('park');
  });

  it('greetings rotate and stay in-character', () => {
    const a = talkLine(gloria, fresh({ minute: 600 }), 600);
    expect(a.startsWith('Gloria:')).toBe(true);
  });

  it('friendship builds and pays a one-time favor at the threshold', () => {
    let s = fresh({ cash: 0 });
    for (let i = 1; i < FRIENDS_THRESHOLD; i++) {
      const r = befriend(s, 'gloria');
      expect(r.state.friends.gloria).toBe(i);
      expect(r.state.cash).toBe(0);
      s = r.state;
    }
    const boon = befriend(s, 'gloria');
    expect(boon.state.friends.gloria).toBe(FRIENDS_THRESHOLD);
    expect(boon.state.cash).toBe(20);
    expect(boon.msg).toContain('$20');
    // past the threshold, no more payouts
    const after = befriend(boon.state, 'gloria');
    expect(after.state.cash).toBe(20);
  });

  it('befriending an unknown id is a no-op', () => {
    expect(befriend(fresh(), 'nobody').ok).toBe(false);
  });
});
