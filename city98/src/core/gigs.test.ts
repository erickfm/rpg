import { describe, expect, it } from 'vitest';
import {
  GIG_TEMPLATES, abandonGig, acceptGig, availableGigs, gigTimeLeft, tryCompleteGig,
} from './gigs';
import { newGame } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });
const tapes = GIG_TEMPLATES.find(g => g.id === 'tapes')!;

describe('the payphone board', () => {
  it('offers a stable set of gigs for the day', () => {
    const s = fresh();
    const a = availableGigs(s).map(g => g.id);
    const b = availableGigs(s).map(g => g.id);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(2);
    // a new day reshuffles
    expect(availableGigs(fresh({ day: 4 })).map(g => g.id)).not.toEqual(a);
  });

  it('accepting sets a deadline and blocks a second gig', () => {
    const r = acceptGig(fresh({ minute: 10 * 60 }), tapes);
    expect(r.ok).toBe(true);
    expect(r.state.gig?.dest).toBe('video');
    expect(r.state.gig?.deadlineAbs).toBe(10 * 60 + tapes.window);
    expect(acceptGig(r.state, tapes).ok).toBe(false);
  });

  it('pays when you reach the right place in time', () => {
    const accepted = acceptGig(fresh({ minute: 10 * 60 }), tapes).state;
    // wrong place: no completion
    expect(tryCompleteGig(accepted, 'diner')).toBeNull();
    // right place, on time
    const r = tryCompleteGig(accepted, 'video')!;
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(accepted.cash + tapes.pay);
    expect(r.state.gig).toBeNull();
  });

  it('no pay when you show up late, but the gig clears', () => {
    const accepted = acceptGig(fresh({ minute: 10 * 60 }), tapes).state;
    const late = { ...accepted, minute: 10 * 60 + tapes.window + 5 };
    const r = tryCompleteGig(late, 'video')!;
    expect(r.ok).toBe(false);
    expect(r.state.cash).toBe(accepted.cash);
    expect(r.state.gig).toBeNull();
  });

  it('tracks time left and can be abandoned', () => {
    const accepted = acceptGig(fresh({ minute: 10 * 60 }), tapes).state;
    expect(gigTimeLeft(accepted)).toBe(tapes.window);
    expect(gigTimeLeft(fresh())).toBeNull();
    expect(abandonGig(accepted).state.gig).toBeNull();
    expect(abandonGig(fresh()).ok).toBe(false);
  });

  it('deadlines survive crossing midnight', () => {
    const accepted = acceptGig(fresh({ day: 1, minute: 23 * 60 + 30 }), tapes).state;
    // 30 min later it's day 2, 00:00 — still within the 90-min window
    const nextDay = { ...accepted, day: 2, minute: 0 };
    expect(tryCompleteGig(nextDay, 'video')!.ok).toBe(true);
  });
});
