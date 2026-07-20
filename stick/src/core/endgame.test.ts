import { describe, expect, it } from 'vitest';
import {
  checkTitleOffer, dictatorAvailable, evaluateEnding, presidentAvailable, runForOffice,
} from './endgame';
import { NEWLINES_RANKS } from './career';
import { fresh } from './test-helpers';
import type { GameState } from './types';

const contender = (patch: Partial<GameState> = {}): GameState =>
  fresh({
    stats: { strength: 800, intelligence: 800, charm: 800 },
    home: 'castle',
    jobRank: NEWLINES_RANKS.length - 1,
    cash: 600_000,
    karma: 10,
    ...patch,
  });

describe('title requirements', () => {
  it('president needs the full checklist plus positive karma', () => {
    expect(presidentAvailable(contender())).toBe(true);
    expect(presidentAvailable(contender({ karma: 0 }))).toBe(false);
    expect(presidentAvailable(contender({ home: 'bigger' }))).toBe(false);
    expect(presidentAvailable(contender({ jobRank: 3 }))).toBe(false);
    expect(presidentAvailable(contender({ cash: 100_000 }))).toBe(false);
    expect(presidentAvailable(contender({ stats: { strength: 799, intelligence: 800, charm: 800 } }))).toBe(false);
  });

  it('dictator flips the karma sign and raises the price', () => {
    expect(dictatorAvailable(contender({ karma: -10 }))).toBe(true);
    expect(dictatorAvailable(contender({ karma: -10, cash: 400_000 }))).toBe(false);
  });

  it('leaves exactly one campaign message', () => {
    const offered = checkTitleOffer(contender());
    expect(offered.titleOffered).toBe(true);
    expect(offered.messages).toHaveLength(1);
    expect(checkTitleOffer(offered).messages).toHaveLength(1);
    expect(checkTitleOffer(fresh()).titleOffered).toBe(false);
  });
});

describe('runForOffice', () => {
  it('president costs $200k and sets the title', () => {
    const r = runForOffice(contender(), 'president');
    expect(r.ok).toBe(true);
    expect(r.state.title).toBe('president');
    expect(r.state.cash).toBe(400_000);
    expect(runForOffice(fresh(), 'president').ok).toBe(false);
  });
});

describe('endings', () => {
  it('ranks the classic outcomes', () => {
    expect(evaluateEnding(fresh({ dead: true, deathCause: 'Ouch.' })).id).toBe('dead');
    expect(evaluateEnding(fresh({ title: 'president' })).id).toBe('president');
    expect(evaluateEnding(fresh({ cash: 1_200_000 })).id).toBe('millionaire');
    expect(evaluateEnding(fresh({ stats: { strength: 500, intelligence: 500, charm: 500 } })).id).toBe('renaissance');
    expect(evaluateEnding(fresh({ karma: -80 })).id).toBe('menace');
    expect(evaluateEnding(fresh()).id).toBe('average');
  });
});
