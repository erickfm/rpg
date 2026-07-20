import { describe, expect, it } from 'vitest';
import { applyAtNewLines, isCeo, NEWLINES_RANKS, workMcSticks, workNewLines } from './career';
import { fresh } from './test-helpers';

describe('New Lines Inc.', () => {
  it('requires 20 INT to get hired', () => {
    expect(applyAtNewLines(fresh()).ok).toBe(false);
    const smart = fresh({ stats: { strength: 3, intelligence: 20, charm: 3 } });
    const r = applyAtNewLines(smart);
    expect(r.ok).toBe(true);
    expect(r.state.jobRank).toBe(0);
  });

  it('pays wage × 6 hours', () => {
    const s = fresh({ jobRank: 0, cash: 0 });
    const r = workNewLines(s);
    expect(r.state.cash).toBe(8 * 6);
    expect(r.state.minute).toBe(8 * 60 + 360);
  });

  it('promotes when shifts and INT are both met', () => {
    let s = fresh({
      jobRank: 0,
      stats: { strength: 3, intelligence: 60, charm: 3 },
      shiftsAtRank: 2, // 3rd shift completes the requirement
    });
    const r = workNewLines(s);
    expect(r.state.jobRank).toBe(1);
    expect(r.state.shiftsAtRank).toBe(0);
    expect(r.msg).toContain('promoted');
  });

  it('withholds promotion without the INT gate', () => {
    const s = fresh({ jobRank: 0, shiftsAtRank: 10, stats: { strength: 3, intelligence: 20, charm: 3 } });
    expect(workNewLines(s).state.jobRank).toBe(0);
  });

  it('climbs all the way to CEO at $100/h', () => {
    let s = fresh({
      jobRank: 0,
      stats: { strength: 3, intelligence: 999, charm: 3 },
      cash: 0,
    });
    for (let i = 0; i < 60 && !isCeo(s); i++) {
      s = workNewLines(s).state;
      if (s.minute >= 20 * 60) s = { ...s, minute: 8 * 60, day: s.day + 1 };
    }
    expect(isCeo(s)).toBe(true);
    const ceoPay = workNewLines({ ...s, cash: 0 }).state.cash;
    expect(ceoPay).toBe(600);
    expect(NEWLINES_RANKS[NEWLINES_RANKS.length - 1].wage).toBe(100);
  });
});

describe('McSticks', () => {
  it('always hires, pays $36 a shift', () => {
    const r = workMcSticks(fresh({ cash: 0 }));
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(36);
  });
});
